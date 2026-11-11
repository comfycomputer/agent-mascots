import { expect, type Page, test } from '@playwright/test';

const HARNESS = '/test/browser/harness.html';
const SHAPES = ['blob', 'orb', 'egg', 'squircle', 'flame', 'cloud', 'bell', 'ghost', 'cap', 'gem', 'bean', 'drop', 'star', 'heart', 'mochi', 'cat'];
const MATERIALS = ['glow', 'frost', 'glass'];

type Attrs = Record<string, string>;

async function add(page: Page, attrs: Attrs): Promise<void> {
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
  await page.evaluate((all) => {
    const el = document.createElement('agent-mascot');
    for (const [name, value] of Object.entries(all)) el.setAttribute(name, value);
    document.body.append(el);
  }, { detail: 'full', ...attrs });
  await page.waitForFunction(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.rig'));
}

/** Run `body` with `root`, the shadow root, in scope. */
const inRoot = <T>(page: Page, body: string): Promise<T> =>
  page.evaluate(`(async () => {
    const root = document.querySelector('agent-mascot').shadowRoot;
    const frames = (n) => new Promise((done) => {
      const step = () => (n-- > 0 ? requestAnimationFrame(step) : done());
      step();
    });
    ${body}
  })()`) as Promise<T>;

test.describe('animated outlines', () => {
  for (const shape of ['flame', 'ghost']) {
    test(`${shape} moves, no faster than 24 times a second`, async ({ page }) => {
      await add(page, { shape, size: '200' });
      // Waits for a count, not a set time: a starved browser draws fewer frames, which is fine.
      // What the cap forbids is drawing too often, so the rate is measured from the first write to
      // the last: n writes span n - 1 gaps. Timing from an arbitrary start overstates the rate.
      const { writes, seconds } = await inRoot<{ writes: number; seconds: number }>(page, `
        let writes = 0;
        let first = 0;
        let last = 0;
        const observer = new MutationObserver((records) => {
          const now = performance.now();
          if (!writes) first = now;
          writes += records.length;
          last = now;
        });
        observer.observe(root.querySelector('#bp'), { attributes: true, attributeFilter: ['d'] });
        const start = performance.now();
        while (writes < 12 && performance.now() - start < 15000) await new Promise((done) => setTimeout(done, 50));
        observer.disconnect();
        return { writes, seconds: (last - first) / 1000 };`);
      expect(writes).toBeGreaterThanOrEqual(12);
      expect((writes - 1) / seconds).toBeLessThanOrEqual(26);
    });

    test(`${shape} rests on its static outline when motion stops`, async ({ page }) => {
      await add(page, { shape, size: '200' });
      await inRoot(page, 'await frames(20);');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect
        .poll(() =>
          inRoot(page, `
            const path = root.querySelector('#bp').getAttribute('d');
            await frames(3);
            return path === root.querySelector('#bp').getAttribute('d') && !/\\.\\d*[1-9]\\d* /.test(path.slice(0, 40).replace('123.5', ''));`),
        )
        .toBe(true);
    });
  }

  test('a still mascot never morphs', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await add(page, { shape: 'ghost', size: '200' });
    const hem = await inRoot<string>(page, `await frames(5); return root.querySelector('#bp').getAttribute('d');`);
    expect(hem).toContain('V164');
  });
});

