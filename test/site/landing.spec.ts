import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { NPM_PUBLISHED, SITE_BASE, scriptSrc } from '../../site/config.ts';
import { STARS_API, expect, test } from './fixtures';
import { PRESETS } from '../../site/src/landing/presets.ts';

const metrics = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../site/metrics.json'), 'utf8'));

const hero = (page: Page) => page.locator('.hero__mascot');

/** Computed custom colours come back as rgb(). */
const hexToRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function mounted(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#hero-moods .pick')).toHaveCount(metrics.counts.moods);
}

/** Every card pressed shows one look: the marquee may show a named card more than once. */
const pressedName = (page: Page) =>
  page.locator('.preset[aria-pressed="true"]').evaluateAll((cards) => [...new Set(cards.map((card) => (card as HTMLElement).dataset.preset))]);

/** Hovering doesn't stop the marquee: its pause button does, so a card holds still to be clicked. */
async function pausePresets(page: Page) {
  const pause = page.getByRole('button', { name: 'pause', exact: true });
  if (await pause.isVisible()) await pause.click();
}

async function pickPreset(page: Page, name: string) {
  await pausePresets(page);
  await page.getByRole('button', { name, exact: true }).first().click();
}

test.describe('structure', () => {
  test('the hero says what it is, in plain words', async ({ page }) => {
    await mounted(page);
    await expect(page).toHaveTitle('agent-mascots');
    await expect(page.getByRole('heading', { level: 1, name: 'agent-mascots', exact: true })).toBeVisible();
    await expect(page.locator('.hero__lead')).toHaveText('An animated web component that shows what your AI agent is doing.');
    await expect(page.locator('.hero p')).toHaveCount(2);
    await expect(page.locator('.hero__shared')).toBeHidden();
  });

  test('the sections come in order, and there are no others', async ({ page }) => {
    await mounted(page);
    await expect(page.locator('main h2')).toHaveText(['Usage']);
    await expect(page.getByRole('region', { name: 'Presets' })).toBeVisible();
    await expect(page.locator('main > section')).toHaveCount(3);
  });

  test('one large mascot, and the presets are pictures', async ({ page }) => {
    await mounted(page);
    await expect(page.locator('main agent-mascot[detail="full"]')).toHaveCount(1);
    // Its laid-out size: the entrance scales it for a moment.
    expect(await hero(page).evaluate((el) => (el as HTMLElement).offsetWidth)).toBe(420);
    await expect(page.locator('.presets agent-mascot')).toHaveCount(0);
    expect(await page.locator('.preset img').count()).toBeGreaterThanOrEqual(PRESETS.length);
  });

  test('the hero opens in a named preset, on its ground, pressed in the marquee', async ({ page }) => {
    await mounted(page);
    const [name] = await pressedName(page);
    const preset = PRESETS.find((each) => each.name === name)!;
    expect(preset).toBeTruthy();
    for (const [attr, value] of Object.entries(preset.attrs)) await expect(hero(page)).toHaveAttribute(attr, value);
    await expect(page.locator('#hero-play')).toHaveAttribute('href', `${SITE_BASE}/playground#${new URLSearchParams({ v: '1', ...preset.attrs })}`);
    const ground = await page.evaluate(() => ['--g1', '--g2', '--g3'].map((prop) => getComputedStyle(document.body).getPropertyValue(prop).trim()));
    expect(ground.map((colour) => colour.toLowerCase())).toEqual(preset.ground.map(hexToRgb));
  });

  test('the hero opens in a different preset from visit to visit', async ({ page }) => {
    const seen = new Set<string>();
    for (let visit = 0; visit < 8 && seen.size < 2; visit++) {
      await mounted(page);
      seen.add((await pressedName(page))[0]!);
    }
    expect(seen.size).toBe(2);
  });

  test('the page is light, even in a dark colour scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await mounted(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(23, 18, 15)');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
  });

  test('the footer is one line of facts', async ({ page }) => {
    await mounted(page);
    await expect(page.locator('.site-footer p:not(.visually-hidden)')).toHaveCount(1);
  });

  test('there is no console error or warning', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    await mounted(page);
    await page.waitForTimeout(500);
    expect(problems).toEqual([]);
  });
});

