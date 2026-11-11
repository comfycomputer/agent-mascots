import { SIMPLE_MAX_WIDTH } from '../constants.js';
import type { DetailLevel, DetailSetting } from '../types.js';

/**
 * Pick the detail level for a rendered width. Returns null when `auto` has no
 * width to go on yet.
 */
export function pickLevel(
  setting: DetailSetting,
  width: number,
  current: DetailLevel | null,
): DetailLevel | null {
  if (setting !== 'auto') return setting;
  if (width <= 0) return current;
  return width <= SIMPLE_MAX_WIDTH ? 'simple' : 'full';
}
