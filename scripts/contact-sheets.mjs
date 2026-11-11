// Renders contact sheets of every shape and material on white, near-black and a busy
// gradient, into test/screenshots/. Run after `bun run build`.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}test/screenshots/`;
const PORT = Number(process.env.PORT ?? 4179);
const only = process.argv[2];
// A second argument renders with another engine, into a directory of your choice.
const ENGINES = { chromium, firefox, webkit };
const engine = process.argv[3] ?? 'chromium';
const target = process.argv[4] ?? out;

const SHAPES = ['blob', 'orb', 'egg', 'squircle', 'flame', 'cloud', 'bell', 'ghost', 'cap', 'gem'];
const MATERIALS = ['glow', 'frost', 'glass'];
const ACCESSORIES = [
  'antenna', 'stalk', 'ears', 'arms', 'ring', 'leaf', 'rays', 'spots',
  'stem', 'tentacles', 'facets', 'blush', 'sheen', 'iridescent', 'bubbles', 'outline',
];
const COLORS = ['#18c2a0', '#3b82f6', '#f25c3b', '#a855f7', '#f5b301', '#ec4899', '#111827', '#f8fafc'];
const BACKDROPS = {
  white: '#ffffff',
  black: '#0b0d12',
  busy: `conic-gradient(from 210deg at 30% 40%, #ff5f6d, #ffc371 18%, #47e1a8 36%, #2d9cff 56%, #8a4dff 76%, #ff5f6d),
         repeating-linear-gradient(45deg, #0002 0 14px, #fff2 14px 28px)`,
};

const mascot = (attrs) =>
  `<agent-mascot ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}></agent-mascot>`;

const row = (backdrop, cells, size, columns) => `
  <div style="background:${BACKDROPS[backdrop]};padding:12px;display:grid;
              grid-template-columns:repeat(${columns},${size}px);gap:8px;justify-content:center">
    ${cells}
  </div>`;

function sheet(name, body) {
  return { name, html: `<!doctype html><html><head><meta charset="utf-8"><title>${name}</title>
    <style>body{margin:0;font:12px system-ui}agent-mascot{width:100%}</style>
    <script type="module" src="/dist/index.js"></script></head><body>${body}</body></html>` };
}

const sheets = [];
for (const material of MATERIALS) {
  const cells = SHAPES.map((shape) => mascot({ shape, material, detail: 'full' })).join('');
  sheets.push(sheet(`material-${material}`, Object.keys(BACKDROPS).map((b) => row(b, cells, 180, 5)).join('')));
}
for (const material of MATERIALS) {
  const cells = ACCESSORIES.map((accessories) =>
    mascot({ shape: accessories === 'tentacles' ? 'bell' : accessories === 'stem' ? 'cap' : 'blob', material, accessories, detail: 'full' })).join('');
  sheets.push(sheet(`accessories-${material}`, Object.keys(BACKDROPS).map((b) => row(b, cells, 150, 8)).join('')));
}
{
  const cells = COLORS.flatMap((color) => MATERIALS.map((material) => mascot({ color, material, detail: 'full' }))).join('');
  sheets.push(sheet('colors', Object.keys(BACKDROPS).map((b) => row(b, cells, 96, 12)).join('')));
}
{
  const skies = ['auto', 'tomato', '#1e3a8a, #38bdf8'];
  const cells = skies.flatMap((sky) => MATERIALS.flatMap((material) => ['blob', 'cloud'].map((shape) => mascot({ shape, material, sky, detail: 'full' })))).join('');
  sheets.push(sheet('sky', row('white', cells, 150, 6) + row('black', cells, 150, 6)));
}
{
  const eyes = [
    { 'eye-shape': 'pill' }, { 'eye-shape': 'round' }, { 'eye-shape': 'square' }, { 'eye-shape': 'dot' },
    { 'eye-width': 1.6 }, { 'eye-height': 0.5 }, { 'eye-spacing': 1.5 }, { 'eye-y': -0.8 },
    { 'eye-color': '#1f2937' }, { 'eye-color': 'tomato' },
  ];
  const cells = MATERIALS.flatMap((material) => eyes.map((e) => mascot({ material, detail: 'full', ...e }))).join('');
  sheets.push(sheet('eyes', Object.keys(BACKDROPS).map((b) => row(b, cells, 110, 10)).join('')));
}
{
  const moods = ['idle', 'thinking', 'working', 'success', 'error', 'listening', 'speaking', 'waiting', 'sleeping'];
  const cells = MATERIALS.flatMap((material) => moods.map((mood) => mascot({ material, mood, detail: 'full' }))).join('');
  sheets.push(sheet('moods', Object.keys(BACKDROPS).map((b) => row(b, cells, 120, 9)).join('')));
}

const server = spawn('node', ['test/browser/serve.mjs', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 400));
await mkdir(target, { recursive: true });

const browser = await ENGINES[engine].launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
try {
  for (const { name, html } of sheets) {
    if (only && !name.startsWith(only)) continue;
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.route('**/sheet.html', (route) => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`http://127.0.0.1:${PORT}/sheet.html`);
    await page.waitForFunction(() => customElements.get('agent-mascot'));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${target}${name}.png`, fullPage: true });
    if (errors.length) console.error(name, errors);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
