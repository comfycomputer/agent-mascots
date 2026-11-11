// Builds every framework example and runs it in a real browser against the local build: the mascot upgrades,
// its mood follows the buttons, a poke reaches the app, and the page logs no errors.
//
//   bun run test:examples react vue
//
// EXAMPLES_PORT sets the first port. Run `bun run build` first.
// oxlint-disable no-console -- this script's output is its report
import { execFile, spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const ALL = ['html', 'react', 'vue', 'svelte', 'solid'];
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : ALL;
const firstPort = Number(process.env.EXAMPLES_PORT ?? 41900);

async function waitForServer(url) {
  for (let tries = 0; tries < 120; tries += 1) {
    if (await fetch(url).then((response) => response.ok, () => false)) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`no server at ${url}`);
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
  try {
    if (!html) {
      await run('bun', ['--bun', 'vite', 'build', '--outDir', join(root, `.dist-example-${name}`), '--emptyOutDir'], { cwd });
    }
    // A framework example serves the build it just made: a cold dev server pre-bundles the
    // framework first, which can outlast the wait on a CI runner.
    const serve = html ? [] : ['preview', '--outDir', join(root, `.dist-example-${name}`)];
    server = spawn('bun', ['--bun', 'vite', ...serve, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd, stdio: 'ignore', detached: true });
    await waitForServer(url);
    await check(browser, url);
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
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
