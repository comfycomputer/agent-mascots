import { clamp } from '../dom.js';
import type { GyroState, LookHost, LookSource, LookTarget } from '../types.js';
import { prefersReducedMotion } from '../motion/reduced.js';
import { warnOnce } from '../warn.js';
import { type Follower, joinFeed, leaveFeed, type PointerFeed } from './feed.js';
import {
  gyroClients,
  type GyroClient,
  gyroNeedsGesture,
  gyroState,
  refreshGyro,
  requestGyro,
  tilt,
} from './gyro.js';

/** The pointer stops counting as active, and gyro or the mood takes over, after this long. */
const POINTER_IDLE_MS = 2000;
/** With `track="self"` the pointer never gets far, so a full look must be close to the edge. */
const SELF_REACH = 0.42;
/** Selector retries back off from this delay, doubling, for about 51 seconds in all. */
const RETRY_MS = 50;
const RETRIES = 10;
/** How often a held `lookAt` is aimed again, in case the mascot or the point has moved. */
const REAIM_MS = 250;

/**
 * Answers "where should the eyes go?". Inputs rank `lookAt()`, then an active
 * pointer, then gyro, then null, which hands the eyes to the mood or idle wander.
 * `invalidate` redraws if the loop is stopped.
 */
export function createLookSource(host: LookHost, invalidate: () => void): LookSource {
  let override: LookTarget | null = null;
  /** The `lookAt` point, kept to aim again as the layout changes. */
  let requested: readonly [number, number] | null = null;
  let aimedAt = 0;
  let pointer: LookTarget | null = null;
  let target: EventTarget | null = null;
  let feed: PointerFeed | null = null;
  let bound = false;
  let visible = false;
  let joined = false;
  /** `enableGyro()` set the attribute, so an answer of no takes it away again. */
  let reflected = false;
  let reported: GyroState | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let handoff: ReturnType<typeof setTimeout> | undefined;
  /** Notices a selector's target being removed. Nothing else does: it sends no event. */
  let removal: MutationObserver | undefined;

  const aim = (clientX: number, clientY: number, reach: number): { x: number; y: number } | null => {
    const box = host.getBoundingClientRect();
    if (!box.width) return null;
    const dx = clientX - (box.left + box.width / 2);
    const dy = clientY - (box.top + box.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, length / (box.width * reach));
    return { x: clamp((dx / length) * k, -1, 1), y: clamp((dy / length) * k, -1, 1) };
  };

  const follower: Follower = {
    move(clientX, clientY) {
      // A shared feed reaches off-screen mascots too; they have nothing to draw.
      if (!visible) return;
      const self = target === host && !host.hasAttribute('track-reach');
      const point = aim(clientX, clientY, self ? SELF_REACH : host.trackReach);
      pointer = point && { ...point, source: 'pointer' };
      // A stopped loop gets no frame to notice that the pointer went idle.
      if (prefersReducedMotion()) {
        clearTimeout(handoff);
        handoff = setTimeout(invalidate, POINTER_IDLE_MS + 50);
      }
      // After the feed's loop: a redraw between two followers' reads would force layout.
      queueMicrotask(invalidate);
    },
    leave() {
      pointer = null;
      invalidate();
    },
  };

  function read(now: number): LookTarget | null {
    if (requested && now - aimedAt > REAIM_MS) aimOverride();
    if (override) return override;
    if (feed && now - feed.movedAt < POINTER_IDLE_MS) return pointer;
    return client.live && tilt.ready ? tilt.target : null;
  }

  const client: GyroClient = {
    live: false,
    onState: report,
    onTilt() {
      if (read(performance.now()) === tilt.target) invalidate();
    },
  };

  function aimOverride(): void {
    aimedAt = performance.now();
    const point = requested && aim(requested[0], requested[1], host.trackReach);
    if (point) override = { ...point, source: 'api' };
  }

  function report(state: GyroState): void {
    if (gyroState()) host.removeEventListener('click', onTap);
    if (reflected && state !== 'granted') {
      reflected = false;
      host.removeAttribute('gyro');
    }
    if (state === reported) return;
    reported = state;
    host.dispatchEvent(
      new CustomEvent('mascot-gyro', { bubbles: true, composed: true, detail: { state } }),
    );
  }

  async function ensureGyro(): Promise<GyroState> {
    const state = await requestGyro();
    report(state);
    return state;
  }

  function onTap(): void {
    void ensureGyro();
  }

  function syncGyro(): void {
    const want = bound && host.gyro;
    if (want !== joined) {
      joined = want;
      if (want) {
        gyroClients.add(client);
        if (gyroNeedsGesture()) host.addEventListener('click', onTap);
        else void ensureGyro();
      } else {
        gyroClients.delete(client);
        host.removeEventListener('click', onTap);
      }
    }
    client.live = want && visible;
    refreshGyro();
  }

  /** Null means nothing to track. Undefined means a selector that does not match yet. */
  function resolve(): EventTarget | null | undefined {
    if (host.trackElement) return host.trackElement;
    const track = host.track.trim();
    if (track === 'none') return null;
    if (track === 'self' || !track) return host;
    if (track === 'window') return window;
    try {
      const root = host.getRootNode() as ParentNode;
      return root.querySelector(track) ?? document.querySelector(track) ?? undefined;
    } catch {
      warnOnce(`invalid track selector "${track}", using self`);
      return host;
    }
  }

  function release(): void {
    removal?.disconnect();
    if (target) leaveFeed(target, follower);
    target = feed = null;
    if (pointer) {
      pointer = null;
      invalidate();
    }
  }

  function attach(attempt: number): void {
    clearTimeout(retry);
    const found = resolve();
    if ((found ?? null) !== target) {
      release();
      target = found ?? null;
      if (target) feed = joinFeed(target, follower);
      // `trackElement` is the consumer's to change, and window has no root to watch.
      const node = target as Node | null;
      if (node?.nodeType && node !== host && !host.trackElement) {
        removal ??= new MutationObserver(() => {
          if (!(target as Node).isConnected) attach(0);
        });
        removal.observe(node.getRootNode(), { childList: true, subtree: true });
      }
    }
    if (found !== undefined) return;
    if (attempt < RETRIES) retry = setTimeout(attach, RETRY_MS * 2 ** attempt, attempt + 1);
    else warnOnce(`track selector "${host.track}" matched nothing`);
  }

  return {
    read,
    bind() {
      bound = true;
      attach(0);
      syncGyro();
      aimOverride();
      invalidate();
    },
    unbind() {
      bound = visible = false;
      clearTimeout(retry);
      release();
      syncGyro();
    },
    setVisible(value) {
      visible = value;
      if (value) aimOverride();
      else pointer = null;
      syncGyro();
    },
    lookAt(clientX, clientY) {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        warnOnce(`invalid lookAt(${clientX}, ${clientY})`);
        return;
      }
      requested = [clientX, clientY];
      aimOverride();
      invalidate();
    },
    lookAway() {
      override = requested = null;
      invalidate();
    },
    enableGyro() {
      // First: iOS only prompts when this is reached synchronously from a tap.
      const answer = ensureGyro();
      // Reflected now, so `gyro = false` wins however it was turned on, even mid-prompt.
      if (!host.gyro) {
        reflected = true;
        host.toggleAttribute('gyro', true);
      }
      return answer;
    },
  };
}