test.describe('the mood picker', () => {
  test('it lists the library moods in order, with the current one checked', async ({ page }) => {
    await mounted(page);
    await expect(page.locator('#hero-moods input')).toHaveCount(metrics.moods.length);
    expect(await page.locator('#hero-moods input').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(metrics.moods);
    await expect(page.locator('#hero-moods input[value="idle"]')).toBeChecked();
  });

  test('the hero walks through the moods every 3 seconds, until one is picked', async ({ page }) => {
    await page.clock.install();
    await mounted(page);
    await page.clock.runFor(3000);
    await expect(hero(page)).toHaveAttribute('mood', 'thinking');
    await expect(page.locator('#hero-moods input[value="thinking"]')).toBeChecked();
    await page.clock.runFor(3000);
    await expect(hero(page)).toHaveAttribute('mood', 'working');
    await page.locator('#hero-moods input[value="error"]').check();
    await page.locator('#hero-moods input[value="error"]').blur();
    await page.clock.runFor(9000);
    await expect(hero(page)).toHaveAttribute('mood', 'error');
  });

  test('picking a mood sets it on the hero', async ({ page }) => {
    await mounted(page);
    await page.locator('#hero-moods input[value="error"]').check();
    await expect(hero(page)).toHaveAttribute('mood', 'error');
  });

  test('arrow keys move through the moods', async ({ page }) => {
    await mounted(page);
    await page.locator('#hero-moods input[value="idle"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#hero-moods input[value="thinking"]')).toBeFocused();
    await expect(hero(page)).toHaveAttribute('mood', 'thinking');
  });

  test('Enter on the hero mascot pokes it', async ({ page }) => {
    await mounted(page);
    await hero(page).evaluate((el) => el.addEventListener('mascot-poke', () => { el.dataset.poked = ''; }, { once: true }));
    await hero(page).focus();
    await page.keyboard.press('Enter');
    await expect(hero(page)).toHaveAttribute('data-poked', '');
  });
});

test.describe('entrance', () => {
  test('the hero and presets rise into place once, and the title shows from the first paint', async ({ page }) => {
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { entrance: string[] }).entrance = seen;
      document.addEventListener('animationstart', (event) => {
        const el = event.target as Element;
        const part = el.matches('.hero__letter') ? 'title' : el.matches('.presets__row') ? 'row' : el.matches('.hero__cta > *') ? 'cta' : el.matches('.hero__mascot') ? 'mascot' : '';
        if (part) seen.push(`${part}:${event.animationName}`);
      }, true);
    });
    await mounted(page);
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.hero__cta > *, .presets__row, .hero__mascot')]
      .every((el) => getComputedStyle(el).opacity === '1' && getComputedStyle(el).translate === 'none' && getComputedStyle(el).scale === 'none'))).toBe(true);
    const seen = new Set(await page.evaluate(() => (window as unknown as { entrance: string[] }).entrance));
    // The title rises without fading, so it is painted, and counted for LCP, from the first frame.
    expect([...seen].toSorted()).toEqual(['cta:enter-fade', 'mascot:enter-grow', 'row:enter-left', 'row:enter-right', 'title:enter-letter']);
  });

});

test.describe('reduced motion', () => {
  test('the page holds still, and the picker still works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mounted(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const moving = await page.evaluate(() => document.getAnimations().filter((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return target && !target.closest?.('agent-mascot') && !(target.getRootNode() instanceof ShadowRoot);
    }).length);
    expect(moving).toBe(0);
    await page.locator('#hero-moods input[value="sleeping"]').check();
    await expect(hero(page)).toHaveAttribute('mood', 'sleeping');
  });
});

