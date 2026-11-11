import { fix } from '../dom.js';
import { defineShape } from '../registry.js';
import type { BuiltinShapeOptions } from '../types.js';

const HEM = [172, 146, 120, 94, 68] as const;

/** A dome with a scalloped hem. A wave along the hem makes it ripple. */
function outline(phase: number, amount: number): string {
  const hem = (i: number) => 164 + Math.sin(phase + i * 1.25) * 3.5 * amount;
  let d = `M68 112C68 80 88 56 120 56C152 56 172 80 172 112V${fix(hem(0))}`;
  for (let i = 1; i < HEM.length; i++) {
    const mid = ((HEM[i - 1] as number) + (HEM[i] as number)) / 2;
    d += `Q${mid} ${fix(Math.max(hem(i - 1), hem(i)) + 16)} ${HEM[i]} ${fix(hem(i))}`;
  }
  return `${d}Z`;
}

const ghost: BuiltinShapeOptions = {
  path: outline(0, 0),
  eyes: { y: 108, w: 16, h: 28, gap: 16 },
  top: 56,
  bottom: 182,
  halfWidth: 52,
  shine: [100, 78, 24, 10],
  accessories: 'arms',
  morph: outline,
  simplePath:
    'M54 116C54 76 82 48 120 48C158 48 186 76 186 116V176C186 192 172 192 164 180C156 170 148 172 142 182C134 192 106 192 98 182C92 172 84 170 76 180C68 192 54 192 54 176Z',
  simpleFace: [104, 26, 146],
};
defineShape('ghost', ghost);