test.describe('passing behind the body', () => {
  test('sparks have twins in the layer behind it, and only one of a pair shows', async ({ page }) => {
    await add(page, { mood: 'working', size: '200' });
    const seen = await inRoot<{ front: number; back: number; both: boolean }>(page, `
      const back = [...root.querySelector('.rig').querySelectorAll('.fx-spark')];
      const front = [...root.querySelectorAll('.fx-spark')].filter((node) => !back.includes(node));
      const counts = { front: 0, back: 0, both: false };
      for (let i = 0; i < 90; i++) {
        await frames(1);
        back.forEach((twin, j) => {
          const behind = Number(twin.getAttribute('opacity')) > 0;
          const ahead = Number(front[j].getAttribute('opacity')) > 0;
          if (behind) counts.back++;
          if (ahead) counts.front++;
          if (behind && ahead) counts.both = true;
        });
      }
      return counts;`);
    expect(seen.back).toBeGreaterThan(0);
    expect(seen.front).toBeGreaterThan(0);
    expect(seen.both).toBe(false);
  });

  test('the moon crosses from one layer to the other', async ({ page }) => {
    await add(page, { accessories: 'ring', size: '200', motion: '2' });
    const seen = await inRoot<{ rear: boolean; near: boolean; both: boolean }>(page, `
      const [rear, near] = root.querySelectorAll('.ac-moon-glint');
      const inRig = [rear, near].map((node) => node.parentElement);
      const seen = { rear: false, near: false, both: false };
      const start = performance.now();
      while (performance.now() - start < 3000) {
        await frames(2);
        const [a, b] = inRig.map((node) => node.getAttribute('opacity') === '1');
        seen.rear ||= a;
        seen.near ||= b;
        seen.both ||= a && b;
      }
      return seen;`);
    expect(seen).toEqual({ rear: true, near: true, both: false });
  });
});

test.describe('listening echoes', () => {
  for (const shape of SHAPES) {
    test(`${shape} never crosses the body`, async ({ page }) => {
      await add(page, { shape, material: 'glass', mood: 'listening', size: '240' });
      // Walk each ring and ask the body's own outline whether the ring is inside it. The ring's
      // path is that outline, so with the ring's scale undone it can answer for the body.
      const result = await inRoot<{ samples: number; inside: number }>(page, `
        const rings = [...root.querySelector('.rig').querySelectorAll('.fx-line')];
        const count = { samples: 0, inside: 0 };
        for (let i = 0; i < 30; i++) {
          await frames(2);
          for (const ring of rings) {
            if (Number(ring.getAttribute('opacity')) < 0.02) continue;
            const [tx, ty, sx, sy] = ring.getAttribute('transform').match(/-?[\\d.]+/g).map(Number);
            const length = ring.getTotalLength();
            for (let at = 0; at < length; at += length / 80) {
              const { x, y } = ring.getPointAtLength(at);
              const point = root.querySelector('.rig svg').createSVGPoint();
              point.x = tx + x * sx;
              point.y = ty + y * sy;
              count.samples++;
              if (ring.isPointInFill(point)) count.inside++;
            }
          }
        }
        return count;`);
      expect(result.samples).toBeGreaterThan(0);
      // Only the flame's notch can dip back in, and only by a sliver.
      expect(result.inside / result.samples).toBeLessThan(shape === 'flame' ? 0.04 : 0.001);
    });
  }

  test('keeps a thin line as it travels', async ({ page }) => {
    await add(page, { shape: 'cap', mood: 'listening', size: '320' });
    const drawn = await inRoot<number[]>(page, `
      await frames(40);
      const widths = [];
      for (const ring of root.querySelector('.rig').querySelectorAll('.fx-line')) {
        const scale = Number(ring.getAttribute('transform').match(/scale\\(([\\d.]+)/)[1]);
        widths.push(parseFloat(getComputedStyle(ring).strokeWidth) * scale);
      }
      return widths;`);
    for (const width of drawn) expect(width).toBeCloseTo(1.6, 1);
  });

  for (const material of MATERIALS) {
    test(`follow the outline in ${material}`, async ({ page }) => {
      await add(page, { shape: 'cloud', material, mood: 'listening', size: '240' });
      const same = await inRoot<boolean>(page, `
        await frames(10);
        const ring = root.querySelector('.rig .fx-line');
        return ring.getAttribute('d') === root.querySelector('#bp').getAttribute('d');`);
      expect(same).toBe(true);
    });
  }

  for (const shape of SHAPES) {
    test(`${shape} stays inside the view, which a sky clips`, async ({ page }) => {
      await add(page, { shape, sky: 'auto', mood: 'listening', size: '240' });
      // In SVG units, without the body's sway: this is about where the ring is sent.
      const worst = await inRoot<number>(page, `
        const view = root.querySelector('.rig svg').viewBox.baseVal;
        const rings = [...root.querySelector('.rig').querySelectorAll('.fx-line')];
        let worst = 99;
        for (let i = 0; i < 60; i++) {
          await frames(2);
          for (const ring of rings) {
            if (Number(ring.getAttribute('opacity')) < 0.02) continue;
            const [tx, ty, sx, sy] = ring.getAttribute('transform').match(/-?[\\d.]+/g).map(Number);
            const box = ring.getBBox();
            worst = Math.min(
              worst,
              tx + box.x * sx - view.x,
              ty + box.y * sy - view.y,
              view.x + view.width - (tx + (box.x + box.width) * sx),
            );
          }
        }
        return worst;`);
      expect(worst).toBeGreaterThanOrEqual(0);
    });
  }
});

