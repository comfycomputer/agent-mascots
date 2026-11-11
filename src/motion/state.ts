import { clamp } from '../dom.js';
import type { FrameClock, LookTarget, MoodName, Pose } from '../types.js';
import { BLEND_KEYS, MOODS, type MoodBlend, type MoodDefinition, REST } from './moods.js';

/** Per-channel dials, 0 to 2. Spring constants are never exposed. */
export interface MotionChannels {
  /** Master dial; multiplies every other channel. */
  motion: number;
  float: number;
  blink: number;
  glance: number;
  bounce: number;
  gaze: number;
}

export interface MotionInput {
  mood: MoodName;
  channels: MotionChannels;
  look: LookTarget | null;
  /** Speech loudness, 0 to 1. Null plays the built-in rhythm. */
  level: number | null;
  floatScale: number;
  /** Reduced motion: no loop, every mood is a still pose. */
  still: boolean;
}

export interface Spring {
  x: number;
  v: number;
}

/** Everything that animates. Lives outside the renderer, so rebuilds never reset it. */
export interface MotionState {
  t: number;
  /** Accessory time; see `FrameClock.phase`. */
  phase: number;
  /** Integrated like `phase`, so the speed can ease without the sine jumping. */
  floatPhase: number;
  hopPhase: number;
  /** Particle time. Follows the master dial. */
  fx: number;
  /** The current mood's numbers, part way to the target during a transition. */
  blend: MoodBlend;
  lookX: Spring;
  lookY: Spring;
  squish: Spring;
  shake: Spring;
  glanceX: number;
  glanceY: number;
  nextGlance: number;
  nextBlink: number;
  blinkAt: number;
  /** The next blink is the second of a double blink. */
  echo: boolean;
  nextShake: number;
  winkAt: number;
  /** Holds the wink under reduced motion, where the clock is stopped. */
  winking: boolean;
  /** Speech envelope, 0 to 1. */
  voice: number;
  pose: Pose;
  clock: FrameClock;
}

/** Gaze and squish springs. Stiff enough to feel alive, damped to settle. */
const LOOK_STIFFNESS = 70;
const LOOK_DAMPING = 13;
const SQUISH_STIFFNESS = 220;
const SQUISH_DAMPING = 9;
const SHAKE_STIFFNESS = 380;
const SHAKE_DAMPING = 7;
/** Moods cross-fade with this rate, per second: most of the way in a quarter of a second. */
const EASE = 9;

const BLINK_LENGTH = 0.16;
const SLOW_BLINK_LENGTH = 0.28;
/** Between the two blinks of a double blink. */
const DOUBLE_GAP = 0.44;
const WINK_LENGTH = 0.34;

const HOP_PERIOD = 1.2;
const HOP_AIR = 0.56;
const HOP_HEIGHT = 20;
/** Springs are kicked, not moved, so a squash builds over a few frames instead of snapping. */
const HOP_KICK = 9;
const POKE_KICK = 15;

const SHAKE_PERIOD = 2.2;
const SHAKE_KICK = 26;

/** The envelope opens quickly on a syllable, and closes more gently. */
const VOICE_ATTACK = 36;
const VOICE_RELEASE = 14;

const GLANCES = [
  [0, 0],
  [-1, 0.05],
  [1, -0.05],
  [0, 0],
  [0.65, -0.55],
  [-0.7, 0.35],
] as const;

const spring = (s: Spring, target: number, stiffness: number, damping: number, dt: number): void => {
  s.v += ((target - s.x) * stiffness - s.v * damping) * dt;
  s.x += s.v * dt;
};

/** 1 at rest, dipping to 0 and back over `length` seconds. */
const blinkAt = (since: number, length: number): number =>
  since < 0 || since > length ? 1 : 1 - Math.sin((since / length) * Math.PI);

/** A speech-like envelope for when `level` is unset: syllables inside phrases, with pauses. */
const rhythm = (t: number): number =>
  Math.abs(Math.sin(t * 7.3)) * clamp(Math.sin(t * 1.1) + Math.sin(t * 0.47) + 0.75, 0, 1);

/** A channel under the master dial. Capped at one dial's range: 4x would leave the frame. */
const dial = (channel: number, master: number): number => Math.min(2, channel * master);

const atRest = (): Spring => ({ x: 0, v: 0 });

