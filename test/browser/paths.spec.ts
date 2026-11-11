import { expect, test } from '@playwright/test';

/** Paths go through the engine's own parser, so these run in every engine. */
const VALID: [string, string][] = [
  ['implicit linetos', 'M0 0 10 10 20 0'],
  ['packed numbers', 'M0 0L.5.5-1-1'],
  ['packed arc flags', 'M0 0a5 5 0 014 4z'],
  ['commas between arguments', 'M0,0L1,1,2,2Z'],
  ['commas and spaces', 'M 0 , 0 L 1 , 1 , 2 , 2'],
  ['drawing after a close', 'M0 0L1 1ZL2 2'],
  ['every command', 'M0 0m1 1L1 1l1 1H1h1V1v1C1 1 2 2 3 3c1 1 2 2 3 3S1 1 2 2s1 1 2 2Q1 1 2 2q1 1 2 2T1 1t1 1A1 1 0 0 0 1 1a1 1 0 1 1 1 1Zz'],
  ['every kind of whitespace', ' \t\n\f\rM0 0\tL1\n1\r '],
  ['signed exponents', 'M+1E+2 -1e-2L1 1'],
];

/**
 * Not listed, because engines differ and each draws what it accepts: a trailing comma and a
 * comma before a command (Chromium, WebKit), and an empty exponent (Firefox).
 */
const INVALID: [string, unknown][] = [
  ['markup', '<script>alert(1)</script>'],
  ['a CSS function', 'M0 0 url(#x)'],
  ['a javascript url', 'javascript:alert(1)'],
  ['a path without a moveto', 'L10 10'],
  ['an empty string', ''],
  ['a non-string', 42],
  ['an oversized string', 'M0 0' + 'L1 1'.repeat(10_000)],
  ['a moveto alone, which draws nothing', 'M0 0'],
  ['only movetos', 'M0 0M1 1m2 2'],
  ['only whitespace', '  \n '],
  ['a moveto with one number', 'M10'],
  ['a command with no arguments', 'M0 0L'],
  ['a dangling argument', 'M0 0L1 1 2'],
  ['too few curve arguments', 'M0 0C1 1 2 2 3'],
  ['too few arc arguments', 'M0 0A1 1 0 0 0 1'],
  ['an arc flag other than 0 or 1', 'M0 0A1 1 0 2 0 1 1'],
  ['arguments after a close', 'M0 0L1 1Z1 1'],
  ['an unknown command', 'M0 0B1 1'],
  ['a comma before the first command', ',M0 0L1 1'],
  ['a comma after a command', 'M,0 0L1 1'],
  ['a doubled comma', 'M0,,0L1 1'],
  ['a comma after a close', 'M0 0L1 1Z,'],
  ['a point with no digits', 'M0 0L. 1'],
  ['a number ending in a point', 'M0 0L1. 1'],
  ['a doubled sign', 'M0 0L--1 1'],
  ['an infinite number', 'M0 0L1e999 1'],
  ['Infinity', 'M0 0LInfinity 1'],
  ['NaN', 'M0 0LNaN 1'],
  ['hex', 'M0 0L0x10 1'],
  ['a non-breaking space', 'M0\u00a00L1 1'],
  ['a Kelvin sign', 'M0 0\u212a1 1'],
];

function accepts(path: unknown): boolean {
  try {
    (window as unknown as { api: { registerShape(n: string, o: object): void } }).api.registerShape('probe', {
      path,
      eyes: { y: 1, w: 1, h: 1, gap: 1 },
    });
    return true;
  } catch {
    return false;
  }
}

test('path validation agrees with what the engine will draw', async ({ page }) => {
  await page.goto('/test/browser/harness.html');
  await page.waitForFunction(() => 'ready' in window);
  await page.addScriptTag({ content: `window.accepts = ${accepts}` });
  const verdicts = await page.evaluate(
    ([valid, invalid]) => {
      const check = (window as unknown as { accepts: typeof accepts }).accepts;
      return {
        rejected: valid.filter(([, path]) => !check(path)).map(([name]) => name),
        accepted: invalid.filter(([, path]) => check(path)).map(([name]) => name),
      };
    },
    [VALID, INVALID] as const,
  );
  expect(verdicts).toEqual({ rejected: [], accepted: [] });
});