test.describe('usage', () => {
  test('the switcher shows one framework at a time, each using its own binding', async ({ page }) => {
    await page.goto('/');
    const binding = { react: 'onmascot-poke={', vue: '@mascot-poke=', svelte: 'onmascot-poke={', solid: 'on:mascot-poke={', html: "'mascot-poke'" };
    for (const [name, text] of Object.entries(binding)) {
      await page.getByRole('tab', { name, exact: true }).click();
      await expect(page.locator('.use__snippets .use__panel:visible')).toContainText(text);
      await expect(page.locator('.use__snippets [role="tabpanel"]:visible')).toHaveCount(1);
    }
  });

  test('the CDN snippet shows once the package is published, and not before', async ({ page }) => {
    await page.goto('/');
    if (NPM_PUBLISHED) await expect(page.locator('main')).toContainText('jsdelivr');
    else await expect(page.locator('main')).not.toContainText('jsdelivr');
    await expect(page.locator('main')).not.toContainText('Until the first release');
  });

  test('the install command has its own copy button', async ({ page, browserName, context }) => {
    await page.goto('/');
    const copy = page.getByRole('button', { name: 'Copy the install command' });
    await expect(copy).toHaveAttribute('data-copy', 'npm install @comfycomputer/agent-mascots');
    await expect(page.locator('#install .use__command code')).toHaveText('npm install @comfycomputer/agent-mascots');
    if (browserName !== 'chromium') return;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await copy.click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('npm install @comfycomputer/agent-mascots');
    await expect(copy.locator('.icon--copied')).toBeVisible();
  });

  test('a snippet copy button keeps its width when it says copied', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    const button = page.locator('#use-html .use__snippet-copy');
    // Size, not place: clicking scrolls the button into view.
    const size = () => button.evaluate((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]);
    const before = await size();
    await button.click();
    await expect(button).toHaveText('copied');
    expect(await size()).toEqual(before);
  });

  test('the hero stacks GitHub, the command, then docs and the playground side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('main code', { hasText: 'npm install @comfycomputer/agent-mascots' })).toHaveCount(1);
    await expect(page.locator('#install .hero__install')).toContainText('npm install @comfycomputer/agent-mascots');
    const box = (selector: string) => page.locator(selector).boundingBox();
    const [github, command, docs, play] = await Promise.all(['#hero-github', '.hero__install', '#hero-docs', '#hero-play'].map(box));
    expect(github!.y + github!.height).toBeLessThan(command!.y);
    expect(command!.y + command!.height).toBeLessThan(docs!.y);
    expect(docs!.y).toBe(play!.y);
    expect(docs!.x + docs!.width).toBeLessThan(play!.x);
    // The whole command shows, not an ellipsis, on a phone too.
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.locator('.hero__install code').evaluate((el) => el.scrollWidth <= el.clientWidth), `${width}px`).toBe(true);
    }
  });

  test('the GitHub bar shows the star count once GitHub answers', async ({ page }) => {
    await page.route(STARS_API, (route) => route.fulfill({ json: { stargazers_count: 1234 }, headers: { 'access-control-allow-origin': '*' } }));
    await page.goto('/');
    await expect(page.locator('[data-stars]')).toBeVisible();
    await expect(page.locator('[data-stars-count]')).toHaveText('1.2k');
  });

  test('on a phone the hero is centred', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mounted(page);
    for (const selector of ['.hero__title', '.hero__lead']) {
      expect(await page.locator(selector).evaluate((el) => getComputedStyle(el).textAlign), selector).toBe('center');
    }
    const middle = async (selector: string) => page.locator(selector).evaluate((el) => { const box = el.getBoundingClientRect(); return Math.round(box.left + box.width / 2); });
    expect(Math.abs((await middle('.hero__title')) - (await middle('.hero__mascot')))).toBeLessThanOrEqual(2);
  });

  test('the plain HTML sample needs no bundler', async ({ page }) => {
    await page.goto('/');
    const sample = await page.locator('#use-html pre').textContent();
    expect(sample).not.toContain("import '@comfycomputer/agent-mascots'");
    // The CDN once the package is on npm, a local install's copy before that.
    expect(sample).toContain(scriptSrc());
  });

  test('a snippet copies exactly what it shows', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.getByRole('tab', { name: 'vue', exact: true }).click();
    await page.locator('#use-vue .use__snippet-copy').click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(await page.locator('#use-vue pre').textContent());
  });

  test('each snippet copy is the primary button, named for what it does', async ({ page }) => {
    await page.goto('/');
    const copy = page.locator('#use-html .use__snippet-copy');
    await expect(copy).toHaveClass(/act--strong/);
    await expect(copy).toHaveAccessibleName('Copy this snippet');
    await expect(copy).toHaveText('copy');
  });

  test('each snippet panel is as tall as its own code', async ({ page }) => {
    await page.goto('/');
    for (const name of ['html', 'react', 'vue', 'svelte', 'solid']) {
      await page.getByRole('tab', { name, exact: true }).click();
      const pre = page.locator(`#use-${name} pre`);
      const [box, code] = await pre.evaluate((el) => [el.getBoundingClientRect().height, el.querySelector('code')!.getBoundingClientRect().height]);
      const padding = await pre.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom));
      // A sideways scrollbar may add a little.
      expect(box - code - padding, name).toBeLessThan(24);
    }
  });

  test('code keeps its lines on a phone, and scrolls sideways instead', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    for (const pre of await page.locator('main pre.code-panel:visible').all()) {
      expect(await pre.evaluate((el) => [getComputedStyle(el).whiteSpace, getComputedStyle(el).overflowX])).toEqual(['pre', 'auto']);
    }
  });
});

