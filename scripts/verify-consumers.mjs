// Proves the published package works from the outside. It packs the real tarball, installs
// it into throwaway projects under test/fixtures/.tmp, then type-checks, builds and loads
// them in browsers. Nothing here imports from src/ or dist/ except through that tarball.
//
//   bun scripts/verify-consumers.mjs [--keep] [--skip-install] [html node types react vue solid svelte]
//
// The folders are deleted after a clean run, unless --keep is set. --skip-install reuses kept
// ones, with their installed tarball. WebKit is skipped with a warning if it can't launch on
// this machine, unless CI is set.
// oxlint-disable no-console -- this script's output is its report
import { execFile } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium, firefox, webkit } from 'playwright';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const templates = join(root, 'test/fixtures/consumers');
const tmp = join(root, 'test/fixtures/.tmp');

const args = process.argv.slice(2);
const reuse = args.includes('--skip-install');
const keep = reuse || args.includes('--keep');
const selected = args.filter((arg) => !arg.startsWith('--'));
const wants = (name) => selected.length === 0 || selected.includes(name);

const results = [];
const record = (status, name, detail = '') => {
  results.push({ status, name, detail });
  console.log(`${status.padEnd(4)} ${name}${detail ? `: ${detail}` : ''}`);
};

/** Run a step, recording a failure instead of stopping, so one report covers everything. */
async function step(name, action) {
  try {
    record('PASS', name, (await action()) ?? '');
  } catch (error) {
    record('FAIL', name, String(error.stdout || error.stderr ? `${error.stdout}${error.stderr}` : error.message).trim());
  }
}

const shell = (cwd, command, ...commandArgs) =>
  run(command, commandArgs, { cwd, maxBuffer: 1 << 26 });
const bin = (cwd, tool, ...toolArgs) => shell(cwd, join(cwd, 'node_modules/.bin', tool), ...toolArgs);

/* ---------- tarball ---------- */

async function pack() {
  await mkdir(tmp, { recursive: true });
  const { stdout } = await shell(root, 'npm', 'pack', '--json', '--pack-destination', tmp);
  const [{ filename, files, size, unpackedSize }] = JSON.parse(stdout.slice(stdout.indexOf('[\n')));
  const paths = files.map(({ path }) => path);

  const required = [
    'LICENSE',
    'README.md',
    'custom-elements.json',
    'dist/cdn.js',
    'dist/core.js',
    'dist/index.d.ts',
    'dist/index.js',
    'dist/jsx.d.ts',
    'dist/jsx.js',
    'dist/shapes/orb.d.ts',
    'dist/shapes/orb.js',
    'dist/accessories/ears.d.ts',
    'dist/accessories/ears.js',
    'package.json',
  ];
  const missing = required.filter((path) => !paths.includes(path));
  if (missing.length) throw new Error(`tarball is missing ${missing.join(', ')}`);
  const stray = paths.filter((path) => !/^(dist\/|LICENSE$|README\.md$|custom-elements\.json$|package\.json$)/.test(path));
  if (stray.length) throw new Error(`tarball has stray files: ${stray.join(', ')}`);
  return { path: join(tmp, filename), summary: `${files.length} files, ${size} bytes packed, ${unpackedSize} unpacked` };
}

