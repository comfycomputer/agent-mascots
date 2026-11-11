import { about, fix } from '../dom.js';
import { getAccessory } from '../registry.js';
import type { EyeBox, Geometry, MascotConfig } from '../types.js';

/** Smallest viewBox side. Compositions needing more room zoom out rather than clip. */
const MIN_VIEW = 188;
/** Room under the ground for the shadow. */
const SHADOW_ROOM = 30;
/** Clearance above the tallest point, for float and hop. */
const HEADROOM = 16;

export function eyeBox(config: MascotConfig): EyeBox {
  const base = config.shape.eyes;
  const shape = config.eyeShape === 'auto' ? (base.square ? 'square' : 'pill') : config.eyeShape;
  let w = base.w;
  let h = base.h;
  if (shape === 'round') {
    w *= 1.15;
    h = w;
  } else if (shape === 'dot') {
    w *= 0.72;
    h = w;
  } else if (shape === 'square' && !base.square) {
    w *= 1.2;
    h = w * 1.1;
  } else if (shape === 'oval') {
    w *= 1.5;
    h = w * 0.7;
  } else if (shape === 'slit') {
    w *= 0.5;
    h *= 1.1;
  } else if (shape === 'bar') {
    // Wide enough that the pair nearly meet across the middle: a visor in two halves.
    w = base.gap * 1.8;
    h *= 0.42;
  } else if (shape === 'big') {
    w *= 1.45;
    h *= 1.1;
  }
  w *= config.eyeWidth;
  h *= config.eyeHeight;
  const r = shape === 'square' ? Math.min(6, w / 3, h / 3) : Math.min(w, h) / 2;
  return { w, h, r, gap: base.gap * config.eyeSpacing * Math.sqrt(config.bodyWidth) };
}

/** Lay out the mascot. Pure and allocation-light: this runs on every slider tick. */
export function computeGeometry(config: MascotConfig): Geometry {
  const { shape, bodyWidth, bodyHeight } = config;
  const bottom = shape.bottom;
  const top = bottom - (bottom - shape.top) * bodyHeight;
  const half = shape.halfWidth * bodyWidth;
  const cy = (top + bottom) / 2;
  const hh = (bottom - top) / 2;

  let above = 0;
  let below = 0;
  let reach = 1;
  for (const name of config.accessories) {
    const accessory = getAccessory(name);
    if (!accessory) continue;
    above = Math.max(above, accessory.above ?? 0);
    below = Math.max(below, accessory.below ?? 0);
    reach = Math.max(reach, accessory.reach ?? 1);
  }

  const ground = bottom + below;
  const contentTop = top - above - HEADROOM;
  const contentBottom = ground + SHADOW_ROOM;
  const viewSize = Math.max(MIN_VIEW, contentBottom - contentTop, half * reach * 2 + 24);

  return {
    top,
    bottom,
    half,
    left: 120 - half,
    right: 120 + half,
    cy,
    hh,
    ground,
    bodyTransform: about(120, bottom, `scale(${fix(bodyWidth)} ${fix(bodyHeight)})`),
    viewX: fix(120 - viewSize / 2),
    viewY: fix((contentTop + contentBottom - viewSize) / 2),
    viewSize: fix(viewSize),
    eyeY:
      bottom - (bottom - shape.eyes.y) * bodyHeight + config.eyeY * (bottom - top) * 0.22,
    eyes: eyeBox(config),
    goo: 1.5 + config.softness * 5.5,
    outline: shape.path,
  };
}
