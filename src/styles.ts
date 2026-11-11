import { glassCss } from './materials/glass.js';
import { frostCss } from './materials/frost.js';
import { glowCss } from './materials/glow.js';
import { fxCss, fxPaletteCss } from './motion/fx.js';
import { registeredCss } from './registry.js';
import { simpleCss, simplePaletteCss } from './render/simple.js';

const baseCss = String.raw`
:host {
  display: inline-block;
  position: relative;
  width: fit-content;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 1;
  vertical-align: middle;
  contain: layout style;
  -webkit-tap-highlight-color: transparent;
}
:host::before { content: ''; display: block; width: 240px; }
:host([hidden]) { display: none; }
:host([size]) { width: var(--_w) !important; height: var(--_w) !important; }
.tile {
  --e0: #fff;
  --e1: #fff;
  --e2: #fff;
  --shine-0: #fff6;
  --shine-1: #ffffff26;
  --shine-m: #ffffff0d;
  --shine-2: #fff0;
  --ground: #000;
  --stalk: var(--_c);
  position: absolute;
  inset: 0;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}
.tile[data-sky] {
  overflow: hidden;
  border-radius: var(--mascot-radius, 22%);
  background:
    radial-gradient(60% 55% at 62% 42%, var(--sky-glow, #0000), #0000 70%),
    linear-gradient(180deg, var(--sky-0, var(--_s)), var(--sky-1, var(--_s2, var(--_s))));
}
/* The flat body would vanish into a sky of its own colour. */
.tile[data-sky='auto'] { --sky-0: #1b2331; --sky-1: #3a475c; }
.rig, .stage, .layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.rig, .layer { will-change: transform; }
/* Fills stay opaque: the goo filter thresholds alpha, so opacity has to come after it. */
.halo { fill: var(--halo, #0000); opacity: var(--halo-a, 1); }
.edge { fill: var(--edge, #0000); opacity: var(--edge-a, 1); }
.plate { fill: var(--plate, #0000); }
.tint { fill: var(--tint, #0000); }
.wall { fill: var(--wall, #fff); opacity: var(--wall-a, 1); }
.eye { stroke: var(--eye-lip, #0000); stroke-width: .8; }
.tile[data-eye] { --e0: var(--_e); --e1: var(--_e); --e2: var(--_e); }
`;

/**
 * High contrast modes: the shades above mean nothing there, so the mascot becomes a
 * plain outlined figure in system colours, and it stays one whatever the page's colours are.
 */
const forcedCss = String.raw`
@media (forced-colors: active) {
  .tile[data-detail] {
    forced-color-adjust: none;
    --e0: CanvasText; --e1: CanvasText; --e2: CanvasText; --_e: CanvasText; --eye-lip: #0000;
    --edge: CanvasText; --edge-a: 1; --halo: #0000; --so: CanvasText; --plate: Canvas;
    --shine-0: #0000; --shine-1: #0000; --shine-m: #0000; --stalk: CanvasText;
    --fx: CanvasText; --fx-a: CanvasText; --tint: Canvas;
    --ground: CanvasText;
    --ac-stem-0: CanvasText; --ac-stem-1: CanvasText; --ac-stem-2: CanvasText; --ac-stem-shade: CanvasText;
    background: none !important;
  }
  .edge { filter: none; fill: Canvas; stroke: CanvasText; stroke-width: 7; }
  .ac-stem-shine { stroke: Canvas; }
  .fx-sweat, .fx-orb, .fx-star, .fx-drop { fill: CanvasText; }
  .fx-halo, .fx-gloss, .fx-aura, .fx-glow, .fx-rim, .fx-glint { display: none; }
  .fx-core { stroke: CanvasText; stroke-width: 3; }
  .fx-spark { stroke: Canvas; }
  .fx-dot { fill: Canvas; }
  .simple-body { fill: Canvas; }
}
`;

/** Every derived shade. Without relative colour these are skipped, and the flat fallbacks apply. */
const paletteCss = String.raw`
.tile {
  /* Pale, so it blooms on a dark page and all but disappears on white, where it would be fog. */
  --halo: oklch(from var(--_c) clamp(.82, calc(l + .12), .9) c h);
  --edge: oklch(from var(--_c) clamp(.5, l, .72) calc(c * 1.08) h);
  --ground: oklch(from var(--_c) clamp(.3, calc(l * .6), .5) c h);
  --stalk: oklch(from var(--_c) clamp(.5, l, .7) c h / .7);
}
.tile[data-sky] {
  --ground: oklch(from var(--sky-0) calc(l * .6) c h);
  --stalk: #ffffffeb;
}
.tile[data-sky='auto'] {
  --sky-0: oklch(from var(--_c) clamp(.36, calc(l - .2), .52) calc(c * .7) calc(h - 4));
  --sky-1: oklch(from var(--_c) clamp(.6, calc(l + .06), .78) calc(c * .8) calc(h + 10));
  --sky-glow: oklch(from var(--_c) .93 calc(c * .3) h / .45);
}
.tile[data-sky='one'] {
  --sky-0: oklch(from var(--_s) calc(l - .1) c h);
  --sky-1: oklch(from var(--_s) calc(l + .12) c calc(h + 8));
  --sky-glow: oklch(from var(--_s) .93 calc(c * .3) h / .45);
}
.tile[data-sky='two'] { --sky-0: var(--_s); --sky-1: var(--_s2); --sky-glow: #ffffff30; }
`;

/**
 * One sheet per document, because a constructed sheet can't cross documents and a
 * mascot can be moved into an iframe. Each remembers its CSS, so a registration
 * rewrites it only when the CSS changed.
 */
const sheets = new WeakMap<Document, { sheet: CSSStyleSheet; css: string }>();

/** After the materials, so that on a sky these win. */
const skyCss = String.raw`
.tile[data-sky] { --halo: #fff; --halo-a: .55; --edge: #fff; --edge-a: .5; }
`;

function fullCss(): string {
  return `${baseCss}${fxCss}${simpleCss}@supports (color: oklch(from red l c h)) {${paletteCss}${fxPaletteCss}${glowCss}${frostCss}${glassCss}${skyCss}${simplePaletteCss}}${forcedCss}${registeredCss()}`;
}

/**
 * Attach the styles to a shadow root, and refresh them when accessories have
 * registered since. Mascots in one document share a constructed sheet; without
 * constructed sheets, each root gets a `<style>` element.
 */
export function applyStyles(root: ShadowRoot): void {
  const css = fullCss();
  const doc = root.ownerDocument;
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (view && 'adoptedStyleSheets' in view.Document.prototype && 'replaceSync' in view.CSSStyleSheet.prototype) {
    let entry = sheets.get(doc);
    if (!entry) sheets.set(doc, (entry = { sheet: new view.CSSStyleSheet(), css: '' }));
    if (entry.css !== css) entry.sheet.replaceSync((entry.css = css));
    if (!root.adoptedStyleSheets.includes(entry.sheet)) root.adoptedStyleSheets = [entry.sheet];
    return;
  }
  let style = root.querySelector('style');
  if (!style) {
    style = doc.createElement('style');
    // A strict CSP allows an inline style only with the page's nonce.
    style.nonce = doc.querySelector<HTMLElement>('[nonce]')?.nonce ?? '';
    root.prepend(style);
  }
  if (style.textContent !== css) style.textContent = css;
  // No sheet means the page's CSP blocked it. An unstyled mascot must not take over the page.
  if (!style.sheet) (root.host as HTMLElement).style.cssText += 'display:inline-block;width:240px;height:240px;overflow:hidden';
}
