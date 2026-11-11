import { describe, expect, it } from 'vitest';
import { MASCOT_SHAPES } from '../../src/constants.js';
import { isValidPath } from '../../src/path.js';
import { getShape } from '../../src/registry.js';
import '../../src/shapes/bell.js';
import '../../src/shapes/blob.js';
import '../../src/shapes/cap.js';
import '../../src/shapes/cloud.js';
import '../../src/shapes/egg.js';
import '../../src/shapes/flame.js';
import '../../src/shapes/gem.js';
import '../../src/shapes/ghost.js';
import '../../src/shapes/orb.js';
import '../../src/shapes/squircle.js';
import '../../src/shapes/bean.js';
import '../../src/shapes/drop.js';
import '../../src/shapes/star.js';
import '../../src/shapes/heart.js';
import '../../src/shapes/mochi.js';
import '../../src/shapes/cat.js';

describe.each(MASCOT_SHAPES)('built-in shape %s', (name) => {
  it('passes the strict validator', () => {
    const shape = getShape(name);
    expect(shape).toBeDefined();
    expect(isValidPath(shape?.path)).toBe(true);
    if (shape?.simplePath) expect(isValidPath(shape.simplePath)).toBe(true);
  });

  it('has one outline, so a stroke of it follows only the outside', () => {
    expect(getShape(name)?.path.match(/M/gi)).toHaveLength(1);
  });
});

describe.each(['flame', 'ghost'])('animated outline of %s', (name) => {
  const shape = () => getShape(name);

  it('rests exactly on the static path', () => {
    expect(shape()?.morph?.(1.3, 0)).toBe(shape()?.path);
  });

  it('stays valid and changes as it moves', () => {
    const frames = Array.from({ length: 24 }, (_, i) => shape()?.morph?.(i * 0.4, 1) ?? '');
    for (const d of frames) expect(isValidPath(d)).toBe(true);
    expect(new Set(frames).size).toBeGreaterThan(20);
  });
});

it('keeps a hand-tuned small silhouette where it reads better than the fitted outline', () => {
  for (const name of ['egg', 'flame', 'cloud', 'ghost', 'gem', 'bell', 'cap', 'drop', 'star', 'heart', 'cat']) {
    expect(getShape(name)?.simplePath).toBeTruthy();
  }
});
