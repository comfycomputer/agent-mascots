import { about, clamp, fix, set, svg } from '../dom.js';
import type { EyeBox, EyePose, FrameClock, MascotView, MoodName, Pose, Renderer } from '../types.js';
import { eyePath } from './eyes.js';

/**
 * Side of the tightest view. At 16px one design unit is a tenth of a pixel, so
 * silhouettes drawn on a 10-unit grid land on whole pixels at 16 and 32.
 */
const BOX = 160;
/** Largest extent of the body inside `BOX`, leaving a pixel of margin at 16px. */
const BODY = 140;
/** Up to this width the view is tight and cues are at full strength. */
const TIGHT = 32;
/** From this width the framing matches `full`, so a swap barely shows. */
const LOOSE = 64;
/** Stands in until the first measurement, which arrives before paint. */
const DEFAULT_WIDTH = 32;
/** Cues ease over about a quarter of a second, like the mood expressions. */
const EASE = 9;
/** Quantisation steps per rendered pixel. */
const STEPS = 4;

/**
 * What a mood adds at small sizes, where the expression alone isn't enough. Every
 * mood has to be told apart in a single still frame at 16px, without particles.
 * Lengths are in `BOX` units. Indexes rather than names, so a cue costs no bundle
 * size per use.
 */
const enum C {
  /** Mouth size and bend; a negative bend is a smile. */
  MouthW,
  MouthH,
  MouthBend,
  /** Extra mouth height at full `voice`. */
  Voiced,
  /** Extra eye rotation in degrees. */
  Tilt,
  /** Raises the eyes, to make room for the mouth. */
  Lift,
  /** Narrows the eyes to bars, 0 to 1, because a short eye can't show a tilt. */
  Squint,
}

