import { expect, type Page, test } from '@playwright/test';

const HARNESS = '/test/browser/harness.html';
const SHAPES = ['blob', 'orb', 'egg', 'squircle', 'flame', 'cloud', 'bell', 'ghost', 'cap', 'gem', 'bean', 'drop', 'star', 'heart', 'mochi', 'cat'];
const MOODS = ['idle', 'thinking', 'working', 'success', 'error', 'listening', 'speaking', 'waiting', 'sleeping'];

async function load(page: Page): Promise<void> {
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
}

/** Add a mascot and wait until it has rendered. */
async function add(page: Page, attributes: Record<string, string> = {}): Promise<void> {
  await page.evaluate(async (attrs) => {
    const el = document.createElement('agent-mascot');
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    document.body.append(el);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  }, attributes);
}

const level = (page: Page) =>
  page.evaluate(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.tile')?.getAttribute('data-detail'));

async function resize(page: Page, width: number): Promise<void> {
  await page.evaluate(async (w) => {
    document.querySelector('agent-mascot')?.setAttribute('size', String(w));
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  }, width);
}

test.describe('detail switching', () => {
  test.beforeEach(({ page }) => load(page));

  test('swaps exactly at the 64px boundary, whichever way it is crossed', async ({ page }) => {
    await add(page, { size: '200' });
    await resize(page, 65);
    expect(await level(page)).toBe('full');
    await resize(page, 64);
    expect(await level(page)).toBe('simple');
    await resize(page, 65);
    expect(await level(page)).toBe('full');
  });

  test('follows CSS sizing through the ResizeObserver', async ({ page }) => {
    await add(page);
    expect(await level(page)).toBe('full');
    await page.addStyleTag({ content: 'agent-mascot { width: 40px; }' });
    await expect.poll(() => level(page)).toBe('simple');
  });

  test('a detail change reuses the observed width', async ({ page }) => {
    await add(page, { size: '48', detail: 'full' });
    expect(await level(page)).toBe('full');
    await page.evaluate(() => document.querySelector('agent-mascot')?.setAttribute('detail', 'auto'));
    expect(await level(page)).toBe('simple');
  });

  test('a swap never paints an unposed frame', async ({ page }) => {
    await add(page, { size: '200' });
    const eye = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElement;
      el.setAttribute('size', '32');
      // A later observer of the same element runs after the element's own swap, before paint.
      return new Promise<string | null | undefined>((resolve) => {
        new ResizeObserver(() => resolve(el.shadowRoot?.querySelector('.simple-eye')?.getAttribute('d'))).observe(el);
      });
    });
    expect(eye).toBeTruthy();
  });

  test('a swap keeps animation state', async ({ page }) => {
    await add(page, { size: '200' });
    const deepest = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElement & { poke(): void };
      // Only a poke squashes this far, and it happens before the swap: if motion state
      // restarted with the renderer, simple would never show it.
      el.poke();
      el.setAttribute('size', '32');
      let most = 0;
      for (let frame = 0; frame < 20; frame++) {
        await new Promise(requestAnimationFrame);
        const rig = el.shadowRoot?.querySelector('svg.simple > g');
        const scale = /scale\(([\d.]+) ([\d.]+)\)/.exec(rig?.getAttribute('transform') ?? '');
        if (scale) most = Math.max(most, Math.abs(1 - Number(scale[2])));
      }
      return most;
    });
    expect(deepest).toBeGreaterThan(0.03);
  });

  test('resizing inside simple retunes without rebuilding', async ({ page }) => {
    await add(page, { size: '48' });
    const same = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElement;
      const root = el.shadowRoot as ShadowRoot;
      const body = root.querySelector('.simple-body');
      const before = root.querySelector('svg.simple')?.getAttribute('viewBox');
      el.setAttribute('size', '16');
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const after = root.querySelector('svg.simple')?.getAttribute('viewBox');
      return { node: body === root.querySelector('.simple-body'), viewBoxMoved: before !== after };
    });
    expect(same).toEqual({ node: true, viewBoxMoved: true });
  });
});

