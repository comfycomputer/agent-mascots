/** Longest step fed to the springs, so a stalled tab resumes smoothly. */
const MAX_DT = 0.05;

export type Tick = (dt: number) => void;

const ticks = new Set<Tick>();
let handle = 0;
let last = 0;

function frame(now: number): void {
  const dt = Math.min(MAX_DT, (now - (last || now)) / 1000);
  last = now;
  for (const tick of ticks) {
    try {
      tick(dt);
    } catch (error) {
      // Every mascot shares this loop, so one failing must not stop the others.
      ticks.delete(tick);
      reportError(error);
    }
  }
  handle = ticks.size ? requestAnimationFrame(frame) : 0;
  if (!handle) last = 0;
}

/** Join the one shared animation frame. */
export function addTick(tick: Tick): void {
  ticks.add(tick);
  handle ||= requestAnimationFrame(frame);
}

export function removeTick(tick: Tick): void {
  ticks.delete(tick);
  if (ticks.size || !handle) return;
  cancelAnimationFrame(handle);
  handle = 0;
  last = 0;
}

/** Number of active subscribers. Off-screen mascots are not counted. */
export const activeTicks = (): number => ticks.size;
