import { expect, type Page, test } from '@playwright/test';
import { eyeOffset, probeListeners, settled } from './sensors.js';

const HARNESS = '/test/browser/harness.html';

/** Reduced motion draws synchronously, with no wander, so positions are exact. */
async function load(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await probeListeners(page);
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
  await page.addStyleTag({ content: 'body { margin: 0 } agent-mascot { position: fixed; left: 300px; top: 200px }' });
}

async function add(page: Page, attributes: Record<string, string> = {}): Promise<void> {
  await page.evaluate((attrs) => {
    const el = document.createElement('agent-mascot');
    el.id = 'm';
    el.setAttribute('size', '100');
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    document.body.append(el);
  }, attributes);
  await settled(page);
}

test.beforeEach(async ({ page }) => {
  await load(page);
});

test('self follows the pointer while it is over the mascot', async ({ page }) => {
  await add(page);
  await page.mouse.move(345, 250);
  await page.mouse.move(395, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);
  await page.mouse.move(305, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeLessThan(0);
  await page.mouse.move(20, 20);
  await expect.poll(() => eyeOffset(page)).toEqual({ x: 0, y: 0 });
});

test('self ignores the pointer elsewhere on the page', async ({ page }) => {
  await add(page);
  await page.mouse.move(20, 20);
  await page.mouse.move(700, 500);
  expect(await eyeOffset(page)).toEqual({ x: 0, y: 0 });
});

test('a tap aims the eyes with no move before it', async ({ page }) => {
  await add(page);
  await page.evaluate(() => {
    const init = { bubbles: true, composed: true, clientX: 395, clientY: 250, pointerType: 'touch' };
    document.querySelector('agent-mascot')?.dispatchEvent(new PointerEvent('pointerdown', init));
  });
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);
});

test('window follows anywhere and releases when the pointer leaves the page', async ({ page }) => {
  await add(page, { track: 'window' });
  await page.mouse.move(20, 250);
  await page.mouse.move(10, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeLessThan(0);
  await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerleave')));
  expect(await eyeOffset(page)).toEqual({ x: 0, y: 0 });
});

test('none ignores the pointer and holds no listeners', async ({ page }) => {
  await add(page, { track: 'none' });
  const held = await page.evaluate(() => {
    const el = document.querySelector('#m') as HTMLElement;
    return window.listeners.count(el, 'pointermove') + window.listeners.count(window, 'pointermove');
  });
  expect(held).toBe(0);
  await page.mouse.move(345, 250);
  await page.mouse.move(395, 250);
  expect(await eyeOffset(page)).toEqual({ x: 0, y: 0 });
});

test('a selector matches inside the shadow root before the document', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const outside = document.createElement('div');
    outside.id = 'pad';
    const shell = document.createElement('div');
    const root = shell.attachShadow({ mode: 'open' });
    const inside = document.createElement('div');
    inside.id = 'pad';
    const near = document.createElement('agent-mascot');
    near.setAttribute('track', '#pad');
    root.append(inside, near);
    document.body.append(outside, shell);
    await new Promise(requestAnimationFrame);
    return {
      inside: window.listeners.count(inside, 'pointermove'),
      outside: window.listeners.count(outside, 'pointermove'),
    };
  });
  expect(result).toEqual({ inside: 1, outside: 0 });
});

test('a selector falls back to the document from inside a shadow root', async ({ page }) => {
  const held = await page.evaluate(async () => {
    const outside = document.createElement('div');
    outside.id = 'pad';
    const shell = document.createElement('div');
    const near = document.createElement('agent-mascot');
    near.setAttribute('track', '#pad');
    shell.attachShadow({ mode: 'open' }).append(near);
    document.body.append(outside, shell);
    await new Promise(requestAnimationFrame);
    return window.listeners.count(outside, 'pointermove');
  });
  expect(held).toBe(1);
});

test('trackElement overrides track, and clearing it restores track', async ({ page }) => {
  await add(page, { track: 'none' });
  const counts = await page.evaluate(() => {
    const el = document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot'];
    const pad = document.createElement('div');
    document.body.append(pad);
    el.trackElement = pad;
    const during = window.listeners.count(pad, 'pointermove');
    el.track = 'self';
    const stillPad = window.listeners.count(pad, 'pointermove');
    el.trackElement = null;
    return { during, stillPad, after: window.listeners.count(pad, 'pointermove'), self: window.listeners.count(el, 'pointermove') };
  });
  expect(counts).toEqual({ during: 1, stillPad: 1, after: 0, self: 1 });
});

