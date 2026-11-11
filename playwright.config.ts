import { defineConfig, devices } from '@playwright/test';

const PORT = 41873;

export default defineConfig({
  testDir: 'test/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `bun test/browser/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/test/browser/harness.html`,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