test.describe('simple render', () => {
  test.beforeEach(({ page }) => load(page));

  test('uses no filters, masks or goo', async ({ page }) => {
    await add(page, { size: '32', material: 'frost', shape: 'flame', accessories: 'ears rays' });
    const count = await page.evaluate(
      () => document.querySelector('agent-mascot')?.shadowRoot?.querySelectorAll('filter, mask, [filter]').length,
    );
    expect(count).toBe(0);
  });

  test('a mood change touches no nodes', async ({ page }) => {
    await add(page, { size: '32' });
    const added = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElement;
      let nodes = 0;
      new MutationObserver((records) => {
        for (const record of records) nodes += record.addedNodes.length + record.removedNodes.length;
      }).observe(el.shadowRoot as ShadowRoot, { childList: true, subtree: true });
      for (const mood of ['speaking', 'waiting', 'error', 'listening']) {
        el.setAttribute('mood', mood);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      }
      return nodes;
    });
    expect(added).toBe(0);
  });

  test('an idle 16px mascot writes far less than once per frame', async ({ page }) => {
    await add(page, { size: '16' });
    const { writes, frames } = await page.evaluate(async () => {
      const root = document.querySelector('agent-mascot')?.shadowRoot as ShadowRoot;
      let count = 0;
      const observer = new MutationObserver((records) => (count += records.length));
      observer.observe(root, { attributes: true, subtree: true });
      let ticks = 0;
      const end = performance.now() + 1000;
      while (performance.now() < end) {
        await new Promise(requestAnimationFrame);
        ticks++;
      }
      observer.disconnect();
      return { writes: count, frames: ticks };
    });
    // Blinks and glances still write, so this is a ceiling rather than an exact count.
    expect(frames).toBeGreaterThan(20);
    expect(writes).toBeLessThan(frames);
  });

  test('the mouth follows level', async ({ page }) => {
    await add(page, { size: '32', mood: 'speaking', level: '0' });
    const height = async (value: string) =>
      page.evaluate(async (next) => {
        const el = document.querySelector('agent-mascot') as HTMLElement;
        el.setAttribute('level', next);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mouth = el.shadowRoot?.querySelectorAll('.simple-eye')[2] as SVGGraphicsElement;
        return mouth.getBBox().height;
      }, value);
    const quiet = await height('0');
    const loud = await height('1');
    expect(loud).toBeGreaterThan(quiet * 1.8);
  });

  test('eye-color and pale bodies keep the eyes visible', async ({ page }) => {
    await add(page, { size: '32', color: '#f8fafc' });
    const fill = () =>
      page.evaluate(() => {
        const eye = document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.simple-eye') as Element;
        return getComputedStyle(eye).fill;
      });
    expect(await fill()).not.toBe('rgb(255, 255, 255)');
    await page.evaluate(() => document.querySelector('agent-mascot')?.setAttribute('eye-color', 'rgb(255, 0, 0)'));
    expect(await fill()).toBe('rgb(255, 0, 0)');
  });

  test('custom shapes without tuning fill the box', async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { api: { registerShape(name: string, o: object): void } }).api.registerShape('plank', {
        path: 'M40 110H200V130H40Z',
        eyes: { y: 120, w: 10, h: 12, gap: 20 },
        top: 110,
        bottom: 130,
        halfWidth: 80,
      });
    });
    await add(page, { size: '32', shape: 'plank' });
    const box = await page.evaluate(() => {
      const body = document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.simple-body') as SVGGraphicsElement;
      const { width } = body.getBoundingClientRect();
      return width;
    });
    expect(box).toBeGreaterThan(24);
    expect(box).toBeLessThanOrEqual(32);
  });
});

