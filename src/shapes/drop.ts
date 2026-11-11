import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/** A drop of water, its point drawn up as it falls. */
const drop: BuiltinShapeOptions = {
  path: 'M120 52C130 78 178 106 178 142C178 168 154 184 120 184C86 184 62 168 62 142C62 106 110 78 120 52Z',
  eyes: { y: 138, w: 16, h: 27, gap: 16 },
  top: 52,
  bottom: 184,
  halfWidth: 58,
  shine: [100, 112, 18, 9],
  floatScale: 1.2,
  simplePath: 'M120 34C134 70 182 102 182 144C182 174 156 192 120 192C84 192 58 174 58 144C58 102 106 70 120 34Z',
  simpleFace: [140, 26, 168],
};
defineShape('drop', drop);