test('track-reach scales the look and applies without rebinding', async ({ page }) => {
  await add(page, { track: 'window', 'track-reach': '4' });
  await page.mouse.move(350, 251);
  await page.mouse.move(450, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);
  const quarter = (await eyeOffset(page)).x;

  await page.evaluate(() => {
    const el = document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot'];
    el.trackReach = 1;
    el.dataset.before = String(window.listeners.count(window, 'pointermove'));
  });
  await page.mouse.move(450, 251);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(quarter * 3);
  const held = await page.evaluate(() => window.listeners.count(window, 'pointermove'));
  expect(held).toBe(1);
});

test('honours an explicit track-reach on self, and has a usable default', async ({ page }) => {
  await add(page);
  await page.mouse.move(350, 250);
  await page.mouse.move(392, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);
  const usable = (await eyeOffset(page)).x;
  await page.evaluate(() => {
    (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).trackReach = 4;
  });
  await page.mouse.move(391, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeLessThan(usable / 3);
});

test('many mascots share one listener per target, released with the last', async ({ page }) => {
  const counts = await page.evaluate(() => {
    const baseline = window.listeners.count(window, 'pointerdown');
    const mascots = Array.from({ length: 20 }, () => {
      const el = document.createElement('agent-mascot');
      el.setAttribute('track', 'window');
      document.body.append(el);
      return el;
    });
    const held = () => [
      window.listeners.count(window, 'pointermove'),
      window.listeners.count(window, 'pointerdown') - baseline,
    ];
    const shared = held();
    const edge = window.listeners.count(document.documentElement, 'pointerleave');
    mascots.slice(1).forEach((el) => el.remove());
    const oneLeft = held();
    mascots[0]?.remove();
    return { shared, edge, oneLeft, none: held(), edgeAfter: window.listeners.count(document.documentElement, 'pointerleave') };
  });
  expect(counts).toEqual({ shared: [1, 1], edge: 1, oneLeft: [1, 1], none: [0, 0], edgeAfter: 0 });
});

test('moving to another target releases the old one and reconnecting binds again', async ({ page }) => {
  await add(page, { track: 'window' });
  const held = await page.evaluate(() => {
    const el = document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot'];
    const counts = [window.listeners.count(window, 'pointermove')];
    el.track = 'self';
    counts.push(window.listeners.count(window, 'pointermove'));
    el.track = 'window';
    counts.push(window.listeners.count(window, 'pointermove'));
    el.remove();
    counts.push(window.listeners.count(window, 'pointermove'));
    document.body.append(el);
    counts.push(window.listeners.count(window, 'pointermove'));
    return counts;
  });
  expect(held).toEqual([1, 0, 1, 0, 1]);
});

test('an off-screen mascot does no work for a shared pointer', async ({ page }) => {
  await add(page, { track: 'window' });
  await page.evaluate(() => {
    const el = document.querySelector('#m') as HTMLElement & { calls?: number };
    el.calls = 0;
    const measure = el.getBoundingClientRect.bind(el);
    el.getBoundingClientRect = () => {
      el.calls = (el.calls ?? 0) + 1;
      return measure();
    };
    el.style.top = '5000px';
  });
  await settled(page);
  await page.mouse.move(20, 20);
  await page.mouse.move(60, 60);
  const calls = await page.evaluate(() => (document.querySelector('#m') as HTMLElement & { calls?: number }).calls);
  expect(calls).toBe(0);
});

test('lookAt beats the pointer, and lookAway hands back to it', async ({ page }) => {
  await add(page, { track: 'window' });
  await page.mouse.move(700, 250);
  await page.mouse.move(710, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);

  await page.evaluate(() => (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).lookAt(0, 250));
  expect((await eyeOffset(page)).x).toBeLessThan(0);
  await page.mouse.move(720, 250);
  await settled(page);
  expect((await eyeOffset(page)).x).toBeLessThan(0);

  await page.evaluate(() => (document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot']).lookAway());
  expect((await eyeOffset(page)).x).toBeGreaterThan(0);
});

test('lookAt works before the mascot has layout and survives a move', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.createElement('agent-mascot');
    el.id = 'm';
    el.setAttribute('size', '100');
    el.lookAt(0, 250);
    document.body.append(el);
  });
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeLessThan(0);
  await page.evaluate(() => {
    const el = document.querySelector('#m') as HTMLElement;
    el.remove();
    document.body.append(el);
  });
  await settled(page);
  expect((await eyeOffset(page)).x).toBeLessThan(0);
});

test('a selector binds when its element appears later', async ({ page }) => {
  await add(page, { track: '#late', 'track-reach': '1' });
  await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const pad = document.createElement('div');
    pad.id = 'late';
    pad.style.cssText = 'position:fixed;left:500px;top:0;width:200px;height:200px';
    document.body.append(pad);
  });
  await expect
    .poll(() => page.evaluate(() => window.listeners.count(document.querySelector('#late') as Element, 'pointermove')))
    .toBe(1);
  await page.mouse.move(600, 100);
  await page.mouse.move(610, 100);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);
});

