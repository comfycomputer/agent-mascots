import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PATH = '/playground';
const stage = (page: Page) => page.locator('#mascot');
const attr = (page: Page, name: string) => stage(page).getAttribute(name);
const panel = (page: Page, name: string) => page.locator('.output').getByRole('tabpanel', { name: `${name} code` });
const outputTab = (page: Page, name: string) => page.locator('.output').getByRole('tab', { name, exact: true }).click();

async function open(page: Page, hash = '') {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await page.goto(`${PATH}${hash}`);
  await expect(page.locator('#mixer .mixer__item').first()).toBeAttached();
  await page.waitForFunction(() => (document.querySelector('#mascot') as HTMLElement).shadowRoot?.querySelector('[data-detail]'));
  return problems;
}

const settled = (page: Page) => page.waitForFunction(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true)))));

/** Set a real range input, the way a drag does: an input event, then a change event. */
const slide = (page: Page, selector: string, value: number) =>
  page.locator(selector).evaluate((input: HTMLInputElement, next) => {
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

const hashSettled = (page: Page, pattern: RegExp) => expect.poll(() => page.evaluate(() => location.hash), { timeout: 3000 }).toMatch(pattern);

test('every control in the rail reaches the mascot', async ({ page }) => {
  const problems = await open(page);
  await page.locator('#shapes input[value=cat]').check({ force: true });
  await page.locator('#materials input[value=frost]').check({ force: true });
  await page.locator('.colours__row input[type=text]').first().fill('#123456');
  const channels = ['motion', 'float', 'blink', 'glance', 'bounce', 'gaze'];
  await page.locator('#tab-motion').click();
  await expect(page.locator('#mixer .mixer__item code')).toHaveText(channels);
  for (const [index] of channels.entries()) await slide(page, `#mixer .mixer__item:nth-child(${index + 1}) input[type=range]`, 0.3);
  await settled(page);
  expect(await attr(page, 'shape')).toBe('cat');
  expect(await attr(page, 'material')).toBe('frost');
  expect(await attr(page, 'color')).toBe('#123456');
  for (const name of channels) expect(await attr(page, name), name).toBe('0.3');
  expect(problems).toEqual([]);
});

test('code is live, minimal, and right for each framework', async ({ page }) => {
  await open(page, '#v=1&shape=cloud&material=frost&body-width=1.2&mood=thinking&eye-color=var(--eyes)');
  await expect(panel(page, 'html')).toContainText('<agent-mascot\n  shape="cloud"');
  const html = await panel(page, 'html').textContent();
  expect(html).toContain('body-width="1.2"');
  expect(html).toContain('eye-color="var(--eyes)"');
  expect(html).not.toContain('softness');

  await outputTab(page, 'react');
  expect(await panel(page, 'react').textContent()).toMatch(/import 'agent-mascots';[\s\S]*return \([\s\S]*body-width="1\.2"[\s\S]*\/>/);
  await outputTab(page, 'vue');
  expect(await panel(page, 'vue').textContent()).toMatch(/<script setup>[\s\S]*<template>[\s\S]*shape="cloud"[\s\S]*<\/template>/);
  await outputTab(page, 'svelte');
  expect(await panel(page, 'svelte').textContent()).toMatch(/<script>[\s\S]*<\/agent-mascot>/);
  await outputTab(page, 'solid');
  expect(await panel(page, 'solid').textContent()).toContain('shape="cloud"');

  // Back to auto, so it leaves the code.
  await outputTab(page, 'html');
  await page.getByRole('button', { name: 'eye-color: back to auto' }).click();
  await expect(panel(page, 'html')).not.toContainText('eye-color');
});

test('copy sits in the code, and its clipboard turns to a tick', async ({ page, browserName, context }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium grants clipboard access here.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '#v=1&shape=orb');
  const copy = page.locator('#out-panels #copy-code');
  await expect(copy).toHaveAccessibleName('Copy code');
  await copy.click();
  await expect(copy).toHaveAttribute('data-copy-state', 'copied');
  await expect(copy.locator('.icon--copied')).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('shape="orb"');
  await outputTab(page, 'react');
  await page.locator('#copy-code').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('export function Mascot');
});

test('state round-trips through the URL, on a fresh load', async ({ page }) => {
  await open(page);
  await page.locator('#moods input[value=error]').check({ force: true });
  await page.locator('#shapes input[value=gem]').check({ force: true });
  await page.locator('#materials input[value=glass]').check({ force: true });
  await page.locator('#grounds input[value=dark]').check({ force: true });
  await page.locator('#tab-motion').click();
  await slide(page, '#mixer .mixer__item:nth-child(2) input[type=range]', 0.4);
  await hashSettled(page, /float=0\.4/); // The last change, so the rest have landed too.
  const hash = await page.evaluate(() => location.hash);
  expect(hash).toMatch(/^#v=1&/);
  expect(hash).toContain('g=dark');
  expect(hash).not.toContain('softness');

  await page.goto('about:blank');
  await open(page, hash);
  await settled(page);
  expect(await attr(page, 'mood')).toBe('error');
  expect(await attr(page, 'shape')).toBe('gem');
  expect(await attr(page, 'material')).toBe('glass');
  expect(await attr(page, 'float')).toBe('0.4');
  await expect(page.locator('#area')).toHaveAttribute('data-stage-ground', 'dark');
  await expect(page.locator('#shapes input[value=gem]')).toBeChecked();
});

test('the default state leaves the URL alone', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('the track-area choice survives a link', async ({ page }) => {
  await open(page, '#v=1&area=1');
  await settled(page);
  expect(await attr(page, 'track')).toBe('#area');
  await expect(panel(page, 'html')).toContainText('<div id="area">');
});

const HOSTILE = [
  '#v=2&mood=error',
  '#mood=error',
  '#v=1&mood=<img src=x onerror=alert(1)>',
  '#v=1&color=url(https://example.com/x)',
  '#v=1&color=red;background:url(x)',
  '#v=1&sky=url(x)',
  '#v=1&label=hello',
  '#v=1&gyro=true',
  '#v=1&body-width=Infinity',
  '#v=1&shape=drawn',
  '#v=1&shape=drawn&a=1,2,3',
  '#v=1&g=url(x)',
  '#v=1&t=<b>.1000',
  '#v=1&track=%23main',
  '#v=1&mood=%E0%A4%A',
  '#%E0%A4%A',
];

for (const hash of HOSTILE) {
  test(`a bad link falls back cleanly: ${hash}`, async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      if (!request.url().includes('127.0.0.1')) external.push(request.url());
    });
    const problems = await open(page, hash);
    await settled(page);
    expect(await attr(page, 'label')).toBeNull();
    expect(await attr(page, 'gyro')).toBeNull();
    expect(await attr(page, 'color')).toBeNull();
    expect(await attr(page, 'shape')).toBeNull();
    expect(await attr(page, 'track')).toBeNull();
    await expect(page.locator('main img, main b')).toHaveCount(0);
    expect(external).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('a good link clamps out-of-range numbers', async ({ page }) => {
  await open(page, '#v=1&body-width=99&eye-y=-5');
  await settled(page);
  expect(await attr(page, 'body-width')).toBe('1.4');
  expect(await attr(page, 'eye-y')).toBe('-1');
});

test('randomise, undo and reset', async ({ page }) => {
  await open(page);
  await expect(page.locator('#undo')).toBeDisabled();
  await page.locator('#shuffle').click();
  await settled(page);
  const shape = await attr(page, 'shape');
  expect(shape).not.toBeNull();
  expect(await attr(page, 'color')).toMatch(/^#/);
  await page.locator('#undo').click();
  await settled(page);
  expect(await attr(page, 'shape')).toBeNull();
  await expect(page.locator('#undo')).toBeDisabled();

  await page.locator('#shuffle').click();
  await page.locator('#shuffle').click();
  await page.locator('#reset').click();
  await settled(page);
  expect(await attr(page, 'shape')).toBeNull();
  await expect(panel(page, 'html')).toContainText('<agent-mascot></agent-mascot>');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
});

test('keys 1 to 9 pick moods and R shuffles, but not while typing', async ({ page }) => {
  await open(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('5');
  await expect.poll(() => attr(page, 'mood')).toBe('error');
  await page.keyboard.press('r');
  await expect.poll(() => attr(page, 'shape')).not.toBeNull();

  const before = await attr(page, 'shape');
  await page.locator('.colours__row input[type=text]').first().focus();
  await page.keyboard.press('r');
  await page.keyboard.press('3');
  await settled(page);
  expect(await attr(page, 'shape')).toBe(before);
  expect(await attr(page, 'mood')).toBe('error');
});

test('moods work from the keyboard alone', async ({ page }) => {
  await open(page);
  await page.locator('#moods input').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => attr(page, 'mood')).toBe('thinking');
  await expect(page.locator('#moods .pick').nth(1)).toHaveCSS('outline-style', 'solid');
});

test('the stage pokes from the keyboard', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    document.addEventListener('mascot-poke', () => {
      document.body.dataset.poked = '1';
    });
  });
  await stage(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-poked', '1');
});

test('the 64px printed on the page is where the library really swaps', async ({ page }) => {
  await open(page);
  const detailAt = (width: number) => page.evaluate(async (px) => {
    const el = document.createElement('agent-mascot');
    el.style.width = `${px}px`;
    document.body.append(el);
    await new Promise((done) => setTimeout(done, 100));
    const level = el.shadowRoot?.querySelector('[data-detail]')?.getAttribute('data-detail');
    el.remove();
    return level;
  }, width);
  expect(await detailAt(64)).toBe('simple');
  expect(await detailAt(65)).toBe('full');
});

test('a new hash replaces the state', async ({ page }) => {
  await open(page, '#v=1&softness=0.9');
  await expect.poll(() => attr(page, 'softness')).toBe('0.9');
  await page.evaluate(() => {
    location.hash = '#v=1&mood=error';
  });
  await expect.poll(() => attr(page, 'mood')).toBe('error');
  await expect(page.locator('#moods input[value=error]')).toBeChecked();
  expect(await attr(page, 'softness')).toBeNull();
});

test('tilt asks once from a press, and says when it can\'t', async ({ page }) => {
  await open(page);
  // Shown on phones only; a desktop can still set it for the code.
  await page.locator('#tilt').evaluate((button: HTMLElement) => { button.hidden = false; });
  const toggle = page.locator('#tilt');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page, 'html')).toContainText('gyro');
  await expect(page.locator('#status')).not.toBeEmpty();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await attr(page, 'gyro')).toBeNull();
});

