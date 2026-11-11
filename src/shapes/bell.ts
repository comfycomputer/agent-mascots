import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

const bell: BuiltinShapeOptions = {
  path: 'M120 62C157 62 180 88 180 118C180 131 173 136 165 133C157 138 150 132 142 136C134 141 127 134 120 138C113 134 106 141 98 136C90 132 83 138 75 133C67 136 60 131 60 118C60 88 83 62 120 62Z',
  eyes: { y: 104, w: 15, h: 26, gap: 15 },
  top: 62,
  bottom: 140,
  halfWidth: 60,
  shine: [100, 80, 22, 9],
  accessories: 'tentacles',
  floatScale: 1.5,
  simplePath:
    'M120 50C160 50 188 82 188 124C188 136 178 140 168 136V172Q168 180 160 180Q152 180 152 172V138H130V184Q130 192 120 192Q110 192 110 184V138H88V172Q88 180 80 180Q72 180 72 172V136C62 140 52 136 52 124C52 82 80 50 120 50Z',
  simpleFace: [98, 28, 112],
};
defineShape('bell', bell);
