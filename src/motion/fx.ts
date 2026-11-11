import { clamp, fix, set, stops, svg } from '../dom.js';
import type { FxLayers, Geometry, MoodName } from '../types.js';
import type { MotionState } from './state.js';

/** A particle's frame, written into one shared object. */
interface Particle {
  x: number;
  y: number;
  /** Scale; `tall` overrides it vertically. */
  size: number;
  tall: number;
  turn: number;
  opacity: number;
}

/** Path data and its class: one layer of a particle drawn from several. */
type Part = readonly [d: string, paint: string];

interface Emitter {
  mood: MoodName;
  count: number;
  d?: string;
  /** Class on each particle. Colours stay in CSS, so a theme change touches nothing here. */
  paint: string;
  /** Drawn bottom to top in place of `d`, and moved as one: shading needs more than one fill. */
  parts?: readonly Part[];
  layer: keyof FxLayers;
  /** Passes behind the body: a twin in the back layer shows while `opacity` is negative. */
  orbit?: boolean;
  /** Each particle is the body's own outline, scaled up around its centre. */
  echo?: boolean;
  /** How far the path reaches from its origin at full size, stroke included, to keep it in the tile. */
  radius?: number;
  /** Cycles per second, and how far each particle trails the one before. */
  rate: number;
  stagger?: number;
  /** Keeps time with the hop instead, a cycle per hop: `rate` is unused. */
  hop?: boolean;
  /** Where the cycle stops for a still pose: a stopped clock could land on an empty frame. */
  at: number;
  /** Pose particle `i`, `k` being its progress through the cycle, 0 to 1. */
  place(p: Particle, k: number, i: number, g: Geometry, m: MotionState): void;
}

const FADE = 9;
const TAU = Math.PI * 2;
const ORBIT_TILT = 0.22;
/** Clear space kept between a particle and the edge of a sky tile, which clips. */
const MARGIN = 1;
/** Cues float into the open corner over the right shoulder, but no further than this. */
const CORNER_REACH = 50;
/** How far in from the very corner they aim: a sky tile rounds its corners off, and clips. */
const INSET = 19;

const STAR = 'M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z';
const DROP = 'M0-11C5-3 7 1 7 5 7 10 4 12 0 12-4 12-7 10-7 5-7 1-5-3 0-11Z';
const ellipse = (x: number, y: number, rx: number, ry = rx): string =>
  `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0${-2 * rx} 0Z`;
const circle = (r: number): string => ellipse(0, 0, r);
/** A cloud, three puffs over a soft belly, about 16 out from its centre. */
const CLOUD = 'M-11 8A6 6 0 0 1-12-3 7 7 0 0 1-2-9 8 8 0 0 1 10-5 6.5 6.5 0 0 1 12 7 30 30 0 0 1-11 8Z';
/** Further than the cloud reaches, as a sky tile's rounded corner cuts in deeper than its edges. */
const CLOUD_R = 22;
/** A bead of jelly in the accent: a soft glow round it, lit from the top left, with a glint. */
const bead = (d: string, glint: string): readonly Part[] => [
  [d, 'fx-aura'],
  [d, 'fx-orb'],
  [glint, 'fx-gloss'],
];
const QUESTION = 'M-10-6C-10-16 11-16 11-6 11 1 0 0 0 5M0 14v.01';
const ZED = 'M-9-6H9L-9 6H9';
/**
 * A line glyph in the body's own jelly: a soft glow round it, a pale rim around a saturated core,
 * and a glint along the top, so it reads as a piece of the mascot rather than type laid over it.
 */
const jelly = (d: string): readonly Part[] => [
  [d, 'fx-glow'],
  [d, 'fx-rim'],
  [d, 'fx-core'],
  [d, 'fx-glint'],
];
/** A star over a soft glow of its own colour: light, where a flat fill reads as a sticker. */
const SHINING: readonly Part[] = [
  [circle(17), 'fx-halo'],
  [STAR, 'fx-star'],
];

