import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';

/**
 * Warnings have to be gone from a real production bundle, in a real browser. Reading warn.ts
 * can't show that: the mistake it guards against only appears once a bundler has run, because
 * bundlers replace `process.env.NODE_ENV` and leave every other mention of `process` alone.
 */
const BLANK = '/test/browser/blank.html';
const NAUGHTY = '<agent-mascot shape="nope" material="wood" sky="a, b, c" size="200"></agent-mascot>';
const dist = resolve('dist/index.js');
const ENTRY = "import '@comfycomputer/agent-mascots';\n";

type Bundle = (nodeEnv: string, dir: string) => Promise<string>;

const BUNDLERS: Record<string, Bundle> = {
  async vite(nodeEnv, dir) {
    const input = join(dir, 'entry.js');
    await writeFile(input, ENTRY);
    const result = await vite({
      configFile: false,
      root: dir,
      logLevel: 'silent',
      resolve: { alias: { '@comfycomputer/agent-mascots': dist } },
      define: { 'process.env.NODE_ENV': JSON.stringify(nodeEnv) },
      build: { write: false, rollupOptions: { input } },
    });
    const { output } = (Array.isArray(result) ? result[0] : result) as { output: { code?: string }[] };
    return output.map((file) => file.code ?? '').join('\n');
  },
  async esbuild(nodeEnv) {
    const result = await esbuild({
      stdin: { contents: ENTRY, resolveDir: process.cwd() },
      bundle: true,
      format: 'esm',
      minify: true,
      write: false,
      alias: { '@comfycomputer/agent-mascots': dist },
      define: { 'process.env.NODE_ENV': JSON.stringify(nodeEnv) },
      logLevel: 'silent',
    });
    return result.outputFiles[0]?.text ?? '';
  },
};

/** Run a bundle against bad attributes, and return what it logged. */
async function warningsFrom(page: Page, code: string): Promise<string[]> {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto(BLANK);
  await page.evaluate((html) => {
    document.body.innerHTML = html;
  }, NAUGHTY);
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('svg'));
  // The fallback rendered, so the invalid values really were read.
  expect(await page.locator('agent-mascot').evaluate((el: HTMLElementTagNameMap['agent-mascot']) => [el.shape, el.material])).toEqual(['blob', 'glow']);
  return warnings;
}

for (const [name, bundle] of Object.entries(BUNDLERS)) {
  test.describe(name, () => {
    let dir = '';
    test.beforeAll(async () => {
      dir = await mkdtemp(join(tmpdir(), 'agent-mascots-'));
    });
    test.afterAll(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    test('a production bundle does not warn', async ({ page }) => {
      expect(await warningsFrom(page, await bundle('production', dir))).toEqual([]);
    });

    // The control. Without it the test above would pass on a bundle that couldn't warn at all.
    test('the same bundle in development warns', async ({ page }) => {
      const warnings = await warningsFrom(page, await bundle('development', dir));
      expect(warnings.filter((text) => text.includes('agent-mascot:')).length).toBeGreaterThan(0);
    });
  });
}

test('the CDN file does not warn', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto(BLANK);
  await page.evaluate(async (html) => {
    document.body.innerHTML = html;
    await import('/dist/cdn.js' as string);
  }, NAUGHTY);
  await page.waitForFunction(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('svg'));
  expect(warnings).toEqual([]);
});

test('unbundled modules warn: nothing says that page is in production', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto(BLANK);
  await page.evaluate(async (html) => {
    document.body.innerHTML = html;
    await import('/dist/index.js' as string);
  }, NAUGHTY);
  await page.waitForFunction(() => document.querySelector('agent-mascot')?.shadowRoot?.querySelector('svg'));
  await expect.poll(() => warnings.filter((text) => text.includes('agent-mascot:')).length).toBeGreaterThan(0);
});