test.describe('share links', () => {
  const star = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const radius = i % 6 < 3 ? 100 : 60;
    return [Math.round(120 + radius * Math.cos(angle)), Math.round(120 + radius * Math.sin(angle))];
  }).flat().join(',');

  test('a valid link puts the drawn mascot in the hero', async ({ page }) => {
    const hash = `#v=1&shape=drawn&mood=waiting&a=${star}`;
    await mounted(page, `/${hash}`);
    await expect(hero(page)).toHaveAttribute('shape', 'drawn');
    await expect(hero(page)).toHaveAttribute('accessories', 'none');
    await expect(hero(page)).toHaveAttribute('detail', 'full');
    await expect(page.locator('#hero-moods input[value="waiting"]')).toBeChecked();
    const shared = page.locator('.hero__shared');
    await expect(shared).toBeVisible();
    await expect(shared.locator('a')).toHaveAttribute('href', `${SITE_BASE}/playground${hash}`);
    expect((await hero(page).boundingBox())?.width).toBeLessThanOrEqual(420);
    expect(await hero(page).evaluate((el) => !!el.shadowRoot?.querySelector('[data-detail="full"]'))).toBe(true);
  });

  for (const [name, hash] of [
    ['a wrong version', `#v=9&shape=drawn&a=${star}`],
    ['too few anchors', '#v=1&shape=drawn&a=1,2,3'],
    ['script in a value', '#v=1&color=<img src=x onerror=alert(1)>&shape=<script>'],
    ['a section link', '#usage'],
  ] as const) {
    test(`${name} changes nothing that matters`, async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      await mounted(page, `/${hash}`);
      expect(await hero(page).getAttribute('shape')).not.toBe('drawn');
      await expect(page.locator('.hero__shared')).toBeHidden();
      expect(await page.locator('.hero img, .hero script').count()).toBe(0);
      expect(await pressedName(page)).toHaveLength(1);
      expect(problems).toEqual([]);
    });
  }
});