async function drawLoop(page: Page, radius: number) {
  const box = await page.locator('#draw').boundingBox();
  const [cx, cy] = [box!.x + box!.width / 2, box!.y + box!.height / 2];
  await page.mouse.move(cx + radius, cy);
  await page.mouse.down();
  for (let step = 1; step <= 40; step += 1) {
    const angle = (step / 40) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(angle) * radius * (1 + 0.2 * Math.sin(angle * 3)), cy + Math.sin(angle) * radius);
  }
  await page.mouse.up();
}

test('draw turns a stroke into a shape, and a link carries it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = await open(page);
  await page.locator('#draw-open').click();
  await expect(page.locator('#draw')).toBeVisible();
  await expect(page.locator('#draw-surprise')).toBeFocused();

  await drawLoop(page, 12);
  await expect(page.locator('#draw-note')).toContainText('Too small');
  await expect(page.locator('#draw')).toBeVisible();

  await drawLoop(page, 170);
  await expect(page.locator('#draw')).toBeHidden();
  await expect.poll(() => attr(page, 'shape')).toBe('drawn');
  expect(await attr(page, 'accessories')).toBe('none');
  // No tab of its own: every framework's code registers the drawn shape before its tag.
  await expect(panel(page, 'html')).toContainText("registerShape('drawn'");
  await outputTab(page, 'react');
  await expect(panel(page, 'react')).toContainText("import { registerShape } from 'agent-mascots';");
  await hashSettled(page, /shape=drawn.*a=/);

  const hash = await page.evaluate(() => location.hash);
  await page.goto('about:blank');
  await open(page, hash);
  await settled(page);
  expect(await attr(page, 'shape')).toBe('drawn');
  expect(await attr(page, 'detail')).toBe('full');
  expect(problems).toEqual([]);
});

