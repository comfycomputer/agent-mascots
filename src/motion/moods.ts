import type { MoodName } from '../types.js';

/** A gaze direction, -1..1 on each axis. */
export type Gaze = readonly [x: number, y: number];

/** The numbers of a mood. Each one cross-fades, so any mood reaches any other without a snap. */
export interface MoodBlend {
  /** Float amplitude in design units, and speed in radians per second. */
  float: number;
  speed: number;
  /** Breathing depth, as a fraction of body height. */
  breath: number;
  /** Eye expression. */
  open: number;
  arc: number;
  tilt: number;
  /** How much narrower the right eye is, for a quizzical look. */
  wonk: number;
  /** Accessory and outline animation rate. */
  rate: number;
  /** Resting offset from the ground line, in design units; negative is up. */
  sink: number;
  /** Leaning in: 1 is closer, with the head cocked to one side. */
  lean: number;
  /** Slumping: 0 is upright, 1 is deflated. Accessories wilt with it. */
  droop: number;
  /** Rocking from side to side, in degrees. */
  sway: number;
  /** Strength of the repeating hop and the repeating shake, 0 to 1. */
  hop: number;
  shake: number;
}

/** How a mood behaves over time. These switch at once; only their effects ease. */
export interface MoodDefinition extends MoodBlend {
  /** Gaze points, visited in turn every `dwell` seconds. Without them the mascot looks ahead. */
  look?: readonly Gaze[];
  dwell?: number;
  /** Strength of random idle glances. */
  glance?: number;
  /** `false` stops blinking; `double` blinks slowly, twice. */
  blink?: false | 'double';
  /** Ignores the pointer and gyro; only `lookAt()` reaches it. */
  aloof?: boolean;
}

export const REST: MoodBlend = {
  float: 3,
  speed: 1,
  breath: 0.012,
  open: 1,
  arc: 0,
  tilt: 0,
  wonk: 0,
  rate: 1,
  sink: 0,
  lean: 0,
  droop: 0,
  sway: 0,
  hop: 0,
  shake: 0,
};

/** The blended numbers, as a list, so the frame loop can walk them. */
export const BLEND_KEYS = Object.keys(REST) as (keyof MoodBlend)[];

const mood = (overrides: Partial<MoodDefinition>): MoodDefinition => ({ ...REST, ...overrides });

/** Everything here is tuning data, read by `motion/state.ts`. */
export const MOODS: Record<MoodName, MoodDefinition> = {
  idle: mood({ float: 5, speed: 1.1, glance: 1 }),
  thinking: mood({
    speed: 0.8,
    open: 0.92,
    wonk: 0.24,
    rate: 1.6,
    sink: -2,
    sway: 1.5,
    look: [
      [0.75, -0.85],
      [0.3, -0.95],
      [-0.6, -0.8],
    ],
    dwell: 2.3,
  }),
  working: mood({
    float: 1.6,
    speed: 7,
    open: 0.46,
    tilt: 11,
    rate: 3.5,
    lean: 0.25,
    look: [
      [-0.55, 0.45],
      [0.55, 0.45],
    ],
    dwell: 0.7,
  }),
  success: mood({
    float: 1,
    speed: 2,
    open: 0.3,
    arc: 1,
    rate: 2,
    hop: 1,
    sink: -4,
    look: [[0, -0.1]],
    blink: false,
  }),
  error: mood({
    float: 1.2,
    speed: 0.7,
    open: 0.42,
    tilt: -14,
    rate: 0.3,
    sink: 5,
    droop: 1,
    shake: 1,
    look: [[-0.25, 0.6]],
  }),
  listening: mood({
    float: 2,
    open: 1.22,
    lean: 1,
    look: [[0, 0.05]],
  }),
  speaking: mood({ float: 2.5, speed: 1.4, rate: 1.4, glance: 0.35 }),
  waiting: mood({
    speed: 0.9,
    rate: 0.8,
    sway: 2.2,
    lean: 0.2,
    look: [[0, 0]],
    blink: 'double',
  }),
  sleeping: mood({
    float: 1.2,
    speed: 0.85,
    breath: 0.04,
    open: 0,
    arc: -0.34,
    rate: 0.25,
    sink: 4,
    droop: 0.6,
    sway: 0.8,
    look: [[0, 0.25]],
    blink: false,
    aloof: true,
  }),
};
