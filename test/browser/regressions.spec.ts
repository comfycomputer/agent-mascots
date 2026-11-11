import { expect, type Page, test } from '@playwright/test';

const HARNESS = '/test/browser/harness.html';
type Mascot = HTMLElementTagNameMap['agent-mascot'];

const frames = (count = 2) => `(async () => { for (let i = 0; i < ${count}; i++) await new Promise(requestAnimationFrame); })()`;

/** Run in the page with a fresh, rendered mascot as `el`. */
function inPage<T>(page: Page, attrs: Record<string, string>, body: string): Promise<T> {
  return page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const tick = () => new Promise(requestAnimationFrame);
    // Until visibility is known a mascot draws at rest, however many frames have passed.
    const live = async () => {
      const { activeTicks } = await import('/dist/motion/loop.js');
      while (!activeTicks()) await wait(10);
    };
    const el = document.createElement('agent-mascot');
    for (const [k, v] of Object.entries(${JSON.stringify(attrs)})) el.setAttribute(k, v);
    document.body.append(el);
    await ${frames()};
    const root = el.shadowRoot;
    const q = (s) => root.querySelector(s);
    ${body}
  })()`) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
});

test.describe('documents', () => {
  for (const moved of [false, true]) {
    test(`${moved ? 'moving a working mascot' : 'a new mascot'} into an iframe keeps it styled`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const result = await page.evaluate(async (move) => {
        const frame = document.createElement('iframe');
        document.body.append(frame);
        const doc = frame.contentDocument as Document;
        const el = document.createElement('agent-mascot');
        if (move) document.body.append(el);
        await new Promise(requestAnimationFrame);
        doc.body.append(el);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        let poked = 0;
        el.addEventListener('mascot-poke', () => poked++);
        const tile = (el.shadowRoot as ShadowRoot).querySelector('.tile') as HTMLElement;
        tile.click();
        return {
          sheets: el.shadowRoot?.adoptedStyleSheets.length,
          position: frame.contentWindow?.getComputedStyle(tile).position,
          poked,
        };
      }, moved);
      expect(errors).toEqual([]);
      expect(result).toEqual({ sheets: 1, position: 'absolute', poked: 1 });
    });
  }

  test('a mascot in a document with no window falls back to a style element', async ({ page }) => {
    const styled = await page.evaluate(() => {
      const doc = document.implementation.createHTMLDocument();
      const el = document.createElement('agent-mascot');
      doc.body.append(el);
      return el.shadowRoot?.querySelector('style')?.textContent?.includes(':host');
    });
    expect(styled).toBe(true);
  });
});

test.describe('naming', () => {
  test('removing `label` returns to the default, and it keeps following the mood', async ({ page }) => {
    const names = await inPage<string[]>(page, { label: 'Bob' }, `
      const a = el.getAttribute('aria-label');
      el.removeAttribute('label');
      const b = el.getAttribute('aria-label');
      el.mood = 'thinking';
      return [a, b, el.getAttribute('aria-label')];`);
    expect(names).toEqual(['Bob', 'Assistant, idle', 'Assistant, thinking']);
  });

  test('a consumer aria-label set after mount survives mood changes and a move', async ({ page }) => {
    const name = await inPage<string>(page, {}, `
      el.setAttribute('aria-label', 'Helper bot');
      el.mood = 'thinking';
      document.body.append(el);
      return el.getAttribute('aria-label');`);
    expect(name).toBe('Helper bot');
  });

  test('a clone follows the mood, and a blank label means the default', async ({ page }) => {
    const names = await inPage<string[]>(page, {}, `
      const clone = el.cloneNode(true);
      document.body.append(clone);
      clone.mood = 'error';
      el.label = '   ';
      return [clone.getAttribute('aria-label'), el.getAttribute('aria-label')];`);
    expect(names).toEqual(['Assistant, error', 'Assistant, idle']);
  });

  test('a decorative role gets no automatic name', async ({ page }) => {
    const name = await inPage<string | null>(page, { role: 'presentation' }, `
      el.mood = 'thinking';
      return el.getAttribute('aria-label');`);
    expect(name).toBeNull();
  });
});

const pointerAt = (node: Element, clientX: number) =>
  node.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY: 300, bubbles: true }));

test.describe('motion state', () => {
  test.describe('reduced', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('disconnecting during a poke does not leave an eye shut', async ({ page }) => {
      const same = await inPage<boolean>(page, { size: '200' }, `
        const eye = () => root.querySelectorAll('.eye')[1].getAttribute('d');
        const open = eye();
        el.poke();
        el.remove();
        await wait(50);
        document.body.append(el);
        await wait(500);
        return eye() === open;`);
      expect(same).toBe(true);
    });

    test('the flame rests on its own outline, however it is mounted', async ({ page }) => {
      const heads = await inPage<string[]>(page, { shape: 'flame', size: '160' }, `
        const other = document.createElement('agent-mascot');
        other.setAttribute('shape', 'flame');
        other.setAttribute('detail', 'full');
        document.body.append(other);
        await tick(); await tick();
        return [q('#bp').getAttribute('d'), other.shadowRoot.querySelector('#bp').getAttribute('d')];`);
      expect(heads[0]).toBe(heads[1]);
      expect(heads[0]).toMatch(/^M117 46/);
    });

    test('runs no opacity transition on a mood change', async ({ page }) => {
      const animations = await inPage<number>(page, { size: '32' }, `
        el.mood = 'sleeping';
        await tick();
        return root.getAnimations().length;`);
      expect(animations).toBe(0);
    });

    test('a replaced selector target is followed without any frame running', async ({ page }) => {
      await page.addScriptTag({ content: `window.pointerAt = ${pointerAt}` });
      const eyes = await page.evaluate(async () => {
        const { pointerAt: move } = window as unknown as { pointerAt: typeof pointerAt };
        const box = document.createElement('div');
        box.id = 'box';
        box.style.cssText = 'position:fixed;inset:0';
        document.body.append(box);
        const el = document.createElement('agent-mascot');
        el.setAttribute('track', '#box');
        el.setAttribute('track-reach', '4');
        el.style.position = 'relative';
        el.style.zIndex = '1';
        document.body.append(el);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        const layer = el.shadowRoot?.querySelector('.eyes') as SVGElement;
        move(box, 900);
        await new Promise((resolve) => setTimeout(resolve, 30));
        const before = layer.style.transform;
        const next = box.cloneNode() as Element;
        box.replaceWith(next);
        await new Promise((resolve) => setTimeout(resolve, 30));
        move(next, 500);
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { before, after: layer.style.transform };
      });
      expect(eyes.after).not.toBe(eyes.before);
    });
  });

  test('a poke while off-screen does not play when the mascot comes back', async ({ page }) => {
    const changes = await inPage<number>(page, { blink: '0', glance: '0', float: '0' }, `
      el.style.marginTop = '4000px';
      await wait(120);
      el.poke();
      el.scrollIntoView();
      const seen = new Set();
      for (let i = 0; i < 40; i++) { await tick(); seen.add(root.querySelectorAll('.eye')[1].getAttribute('d')); }
      return seen.size;`);
    expect(changes).toBe(1);
  });

  test('moving a mascot in the DOM eases rather than snaps', async ({ page }) => {
    const first = await inPage<number>(page, { size: '200', glance: '0' }, `
      await live();
      el.lookAt(innerWidth * 2, 100);
      document.body.append(el);
      await tick();
      return Number(/translate\\(([-\\d.]+)/.exec(q('.eyes').style.transform)?.[1] ?? 0);`);
    expect(first).toBeLessThan(2);
  });

  test('a structural change after the frame still has eyes when it paints', async ({ page }) => {
    const paths = await inPage<(string | null)[]>(page, { size: '200' }, `
      await new Promise((resolve) => new ResizeObserver((_, o) => {
        o.disconnect();
        el.setAttribute('material', 'frost');
        queueMicrotask(resolve);
      }).observe(el));
      await Promise.resolve();
      return [...root.querySelectorAll('.eye')].map((eye) => eye.getAttribute('d'));`);
    expect(paths.every(Boolean)).toBe(true);
  });

  test('one mascot failing leaves the shared loop running for the others', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const moving = await inPage<boolean>(page, { size: '200' }, `
      const transforms = new Set();
      const bad = document.createElement('agent-mascot');
      bad.setAttribute('size', '200');
      document.body.append(bad);
      await tick(); await tick();
      Object.defineProperty(bad.shadowRoot.querySelector('.rig').style, 'transform', { set() { throw new Error('boom'); } });
      for (let i = 0; i < 12; i++) { await tick(); transforms.add(q('.rig').style.transform); }
      return transforms.size > 3;`);
    expect(moving).toBe(true);
    expect(errors).toContain('boom');
  });
});

test.describe('structure', () => {
  test('a shape registered while disconnected applies on reconnect', async ({ page }) => {
    const path = await inPage<string>(page, { shape: 'later', size: '200' }, `
      el.remove();
      await wait(0);
      window.api.registerShape('later', { path: 'M60 60H180V180H60Z', eyes: { y: 120, w: 14, h: 24, gap: 14 } });
      document.body.append(el);
      await tick(); await tick();
      return q('#bp').getAttribute('d');`);
    expect(path).toBe('M60 60H180V180H60Z');
  });

  test('registering a name again updates mascots already using it', async ({ page }) => {
    const path = await inPage<string>(page, {}, `
      const shape = (d) => window.api.registerShape('again', { path: d, eyes: { y: 120, w: 14, h: 24, gap: 14 } });
      shape('M60 60H180V180H60Z');
      el.setAttribute('shape', 'again');
      await tick(); await tick();
      shape('M70 70H170V170H70Z');
      await tick(); await tick();
      return q('.simple-body, #bp').getAttribute('d');`);
    expect(path).toBe('M70 70H170V170H70Z');
  });

  test('layout changes off-screen touch nothing until the mascot is seen', async ({ page }) => {
    const result = await inPage<{ offscreen: number; applied: boolean }>(page, { size: '200' }, `
      el.style.marginTop = '4000px';
      await wait(120);
      const before = q('#bp').getAttribute('transform');
      el.bodyWidth = 1.3;
      await wait(30);
      const offscreen = q('#bp').getAttribute('transform') === before ? 0 : 1;
      el.scrollIntoView();
      await wait(120);
      return { offscreen, applied: q('#bp').getAttribute('transform') !== before };`);
    expect(result).toEqual({ offscreen: 0, applied: true });
  });

  test('unknown accessories fall back to the shape defaults', async ({ page }) => {
    const list = await inPage<string[]>(page, { shape: 'gem', accessories: 'banana' }, 'return el.accessories;');
    expect(list).toEqual(['facets', 'sheen']);
  });

  test('configure ignores inherited object keys', async ({ page }) => {
    const names = await inPage<string[]>(page, {}, `
      el.configure(JSON.parse('{"toString":"x","constructor":"y","hasOwnProperty":"z"}'));
      return el.getAttributeNames();`);
    expect(names).not.toContain('undefined');
  });
});

const boxOf = (page: Page, css: string, attrs = '') =>
  page.evaluate(
    async ([style, extra]) => {
      document.body.innerHTML = `<agent-mascot style="${style}" ${extra}></agent-mascot>`;
      await new Promise(requestAnimationFrame);
      const { width, height } = (document.querySelector('agent-mascot') as Element).getBoundingClientRect();
      return [width, height];
    },
    [css, attrs],
  );

test.describe('sizing', () => {
  test('stays 1:1 whichever dimension CSS sets', async ({ page }) => {
    expect(await boxOf(page, '')).toEqual([240, 240]);
    expect(await boxOf(page, 'width:100px')).toEqual([100, 100]);
    expect(await boxOf(page, 'height:100px')).toEqual([100, 100]);
    expect(await boxOf(page, 'display:block')).toEqual([240, 240]);
  });

  test('`size` wins over CSS without touching it', async ({ page }) => {
    expect(await boxOf(page, 'height:50px', 'size="100"')).toEqual([100, 100]);
    const width = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as Mascot;
      el.style.width = '70px';
      el.removeAttribute('size');
      el.style.height = '';
      await new Promise(requestAnimationFrame);
      return [el.style.width, el.getBoundingClientRect().width];
    });
    expect(width).toEqual(['70px', 70]);
  });

  test('the documented :not(:defined) rule leaves nothing to shift', async ({ page }) => {
    await page.goto(HARNESS.replace('harness.html', 'blank.html'));
    await page.setContent(`<!doctype html><style>
      agent-mascot { width: 96px; }
      agent-mascot:not(:defined) { display: inline-block; aspect-ratio: 1; vertical-align: middle; }
    </style><p style="font:16px/20px sans-serif">before <agent-mascot></agent-mascot> after</p><div id=next>next</div>`);
    const top = () => page.evaluate(() => (document.querySelector('#next') as Element).getBoundingClientRect().top);
    const before = await top();
    await page.addScriptTag({ type: 'module', url: '/dist/cdn.js' });
    await page.waitForFunction(() => customElements.get('agent-mascot'));
    await page.evaluate(frames());
    expect(await top()).toBe(before);
  });
});

test.describe('input', () => {
  test('non-finite lookAt is ignored, and the mascot keeps moving', async ({ page }) => {
    const result = await inPage<{ bad: boolean; moving: number }>(page, { size: '200' }, `
      el.lookAt(NaN, NaN);
      el.lookAt(Infinity, 0);
      el.lookAt(undefined, undefined);
      el.lookAway();
      await wait(100);
      const seen = new Set();
      for (let i = 0; i < 10; i++) { await tick(); seen.add(q('.rig').style.transform); }
      return { bad: [...seen].join().includes('NaN'), moving: seen.size };`);
    expect(result.bad).toBe(false);
    expect(result.moving).toBeGreaterThan(3);
  });

  test('a held lookAt follows the mascot and track-reach', async ({ page }) => {
    const eyes = await inPage<string[]>(page, { size: '120', 'track-reach': '4', glance: '0', float: '0' }, `
      el.style.position = 'fixed';
      el.style.left = '100px';
      await wait(50);
      const shift = () => Number(/translate\\(([-\\d.]+)/.exec(q('.eyes').style.transform)?.[1]);
      el.lookAt(500, 160);
      await wait(900);
      const right = shift();
      el.style.left = '800px';
      await wait(1200);
      return [right > 0, shift() < 0];`);
    expect(eyes).toEqual([true, true]);
  });

  test('a stopped pointer hands the eyes back to the mood', async ({ page }) => {
    const eyes = await inPage<string[]>(page, { track: 'window', mood: 'thinking', size: '200' }, `
      await live();
      const up = () => Number(/, ([-\\d.]+)%/.exec(q('.eyes').style.transform)?.[1]) < 0;
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth, clientY: innerHeight }));
      await wait(700);
      const following = up();
      await wait(2600);
      return [following, up()];`);
    expect(eyes).toEqual([false, true]);
  });

  test('held keys poke once, and modified shortcuts pass through', async ({ page }) => {
    const result = await inPage<{ pokes: number; prevented: boolean[] }>(page, { tabindex: '0' }, `
      let pokes = 0;
      el.addEventListener('mascot-poke', () => pokes++);
      const press = (init) => {
        const event = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init });
        el.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const prevented = [
        press({ key: 'Enter' }),
        press({ key: ' ', repeat: true }),
        press({ key: 'Enter', ctrlKey: true }),
        press({ key: 'Enter', metaKey: true }),
        press({ key: ' ', altKey: true }),
      ];
      return { pokes, prevented };`);
    expect(result).toEqual({ pokes: 1, prevented: [true, true, false, false, false] });
  });

  test('turning gyro off during the prompt wins', async ({ page }) => {
    const on = await inPage<boolean>(page, {}, `
      DeviceOrientationEvent.requestPermission = () => new Promise((r) => setTimeout(r, 60, 'granted'));
      const answer = el.enableGyro();
      el.gyro = false;
      await answer;
      return el.hasAttribute('gyro');`);
    expect(on).toBe(false);
  });
});

test.describe('values', () => {
  test('a colour cannot make the page fetch', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (request) => request.url().includes('evil') && fetched.push(request.url()));
    await inPage(page, { size: '40' }, `
      const evil = 'var(--n, url(/evil.svg#a))';
      for (const [name, value] of [['color', evil], ['accent', evil], ['eye-color', evil],
        ['color', 'var(--n, ur\\\\\\\\6c(/evil.svg#a))'], ['sky', evil]]) el.setAttribute(name, value);
      el.mood = 'listening';
      await wait(150);`);
    expect(fetched).toEqual([]);
  });

  test('the sky property reports what is used', async ({ page }) => {
    const sky = await inPage<string>(page, { sky: 'zzz' }, 'return el.sky;');
    expect(sky).toBe('none');
  });
});

test.describe('without relative colour', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/dist/**/*.js', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replaceAll('oklch(from red l c h)', 'nonsense(1)');
      await route.fulfill({ response, body });
    });
    await page.goto(HARNESS);
    await page.waitForFunction(() => 'ready' in window);
  });

  test('an auto sky stays distinct from the flat body', async ({ page }) => {
    const [sky, body] = await inPage<string[]>(page, { sky: 'auto', size: '32' }, `
      return [getComputedStyle(q('.tile')).backgroundImage, getComputedStyle(q('.simple-body')).fill];`);
    expect(sky).not.toContain(body as string);
  });

  test('eye-color still works at the simple level', async ({ page }) => {
    const fill = await inPage<string>(page, { 'eye-color': 'rgb(255, 0, 0)', size: '32' }, `
      return getComputedStyle(q('.simple-eye')).fill;`);
    expect(fill).toBe('rgb(255, 0, 0)');
  });
});

test('both detail levels paint the eyes the same colour, in every material', async ({ page }) => {
  const colours = ['#18c2a0', '#3b82f6', '#f25c3b', '#f5b301', '#111827', '#f8fafc'];
  const failures = await page.evaluate((list) => {
    const out: string[] = [];
    for (const material of ['glow', 'frost', 'glass']) {
      for (const color of list) {
        const fills = ['full', 'simple'].map((detail) => {
          const el = document.createElement('agent-mascot');
          for (const [name, value] of Object.entries({ detail, material, color, size: '120' })) el.setAttribute(name, value);
          document.body.append(el);
          const root = el.shadowRoot as ShadowRoot;
          // Full paints a gradient through --e1 at its middle; simple paints --e1 flat.
          const fill = detail === 'full'
            ? getComputedStyle(root.querySelector('.tile') as Element).getPropertyValue('--e1')
            : getComputedStyle(root.querySelector('.simple-eye') as Element).fill;
          el.remove();
          return fill;
        });
        const probe = document.createElement('i');
        document.body.append(probe);
        const [full, simple] = fills.map((fill) => ((probe.style.color = fill), getComputedStyle(probe).color));
        probe.remove();
        if (full !== simple) out.push(`${material} ${color}: ${full} vs ${simple}`);
      }
    }
    return out;
  }, colours);
  expect(failures).toEqual([]);
});

test.describe('forced colors', () => {
  test.use({ contextOptions: { forcedColors: 'active' } });

  test('uses system colours, with solid eyes and a clear body', async ({ page }) => {
    const paint = await inPage<string[]>(page, { size: '32' }, `
      const probe = document.createElement('i');
      probe.style.color = 'CanvasText';
      document.body.append(probe);
      const text = getComputedStyle(probe).color;
      return [getComputedStyle(q('.simple-eye')).fill, text];`);
    expect(paint[0]).toBe(paint[1]);
  });

  test('full detail draws a solid outline, which no size can blur away', async ({ page }) => {
    const paint = await inPage<string[]>(page, { size: '160', detail: 'full' }, `
      const probe = document.createElement('i');
      probe.style.color = 'CanvasText';
      document.body.append(probe);
      const edge = getComputedStyle(q('.edge'));
      return [edge.stroke, getComputedStyle(probe).color, edge.filter];`);
    expect(paint[0]).toBe(paint[1]);
    expect(paint[2]).toBe('none');
  });
});

test('a stylesheet blocked by CSP cannot blow out the page', async ({ page }) => {
  await page.route('**/csp-fallback.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self'; connect-src 'self'" },
      body: `<!doctype html><script>delete Document.prototype.adoptedStyleSheets; delete ShadowRoot.prototype.adoptedStyleSheets;</script>
        <script type="module" src="/dist/cdn.js"></script><agent-mascot size="200"></agent-mascot>`,
    }),
  );
  await page.goto('/test/browser/csp-fallback.html');
  await page.waitForFunction(() => customElements.get('agent-mascot'));
  await page.evaluate(frames());
  const box = await page.evaluate(() => (document.querySelector('agent-mascot') as Element).getBoundingClientRect().height);
  expect(box).toBeLessThanOrEqual(240);
});

test('the build only renames its own properties, never an SVG attribute', async ({ page }) => {
  // `set(el, { cy })` is a plain object key: renaming it writes a meaningless attribute.
  const stray = await inPage<string[]>(page, { shape: 'cap', material: 'glass', accessories: 'spots blush rays bubbles', size: '200' }, `
    const known = /^(?:[a-z-]+|[a-z]+[A-Z][a-zA-Z]+|x1|x2|y1|y2|in2)$/;
    const names = [...root.querySelectorAll('*')].flatMap((node) => node.getAttributeNames());
    const centred = [...root.querySelectorAll('ellipse, circle')].filter((node) => !node.hasAttribute('cy'));
    return [...new Set(names.filter((name) => !known.test(name))), ...centred.map((node) => node.outerHTML)];`);
  expect(stray).toEqual([]);
});
