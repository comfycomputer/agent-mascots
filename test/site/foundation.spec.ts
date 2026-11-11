import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { STARS_API, expect, test } from './fixtures';
import { GITHUB_URL, SITE_BASE, SITE_URL } from '../../site/config.ts';
import { DEV_URL } from './servers';

const PAGES = ['/', '/playground', '/404'];
/** On the dev server, everything is under the site's path, the built library included. */
const LIBRARY = `${SITE_BASE}/@fs${resolve(import.meta.dirname, '../../dist/index.js')}`;
const source = (path: string) => `${SITE_BASE}/src/${path}`;

/** Fail on anything noisy: errors, and any request that leaves this origin. */
function guard(page: Page, origin: string) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('request', (request) => {
    // The star count is the page's one call out, and the fixtures answer it.
    if (request.url() === STARS_API) return;
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) problems.push(`external: ${request.url()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
  });
  return problems;
}

/** Mascots added to the page in a fixed box, so they're all in view at the viewport's top. */
/** The Bench with its stage removed, which would otherwise always hold a full-detail slot. */
async function bare(page: Page) {
  await page.goto('/playground');
  await expect(page.locator('#mascot')).toBeAttached();
  // The stage and the icon frame's mirror of it: the full-detail mascots the playground brings.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('#mascot, #icon-mascot')) el.remove();
  });
}

function addMascots(page: Page, count: number, width: number, attributes = '') {
  return page.evaluate(
    (options) => {
      const box = document.querySelector('#probe') ?? document.createElement('div');
      box.id = 'probe';
      (box as HTMLElement).style.cssText = 'position:fixed;inset:0;z-index:9;display:flex;flex-wrap:wrap;align-content:flex-start';
      const tags = Array.from({ length: options.count }, () => `<agent-mascot style="width:${options.width}px" ${options.attributes}></agent-mascot>`);
      box.insertAdjacentHTML('beforeend', tags.join(''));
      document.body.append(box);
    },
    { count, width, attributes },
  );
}

const stats = (page: Page) =>
  page.evaluate(() => (window as unknown as { siteDetailStats(): Record<string, number> }).siteDetailStats());

const renderedFull = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('agent-mascot')].filter((el) => el.shadowRoot?.querySelector('[data-detail="full"]')).length);

for (const path of PAGES) {
  test(`${path} loads cleanly, with nothing external`, async ({ page, baseURL }) => {
    const problems = guard(page, baseURL as string);
    await page.goto(path);
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    expect(await page.evaluate(() => [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family))).toContain('Recursive');
    expect(problems).toEqual([]);
  });
}

test('every page has links that work without JS', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  for (const path of PAGES) {
    // Its own page, without the fixtures, so the site's path is spelled out.
    await page.goto(`${SITE_BASE}${path}`);
    await expect(page.getByRole('link', { name: 'playground', exact: true }).first()).toHaveAttribute('href', `${SITE_BASE}/playground`);
    await expect(page.getByRole('link', { name: 'github', exact: true }).first()).toHaveAttribute('href', GITHUB_URL);
  }
  await context.close();
});

test.describe('full-detail budget', () => {
  test('holds nine and more to the limit, in the library as well as the count', async ({ page }) => {
    await bare(page);
    await addMascots(page, 12, 100);
    await expect.poll(() => stats(page)).toMatchObject({ limit: 8, full: 8, demoted: 4 });
    await expect.poll(() => renderedFull(page)).toBe(8);
    await expect(page.locator('#probe agent-mascot[detail="simple"]')).toHaveCount(4);

    // A freed slot goes back to a waiting mascot, which gets its own value back.
    await page.evaluate(() => {
      for (const el of [...document.querySelectorAll('#probe agent-mascot')].slice(0, 2)) el.remove();
    });
    await expect.poll(() => stats(page)).toMatchObject({ full: 8, demoted: 2 });
    await expect(page.locator('#probe agent-mascot[detail="simple"]')).toHaveCount(2);
    await expect.poll(() => renderedFull(page)).toBe(8);
  });

  test('counts only mascots in view', async ({ page }) => {
    await page.goto('/playground');
    await page.evaluate(() => {
      const box = document.createElement('div');
      box.innerHTML = Array.from({ length: 20 }, () => '<agent-mascot style="display:block;width:100px;margin-bottom:900px"></agent-mascot>').join('');
      document.querySelector('main')?.append(box);
    });
    await expect.poll(async () => (await stats(page)).demoted).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 3000));
    await expect.poll(async () => (await stats(page)).demoted).toBe(0);
    expect((await stats(page)).peakFull).toBeLessThanOrEqual(8);
  });

  test('explicit detail="full" counts, detail="simple" does not, and small mascots do not', async ({ page }) => {
    await bare(page);
    await addMascots(page, 3, 40, 'detail="full"');
    await addMascots(page, 3, 100, 'detail="simple"');
    await addMascots(page, 3, 64);
    await expect.poll(async () => (await stats(page)).full).toBe(3);
  });

  test('a priority mascot takes a slot, and an authored value comes back', async ({ page }) => {
    await bare(page);
    await addMascots(page, 8, 100, 'detail="full"');
    await expect.poll(async () => (await stats(page)).full).toBe(8);
    await page.evaluate(() => {
      const star = document.createElement('agent-mascot');
      star.id = 'star';
      star.dataset.detailPriority = '1';
      star.style.width = '100px';
      document.querySelector('#probe')?.prepend(star);
    });
    await expect.poll(() => stats(page)).toMatchObject({ full: 8, demoted: 1 });
    await expect(page.locator('#star')).not.toHaveAttribute('detail', /.*/);
    await expect(page.locator('#probe agent-mascot[detail="simple"]')).toHaveCount(1);
    await page.locator('#star').evaluate((el) => el.remove());
    await expect.poll(() => stats(page)).toMatchObject({ full: 8, demoted: 0 });
    await expect(page.locator('#probe agent-mascot[detail="full"]')).toHaveCount(8);
  });
});

test.describe('shared modules, on the dev server', () => {
  test.use({ baseURL: DEV_URL });

  test('share links pass only what the allowlist knows', async ({ page }) => {
    await page.goto('/404');
    const result = await page.evaluate(async (module) => {
      const { formatHash, parseHash } = await import(module);
      const outline = Array.from({ length: 24 }, (_, i) => [120 + 80 * Math.cos(i / 3.82), 120 + 80 * Math.sin(i / 3.82)]).map(([x, y]) => [Math.round(x as number), Math.round(y as number)]);
      const hash = formatHash({ attrs: { mood: 'error', color: '#ff0000', shape: 'drawn', material: 'glow', motion: 9 }, anchors: outline });
      return {
        hash,
        round: parseHash(hash),
        none: parseHash('#mood=error'),
        wrongVersion: parseHash('#v=2&mood=error'),
        hostile: parseHash(`#v=1&mood=<img>&label=hi&color=url(x)&track=${encodeURIComponent('body')}&sky=${encodeURIComponent('#fff, #000, #111')}&a=1,2&accessories=ears%20nope&float=abc&size=99999&shape=drawn`),
      };
    }, source('lib/hash.ts'));
    expect(result.none).toBeNull();
    expect(result.wrongVersion).toBeNull();
    expect(result.hash).not.toContain('material');
    expect(result.round.attrs).toEqual({ mood: 'error', color: '#ff0000', shape: 'drawn', motion: '2' });
    expect(result.round.anchors).toHaveLength(24);
    expect(result.hostile).toEqual({ attrs: { accessories: 'ears', size: '420' }, anchors: null });
  });

  test('a drawn outline registers and renders, and a bad one is refused', async ({ page }) => {
    await page.goto('/404');
    const result = await page.evaluate(async ({ library, module }) => {
      const { registerDrawn, shapeFromAnchors } = await import(module);
      const { registerShape } = await import(library);
      // A hand-made C: concave, with its widest clear point off centre.
      const outline = [
        [40, 40], [90, 30], [140, 30], [190, 40], [200, 70], [160, 80], [120, 80], [100, 90],
        [90, 110], [90, 130], [100, 150], [120, 160], [160, 160], [200, 170], [190, 200], [140, 210],
        [90, 210], [40, 200], [20, 170], [15, 140], [15, 100], [20, 70], [28, 55], [34, 46],
      ];
      const { anchors, options } = shapeFromAnchors(outline);
      const flat = Array.from({ length: 24 }, () => [100, 100]);
      const refused = registerDrawn(flat, registerShape);
      const registered = registerDrawn(outline, registerShape);
      const el = document.createElement('agent-mascot') as HTMLElement & { shape: string };
      el.setAttribute('shape', 'drawn');
      el.style.width = '200px';
      document.body.append(el);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const again = shapeFromAnchors(anchors);
      return {
        refused,
        registered,
        rendered: el.shadowRoot?.innerHTML.includes(options.path.slice(0, 20)) ?? false,
        spread: Math.max(...anchors.flat().map((n: number) => Math.abs(n - 120))),
        eyes: options.eyes,
        accessories: options.accessories,
        drift: Math.max(...anchors.flat().map((n: number, i: number) => Math.abs(n - again.anchors.flat()[i]))),
      };
    }, { library: LIBRARY, module: source('lib/drawn-shape.ts') });
    expect(result.refused).toBe(false);
    expect(result.registered).toBe(true);
    expect(result.rendered).toBe(true);
    expect(result.spread).toBeLessThanOrEqual(114);
    expect(result.accessories).toBe('none');
    expect(result.eyes.w).toBeGreaterThan(0);
    expect(result.drift).toBeLessThanOrEqual(3);
  });

  test('tabs follow clicks and arrow keys, with one tab stop', async ({ page }) => {
    await page.goto('/');
    const list = page.getByRole('tablist', { name: 'Framework' });
    await list.getByRole('tab', { name: 'react' }).click();
    await expect(page.locator('#use-react')).toBeVisible();
    await expect(page.locator('#use-html')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#use-vue')).toBeVisible();
    await expect(list.getByRole('tab', { name: 'vue' })).toBeFocused();
    await expect(list.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  });
});

