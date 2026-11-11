import { fix } from '../dom.js';
import type { EyeBox, EyePose } from '../types.js';

/** Control point distance for a quarter circle as a cubic Bezier. */
const K = 0.5523;

/**
 * One eye outline, centred on the origin. A single path covers every expression,
 * so moods morph continuously: `open` closes it to a thin bar, and `arc` bends it
 * along a parabola into a happy arch or a sad droop.
 */
export function eyePath(box: EyeBox, open: number, arc: number): string {
  // Arched eyes spread a little wider, as cheeks do in a smile.
  const hw = (box.w / 2) * (1 + Math.abs(arc) * 0.3);
  const hh = Math.max(Math.min(box.w, box.h) * 0.13, (box.h / 2) * open);
  // A circular corner keeps the ends round when the eye narrows or bends.
  const r = Math.min(box.r, hw, hh);
  const a = hw - r;
  const b = hh - r;
  const bend = arc * box.w * 0.55;
  const lift = (x: number) => -bend * (1 - (x / hw) ** 2);
  const pt = (x: number, y: number) => `${fix(x)} ${fix(y + lift(x))}`;
  // Where the straight top and bottom edges meet the corners; a quadratic through
  // the tangents' intersection follows the same parabola exactly.
  const edge = (y: number) => `0 ${fix(y - bend * (1 + (a / hw) ** 2))}`;
  const c = r * K;
  return (
    `M${pt(-a, -hh)}Q${edge(-hh)} ${pt(a, -hh)}` +
    `C${pt(a + c, -hh)} ${pt(hw, -b - c)} ${pt(hw, -b)}` +
    `L${pt(hw, b)}` +
    `C${pt(hw, b + c)} ${pt(a + c, hh)} ${pt(a, hh)}` +
    `Q${edge(hh)} ${pt(-a, hh)}` +
    `C${pt(-a - c, hh)} ${pt(-hw, b + c)} ${pt(-hw, b)}` +
    `L${pt(-hw, -b)}` +
    `C${pt(-hw, -b - c)} ${pt(-a - c, -hh)} ${pt(-a, -hh)}Z`
  );
}

/** A cache key for an eye pose, so unchanged eyes skip the DOM write. */
export const eyeKey = (pose: EyePose): string =>
  `${fix(pose.open)} ${fix(pose.arc)} ${fix(pose.tilt)}`;
