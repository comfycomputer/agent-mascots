import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MASCOT_MOODS } from '../../src/constants.js';
import { activeTicks, addTick, removeTick } from '../../src/motion/loop.js';
import { MOODS } from '../../src/motion/moods.js';
import {
  createMotionState,
  type MotionChannels,
  type MotionInput,
  type MotionState,
  pokeMotion,
  settleMotion,
  stepMotion,
  writePose,
} from '../../src/motion/state.js';
import type { MoodName, Pose } from '../../src/types.js';

const FRAME = 1 / 60;
const DIALS: MotionChannels = { motion: 1, float: 1, blink: 1, glance: 1, bounce: 1, gaze: 1 };

const input = (overrides: Partial<MotionInput> = {}): MotionInput => ({
  mood: 'idle',
  channels: DIALS,
  look: null,
  level: null,
  floatScale: 1,
  still: false,
  ...overrides,
});

// oxlint-disable unicorn/consistent-function-scoping -- local helpers read better next to their tests.
const dials = (overrides: Partial<MotionChannels>): MotionChannels => ({ ...DIALS, ...overrides });

const run = (state: MotionState, seconds: number, frame: MotionInput) => {
  for (let i = 0; i < seconds * 60; i++) stepMotion(state, FRAME, frame);
};

/** Pose numbers, flattened, so frames can be compared. */
const sample = (pose: Pose): number[] => [
  pose.x,
  pose.y,
  pose.rotate,
  pose.scaleX * 100,
  pose.scaleY * 100,
  pose.left.open * 10,
  pose.right.open * 10,
  pose.left.arc * 10,
  pose.left.tilt,
  pose.shadowScale * 100,
];