const cycle = (x: number): number => x - Math.floor(x);
/** Up and back down as `x` goes from 0 to 1. */
const hump = (x: number): number => Math.sin(Math.PI * clamp(x, 0, 1));
/** 0 to 1 with no jolt at either end. */
const smooth = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
/** 0 to 1, overshooting a little before it settles: a pop that lands, not a linear swell. */
const pop = (x: number): number => {
  const t = clamp(x, 0, 1) - 1;
  return 1 + t * t * (2.7 * t + 1.7);
};

/**
 * Places `p` a fraction `f` along a line from (x, y) towards the tile's top right corner, where
 * nothing else lives: accessories crowd the top and sides, but rarely that far out. A wide body
 * leaves a short line, so `least` keeps a distance, in design units, that spacing needs.
 */
function corner(p: Particle, g: Geometry, x: number, y: number, f: number, least = 0): void {
  const dx = g.viewX + g.viewSize - INSET - x;
  const dy = g.viewY + INSET - y;
  const length = Math.hypot(dx, dy) || 1;
  const scale = Math.max(f * Math.min(length, CORNER_REACH), least) / length;
  p.x = x + dx * scale;
  p.y = y + dy * scale;
}

/** Keeps `p` clear of the tile's edge by `radius` at its size, so small particles get closer. */
function inside(p: Particle, g: Geometry, radius: number): void {
  const margin = radius * Math.max(p.size, p.tall) + MARGIN;
  p.x = clamp(p.x, g.viewX + margin, g.viewX + g.viewSize - margin);
  p.y = clamp(p.y, g.viewY + margin, g.viewY + g.viewSize - margin);
}

/**
 * A trail of thought, small to large, out from the shoulder one at a time, the last a cloud. They
 * fade together, and the next thought starts from nothing, so the loop never shows its seam.
 * The cloud is placed first and the beads strung back from it, so however hard the tile pushes
 * the cloud in, the trail still leads up to it.
 */
function thought(p: Particle, k: number, i: number, g: Geometry): void {
  const x = g.right + 2;
  const y = g.top + 20;
  corner(p, g, x, y, 1, 46);
  p.size = 1;
  inside(p, g, CLOUD_R);
  if (i < 2) {
    // Strung back from the cloud's lower edge at a fixed spacing, however near the shoulder it is.
    const dx = x - p.x;
    const dy = y - p.y;
    const back = (i ? 17 : 25) / (Math.hypot(dx, dy) || 1);
    p.x += dx * back;
    p.y += dy * back;
  }
  p.y += Math.sin((k + i * 0.2) * TAU) * 1.5;
  const grown = pop((k - 0.06 - i * 0.12) / 0.14);
  const fade = smooth((0.96 - k) / 0.14);
  p.size = (i > 1 ? 0.85 : 0.6 + i * 0.4) * grown * (0.8 + 0.2 * fade);
  p.opacity = Math.min(1, grown * 2) * fade;
}

function ripple(p: Particle, k: number, _: number, g: Geometry): void {
  // A ripple of the outline, the same distance out on every side. It starts at the edge and
  // only grows, so it never crosses the body, even one you can see through. Like a ripple
  // on water, it leaves quickly and slows as it spreads.
  const spread = 1 - (1 - k) ** 2;
  const out = 1 + Math.max(6, Math.min(g.top - g.viewY, g.left - g.viewX) - 8) * spread;
  p.size = 1 + out / g.half;
  p.tall = 1 + out / g.hh;
  p.x = 120 * (1 - p.size);
  p.y = g.cy * (1 - p.tall);
  p.opacity = Math.min(k * 4, 1) * (1 - k) ** 1.5 * 0.9;
}

