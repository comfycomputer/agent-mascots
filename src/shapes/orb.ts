import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

const orb: BuiltinShapeOptions = {
  path: 'M120 66A56 56 0 1 1 120 178A56 56 0 1 1 120 66Z',
  eyes: { y: 120, w: 17, h: 29, gap: 16 },
  top: 66,
  bottom: 178,
  halfWidth: 56,
  shine: [102, 88, 24, 10],
  smooth: true,
};
defineShape('orb', orb);
