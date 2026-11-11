// Turns a drawn outline into a `registerShape` definition: move the pole of inaccessibility to
// x=120 and fit within ±114, size the eyes from the inscribed radius, then convert Catmull-Rom to
// integer cubics. The first steps are in playground/draw.ts. The playground and the landing cameo
// both need them, and a share link carries
// only the anchors, so this has to accept anything.

import type { ShapeOptions, registerShape } from 'agent-mascots';

export const DRAWN_SHAPE = 'drawn';
export const ANCHOR_COUNT = 24;

export type Point = [number, number];
export type { ShapeOptions };

const CENTRE = 120;
const REACH = 114;
const SPAN = CENTRE * 2;
const SEARCH_GRID = 24;
const SEARCH_ROUNDS = 3;

const clamp = (value: number, least: number, most: number) => Math.min(most, Math.max(least, value));

function inside([x, y]: Point, outline: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]!;
    const [xj, yj] = outline[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance([x, y]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** How far a point is from the outline: positive inside, 0 outside. */
function clearance(point: Point, outline: Point[]): number {
  if (!inside(point, outline)) return 0;
  let least = Infinity;
  outline.forEach((anchor, i) => {
    least = Math.min(least, edgeDistance(point, anchor, outline[(i + 1) % outline.length]!));
  });
  return least;
}

/** The point furthest from every edge, by a grid search that narrows each round. */
function poleOfInaccessibility(outline: Point[]) {
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  let best = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, radius: 0 };

  for (let round = 0; round < SEARCH_ROUNDS; round += 1) {
    const stepX = (maxX - minX) / SEARCH_GRID;
    const stepY = (maxY - minY) / SEARCH_GRID;
    for (let i = 0; i <= SEARCH_GRID; i += 1) {
      for (let j = 0; j <= SEARCH_GRID; j += 1) {
        const x = minX + i * stepX;
        const y = minY + j * stepY;
        const radius = clearance([x, y], outline);
        if (radius > best.radius) best = { x, y, radius };
      }
    }
    [minX, maxX, minY, maxY] = [best.x - stepX, best.x + stepX, best.y - stepY, best.y + stepY];
  }
  return best;
}

/** Catmull-Rom through the anchors as cubic Béziers, closed, in integers. */
function toPath(anchors: Point[]): string {
  const at = (i: number) => anchors[((i % anchors.length) + anchors.length) % anchors.length]!;
  const parts = [`M${anchors[0]!.map(Math.round).join(' ')}`];
  anchors.forEach((point, i) => {
    const before = at(i - 1);
    const after = at(i + 1);
    const next = at(i + 2);
    const c1 = [point[0] + (after[0] - before[0]) / 6, point[1] + (after[1] - before[1]) / 6];
    const c2 = [after[0] - (next[0] - point[0]) / 6, after[1] - (next[1] - point[1]) / 6];
    parts.push(`C${[...c1, ...c2, ...after].map(Math.round).join(' ')}`);
  });
  return `${parts.join('')}Z`;
}

/**
 * `anchors` is a closed outline of `[x, y]` pairs. Returns options for `registerShape`, with the
 * eyes on the point furthest from every edge. That point moves to x = 120, because the library's
 * eyes have no x, and the outline is scaled to reach ±114 from it. Returns the normalised
 * anchors too, which are what a share link should carry.
 */
export function shapeFromAnchors(anchors: Point[]): { anchors: Point[]; options: ShapeOptions } {
  const pole = poleOfInaccessibility(anchors);
  const reach = Math.max(...anchors.flatMap(([x, y]) => [Math.abs(x - pole.x), Math.abs(y - pole.y)]));
  const scale = reach > 0 ? REACH / reach : 1;
  const fitted = anchors.map(([x, y]): Point => [
    Math.round(CENTRE + (x - pole.x) * scale),
    Math.round(CENTRE + (y - pole.y) * scale),
  ]);

  const ys = fitted.map(([, y]) => y);
  const halfWidth = Math.max(...fitted.map(([x]) => Math.abs(x - CENTRE)));
  const radius = pole.radius * scale;

  return {
    anchors: fitted,
    options: {
      path: toPath(fitted),
      eyes: {
        y: CENTRE,
        w: Math.round(clamp(radius * 0.3, 6, 22)),
        h: Math.round(clamp(radius * 0.55, 10, 40)),
        gap: Math.round(clamp(radius * 0.32, 6, 26)),
      },
      top: Math.min(...ys),
      bottom: Math.max(...ys),
      halfWidth,
      accessories: 'none',
    },
  };
}

/** Register the drawn shape. False if the outline can't make one, which only a bad link should do. */
export function registerDrawn(anchors: Point[], register: typeof registerShape): boolean {
  try {
    register(DRAWN_SHAPE, shapeFromAnchors(anchors).options);
    return true;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

export const clampAnchor = (n: number) => clamp(Math.round(n), 0, SPAN);
