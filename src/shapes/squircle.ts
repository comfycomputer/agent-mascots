import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

const squircle: BuiltinShapeOptions = {
  path: 'M120 68C166 68 178 80 178 124C178 168 166 180 120 180C74 180 62 168 62 124C62 80 74 68 120 68Z',
  eyes: { y: 126, w: 20, h: 24, gap: 19, square: true },
  top: 68,
  bottom: 180,
  halfWidth: 58,
  shine: [100, 86, 30, 9],
  smooth: true,
};
defineShape('squircle', squircle);