const EMITTERS: readonly Emitter[] = [
  {
    mood: 'thinking',
    count: 2,
    paint: 'fx',
    parts: bead(circle(4), ellipse(-1.4, -1.6, 1.2)),
    layer: 'front',
    radius: 4,
    rate: 0.3,
    at: 0.6,
    place: thought,
  },
  {
    mood: 'thinking',
    count: 1,
    paint: 'fx',
    parts: bead(CLOUD, ellipse(-6, -6, 2.4, 1.2)),
    layer: 'front',
    radius: CLOUD_R,
    rate: 0.3,
    at: 0.6,
    place: (p, k, _, g) => thought(p, k, 2, g),
  },
  {
    mood: 'thinking',
    count: 3,
    d: circle(2.1),
    paint: 'fx-dot',
    layer: 'front',
    rate: 0.3,
    at: 0.6,
    place(p, k, i, g) {
      // Inside the cloud, a beat apart: one thought after another, never all at once.
      thought(p, k, 2, g);
      const beat = hump(cycle(k * 3 - i * 0.22) / 0.45);
      p.x += (i - 0.9) * 6.5 * p.size;
      p.y -= (0.5 + beat * 1.5) * p.size;
      p.size *= 0.85 + beat * 0.3;
      p.opacity *= smooth((k - 0.3) / 0.08);
    },
  },
  {
    mood: 'working',
    count: 3,
    paint: 'fx-spark',
    parts: SHINING,
    layer: 'front',
    radius: 11,
    rate: 0.54,
    stagger: 1 / 3,
    at: 0.1,
    orbit: true,
    place(p, k, _, g) {
      const a = k * TAU;
      const depth = Math.sin(a);
      // Wide of the body, but inside the tile: clamped, the ends of the orbit would flatten.
      const out = Math.cos(a) * Math.min(Math.max(82, g.half * 1.4), g.viewSize / 2 - 13);
      // The far side rises less than the near side dips: seen through glass it stays below the eyes.
      const across = depth * (depth < 0 ? 15 : 24);
      // Low enough that the near side passes under the eyes, never across them.
      const cy = Math.max(g.cy + 16, g.eyeY + g.eyes.h / 2 - 6);
      p.x = 120 + out * Math.cos(ORBIT_TILT) - across * Math.sin(ORBIT_TILT);
      p.y = cy + out * Math.sin(ORBIT_TILT) + across * Math.cos(ORBIT_TILT);
      p.size = 0.78 + 0.22 * depth;
      p.turn = a * 40;
      // Dimmer the further round it goes, to a faint glint right behind. At the sides both twins
      // are at full strength, so the hand-over from front to back never pops.
      p.opacity = depth >= 0 ? 1 : -1 - 0.75 * depth;
    },
  },
  {
    mood: 'success',
    count: 4,
    paint: 'fx-accent',
    parts: SHINING,
    layer: 'front',
    radius: 10,
    rate: 0,
    stagger: 0.07,
    hop: true,
    at: 0.32,
    place(p, k, i, g) {
      // A burst with every hop, at its fullest at the top: stars pop out, drift away, twinkle out.
      const side = i % 2 ? 1 : -1;
      const near = i < 2;
      p.x = 120 + side * (g.half * (near ? 1.1 : 1.38) + k * 10);
      p.y = g.top + g.hh * (near ? 0.12 : 0.96) - (i % 2) * 8 - k * 8;
      p.size = pop(k / 0.22) * smooth((0.75 - k) / 0.4) * (near ? 1.15 : 0.8);
      p.turn = side * k * 120;
    },
  },
  {
    mood: 'error',
    count: 1,
    paint: 'fx-sweat',
    // Water: pale at the top, deep where it pools, and a glint down the left side.
    parts: [
      [DROP, 'fx-drop'],
      [ellipse(-2.9, 5, 1.3, 2.4), 'fx-gloss'],
    ],
    layer: 'front',
    radius: 13,
    rate: 0.45,
    at: 0.3,
    place(p, k, _, g, m) {
      // A bead of sweat at the temple: it swells, clings a moment, then runs, gathering speed.
      // Found from the eyes, not the top: on a round or pointed head the corner of the box is
      // out in the air, but just outside an eye and above it is always skin.
      const run = Math.max(0, k - 0.4) / 0.6;
      p.x = 120 + Math.max(g.half * 0.7, g.eyes.gap + g.eyes.w / 2 + 10) + m.pose.x;
      p.y = g.eyeY - g.eyes.h / 2 - 7 + run * run * 30 + m.pose.y;
      p.size = 0.9 * pop(k / 0.18);
      p.tall = p.size * (1 + run * 0.25);
      p.opacity = smooth((1 - k) / 0.2);
    },
  },
  {
    mood: 'listening',
    count: 2,
    // A soft band of the body's colour under each ring, so it reads as a swell, not a wire.
    paint: 'fx-swell',
    layer: 'back',
    rate: 0.42,
    stagger: 0.5,
    at: 0.3,
    echo: true,
    place: ripple,
  },
  {
    mood: 'listening',
    count: 2,
    paint: 'fx-line fx-ring',
    layer: 'back',
    rate: 0.42,
    stagger: 0.5,
    at: 0.3,
    echo: true,
    place: ripple,
  },
  {
    mood: 'speaking',
    count: 1,
    d: circle(5),
    paint: 'fx-mouth',
    layer: 'face',
    radius: 5,
    rate: 0,
    at: 0,
    place(p, _k, _, g, m) {
      // Clear of the eyes, however tall they are, without leaving the body.
      p.y = Math.min(g.eyes.h / 2 + 11, g.bottom - g.eyeY - 9);
      p.size = 1.7 - m.voice * 0.5;
      p.tall = 0.3 + m.voice * 1.9;
    },
  },
  {
    mood: 'waiting',
    count: 1,
    paint: 'fx-line fx-cue',
    parts: jelly(QUESTION),
    layer: 'front',
    radius: 26,
    rate: 0.24,
    at: 0.25,
    place(p, k, _, g) {
      // Rocks gently, and once a cycle gives a small hop, to catch the eye without nagging.
      const wave = Math.sin(k * TAU);
      // Squared, so the hop leaves the ground and lands softly rather than at full speed.
      const nudge = hump((k - 0.55) / 0.18) ** 2;
      corner(p, g, g.right + 2, g.top + 20, 0.45);
      p.y += wave * 2 - nudge * 4;
      p.size = 1 + nudge * 0.1;
      p.turn = 8 + wave * 7;
      p.opacity = 0.85 + 0.15 * Math.max(wave, nudge);
    },
  },
  {
    mood: 'sleeping',
    count: 3,
    paint: 'fx-line fx-z',
    parts: jelly(ZED),
    layer: 'front',
    radius: 19,
    rate: 0.17,
    stagger: 1 / 3,
    at: 0.8,
    place(p, k, _, g) {
      // Each one drifts up and out on a fixed diagonal, swaying and growing as it goes: z z Z.
      // A wide body leaves less room, so the whole climb shortens rather than bending into the
      // corner, which would stack the Zs. The corner itself is kept clear for a rounded sky tile.
      const x = g.right - 12;
      const y = g.top + 30;
      const reach = clamp(Math.min((g.viewX + g.viewSize - 18 - x) / 34, (y - g.viewY - 18) / 50), 0.5, 1);
      p.x = x + k * 34 * reach - Math.sin(k * TAU) * 2;
      p.y = y - k * 50 * reach;
      p.size = 0.42 + k * 0.6;
      p.turn = -12;
      p.opacity = Math.min(1, k / 0.2, (1 - k) / 0.35);
    },
  },
];

