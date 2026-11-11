import { expect, type Page, test } from '@playwright/test';

const HARNESS = '/test/browser/harness.html';
const MOODS = ['idle', 'thinking', 'working', 'success', 'error', 'listening', 'speaking', 'waiting', 'sleeping'];

/** Which particles belong to which mood. */
const PARTICLES: Record<string, string> = {
  thinking: '.fx',
  working: '.fx-spark',
  success: '.fx-accent',
  error: '.fx-sweat',
  listening: '.fx-line',
  speaking: '.fx-mouth',
  waiting: '.fx-line',
  sleeping: '.fx-line',
};

async function load(page: Page): Promise<void> {
  await page.goto(HARNESS);
  await page.waitForFunction(() => 'ready' in window);
  await page.evaluate(async () => {
    const win = window as unknown as Record<string, unknown>;
    win.loop = await import('/dist/motion/loop.js' as string);
    win.nextFrames = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    win.activeTicks = () => (win.loop as { activeTicks(): number }).activeTicks();
    // How many attribute or child writes land in the shadow root while `act` runs.
    win.writes = async (el: Element, act: () => Promise<unknown>) => {
      const seen: MutationRecord[] = [];
      const observer = new MutationObserver((records) => seen.push(...records));
      observer.observe(el.shadowRoot as ShadowRoot, { subtree: true, attributes: true, childList: true });
      await act();
      seen.push(...observer.takeRecords());
      observer.disconnect();
      // A mood is a data attribute for styling; that is not a redraw.
      return seen.filter((record) => record.attributeName !== 'data-mood').length;
    };
  });
}

async function add(page: Page, attributes: Record<string, string> = {}, style = ''): Promise<void> {
  await page.evaluate(
    async ([attrs, css]) => {
      const el = document.createElement('agent-mascot');
      el.id = 'm';
      el.setAttribute('detail', 'full');
      el.setAttribute('style', css as string);
      for (const [name, value] of Object.entries(attrs as Record<string, string>)) el.setAttribute(name, value);
      document.body.append(el);
      await window.nextFrames();
      await window.nextFrames();
    },
    [attributes, style],
  );
}

const ticks = (page: Page) => page.evaluate(() => (window as unknown as { activeTicks(): number }).activeTicks());

declare global {
  interface Window {
    nextFrames(): Promise<void>;
    writes(el: Element, act: () => Promise<unknown>): Promise<number>;
  }
}

const mascot = 'document.querySelector("agent-mascot")';

/** Particles of a selector that are in a shown group. */
const visibleParticles = (page: Page, selector: string) =>
  page.evaluate(
    ([sel]) =>
      [...(document.querySelector('agent-mascot')?.shadowRoot?.querySelectorAll(sel as string) ?? [])].filter(
        (node) => !(node.parentElement as Element).hasAttribute('display') && node.getAttribute('opacity') !== '0',
      ).length,
    [selector],
  );

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await load(page);
  (page as Page & { errors?: string[] }).errors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors).toEqual([]);
});

