import { expect, type Page, test } from '@playwright/test';

const HARNESS = '/test/browser/harness.html';

async function load(page: Page): Promise<void> {
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
}

/** Add a mascot and wait until it has rendered. */
async function add(page: Page, attributes: Record<string, string> = {}): Promise<void> {
  await page.evaluate(async (attrs) => {
    const el = document.createElement('agent-mascot');
    el.id = 'm';
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    document.body.append(el);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  }, attributes);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await load(page);
  (page as Page & { errors?: string[] }).errors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors).toEqual([]);
});

test('upgrades, renders every layer and exposes its parts', async ({ page }) => {
  await add(page);
  const parts = await page.evaluate(() => {
    const root = document.querySelector('agent-mascot')?.shadowRoot;
    return ['tile', 'body', 'eyes'].map((part) => root?.querySelectorAll(`[part="${part}"]`).length);
  });
  expect(parts).toEqual([1, 1, 1]);
});

test('renders the full level above 64px and simple at or below', async ({ page }) => {
  await add(page, { size: '200' });
  const level = () =>
    page.evaluate(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.tile')?.getAttribute('data-detail'));
  expect(await level()).toBe('full');
  await page.evaluate(() => {
    document.querySelector('agent-mascot')?.setAttribute('size', '64');
  });
  await expect.poll(level).toBe('simple');
  await page.evaluate(() => {
    document.querySelector('agent-mascot')?.setAttribute('detail', 'full');
  });
  await expect.poll(level).toBe('full');
});

test('picks a detail level from CSS sizing without a size attribute', async ({ page }) => {
  await page.addStyleTag({ content: 'agent-mascot { width: 40px; }' });
  await add(page);
  const level = await page.evaluate(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.tile')?.getAttribute('data-detail'));
  expect(level).toBe('simple');
});

test('keeps a 1:1 box', async ({ page }) => {
  await add(page, { size: '120' });
  const box = await page.locator('agent-mascot').boundingBox();
  expect(box?.width).toBe(120);
  expect(box?.height).toBe(120);
});

test('mirrors attributes as camelCase properties', async ({ page }) => {
  await add(page);
  const result = await page.evaluate(() => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    el.bodyWidth = 1.2;
    el.eyeShape = 'round';
    el.trackReach = 3;
    el.gyro = false;
    const attrs = [el.getAttribute('body-width'), el.getAttribute('eye-shape'), el.getAttribute('track-reach')];
    el.setAttribute('eye-spacing', '1.5');
    el.setAttribute('body-height', '99');
    return { attrs, spacing: el.eyeSpacing, height: el.bodyHeight, gyro: el.hasAttribute('gyro') };
  });
  expect(result).toEqual({ attrs: ['1.2', 'round', '3'], spacing: 1.5, height: 1.4, gyro: false });
});

test('adopts properties set before the element upgraded', async ({ page }) => {
  const result = await page.evaluate(() => {
    const { AgentMascot } = (window as never as { api: typeof import('../../src/index.js') }).api;
    // Simulate a framework setting a property while the element was still undefined.
    const el = Object.create(AgentMascot.prototype) as HTMLElement;
    return Object.getOwnPropertyDescriptor(AgentMascot.prototype, 'shape')?.set && el instanceof HTMLElement;
  });
  expect(result).toBe(true);
  await page.setContent('<agent-mascot id="early"></agent-mascot>');
  const adopted = await page.evaluate(async (src) => {
    const el = document.getElementById('early') as HTMLElement & { shape: string };
    el.shape = 'orb';
    const script = document.createElement('script');
    script.type = 'module';
    script.src = src;
    const loaded = new Promise((resolve) => script.addEventListener('load', resolve));
    document.head.append(script);
    await loaded;
    await customElements.whenDefined('agent-mascot');
    return { attr: el.getAttribute('shape'), own: Object.hasOwn(el, 'shape') };
  }, '/dist/index.js');
  expect(adopted).toEqual({ attr: 'orb', own: false });
});

test('configure sets many options, and null clears them', async ({ page }) => {
  await add(page);
  const result = await page.evaluate(() => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    el.configure({ shape: 'orb', eyeHeight: 0.7, accessories: ['ears', 'blush'], bodyWidth: 1.1 });
    const set = [el.getAttribute('shape'), el.getAttribute('eye-height'), el.getAttribute('accessories')];
    el.configure({ bodyWidth: null });
    return { set, width: el.hasAttribute('body-width') };
  });
  expect(result).toEqual({ set: ['orb', '0.7', 'ears blush'], width: false });
});