test.describe('facets', () => {
  test('a gem gets planes, and other bodies only lines', async ({ page }) => {
    await add(page, { shape: 'gem', size: '200' });
    expect(await inRoot(page, `return root.querySelectorAll('[class^="ac-plate"]').length;`)).toBe(3);
    await add(page, { accessories: 'facets', size: '200' });
    expect(await inRoot(page, `return root.querySelectorAll('[class^="ac-plate"]').length;`)).toBe(0);
    expect(await inRoot(page, `return root.querySelectorAll('.ac-facet').length;`)).toBe(2);
  });

  for (const attrs of [{}, { 'eye-y': '0.6' }, { 'eye-y': '-0.5', 'body-height': '1.3' }] as Attrs[]) {
    test(`the cuts dissolve around the face with ${JSON.stringify(attrs)}`, async ({ page }) => {
      await add(page, { shape: 'gem', size: '240', motion: '0', ...attrs });
      const fit = await inRoot<{ dy: number; rx: number; ry: number; gap: number; first: string }>(page, `
        await frames(5);
        const fade = root.querySelector('#ac-cut');
        const [, x, y, rx, ry] = fade.getAttribute('gradientTransform').match(/translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([-\\d.]+) ([-\\d.]+)\\)/).map(Number);
        const group = root.querySelector('.ac-facet').parentElement;
        const matrix = group.getScreenCTM();
        const eye = root.querySelector('.eye').getBoundingClientRect();
        const other = root.querySelectorAll('.eye')[1].getBoundingClientRect();
        const eyeMid = (eye.top + eye.bottom) / 2;
        const toScreen = (value) => value * matrix.d + matrix.f;
        return {
          dy: toScreen(y) - eyeMid,
          rx: rx * matrix.a,
          ry: ry * matrix.a,
          gap: (other.right - eye.left) / 2,
          first: fade.children[0].getAttribute('stop-opacity'),
        };`);
      // Centred on the eyes, and the clear part of the gradient reaches past them.
      expect(Math.abs(fit.dy)).toBeLessThan(2);
      expect(fit.rx * 0.7).toBeGreaterThan(fit.gap);
      expect(fit.first).toBe('0');
    });
  }
});