for (const width of [320, 390, 1440, 2560]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mounted(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

for (const [width, height, limit] of [[1440, 900, 3600], [390, 844, 5200]] as const) {
  test(`the page is under ${limit}px tall at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mounted(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(limit);
  });

  test(`never more than 8 full-detail and 150 simple mascots at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mounted(page);
    await page.evaluate(async () => {
      const end = document.documentElement.scrollHeight;
      for (let y = 0; y < end; y += innerHeight / 2) {
        scrollTo(0, y);
        await new Promise((done) => setTimeout(done, 40));
      }
    });
    const stats = await page.evaluate(() => (window as unknown as { siteDetailStats(): Record<string, number> }).siteDetailStats());
    expect(stats.peakFull).toBeLessThanOrEqual(8);
    expect(stats.peakSimple).toBeLessThanOrEqual(150);
    expect(stats.demoted).toBe(0);
  });
}

test('the mascots wear the visit\'s preset from the start, not the first one', async ({ page }) => {
  // What the mascots wear when the library defines the element, which is when they first draw.
  await page.addInitScript(() => {
    const define = customElements.define.bind(customElements);
    customElements.define = (name, ...rest) => {
      if (name === 'agent-mascot') {
        (window as unknown as { atDefine: unknown }).atDefine = Object.fromEntries(
          [
            ['hero', '.hero__mascot'],
            ['nav', '.site-nav__mascot'],
          ].map(([key, selector]) => {
            const mascot = document.querySelector(selector!)!;
            return [key, Object.fromEntries(['shape', 'color', 'eye-shape'].map((attr) => [attr, mascot.getAttribute(attr)]))];
          }),
        );
      }
      return define(name, ...rest);
    };
  });
  // Random, so a few visits: each draws the preset the page settles on, whichever it is.
  for (let visit = 0; visit < 3; visit++) {
    await mounted(page);
    const [name] = await pressedName(page);
    const preset = PRESETS.find((p) => p.name === name)!;
    const atDefine = await page.evaluate(() => (window as unknown as { atDefine: unknown }).atDefine);
    expect(atDefine).toEqual({
      hero: { shape: preset.attrs.shape, color: preset.attrs.color, 'eye-shape': preset.attrs['eye-shape'] ?? null },
      nav: { shape: preset.attrs.shape, color: 'var(--text)', 'eye-shape': preset.attrs['eye-shape'] ?? null },
    });
    await expect(page.locator('html')).toHaveCSS('--g1', hexToRgb(preset.ground[0]));
  }
});

test('without JS the headline, the install command, the presets and the code remain readable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  // Its own page, without the fixtures, so the site's path is spelled out.
  await page.goto(`${SITE_BASE}/`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#install .use__command')).toBeVisible();
  await expect(page.locator('#hero-play')).toBeVisible();
  await expect(page.locator('.preset')).toHaveCount(PRESETS.length);
  await expect(page.locator('.presets__pause')).toBeHidden();
  await expect(page.locator('#use-html pre')).toBeVisible();
  await expect(page.locator('.site-footer')).toContainText('MIT');
  await expect(page.locator('#hero-moods')).toBeHidden();
  await context.close();
});

test('the hero, the sections and the footer share one left edge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mounted(page);
  const left = (selector: string) => page.locator(selector).first().evaluate((el) => Math.round(el.getBoundingClientRect().left));
  const edge = await left('.hero__title');
  for (const selector of ['#usage-title', '.site-footer p']) {
    expect(await left(selector), selector).toBe(edge);
  }
});

test('the nav sits where it does on the playground', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const left = () => page.locator('.site-nav__home').evaluate((el) => Math.round(el.getBoundingClientRect().left));
  await page.goto('/');
  const landing = await left();
  await page.goto('/playground');
  expect(await left()).toBe(landing);
});

