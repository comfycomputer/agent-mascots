import type {
  BuiltinAccessoryName,
  BuiltinShapeName,
  EyeShapeName,
  MaterialName,
  MoodName,
} from './types.js';

export const TAG = 'agent-mascot';

/* Written as strings: a list of quoted names costs far more bytes. */
export const MASCOT_SHAPES = 'blob orb egg squircle flame cloud bell ghost cap gem bean drop star heart mochi cat'.split(' ') as readonly BuiltinShapeName[];

export const MASCOT_MATERIALS = 'glow frost glass'.split(' ') as readonly MaterialName[];

export const MASCOT_ACCESSORIES = 'antenna stalk ears arms ring leaf rays spots stem tentacles facets blush sheen iridescent bubbles outline horns halo crown bow wings tail whiskers glasses'.split(' ') as readonly BuiltinAccessoryName[];

export const MASCOT_EYE_SHAPES = 'auto pill round square dot oval slit bar big'.split(' ') as readonly EyeShapeName[];

export const MASCOT_MOODS = 'idle thinking working success error listening speaking waiting sleeping'.split(' ') as readonly MoodName[];

export const DEFAULT_COLOR = 'var(--mascot-color, #18c2a0)';
export const DEFAULT_ACCENT = 'var(--mascot-accent, #ffd84d)';

/** At or below this rendered width, `detail="auto"` picks the simple renderer. */
export const SIMPLE_MAX_WIDTH = 64;
