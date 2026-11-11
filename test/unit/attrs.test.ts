import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/index.js';
import { isColor, parseSky, PROPS, resolveAccessories, toAttribute } from '../../src/attrs.js';
import {
  MASCOT_ACCESSORIES,
  MASCOT_EYE_SHAPES,
  MASCOT_MATERIALS,
  MASCOT_MOODS,
  MASCOT_SHAPES,
} from '../../src/constants.js';
import { getAccessory, getShape } from '../../src/registry.js';

const shape = (name: string) => getShape(name) ?? expect.fail(`missing ${name}`);

describe('property table', () => {
  it('has unique attributes', () => {
    const attrs = Object.values(PROPS).map((spec) => spec.attr);
    expect(new Set(attrs).size).toBe(attrs.length);
  });

  it('covers every attribute in the spec', () => {
    const attrs = Object.values(PROPS).map((spec) => spec.attr);
    expect(attrs.toSorted()).toEqual(
      [
        'shape', 'material', 'color', 'accent', 'body-width', 'body-height', 'softness', 'accessories',
        'sky', 'shadow', 'size', 'detail', 'eye-shape', 'eye-width', 'eye-height', 'eye-spacing',
        'eye-y', 'eye-color', 'mood', 'level', 'motion', 'float', 'blink', 'glance', 'bounce', 'gaze',
        'track', 'track-reach', 'gyro', 'label',
      ].toSorted(),
    );
  });

  it('applies the documented defaults', () => {
    expect(PROPS.shape.read(null)).toBe('blob');
    expect(PROPS.material.read(null)).toBe('glow');
    expect(PROPS.color.read(null)).toBe('var(--mascot-color, #18c2a0)');
    expect(PROPS.accent.read(null)).toBe('var(--mascot-accent, #ffd84d)');
    expect(PROPS.softness.read(null)).toBe(0.4);
    expect(PROPS.sky.read(null)).toBe('none');
    expect(PROPS.shadow.read(null)).toBe('on');
    expect(PROPS.detail.read(null)).toBe('auto');
    expect(PROPS.mood.read(null)).toBe('idle');
    expect(PROPS.level.read(null)).toBeNull();
    expect(PROPS.motion.read(null)).toBe(1);
    expect(PROPS.track.read(null)).toBe('self');
    expect(PROPS.trackReach.read(null)).toBe(2);
    expect(PROPS.gyro.read(null)).toBe(false);
  });

  it('clamps numbers to their ranges', () => {
    expect(PROPS.bodyWidth.read('9')).toBe(1.4);
    expect(PROPS.bodyHeight.read('0')).toBe(0.6);
    expect(PROPS.eyeWidth.read('0.1')).toBe(0.3);
    expect(PROPS.eyeHeight.read('3')).toBe(2.5);
    expect(PROPS.eyeSpacing.read('9')).toBe(2);
    expect(PROPS.eyeY.read('-5')).toBe(-1);
    expect(PROPS.motion.read('5')).toBe(2);
    expect(PROPS.level.read('2')).toBe(1);
  });

  it('reads booleans from presence', () => {
    expect(PROPS.gyro.read('')).toBe(true);
  });
});

describe('unknown values', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fall back to the default with one warning per value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(PROPS.material.read('wood')).toBe('glow');
    expect(PROPS.material.read('wood')).toBe('glow');
    expect(PROPS.bodyWidth.read('wide')).toBe(1);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('falls back on an unknown shape', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(PROPS.shape.read('dodecahedron')).toBe('blob');
  });
});

describe('toAttribute', () => {
  it('maps property values to attribute strings', () => {
    expect(toAttribute(null)).toBeNull();
    expect(toAttribute(undefined)).toBeNull();
    expect(toAttribute(false)).toBeNull();
    expect(toAttribute(true)).toBe('');
    expect(toAttribute(0)).toBe('0');
    expect(toAttribute(['a', 'b'])).toBe('a b');
  });
});

