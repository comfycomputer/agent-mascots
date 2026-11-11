import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/** A chubby five-pointed star, every point and notch rounded off. */
const star: BuiltinShapeOptions = {
  path: 'M112.9 70.7Q120 60 127.1 70.7L138.3 87.8Q143.5 95.6 152.6 98.1L172.3 103.6Q184.7 107 176.7 117L163.9 133Q158 140.4 158.5 149.7L159.4 170.2Q160 183 148 178.5L128.8 171.3Q120 168 111.2 171.3L92 178.5Q80 183 80.6 170.2L81.5 149.7Q82 140.4 76.1 133L63.3 117Q55.3 107 67.7 103.6L87.4 98.1Q96.5 95.6 101.7 87.8Z',
  eyes: { y: 128, w: 14, h: 24, gap: 14 },
  top: 65,
  bottom: 180,
  halfWidth: 62,
  shine: [106, 96, 14, 7],
  accessories: 'sheen',
  simplePath: 'M120 34L146 94L200 98L158 138L172 194L120 164L68 194L82 138L40 98L94 94Z',
  simpleFace: [124, 22, 150],
};
defineShape('star', star);
