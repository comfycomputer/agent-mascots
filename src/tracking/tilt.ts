import type { LookTarget } from '../types.js';

/** Readings averaged to find how the device is being held. */
export const CALIBRATION_SAMPLES = 8;
/** Smoothing time constant. Sensors are noisy; the gaze spring adds its own lag on top. */
const SMOOTH_MS = 90;
/** Change in gravity, as a fraction of 1g, for a full look: about 25 degrees of tilt. */
const FULL_TILT = 0.42;
/** Ignore smaller changes in the look, so sensor noise never causes a redraw. */
const DEADBAND = 0.02;

const RADIANS = Math.PI / 180;

/** Scale a vector down to at most unit length. */
const shrink = (length: number): number => (length > 1 ? 1 / length : 1);

export interface TiltFilter {
  /** Shared by every mascot, and written in place, so sensor events allocate nothing. */
  readonly target: LookTarget;
  /** True once the resting angle is known. */
  readonly ready: boolean;
  /** Take one reading. Returns true when `target` or `ready` changed. */
  sample(beta: number, gamma: number, screenAngle: number, now: number): boolean;
  /** Forget the resting angle. The next readings measure it again. */
  reset(): void;
}

/**
 * Turns device orientation into a look direction. Works on the direction of
 * gravity across the screen instead of on the Euler angles, whose gamma flips
 * and whose beta wraps as a phone passes upright, and which would need a
 * special case for each. `x` is towards the right of the screen, `y` towards
 * the bottom, so the eyes roll towards whichever edge is lowered.
 */
export function createTiltFilter(): TiltFilter {
  const target: LookTarget = { x: 0, y: 0, source: 'gyro' };
  let ready = false;
  let count = 0;
  let restX = 0;
  let restY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let angle = 0;
  let last = 0;

  function reset(): void {
    ready = false;
    count = restX = restY = smoothX = smoothY = target.x = target.y = 0;
  }

  return {
    target,
    get ready() {
      return ready;
    },
    reset,
    sample(beta, gamma, screenAngle, now) {
      // Turning the screen changes how the device is held, so the old rest is meaningless.
      if (screenAngle !== angle) {
        angle = screenAngle;
        reset();
      }
      const deviceX = Math.cos(beta * RADIANS) * Math.sin(gamma * RADIANS);
      const deviceY = Math.sin(beta * RADIANS);
      const sin = Math.sin(angle * RADIANS);
      const cos = Math.cos(angle * RADIANS);
      const x = deviceX * cos + deviceY * sin;
      const y = deviceY * cos - deviceX * sin;

      if (count < CALIBRATION_SAMPLES) {
        restX += x / CALIBRATION_SAMPLES;
        restY += y / CALIBRATION_SAMPLES;
        ready = ++count === CALIBRATION_SAMPLES;
        last = now;
        return ready;
      }

      const lookX = (x - restX) / FULL_TILT;
      const lookY = (y - restY) / FULL_TILT;
      const scale = shrink(Math.hypot(lookX, lookY));
      const blend = 1 - Math.exp((last - now) / SMOOTH_MS);
      last = now;
      smoothX += (lookX * scale - smoothX) * blend;
      smoothY += (lookY * scale - smoothY) * blend;

      if (Math.hypot(smoothX - target.x, smoothY - target.y) < DEADBAND) return false;
      target.x = smoothX;
      target.y = smoothY;
      return true;
    },
  };
}