test('copying runs working, then success, and announces it', async ({ page, browserName, context }) => {
  test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium only in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const button = page.locator('#use-html .use__snippet-copy');
  const mascot = button.locator('agent-mascot');
  await button.click();
  await expect(mascot).toHaveJSProperty('mood', 'working');
  await expect(mascot).toHaveJSProperty('mood', 'success');
  await expect(page.locator('[data-copy-status]')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.locator('#use-html pre').textContent());
  await expect(mascot).toHaveJSProperty('mood', 'idle');
});

test('the 404 finds its assets and its way home from any depth', async ({ page, baseURL }) => {
  const notFound = await (await page.request.get(`${SITE_BASE}/404`)).text();
  await page.route('**/docs/api/nope', (route) => route.fulfill({ status: 404, contentType: 'text/html', body: notFound }));
  await page.goto('/docs/api/nope');
  await expect(page.locator('.not-found__mascot')).toHaveJSProperty('mood', 'error');
  // The shared ground and the page's own sheet both arrive.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 248, 244)');
  await expect(page.locator('.not-found__mascot')).toHaveCSS('width', '240px');
  expect(await page.getByRole('link', { name: 'home', exact: true }).evaluate((link) => (link as HTMLAnchorElement).href)).toBe(`${baseURL}${SITE_BASE}/`);
});

test('the share tags are absolute, and come from the one site URL', async ({ page }) => {
  for (const [path, file] of Object.entries({ '/': '', '/playground': 'playground' })) {
    const url = `${SITE_URL}/${file}`;
    await page.goto(path);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${SITE_URL}/og.png`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', url);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
  }
});

test('metric tokens reach the page, and the placeholder URL stays in config', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site-footer p').first()).toHaveText(/^agent-mascots \d+\.\d+\.\d+\. MIT\.$/);
  expect(await page.content()).not.toContain('{{');
});

test('the skip link on the 404 stays on the 404', async ({ page, baseURL }) => {
  await page.goto('/404');
  const title = await page.title();
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  expect(page.url()).toBe(`${baseURL}${SITE_BASE}/404`);
  expect(await page.title()).toBe(title);
});