export function createMotionState(): MotionState {
  const t = Math.random() * 6;
  return {
    t,
    phase: t,
    floatPhase: t,
    hopPhase: 0,
    fx: t,
    blend: { ...REST },
    lookX: atRest(),
    lookY: atRest(),
    squish: atRest(),
    shake: atRest(),
    glanceX: 0,
    glanceY: 0,
    nextGlance: t + 1.2,
    nextBlink: t + 1.5 + Math.random() * 2,
    blinkAt: -9,
    echo: false,
    nextShake: 0,
    winkAt: -9,
    winking: false,
    voice: 0,
    pose: {
      x: 0,
      y: 0,
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
      eyeX: 0,
      eyeY: 0,
      shineX: 0,
      shineY: 0,
      left: { open: 1, arc: 0, tilt: 0 },
      right: { open: 1, arc: 0, tilt: 0 },
      shadowScale: 1,
      shadowOpacity: 1,
    },
    clock: { t: 0, mood: 'idle', phase: 0, still: false, motion: 1, droop: 0, voice: 0 },
  };
}

/** Where the eyes want to go, on one axis. The tracker has already arbitrated between its inputs. */
function aim(s: MotionState, input: MotionInput, mood: MoodDefinition, axis: 0 | 1): number {
  const { look } = input;
  if (look && (!mood.aloof || look.source === 'api')) return axis ? look.y : look.x;
  if (mood.look) {
    const turn = input.still ? 0 : Math.floor(s.t / (mood.dwell ?? 1)) % mood.look.length;
    return (mood.look[turn] ?? [0, 0])[axis];
  }
  if (input.still || !mood.glance) return 0;
  const { glance, motion } = input.channels;
  return (axis ? s.glanceY : s.glanceX) * Math.min(1, mood.glance * glance * motion);
}

/** Advance one frame. */
export function stepMotion(s: MotionState, dt: number, input: MotionInput): void {
  const mood = MOODS[input.mood];
  const { motion, blink, glance } = input.channels;
  const { blend } = s;
  const ease = 1 - Math.exp(-EASE * dt);
  for (const key of BLEND_KEYS) blend[key] += (mood[key] - blend[key]) * ease;

  s.t += dt;
  s.phase += dt * blend.rate * motion;
  s.floatPhase += dt * blend.speed;
  s.fx += dt * motion;

  const wander = glance * motion;
  if (mood.glance && wander > 0 && s.t > s.nextGlance) {
    const next = GLANCES[Math.floor(Math.random() * GLANCES.length)] ?? GLANCES[0];
    s.glanceX = next[0];
    s.glanceY = next[1];
    s.nextGlance = s.t + (1.4 + Math.random() * 2.2) / wander;
  }

  const blinks = blink * motion;
  if (mood.blink !== false && blinks > 0 && s.t > s.nextBlink) {
    s.blinkAt = s.t;
    const double = mood.blink === 'double';
    s.echo = double && !s.echo;
    s.nextBlink = s.t + (s.echo ? DOUBLE_GAP : ((2.4 + Math.random() * 3) * (double ? 1.5 : 1)) / blinks);
  }

  const hopped = s.hopPhase;
  s.hopPhase = (hopped + dt / HOP_PERIOD) % 1;
  // Landing is the moment the hop turns into a squash.
  if (hopped < HOP_AIR && s.hopPhase >= HOP_AIR) s.squish.v += HOP_KICK * blend.hop;
  if (blend.shake > 0.3 && s.t > s.nextShake) {
    s.shake.v = SHAKE_KICK * blend.shake;
    s.nextShake = s.t + SHAKE_PERIOD;
  }

  const speech = input.mood === 'speaking' ? (input.level ?? rhythm(s.t)) : 0;
  s.voice += (speech - s.voice) * (1 - Math.exp(-(speech > s.voice ? VOICE_ATTACK : VOICE_RELEASE) * dt));

  spring(s.lookX, aim(s, input, mood, 0), LOOK_STIFFNESS, LOOK_DAMPING, dt);
  spring(s.lookY, aim(s, input, mood, 1), LOOK_STIFFNESS, LOOK_DAMPING, dt);
  spring(s.squish, 0, SQUISH_STIFFNESS, SQUISH_DAMPING, dt);
  spring(s.shake, 0, SHAKE_STIFFNESS, SHAKE_DAMPING, dt);
}

