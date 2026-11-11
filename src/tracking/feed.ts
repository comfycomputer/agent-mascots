export interface Follower {
  move(clientX: number, clientY: number): void;
  leave(): void;
}

/** One set of pointer listeners on one target, however many mascots follow it. */
export interface PointerFeed {
  /** `performance.now()` at the last pointer input over the target. */
  movedAt: number;
}

interface LiveFeed extends PointerFeed {
  followers: Set<Follower>;
  stop(): void;
}

const feeds = new Map<EventTarget, LiveFeed>();

function open(target: EventTarget): LiveFeed {
  const followers = new Set<Follower>();
  // `pointerleave` never fires on window; the root element sees the pointer leave the page.
  const edge = target === window ? document.documentElement : target;
  const feed: LiveFeed = {
    movedAt: -Infinity,
    followers,
    stop() {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerdown', onMove);
      edge.removeEventListener('pointerleave', onLeave);
    },
  };

  function onMove(event: Event): void {
    feed.movedAt = performance.now();
    const { clientX, clientY } = event as PointerEvent;
    for (const follower of followers) follower.move(clientX, clientY);
  }

  function onLeave(): void {
    for (const follower of followers) follower.leave();
  }

  // `pointerdown` catches a tap, which has no move before it.
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerdown', onMove, { passive: true });
  edge.addEventListener('pointerleave', onLeave, { passive: true });
  return feed;
}

export function joinFeed(target: EventTarget, follower: Follower): PointerFeed {
  let feed = feeds.get(target);
  if (!feed) feeds.set(target, (feed = open(target)));
  feed.followers.add(follower);
  return feed;
}

export function leaveFeed(target: EventTarget, follower: Follower): void {
  const feed = feeds.get(target);
  if (!feed?.followers.delete(follower) || feed.followers.size) return;
  feed.stop();
  feeds.delete(target);
}
