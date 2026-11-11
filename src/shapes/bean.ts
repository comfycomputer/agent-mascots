import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/** A jelly bean on its side: wider than tall, with a soft dip in the top. */
const bean: BuiltinShapeOptions = {
  path: 'M120 86C138 74 178 76 182 120C186 162 158 180 120 180C82 180 54 164 58 124C62 82 100 74 120 86Z',
  eyes: { y: 128, w: 16, h: 27, gap: 16 },
  top: 78,
  bottom: 180,
  halfWidth: 63,
  shine: [94, 98, 20, 8],
  smooth: true,
};
defineShape('bean', bean);
