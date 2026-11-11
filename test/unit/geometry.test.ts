import { describe, expect, it } from 'vitest';
import '../../src/index.js';
import { MASCOT_SHAPES } from '../../src/constants.js';
import { isValidPath } from '../../src/path.js';
import { getShape } from '../../src/registry.js';
import { eyePath } from '../../src/render/eyes.js';
import { computeGeometry, eyeBox } from '../../src/render/geometry.js';
import type { MascotConfig } from '../../src/types.js';

function config(overrides: Partial<MascotConfig> = {}): MascotConfig {
  return {
    shape: getShape('blob') ?? expect.fail('no blob'),
    material: 'glow',
    bodyWidth: 1,
    bodyHeight: 1,
    softness: 0.4,
    accessories: [],
    eyeShape: 'auto',
    eyeWidth: 1,
    eyeHeight: 1,
    eyeSpacing: 1,
    eyeY: 0,
    shadow: true,
    ...overrides,
  };
}

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const skeleton = (d: string) => d.replace(/[-\d.\s]+/g, ' ');
const top = (d: string) => Math.min(...numbers(d).filter((_, i) => i % 2 === 1));

describe('computeGeometry', () => {
  it('stretches up from the base', () => {
    const plain = computeGeometry(config());
    const tall = computeGeometry(config({ bodyHeight: 1.4 }));
    expect(tall.bottom).toBe(plain.bottom);
    expect(tall.top).toBeLessThan(plain.top);
  });

  it('stretches sideways around the centre', () => {
    const wide = computeGeometry(config({ bodyWidth: 1.4 }));
    expect(wide.left + wide.right).toBeCloseTo(240);
    expect(wide.half).toBeCloseTo(84);
  });

  it('moves the ground for accessories that hang below', () => {
    const cap = getShape('cap') ?? expect.fail('no cap');
    const g = computeGeometry(config({ shape: cap, accessories: ['stem'] }));
    expect(g.ground).toBe(cap.bottom + 44);
  });

  it('keeps every composition inside the view', () => {
    for (const name of MASCOT_SHAPES) {
      const shape = getShape(name) ?? expect.fail(name);
      for (const accessories of [[], ['antenna'], ['ring'], ['rays'], ['stem'], ['tentacles', 'leaf']]) {
        const g = computeGeometry(config({ shape, accessories, bodyHeight: 1.4, bodyWidth: 1.4 }));
        expect(g.top - 16, `${name} ${accessories}`).toBeGreaterThanOrEqual(g.viewY - 40);
        expect(g.ground + 28).toBeLessThanOrEqual(g.viewY + g.viewSize + 1);
      }
    }
  });

  it('never shrinks the view below its minimum', () => {
    expect(computeGeometry(config()).viewSize).toBe(188);
  });

  it('maps softness to goo radius', () => {
    expect(computeGeometry(config({ softness: 0 })).goo).toBe(1.5);
    expect(computeGeometry(config({ softness: 1 })).goo).toBe(7);
  });
});

describe('eyeBox', () => {
  it('uses square eyes on the squircle by default', () => {
    const shape = getShape('squircle') ?? expect.fail('no squircle');
    const box = eyeBox(config({ shape }));
    expect(box.r).toBeLessThan(Math.min(box.w, box.h) / 2);
  });

  it('makes round and dot eyes circular', () => {
    for (const eyeShape of ['round', 'dot'] as const) {
      const box = eyeBox(config({ eyeShape }));
      expect(box.w).toBe(box.h);
      expect(box.r).toBe(box.w / 2);
    }
  });

  it('applies the multipliers', () => {
    const base = eyeBox(config());
    const scaled = eyeBox(config({ eyeWidth: 2, eyeHeight: 0.5, eyeSpacing: 1.5 }));
    expect(scaled.w).toBeCloseTo(base.w * 2);
    expect(scaled.h).toBeCloseTo(base.h * 0.5);
    expect(scaled.gap).toBeCloseTo(base.gap * 1.5);
  });
});

describe('eyePath', () => {
  const box = { w: 16, h: 28, r: 8, gap: 15 };

  it('is valid path data for every expression', () => {
    for (const open of [0, 0.3, 1, 1.2]) {
      for (const arc of [-1, -0.3, 0, 1]) {
        const d = eyePath(box, open, arc);
        expect(isValidPath(d), d).toBe(true);
        expect(d).not.toContain('NaN');
      }
    }
  });

  it('never collapses fully, so a closed eye stays visible', () => {
    const ys = numbers(eyePath(box, 0, 0)).filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2);
  });

  it('has the same structure in every pose, so poses interpolate', () => {
    expect(skeleton(eyePath(box, 1, 0))).toBe(skeleton(eyePath(box, 0.2, 1)));
  });

  it('bends upward for a positive arc', () => {
    expect(top(eyePath(box, 0.3, 1))).toBeLessThan(top(eyePath(box, 0.3, 0)));
  });
});