test('follows a selector to its replacement when the target is removed', async ({ page }) => {
  await page.evaluate(() => {
    const pad = document.createElement('div');
    pad.id = 'swap';
    pad.style.cssText = 'position:fixed;left:0;top:0;width:250px;height:400px';
    document.body.append(pad);
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await add(page, { track: '#swap', 'track-reach': '1', glance: '0' });
  await page.mouse.move(10, 250);
  await page.mouse.move(5, 250);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeLessThan(0);

  // Removing a node sends no pointerleave, so nothing else would release the gaze.
  const old = await page.evaluateHandle(() => document.querySelector('#swap') as Element);
  await old.evaluate((pad) => pad.remove());
  await expect.poll(() => eyeOffset(page).then(({ x }) => Math.abs(x))).toBeLessThan(0.2);
  expect(await old.evaluate((pad) => window.listeners.count(pad, 'pointermove'))).toBe(0);

  await page.evaluate(() => {
    const pad = document.createElement('div');
    pad.id = 'swap';
    document.body.append(pad);
  });
  await expect
    .poll(() => page.evaluate(() => window.listeners.count(document.querySelector('#swap') as Element, 'pointermove')))
    .toBe(1);
});

test('stays bound to a detached trackElement, which the consumer owns', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await add(page);
  const held = await page.evaluate(async () => {
    const el = document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot'];
    const pad = document.createElement('div');
    el.trackElement = pad;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return window.listeners.count(pad, 'pointermove');
  });
  expect(held).toBe(1);
});

const lookups = (page: Page) =>
  page.evaluate(() => (window as unknown as { lookups: { count: number } }).lookups.count);

test.describe('selector retry', () => {
  test.beforeEach(async ({ page }) => {
    // Run the backoff a thousand times faster, and count the lookups it makes.
    await page.addInitScript(() => {
      const { setTimeout: real } = window;
      window.setTimeout = ((handler: () => void, delay = 0, ...args: []) =>
        real(handler, delay / 1000, ...args)) as typeof window.setTimeout;
      const { querySelector } = Document.prototype;
      const tally = { count: 0 };
      Object.assign(window, { lookups: tally });
      Document.prototype.querySelector = function counted(this: Document, selector: string) {
        if (selector === '#never') tally.count += 1;
        return querySelector.call(this, selector);
      } as typeof Document.prototype.querySelector;
    });
    await load(page);
  });

  test('gives up after a bounded number of tries and warns once', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await add(page, { track: '#never' });
    await expect.poll(() => warnings.filter((text) => text.includes('#never')).length).toBe(1);

    const stopped = await lookups(page);
    // Each try looks in the root and then the document, which here are the same.
    expect(stopped).toBeLessThanOrEqual(22);
    await page.waitForTimeout(100);
    expect(await lookups(page)).toBe(stopped);

    // A late element is not noticed once it has given up, until `track` is set again.
    const held = await page.evaluate(() => {
      const pad = document.createElement('div');
      pad.id = 'never';
      document.body.append(pad);
      const before = window.listeners.count(pad, 'pointermove');
      const el = document.querySelector('#m') as HTMLElementTagNameMap['agent-mascot'];
      el.track = 'self';
      el.track = '#never';
      return { before, after: window.listeners.count(pad, 'pointermove') };
    });
    expect(held).toEqual({ before: 0, after: 1 });
  });

  test('stops retrying when the mascot is removed', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.createElement('agent-mascot');
      el.setAttribute('track', '#never');
      document.body.append(el);
      el.remove();
    });
    const stopped = await lookups(page);
    await page.waitForTimeout(100);
    expect(await lookups(page)).toBe(stopped);
    expect(stopped).toBeLessThanOrEqual(2);
  });
});

test('an invalid selector warns and falls back to self', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await add(page, { track: '[[nonsense' });
  const held = await page.evaluate(() => window.listeners.count(document.querySelector('#m') as Element, 'pointermove'));
  expect(held).toBe(1);
  await expect.poll(() => warnings.filter((text) => text.includes('[[nonsense')).length).toBe(1);
});

test('springs the gaze when motion is allowed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await add(page, { track: 'window', glance: '0' });
  await page.mouse.move(700, 250);
  await page.mouse.move(710, 250);
  const samples = await page.evaluate(async () => {
    const eyes = document.querySelector('#m')?.shadowRoot?.querySelector('.eyes') as SVGElement;
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      seen.add(eyes.style.transform);
      await new Promise(requestAnimationFrame);
    }
    return seen.size;
  });
  expect(samples).toBeGreaterThan(2);
  await expect.poll(() => eyeOffset(page).then(({ x }) => x)).toBeGreaterThan(0);
});
