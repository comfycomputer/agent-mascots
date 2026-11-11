import { about, clamp, filter, fix, outer, REGION, set, stops, svg } from '../dom.js';
import { MATERIALS, type MaterialInstance } from '../materials/index.js';
import { getAccessory } from '../registry.js';
import type {
  AccessoryInstance,
  AccessorySlots,
  EyePose,
  FrameClock,
  FxLayers,
  Geometry,
  MascotView,
  Pose,
  Renderer,
} from '../types.js';
import { eyeKey, eyePath } from './eyes.js';

const SILHOUETTE = 'sil';
const SOLID = 'solid';
/** The body layer holds the filters, so anything repainting it shares this rate. */
const BODY_RATE = 24;
/** Filters reach no further than the view, plus room for a blur at its edge. */
const REGION_MARGIN = 24;
/** A tight bloom, dropped a little so it sits under the body, not around it like a fog. */
const HALO_BLUR = 6;
const HALO_DROP = 3;
/** The fine line that defines the silhouette on a pale page. */
const EDGE_BLUR = 0.9;
const EDGE_GAIN = 2.6;
/** Below the first of these widths fine detail starts to thicken, reaching its limit at the second. */
const FINE_FROM = 160;
const FINE_TO = 96;
/** What the edge's blur gains at the limit, so the line stays about a pixel wide. */
const EDGE_THICKEN = 0.7;
/** How sharply the goo filter cuts the blur into an edge, and where. Too steep and it aliases. */
const GOO_SLOPE = 15;
const GOO_THRESHOLD = -0.43;

interface EyeNode {
  group: SVGGElement;
  path: SVGPathElement;
  key: string;
}

/** Both eyes under one transformable group. */
interface EyePair {
  root: SVGGElement;
  left: EyeNode;
  right: EyeNode;
}

function eyeNode(attrs: Record<string, string>): EyeNode {
  const path = svg('path', attrs);
  return { group: svg('g', {}, path), path, key: '' };
}

function eyePair(attrs: Record<string, string>, ...extra: SVGElement[]): EyePair {
  const left = eyeNode(attrs);
  const right = eyeNode(attrs);
  return { root: svg('g', {}, ...extra, left.group, right.group), left, right };
}

function poseEye(node: EyeNode, side: -1 | 1, pose: EyePose, g: Geometry, force: boolean): void {
  const key = eyeKey(pose);
  if (key === node.key && !force) return;
  node.key = key;
  node.path.setAttribute('d', eyePath(g.eyes, pose.open, pose.arc));
  set(node.group, { transform: `translate(${fix(side * g.eyes.gap)} 0) rotate(${fix(side * pose.tilt)})` });
}

function layerSvg(cls: string, part?: string): SVGSVGElement {
  return svg('svg', { class: cls, part, 'aria-hidden': 'true', focusable: 'false' });
}

/**
 * The full detail level.
 *
 * The mascot is split into stacked SVG layers because a repaint of a layer with
 * filters is the expensive thing. Float, hop and squash move the whole rig with a
 * compositor transform, so they repaint nothing. Animated accessories and the eyes
 * sit in their own filter-free layers, so a blink repaints only those. The body
 * layer holds the filters and repaints only when its outline morphs.
 */
