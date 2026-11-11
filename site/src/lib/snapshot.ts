// A still picture of a mascot as it is drawn right now: its shadow DOM, drawn into an SVG image
// and painted onto a canvas. Nothing leaves the device and nothing needs a server. The landing's
// preset pictures and the playground's downloads both use it.

/**
 * The colours the element writes on its tile, and the ones a page may set. Copied resolved, since
 * the page's own tokens stay behind.
 */
const PAINT = ['--_c', '--_a', '--_e', '--_s', '--_s2', '--mascot-radius', '--mascot-cue'];

const XHTML = 'http://www.w3.org/1999/xhtml';

/** Every rule in the mascot's shadow root. The same for every mascot, so callers may keep it. */
export const stylesOf = (root: ShadowRoot): string =>
  [...root.adoptedStyleSheets, ...[...root.querySelectorAll('style')].flatMap((style) => (style.sheet ? [style.sheet] : []))]
    .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
    .join('\n');

/** The tile a mascot is drawn on, or null before it has drawn. */
export const tileOf = (el: HTMLElement): HTMLElement | null => el.shadowRoot?.querySelector<HTMLElement>('.tile') ?? null;

/** An XHTML element for a picture, which has to serialise as XML. */
export function xhtml(tag: string, style?: string): HTMLElement {
  const el = document.createElementNS(XHTML, tag) as HTMLElement;
  if (style) el.setAttribute('style', style);
  return el;
}

/** A copy of the mascot's tile, with its colours resolved. */
export function copyTile(el: HTMLElement): HTMLElement {
  const tile = tileOf(el);
  if (!tile) throw new Error('The mascot has not drawn yet');
  const copy = tile.cloneNode(true) as HTMLElement;
  const computed = getComputedStyle(tile);
  for (const name of PAINT) copy.style.setProperty(name, computed.getPropertyValue(name));
  return copy;
}

/**
 * `box`, `width` by `height` CSS pixels, as markup for an SVG image `pixels` wide, with the
 * mascot's `css` inside it.
 */
export function pictureOf(box: HTMLElement, css: string, width: number, height: number, pixels = width): string {
  const style = xhtml('style');
  style.textContent = css;
  box.prepend(style);
  const body = new XMLSerializer().serializeToString(box);
  const scale = pixels / width;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${Math.round(height * scale)}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject width="${width}" height="${height}">${body}</foreignObject></svg>`
  );
}

/** The mascot alone, as markup for an SVG image of `width` by `height` CSS pixels, at `density`. */
export function frameOf(el: HTMLElement, css: string, width: number, height: number, density: number): string {
  const box = xhtml('div', `position:relative;width:${width}px;height:${height}px`);
  box.append(copyTile(el));
  return pictureOf(box, css, width, height, width * density);
}

export async function imageOf(markup: string): Promise<HTMLImageElement> {
  const image = new Image();
  // A data URL: a blob URL would taint the canvas in Chromium, and toBlob would be refused.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  return image;
}

/** Paints the markup over the whole canvas. */
export async function paint(ctx: CanvasRenderingContext2D, markup: string): Promise<void> {
  ctx.drawImage(await imageOf(markup), 0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function canvasOf(px: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  return { canvas, ctx: canvas.getContext('2d')! };
}

export const blobOf = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Saves a blob as a download. */
export function save(blob: Blob, name: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

export const whenIdle = (timeout: number) =>
  new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 0);
  });
