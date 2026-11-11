import { fix } from '../dom.js';
import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

/** The flame with its tip leaning and its shoulders swelling, so it can flicker. */
function outline(lean: number, swell: number): string {
  const tip = (x: number) => fix(x + lean);
  const shoulder = (x: number) => fix(x + swell);
  const inner = (x: number) => fix(x - swell * 0.5);
  const notch = (x: number) => fix(x - swell);
  return `M${tip(117)} 46Q${tip(120)} 34 ${tip(123.5)} 46C${fix(130 + lean * 0.8)} 66 ${shoulder(154)} 76 ${shoulder(164)} 104C175 136 166 172 138 182C126 186 114 186 102 182C74 172 65 136 ${inner(77)} 106C83 94 ${inner(90)} 90 ${notch(96)} 78Q${notch(99)} 71 ${notch(101)} 78C103 86 107 92 113 92C110 76 ${fix(111 + lean * 0.5)} 62 ${tip(117)} 46Z`;
}

const flame: BuiltinShapeOptions = {
  path: outline(0, 0),
  eyes: { y: 142, w: 15, h: 26, gap: 15 },
  top: 40,
  bottom: 184,
  halfWidth: 52,
  shine: [97, 118, 11, 8],
  morph: (phase, amount) =>
    outline(
      (Math.sin(phase) * 3 + Math.sin(phase * 1.7) * 1.5) * 1.6 * amount,
      Math.sin(phase * 1.3) * 3 * amount,
    ),
  simplePath:
    'M128 44C134 72 168 88 178 122C188 160 162 192 120 192C78 192 52 160 62 122C68 102 80 96 90 78C96 92 102 98 110 98C106 80 112 60 128 44Z',
  simpleFace: [136, 26, 168],
};
defineShape('flame', flame);