test('draw has a keyboard route, and Escape leaves', async ({ page }) => {
  await open(page);
  await page.locator('#draw-open').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#draw-surprise')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#draw')).toBeHidden();
  await expect(stage(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => attr(page, 'shape')).toBe('drawn');
});

test('the playground stays inside the full-detail budget', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1600 });
  await open(page);
  await settled(page);
  await page.waitForTimeout(200);
  const stats = await page.evaluate(() => (window as unknown as { siteDetailStats(): { full: number; demoted: number } }).siteDetailStats());
  expect(stats.full).toBeLessThanOrEqual(6);
  expect(stats.demoted).toBe(0);
});

test.describe('scheme', () => {
  test('it opens light, whatever the visitor\'s scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'light');
    await expect(page.locator('#scheme')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 248, 244)');
  });

  test('the switch turns it dark, and the choice is kept', async ({ page }) => {
    await open(page);
    await page.locator('#scheme').click();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
    await expect(page.locator('#scheme')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(20, 17, 16)');
    await page.reload();
    await expect(page.locator('#mixer .mixer__item').first()).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
    await page.locator('#scheme').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'light');
  });
});

test('every option and the timeline are in the left rail, and the right side is code', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  for (const selector of ['#shapes', '#materials', '#colours', '#mixer', '#p-timeline #beats']) {
    await expect(page.locator(`.rail ${selector}`), selector).toBeAttached();
  }
  await expect(page.locator('.side .output [role="tablist"]')).toHaveCount(1);
  await expect(page.locator('#p-tag, #rows, #add, #tools-head')).toHaveCount(0);
  await expect(page.locator('.side #p-timeline')).toHaveCount(0);
});

