import type { Geometry, ShapeDefinition } from './types.js';

const MAX_PATH_LENGTH = 20_000;

/** A command other than moveto, or the third number of a moveto, which is an implicit lineto. */
const DRAWS = /[ac-dhlqstvz]|\d[\s,]+[-+.\d]+[\s,]+[-+.\d]/i;
const CHARACTERS = /^[\s\d.,+\-acehlmqstvz]+$/i;

/**
 * Whether `d` is well-formed SVG path data that draws something. Browsers render an
 * invalid path up to the first error, hiding the mistake as a clipped body, so this
 * asks the same parser that will draw it. Outside a browser nothing is drawn, and
 * the characters are all that is worth checking.
 */
export function isValidPath(d: unknown): d is string {
  return (
    typeof d === 'string' &&
    d.length <= MAX_PATH_LENGTH &&
    DRAWS.test(d) &&
    (typeof CSS === 'undefined' ? CHARACTERS.test(d) : CSS.supports('clip-path', `path("${d.replace(/[\t\n\f\r]/g, ' ')}")`))
  );
}

let pen: CanvasRenderingContext2D | null | undefined;

/**
 * Hit-tests raw path data. Canvas parses the path itself, with no layout, so the answer is
 * the same whether the mascot is shown, hidden or detached. Null outside a browser.
 */
export function hitTest(d: string): ((x: number, y: number) => boolean) | null {
  if (pen === undefined) pen = typeof Path2D === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  const ctx = pen;
  if (!ctx) return null;
  const path = new Path2D(d);
  return (x, y) => ctx.isPointInPath(path, x, y);
}

/**
 * The height of a shape's top edge at `x`, stretched as the body is. Accessories that sit on
 * the head use it, so a crown or a pair of horns lands on a star's shoulder or a heart's lobe
 * rather than floating at the height of its highest point.
 */
export function topAt(shape: ShapeDefinition): (g: Geometry, x: number) => number {
  const inside = hitTest(shape.path);
  return (g, x) => {
    let y = shape.top;
    const rawX = 120 + ((x - 120) * shape.halfWidth) / g.half;
    if (inside) while (y < shape.bottom && !inside(rawX, y)) y += 1;
    return g.bottom - ((shape.bottom - y) * g.hh) / ((shape.bottom - shape.top) / 2);
  };
}
