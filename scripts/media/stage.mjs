// A frame-stepped browser stage for the README and social media. Pages load the built library
// and the site fonts through request interception, so no port is opened. Time comes from a fake
// clock and a seeded random stream, so every run renders the same frames.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const root = fileURLToPath(new URL('../..', import.meta.url));
/** Point this at a copy of dist/ to capture a snapshot while something else rebuilds. */
export const dist = process.env.MEDIA_DIST ?? join(root, 'dist');
const ORIGIN = 'http://media.invalid';
const TYPES = {
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/** 25 frames per second. */
export const FRAME_MS = 40;

let browser;

export async function launch() {
  browser ??= await chromium.launch();
  return browser;
}

export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

const fontCss = `
@font-face { font-family: Fraunces; src: url(/fonts/fraunces.woff2) format('woff2'); font-weight: 500 900; }
@font-face { font-family: Recursive; src: url(/fonts/recursive.woff2) format('woff2'); font-weight: 400 700; }
html, body { margin: 0; }
`;

/** Open a page holding `body`, with the library loaded and fonts ready. */
export async function openStage({ width, height, scale = 1, css = '', body, script = '', seed = 7, colorScheme = 'light' }) {
  const page = await (await launch()).newPage({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  await freeze(page, seed);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/stage.html') {
      const html = `<!doctype html><meta charset="utf-8"><title>stage</title>
        <style>${fontCss}${css}</style><script type="module" src="/lib/index.js"></script>${body}
        <script type="module">${script}</script>`;
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    const file = pathname.startsWith('/fonts/') ? join(root, 'site', pathname) : join(dist, pathname.slice('/lib/'.length));
    try {
      return await route.fulfill({ contentType: TYPES[extname(file)] ?? 'application/octet-stream', body: await readFile(file) });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  await page.goto(`${ORIGIN}/stage.html`);
  await page.waitForFunction(() => customElements.get('agent-mascot'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.fonts].map((face) => face.load())));
  // Observers report on real frames, so let them see the mascots before stopping the clock.
  // Installed clocks keep running until paused, and every step after this one is explicit.
  await page.waitForTimeout(150);
  await page.clock.pauseAt(60_000);
  return { page, errors };
}

/** Seeds Math.random and installs the fake clock, so every run renders the same frames. */
async function freeze(page, seed) {
  await page.addInitScript((start) => {
    let value = start;
    Math.random = () => (value = (value * 16807) % 2147483647) / 2147483647;
  }, seed);
  await page.clock.install({ time: 0 });
}

/** Advance the page by `ms`, moving CSS transitions in step with the fake clock. */
export async function advance(page, ms) {
  await page.clock.runFor(ms);
  await page.evaluate((step) => {
    for (const animation of document.getAnimations()) {
      // Scroll-driven ones follow the scroll, not time, and the page holds still.
      if (!(animation.timeline instanceof DocumentTimeline)) continue;
      animation.pause();
      animation.currentTime = (animation.currentTime ?? 0) + step;
    }
  }, ms);
}

export const shot = (page, clip, transparent = false) =>
  page.screenshot({ type: 'png', clip, omitBackground: transparent, scale: 'device' });

/** Write one frame of a numbered PNG sequence. */
export async function saveFrame(dir, index, png) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${String(index).padStart(4, '0')}.png`), png);
}

export async function saveFile(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}
