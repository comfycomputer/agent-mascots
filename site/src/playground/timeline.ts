// The mood timeline's beats: `[mood, ms]`, the format the library's schedules use. They live in
// the playground's state as text, so undo, reset and share links reach them.

import { valuesOf } from '../lib/attributes';
import { MIN_BEAT, type Beat } from '../lib/schedule';

export const MAX_BEATS = 16;
export const MAX_BEAT = 6000;
export const BEAT_STEP = 100;
export const DEFAULT_STEPS: readonly Beat[] = [['thinking', 1400], ['working', 1800], ['error', 1000], ['working', 1200], ['success', 1400]];

const MOODS = valuesOf('mood');

export const snap = (ms: number) => Math.max(MIN_BEAT, Math.min(MAX_BEAT, Math.round(ms / BEAT_STEP) * BEAT_STEP));

const copy = (steps: readonly Beat[]) => steps.map(([mood, ms]): Beat => [mood, ms]);
const asText = (steps: readonly Beat[]) => steps.map(([mood, ms]) => `${mood}.${ms}`).join(',');
const DEFAULT_TEXT = asText(DEFAULT_STEPS);

/** `thinking.1400,working.1800`, or empty for the default. */
export const encodeSteps = (steps: readonly Beat[]) => (asText(steps) === DEFAULT_TEXT ? '' : asText(steps));

/** The hash is untrusted: known moods only, clamped, and a bad list is the default list. */
export function decodeSteps(text: string | null | undefined): Beat[] {
  if (!text) return copy(DEFAULT_STEPS);
  const parsed = text.split(',').slice(0, MAX_BEATS).map((beat) => beat.split('.'));
  const valid = parsed.every(([mood = '', ms]) => MOODS.includes(mood) && Number.isFinite(Number(ms)));
  return valid ? parsed.map(([mood = '', ms]): Beat => [mood, snap(Number(ms))]) : copy(DEFAULT_STEPS);
}