test('the sections use the whole page column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mounted(page);
  const right = (selector: string) => page.locator(selector).evaluate((el) => Math.round(el.getBoundingClientRect().right));
  const edge = await right('.hero');
  expect(await right('.use__snippets')).toBe(edge);
});

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`the presets have the same space above and below at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mounted(page);
    const box = (selector: string) => page.locator(selector).evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    const [stage, grid, usage] = await Promise.all([box('.hero'), box('.presets__marquee'), box('#usage')]);
    expect(Math.round(grid.top - stage.bottom)).toBe(Math.round(usage.top - grid.bottom));
  });
}

/** How far a marquee row's track has moved, in CSS pixels. */
const offset = (page: Page, row = 0) =>
  page.locator('.presets__track').nth(row).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test.describe('the preset marquee', () => {
  test('runs edge to edge, and moves', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mounted(page);
    const box = await page.locator('.presets__marquee').boundingBox();
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.width)).toBe(1440);
    await page.locator('#presets-marquee').scrollIntoViewIfNeeded();
    const before = await offset(page);
    await page.waitForTimeout(400);
    expect(await offset(page)).not.toBe(before);
    // Every row is covered, with no gap at the right end.
    for (const track of await page.locator('.presets__track').all()) {
      expect((await track.boundingBox())!.width).toBeGreaterThan(1440);
    }
  });

  test('keeps running under the pointer and after a click, and holds still when paused', async ({ page }) => {
    await mounted(page);
    await page.locator('#presets-marquee').scrollIntoViewIfNeeded();
    await page.locator('#presets-marquee').hover({ position: { x: 200, y: 40 } });
    await page.waitForTimeout(400);
    const hovered = await offset(page);
    await page.waitForTimeout(400);
    expect(await offset(page)).not.toBe(hovered);
    await page.locator('.preset').nth(3).click({ force: true });
    await page.waitForTimeout(400);
    const clicked = await offset(page);
    await page.waitForTimeout(400);
    expect(await offset(page)).not.toBe(clicked);
    await page.getByRole('button', { name: 'pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'play', exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    const paused = await offset(page);
    await page.waitForTimeout(400);
    expect(await offset(page)).toBe(paused);
  });

  test('a card reached by keyboard holds the row, so it keeps its focus', async ({ page }) => {
    await mounted(page);
    await page.locator('#presets-marquee').scrollIntoViewIfNeeded();
    await page.locator('.preset').first().focus();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(600);
    const held = await offset(page);
    await page.waitForTimeout(400);
    expect(await offset(page)).toBe(held);
  });

  test('under reduced motion it never moves, and the rows scroll by hand', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mounted(page);
    await page.waitForTimeout(400);
    expect(await offset(page)).toBe(0);
    await expect(page.locator('.presets__pause')).toBeHidden();
    expect(await page.locator('.presets__row').first().evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
  });

  test('brings new presets once the named ones go by, and they can be picked', async ({ page }) => {
    test.slow();
    await mounted(page);
    await page.locator('#presets-marquee').scrollIntoViewIfNeeded();
    const fresh = page.locator('.preset[data-preset^="look-"]');
    await expect(fresh.first()).toBeAttached({ timeout: 45_000 });
    await pausePresets(page);
    const name = await fresh.first().getAttribute('data-preset');
    await fresh.first().click({ force: true });
    await expect(page.locator(`.preset[data-preset="${name}"]`)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('presets', () => {
  test('each card is a button named for its preset, showing its picture', async ({ page }) => {
    await mounted(page);
    await expect(page.getByRole('button', { name: PRESETS[1]!.name, exact: true }).first()).toBeVisible();
    const loaded = await page.locator('.preset img').evaluateAll(async (images) => {
      await Promise.all(images.map((image) => { (image as HTMLImageElement).loading = 'eager'; return (image as HTMLImageElement).decode().catch(() => null); }));
      return images.every((image) => (image as HTMLImageElement).naturalWidth === 320);
    });
    expect(loaded).toBe(true);
  });

  test('picking one dresses the hero and points the playground at it', async ({ page }) => {
    await mounted(page);
    const angel = PRESETS.find(({ name }) => name === 'angel')!;
    await pickPreset(page, 'angel');
    for (const [name, value] of Object.entries(angel.attrs)) await expect(hero(page)).toHaveAttribute(name, value);
    await expect(page.getByRole('button', { name: 'angel', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hero-play')).toHaveAttribute('href', new RegExp(`^${SITE_BASE}/playground#v=1&shape=orb&material=frost`));
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--g1').trim())).toBe(hexToRgb(angel.ground[0]));
    await expect(page.locator('#hero-moods .pick__mascot').first()).toHaveAttribute('color', angel.attrs.color!);
  });

  test('the small mascots wear the hero\'s shape, and the picker its colours too', async ({ page }) => {
    await mounted(page);
    await pickPreset(page, 'robot');
    for (const selector of ['#hero-moods .pick__mascot', '.site-nav__mascot', '#install-mascot', '.use__snippet-copy agent-mascot']) {
      await expect(page.locator(selector).first(), selector).toHaveAttribute('shape', 'squircle');
      await expect(page.locator(selector).first(), selector).toHaveAttribute('eye-shape', 'square');
    }
    await expect(page.locator('#hero-moods .pick__mascot').first()).toHaveAttribute('color', '#8fa3b8');
    await expect(page.locator('.site-nav__mascot')).toHaveAttribute('color', 'var(--text)');
    await pickPreset(page, 'twinkle');
    await expect(page.locator('#install-mascot')).toHaveAttribute('shape', 'star');
    expect(await page.locator('#install-mascot').getAttribute('eye-shape')).toBeNull();
  });

  test('picking another leaves nothing of the first behind', async ({ page }) => {
    await mounted(page);
    await pickPreset(page, 'robot');
    await expect(hero(page)).toHaveAttribute('eye-shape', 'square');
    await pickPreset(page, 'twinkle');
    await expect(hero(page)).toHaveAttribute('shape', 'star');
    expect(await hero(page).getAttribute('eye-shape')).toBeNull();
    expect(await hero(page).getAttribute('accessories')).toBeNull();
    expect(await pressedName(page)).toEqual(['twinkle']);
  });

  test('picking one goes back to the top', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mounted(page);
    await pickPreset(page, 'ruby');
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });
});