/** Render the sheet at real size and read back real pixels, as a list of RGBA cells. */
async function cells(page: Page, background: string, size: number): Promise<number[][][]> {
  await load(page);
  const grid = await page.evaluateHandle(
    async ({ shapes, moods, bg, px }) => {
      const host = document.createElement('div');
      host.style.cssText = `display:grid;grid-template-columns:repeat(${moods.length},${px + 8}px);grid-auto-rows:${px + 8}px;place-items:center;width:max-content;background:${bg}`;
      for (const shape of shapes) {
        for (const mood of moods) {
          const el = document.createElement('agent-mascot');
          el.setAttribute('detail', 'simple');
          el.setAttribute('size', String(px));
          el.setAttribute('shape', shape);
          el.setAttribute('mood', mood);
          host.append(el);
        }
      }
      document.body.style.margin = '0';
      document.body.append(host);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return host;
    },
    { shapes: SHAPES, moods: MOODS, bg: background, px: size },
  );
  const png = (await grid.asElement()?.screenshot())?.toString('base64') ?? '';
  return page.evaluate(
    async ({ data, count, moods, step }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      context.drawImage(image, 0, 0);
      const out: number[][][] = [];
      for (let row = 0; row < count; row++) {
        const line: number[][] = [];
        for (let column = 0; column < moods; column++) {
          line.push([...context.getImageData(column * step, row * step, step, step).data]);
        }
        out.push(line);
      }
      return out;
    },
    { data: png, count: SHAPES.length, moods: MOODS.length, step: size + 8 },
  );
}

/** Pixels that visibly differ between two cells. */
function difference(a: number[], b: number[]): number {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    const delta =
      Math.abs((a[i] as number) - (b[i] as number)) +
      Math.abs((a[i + 1] as number) - (b[i + 1] as number)) +
      Math.abs((a[i + 2] as number) - (b[i + 2] as number));
    if (delta > 96) count++;
  }
  return count;
}

test.describe('legibility at 16px', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });

  for (const [name, background] of [
    ['white', '#ffffff'],
    ['near-black', '#0b0d12'],
  ] as const) {
    test(`every mood is a distinct still frame on every shape, on ${name}`, async ({ page }) => {
      const sheet = await cells(page, background, 16);
      const failures: string[] = [];
      let least = Infinity;
      SHAPES.forEach((shape, row) => {
        MOODS.forEach((first, i) => {
          MOODS.slice(i + 1).forEach((second, j) => {
            const a = sheet[row]?.[i] as number[];
            const b = sheet[row]?.[i + 1 + j] as number[];
            const changed = difference(a, b);
            least = Math.min(least, changed);
            if (changed < 3) failures.push(`${shape}: ${first} vs ${second} differ by ${changed}px`);
          });
        });
      });
      expect(failures, `closest pair differs by ${least}px`).toEqual([]);
    });

    test(`every shape and mood fills its box with a visible face at 16px, on ${name}`, async ({ page }) => {
      const sheet = await cells(page, background, 16);
      const paper = name === 'white' ? [255, 255, 255] : [11, 13, 18];
      const failures: string[] = [];
      SHAPES.forEach((shape, row) => {
        MOODS.forEach((mood, column) => {
          const data = sheet[row]?.[column] as number[];
          let body = 0;
          let eyes = 0;
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i] as number, data[i + 1] as number, data[i + 2] as number];
            const off = Math.abs(r - (paper[0] as number)) + Math.abs(g - (paper[1] as number)) + Math.abs(b - (paper[2] as number));
            if (off > 60) body++;
            if (r + g + b > 600) eyes++;
          }
          // Eyes are white on this colour, so on white they count as page: near-black measures them.
          if (body < 60) failures.push(`${shape} ${mood}: body covers ${body}px`);
          if (name === 'near-black' && eyes < 2) failures.push(`${shape} ${mood}: only ${eyes} eye pixels`);
        });
      });
      expect(failures).toEqual([]);
    });
  }
});
