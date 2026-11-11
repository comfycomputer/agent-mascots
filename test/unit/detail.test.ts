import { describe, expect, it } from 'vitest';
import { SIMPLE_MAX_WIDTH } from '../../src/constants.js';
import { pickLevel } from '../../src/render/detail.js';

describe('pickLevel', () => {
  it('puts the boundary at 64px', () => {
    expect(pickLevel('auto', SIMPLE_MAX_WIDTH, null)).toBe('simple');
    expect(pickLevel('auto', SIMPLE_MAX_WIDTH + 1, null)).toBe('full');
  });

  it('follows the boundary whatever the current level is', () => {
    expect(pickLevel('auto', SIMPLE_MAX_WIDTH + 1, 'simple')).toBe('full');
    expect(pickLevel('auto', SIMPLE_MAX_WIDTH, 'full')).toBe('simple');
    expect(pickLevel('auto', 70, 'simple')).toBe(pickLevel('auto', 70, null));
  });

  it('lets an explicit setting win at any width', () => {
    expect(pickLevel('full', 16, 'simple')).toBe('full');
    expect(pickLevel('simple', 400, 'full')).toBe('simple');
    expect(pickLevel('simple', 0, null)).toBe('simple');
  });

  it('keeps the current level with no width to go on', () => {
    expect(pickLevel('auto', 0, 'full')).toBe('full');
    expect(pickLevel('auto', 0, null)).toBeNull();
  });
});