test('the wordmark is not underlined as the current page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site-nav__home')).toHaveAttribute('aria-current', 'page');
  expect(await page.locator('.site-nav__home').evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
});

test('every focusable code panel is a named region', async ({ page }) => {
  await page.goto('/');
  const panels = await page.locator('pre.code-panel[tabindex="0"]').evaluateAll((pres) => pres.map((pre) => [pre.getAttribute('role'), Boolean(pre.getAttribute('aria-label'))]));
  expect(panels.length).toBe(5);
  expect(new Set(panels.map(String))).toEqual(new Set(['region,true']));
});

test.describe('the wiring sample', () => {
  const usage = readFileSync(resolve(import.meta.dirname, '../../docs/USAGE.md'), 'utf8');
  const fenced = /## Wire it to your agent[\s\S]*?```js\n([\s\S]*?)```/.exec(usage)?.[1] ?? '';

  for (const [name, source, last, mood] of [['in the usage guide', fenced, 'done', 'success'], ['in the usage guide', fenced, 'fail', 'error']] as const) {
    test(`${name}, it hangs up on ${last}, so the agent isn't started again`, async ({ page, browserName }) => {
      test.skip(browserName === 'firefox', 'Playwright does not route EventSource in Firefox');
      let connections = 0;
      await page.route('**/agent', (route) => {
        connections += 1;
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `data: start\n\ndata: tool\n\ndata: ${last}\n\n` });
      });
      await page.goto('/');
      await page.addScriptTag({ type: 'module', content: source });
      await expect.poll(() => page.locator('agent-mascot').first().evaluate((el) => (el as HTMLElementTagNameMap['agent-mascot']).mood)).toBe(mood);
      await page.waitForTimeout(3500);
      expect(await page.locator('agent-mascot').first().evaluate((el) => (el as HTMLElementTagNameMap['agent-mascot']).mood)).toBe(mood);
      expect(connections).toBe(1);
    });
  }
});
