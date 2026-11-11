import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

const cap: BuiltinShapeOptions = {
  path: 'M58 118C58 80 86 56 120 56C154 56 182 80 182 118C182 132 168 138 120 138C72 138 58 132 58 118Z',
  eyes: { y: 104, w: 15, h: 26, gap: 16 },
  top: 56,
  bottom: 138,
  halfWidth: 62,
  shine: [96, 74, 22, 8],
  accessories: 'stem spots',
  smooth: true,
  simplePath:
    'M120 50C166 50 196 86 196 116C196 130 180 134 148 134V176Q148 190 134 190H106Q92 190 92 176V134C60 134 44 130 44 116C44 86 74 50 120 50Z',
  simpleFace: [98, 30, 113],
};
defineShape('cap', cap);
