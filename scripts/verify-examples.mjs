// Builds every framework example and runs it in a real browser against the local build: the mascot upgrades,
// its mood follows the buttons, a poke reaches the app, and the page logs no errors.
//
//   bun run test:examples react vue
//
// EXAMPLES_PORT sets the first port. Run `bun run build` first.
// oxlint-disable no-console -- this script's output is its report
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const ALL = ['html', 'react', 'vue', 'svelte', 'solid'];
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : ALL;
const firstPort = Number(process.env.EXAMPLES_PORT ?? 4900);

async function waitForServer(url) {
  for (let tries = 0; tries < 120; tries += 1) {
    // A short timeout on each try, so a server that accepts and then stalls can't hold the wait.
    if (await fetch(url, { signal: AbortSignal.timeout(2000) }).then((response) => response.ok, () => false)) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`no server at ${url}`);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };

/** Serves the repo's files, read-only, as the plain HTML example expects: `/dist/cdn.js` and so on. */
function serveFiles(port) {
  const server = createServer(async (request, response) => {
    let path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname));
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(root, path));
      response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((ready) => server.listen(port, '127.0.0.1', () => ready(server)));
}

async function check(browser, url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.goto(url);

  const mascot = page.locator('agent-mascot');
  await mascot.waitFor();
  await page.waitForFunction(() => document.querySelector('agent-mascot')?.shadowRoot?.childElementCount > 0);
  await page.getByRole('button', { name: 'working' }).click();
  await page.waitForFunction(() => document.querySelector('agent-mascot').mood === 'working');
  if ((await page.getByRole('button', { name: 'working' }).getAttribute('aria-pressed')) !== 'true') throw new Error('button not pressed');
  await mascot.click();
  await page.locator('output', { hasText: '1' }).waitFor({ timeout: 5000 });
  if (errors.length) throw new Error(`page logged: ${errors.join('; ')}`);
  await page.close();
}

const browser = await chromium.launch();
let failed = 0;
for (const [index, name] of names.entries()) {
  const port = firstPort + index;
  const html = name === 'html';
  const cwd = html ? root : join(root, 'examples', name);
  const url = `http://127.0.0.1:${port}/${html ? 'examples/html/' : ''}`;
  let server;
  let staticServer;
  try {
    if (!html) {
      await run('bun', ['--bun', 'vite', 'build', '--outDir', join(root, `.dist-example-${name}`), '--emptyOutDir'], { cwd });
    }
    // The plain HTML example needs only its page and dist/cdn.js, so it's served as plain files.
    // A Vite dev server at the repo root would scan every HTML file in the repo first, which on a
    // cold CI runner can outlast the wait.
    if (html) staticServer = await serveFiles(port);
    // A framework example serves the build it just made: a cold dev server pre-bundles the
    // framework first, which can outlast the wait on a CI runner.
    else server = spawn('bun', ['--bun', 'vite', 'preview', '--outDir', join(root, `.dist-example-${name}`), '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd, stdio: 'ignore', detached: true });
    await waitForServer(url);
    await check(browser, url);
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    staticServer?.close();
    if (server) {
      try {
        process.kill(-server.pid);
      } catch {
        console.warn(`The ${name} server had already stopped.`);
      }
    }
  }
}
await browser.close();
if (failed) process.exit(1);
