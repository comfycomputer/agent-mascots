import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

const gem: BuiltinShapeOptions = {
  path: 'M95 66H145Q149 66 151 69L175 96Q178 100 175 104L123 178Q120 182 117 178L65 104Q62 100 65 96L89 69Q91 66 95 66Z',
  eyes: { y: 120, w: 14, h: 24, gap: 15 },
  top: 66,
  bottom: 182,
  halfWidth: 58,
  shine: [104, 80, 22, 6],
  accessories: 'facets sheen',
  simplePath: 'M82 58H158L192 104L120 192L48 104Z',
  simpleFace: [104, 26, 138],
};
defineShape('gem', gem);
