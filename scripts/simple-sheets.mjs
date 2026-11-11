// Zoomed sheets of the simple detail level, into test/screenshots/. Run after `bun run build`.
//
// Each sheet is rendered at real size, device scale 1, then enlarged with nearest-neighbour
// scaling, so what you see is what the pixels really are at 16, 24 and 32px.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}test/screenshots/`;
const PORT = Number(process.env.PORT ?? 41875);
const SHAPES = ['blob', 'orb', 'egg', 'squircle', 'flame', 'cloud', 'bell', 'ghost', 'cap', 'gem'];
const MOODS = ['idle', 'thinking', 'working', 'success', 'error', 'listening', 'speaking', 'waiting', 'sleeping'];
const SIZES = [16, 24, 32];
const BACKDROPS = { white: '#fff', black: '#0b0d12' };

const mascot = (attrs) =>
  `<agent-mascot detail="simple" ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}></agent-mascot>`;

/** Rows of shapes against columns of moods, at each size, on each backdrop. */
function grid(attrs = {}, shapes = SHAPES, sizes = SIZES) {
  return Object.values(BACKDROPS).flatMap((background) =>
    sizes.map((size) => {
      const cells = shapes.flatMap((shape) => MOODS.map((mood) => mascot({ shape, mood, size, ...attrs })));
      return `<div style="background:${background};display:grid;grid-template-columns:repeat(${MOODS.length},${size + 8}px);
        place-items:center;gap:4px;padding:6px;width:max-content">${cells.join('')}</div>`;
    }),
  ).join('');
}

const page = (body) => `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>
  <script type="module" src="/dist/index.js"></script><body><div id="sheet" style="width:max-content">${body}</div></body>`;

const colors = ['#18c2a0', '#3b82f6', '#f25c3b', '#a855f7', '#f5b301', '#ec4899', '#111827', '#f8fafc'];
const SHEETS = {
  'simple-16': { html: grid({}, SHAPES, [16]), zoom: 6 },
  'simple-24': { html: grid({}, SHAPES, [24]), zoom: 4 },
  'simple-32': { html: grid({}, SHAPES, [32]), zoom: 3 },
  'simple-colors': {
    html: Object.values(BACKDROPS).map((background) =>
      `<div style="background:${background};padding:6px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:640px">
      ${colors.flatMap((color) => SIZES.flatMap((size) => [mascot({ color, size }), mascot({ color, size, mood: 'success' }), mascot({ color, size, material: 'frost', mood: 'error' })])).join('')}</div>`).join(''),
    zoom: 3,
  },
  // Either side of the auto boundary, to judge how much a swap shows.
  'simple-swap': {
    html: Object.values(BACKDROPS).map((background) =>
      `<div style="background:${background};padding:6px;display:grid;grid-template-columns:repeat(10,64px);gap:6px">
      ${SHAPES.map((shape) => mascot({ shape, size: 64 })).join('')}
      ${SHAPES.map((shape) => mascot({ shape, size: 64, detail: 'full' }).replace('detail="simple" ', '')).join('')}</div>`).join(''),
    zoom: 2,
  },
  'simple-sky': {
    html: `<div style="background:#fff;padding:6px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:420px">
      ${SIZES.flatMap((size) => ['auto', 'tomato', '#1e3a8a, #38bdf8'].flatMap((sky) => ['blob', 'cloud'].map((shape) => mascot({ size, sky, shape, mood: 'success' })))).join('')}</div>`,
    zoom: 4,
  },
};

const only = process.argv[2];
const server = spawn('node', ['test/browser/serve.mjs', String(PORT)], { cwd: root, stdio: 'ignore' });
// Poll rather than sleep: on a busy machine the server can take seconds to listen.
for (let tries = 0; ; tries++) {
  const up = await fetch(`http://127.0.0.1:${PORT}/test/browser/harness.html`).then((r) => r.ok, () => false);
  if (up) break;
  if (tries > 100) throw new Error('the static server did not start');
  await new Promise((resolve) => setTimeout(resolve, 100));
}
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const zoomer = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  for (const [name, { html, zoom }] of Object.entries(SHEETS)) {
    if (only && !name.startsWith(only)) continue;
    const tab = await context.newPage();
    await tab.route('**/sheet.html', (route) => route.fulfill({ contentType: 'text/html', body: page(html) }));
    await tab.goto(`http://127.0.0.1:${PORT}/sheet.html`);
    await tab.waitForFunction(() => customElements.get('agent-mascot'));
    await tab.waitForTimeout(250);
    const png = await tab.locator('#sheet').screenshot();
    const { width, height } = await tab.locator('#sheet').evaluate((el) => el.getBoundingClientRect());
    await tab.close();
    await zoomer.setViewportSize({ width: Math.ceil(width) * zoom, height: Math.ceil(height) * zoom });
    await zoomer.setContent(
      `<body style="margin:0"><img style="display:block;image-rendering:pixelated;width:${Math.ceil(width) * zoom}px" src="data:image/png;base64,${png.toString('base64')}">`,
    );
    await zoomer.waitForFunction(() => document.images[0]?.complete);
    await zoomer.screenshot({ path: `${out}${name}.png`, fullPage: true });
  }
} finally {
  await browser.close();
  server.kill();
}
