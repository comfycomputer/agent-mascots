export type AttrValue = string | number | null | undefined;
export type Attrs = Record<string, AttrValue>;

const NS = 'http://www.w3.org/2000/svg';

/** Round for attribute strings: shorter DOM writes, and stable values for change detection. */
export const fix = (n: number): number => Math.round(n * 100) / 100;

/**
 * Set attributes; null or undefined removes the attribute. An unchanged value is
 * skipped, because browsers repaint for a write even when it changes nothing.
 */
export function set<E extends Element>(el: E, attrs: Attrs): E {
  for (const name in attrs) {
    const value = attrs[name];
    if (value == null) el.removeAttribute(name);
    else if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value));
  }
  return el;
}

/** Create an SVG element. Nodes are always built with the DOM API, never from markup. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  if (attrs) set(el, attrs);
  el.append(...children);
  return el;
}

/** A transform that applies `transform` around the point (x, y). */
export const about = (x: number, y: number, transform: string): string =>
  `translate(${x} ${y}) ${transform} translate(${-x} ${-y})`;

/**
 * Gradient stops painted from CSS tokens, so colour never touches the SVG.
 * Set through the CSSOM: unlike a `style` attribute, that is allowed under a strict CSP.
 */
export function stops(...offsets: [offset: number, token: string, opacity?: number][]): SVGStopElement[] {
  return offsets.map(([offset, token, opacity]) => {
    const stop = svg('stop', { offset, 'stop-opacity': opacity });
    stop.style.setProperty('stop-color', `var(--${token}, var(--_c))`);
    return stop;
  });
}

/** Everything that filters or masks the body shares this generous region. */
export const REGION = { x: -40, y: -40, width: 320, height: 320 } as const;

export const filter = (id: string, ...primitives: SVGElement[]): SVGFilterElement =>
  svg('filter', { id, ...REGION, filterUnits: 'userSpaceOnUse' }, ...primitives);

/**
 * A glow outside the outline only. Drawn under a transparent body, a plain blur
 * would fill the interior, clouding glass and tinting frost's eye holes.
 */
export const outer = (id: string, stdDeviation: number, shift: SVGElement): SVGFilterElement =>
  filter(
    id,
    svg('feGaussianBlur', { stdDeviation }),
    set(shift, { result: 'b' }),
    svg('feComposite', { in: 'b', in2: 'SourceAlpha', operator: 'out' }),
  );

export const blur = (id: string, stdDeviation: number): SVGFilterElement =>
  filter(id, svg('feGaussianBlur', { stdDeviation }));

/**
 * An inner glow that follows the true outline, however many subpaths it has.
 * Blur the alpha, then keep the source only where the blur has faded.
 */
export const inset = (id: string, stdDeviation: number): SVGFilterElement =>
  filter(
    id,
    svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation, result: 'b' }),
    svg('feComposite', { in: 'SourceGraphic', in2: 'b', operator: 'out' }),
  );

export const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));
