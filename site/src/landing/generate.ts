// Presets without end: random looks for the marquee once the named ones have gone by, each drawn
// to a small WebP by one hidden mascot, in idle time, a few ahead of need.
//
// The page may only run a few full-detail mascots (MAX_FULL_DETAIL in lib/limits.ts), so this is one more,
// and it is `hidden`, so it does no per-frame work, between pictures.

import { MASCOT_EYE_SHAPES, MASCOT_SHAPES } from '@comfycomputer/agent-mascots';
import { blobOf, frameOf, nextFrame, paint, stylesOf, whenIdle } from '../lib/snapshot';
import type { Preset } from './presets';

/** A random look, with its picture: an object URL, freed with `release`. */
export interface GeneratedPreset extends Preset {
  label: string;
  src: string;
}

/** CSS pixels, at twice that for sharp screens: the named pictures' size. */
const SIZE = 160;
const DENSITY = 2;
const QUALITY = 0.78;
/** Pictures kept ready, so a card coming round seldom has to wait. */
const AHEAD = 6;

/** Ones that read on any shape. Facets and outline belong to the gem and glass. */
const EXTRAS = 'antenna stalk ears arms ring leaf rays spots tentacles blush bubbles horns halo crown bow wings tail whiskers glasses'.split(' ');
const EYES = MASCOT_EYE_SHAPES.filter((shape) => shape !== 'auto');

/** The stamp's own attributes, which every look leaves alone. */
const STAMP: Record<string, string> = { detail: 'full', shadow: 'none', motion: '0', blink: '0', glance: '0', track: 'none', 'aria-hidden': 'true' };
const KEPT = new Set([...Object.keys(STAMP), 'style', 'hidden']);

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const between = (low: number, high: number) => low + Math.random() * (high - low);

function hex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const value = l / 100 - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Mostly bright bodies, now and then a pale or a dark one, as the named presets have. */
function bodyColour(hue: number): string {
  const roll = Math.random();
  if (roll < 0.12) return hex(hue, between(10, 30), between(14, 26));
  if (roll < 0.24) return hex(hue, between(40, 80), between(84, 92));
  return hex(hue, between(60, 92), between(50, 68));
}

/** A random look, with a ground of three light colours near its hue, light enough for the text. */
export function randomPreset(id: number): Omit<GeneratedPreset, 'src'> {
  const hue = Math.floor(Math.random() * 360);
  const attrs: Record<string, string> = { shape: pick(MASCOT_SHAPES), color: bodyColour(hue) };
  const material = Math.random();
  if (material < 0.18) attrs.material = 'glass';
  else if (material < 0.32) attrs.material = 'frost';
  if (Math.random() < 0.3) attrs.accent = hex((hue + 150 + between(0, 60)) % 360, 90, 62);
  if (Math.random() < 0.25) attrs['eye-shape'] = pick(EYES);
  // Half keep the shape's own accessories. The rest get one to three; glass keeps its own two.
  if (Math.random() < 0.5) {
    const chosen = new Set<string>();
    const count = 1 + Math.floor(Math.random() * 3);
    while (chosen.size < count) chosen.add(pick(EXTRAS));
    if (attrs.material === 'glass') chosen.add('iridescent').add('outline');
    attrs.accessories = [...chosen].join(' ');
  }
  const ground = [hex(hue, 90, 86), hex((hue + 35) % 360, 70, 90), hex(hue, 60, 97)] as const;
  const label = [attrs.material, attrs.shape].filter(Boolean).join(' ');
  return { name: `look-${id}`, label, attrs, ground };
}

export interface Generator {
  /** A preset that is ready, or null if none is yet. Either way, it asks for more. */
  take(): GeneratedPreset | null;
  /** Frees a picture no card shows any more. */
  release(preset: GeneratedPreset): void;
  start(): void;
}

export function createGenerator(): Generator {
  const ready: GeneratedPreset[] = [];
  let stamp: HTMLElement | null = null;
  let css: string | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let busy = false;
  let broken = false;
  let count = 0;

  function makeStamp(): HTMLElement {
    const el = document.createElement('agent-mascot');
    for (const [name, value] of Object.entries(STAMP)) el.setAttribute(name, value);
    // On screen as far as the browser knows, so it renders, but never seen or hit.
    el.style.cssText = `position:fixed;left:0;top:0;width:${SIZE}px;opacity:0;pointer-events:none;contain:strict;height:${SIZE}px`;
    el.hidden = true;
    document.body.append(el);
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE * DENSITY;
    return el;
  }

  async function draw(el: HTMLElement, preset: Omit<GeneratedPreset, 'src'>): Promise<string | null> {
    for (const name of el.getAttributeNames()) if (!KEPT.has(name)) el.removeAttribute(name);
    for (const [name, value] of Object.entries(preset.attrs)) el.setAttribute(name, value);
    // Two frames: one to lay out the new look, one to draw it.
    await nextFrame();
    await nextFrame();
    css ??= stylesOf(el.shadowRoot!);
    const ctx = canvas!.getContext('2d')!;
    ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    await paint(ctx, frameOf(el, css, SIZE, SIZE, DENSITY));
    const blob = await blobOf(canvas!, 'image/webp', QUALITY);
    return blob ? URL.createObjectURL(blob) : null;
  }

  async function fill() {
    if (busy || broken || ready.length >= AHEAD) return;
    busy = true;
    stamp ??= makeStamp();
    stamp.hidden = false;
    try {
      while (ready.length < AHEAD) {
        await whenIdle(500);
        const preset = randomPreset(++count);
        const src = await draw(stamp, preset);
        if (!src) {
          broken = true;
          break;
        }
        ready.push({ ...preset, src });
      }
    } catch {
      // A browser that can't draw one won't draw the next: the named presets keep going round.
      broken = true;
    } finally {
      stamp.hidden = true;
      busy = false;
    }
  }

  return {
    take() {
      const preset = ready.shift() ?? null;
      void fill();
      return preset;
    },
    release(preset) {
      URL.revokeObjectURL(preset.src);
    },
    start: () => void fill(),
  };
}
