// The `[mood, ms]` player behind the Timeline. It runs on the wall clock, so a late timer never
// stretches the piece, and a background tab lands on the right beat when it returns.

export const MIN_BEAT = 600;

export type Beat = [mood: string, ms: number];

export interface Schedule {
  /** Also resumes after `pause`. */
  start(): void;
  pause(): void;
  stop(): void;
  readonly running: boolean;
}

/** `onBeat(mood, index)` runs as each beat starts. */
export function createSchedule(
  steps: readonly Beat[],
  onBeat: (mood: string, index: number) => void,
  { loop = false, now = () => performance.now() } = {},
): Schedule {
  const beats = steps.map(([mood, ms]): Beat => [mood, Math.max(ms, MIN_BEAT)]);
  const length = beats.reduce((total, [, ms]) => total + ms, 0);

  let origin = 0;
  let pausedAt = 0;
  let current = -1;
  let timer: ReturnType<typeof setTimeout> | 0 = 0;

  /** The beat at `elapsed`, and the time until the next one. */
  function locate(elapsed: number) {
    let edge = 0;
    for (const [index, [, ms]] of beats.entries()) {
      edge += ms;
      if (elapsed < edge) return { index, remaining: edge - elapsed };
    }
    return null;
  }

  function tick() {
    timer = 0;
    let elapsed = now() - origin;
    if (elapsed >= length) {
      if (!loop) {
        current = -1;
        return;
      }
      elapsed %= length;
      origin = now() - elapsed;
    }
    const found = locate(elapsed);
    if (!found) return;
    if (found.index !== current) {
      current = found.index;
      onBeat(beats[found.index]![0], found.index);
    }
    timer = setTimeout(tick, found.remaining);
  }

  return {
    start() {
      if (timer || !beats.length) return;
      origin = now() - pausedAt;
      pausedAt = 0;
      tick();
    },
    pause() {
      if (!timer) return;
      clearTimeout(timer);
      timer = 0;
      pausedAt = now() - origin;
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = 0;
      pausedAt = 0;
      current = -1;
    },
    get running() {
      return timer !== 0;
    },
  };
}