describe('shared loop', () => {
  let frames: FrameRequestCallback[];
  // Set by hand, not with vi.stubGlobal, so the tests run under `bun test` as well as Vitest.
  const { requestAnimationFrame: raf, cancelAnimationFrame: caf } = globalThis;

  beforeEach(() => {
    frames = [];
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => frames.push(callback);
    globalThis.cancelAnimationFrame = () => {
      frames = [];
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
  });

  const fire = (now: number) => {
    const pending = frames;
    frames = [];
    for (const frame of pending) frame(now);
  };

  it('uses one frame request for any number of subscribers', () => {
    const a = vi.fn();
    const b = vi.fn();
    addTick(a);
    addTick(b);
    expect(frames).toHaveLength(1);
    fire(0);
    fire(16);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
    expect(frames).toHaveLength(1);
    removeTick(a);
    removeTick(b);
  });

  it('stops requesting frames when nobody is subscribed', () => {
    const tick = vi.fn();
    addTick(tick);
    removeTick(tick);
    expect(frames).toHaveLength(0);
    expect(activeTicks()).toBe(0);
  });

  it('clamps long gaps so springs stay stable', () => {
    const steps: number[] = [];
    const tick = (dt: number) => steps.push(dt);
    addTick(tick);
    fire(1000);
    fire(11_000);
    removeTick(tick);
    expect(steps).toEqual([0, 0.05]);
  });

  it('does not carry time across an idle period', () => {
    const steps: number[] = [];
    const tick = (dt: number) => steps.push(dt);
    addTick(tick);
    fire(1000);
    removeTick(tick);
    addTick(tick);
    fire(9000);
    removeTick(tick);
    expect(steps).toEqual([0, 0]);
  });
});

describe('moods', () => {
  it('defines every public mood', () => {
    expect(Object.keys(MOODS).toSorted()).toEqual([...MASCOT_MOODS].toSorted());
  });

  it('gives each mood its own combination of pose and behaviour', () => {
    const signature = (name: MoodName) => JSON.stringify(MOODS[name]);
    expect(new Set(MASCOT_MOODS.map(signature)).size).toBe(MASCOT_MOODS.length);
  });

  it('matches the expressions in the spec', () => {
    expect(MOODS.working.open).toBeLessThan(0.6);
    expect(MOODS.success.arc).toBe(1);
    expect(MOODS.error.tilt).toBeLessThan(0);
    expect(MOODS.error.open).toBeLessThan(0.6);
    expect(MOODS.error.droop).toBeGreaterThan(0);
    expect(MOODS.listening.open).toBeGreaterThan(1);
    expect(MOODS.listening.lean).toBeGreaterThan(0);
    expect(MOODS.sleeping.open).toBe(0);
    expect(MOODS.sleeping.breath).toBeGreaterThan(MOODS.idle.breath);
    expect(MOODS.sleeping.speed).toBeLessThan(MOODS.idle.speed);
    expect(MOODS.waiting.blink).toBe('double');
    expect(MOODS.thinking.look?.every(([, y]) => y < 0)).toBe(true);
  });
});

describe('transitions', () => {
  it('never jumps between any two moods', () => {
    for (const from of MASCOT_MOODS) {
      for (const to of MASCOT_MOODS) {
        const state = createMotionState();
        // Blinks and the kicks of hops and shakes are motion of their own; keep the blend alone.
        const quiet = dials({ blink: 0, bounce: 0 });
        run(state, 1, input({ mood: from, channels: quiet }));
        const before = sample(writePose(state, input({ mood: from, channels: quiet })));
        const next = input({ mood: to, channels: quiet });
        stepMotion(state, FRAME, next);
        const after = sample(writePose(state, next));
        const biggest = Math.max(...after.map((value, i) => Math.abs(value - (before[i] as number))));
        // Most of a transition happens in the first frames of an exponential ease.
        expect(biggest, `${from} to ${to}`).toBeLessThan(3.5);
      }
    }
  });

  it('keeps the float continuous when its speed changes', () => {
    const state = createMotionState();
    run(state, 1, input());
    const y = writePose(state, input()).y;
    const working = input({ mood: 'working' });
    stepMotion(state, FRAME, working);
    expect(Math.abs(writePose(state, working).y - y)).toBeLessThan(0.7);
  });

  it('arrives within half a second', () => {
    const state = createMotionState();
    const success = input({ mood: 'success' });
    run(state, 0.5, success);
    expect(state.blend.arc).toBeCloseTo(1, 1);
    expect(state.blend.open).toBeCloseTo(MOODS.success.open, 1);
  });

  it('eases into a new expression rather than snapping', () => {
    const state = createMotionState();
    stepMotion(state, FRAME, input({ mood: 'success' }));
    expect(state.blend.arc).toBeGreaterThan(0);
    expect(state.blend.arc).toBeLessThan(0.5);
  });

  it('never jumps accessory phase when the mood changes', () => {
    const state = createMotionState();
    run(state, 0.2, input());
    const before = state.phase;
    stepMotion(state, FRAME, input({ mood: 'working' }));
    expect(state.phase - before).toBeLessThan(0.1);
  });

  it('runs accessories faster when busy and slower when asleep', () => {
    const elapsed = (mood: MoodName) => {
      const state = createMotionState();
      const before = state.phase;
      run(state, 3, input({ mood }));
      return state.phase - before;
    };
    expect(elapsed('working')).toBeGreaterThan(elapsed('idle') * 2);
    expect(elapsed('sleeping')).toBeLessThan(elapsed('idle') / 2);
  });

  it('reports droop to accessories, eased', () => {
    const state = createMotionState();
    const error = input({ mood: 'error' });
    stepMotion(state, FRAME, error);
    writePose(state, error);
    expect(state.clock.droop).toBeGreaterThan(0);
    expect(state.clock.droop).toBeLessThan(0.5);
    run(state, 1, error);
    writePose(state, error);
    expect(state.clock.droop).toBeCloseTo(1, 1);
  });
});

describe('channels', () => {
  /** How far a pose number swings over a few seconds. */
  const range = (frame: MotionInput, read: (pose: Pose) => number): number => {
    const state = createMotionState();
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < 400; i++) {
      stepMotion(state, FRAME, frame);
      const value = read(writePose(state, frame));
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    return high - low;
  };

  it('scales float with its dial and with the master dial', () => {
    const y = (pose: Pose) => pose.y;
    const base = range(input({ channels: dials({ gaze: 0 }) }), y);
    expect(range(input({ channels: dials({ gaze: 0, float: 2 }) }), y)).toBeCloseTo(base * 2, 0);
    expect(range(input({ channels: dials({ gaze: 0, motion: 2 }) }), y)).toBeCloseTo(base * 2, 0);
    expect(range(input({ channels: dials({ gaze: 0, float: 0 }) }), y)).toBe(0);
  });

  it('scales the hop with the bounce dial', () => {
    const y = (pose: Pose) => pose.y;
    const hopping = (bounce: number) =>
      input({ mood: 'success', channels: dials({ float: 0, gaze: 0, bounce }) });
    expect(range(hopping(2), y)).toBeGreaterThan(range(hopping(1), y) * 1.5);
    expect(range(hopping(0), y)).toBeLessThan(5);
  });

  it('scales blink rate with its dial, and stops at zero', () => {
    const blinks = (channels: MotionChannels) => {
      const state = createMotionState();
      let count = 0;
      for (let i = 0; i < 3600; i++) {
        const before = state.blinkAt;
        stepMotion(state, FRAME, input({ channels }));
        if (state.blinkAt !== before) count++;
      }
      return count;
    };
    expect(blinks(dials({ blink: 0 }))).toBe(0);
    expect(blinks(dials({ motion: 0 }))).toBe(0);
    expect(blinks(dials({ blink: 2 }))).toBeGreaterThan(blinks(dials({})) * 1.4);
  });

  it('honours the gaze dial, under the master dial', () => {
    const state = createMotionState();
    state.lookX.x = 1;
    expect(writePose(state, input({ channels: dials({ gaze: 0 }) })).eyeX).toBe(0);
    expect(writePose(state, input({ channels: dials({ motion: 0 }) })).eyeX).toBe(0);
    expect(writePose(state, input({ channels: dials({ gaze: 2 }) })).eyeX).toBeCloseTo(16);
  });

  it('caps a channel under the master dial at the range of one dial', () => {
    const state = createMotionState();
    state.lookX.x = 1;
    const full = writePose(state, input({ channels: dials({ gaze: 2, motion: 2 }) }));
    expect(full.eyeX).toBeCloseTo(16);
  });

  it('holds the expression with the master dial at zero', () => {
    const state = createMotionState();
    const sleeping = input({ mood: 'sleeping', channels: dials({ motion: 0 }) });
    run(state, 1, sleeping);
    const pose = writePose(state, sleeping);
    expect(pose.left.open).toBeCloseTo(0, 1);
    const y = pose.y;
    run(state, 1, sleeping);
    expect(writePose(state, sleeping).y).toBeCloseTo(y, 3);
  });
});

describe('gaze', () => {
  it('follows an active look target on a spring', () => {
    const state = createMotionState();
    const looking = input({ look: { x: 1, y: 0, source: 'pointer' } });
    stepMotion(state, FRAME, looking);
    expect(state.lookX.x).toBeLessThan(0.1);
    run(state, 2, looking);
    expect(state.lookX.x).toBeCloseTo(1, 1);
  });

  it('wanders in idle, within the glance dial', () => {
    const wander = (glance: number) => {
      const state = createMotionState();
      const frame = input({ channels: dials({ glance }) });
      let reach = 0;
      for (let i = 0; i < 1800; i++) {
        stepMotion(state, FRAME, frame);
        reach = Math.max(reach, Math.abs(state.lookX.x));
      }
      return reach;
    };
    expect(wander(0)).toBe(0);
    expect(wander(1)).toBeGreaterThan(0.3);
  });

  it('looks up and aside when thinking, and visits more than one spot', () => {
    const state = createMotionState();
    const thinking = input({ mood: 'thinking' });
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      stepMotion(state, FRAME, thinking);
      expect(state.lookY.x).toBeLessThan(0.1 + (i < 30 ? 1 : 0));
      if (i % 30 === 0) seen.add(Math.round(state.lookX.x * 4));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('scans from side to side when working', () => {
    const state = createMotionState();
    const working = input({ mood: 'working' });
    let left = 0;
    let right = 0;
    for (let i = 0; i < 240; i++) {
      stepMotion(state, FRAME, working);
      left = Math.min(left, state.lookX.x);
      right = Math.max(right, state.lookX.x);
    }
    expect(left).toBeLessThan(-0.3);
    expect(right).toBeGreaterThan(0.3);
  });

  it('keeps its eyes on the user while waiting', () => {
    const state = createMotionState();
    run(state, 2, input({ mood: 'waiting' }));
    expect(state.lookX.x).toBeCloseTo(0, 1);
    expect(state.lookY.x).toBeCloseTo(0, 1);
  });

  it('sleeps through the pointer, but not through lookAt()', () => {
    const state = createMotionState();
    run(state, 2, input({ mood: 'sleeping', look: { x: 1, y: 0, source: 'pointer' } }));
    expect(state.lookX.x).toBeCloseTo(0, 1);
    run(state, 2, input({ mood: 'sleeping', look: { x: 1, y: 0, source: 'api' } }));
    expect(state.lookX.x).toBeCloseTo(1, 1);
  });
});

describe('mood behaviour', () => {
  it('hops when successful, and squashes on landing', () => {
    const state = createMotionState();
    const success = input({ mood: 'success' });
    run(state, 0.5, success);
    let top = 0;
    let flattest = 1;
    for (let i = 0; i < 180; i++) {
      stepMotion(state, FRAME, success);
      const pose = writePose(state, success);
      top = Math.min(top, pose.y);
      flattest = Math.min(flattest, pose.scaleY);
    }
    expect(top).toBeLessThan(-15);
    expect(flattest).toBeLessThan(0.97);
  });

  it('shakes in bursts when in error', () => {
    const state = createMotionState();
    const error = input({ mood: 'error', channels: dials({ gaze: 0 }) });
    let reach = 0;
    let calm = 0;
    for (let i = 0; i < 300; i++) {
      stepMotion(state, FRAME, error);
      const { x } = writePose(state, error);
      reach = Math.max(reach, Math.abs(x));
      if (Math.abs(x) < 0.05) calm++;
    }
    expect(reach).toBeGreaterThan(3);
    expect(calm).toBeGreaterThan(30);
  });

  it('slumps in error and sleep, and leans in to listen', () => {
    const rest = (mood: MoodName) => {
      const state = createMotionState();
      const frame = input({ mood, channels: dials({ float: 0, bounce: 0 }) });
      run(state, 1.5, frame);
      return { ...writePose(state, frame) };
    };
    const idle = rest('idle');
    expect(rest('error').scaleY).toBeLessThan(idle.scaleY);
    expect(rest('sleeping').scaleY).toBeLessThan(idle.scaleY);
    expect(rest('listening').scaleY).toBeGreaterThan(idle.scaleY);
    expect(Math.abs(rest('listening').rotate)).toBeGreaterThan(3);
  });

  it('blinks twice, slowly, while waiting', () => {
    const state = createMotionState();
    const waiting = input({ mood: 'waiting' });
    const gaps: number[] = [];
    let last = state.blinkAt;
    for (let i = 0; i < 1800; i++) {
      stepMotion(state, FRAME, waiting);
      if (state.blinkAt !== last) {
        gaps.push(state.blinkAt - last);
        last = state.blinkAt;
      }
    }
    expect(gaps.some((gap) => gap < 0.6)).toBe(true);
    expect(gaps.some((gap) => gap > 2)).toBe(true);
  });

  it('never blinks while asleep or happy', () => {
    for (const mood of ['sleeping', 'success'] as const) {
      const state = createMotionState();
      const before = state.blinkAt;
      run(state, 20, input({ mood }));
      expect(state.blinkAt).toBe(before);
    }
  });
});

describe('speaking', () => {
  const speaking = (level: number | null) => input({ mood: 'speaking', level });

  it('follows level', () => {
    const loud = createMotionState();
    const quiet = createMotionState();
    run(loud, 0.4, speaking(1));
    run(quiet, 0.4, speaking(0.1));
    expect(loud.voice).toBeCloseTo(1, 1);
    expect(quiet.voice).toBeCloseTo(0.1, 1);
    expect(writePose(loud, speaking(1)).scaleY).toBeGreaterThan(writePose(quiet, speaking(0.1)).scaleY);
    expect(writePose(loud, speaking(1)).left.open).toBeGreaterThan(writePose(quiet, speaking(0.1)).left.open);
  });

  it('opens faster than it closes, so syllables stay crisp', () => {
    const rise = createMotionState();
    stepMotion(rise, FRAME, speaking(1));
    const fall = createMotionState();
    fall.voice = 1;
    stepMotion(fall, FRAME, speaking(0));
    expect(rise.voice).toBeGreaterThan(1 - fall.voice);
  });

  it('falls back to a rhythm with pauses when level is unset', () => {
    const state = createMotionState();
    const voice: number[] = [];
    for (let i = 0; i < 1200; i++) {
      stepMotion(state, FRAME, speaking(null));
      voice.push(state.voice);
    }
    expect(Math.max(...voice)).toBeGreaterThan(0.6);
    expect(Math.min(...voice)).toBeLessThan(0.05);
  });

  it('goes quiet in any other mood', () => {
    const state = createMotionState();
    run(state, 0.5, speaking(1));
    run(state, 1, input({ level: 1 }));
    expect(state.voice).toBeLessThan(0.01);
  });
});

describe('still poses', () => {
  it('holds no drift', () => {
    const still = input({ still: true });
    const state = createMotionState();
    settleMotion(state, still);
    const pose = writePose(state, still);
    expect(pose.x).toBe(0);
    expect(pose.y).toBe(0);
    expect(pose.scaleX).toBe(1);
    expect(pose.scaleY).toBe(1);
  });

  it('jumps straight to the mood when settled', () => {
    const state = createMotionState();
    const still = input({ mood: 'success', still: true });
    settleMotion(state, still);
    expect(writePose(state, still).left.arc).toBe(1);
  });

  it('gives every mood a pose of its own', () => {
    const poses = MASCOT_MOODS.map((mood) => {
      const still = input({ mood, still: true });
      const state = createMotionState();
      settleMotion(state, still);
      return JSON.stringify(writePose(state, still));
    });
    expect(new Set(poses).size).toBe(MASCOT_MOODS.length);
  });

  it('moves the eyes at once, and the body not at all', () => {
    const state = createMotionState();
    const still = input({ still: true, look: { x: 1, y: 0, source: 'pointer' } });
    settleMotion(state, still);
    const pose = writePose(state, still);
    expect(pose.eyeX).toBe(8);
    expect(pose.x).toBe(0);
    expect(pose.rotate).toBe(0);
  });

  it('ignores level, which would be an animation', () => {
    const quiet = createMotionState();
    const loud = createMotionState();
    settleMotion(quiet, input({ mood: 'speaking', still: true, level: 0 }));
    settleMotion(loud, input({ mood: 'speaking', still: true, level: 1 }));
    expect(loud.voice).toBe(quiet.voice);
  });

  it('forgets a glance from before it went still', () => {
    const state = createMotionState();
    state.glanceX = 1;
    settleMotion(state, input({ still: true }));
    expect(state.lookX.x).toBe(0);
  });

  it('rests accessories at the start of their cycle', () => {
    const state = createMotionState();
    run(state, 1, input());
    writePose(state, input({ still: true }));
    expect(state.clock.phase).toBe(0);
    expect(state.clock.still).toBe(true);
  });

  it('holds a wink with no running clock', () => {
    const state = createMotionState();
    const still = input({ still: true });
    state.winking = true;
    const pose = writePose(state, still);
    expect(pose.right.open).toBe(0);
    expect(pose.left.open).toBe(1);
  });
});

describe('poke', () => {
  it('squashes within a few frames, without snapping, and recovers', () => {
    const state = createMotionState();
    const quiet = input({ channels: dials({ float: 0, gaze: 0 }) });
    pokeMotion(state);
    expect(writePose(state, quiet).scaleY).toBe(1);
    run(state, 0.1, quiet);
    expect(writePose(state, quiet).scaleY).toBeLessThan(0.95);
    run(state, 3, quiet);
    expect(Math.abs(state.squish.x)).toBeLessThan(0.02);
  });

  it('winks the right eye', () => {
    const state = createMotionState();
    const quiet = input({ channels: dials({ blink: 0 }) });
    pokeMotion(state);
    run(state, 0.29, quiet);
    const pose = writePose(state, quiet);
    expect(pose.right.open).toBeLessThan(0.2);
    expect(pose.left.open).toBe(1);
  });
});

describe('stability', () => {
  it('stays finite at the longest step the loop allows', () => {
    for (const mood of MASCOT_MOODS) {
      const state = createMotionState();
      const frame = input({ mood, channels: dials({ motion: 2, bounce: 2 }) });
      for (let i = 0; i < 400; i++) stepMotion(state, 0.05, frame);
      for (const value of sample(writePose(state, frame))) {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThan(400);
      }
    }
  });
});