const CUES: Partial<Record<MoodName, Partial<Record<C, number>>>> = {
  working: { [C.Tilt]: -14 },
  success: { [C.MouthW]: 36, [C.MouthH]: 12, [C.MouthBend]: -0.7 },
  error: { [C.MouthW]: 30, [C.MouthH]: 10, [C.MouthBend]: 0.7, [C.Tilt]: 8, [C.Lift]: 8, [C.Squint]: 0.45 },
  // Listening, waiting and sleeping add a ring, a badge and a fade, which are CSS on `data-mood`.
  speaking: { [C.MouthW]: 30, [C.MouthH]: 12, [C.Voiced]: 28, [C.Lift]: 12 },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const snap = (value: number, steps: number): number => Math.round(value * steps) / steps;

const eyeNode = () => svg('path', { class: 'simple-eye' });

/**
 * The simple detail level: one filter-free SVG with a hand-tuned silhouette and
 * solid eyes. A list of these has to cost next to nothing, so every value is
 * snapped to a fraction of a rendered pixel and only a visible change touches the
 * DOM. At 16px an idle mascot makes about ten attribute writes a second.
 *
 * Tiny mascots fill their box with bigger eyes and exaggerated expressions. As the
 * width nears 64px that blends away into `full`'s framing.
 */
export function createSimpleRenderer(): Renderer {
  const root = svg('svg', { class: 'stage simple', part: 'body', 'aria-hidden': 'true', focusable: 'false' });
  const ring = svg('path', { class: 'simple-ring' });
  const body = svg('path', { class: 'simple-body' });
  const left = eyeNode();
  const right = eyeNode();
  const eyes = svg('g', {}, left, right);
  const mouth = eyeNode();
  const face = svg('g', { part: 'eyes' }, eyes, mouth);
  const badge = svg('circle', { class: 'simple-badge' });
  const rig = svg('g', {}, ring, body, face, badge);
  root.append(rig);

  const now: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];
  /** Skips rebuilding an eye outline that would come out the same. */
  const eyeKeys = ['', ''];

  let view: MascotView | null = null;
  let width = DEFAULT_WIDTH;
  /** 1 at `TIGHT` and below, 0 at `LOOSE` and above. */
  let small = 1;
  /** Rendered pixels per design unit. */
  let px = 1;
  let ground = 190;
  let eyeY = 120;
  let eyeFloor = 0;
  let lastT = NaN;
  const box: EyeBox = { w: 0, h: 0, r: 0, gap: 0 };

  function layout(next: MascotView): void {
    view = next;
    const { config, geometry: g } = next;
    const { shape, bodyWidth, bodyHeight } = config;
    const d = shape.simplePath ?? shape.path;
    const tuned = shape.simpleFace;
    const mid = (shape.top + shape.bottom) / 2;
    const fit = BODY / Math.max(shape.halfWidth * 2, shape.bottom - shape.top);

    small = clamp((LOOSE - width) / (LOOSE - TIGHT), 0, 1);
    const side = lerp(g.viewSize * fit, BOX * Math.max(1, bodyWidth, bodyHeight), small);
    const cy = lerp(120 + (g.viewY + g.viewSize / 2 - mid) * fit, 120, small);
    px = width / side;
    set(root, { viewBox: `${fix(120 - side / 2)} ${fix(cy - side / 2)} ${fix(side)} ${fix(side)}` });

    const stretch = `scale(${fix(bodyWidth)} ${fix(bodyHeight)})`;
    // Hand-tuned paths already fill the box; anything else is fitted to it.
    const transform = shape.simplePath
      ? about(120, 120, stretch)
      : `translate(120 120) ${stretch} scale(${fix(fit)}) translate(-120 ${fix(-mid)})`;
    set(body, { d, transform, 'stroke-width': fix(1.2 / px) });
    set(ring, { d, transform, 'stroke-width': fix(1.6 / px) });
    ground = 120 + (BODY / 2) * bodyHeight;

    // Under about 40px the design size would leave eyes less than 3px wide.
    const boost = fit * lerp(1, 1.5, clamp((48 - width) / 32, 0, 1));
    box.w = g.eyes.w * boost;
    box.h = g.eyes.h * boost;
    box.r = g.eyes.r * boost;
    box.gap = (tuned?.[1] ?? shape.eyes.gap * fit) * (g.eyes.gap / shape.eyes.gap);
    // The thinnest eye: a closed lid still has to read as a line.
    eyeFloor = 1.9 / px / box.h;

    const fitted = tuned?.[0] ?? 120 + (shape.eyes.y - mid) * fit;
    eyeY = 120 + (fitted - 120) * bodyHeight + config.eyeY * BODY * 0.22;
    set(mouth, { transform: `translate(120 ${fix(120 + ((tuned?.[2] ?? fitted + 36) - 120) * bodyHeight)})` });
    set(badge, { cx: fix(120 + 53 * bodyWidth), cy: fix(120 - 50 * bodyHeight), r: fix(lerp(13, 22, small)) });

    eyeKeys.fill('');
  }

  function drawEye(eye: SVGPathElement, side: -1 | 1, pose: EyePose): void {
    const open = Math.max(pose.open * (1 - now[C.Squint] * small), eyeFloor);
    const arc = snap(pose.arc, 8);
    // Eyes can't get taller in so little room, so wide eyes grow sideways. Narrowed eyes
    // grow too, or a bar shrinks to a dot at 16px. An arch already spreads by itself.
    const growth = open > 1 ? (open - 1) * 1.6 : (1 - open) * 0.6 * (1 - Math.abs(arc));
    const wide = snap(growth * small, 8);
    const height = snap(Math.min(open, 1.1), 16);
    const tilt = snap(pose.tilt + now[C.Tilt] * small, 0.5);
    const key = `${height} ${arc} ${tilt} ${wide}`;
    if (key === eyeKeys[side + 1 >> 1]) return;
    eyeKeys[side + 1 >> 1] = key;
    // Never let the eyes meet: at 16px a pixel between them is what makes them two eyes.
    const w = Math.max(box.w, Math.min(box.w * (1 + wide), box.gap * 2 - 1.2 / px));
    set(eye, {
      d: eyePath({ ...box, w }, height, arc),
      transform: `translate(${fix(side * box.gap)} 0) rotate(${side * tilt})`,
    });
  }

  function frame(pose: Pose, clock: FrameClock): void {
    if (!view) return;
    const cue = CUES[clock.mood] ?? {};
    const dt = clock.t - lastT;
    lastT = clock.t;
    // A draw outside the loop has no time step: jump, as the motion system does.
    const ease = clock.still || !(dt > 0) ? 1 : 1 - Math.exp(-EASE * dt);
    now.forEach((value, key) => {
      now[key] = value + ((cue[key as C] ?? 0) - value) * ease;
    });

    // Steps of a quarter pixel, measured at the body's edge for rotation and scale.
    const unit = px * STEPS;
    const scaleSteps = (width / 2) * STEPS;
    const degreeSteps = (width * STEPS * Math.PI) / 360;
    // A float of half a pixel is lost at 16px, so travel grows as the mascot shrinks.
    const travel = 1 + small * 0.5;
    const x = snap(pose.x * travel, unit);
    const y = snap(pose.y * travel, unit);
    const rotate = snap(pose.rotate, degreeSteps);
    const scaleX = snap(pose.scaleX, scaleSteps);
    const scaleY = snap(pose.scaleY, scaleSteps);
    const squash = about(120, ground, `scale(${scaleX.toFixed(3)} ${scaleY.toFixed(3)})`);
    set(rig, { transform: `translate(${fix(x)} ${fix(y)}) rotate(${fix(rotate)} 120 120) ${squash}` });

    const parallax = 1 + small * 0.6;
    set(face, { transform: `translate(${fix(snap(pose.eyeX * parallax, unit))} ${fix(snap(pose.eyeY * parallax, unit))})` });
    set(eyes, { transform: `translate(120 ${Math.round(eyeY - now[C.Lift] * small)})` });
    drawEye(left, -1, pose.left);
    drawEye(right, 1, pose.right);

    const mouthW = Math.round(now[C.MouthW]);
    const mouthH = snap(Math.max(now[C.MouthH] + now[C.Voiced] * clock.voice, 10), unit);
    const bend = snap(now[C.MouthBend], 8);
    set(mouth, {
      d: mouthW < 2 ? null : eyePath({ w: mouthW, h: mouthH, r: Math.min(mouthW, mouthH) / 2, gap: 0 }, 1, bend),
    });
  }

  return {
    level: 'simple',
    fx: null,
    mount: (tile) => tile.append(root),
    build: layout,
    layout,
    frame,
    resize(next) {
      if (next === width || next <= 0) return;
      width = next;
      if (view) layout(view);
    },
    destroy() {
      root.remove();
      view = null;
    },
  };
}

