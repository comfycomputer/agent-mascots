import type { BuiltinShapeOptions } from './types.js';

/** The blob. Core ships this one body so an element always has something to draw. */
export const FALLBACK_BODY: BuiltinShapeOptions = {
  path: 'M120 68C146 68 164 84 171 108C178 133 181 151 176 164C169 179 149 182 120 182C91 182 71 179 64 164C59 151 62 133 69 108C76 84 94 68 120 68Z',
  eyes: { y: 130, w: 16, h: 28, gap: 15 },
  top: 68,
  bottom: 182,
  halfWidth: 60,
  shine: [104, 92, 22, 9],
  smooth: true,
};