test('a colour change touches no SVG node', async ({ page }) => {
  await add(page, { shape: 'cloud', material: 'frost', accessories: 'ears ring', size: '200', float: '0' });
  const mutations = await page.evaluate(async () => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    el.motion = 0;
    el.blink = 0;
    el.glance = 0;
    await new Promise(requestAnimationFrame);
    const svgRoots = [...(el.shadowRoot as ShadowRoot).querySelectorAll('svg')];
    const before = svgRoots.map((svg) => svg.querySelector('*'));
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    for (const root of svgRoots) observer.observe(root, { childList: true, subtree: true });
    el.color = 'tomato';
    el.accent = 'rebeccapurple';
    el.eyeColor = '#222';
    el.sky = 'auto';
    await new Promise(requestAnimationFrame);
    observer.disconnect();
    return { records: records.length, same: svgRoots.every((svg, i) => svg.querySelector('*') === before[i]) };
  });
  expect(mutations).toEqual({ records: 0, same: true });
});

test('colour flows through CSS, including var() tokens from the page', async ({ page }) => {
  await page.addStyleTag({ content: ':root { --mascot-color: rgb(255, 0, 0); }' });
  await add(page, { size: '200' });
  const color = await page.evaluate(() => {
    const el = document.querySelector('agent-mascot') as HTMLElement;
    const stop = el.shadowRoot?.querySelector('#core stop:nth-child(2)') as SVGStopElement;
    const red = getComputedStyle(stop).stopColor;
    document.documentElement.style.setProperty('--mascot-color', 'rgb(0, 0, 255)');
    return { red, blue: getComputedStyle(stop).stopColor };
  });
  expect(color.red).not.toBe(color.blue);
  expect(color.red).toMatch(/oklch|color|rgb/);
});

test('numeric changes patch attributes without rebuilding', async ({ page }) => {
  await add(page, { size: '200', accessories: 'ears ring leaf spots' });
  const result = await page.evaluate(async () => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    const root = el.shadowRoot as ShadowRoot;
    const body = root.querySelector('#bp') as SVGPathElement;
    const count = root.querySelectorAll('*').length;
    const before = body.getAttribute('transform');
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(root, { childList: true, subtree: true });
    el.bodyWidth = 1.3;
    el.bodyHeight = 0.8;
    el.softness = 0.9;
    el.eyeWidth = 1.5;
    el.eyeY = 0.4;
    await Promise.resolve();
    await new Promise(requestAnimationFrame);
    observer.disconnect();
    return {
      added: records.filter((r) => r.addedNodes.length).length,
      same: root.querySelector('#bp') === body,
      count: root.querySelectorAll('*').length === count,
      changed: body.getAttribute('transform') !== before,
    };
  });
  expect(result).toEqual({ added: 0, same: true, count: true, changed: true });
});

test('rebuilds on a structural change, once per tick', async ({ page }) => {
  await add(page, { size: '200' });
  const result = await page.evaluate(async () => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    const root = el.shadowRoot as ShadowRoot;
    const before = root.querySelector('#bp');
    el.shape = 'cloud';
    el.material = 'frost';
    el.accessories = 'ears';
    await Promise.resolve();
    await Promise.resolve();
    return {
      rebuilt: root.querySelector('#bp') !== before,
      material: root.querySelector('.tile')?.getAttribute('data-material'),
      merged: root.querySelectorAll('#sil rect').length,
    };
  });
  expect(result).toEqual({ rebuilt: true, material: 'frost', merged: 2 });
});

