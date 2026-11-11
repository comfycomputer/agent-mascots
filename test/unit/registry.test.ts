import { describe, expect, it, vi } from 'vitest';
import {
  fallbackShape,
  getAccessory,
  getShape,
  onRegistryChange,
  parseList,
  registerAccessory,
  registeredCss,
  defineShape,
  registerShape,
} from '../../src/registry.js';
import { isValidPath } from '../../src/path.js';

const eyes = { y: 120, w: 16, h: 28, gap: 15 };

describe('path validation', () => {
  it('without a browser, checks the characters and that something is drawn', () => {
    expect(isValidPath(fallbackShape.path)).toBe(true);
    expect(isValidPath('m 10,20 l 5 5 z')).toBe(true);
    expect(isValidPath('M1e2-.5A1 1 0 1 1 3 4Z')).toBe(true);
    for (const value of ['<svg>', 'url(x)', 'M1 1', '', null, 42, `M0 0L${'1 '.repeat(20_000)}`]) {
      expect(isValidPath(value)).toBe(false);
    }
  });
});

describe('registerShape', () => {
  it('registers with defaults', () => {
    registerShape('test-default', { path: 'M0 0L1 1Z', eyes });
    const shape = getShape('test-default');
    expect(shape).toMatchObject({ top: 60, bottom: 180, halfWidth: 60, floatScale: 1, smooth: false });
    expect(shape?.accessories).toEqual([]);
  });

  it('parses default accessories from a string or a list', () => {
    registerShape('test-list', { path: 'M0 0Z', eyes, accessories: 'ears  arms' });
    registerShape('test-array', { path: 'M0 0Z', eyes, accessories: ['ring'] });
    expect(getShape('test-list')?.accessories).toEqual(['ears', 'arms']);
    expect(getShape('test-array')?.accessories).toEqual(['ring']);
  });

  it('copies eyes, so later mutation cannot corrupt the shape', () => {
    const mine = { ...eyes };
    registerShape('test-copy', { path: 'M0 0Z', eyes: mine });
    mine.y = 999;
    expect(getShape('test-copy')?.eyes.y).toBe(120);
  });

  it.each([
    ['a bad name', '1bad', { path: 'M0 0Z', eyes }],
    ['a name with markup', '<x>', { path: 'M0 0Z', eyes }],
    ['a bad path', 'ok', { path: '<svg>', eyes }],
    ['no eyes', 'ok', { path: 'M0 0Z' }],
    ['non-finite eyes', 'ok', { path: 'M0 0Z', eyes: { ...eyes, y: Number.NaN } }],
    ['bottom above top', 'ok', { path: 'M0 0Z', eyes, top: 100, bottom: 50 }],
    ['a non-finite shine', 'ok', { path: 'M0 0Z', eyes, shine: [1, 2, 3, Number.POSITIVE_INFINITY] }],
    ['a short shine', 'ok', { path: 'M0 0Z', eyes, shine: [1, 2] }],
    ['a missing name', undefined, { path: 'M0 0Z', eyes }],
    ['missing options', 'ok', undefined],
    ['a zero eye gap', 'ok', { path: 'M0 0Z', eyes: { ...eyes, gap: 0 } }],
    ['a negative eye width', 'ok', { path: 'M0 0Z', eyes: { ...eyes, w: -1 } }],
  ])('throws on %s', (_label, name, options) => {
    expect(() => registerShape(name as string, options as never)).toThrow(TypeError);
    expect(getShape('ok')).toBeUndefined();
  });

  it('copies the shine, too', () => {
    const shine: [number, number, number, number] = [1, 2, 3, 4];
    registerShape('test-shine', { path: 'M0 0Z', eyes, shine });
    shine[0] = 999;
    expect(getShape('test-shine')?.shine).toEqual([1, 2, 3, 4]);
  });

  it('validates the value it stores, even from a getter', () => {
    let reads = 0;
    const options = {
      eyes,
      get path() {
        return reads++ === 0 ? 'M0 0Z' : '<svg>';
      },
    };
    registerShape('test-getter', options);
    expect(getShape('test-getter')?.path).toBe('M0 0Z');
  });

  it('keeps the options of built-in shapes from the public API', () => {
    registerShape('test-builtin', { path: 'M0 0Z', eyes, smooth: true, simplePath: 'bad' } as never);
    const shape = getShape('test-builtin');
    expect(shape?.smooth).toBe(false);
    expect(shape?.simplePath).toBeUndefined();
  });

  it('validates a built-in shape\'s simple path', () => {
    expect(() => defineShape('test-simple', { path: 'M0 0Z', eyes, simplePath: '<svg>' })).toThrow(TypeError);
  });

  it('lets a shape replace itself, so hot reloads do not throw', () => {
    registerShape('test-reload', { path: 'M0 0Z', eyes });
    registerShape('test-reload', { path: 'M1 1Z', eyes });
    expect(getShape('test-reload')?.path).toBe('M1 1Z');
  });

  it('treats names as data, not object keys', () => {
    registerShape('constructor', { path: 'M0 0Z', eyes });
    expect(getShape('toString')).toBeUndefined();
  });
});

describe('fallback', () => {
  it('always resolves the blob, even with nothing registered', () => {
    expect(getShape('blob')).toBeDefined();
    expect(fallbackShape.name).toBe('blob');
  });
});

describe('accessories', () => {
  it('collects CSS once per distinct string', () => {
    const css = '.shared{}';
    registerAccessory('a1', { css, build: () => ({ layout() {} }) });
    registerAccessory('a2', { css, build: () => ({ layout() {} }) });
    expect(registeredCss().split(css)).toHaveLength(2);
    expect(getAccessory('a1')).toBeDefined();
  });
});

describe('onRegistryChange', () => {
  it('notifies until unsubscribed', () => {
    const listener = vi.fn();
    const off = onRegistryChange(listener);
    registerShape('test-notify', { path: 'M0 0Z', eyes });
    off();
    registerShape('test-notify-2', { path: 'M0 0Z', eyes });
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('parseList', () => {
  it('handles strings, arrays and nothing', () => {
    expect(parseList(' a  b ')).toEqual(['a', 'b']);
    expect(parseList(['a'])).toEqual(['a']);
    expect(parseList(null)).toEqual([]);
  });
});
