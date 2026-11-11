import { describe, expect, it } from 'vitest';
import { CALIBRATION_SAMPLES, createTiltFilter, type TiltFilter } from '../../src/tracking/tilt.js';

const STEP_MS = 16;

const clock = { now: 0 };

/** Feed one reading repeatedly, with a clock that advances between readings. */
function hold(filter: TiltFilter, beta: number, gamma: number, angle = 0, count = 200): void {
  for (let i = 0; i < count; i += 1) filter.sample(beta, gamma, angle, (clock.now += STEP_MS));
}

function calibrated(beta = 45, gamma = 0, angle = 0): TiltFilter {
  const filter = createTiltFilter();
  hold(filter, beta, gamma, angle, CALIBRATION_SAMPLES);
  return filter;
}

/** Where a step in tilt has got to after 200ms, at a given sensor rate. */
function lookAfter200ms(stepMs: number): number {
  const filter = calibrated();
  const start = clock.now;
  while (clock.now < start + 200) filter.sample(45, 20, 0, (clock.now += stepMs));
  return filter.target.x;
}

describe('tilt calibration', () => {
  it('stays not ready until the resting angle is known', () => {
    const filter = createTiltFilter();
    hold(filter, 45, 0, 0, CALIBRATION_SAMPLES - 1);
    expect(filter.ready).toBe(false);
    expect(filter.sample(45, 0, 0, (clock.now += STEP_MS))).toBe(true);
    expect(filter.ready).toBe(true);
  });

  it('treats however the device is held as centre', () => {
    for (const [beta, gamma] of [[0, 0], [45, 0], [70, -20], [-30, 35]] as const) {
      const filter = calibrated(beta, gamma);
      hold(filter, beta, gamma);
      expect(filter.target.x).toBeCloseTo(0, 5);
      expect(filter.target.y).toBeCloseTo(0, 5);
    }
  });

  it('averages the first readings rather than trusting the first one', () => {
    const filter = createTiltFilter();
    for (let i = 0; i < CALIBRATION_SAMPLES; i += 1) {
      filter.sample(45, i % 2 ? 6 : -6, 0, (clock.now += STEP_MS));
    }
    hold(filter, 45, 0);
    expect(filter.target.x).toBeCloseTo(0, 5);
  });

  it('calibrates again after a reset', () => {
    const filter = calibrated();
    hold(filter, 45, 30);
    filter.reset();
    expect(filter.ready).toBe(false);
    expect(filter.target.x).toBe(0);
    hold(filter, 45, 30, 0, CALIBRATION_SAMPLES);
    hold(filter, 45, 30);
    expect(filter.target.x).toBeCloseTo(0, 5);
  });
});

describe('tilt direction', () => {
  it('rolls towards whichever edge is lowered', () => {
    const right = calibrated();
    hold(right, 45, 12);
    expect(right.target.x).toBeGreaterThan(0.1);
    expect(Math.abs(right.target.y)).toBeLessThan(0.1);

    const left = calibrated();
    hold(left, 45, -12);
    expect(left.target.x).toBeLessThan(-0.1);

    const bottom = calibrated();
    hold(bottom, 57, 0);
    expect(bottom.target.y).toBeGreaterThan(0.1);
    expect(Math.abs(bottom.target.x)).toBeLessThan(0.05);

    const top = calibrated();
    hold(top, 33, 0);
    expect(top.target.y).toBeLessThan(-0.1);
  });

  it('caps the look at unit length', () => {
    const filter = calibrated(0, 0);
    hold(filter, 60, 60);
    const length = Math.hypot(filter.target.x, filter.target.y);
    expect(length).toBeLessThanOrEqual(1);
    expect(length).toBeGreaterThan(0.97);
  });

  it('is continuous as a phone passes upright, where gamma flips', () => {
    // The same physical tilt past vertical: gamma jumps by 180 degrees, gravity does not.
    const before = calibrated(80, 0);
    hold(before, 89, 10);
    const after = calibrated(80, 0);
    hold(after, 91, -170);
    expect(after.target.x).toBeCloseTo(before.target.x, 1);
    expect(after.target.y).toBeCloseTo(before.target.y, 1);
  });

  it('is continuous where beta wraps at 180 degrees', () => {
    const filter = calibrated(179, 0);
    hold(filter, -179, 0);
    expect(Math.hypot(filter.target.x, filter.target.y)).toBeLessThan(0.2);
  });
});

describe('screen rotation', () => {
  // Each row: screen angle, then the device tilt that lowers the right edge of the
  // screen, and the tilt that lowers its bottom edge.
  const CASES = [
    { angle: 0, right: [20, 12], bottom: [32, 0] },
    { angle: 90, right: [32, 0], bottom: [20, -12] },
    { angle: 180, right: [20, -12], bottom: [8, 0] },
    { angle: 270, right: [8, 0], bottom: [20, 12] },
  ] as const;

  for (const { angle, right, bottom } of CASES) {
    it(`maps the device axes onto the screen at ${angle} degrees`, () => {
      const toRight = calibrated(20, 0, angle);
      hold(toRight, right[0], right[1], angle);
      expect(toRight.target.x).toBeGreaterThan(0.1);
      expect(Math.abs(toRight.target.y)).toBeLessThan(0.1);

      const toBottom = calibrated(20, 0, angle);
      hold(toBottom, bottom[0], bottom[1], angle);
      expect(toBottom.target.y).toBeGreaterThan(0.1);
      expect(Math.abs(toBottom.target.x)).toBeLessThan(0.1);
    });
  }

  it('calibrates again when the screen turns', () => {
    const filter = calibrated(60, 0, 0);
    hold(filter, 60, 20, 0);
    expect(filter.target.x).toBeGreaterThan(0.1);

    filter.sample(0, -60, 90, (clock.now += STEP_MS));
    expect(filter.ready).toBe(false);
    expect(filter.target.x).toBe(0);
    hold(filter, 0, -60, 90, CALIBRATION_SAMPLES);
    expect(filter.ready).toBe(true);
    hold(filter, 0, -60, 90);
    expect(filter.target.x).toBeCloseTo(0, 5);
    expect(filter.target.y).toBeCloseTo(0, 5);
  });
});

describe('tilt smoothing', () => {
  it('eases towards a step instead of jumping to it', () => {
    const filter = calibrated();
    const seen: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      filter.sample(45, 20, 0, (clock.now += STEP_MS));
      seen.push(filter.target.x);
    }
    const settled = seen.at(-1) ?? 0;
    expect(seen[1]).toBeLessThan(settled * 0.5);
    expect(seen.every((value, i) => value >= (seen[i - 1] ?? 0))).toBe(true);
  });

  it('smooths by elapsed time, so a slow sensor settles as fast as a quick one', () => {
    expect(lookAfter200ms(8)).toBeCloseTo(lookAfter200ms(50), 1);
  });

  it('attenuates a single spike', () => {
    const filter = calibrated();
    filter.sample(45, 60, 0, (clock.now += STEP_MS));
    filter.sample(45, 0, 0, (clock.now += STEP_MS));
    expect(Math.abs(filter.target.x)).toBeLessThan(0.3);
  });

  it('reports no change for noise inside the deadband', () => {
    const filter = calibrated();
    let changes = 0;
    for (let i = 0; i < 100; i += 1) {
      if (filter.sample(45 + (i % 2 ? 0.1 : -0.1), 0, 0, (clock.now += STEP_MS))) changes += 1;
    }
    expect(changes).toBe(0);
    expect(filter.target).toEqual({ x: 0, y: 0, source: 'gyro' });
  });
});