/** Particles and the mouth. Their shades need relative colour, or they stay flat. */
export const fxCss = String.raw`
.tile {
  --fx: var(--_c); --fx-a: var(--_a);
  --fx-a-core: #fff; --fx-a-hi: var(--fx-a); --fx-a-lo: var(--fx-a);
  --fx-drop-0: #d2efff; --fx-drop-1: #6ec1ff; --fx-drop-2: #2b86e0;
  --fx-cue: var(--mascot-cue, var(--fx-a)); --fx-cue-hi: var(--fx-cue); --fx-cue-lo: var(--fx-cue);
  --fx-white: #fff; --fx-rim: #fff; --fx-dot: #fff;
}
.tile[data-sky] { --fx: #fff; --fx-dot: var(--_c); }
.fx { fill: var(--fx); }
.fx-accent, .fx-spark { fill: var(--fx-a); }
.fx-spark, .fx-sweat { stroke: #fff; stroke-width: 1.5; paint-order: stroke; }
.fx-sweat { fill: #6ec1ff; }
.fx-orb { fill: url(#fx-orb); }
.fx-aura { fill: var(--fx-a); opacity: .45; filter: url(#fx-soft); }
.fx-dot { fill: var(--fx-dot); }
.fx-star { fill: url(#fx-star); }
.fx-drop { fill: url(#fx-drop); }
.fx-halo { fill: url(#fx-halo); stroke: none; }
.fx-gloss { fill: #fff; stroke: none; opacity: .85; }
.fx-mouth { fill: var(--e0); }
[data-material='frost'] .fx-mouth { fill: var(--fx); }
.fx-line { fill: none; stroke: var(--fx); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
/* Lit from above like the body, and fading where it passes the shadow below. */
.fx-ring { --fx-w: 1.6px; stroke: url(#fx-ring); }
.fx-swell { --fx-w: 6px; fill: none; stroke: var(--fx); stroke-opacity: .3; filter: url(#fx-swell); }
/* In the accent, as the stars are: a cue apart from the body, not more of it. */
.fx-cue, .fx-z { --fx-w: 9px; stroke: url(#fx-cue); }
.fx-z { --fx-w: 8px; }
/* In the glyph's own units, as px are in SVG. The light comes from the top left, as on the body. */
.fx-glow { stroke: var(--fx-rim); stroke-width: calc(var(--fx-w) + 3px); opacity: .55; filter: url(#fx-soft); }
.fx-rim { stroke: var(--fx-rim); stroke-width: var(--fx-w); }
.fx-core { stroke-width: calc(var(--fx-w) * .7); }
/* On the upper edge, as light catches the top of the body: down the middle it would read as hollow. */
.fx-glint { stroke: url(#fx-glint); stroke-width: calc(var(--fx-w) * .2); transform: translate(-.9px, -1.5px); }
`;

