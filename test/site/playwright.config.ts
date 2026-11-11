import { defineConfig, devices } from '@playwright/test';
import { SITE_BASE } from '../../site/config.ts';
import { BASE_PORT, DEV_URL, PREVIEW_URL } from './servers';

// Needs `bun run site:build` first. Set SITE_PORT and SITE_OUT_DIR to run beside another agent.
const ROOT = '../..';

// A cold CI runner can take over a minute to answer the first request: SvelteKit's dev server
// compiles the page on demand, after Vite has pre-bundled its dependencies.
const serve = (command: string, url: string, cwd = ROOT) => ({
  command,
  cwd,
  url: `${url}${SITE_BASE}/`,
  reuseExistingServer: false,
  timeout: process.env.CI ? 180_000 : 60_000,
});

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: process.env.SITE_TEST_OUTPUT ?? '../../test-results/site',
  fullyParallel: true,
  // A CI runner has two cores shared by everything, so the pages take longer to settle there.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: 'list',
  use: { baseURL: PREVIEW_URL },
  webServer: [
    // The build, as GitHub Pages serves it.
    serve(`bun test/site/serve.ts ${BASE_PORT}`, PREVIEW_URL),
    // SvelteKit's dev server, from the site's own directory.
    serve(`bun --bun vite dev --host 127.0.0.1 --port ${BASE_PORT + 1} --strictPort`, DEV_URL, `${ROOT}/site`),
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