test.describe('restored detail', () => {
  const NODES: [string, Attrs, string, number][] = [
    ['leaf veins', { accessories: 'leaf' }, '.ac-vein', 2],
    ['bubble glints', { accessories: 'bubbles' }, '.ac-bubble-glint', 2],
    ['the bulb glint', { accessories: 'antenna' }, '.ac-bulb-glint', 1],
    ['the stem shine', { shape: 'cap' }, '.ac-stem-shine', 1],
    ['stem shading', { shape: 'cap' }, '#ac-stem-shade', 1],
    ['the corona', { accessories: 'rays' }, '#ac-corona', 1],
    ['the ring gradient', { accessories: 'ring' }, '#ac-ring', 1],
    ['the moon gradient', { accessories: 'ring' }, '#ac-moon', 1],
  ];
  for (const [name, attrs, selector, count] of NODES) {
    test(`keeps ${name}`, async ({ page }) => {
      await add(page, { size: '200', ...attrs });
      expect(await page.evaluate((s) => document.querySelector('agent-mascot')?.shadowRoot?.querySelectorAll(s).length, selector)).toBe(count);
    });
  }

  // Under a point, a round bottom or a hem, a flat top would sit on a shelf beside the body.
  for (const shape of ['cap', 'heart', 'star', 'ghost', 'orb']) {
    test(`the stem runs up under a ${shape}, cut by its outline`, async ({ page }) => {
      await add(page, { size: '200', shape, accessories: 'stem' });
      const stem = await inRoot<{ cut: string | null; cutBy: string | null; top: number }>(page, `
        await frames(2);
        const fill = root.querySelector('[fill="url(#ac-stem)"]');
        return {
          cut: root.querySelector('mask#ac-stem-cut use')?.getAttribute('href'),
          cutBy: fill.closest('[mask]')?.getAttribute('mask'),
          top: fill.getBBox().y,
        };`);
      expect(stem.cut).toBe('#bp');
      expect(stem.cutBy).toBe('url(#ac-stem-cut)');
      // In the stem's own units it rests at 137, under the body's lowest point.
      expect(stem.top).toBeLessThan(137 - 20);
    });
  }

  // A heart dips and a cat has ears, so the middle of the head is below its highest point.
  const ROOTS: [string, string][] = [
    ['antenna', `const stem = root.querySelector('.ac-stalk'); return [120, Number(stem.getAttribute('y')) + Number(stem.getAttribute('height'))];`],
    ['stalk', `const [, y] = root.querySelector('.ac-stalk-line').getAttribute('d').match(/^M120 ([\\d.-]+)/); return [120, Number(y)];`],
    ['leaf', `const sprig = root.querySelector('.ac-sprig').parentElement; return [120, 80 + sprig.transform.baseVal.getItem(0).matrix.f];`],
  ];
  for (const [accessory, foot] of ROOTS) {
    for (const shape of ['heart', 'cat', 'blob']) {
      test(`the ${accessory} grows from a ${shape}'s head`, async ({ page }) => {
        await add(page, { size: '200', shape, accessories: accessory });
        const inside = await inRoot<boolean>(page, `
          await frames(2);
          const [x, y] = (() => { ${foot} })();
          const ctx = document.createElement('canvas').getContext('2d');
          return ctx.isPointInPath(new Path2D(root.querySelector('#bp').getAttribute('d')), x, y);`);
        expect(inside).toBe(true);
      });
    }
  }

  test('a sky has its radial highlight', async ({ page }) => {
    await add(page, { sky: 'tomato', size: '200' });
    const image = await inRoot<string>(page, `return getComputedStyle(root.querySelector('.tile')).backgroundImage;`);
    expect(image).toContain('radial-gradient');
  });
});

test('fine detail follows the rendered size without a rebuild', async ({ page }) => {
  await add(page, { size: '320' });
  const result = await inRoot<{ large: number[]; small: number[]; same: boolean }>(page, `
    const el = root.host;
    const read = () => [...root.querySelectorAll('#edge feGaussianBlur, #soft feGaussianBlur')].map((node) => Number(node.getAttribute('stdDeviation')));
    const body = root.querySelector('#bp');
    await frames(3);
    const large = read();
    el.size = 96;
    await frames(5);
    return { large, small: read(), same: body === root.querySelector('#bp') };`);
  expect(result.same).toBe(true);
  // The edge thickens, and the core's soft falloff tightens.
  expect(result.small[0]).toBeGreaterThan(result.large[0] as number);
  expect(result.small[1]).toBeLessThan(result.large[1] as number);
});