export const fxPaletteCss = String.raw`
.tile:not([data-sky]) {
  --fx: oklch(from var(--_c) clamp(.55, l, .74) c h);
  --fx-a: oklch(from var(--_a) clamp(.62, l, .8) max(c, .14) h);
}
.tile {
  --fx-a-core: oklch(from var(--fx-a) .98 calc(c * .3) h);
  --fx-a-hi: oklch(from var(--fx-a) calc(l + .14) calc(c * .7) h);
  --fx-a-lo: oklch(from var(--fx-a) calc(l - .1) c h);
  --fx-cue-hi: oklch(from var(--fx-cue) calc(l + .07) calc(c * .85) h);
  --fx-cue-lo: oklch(from var(--fx-cue) calc(l - .13) c calc(h - 12));
  --fx-rim: oklch(from var(--fx-cue) .9 calc(c * .45) h);
}
`;

interface Live {
  spec: Emitter;
  groups: SVGGElement[];
  nodes: SVGGraphicsElement[];
  twins: SVGGraphicsElement[];
  weight: number;
}

export interface Fx {
  /** Draw one frame. A `dt` of zero snaps every cross-fade. */
  frame(motion: MotionState, geometry: Geometry, dt: number): void;
}

const particle = ({ d, paint, parts }: Emitter): SVGGraphicsElement =>
  parts
    ? svg('g', { class: paint }, ...parts.map(([part, kind]) => svg('path', { d: part, class: kind })))
    : svg('path', { d, class: paint });

const particles = (spec: Emitter): SVGGraphicsElement[] => Array.from({ length: spec.count }, () => particle(spec));

