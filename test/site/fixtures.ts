// The site tests' `test`: Playwright's, with two changes to every page.
//
// - GitHub is answered for. The landing page asks GitHub for the repository's star count once it's
//   idle, so every page gets a fixed answer here, and no test reaches the network or depends on the
//   count. A test can route the same URL to answer otherwise.
// - `page.goto` puts a path that starts with `/` under SITE_BASE, where the site lives, as on
//   GitHub Pages. Then it waits for hydration: SvelteKit hydrates after the load event, so on a
//   slow machine a test could otherwise act on the prerendered page before its script takes over.
import { test as base } from '@playwright/test';
import { GITHUB_REPO, SITE_BASE } from '../../site/config.ts';

export const STARS_API = `https://api.github.com/repos/${GITHUB_REPO}`;

export const test = base.extend<{ github: void }>({
  github: [
    async ({ page }, use) => {
      await page.route(STARS_API, (route) => route.fulfill({ json: { stargazers_count: 0 }, headers: { 'access-control-allow-origin': '*' } }));
      await use();
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url.startsWith('/') ? `${SITE_BASE}${url}` : url, options);
      // Set by site/src/routes/+layout.svelte once the page has hydrated.
      if (!url.startsWith('about:')) await page.waitForFunction(() => 'hydrated' in document.documentElement.dataset);
      return response;
    };
    await use(page);
  },
});

export { expect } from '@playwright/test';