test('on a desktop the sidebars scroll on their own, and the page holds still', async ({ page }) => {
  // Short enough that the body tab runs past it.
  await page.setViewportSize({ width: 1440, height: 660 });
  await open(page);
  for (const selector of ['.rail', '.side']) {
    const [overflow, client, bottom] = await page.locator(selector).evaluate((el) => [getComputedStyle(el).overflowY, el.clientHeight, el.getBoundingClientRect().bottom]);
    expect(overflow, selector).toBe('auto');
    expect(client, selector).toBeLessThanOrEqual(660);
    expect(bottom, selector).toBeLessThanOrEqual(660);
  }
  const rail = page.locator('.rail');
  expect(await rail.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await rail.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => rail.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // The timeline runs past the window too, and scrolls in the rail rather than being cut off.
  await page.locator('#tab-timeline').click();
  await rail.hover();
  await page.mouse.wheel(0, 600);
  await expect(page.locator('#beats li').last()).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  const area = await page.locator('#area').boundingBox();
  expect(area!.y + area!.height).toBeLessThanOrEqual(660);
});

test('the stage opens light, and its background picker is inside it', async ({ page }) => {
  await open(page);
  await expect(page.locator('#area')).toHaveAttribute('data-stage-ground', 'light');
  await expect(page.locator('#grounds input')).toHaveCount(3);
  expect(await page.locator('#grounds input').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value || input.getAttribute('aria-label')))).toEqual(['light', 'dark', expect.any(String)]);
  await expect(page.locator('#grounds input[value=light]')).toBeChecked();
  await expect(page.locator('#area #grounds')).toBeAttached();
  const [area, picker] = await Promise.all([page.locator('#area').boundingBox(), page.locator('#grounds').boundingBox()]);
  expect(picker!.y).toBeGreaterThanOrEqual(area!.y);
  expect(picker!.x + picker!.width).toBeLessThanOrEqual(area!.x + area!.width);
  // A link to a background that's gone opens on the default.
  await page.goto('about:blank');
  await open(page, '#v=1&g=busy');
  await expect(page.locator('#area')).toHaveAttribute('data-stage-ground', 'light');
});

test('there is no pause in the nav', async ({ page }) => {
  await open(page);
  await expect(page.locator('.site-nav').getByRole('button')).toHaveCount(0);
  await expect(page.locator('.site-nav')).not.toContainText('pause');
});

test('the sidebar headings stand apart from their controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await expect(page.locator('.work .head')).toHaveText(['state']);
  await expect(page.locator('.rail .head')).toHaveText(['shape', 'material', 'colour']);
  await expect(page.locator('.side .head')).toHaveCount(0);
  for (const head of await page.locator('.head').all()) {
    expect(await head.evaluate((el) => [getComputedStyle(el).textTransform, getComputedStyle(el).fontWeight])).toEqual(['uppercase', '600']);
  }
  // Space, not rules, sets the groups apart.
  expect(await page.locator('.head').evaluateAll((heads) => heads.map((el) => getComputedStyle(el).borderTopStyle))).toEqual(['none', 'none', 'none', 'none']);
});

const VIEWPORTS = [[320, 640], [360, 740], [390, 844], [768, 1024], [1024, 768], [1180, 800], [1440, 900], [1920, 1080]] as const;

