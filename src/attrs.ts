import {
  DEFAULT_ACCENT,
  DEFAULT_COLOR,
  MASCOT_EYE_SHAPES,
  MASCOT_MATERIALS,
  MASCOT_MOODS,
  MASCOT_SHAPES,
} from './constants.js';
import { clamp } from './dom.js';
import { getAccessory, getShape, parseList } from './registry.js';
import type {
  DetailSetting,
  EyeShapeName,
  MaterialName,
  MoodName,
  ShapeDefinition,
} from './types.js';
import { warnOnce } from './warn.js';

/** What an attribute change has to touch. Cheaper buckets never do the work of dearer ones. */
export type Bucket =
  | 'structure' // rebuild the SVG parts
  | 'layout' // patch attributes
  | 'paint' // CSS custom properties only
  | 'motion' // read at the next frame
  | 'track' // rebind listeners and gyro
  | 'detail'
  | 'size'
  | 'label';

export interface PropSpec {
  attr: string;
  bucket: Bucket;
  read(raw: string | null): unknown;
}

function number<T extends number | null>(
  attr: string,
  bucket: Bucket,
  fallback: T,
  low: number,
  high: number,
  /** Below `low` is a mistake here, not something to clamp. */
  strict = false,
): PropSpec {
  return {
    attr,
    bucket,
    read(raw) {
      if (raw == null) return fallback;
      // `Number` rejects what `parseFloat` lets through, like `50%`, but reads a blank as 0.
      const value = raw.trim() ? Number(raw) : Number.NaN;
      if (Number.isFinite(value) && !(strict && value < low)) return clamp(value, low, high);
      warnOnce(`invalid ${attr} "${raw}"`);
      return fallback;
    },
  };
}

function choice(attr: string, bucket: Bucket, list: readonly string[], fallback: string): PropSpec {
  return {
    attr,
    bucket,
    read(raw) {
      if (raw == null || list.includes(raw)) return raw ?? fallback;
      warnOnce(`unknown ${attr} "${raw}"`);
      return fallback;
    },
  };
}

const text = (attr: string, bucket: Bucket, fallback: string | null): PropSpec => ({
  attr,
  bucket,
  read: (raw) => raw ?? fallback,
});

/**
 * Functions a colour may use. `CSS.supports` passes anything holding a `var()`, whose
 * fallback could be a `url()` that fetches, so the value is checked here as well.
 */
const COLOR_FUNCTION = /^(?:|var|rgba?|hsla?|hwb|(?:ok)?l(?:ab|ch)|color|color-mix|light-dark|calc|clamp|min|max)$/i;