/** Shading for particles drawn in parts. Bounding-box units, so one serves every size. */
const shades = (): SVGDefsElement =>
  svg(
    'defs',
    {},
    svg('radialGradient', { id: 'fx-orb', cx: 0.36, cy: 0.32, r: 0.74 }, ...stops([0, 'fx-a-hi'], [0.6, 'fx-a'], [1, 'fx-a-lo'])),
    svg('radialGradient', { id: 'fx-star', r: 0.55 }, ...stops([0, 'fx-a-core'], [0.36, 'fx-a'], [1, 'fx-a-lo'])),
    svg('radialGradient', { id: 'fx-halo' }, ...stops([0, 'fx-a', 0.5], [0.4, 'fx-a', 0.18], [1, 'fx-a', 0])),
    svg('linearGradient', { id: 'fx-drop', x2: 0, y2: 1 }, ...stops([0, 'fx-drop-0'], [0.55, 'fx-drop-1'], [1, 'fx-drop-2'])),
    // A few units across, so the blur costs next to nothing, even redrawn every frame.
    svg('filter', { id: 'fx-soft', x: -1, y: -1, width: 3, height: 3 }, svg('feGaussianBlur', { stdDeviation: 2.2 })),
    svg('linearGradient', { id: 'fx-glint', x2: 0, y2: 1 }, ...stops([0, 'fx-white', 0.8], [0.5, 'fx-white', 0])),
    svg('linearGradient', { id: 'fx-ring', x2: 0, y2: 1 }, ...stops([0.6, 'fx'], [1, 'fx', 0.2])),
    // Barely wider than the ring: a blur's cost grows with its region, and this one spans the body.
    svg('filter', { id: 'fx-swell', x: -0.1, y: -0.1, width: 1.2, height: 1.2 }, svg('feGaussianBlur', { stdDeviation: 2.5 })),
    // Lit from the top left and deepening below, as the body is.
    svg('linearGradient', { id: 'fx-cue', x1: 0.2, x2: 0.8, y2: 1 }, ...stops([0, 'fx-cue-hi'], [0.45, 'fx-cue'], [1, 'fx-cue-lo'])),
  );

/**
 * Every particle exists from the start, hidden, so a mood change adds no nodes.
 * A hidden group costs next to nothing per frame: its particles are skipped.
 */
export function createFx(layers: FxLayers): Fx {
  layers.front.append(shades());
  const live: Live[] = EMITTERS.map((spec) => {
    const nodes = particles(spec);
    const twins = spec.orbit ? particles(spec) : [];
    const groups = [svg('g', { display: 'none' }, ...nodes)];
    layers[spec.layer].append(groups[0] as SVGGElement);
    if (spec.orbit) {
      const behind = svg('g', { display: 'none' }, ...twins);
      layers.back.append(behind);
      groups.push(behind);
    }
    return { spec, groups, nodes, twins, weight: 0 };
  });
  const p: Particle = { x: 0, y: 0, size: 1, tall: 0, turn: 0, opacity: 1 };

  return {
    frame(motion, g, dt) {
      const { mood, still, motion: dial } = motion.clock;
      const rest = still || dial === 0;
      const fade = dt ? 1 - Math.exp(-FADE * dt) : 1;
      for (const item of live) {
        const { spec } = item;
        item.weight += ((spec.mood === mood ? 1 : 0) - item.weight) * fade;
        const shown = item.weight > 0.01;
        for (const group of item.groups) set(group, { display: shown ? null : 'none', opacity: fix(item.weight) });
        if (!shown) continue;
        const start = rest ? spec.at : spec.hop ? motion.hopPhase : motion.fx * spec.rate;
        for (let i = 0; i < spec.count; i++) {
          p.x = p.y = p.tall = p.turn = 0;
          p.size = p.opacity = 1;
          spec.place(p, cycle(start - i * (spec.stagger ?? 0)), i, g, motion);
          const node = item.nodes[i] as SVGGraphicsElement;
          if (spec.echo) {
            const scale = `translate(${fix(p.x)} ${fix(p.y)}) scale(${p.size.toFixed(4)} ${p.tall.toFixed(4)})`;
            set(node, { d: g.outline, transform: `${scale} ${g.bodyTransform}`, opacity: fix(p.opacity) });
            // Scaling must not fatten the line as it travels. A style, to beat the stylesheet.
            node.style.strokeWidth = `calc(var(--fx-w) * ${fix(1 / p.size)})`;
            continue;
          }
          if (spec.layer !== 'face') inside(p, g, spec.radius ?? 0);
          const size = fix(p.size);
          const transform = `translate(${fix(p.x)} ${fix(p.y)}) rotate(${fix(p.turn)}) scale(${size} ${fix(p.tall || p.size)})`;
          set(node, { transform, opacity: fix(Math.max(0, p.opacity)) });
          const twin = item.twins[i];
          if (twin) set(twin, { transform, opacity: fix(Math.max(0, -p.opacity)) });
        }
      }
    },
  };
}
