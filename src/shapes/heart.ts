import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/** A plump heart, its point softened so it sits like a body rather than a symbol. */
const heart: BuiltinShapeOptions = {
  path: 'M120 90C110 70 64 66 60 106C57 136 92 160 114 178Q120 183 126 178C148 160 183 136 180 106C176 66 130 70 120 90Z',
  eyes: { y: 120, w: 15, h: 26, gap: 17 },
  top: 74,
  bottom: 181,
  halfWidth: 60,
  shine: [88, 92, 13, 7],
  accessories: 'blush',
  simplePath: 'M120 78C106 46 40 44 40 102C40 140 88 170 120 194C152 170 200 140 200 102C200 44 134 46 120 78Z',
  simpleFace: [114, 26, 146],
};
defineShape('heart', heart);