test('attribute changes while disconnected apply on return', async ({ page }) => {
  await add(page, { size: '200' });
  const result = await page.evaluate(async () => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    el.remove();
    el.shape = 'gem';
    document.body.append(el);
    await Promise.resolve();
    await new Promise(requestAnimationFrame);
    return el.shadowRoot?.querySelector('#bp')?.getAttribute('d')?.slice(0, 3);
  });
  expect(result).toBe('M95');
});

test('no material cuts holes for the eyes', async ({ page }) => {
  await add(page, { size: '200', material: 'frost' });
  const holes = await page.evaluate(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelectorAll('#mask path').length);
  expect(holes).toBe(0);
});

test('every shape, material and accessory builds in this engine', async ({ page }) => {
  const count = await page.evaluate(async () => {
    const { MASCOT_SHAPES, MASCOT_MATERIALS, MASCOT_ACCESSORIES } = (window as never as { api: typeof import('../../src/index.js') }).api;
    let built = 0;
    for (const shape of MASCOT_SHAPES) {
      for (const material of MASCOT_MATERIALS) {
        const el = document.createElement('agent-mascot');
        el.configure({ shape, material, size: 200, accessories: [...MASCOT_ACCESSORIES] });
        document.body.append(el);
        built += el.shadowRoot?.querySelector('.rig') ? 1 : 0;
        el.remove();
      }
    }
    return built;
  });
  expect(count).toBe(48);
});

test('frost eyes are opaque: what is behind does not show through them', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page);
  await page.setViewportSize({ width: 300, height: 300 });
  await page.addStyleTag({ content: 'body { margin: 0; background: rgb(255, 0, 0); }' });
  await add(page, { size: '240', material: 'frost', accessories: 'iridescent', 'eye-width': '2', 'eye-height': '2' });
  const points = await page.evaluate(() => {
    const root = document.querySelector('agent-mascot')?.shadowRoot as ShadowRoot;
    const eye = (root.querySelector('.eye') as SVGPathElement).getBoundingClientRect();
    return {
      // Low in the eye, where the colour is lightest.
      eye: [eye.left + eye.width / 2, eye.top + eye.height * 0.85],
      body: [120, eye.top - 30],
      outside: [4, 4],
    };
  });
  const image = (await page.screenshot()).toString('base64');
  const pixels = await page.evaluate(
    async ({ png, at }) => {
      const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
      context.drawImage(bitmap, 0, 0);
      const scale = bitmap.width / innerWidth;
      const read = ([x, y]: number[]) =>
        [...context.getImageData((x as number) * scale, (y as number) * scale, 1, 1).data].slice(0, 3);
      return { eye: read(at.eye), body: read(at.body), outside: read(at.outside) };
    },
    { png: image, at: points },
  );
  expect(pixels.outside).toEqual([255, 0, 0]);
  const [r, g, b] = pixels.eye as [number, number, number];
  expect(r - Math.max(g, b)).toBeLessThan(60);
  expect(pixels.body[1]).toBeGreaterThan(180);
});

test('announces role and label, without changing them on mood', async ({ page }) => {
  await add(page, { mood: 'working' });
  const result = await page.evaluate(() => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    const first = [el.getAttribute('role'), el.getAttribute('aria-label'), el.getAttribute('tabindex')];
    el.mood = 'success';
    const auto = el.getAttribute('aria-label');
    el.label = 'Helper';
    return { first, auto, custom: el.getAttribute('aria-label') };
  });
  expect(result).toEqual({
    first: ['img', 'Assistant, working', null],
    auto: 'Assistant, success',
    custom: 'Helper',
  });
});