test.describe('the frame loop', () => {
  test('shares one animation frame between mascots', async ({ page }) => {
    const ratio = await page.evaluate(async () => {
      const native = window.requestAnimationFrame.bind(window);
      let requests = 0;
      window.requestAnimationFrame = (callback) => {
        requests++;
        return native(callback);
      };
      for (let i = 0; i < 5; i++) {
        const el = document.createElement('agent-mascot');
        el.setAttribute('size', '100');
        document.body.append(el);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      requests = 0;
      let frames = 0;
      await new Promise<void>((resolve) => {
        const count = () => {
          if (++frames === 30) resolve();
          else native(count);
        };
        native(count);
      });
      return requests / frames;
    });
    expect(await ticks(page)).toBe(5);
    expect(ratio).toBeLessThanOrEqual(1.2);
  });

  test('does no work off-screen', async ({ page }) => {
    await add(page, { size: '200', mood: 'working' }, 'position:absolute;top:9000px');
    await expect.poll(() => ticks(page)).toBe(0);
    const writes = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      return window.writes(el, async () => {
        for (let i = 0; i < 20; i++) {
          el.level = i / 20;
          el.mood = i % 2 ? 'speaking' : 'working';
          await new Promise(requestAnimationFrame);
        }
      });
    });
    expect(writes).toBe(0);
  });

  test('resumes in the right pose when scrolled back into view', async ({ page }) => {
    await add(page, { size: '200' }, 'position:absolute;top:9000px');
    await expect.poll(() => ticks(page)).toBe(0);
    await page.evaluate(() => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      el.mood = 'success';
      el.scrollIntoView();
    });
    await expect.poll(() => ticks(page)).toBe(1);
    await expect.poll(() => visibleParticles(page, PARTICLES.success as string)).toBe(4);
    await page.evaluate(() => scrollTo(0, 0));
    await expect.poll(() => ticks(page)).toBe(0);
  });

  test('draws a mascot that starts off-screen, so a full-page capture is not blank', async ({ page }) => {
    await add(page, { size: '200' }, 'position:absolute;top:9000px');
    const eye = await page.evaluate(() =>
      document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.eye')?.getAttribute('d'),
    );
    expect(eye).toBeTruthy();
  });

  test('stops with the element', async ({ page }) => {
    await add(page, { size: '200' });
    await expect.poll(() => ticks(page)).toBe(1);
    await page.evaluate(() => document.querySelector('agent-mascot')?.remove());
    expect(await ticks(page)).toBe(0);
  });
});

test.describe('moods', () => {
  test('never adds or removes nodes on a mood change', async ({ page }) => {
    await add(page, { size: '200' });
    const changes = await page.evaluate(async (moods) => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      const seen: MutationRecord[] = [];
      const observer = new MutationObserver((records) => seen.push(...records));
      observer.observe(el.shadowRoot as ShadowRoot, { subtree: true, childList: true });
      for (const mood of moods) {
        el.setAttribute('mood', mood);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      }
      seen.push(...observer.takeRecords());
      observer.disconnect();
      return seen.length;
    }, MOODS);
    expect(changes).toBe(0);
  });

  test('cross-fades particles in and out', async ({ page }) => {
    await add(page, { size: '200', mood: 'thinking' });
    await expect.poll(() => visibleParticles(page, PARTICLES.thinking as string)).toBeGreaterThan(0);
    const opacity = (selector: string) =>
      page.evaluate(
        ([sel]) =>
          document
            .querySelector('agent-mascot')
            ?.shadowRoot?.querySelector(sel as string)
            ?.parentElement?.getAttribute('opacity'),
        [selector],
      );
    const early = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      el.mood = 'error';
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return el.shadowRoot?.querySelector('.fx-sweat')?.parentElement?.getAttribute('opacity');
    });
    expect(Number(early)).toBeGreaterThan(0);
    expect(Number(early)).toBeLessThan(1);
    await expect.poll(() => opacity('.fx-sweat')).toBe('1');
    await expect.poll(() => visibleParticles(page, '.fx')).toBe(0);
  });

  test('draws no particles in idle or at the simple level', async ({ page }) => {
    await add(page, { size: '200' });
    for (const selector of Object.values(PARTICLES)) {
      await expect.poll(() => visibleParticles(page, selector)).toBe(0);
    }
    await page.evaluate(() => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      el.mood = 'working';
      el.detail = 'simple';
    });
    await expect.poll(() => visibleParticles(page, '.fx')).toBe(0);
  });

  test('keeps particles through a rebuild and a detail swap', async ({ page }) => {
    await add(page, { size: '200', mood: 'success' });
    await expect.poll(() => visibleParticles(page, PARTICLES.success as string)).toBe(4);
    await page.evaluate(() => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      el.shape = 'orb';
      el.material = 'frost';
    });
    await page.evaluate(`${mascot}.detail = 'simple'`);
    await page.evaluate(() => window.nextFrames());
    await page.evaluate(`${mascot}.detail = 'full'`);
    await expect.poll(() => visibleParticles(page, PARTICLES.success as string)).toBe(4);
  });

  test('keeps the mouth with the eyes across a material rebuild while speaking', async ({ page }) => {
    await add(page, { size: '200', mood: 'speaking', level: '0.6' });
    await expect.poll(() => visibleParticles(page, '.fx-mouth')).toBe(1);
    await page.evaluate(`${mascot}.material = 'glass'`);
    await page.evaluate(() => window.nextFrames());
    await expect.poll(() => visibleParticles(page, '.fx-mouth')).toBe(1);
  });

  test('opens the mouth with level', async ({ page }) => {
    await add(page, { size: '200', mood: 'speaking', level: '0' });
    const tall = () =>
      page.evaluate(() => {
        const transform = document
          .querySelector('agent-mascot')
          ?.shadowRoot?.querySelector('.fx-mouth')
          ?.getAttribute('transform');
        return Number(/scale\(\S+ ([\d.]+)\)/.exec(transform ?? '')?.[1]);
      });
    await expect.poll(tall).toBeLessThan(0.4);
    await page.evaluate(`${mascot}.level = 1`);
    await expect.poll(tall).toBeGreaterThan(1.9);
    await page.evaluate(`${mascot}.level = 0`);
    await expect.poll(tall).toBeLessThan(0.4);
  });

  test('keeps speaking with no level set', async ({ page }) => {
    await add(page, { size: '200', mood: 'speaking' });
    const heights = await page.evaluate(async () => {
      const mouth = document.querySelector('agent-mascot')?.shadowRoot?.querySelector('.fx-mouth');
      const seen = new Set<string | null | undefined>();
      for (let i = 0; i < 40; i++) {
        seen.add(mouth?.getAttribute('transform'));
        await new Promise(requestAnimationFrame);
      }
      return seen.size;
    });
    expect(heights).toBeGreaterThan(3);
  });

  test('wilts accessories in a low mood', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await add(page, { size: '200', accessories: 'leaf rays antenna' });
    const pose = () =>
      page.evaluate(() => {
        const root = document.querySelector('agent-mascot')?.shadowRoot;
        return {
          leaf: root?.querySelector('.ac-sprig')?.parentElement?.parentElement?.getAttribute('transform'),
          // Rays sit in a long and a short group, inside the wheel that turns and shrinks.
          rays: root?.querySelector('.ac-ray')?.parentElement?.parentElement?.getAttribute('transform'),
          bulb: root?.querySelector('.ac-bulb')?.parentElement?.getAttribute('opacity'),
        };
      });
    const idle = await pose();
    await page.evaluate(`${mascot}.mood = 'error'`);
    const error = await pose();
    expect(error.leaf).not.toBe(idle.leaf);
    expect(error.rays).toContain('scale(0.9)');
    expect(Number(error.bulb)).toBeLessThan(Number(idle.bulb));
  });
});