export const simpleCss = String.raw`
.simple-body { fill: var(--_c); stroke: var(--so, #0000); paint-order: stroke; stroke-linejoin: round; }
/* The full level's eye colours, flat: the two levels must not disagree about a face. */
.simple-eye { fill: var(--_e, var(--se, var(--e1))); stroke: var(--eye-lip, #0000); stroke-width: .8; }
.simple-ring { fill: none; stroke: var(--_a); }
.simple-badge { fill: var(--_a); }
.simple-ring, .simple-badge { opacity: 0; }
@media not (prefers-reduced-motion: reduce) {
  .simple-ring, .simple-badge, .simple-body { transition: opacity .25s; }
}
[data-mood='listening'] .simple-ring { opacity: .8; }
[data-mood='waiting'] .simple-badge { opacity: 1; }
[data-mood='sleeping'] .simple-body { opacity: .65; }
`;

/**
 * Derived shades, so this needs the palette's relative colour check. Bodies too dark or too
 * pale for one of the page themes get an outline, which mid-range colours never
 * show. A sky's gradient comes from the body colour, so there the body goes pale
 * and the eyes take the deep shade. Frost and glass keep their character without
 * filters, so crossing into this level changes the detail and not the material.
 */
export const simplePaletteCss = String.raw`
[data-detail='simple'] {
  --so: oklch(from var(--_c) calc(l + .42 - .8 * clamp(0, (l - .5) * 99, 1)) c h / clamp(0, max(l - .86, .3 - l) * 25, 1));
}
[data-detail='simple'][data-sky] { --so: #0000; --se: oklch(from var(--_c) clamp(.3, calc(l - .34), .42) c h); }
[data-sky] .simple-body { fill: oklch(from var(--_c) max(l, .94) calc(c * .3) h); }
[data-detail='simple'][data-material='frost'], [data-detail='simple'][data-material='glass'] { --so: var(--edge); }
[data-material='frost'] .simple-body { fill: var(--ice-1); }
[data-material='glass'] .simple-body { fill: var(--shell-1); }
`;