for (const [width, height] of VIEWPORTS) {
  test(`no sideways page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const problems = await open(page, '#v=1&accessories=antenna&color=var(--mascot-color)&sky=auto&size=240');
    await settled(page);
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth] as const);
    expect(scroll).toBeLessThanOrEqual(client);
    expect(problems).toEqual([]);
  });
}


async function openDownload(page: Page) {
  await page.locator('#download-open').click();
  await expect(page.locator('#download')).toBeVisible();
}

/** The PNG's width and height, from its header. */
const pngSize = (bytes: Buffer) => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];

test('downloads the icon frame as a PNG at the size picked', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only checked where it was built and seen working.');
  const problems = await open(page);
  await openDownload(page);
  await expect(page.locator('#icon-sizes button')).toHaveText(['512', '256', '128', '64', '32']);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a 128px PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('mascot-blob-idle-128.png');
  const bytes = Buffer.concat(await (await download.createReadStream()).toArray());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(pngSize(bytes)).toEqual([128, 128]);
  expect(bytes.length).toBeGreaterThan(2_000);
  expect(problems).toEqual([]);
});

test('download is a dialog: the frame mirrors the stage, on a ground, and the mascot moves, sizes and turns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const dialog = page.locator('#download');
  await expect(dialog).toBeHidden();
  await page.locator('#shapes label', { hasText: 'cat' }).click();
  await openDownload(page);
  expect(await dialog.evaluate((el: HTMLDialogElement) => el.matches(':modal'))).toBe(true);
  const icon = page.locator('#icon-mascot');
  await expect(icon).toHaveAttribute('shape', 'cat');
  await expect(icon).toHaveAttribute('track', 'none');
  const transform = () => icon.evaluate((el) => el.style.transform);
  // It starts large, tipped and off to a corner.
  await expect.poll(transform).toBe('translate(16%, 20%) rotate(-30deg) scale(1.5)');

  const frame = page.locator('#icon-frame');
  expect((await frame.boundingBox())!.width).toBe(96);
  // Light by default. Dark is a deep plum for the teal body, never black, and transparent shows the
  // checkerboard. The picker spans the controls.
  const background = () => frame.evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(page.locator('#icon-grounds input[value=light]')).toBeChecked();
  await expect.poll(background).toBe('rgb(255, 255, 255)');
  await page.locator('#icon-grounds input[value=dark]').check({ force: true });
  await expect.poll(background).toBe('rgb(57, 27, 40)');
  await page.locator('#icon-grounds input[value=transparent]').check({ force: true });
  await expect(frame).toHaveAttribute('data-clear', '');
  const [grounds, controls] = await Promise.all([page.locator('#icon-grounds').boundingBox(), page.locator('.download__controls').boundingBox()]);
  expect(Math.abs(grounds!.width - controls!.width)).toBeLessThanOrEqual(1);
  // Still for an icon; moving, as on the stage, for a video.
  await expect(icon).toHaveAttribute('motion', '0');
  await page.locator('#dl-tab-video').click();
  await expect(icon).not.toHaveAttribute('motion', /.*/);
  await expect(page.locator('#save-video')).toBeVisible();
  await expect(page.locator('#icon-sizes')).toBeHidden();
  await page.locator('#dl-tab-icon').click();
  await expect(icon).toHaveAttribute('motion', '0');

  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - box.width / 4, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(transform).toMatch(/^translate\(-9(\.\d+)?%, 20%\)/);

  await page.getByRole('spinbutton', { name: 'size, exact value' }).fill('0.8');
  await page.getByRole('spinbutton', { name: 'rotation, exact value' }).fill('15');
  await expect.poll(transform).toMatch(/rotate\(15deg\) scale\(0\.8\)$/);
  await frame.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(transform).toMatch(/, 18%\)/);
  await dialog.getByRole('button', { name: 'reset' }).click();
  await expect.poll(transform).toBe('translate(16%, 20%) rotate(-30deg) scale(1.5)');
  // The previews draw from the frame.
  await expect.poll(() => page.locator('.icon-size__preview').first().evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((value, i) => i % 4 === 3 && value > 0);
  })).toBe(true);
  await page.locator('#download-close').click();
  await expect(dialog).toBeHidden();
  await openDownload(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('the dark ground answers the body colour, and stays dark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '#v=1&color=%23ffd84d');
  await openDownload(page);
  await page.locator('#icon-grounds input[value=dark]').check({ force: true });
  const ground = () => page.locator('#icon-frame').evaluate((el) => getComputedStyle(el).backgroundColor);
  // A deep blue for a yellow body.
  await expect.poll(ground).toMatch(/^rgb\(3\d, 3\d, 6\d\)$/);
  const [r = 0, g = 0, b = 0] = (await ground()).match(/\d+/g)!.map(Number);
  expect(Math.max(r, g, b)).toBeLessThan(80);
  expect(r + g + b).toBeGreaterThan(60);
});

test('records the icon frame as a short video', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only checked where it was built and seen working.');
  const problems = await open(page);
  await openDownload(page);
  await page.locator('#dl-tab-video').click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), page.locator('#save-video').click()]);
  expect(download.suggestedFilename()).toMatch(/^mascot-blob-idle\.(mp4|webm)$/);
  const bytes = Buffer.concat(await (await download.createReadStream()).toArray());
  expect(bytes.length).toBeGreaterThan(50_000);
  await expect(page.locator('#save-video')).toHaveText('record video');
  expect(problems).toEqual([]);
});

test('the states are plain tiles, and no call is printed', async ({ page }) => {
  await open(page);
  await expect(page.locator('#moods .pick')).toHaveCount(9);
  await expect(page.locator('#moods kbd')).toHaveCount(0);
  await expect(page.locator('#moods')).toHaveAttribute('aria-label', /^State/);
  await expect(page.locator('#ticker')).toHaveCount(0);
  await page.locator('#moods input[value=error]').check({ force: true });
  await expect(page.locator('.readout')).not.toContainText('el.');
});

test('the eye colour is labelled eye, and auto hands it back to the body', async ({ page }) => {
  await open(page);
  const row = page.locator('.colours__row').nth(2);
  await expect(row.locator('code')).toHaveText('eye');
  await expect(row.locator('input[type=text]')).toHaveAttribute('placeholder', 'auto');
  const auto = row.getByRole('button', { name: 'eye-color: back to auto' });
  await expect(auto).toBeDisabled();
  await row.locator('input[type=text]').fill('#ff0000');
  await expect.poll(() => attr(page, 'eye-color')).toBe('#ff0000');
  await expect(auto).toBeEnabled();
  await auto.click();
  await expect.poll(() => attr(page, 'eye-color')).toBeNull();
  await expect(row.locator('input[type=text]')).toHaveValue('');
  await expect(auto).toBeDisabled();
});

test('the preview is just the stage: no size, keys, guides or mic', async ({ page }) => {
  await open(page);
  for (const selector of ['#size-readout', '#keys', '#guides', '#mic', '#hint-keys']) await expect(page.locator(selector), selector).toHaveCount(0);
  await expect(page.locator('.readout')).not.toContainText('px');
  // Keys still work without a hint.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('5');
  await expect.poll(() => attr(page, 'mood')).toBe('error');
});

test('a click on the mascot shows the guides, and a click away hides them', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await stage(page).click();
  await expect(page.locator('#frame')).toBeVisible();
  await page.locator('.rail .head').first().click();
  await expect(page.locator('#frame')).toBeHidden();
});

test('the rail is four tabs: body, accessories, motion and timeline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const tabs = page.locator('.rail [role="tab"]');
  await expect(tabs).toHaveText(['body', 'accessories', 'motion', 'timeline']);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  for (const selector of ['#shapes', '#materials', '#colours']) await expect(page.locator(`#p-body ${selector}`), selector).toBeVisible();
  await expect(page.locator('#p-accessories')).toBeHidden();
  await expect(page.locator('#mixer')).toBeHidden();
  await expect(page.locator('#p-timeline')).toBeHidden();
  await tabs.nth(2).click();
  await expect(page.locator('#mixer')).toBeVisible();
  await expect(page.locator('#p-body')).toBeHidden();
  // The arrow keys move along, as in any tab list.
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(page.locator('#p-accessories')).toBeVisible();
  await tabs.nth(3).click();
  await expect(page.locator('#tl-play')).toBeVisible();
  // The tabs keep to one line.
  const rows = await tabs.evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size);
  expect(rows).toBe(1);
  // The three columns start on one line.
  const tops = await Promise.all(['.rail [role="tab"]', '#area', '#out-tabs'].map((selector) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top)));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
});