describe('resolveAccessories', () => {
  it('uses the shape defaults', () => {
    expect(resolveAccessories(null, shape('cap'), 'glow')).toEqual(['stem', 'spots']);
    expect(resolveAccessories(null, shape('bell'), 'frost')).toEqual(['tentacles']);
    expect(resolveAccessories(null, shape('blob'), 'glow')).toEqual([]);
  });

  it('adds the glass defaults only when nothing was asked for', () => {
    expect(resolveAccessories(null, shape('blob'), 'glass')).toEqual(['iridescent', 'outline']);
    expect(resolveAccessories('ears', shape('blob'), 'glass')).toEqual(['ears']);
  });

  it('honours none and removes duplicates', () => {
    expect(resolveAccessories('none', shape('cap'), 'glow')).toEqual([]);
    expect(resolveAccessories('ears ears', shape('blob'), 'glow')).toEqual(['ears']);
  });

  it('drops unknown names', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveAccessories('ears cape', shape('blob'), 'glow')).toEqual(['ears']);
  });
});

describe('parseSky', () => {
  it('parses each form', () => {
    expect(parseSky('none')).toEqual(['none']);
    expect(parseSky('auto')).toEqual(['auto']);
    expect(parseSky('tomato')).toEqual(['one', 'tomato']);
    expect(parseSky('#111, #222')).toEqual(['two', '#111', '#222']);
  });

  it('keeps commas inside colour functions', () => {
    expect(parseSky('rgb(1, 2, 3), hsl(10, 20%, 30%)')).toEqual(['two', 'rgb(1, 2, 3)', 'hsl(10, 20%, 30%)']);
    expect(parseSky('var(--a, #000)')).toEqual(['one', 'var(--a, #000)']);
  });
});

describe('public lists', () => {
  it('match the spec', () => {
    expect(MASCOT_SHAPES).toHaveLength(16);
    expect(MASCOT_ACCESSORIES).toHaveLength(24);
    expect(MASCOT_MATERIALS).toEqual(['glow', 'frost', 'glass']);
    expect(MASCOT_EYE_SHAPES).toEqual(['auto', 'pill', 'round', 'square', 'dot', 'oval', 'slit', 'bar', 'big']);
    expect(MASCOT_MOODS).toHaveLength(9);
  });

  it('are all registered by the full entry', () => {
    for (const name of MASCOT_SHAPES) expect(getShape(name), name).toBeDefined();
    for (const name of MASCOT_ACCESSORIES) expect(getAccessory(name), name).toBeDefined();
  });
});

describe('strict values', () => {
  it('rejects numbers with trailing junk or a blank', () => {
    expect(PROPS.motion.read('1.5garbage')).toBe(1);
    expect(PROPS.softness.read('0.7px')).toBe(0.4);
    expect(PROPS.size.read('50%')).toBeNull();
    expect(PROPS.motion.read('  ')).toBe(1);
    expect(PROPS.motion.read(' 1.5 ')).toBe(1.5);
  });

  it('treats a negative size as a mistake, not as zero', () => {
    expect(PROPS.size.read('-5')).toBeNull();
    expect(PROPS.size.read('0')).toBe(0);
  });

  it('accepts no more than two sky colours', () => {
    expect(parseSky('red, blue, green')).toEqual(['none']);
    expect(PROPS.sky.read('red, blue, green')).toBe('none');
    expect(PROPS.sky.read('red, blue')).toBe('red, blue');
  });

  it('keeps anything that could fetch out of a colour', () => {
    for (const value of [
      'url(http://x/a.svg#a)',
      'var(--n, url(http://x/a.svg#a))',
      'var(--n, URL(http://x/a.svg#a))',
      'var(--n, ur\\6c(http://x/a.svg#a))',
      'var(--n, image-set("x"))',
      'var(--a, var(--b, src("x")))',
    ]) {
      expect(isColor(value), value).toBe(false);
    }
    for (const value of [
      'red',
      '#123',
      'var(--brand)',
      'var(--brand, #123)',
      'var(--a, var(--b, rgb(1 2 3)))',
      'color-mix(in srgb, var(--x), red)',
      'oklch(from var(--x) l c h)',
      'light-dark(#000, #fff)',
    ]) {
      expect(isColor(value), value).toBe(true);
    }
  });
});
