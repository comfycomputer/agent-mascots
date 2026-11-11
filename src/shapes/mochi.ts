import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/** A wide, soft dumpling, settled flat under its own weight. */
const mochi: BuiltinShapeOptions = {
  path: 'M120 86C166 86 190 118 190 150C190 174 168 180 120 180C72 180 50 174 50 150C50 118 74 86 120 86Z',
  eyes: { y: 140, w: 15, h: 24, gap: 20 },
  top: 86,
  bottom: 180,
  halfWidth: 70,
  shine: [92, 104, 24, 8],
  floatScale: 0.8,
  smooth: true,
  accessories: 'blush',
};
defineShape('mochi', mochi);
