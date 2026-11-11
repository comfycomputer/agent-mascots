// Share links. The hash is untrusted: anything can arrive here, so every value passes the
// allowlist generated from the library's own manifest, and nothing free-form gets through. It's
// `v=1&mood=error&color=%23ff0000`, non-defaults only, plus `a=x,y,x,y,...` for a drawn shape.

import { ATTRIBUTE_LIST, type Attribute } from './attributes';
import { ANCHOR_COUNT, DRAWN_SHAPE, clampAnchor, type Point } from './drawn-shape';

const VERSION = '1';
const VERSION_KEY = 'v';
const ANCHORS_KEY = 'a';

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TOKEN = /^var\(--[\w-]{1,40}\)$/;
const isColour = (value: string) => HEX.test(value) || TOKEN.test(value);

export type Attrs = Record<string, string>;
export interface Link {
  attrs: Attrs;
  anchors: Point[] | null;
}

/** The clean value for an attribute, or null if it doesn't pass. */
function clean(attribute: Attribute, value: string): string | null {
  switch (attribute.kind) {
    case 'enum':
      return attribute.values.includes(value) ? value : null;
    case 'list': {
      const kept = value.split(/\s+/).filter((name) => name === 'none' || attribute.values.includes(name));
      return kept.length ? kept.join(' ') : null;
    }
    case 'number': {
      if (value.trim() === '') return null;
      const number = Number(value);
      if (!Number.isFinite(number)) return null;
      return String(Math.min(attribute.max, Math.max(attribute.min, number)));
    }
    case 'color':
      return isColour(value) ? value : null;
    case 'sky': {
      if (value === 'none' || value === 'auto') return value;
      const stops = value.split(/\s*,\s*/);
      return stops.length <= 2 && stops.every(isColour) ? stops.join(', ') : null;
    }
    default:
      return null;
  }
}

// Text and booleans are never shared: `label` is free text, and `gyro` needs consent.
const ALLOWED = new Map(
  ATTRIBUTE_LIST.filter(({ kind }) => kind !== 'text' && kind !== 'boolean').map((attribute) => [attribute.name, attribute]),
);

function parseAnchors(text: string | null): Point[] | null {
  if (!text) return null;
  const numbers = text.split(',').map(Number);
  if (numbers.length !== ANCHOR_COUNT * 2 || !numbers.every(Number.isFinite)) return null;
  const anchors: Point[] = [];
  for (let i = 0; i < numbers.length; i += 2) anchors.push([clampAnchor(numbers[i]!), clampAnchor(numbers[i + 1]!)]);
  return anchors;
}

/**
 * Read a hash into `{ attrs, anchors }`. Returns null for anything that isn't a valid link, which
 * means the default mascot. Bad values in a good link are dropped one at a time.
 */
export function parseHash(hash: string): Link | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get(VERSION_KEY) !== VERSION) return null;

  const anchors = parseAnchors(params.get(ANCHORS_KEY));
  const attrs: Attrs = {};
  for (const [name, value] of params) {
    const attribute = ALLOWED.get(name);
    if (attribute === undefined) continue;
    if (name === 'shape' && value === DRAWN_SHAPE) {
      if (anchors) attrs.shape = DRAWN_SHAPE;
      continue;
    }
    const kept = clean(attribute, value);
    if (kept !== null) attrs[name] = kept;
  }
  return { attrs, anchors };
}

/** Write `{ attrs, anchors }` as a hash, leaving out defaults and anything that wouldn't parse. */
export function formatHash({ attrs = {}, anchors = null }: Partial<Link>): string {
  const params = new URLSearchParams({ [VERSION_KEY]: VERSION });
  for (const [name, value] of Object.entries(attrs)) {
    const attribute = ALLOWED.get(name);
    if (attribute === undefined || String(value) === String(attribute.default)) continue;
    const kept = name === 'shape' && value === DRAWN_SHAPE ? value : clean(attribute, String(value));
    if (kept !== null) params.set(name, kept);
  }
  if (anchors) params.set(ANCHORS_KEY, anchors.flat().join(','));
  return `#${params}`;
}

