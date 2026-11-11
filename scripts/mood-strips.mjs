// Renders every mood as a strip of frames over time, one row per mood, into
// test/screenshots/. Time comes from a fake clock, so runs are repeatable.
// Run after `bun run build`:  node scripts/mood-strips.mjs [out-dir] [attrs-as-json] [name]
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.argv[2] ?? `${root}test/screenshots/`;
const attrs = JSON.parse(process.argv[3] ?? '{}');
const name = process.argv[4] ?? 'mood-strips';
const PORT = Number(process.env.PORT ?? 4181);
const FRAMES = 8;
const STEP = 230;
const CELL = 150;
const WARMUP = 2400;
const MOODS = ['idle', 'thinking', 'working', 'success', 'error', 'listening', 'speaking', 'waiting', 'sleeping'];

const server = spawn('node', ['test/browser/serve.mjs', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 400));
await mkdir(out, { recursive: true });

const attributes = Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
const cells = MOODS.map((mood) => `<agent-mascot mood="${mood}" detail="full"${attributes}></agent-mascot>`).join('');
const html = `<!doctype html><meta charset="utf-8"><title>strip</title>
  <style>body{margin:0;background:${attrs.background ?? '#fff'}}
  div{display:grid;grid-template-columns:${CELL}px;width:${CELL}px}agent-mascot{width:${CELL}px}</style>
  <script type="module" src="/dist/index.js"></script><div>${cells}</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: CELL, height: CELL * MOODS.length }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.addInitScript(() => {
    // A fixed random stream, so blinks and glances land the same way each run.
    let seed = 7;
    Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  });
  await page.clock.install({ time: 0 });
  await page.route('**/strip.html', (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`http://127.0.0.1:${PORT}/strip.html`);
  await page.waitForFunction(() => customElements.get('agent-mascot'));
  await page.clock.runFor(WARMUP);
  const shots = [];
  for (let i = 0; i < FRAMES; i++) {
    await page.clock.runFor(STEP);
    shots.push((await page.screenshot({ type: 'png' })).toString('base64'));
  }
  const sheet = await browser.newPage({
    viewport: { width: CELL * FRAMES + 90, height: CELL * MOODS.length },
    deviceScaleFactor: 1,
  });
  await sheet.setContent(`<!doctype html><style>
    body{margin:0;display:flex;font:13px system-ui;background:${attrs.background ?? '#fff'};color:#888}
    .l{width:90px}.l div{height:${CELL}px;display:flex;align-items:center;padding-left:8px}img{display:block}</style>
    <div class="l">${MOODS.map((mood) => `<div>${mood}</div>`).join('')}</div>
    ${shots.map((shot) => `<img src="data:image/png;base64,${shot}">`).join('')}`);
  await sheet.waitForLoadState('load');
  await sheet.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  if (errors.length) console.error(errors);
} finally {
  await browser.close();
  server.kill();
}
