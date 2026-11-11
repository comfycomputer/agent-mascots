import type { Page } from '@playwright/test';

/**
 * Test doubles for the parts of the platform these tests cannot drive for real:
 * no engine here has a motion sensor, and none implements iOS permissions.
 *
 * `plain` is an Android-style device, with sensors and no permission step.
 * `ios` adds `requestPermission`, which behaves as WebKit does: it rejects
 * without a gesture until the user has answered, and only prompts in one.
 * `absent` is a browser with no DeviceOrientationEvent at all.
 */
export type SensorMode = 'absent' | 'plain' | 'ios';

export interface SensorControls {
  /** Calls to `requestPermission`. */
  requests: number;
  /** What the user answers at the prompt. */
  answer: 'granted' | 'denied';
  /** Dispatch one reading. */
  emit(beta: number | null, gamma: number | null): void;
  /** Dispatch enough readings to finish calibrating. */
  settle(beta: number, gamma: number): void;
  /** Dispatch readings for a while at about 60Hz. Smoothing works on elapsed time. */
  hold(beta: number, gamma: number, ms?: number): Promise<void>;
  /** Change `screen.orientation.angle`. */
  rotate(angle: number): void;
}

/** Counts listeners by target and type, the way `addEventListener` dedupes them. */
export interface ListenerProbe {
  count(target: EventTarget, type: string): number;
}

declare global {
  interface Window {
    sensors: SensorControls;
    listeners: ListenerProbe;
  }
}

export async function stubSensors(page: Page, mode: SensorMode): Promise<void> {
  await page.addInitScript((sensorMode: SensorMode) => {
    let answered = false;
    let angle = 0;

    const controls: SensorControls = {
      requests: 0,
      answer: 'granted',
      emit(beta, gamma) {
        const event = new Event('deviceorientation');
        Object.assign(event, { alpha: beta == null ? null : 0, beta, gamma });
        window.dispatchEvent(event);
      },
      settle(beta, gamma) {
        for (let i = 0; i < 12; i += 1) this.emit(beta, gamma);
      },
      async hold(beta, gamma, ms = 350) {
        const end = performance.now() + ms;
        while (performance.now() < end) {
          this.emit(beta, gamma);
          await new Promise((resolve) => setTimeout(resolve, 16));
        }
      },
      rotate(next) {
        angle = next;
      },
    };
    window.sensors = controls;

    // Chromium really does fire an all-null event at a sensor-less desktop. Registered
    // first, this keeps real events away from the code under test, so only `emit` counts.
    window.addEventListener('deviceorientation', (event) => {
      if (event.isTrusted) event.stopImmediatePropagation();
    });

    Object.defineProperty(screen, 'orientation', {
      configurable: true,
      value: { get angle() { return angle; } },
    });

    if (sensorMode === 'absent') {
      Reflect.deleteProperty(window, 'DeviceOrientationEvent');
      return;
    }

    class FakeOrientationEvent extends Event {}
    const stub: Record<string, unknown> = {};
    if (sensorMode === 'ios') {
      stub.requestPermission = function requestPermission(): Promise<string> {
        controls.requests += 1;
        // `window.event` is only set synchronously inside a handler, which is the
        // property that matters: an await before the call would lose the gesture.
        const inGesture = window.event?.type === 'click';
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (!answered && !inGesture) {
              reject(new DOMException('Requires a user gesture', 'NotAllowedError'));
              return;
            }
            answered = true;
            resolve(controls.answer);
          }, 5);
        });
      };
    }
    Object.assign(FakeOrientationEvent, stub);
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: FakeOrientationEvent,
    });
  }, mode);
}

export async function probeListeners(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const live = new WeakMap<EventTarget, Map<string, Set<unknown>>>();
    const proto = EventTarget.prototype;
    const { addEventListener: add, removeEventListener: remove } = proto;
    const held = (target: EventTarget, type: string): Set<unknown> => {
      const types = live.get(target) ?? new Map<string, Set<unknown>>();
      live.set(target, types);
      const set = types.get(type) ?? new Set<unknown>();
      types.set(type, set);
      return set;
    };

    proto.addEventListener = function patched(this: EventTarget | undefined, type, listener, options) {
      const target = this ?? window;
      held(target, type).add(listener);
      add.call(target, type, listener, options);
    };
    proto.removeEventListener = function patched(this: EventTarget | undefined, type, listener, options) {
      const target = this ?? window;
      held(target, type).delete(listener);
      remove.call(target, type, listener, options);
    };
    window.listeners = { count: (target, type) => held(target, type).size };
  });
}

/** How far the eyes are displaced, from the transform on the eye layer. */
export function eyeOffset(page: Page, selector = '#m'): Promise<{ x: number; y: number }> {
  return page.evaluate((query) => {
    const mascot = document.querySelector(query) as HTMLElement;
    const eyes = mascot.shadowRoot?.querySelector('.eyes') as SVGElement;
    const [, x = '0', y = '0'] = /translate\(([-\d.]+)%?,\s*([-\d.]+)%?\)/.exec(eyes.style.transform) ?? [];
    return { x: Number(x), y: Number(y) };
  }, selector);
}

/** Let the observers deliver and a frame pass. */
export function settled(page: Page): Promise<void> {
  return page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