test.describe('reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('runs no loop and writes nothing while resting', async ({ page }) => {
    await add(page, { size: '200', mood: 'working', accessories: 'ring rays' });
    expect(await ticks(page)).toBe(0);
    const writes = await page.evaluate(() =>
      window.writes(document.querySelector('agent-mascot') as Element, () => new Promise((r) => setTimeout(r, 200))),
    );
    expect(writes).toBe(0);
  });

  test('shows every mood as a still pose with its cue in place', async ({ page }) => {
    await add(page, { size: '200' });
    for (const [mood, selector] of Object.entries(PARTICLES)) {
      await page.evaluate(`${mascot}.mood = '${mood}'`);
      expect(await visibleParticles(page, selector), mood).toBeGreaterThan(0);
    }
    expect(await ticks(page)).toBe(0);
  });

  test('stays parked after a change, even at the frame the change lands', async ({ page }) => {
    await add(page, { size: '200', mood: 'speaking' });
    const writes = await page.evaluate(() => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      return window.writes(el, async () => {
        el.level = 1;
        await new Promise((r) => setTimeout(r, 60));
        el.level = 0;
        await new Promise((r) => setTimeout(r, 60));
      });
    });
    expect(writes).toBeLessThanOrEqual(30);
    expect(await ticks(page)).toBe(0);
  });

  test('pokes with a wink and starts no animation frames', async ({ page }) => {
    await add(page, { size: '200' });
    const result = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      const native = window.requestAnimationFrame;
      let requests = 0;
      window.requestAnimationFrame = (callback) => {
        requests++;
        return native.call(window, callback);
      };
      let pokes = 0;
      el.addEventListener('mascot-poke', () => pokes++);
      const eyes = () => [...(el.shadowRoot?.querySelectorAll('.eye') ?? [])].map((eye) => eye.getAttribute('d'));
      const before = eyes();
      el.poke();
      const during = eyes();
      await new Promise((r) => setTimeout(r, 500));
      const after = eyes();
      window.requestAnimationFrame = native;
      return { requests, pokes, before, during, after, rig: el.shadowRoot?.querySelector('.rig')?.getAttribute('style') };
    });
    expect(result.pokes).toBe(1);
    expect(result.requests).toBe(0);
    expect(result.during[0]).toBe(result.before[0]);
    expect(result.during[1]).not.toBe(result.before[1]);
    expect(result.after).toEqual(result.before);
  });

  test('restarts the wink cleanly when poked twice', async ({ page }) => {
    await add(page, { size: '200' });
    const open = await page.evaluate(async () => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      const eyes = () => [...(el.shadowRoot?.querySelectorAll('.eye') ?? [])].map((eye) => eye.getAttribute('d'));
      const before = eyes();
      el.poke();
      await new Promise((r) => setTimeout(r, 200));
      el.poke();
      await new Promise((r) => setTimeout(r, 200));
      const held = eyes()[1] !== before[1];
      await new Promise((r) => setTimeout(r, 300));
      return { held, back: eyes()[1] === before[1] };
    });
    expect(open).toEqual({ held: true, back: true });
  });

  test('still tracks with the eyes, jumping straight there', async ({ page }) => {
    await add(page, { size: '200' });
    const moved = await page.evaluate(() => {
      const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
      const eyes = () => (el.shadowRoot as ShadowRoot).querySelector<SVGElement>('.layer.eyes')!.style.transform;
      const rig = () => (el.shadowRoot as ShadowRoot).querySelector<HTMLElement>('.rig')!.style.transform;
      const before = { eyes: eyes(), rig: rig() };
      el.lookAt(innerWidth, 0);
      return { eyes: eyes() !== before.eyes, rig: rig() !== before.rig };
    });
    expect(moved).toEqual({ eyes: true, rig: false });
    expect(await ticks(page)).toBe(0);
  });

  test('follows the media query changing at runtime', async ({ page }) => {
    await add(page, { size: '200', mood: 'thinking' });
    expect(await ticks(page)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => ticks(page)).toBe(1);
    const rig = () => page.evaluate(() => document.querySelector('agent-mascot')!.shadowRoot!.querySelector<HTMLElement>('.rig')!.style.transform);
    const first = await rig();
    await expect.poll(rig).not.toBe(first);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => ticks(page)).toBe(0);
    await expect.poll(() => visibleParticles(page, PARTICLES.thinking as string)).toBe(3);
    const settled = await rig();
    await page.waitForTimeout(120);
    expect(await rig()).toBe(settled);
  });
});

test('poke animates through the loop when motion is allowed', async ({ page }) => {
  await add(page, { size: '200', float: '0' });
  const squashed = await page.evaluate(async () => {
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    const scale = () => (el.shadowRoot as ShadowRoot).querySelector<HTMLElement>('.rig')!.style.transform;
    const rest = scale();
    el.poke();
    await new Promise((r) => setTimeout(r, 90));
    return scale() !== rest;
  });
  expect(squashed).toBe(true);
});

test('holds still at motion 0, keeping the expression and its cue', async ({ page }) => {
  await add(page, { size: '200', motion: '0', mood: 'sleeping' });
  await expect.poll(() => visibleParticles(page, PARTICLES.sleeping as string)).toBe(3);
  const rig = () => page.evaluate(() => document.querySelector('agent-mascot')!.shadowRoot!.querySelector<HTMLElement>('.rig')!.style.transform);
  await page.waitForTimeout(600);
  const first = await rig();
  await page.waitForTimeout(150);
  expect(await rig()).toBe(first);
});