export function createFullRenderer(): Renderer {
  const under = layerSvg('stage');
  const over = layerSvg('stage');
  const back = layerSvg('layer');
  const body = layerSvg('layer', 'body');
  const front = layerSvg('layer');
  const eyes = layerSvg('layer eyes', 'eyes');
  const rig = document.createElement('div');
  rig.className = 'rig';
  rig.append(back, body, front, eyes);

  const shadow = svg('ellipse', { class: 'shadow', fill: 'url(#ground)' });
  const fxBack = svg('g');
  const fxFront = svg('g');
  const fxFace = svg('g');
  under.append(
    svg('defs', {}, svg('radialGradient', { id: 'ground' }, ...stops([0, 'ground', 0.24], [0.5, 'ground', 0.11], [1, 'ground', 0]))),
    shadow,
  );
  over.append(fxFront);

  const fx: FxLayers = { back: fxBack, front: fxFront, face: fxFace };
  const layers = [under, over, back, body, front, eyes];

  let view: MascotView | null = null;
  let material: MaterialInstance | null = null;
  let accessories: AccessoryInstance[] = [];
  let bodyPath: SVGPathElement | null = null;
  let shine: SVGEllipseElement | null = null;
  let gooBlur: SVGFEGaussianBlurElement | null = null;
  let gooMatrix: SVGFEColorMatrixElement | null = null;
  let edge: Element | null = null;
  let width = 0;
  let visible: EyePair | null = null;
  let face: SVGGElement | null = null;
  let bodyStep = -1;
  let regions: Element[] = [];
  let wasStill = false;
  let rigKey = '';
  let eyeShiftKey = '';
  let eyesDirty = true;

  function build(next: MascotView): void {
    const { config } = next;
    view = next;
    const shape = config.shape;
    for (const layer of [back, body, front, eyes]) layer.replaceChildren();
    // Inside the rig, so echoes of the outline lean and bob with the body they follow.
    back.append(fxBack);

    bodyPath = svg('path', { id: 'bp', d: shape.path });
    const merge = svg('g');
    const silhouette = svg('g', { id: SILHOUETTE }, bodyPath, merge);
    const defs = svg('defs', {}, silhouette);
    // Smooth outlines skip the goo filter: it would change nothing, and they repaint for less.
    const useGoo = !shape.smooth || config.accessories.includes('ears') || config.accessories.includes('arms');
    gooBlur = gooMatrix = null;
    if (useGoo) {
      gooBlur = svg('feGaussianBlur', {});
      gooMatrix = svg('feColorMatrix', {});
      defs.append(filter('goo', gooBlur, gooMatrix));
    }
    // A blur is at half strength on the outline itself. Gain turns it back into a clean line.
    const gain = svg('feColorMatrix', { values: `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${EDGE_GAIN} 0` });
    const edgeFilter = outer('edge', EDGE_BLUR, gain);
    edge = edgeFilter.firstElementChild;
    defs.append(
      svg('g', { id: SOLID, filter: useGoo ? 'url(#goo)' : null }, svg('use', { href: `#${SILHOUETTE}` })),
      outer('halo', HALO_BLUR, svg('feOffset', { dy: HALO_DROP })),
      edgeFilter,
    );

    defs.append(
      svg('mask', { id: 'mask', ...REGION, maskUnits: 'userSpaceOnUse' }, svg('use', { href: `#${SOLID}`, fill: '#fff' })),
    );

    const paint = svg('g');
    const inside = svg('g', { class: 'inside' });
    const masked = svg('g', { mask: 'url(#mask)' }, paint, inside);
    material = MATERIALS[config.material]({ defs, paint, silhouette: SILHOUETTE, solid: SOLID });
    paint.append(svg('rect', { class: 'plate', ...REGION }));
    body.append(
      defs,
      svg('use', { href: `#${SOLID}`, class: 'halo', filter: 'url(#halo)' }),
      svg('use', { href: `#${SOLID}`, class: 'edge', filter: 'url(#edge)' }),
      masked,
    );

    shine = svg('ellipse', { fill: 'url(#shine)' });
    const shineFade = svg('radialGradient', { id: 'shine' }, ...stops([0, 'shine-0'], [0.5, 'shine-1'], [0.75, 'shine-m'], [1, 'shine-2']));
    const gloss = svg('g', {}, shine);
    const frontDefs = svg('defs', {}, shineFade, svg('clipPath', { id: 'clip' }, svg('use', { href: '#bp' })));
    front.append(frontDefs, gloss);

    face = svg('g');
    visible = eyePair({ class: 'eye', fill: 'url(#iris)' }, face, fxFace);
    eyes.append(
      svg('defs', {}, svg('linearGradient', { id: 'iris', x1: 0, y1: 0, x2: 0, y2: 1 }, ...stops([0, 'e0'], [0.55, 'e1'], [1, 'e2']))),
      visible.root,
    );

    const slots: AccessorySlots = {
      back,
      merge,
      inside,
      gloss,
      front,
      face,
      defs: frontDefs,
      solid: SOLID,
      config,
    };
    accessories = [];
    for (const name of config.accessories) {
      const accessory = getAccessory(name);
      if (accessory) accessories.push(accessory.build(slots));
    }
    // Cut by the body's own mask, which follows the melted outline exactly. Where that mask
    // keeps changing it would run the goo filter a second time, in this layer: a morphing outline
    // takes a plain clip instead, unless arms or ears melt into it, where a clip would leave the
    // joins bare.
    set(gloss, shape.morph && !merge.children.length ? { 'clip-path': 'url(#clip)' } : { mask: 'url(#mask)' });

    regions = [...body.querySelectorAll('filter, mask'), ...front.querySelectorAll('filter, mask')];
    layout(next);
  }

  /** Hairlines thin enough for 320px would vanish at 96. Runs on a resize, never per frame. */
  function fit(): void {
    const small = width ? clamp((FINE_FROM - width) / (FINE_FROM - FINE_TO), 0, 1) : 0;
    if (edge) set(edge, { stdDeviation: fix(EDGE_BLUR + small * EDGE_THICKEN) });
    material?.fit?.(small);
  }

  function layout(next: MascotView): void {
    const { config, geometry: g } = next;
    view = next;
    const viewBox = `${g.viewX} ${g.viewY} ${g.viewSize} ${g.viewSize}`;
    for (const layer of layers) set(layer, { viewBox });
    const size = fix(g.viewSize + REGION_MARGIN * 2);
    const region = { x: fix(g.viewX - REGION_MARGIN), y: fix(g.viewY - REGION_MARGIN), width: size, height: size };
    for (const element of regions) set(element, region);

    if (bodyPath) set(bodyPath, { transform: g.bodyTransform });
    if (gooBlur && gooMatrix) {
      set(gooBlur, { stdDeviation: fix(g.goo) });
      set(gooMatrix, {
        values: `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${GOO_SLOPE} ${GOO_SLOPE * GOO_THRESHOLD}`,
      });
    }
    material?.layout(g);
    fit();

    const [sx, sy, rx, ry] = config.shape.shine;
    const scaleX = config.bodyWidth;
    const scaleY = config.bodyHeight;
    if (shine) {
      set(shine, {
        cx: fix(120 + (sx - 120) * scaleX),
        cy: fix(g.bottom - (g.bottom - sy) * scaleY),
        rx: fix(rx * 1.5 * scaleX),
        ry: fix(ry * 2.2 * scaleY),
      });
    }

    if (visible) set(visible.root, { transform: `translate(120 ${fix(g.eyeY)})` });
    set(shadow, { cx: 120, cy: fix(g.ground + 18), rx: fix(g.half * 0.72), ry: 9 });
    if (!config.shadow) set(shadow, { display: 'none' });
    else shadow.removeAttribute('display');
    for (const accessory of accessories) accessory.layout(g);
    rig.style.transformOrigin = `50% ${fix(((g.cy - g.viewY) * 100) / g.viewSize)}%`;
    eyesDirty = true;
    rigKey = '';
  }

  function frame(pose: Pose, clock: FrameClock): void {
    if (!view) return;
    const { geometry: g } = view;
    const unit = 100 / g.viewSize;

    // Two pivots in one transform: rotation around the body, squash around the ground.
    const key = `${fix(pose.x)} ${fix(pose.y)} ${fix(pose.rotate)} ${fix(pose.scaleX * 1000)} ${fix(pose.scaleY * 1000)}`;
    if (key !== rigKey) {
      rigKey = key;
      const drop = fix((g.ground - g.cy) * unit);
      rig.style.transform =
        `translate(${fix(pose.x * unit)}%,${fix(pose.y * unit)}%) rotate(${fix(pose.rotate)}deg) ` +
        `translateY(${drop}%) scale(${pose.scaleX.toFixed(4)},${pose.scaleY.toFixed(4)}) translateY(${-drop}%)`;
    }

    const shift = `${fix(pose.eyeX)} ${fix(pose.eyeY)}`;
    if (shift !== eyeShiftKey) {
      eyeShiftKey = shift;
      eyes.style.transform = `translate(${fix(pose.eyeX * unit)}%,${fix(pose.eyeY * unit)}%)`;
    }

    if (visible) {
      poseEye(visible.left, -1, pose.left, g, eyesDirty);
      poseEye(visible.right, 1, pose.right, g, eyesDirty);
    }
    // Everything here repaints the filtered body: do it on the same frames, at a capped rate.
    const step = Math.floor(clock.t * BODY_RATE);
    const repaint = clock.still || eyesDirty || step !== bodyStep;
    bodyStep = step;
    eyesDirty = false;

    const { morph } = view.config.shape;
    if (morph && bodyPath && !clock.still && repaint) {
      set(bodyPath, { d: morph(clock.phase * 4, Math.min(1, clock.motion)) });
    }

    if (shine) set(shine, { transform: `translate(${fix(pose.shineX)} ${fix(pose.shineY)})` });
    set(shadow, {
      transform: about(120, fix(g.ground + 18), `scale(${fix(pose.shadowScale)} 1)`),
      opacity: fix(pose.shadowOpacity),
    });

    // Going still puts the outline at rest and re-lays accessories, which rests them too.
    // They still pose for the mood, once per redraw, with `clock.phase` at zero.
    if (clock.still && !wasStill) {
      if (bodyPath) set(bodyPath, { d: view.config.shape.path });
      for (const accessory of accessories) accessory.layout(g);
    }
    wasStill = clock.still;
    for (const accessory of accessories) accessory.animate?.(clock, g);
  }

  return {
    level: 'full',
    fx,
    mount(target) {
      target.append(under, rig, over);
    },
    build,
    layout,
    frame,
    resize(next) {
      width = next;
      fit();
    },
    destroy() {
      under.remove();
      rig.remove();
      over.remove();
      view = null;
    },
  };
}