test('respects a consumer aria-label', async ({ page }) => {
  await add(page, { 'aria-label': 'Mine', mood: 'error' });
  expect(await page.getAttribute('agent-mascot', 'aria-label')).toBe('Mine');
});

test('pokes on click, and on Enter and Space only when focusable', async ({ page }) => {
  await add(page, { size: '200' });
  await page.evaluate(() => {
    const w = window as never as { pokes: number };
    w.pokes = 0;
    document.addEventListener('mascot-poke', () => {
      w.pokes++;
    });
  });
  const pokes = () => page.evaluate(() => (window as never as { pokes: number }).pokes);
  await page.locator('agent-mascot').click();
  expect(await pokes()).toBe(1);
  await page.evaluate(() => {
    const el = document.querySelector('agent-mascot') as HTMLElement;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  expect(await pokes()).toBe(1);
  await page.locator('agent-mascot').evaluate((el) => el.setAttribute('tabindex', '0'));
  await page.locator('agent-mascot').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect(await pokes()).toBe(3);
});

test('mascot-poke crosses shadow roots', async ({ page }) => {
  const received = await page.evaluate(async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const el = document.createElement('agent-mascot');
    shadow.append(el);
    document.body.append(host);
    const event = new Promise<boolean>((resolve) => document.addEventListener('mascot-poke', () => resolve(true)));
    el.poke();
    return event;
  });
  expect(received).toBe(true);
});

test('reduced motion: no loop, still poses, and poke still winks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page);
  await add(page, { size: '200' });
  const result = await page.evaluate(async () => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    const root = el.shadowRoot as ShadowRoot;
    const rig = root.querySelector('.rig') as HTMLElement;
    const eyes = root.querySelectorAll<SVGPathElement>('.eye');
    const right = eyes[1] as SVGPathElement;
    const a = rig.style.transform;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const b = rig.style.transform;
    const open = right.getAttribute('d');
    el.poke();
    const wink = right.getAttribute('d');
    await new Promise((resolve) => setTimeout(resolve, 450));
    return { still: a === b, winked: wink !== open, reopened: right.getAttribute('d') === open };
  });
  expect(result).toEqual({ still: true, winked: true, reopened: true });
});

test('reacts when the motion preference changes at runtime', async ({ page }) => {
  await add(page, { size: '200' });
  const moved = async () => {
    await page.waitForTimeout(50);
    return page.evaluate(async () => {
      const rig = document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.rig') as HTMLElement;
      const a = rig.style.transform;
      await new Promise((resolve) => setTimeout(resolve, 200));
      return a !== rig.style.transform;
    });
  };
  expect(await moved()).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await moved()).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await moved()).toBe(true);
});

test('off-screen mascots do no per-frame work', async ({ page }) => {
  await page.addStyleTag({ content: 'agent-mascot { position: absolute; top: 5000px; }' });
  await add(page, { size: '200' });
  const moved = await page.evaluate(async () => {
    const rig = document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.rig') as HTMLElement;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const a = rig.style.transform;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return a !== rig.style.transform;
  });
  expect(moved).toBe(false);
});

test('falls back on invalid values and warns once', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await add(page, { material: 'wood', color: 'not-a-color', shape: 'nope', size: '200' });
  const result = await page.evaluate(() => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    return { material: el.material, color: el.color, shape: el.shape };
  });
  expect(result).toEqual({ material: 'glow', color: 'var(--mascot-color, #18c2a0)', shape: 'blob' });
  expect(warnings.filter((w) => w.includes('wood'))).toHaveLength(1);
});

