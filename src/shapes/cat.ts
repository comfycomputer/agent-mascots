import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/** A round head with two pointed ears grown from it, so they melt in with the body. */
const cat: BuiltinShapeOptions = {
  path: 'M74 70Q78 66 83 70L102 88C114 85 126 85 138 88L157 70Q162 66 166 70C174 92 180 108 180 130C180 166 154 182 120 182C86 182 60 166 60 130C60 108 66 92 74 70Z',
  eyes: { y: 130, w: 16, h: 26, gap: 17 },
  top: 68,
  bottom: 182,
  halfWidth: 60,
  shine: [100, 100, 18, 7],
  accessories: 'whiskers',
  simplePath: 'M58 46L96 80C112 76 128 76 144 80L182 46C190 80 196 104 196 132C196 172 164 192 120 192C76 192 44 172 44 132C44 104 50 80 58 46Z',
  simpleFace: [128, 26, 158],
};
defineShape('cat', cat);