/** Whether `value` is a CSS colour. `var()` passes, and resolves later in CSS. */
export function isColor(value: string): boolean {
  return (
    // Backslashes and quotes could spell a function name past the check below.
    !/[\\"']/.test(value) &&
    [...value.matchAll(/([\w-]*)\(/g)].every((call) => COLOR_FUNCTION.test(call[1] as string)) &&
    (typeof CSS === 'undefined' || CSS.supports('color', value))
  );
}

function color(attr: string, fallback: string | null): PropSpec {
  return {
    attr,
    bucket: 'paint',
    read(raw) {
      if (raw == null) return fallback;
      if (isColor(raw)) return raw;
      warnOnce(`invalid ${attr} "${raw}"`);
      return fallback;
    },
  };
}

function shape(raw: string | null): string {
  if (raw == null || getShape(raw)) return raw ?? 'blob';
  // Inline, so the CDN build's removal of `warnOnce` calls takes the strings with it.
  warnOnce(
    (MASCOT_SHAPES as readonly string[]).includes(raw)
      ? `shape "${raw}" is not loaded; import @comfycomputer/agent-mascots/shapes/${raw}`
      : `unknown shape "${raw}"`,
  );
  return 'blob';
}

const channel = (attr: string): PropSpec => number(attr, 'motion', 1, 0, 2);

/** One entry per public property. Drives parsing, accessors and change handling. */
export const PROPS = {
  shape: { attr: 'shape', bucket: 'structure', read: shape },
  material: choice('material', 'structure', MASCOT_MATERIALS, 'glow'),
  color: color('color', DEFAULT_COLOR),
  accent: color('accent', DEFAULT_ACCENT),
  bodyWidth: number('body-width', 'layout', 1, 0.6, 1.4),
  bodyHeight: number('body-height', 'layout', 1, 0.6, 1.4),
  softness: number('softness', 'layout', 0.4, 0, 1),
  accessories: text('accessories', 'structure', null),
  sky: {
    attr: 'sky',
    bucket: 'paint',
    read: (raw: string | null) => (raw && parseSky(raw)[0] !== 'none' ? raw : 'none'),
  },
  shadow: choice('shadow', 'layout', ['on', 'none'], 'on'),
  size: number<number | null>('size', 'size', null, 0, Number.MAX_SAFE_INTEGER, true),
  detail: choice('detail', 'detail', ['auto', 'full', 'simple'], 'auto'),
  eyeShape: choice('eye-shape', 'layout', MASCOT_EYE_SHAPES, 'auto'),
  eyeWidth: number('eye-width', 'layout', 1, 0.3, 2.5),
  eyeHeight: number('eye-height', 'layout', 1, 0.3, 2.5),
  eyeSpacing: number('eye-spacing', 'layout', 1, 0.5, 2),
  eyeY: number('eye-y', 'layout', 0, -1, 1),
  eyeColor: color('eye-color', null),
  mood: choice('mood', 'motion', MASCOT_MOODS, 'idle'),
  level: number<number | null>('level', 'motion', null, 0, 1),
  motion: channel('motion'),
  float: channel('float'),
  blink: channel('blink'),
  glance: channel('glance'),
  bounce: channel('bounce'),
  gaze: channel('gaze'),
  track: text('track', 'track', 'self'),
  trackReach: number('track-reach', 'track', 2, 0.2, 50),
  gyro: { attr: 'gyro', bucket: 'track', read: (raw: string | null) => raw != null },
  label: text('label', 'label', null),
} satisfies Record<string, PropSpec>;

export type PropName = keyof typeof PROPS;

/** Public properties, as read back from the element. */
export interface MascotProps {
  shape: string;
  material: MaterialName;
  color: string;
  accent: string;
  bodyWidth: number;
  bodyHeight: number;
  softness: number;
  sky: string;
  shadow: 'on' | 'none';
  size: number | null;
  detail: DetailSetting;
  eyeShape: EyeShapeName;
  eyeWidth: number;
  eyeHeight: number;
  eyeSpacing: number;
  eyeY: number;
  eyeColor: string | null;
  mood: MoodName;
  level: number | null;
  motion: number;
  float: number;
  blink: number;
  glance: number;
  bounce: number;
  gaze: number;
  track: string;
  trackReach: number;
  gyro: boolean;
  label: string | null;
}

/** The attribute a value should be written as. Null removes it. */
export function toAttribute(value: unknown): string | null {
  if (value == null || value === false) return null;
  if (value === true) return '';
  return Array.isArray(value) ? value.join(' ') : String(value);
}

/** Resolve the accessory list: explicit attribute, or the defaults for the shape and material. */
export function resolveAccessories(
  raw: string | null,
  shapeDef: ShapeDefinition,
  material: MaterialName,
): string[] {
  const names =
    raw == null
      ? [...shapeDef.accessories, ...(material === 'glass' ? ['iridescent', 'outline'] : [])]
      : parseList(raw);
  const known = new Set<string>();
  for (const name of names) {
    if (name === 'none') return [];
    if (getAccessory(name)) known.add(name);
    else if (raw != null) warnOnce(`accessory "${name}" is unknown or not loaded`);
  }
  // Nothing usable falls back to the default, as for any unknown value.
  return raw != null && names.length && !known.size
    ? resolveAccessories(null, shapeDef, material)
    : [...known];
}

/** The mode, and the colours that go with it. */
export type SkyValue = readonly [mode: 'none' | 'auto' | 'one' | 'two', top?: string, bottom?: string];

/** Split on commas that are not inside parentheses, so `rgb(1, 2, 3)` stays whole. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function parseSky(value: string): SkyValue {
  const sky = value.trim();
  if (sky === 'none' || sky === '') return ['none'];
  if (sky === 'auto') return ['auto'];
  const [top, bottom, extra] = splitTopLevel(sky);
  if (top && !extra && isColor(top) && (bottom === undefined || isColor(bottom))) {
    return bottom ? ['two', top, bottom] : ['one', top];
  }
  warnOnce(`invalid sky "${value}"`);
  return ['none'];
}