test('the material switch fills the rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const [group, body] = await Promise.all([page.locator('#materials').boundingBox(), page.locator('#p-body').boundingBox()]);
  expect(Math.abs(group!.width - body!.width)).toBeLessThanOrEqual(1);
  const widths = await page.locator('#materials > label').evaluateAll((labels) => labels.map((el) => Math.round(el.getBoundingClientRect().width)));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
});

test('accessories are a grid of icons that toggle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems = await open(page);
  await page.locator('#tab-accessories').click();
  const tiles = page.locator('#accessories .pick');
  const names = await page.evaluate(() => [...document.querySelectorAll('#accessories .pick span')].map((el) => el.textContent));
  expect(names).toHaveLength(24);
  expect(names).not.toContain('auto');
  expect(names).not.toContain('none');
  // An icon of its own each, drawn here: no mascots, no pictures.
  await expect(page.locator('#accessories .pick > svg.icon')).toHaveCount(24);
  await expect(page.locator('#accessories agent-mascot, #accessories img')).toHaveCount(0);
  const drawings = await page.locator('#accessories svg').evaluateAll((icons) => icons.map((icon) => icon.innerHTML));
  expect(new Set(drawings).size).toBe(24);
  // Three to a row.
  const tops = await tiles.evaluateAll((els) => els.slice(0, 4).map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops.slice(0, 3)).size).toBe(1);
  expect(tops[3]).toBeGreaterThan(tops[0]!);
  await expect(page.locator('#accessories .pick[aria-pressed="true"]')).toHaveCount(0);

  const halo = tiles.filter({ hasText: /^halo$/ });
  const bow = tiles.filter({ hasText: /^bow$/ });
  await halo.click();
  await settled(page);
  expect(await attr(page, 'accessories')).toBe('halo');
  await expect(halo).toHaveAttribute('aria-pressed', 'true');
  await bow.click();
  await settled(page);
  expect(await attr(page, 'accessories')).toBe('halo bow');
  await halo.click();
  await bow.click();
  await settled(page);
  expect(await attr(page, 'accessories')).toBe('none');
  await expect(page.locator('#accessories .pick[aria-pressed="true"]')).toHaveCount(0);

  // A shape's own show as on, once its accessories are back to the default.
  await page.locator('#reset').click();
  await page.locator('#tab-body').click();
  await page.locator('#shapes input[value=cat]').check({ force: true });
  await page.locator('#tab-accessories').click();
  await expect(tiles.filter({ hasText: /^whiskers$/ })).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('the code tabs are the five frameworks, each a mark and its name', async ({ page }) => {
  await open(page);
  const tabs = page.locator('#out-tabs [role="tab"]');
  await expect(tabs).toHaveText(['html', 'react', 'vue', 'svelte', 'solid']);
  for (const tab of await tabs.all()) await expect(tab.locator('svg.icon')).toHaveCount(1);
  // Drawing a shape adds no tab.
  await page.locator('#draw-open').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => attr(page, 'shape')).toBe('drawn');
  await expect(tabs).toHaveCount(5);
});