/** Jump straight to the resting pose for the current mood. */
export function settleMotion(s: MotionState, input: MotionInput): void {
  const mood = MOODS[input.mood];
  for (const key of BLEND_KEYS) s.blend[key] = mood[key];
  s.lookX.x = aim(s, input, mood, 0);
  s.lookY.x = aim(s, input, mood, 1);
  s.lookX.v = s.lookY.v = 0;
  s.squish.x = s.squish.v = 0;
  s.shake.x = s.shake.v = 0;
  // The clock stops with the loop, so a wink left armed would play on waking.
  s.winkAt = -9;
  // A still mouth is half open, and does not follow `level`: that would be an animation.
  s.voice = input.mood === 'speaking' ? 0.5 : 0;
}

/** Turn state into a pose, in the one shared pose object. */
export function writePose(s: MotionState, input: MotionInput): Pose {
  const { channels, still } = input;
  const { pose, t, blend: m } = s;
  const live = still ? 0 : channels.motion;
  const bounce = dial(channels.bounce, live);
  const gaze = dial(channels.gaze, channels.motion);
  const lookX = s.lookX.x * gaze;
  const lookY = s.lookY.x * gaze;
  // Under reduced motion the eyes still follow, but the body stays put.
  const turnX = still ? 0 : lookX;
  const turnY = still ? 0 : lookY;
  const drift = dial(channels.float, live);

  const float = Math.sin(s.floatPhase) * m.float * input.floatScale * drift;
  const breathe = Math.cos(s.floatPhase) * m.breath * Math.min(1, drift);
  const sway = Math.sin(s.floatPhase * 0.5) * m.sway * Math.min(1, drift);
  const hop =
    s.hopPhase < HOP_AIR ? Math.sin((s.hopPhase / HOP_AIR) * Math.PI) * m.hop * bounce : 0;
  const squish = s.squish.x * bounce;
  const shake = s.shake.x * bounce;
  const voice = s.voice * Math.min(1, bounce + (still ? 1 : 0));
  // The hop stretches in flight, so it does not read as a sliding sprite.
  const stretch = hop * 0.09 + voice * 0.07 + m.lean * 0.05;
  const thin = hop * 0.06 - voice * 0.035 - m.lean * 0.04;

  const lift = float - hop * HOP_HEIGHT + m.sink;
  pose.x = turnX * 4 + shake * 7;
  pose.y = lift + turnY * 2 - voice * 3;
  pose.rotate = turnX * 2.5 + shake * 4 + m.lean * 5 + sway;
  pose.scaleX = 1 - breathe + squish * 0.1 - Math.abs(turnX) * 0.025 + m.droop * 0.04 - thin;
  pose.scaleY = 1 + breathe - squish * 0.12 - m.droop * 0.07 + stretch;
  pose.eyeX = lookX * 8;
  pose.eyeY = lookY * 5;
  pose.shineX = -lookX * 7;
  pose.shineY = -lookY * 3;

  const slow = MOODS[input.mood].blink === 'double';
  const blink = still ? 1 : blinkAt(t - s.blinkAt, slow ? SLOW_BLINK_LENGTH : BLINK_LENGTH);
  const wink = s.winking ? 0 : still ? 1 : blinkAt(t - s.winkAt, WINK_LENGTH);
  const open = m.open + voice * 0.16;
  pose.left.open = open * blink;
  pose.left.arc = m.arc;
  pose.left.tilt = -m.tilt;
  pose.right.open = open * (1 - m.wonk) * Math.min(blink, wink);
  pose.right.arc = m.arc;
  pose.right.tilt = -m.tilt;

  const rise = clamp((8 - lift) / 34, 0, 1);
  pose.shadowScale = 1 - rise * 0.34;
  pose.shadowOpacity = 1 - rise * 0.6;

  const { clock } = s;
  clock.t = t;
  clock.mood = input.mood;
  // A still pose rests accessories at their start, so a frozen frame looks deliberate.
  clock.phase = still ? 0 : s.phase;
  clock.still = still;
  clock.motion = channels.motion;
  clock.droop = m.droop;
  clock.voice = voice;
  return pose;
}

/** Start the poke reaction: a squash, then a wink. */
export function pokeMotion(s: MotionState): void {
  s.squish.v = POKE_KICK;
  s.winkAt = s.t + 0.12;
}