/** Copy a template to a fresh folder and install the tarball into it. */
async function install(name, tarball) {
  const cwd = join(tmp, name);
  if (reuse) return cwd;
  await rm(cwd, { recursive: true, force: true });
  await cp(join(templates, name), cwd, { recursive: true });
  const file = join(cwd, 'package.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.dependencies['@comfycomputer/agent-mascots'] = `file:${tarball}`;
  await writeFile(file, JSON.stringify(manifest, null, 2));
  await shell(cwd, 'npm', 'install', '--no-audit', '--no-fund', '--no-package-lock');
  return cwd;
}

/* ---------- browsers ---------- */

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

/** Serve a folder. `headers` lets a page opt in to a strict CSP. */
function serve(dir, headers = () => ({})) {
  const server = createServer(async (request, response) => {
    const pathname = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
    const file = join(dir, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers(pathname) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

const engines = [];

async function launchEngines() {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    try {
      engines.push({ name, browser: await type.launch() });
    } catch (error) {
      const message = `${name} could not launch: ${error.message.split('\n')[0]}`;
      if (process.env.CI || name !== 'webkit') record('FAIL', message);
      else record('SKIP', message);
    }
  }
}

/** Open a page in each engine, failing on any page error, console error or failed request. */
async function inBrowsers(label, url, check) {
  for (const { name, browser } of engines) {
    await step(`${label} [${name}]`, async () => {
      const page = await browser.newPage();
      const problems = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) {
          problems.push(`${response.status()} ${response.url()}`);
        }
      });
      try {
        await page.goto(url);
        await check(page);
        if (problems.length) throw new Error(problems.join('\n'));
      } finally {
        await page.close();
      }
    });
  }
}

/** Facts about an upgraded mascot, read from inside the page. */
const inspect = (page, selector) =>
  page.locator(selector).evaluate((element) => ({
    upgraded: customElements.get('agent-mascot') === element.constructor,
    width: element.getBoundingClientRect().width,
    svgs: element.shadowRoot?.querySelectorAll('svg').length ?? 0,
    paths: element.shadowRoot?.querySelectorAll('path').length ?? 0,
    role: element.getAttribute('role'),
    label: element.getAttribute('aria-label'),
    detail: element.shadowRoot?.querySelector('.tile')?.getAttribute('data-detail'),
    sheets: element.shadowRoot?.adoptedStyleSheets.length ?? 0,
  }));

function assertMascot(state, what) {
  const ok = state.upgraded && state.width === 160 && state.svgs > 0 && state.paths > 0 && state.detail === 'full';
  if (!ok) throw new Error(`${what} did not render: ${JSON.stringify(state)}`);
}

const assertEqual = (actual, expected, what) => {
  if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`);
};

/** A path unique to each shape, for checking what a bundle includes. */
async function shapeFingerprints(cwd) {
  const dir = join(cwd, 'node_modules/@comfycomputer/agent-mascots/dist/shapes');
  const fingerprints = {};
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.js')) continue;
    const match = (await readFile(join(dir, file), 'utf8')).match(/["'`](M\d[^"'`]{40,})/);
    if (match) fingerprints[file.replace('.js', '')] = match[1].slice(0, 32);
  }
  return fingerprints;
}

async function bundledText(dist) {
  const dir = join(dist, 'assets');
  const files = (await readdir(dir)).filter((file) => file.endsWith('.js'));
  return (await Promise.all(files.map((file) => readFile(join(dir, file), 'utf8')))).join('\n');
}

/* ---------- consumers ---------- */

async function verifyHtml(cwd) {
  const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'";
  const { origin, close } = await serve(cwd, (path) => (path === '/cdn.html' ? { 'content-security-policy': csp } : {}));

  await inBrowsers('html: CDN file under a strict CSP', `${origin}/cdn.html`, async (page) => {
    await page.waitForFunction(() => document.querySelector('#status')?.textContent === '9 moods');
    await page.waitForFunction(() => document.querySelector('#custom')?.shadowRoot?.querySelector('svg'));
    assertMascot(await inspect(page, '#cloud'), 'cloud');
    // An unknown shape falls back to the blob, so a CDN file that lost its shapes still renders.
    const cloud = await page.locator('#cloud').evaluate((element) => ({
      accessories: element.accessories.join(),
      blob: [...element.shadowRoot.querySelectorAll('path')].some((path) => path.getAttribute('d')?.startsWith('M120 68C146')),
    }));
    assertEqual(cloud.accessories, 'ears', 'accessory from the CDN file');
    assertEqual(cloud.blob, false, 'fell back to the blob');
    const custom = await inspect(page, '#custom');
    assertMascot(custom, 'registered shape');
    assertEqual(custom.role, 'img', 'role');
    assertEqual(custom.label, 'Assistant, idle', 'label');
    const usesKite = await page.locator('#custom').evaluate((element) =>
      [...element.shadowRoot.querySelectorAll('path')].some((path) => path.getAttribute('d')?.startsWith('M120 50L180 120')),
    );
    assertEqual(usesKite, true, 'registered path in the DOM');
  });

  await inBrowsers('html: per-module imports with an import map', `${origin}/modules.html`, async (page) => {
    const warnings = [];
    page.on('console', (message) => message.type() === 'warning' && warnings.push(message.text()));
    await page.waitForFunction(() => document.querySelector('#gem')?.shadowRoot?.querySelector('svg'));
    assertMascot(await inspect(page, '#gem'), 'gem');
    // Core ships one fallback body, so an unloaded shape still draws.
    assertMascot(await inspect(page, '#missing'), 'unloaded shape');
    assertEqual(await page.evaluate(async () => (await import('@comfycomputer/agent-mascots/core')).MASCOT_SHAPES.length), 16, 'exports');
  });

  await inBrowsers('html: :not(:defined) sizing avoids layout shift', `${origin}/defined.html`, async (page) => {
    await page.waitForFunction(() => globalThis.boxes);
    const [before, after] = await page.evaluate(() => globalThis.boxes);
    assertEqual(before, '96x96', 'box before upgrade');
    assertEqual(after, '96x96', 'box after upgrade');
  });
  close();
}

async function verifyNode(cwd) {
  await step('node: all entry points, require(), SSR', async () => {
    const { stdout } = await shell(cwd, 'node', 'check.mjs');
    return stdout.trim();
  });
}

async function verifyTypes(cwd) {
  await step('types: TypeScript 7, skipLibCheck off, no framework', () => bin(cwd, 'tsc', '-p', '.').then(() => ''));
  await step('types: TypeScript 5.9, skipLibCheck off, no framework', () =>
    shell(cwd, 'node', 'node_modules/typescript5/bin/tsc', '-p', '.').then(() => ''),
  );
}

async function verifyReact(cwd) {
  await step('react: tsc (TS 7, skipLibCheck off)', () => bin(cwd, 'tsc', '-p', '.').then(() => ''));
  await step('react: vite build', () => bin(cwd, 'vite', 'build').then(() => ''));

  const { origin, close } = await serve(join(cwd, 'dist'));
  await inBrowsers('react: props, attributes, events', origin, async (page) => {
    await page.waitForFunction(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('svg'));
    assertMascot(await inspect(page, '#mascot'), 'mascot');
    const facts = await page.locator('#mascot').evaluate((element) => ({
      bodyWidth: element.bodyWidth,
      bodyHeight: element.getAttribute('body-height'),
      accessories: element.getAttribute('accessories'),
      tracks: element.trackElement === document.querySelector('#target'),
    }));
    assertEqual(facts.bodyWidth, 1.2, 'bodyWidth property');
    assertEqual(facts.bodyHeight, '0.9', 'body-height attribute');
    assertEqual(facts.accessories, 'antenna ring', 'accessories list');
    assertEqual(facts.tracks, true, 'trackElement');

    await page.locator('#mascot').click();
    await page.waitForFunction(() => document.querySelector('#pokes')?.textContent === '1');

    const before = await page.locator('#mascot').evaluate((element) => {
      globalThis.svg = element.shadowRoot.querySelector('svg');
      return element.shadowRoot.querySelectorAll('*').length;
    });
    await page.locator('#work').click();
    await page.waitForFunction(() => document.querySelector('#mascot')?.getAttribute('mood') === 'working');
    const kept = await page.locator('#mascot').evaluate((element) => globalThis.svg === element.shadowRoot.querySelector('svg'));
    assertEqual(kept, true, `mood change kept the DOM (had ${before} nodes)`);
  });
  close();
}

async function verifyVue(cwd) {
  await step('vue: vue-tsc, templates and TSX', () => bin(cwd, 'vue-tsc', '-p', '.').then(() => ''));
  await step('vue: vite build', () => bin(cwd, 'vite', 'build').then(() => ''));

  await step('vue: tree-shaking keeps imported modules and drops the rest', async () => {
    const bundle = await bundledText(join(cwd, 'dist'));
    const prints = await shapeFingerprints(cwd);
    // Blob reuses core's fallback body, so it has no literal of its own.
    if (Object.keys(prints).length !== 15) throw new Error(`only found ${Object.keys(prints)}`);
    const included = Object.entries(prints).filter(([, print]) => bundle.includes(print)).map(([name]) => name);
    assertEqual(included.join(), 'orb', 'shapes in the bundle');
    return `bundled shapes: ${included.join(', ')}`;
  });

  const { origin, close } = await serve(join(cwd, 'dist'));
  await inBrowsers('vue: props, attributes, events', origin, async (page) => {
    await page.waitForFunction(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('svg'));
    assertMascot(await inspect(page, '#mascot'), 'mascot');
    const facts = await page.locator('#mascot').evaluate((element) => ({
      shape: element.shape,
      accessories: element.accessories.join(),
      bodyWidth: element.bodyWidth,
      tracks: element.trackElement === document.querySelector('#target'),
    }));
    assertEqual(facts.shape, 'orb', 'shape from its own entry point');
    assertEqual(facts.accessories, 'ears', 'accessory from its own entry point');
    assertEqual(facts.bodyWidth, 1.2, 'bodyWidth');
    assertEqual(facts.tracks, true, 'trackElement');

    await page.locator('#mascot').click();
    await page.waitForFunction(() => document.querySelector('#pokes')?.textContent === '1');
  });
  close();
}

async function verifySolid(cwd) {
  await step('solid: tsc (TS 7, skipLibCheck off), types only', () => bin(cwd, 'tsc', '-p', '.').then(() => ''));
}

async function verifySvelte(cwd) {
  await step('svelte: svelte-check, types only', async () => {
    const { stdout } = await bin(cwd, 'svelte-check', '--output', 'machine', '--tsconfig', './tsconfig.json').catch((error) => {
      if (error.code === 1) return error; // svelte-check exits 1 on the errors we expect
      throw error;
    });
    const errors = stdout.split('\n').filter((line) => / ERROR /.test(line));
    const invalid = errors.filter((line) => line.includes('Invalid.svelte'));
    const other = errors.filter((line) => !line.includes('Invalid.svelte'));
    if (other.length) throw new Error(other.join('\n'));
    assertEqual(new Set(invalid.map((line) => line.match(/ (\d+):\d+ /)?.[1])).size, 4, `lines flagged in Invalid.svelte\n${invalid.join('\n')}`);
  });
}

/* ---------- main ---------- */

const browsersNeeded = ['html', 'react', 'vue'].some(wants);
let tarball;
await step('pack', async () => {
  const packed = await pack();
  tarball = packed.path;
  return packed.summary;
});

if (tarball) {
  if (browsersNeeded) await launchEngines();
  const consumers = { html: verifyHtml, node: verifyNode, types: verifyTypes, react: verifyReact, vue: verifyVue, solid: verifySolid, svelte: verifySvelte };
  for (const [name, verify] of Object.entries(consumers)) {
    if (!wants(name)) continue;
    let cwd;
    await step(`${name}: install`, async () => {
      cwd = await install(name, tarball);
    });
    if (cwd) await verify(cwd);
  }
  await Promise.all(engines.map(({ browser }) => browser.close()));
}

const failed = results.filter(({ status }) => status === 'FAIL');
const skipped = results.filter(({ status }) => status === 'SKIP');
console.log(`\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
if (!failed.length && !keep) await rm(tmp, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