test('the stage has no header over it: the edits sit in its corner, and download at its foot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await expect(page.locator('.bar, .toolbar, #share, #save, #views, #track-area, #ladder, #code-head')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('playground');
  for (const selector of ['#undo', '#shuffle', '#reset', '#scheme']) await expect(page.locator(`#area ${selector}`), selector).toBeVisible();
  const [area, actions] = await Promise.all([page.locator('#area').boundingBox(), page.locator('.stage__actions').boundingBox()]);
  expect(area!.x + area!.width - (actions!.x + actions!.width)).toBeLessThan(16);
  expect(actions!.y - area!.y).toBeLessThan(16);
  const [download, scheme] = await Promise.all([page.locator('#area #download-open').boundingBox(), page.locator('#scheme').boundingBox()]);
  expect(Math.abs(download!.x + download!.width / 2 - (area!.x + area!.width / 2))).toBeLessThan(2);
  expect(download!.width).toBeLessThanOrEqual(240);
  expect(download!.x + download!.width).toBeLessThan(scheme!.x);
  expect(area!.y + area!.height - (download!.y + download!.height)).toBeLessThan(16);
  await expect(page.locator('.output')).toHaveAccessibleName('Code');
  await expect(page.locator('.output__head #copy-code')).toHaveCount(0);
});
