import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/**
 * The outline of five puffs, with the goo filter melting its joins. One outline rather than five
 * circles, so that a stroke of it follows only the outside.
 */
const cloud: BuiltinShapeOptions = {
  path: 'M76.1 102A38 38 0 0 1 147.5 86.1A34 34 0 0 1 175.1 147.1A27 27 0 0 1 129.9 175.1A30 30 0 0 1 76.4 162A30 30 0 1 1 76.1 102Z',
  eyes: { y: 133, w: 16, h: 28, gap: 14 },
  top: 66,
  bottom: 187,
  halfWidth: 74,
  shine: [100, 86, 26, 10],
  simplePath:
    'M116 62C138 62 154 76 158 94C178 94 196 110 196 132C196 156 178 172 156 172H76C58 172 44 156 44 136C44 116 58 102 76 102C80 78 96 62 116 62Z',
  simpleFace: [122, 28, 150],
};
defineShape('cloud', cloud);
