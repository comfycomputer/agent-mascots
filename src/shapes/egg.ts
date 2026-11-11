import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

const egg: BuiltinShapeOptions = {
  path: 'M120 66C151 66 177 101 179 135C181 167 157 185 120 185C83 185 59 167 61 135C63 101 89 66 120 66Z',
  eyes: { y: 132, w: 16, h: 28, gap: 16 },
  top: 66,
  bottom: 185,
  halfWidth: 59,
  shine: [101, 94, 21, 10],
  smooth: true,
  simplePath: 'M120 48C154 48 176 96 176 134C176 170 152 190 120 190C88 190 64 170 64 134C64 96 86 48 120 48Z',
  simpleFace: [122, 24, 158],
};
defineShape('egg', egg);