test('registerShape draws a custom shape and rejects a bad one', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { registerShape } = (window as never as { api: typeof import('../../src/index.js') }).api;
    const path = 'M120 70L180 180H60Z';
    registerShape('tri', { path, eyes: { y: 140, w: 14, h: 24, gap: 14 } });
    const el = document.createElement('agent-mascot');
    el.configure({ shape: 'tri', size: 200 });
    document.body.append(el);
    let threw = false;
    try {
      registerShape('bad', { path: '<script>', eyes: { y: 1, w: 1, h: 1, gap: 1 } });
    } catch {
      threw = true;
    }
    return { d: el.shadowRoot?.querySelector('#bp')?.getAttribute('d') === path, threw };
  });
  expect(result).toEqual({ d: true, threw: true });
});

test('a shape registered after first render replaces the fallback', async ({ page }) => {
  await add(page, { shape: 'latecomer', size: '200' });
  const d = await page.evaluate(async () => {
    const { registerShape } = (window as never as { api: typeof import('../../src/index.js') }).api;
    registerShape('latecomer', { path: 'M60 60H180V180H60Z', eyes: { y: 120, w: 14, h: 24, gap: 14 } });
    await Promise.resolve();
    await Promise.resolve();
    return document.querySelector('agent-mascot')?.shadowRoot?.querySelector('#bp')?.getAttribute('d');
  });
  expect(d).toBe('M60 60H180V180H60Z');
});

test('registering something unrelated does not rebuild other mascots', async ({ page }) => {
  await add(page, { size: '200' });
  const same = await page.evaluate(async () => {
    const { registerShape } = (window as never as { api: typeof import('../../src/index.js') }).api;
    const root = document.querySelector('agent-mascot')?.shadowRoot as ShadowRoot;
    const before = root.querySelector('#bp');
    registerShape('unrelated', { path: 'M0 0Z', eyes: { y: 1, w: 1, h: 1, gap: 1 } });
    await Promise.resolve();
    await Promise.resolve();
    return root.querySelector('#bp') === before;
  });
  expect(same).toBe(true);
});

test('sky toggles the tile, and shadow can be hidden', async ({ page }) => {
  await add(page, { size: '200', sky: 'rgb(10, 20, 30), rgb(40, 50, 60)', shadow: 'none' });
  const result = await page.evaluate(() => {
    const root = document.querySelector('agent-mascot')?.shadowRoot as ShadowRoot;
    const tile = root.querySelector('.tile') as HTMLElement;
    const style = getComputedStyle(tile);
    return {
      mode: tile.getAttribute('data-sky'),
      image: style.backgroundImage.includes('rgb(10, 20, 30)'),
      radius: style.borderTopLeftRadius,
      shadow: root.querySelector('.shadow')?.getAttribute('display'),
    };
  });
  expect(result).toEqual({ mode: 'two', image: true, radius: '22%', shadow: 'none' });
});

test('is transparent by default', async ({ page }) => {
  await add(page, { size: '200' });
  const background = await page.evaluate(() => {
    const tile = document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.tile') as HTMLElement;
    return getComputedStyle(tile).backgroundImage;
  });
  expect(background).toBe('none');
});

test('lookAt moves the eyes and lookAway releases them', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page);
  await add(page, { size: '200' });
  const result = await page.evaluate(() => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    const eyes = el.shadowRoot?.querySelector('.eyes') as SVGElement;
    const start = eyes.style.transform;
    el.lookAt(2000, 100);
    const looking = eyes.style.transform;
    el.lookAway();
    return { moved: start !== looking, back: eyes.style.transform === start };
  });
  expect(result).toEqual({ moved: true, back: true });
});

test('stays out of the page: no styles leak, and many mascots share one sheet', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const a = document.createElement('agent-mascot');
    const b = document.createElement('agent-mascot');
    document.body.append(a, b);
    await new Promise(requestAnimationFrame);
    return {
      shared: a.shadowRoot?.adoptedStyleSheets[0] === b.shadowRoot?.adoptedStyleSheets[0],
      styleTags: document.querySelectorAll('style').length,
    };
  });
  expect(result).toEqual({ shared: true, styleTags: 0 });
});
