// Draw: a closed stroke becomes the outline of a shape. The first steps are here: close the stroke
// and reject tiny ones, then resample to 24 anchors and smooth twice. The rest is shared with the
// landing cameo, in src/lib/drawn-shape.ts.

import { ANCHOR_COUNT, type Point } from '../lib/drawn-shape';

const SMOOTHING_PASSES = 2;
const MIN_SPAN = 64;
const MIN_FILL = 0.12; // Of its bounding box: below this it's a line or a scribble, not a body.

function resample(points: Point[]): Point[] {
  const closed = [...points, points[0]!];
  const lengths = closed.slice(1).map((point, i) => Math.hypot(point[0] - closed[i]![0], point[1] - closed[i]![1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const spacing = total / ANCHOR_COUNT;
  const out: Point[] = [];
  let walked = 0;
  let index = 0;
  for (let n = 0; n < ANCHOR_COUNT; n += 1) {
    const wanted = n * spacing;
    while (index < lengths.length - 1 && walked + lengths[index]! < wanted) walked += lengths[index++]!;
    const t = lengths[index] ? (wanted - walked) / lengths[index]! : 0;
    const [a, b] = [closed[index]!, closed[index + 1]!];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function smooth(points: Point[]): Point[] {
  return points.map((point, i) => {
    const before = points.at(i - 1)!;
    const after = points[(i + 1) % points.length]!;
    return [(before[0] + point[0] * 2 + after[0]) / 4, (before[1] + point[1] * 2 + after[1]) / 4];
  });
}

function fillRatio(points: Point[]): number {
  let area = 0;
  points.forEach(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length]!;
    area += x * ny - nx * y;
  });
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  return box ? Math.abs(area / 2) / box : 0;
}

/** The outline a stroke makes, or null when it's too small or too thin to be a body. */
export function outlineOf(stroke: Point[]): Point[] | null {
  const xs = stroke.map(([x]) => x);
  const ys = stroke.map(([, y]) => y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (span < MIN_SPAN || fillRatio(stroke) < MIN_FILL) return null;
  return Array.from({ length: SMOOTHING_PASSES }).reduce<Point[]>(smooth, resample(stroke));
}

/** A random blobby outline, for when drawing one isn't the point. */
export function surpriseOutline(): Point[] {
  const seed = Array.from({ length: 5 }, () => [Math.random() * 6.28, 0.12 + Math.random() * 0.22, 2 + Math.floor(Math.random() * 3)] as const);
  const points = Array.from({ length: ANCHOR_COUNT * 2 }, (_, i): Point => {
    const angle = (i / (ANCHOR_COUNT * 2)) * Math.PI * 2;
    const radius = 100 * seed.reduce((sum, [phase, amount, lobes]) => sum + Math.sin(angle * lobes + phase) * amount, 1);
    return [120 + Math.cos(angle) * radius, 120 + Math.sin(angle) * radius];
  });
  return Array.from({ length: SMOOTHING_PASSES }).reduce<Point[]>(smooth, resample(points));
}
