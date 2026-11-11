import { expect, test } from '@playwright/test';

const POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'";

test('works under a strict CSP', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text());
  });
  await page.route('**/csp.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': POLICY },
      body: `<!doctype html><title>csp</title>
        <agent-mascot id="m" material="frost" shape="cloud" accessories="ring ears leaf" size="200" sky="auto"></agent-mascot>
        <script type="module" src="/dist/index.js"></script>`,
    }),
  );
  await page.goto('/csp.html');
  await page.waitForFunction(() => customElements.get('agent-mascot'));
  const state = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    const el = document.querySelector('agent-mascot') as HTMLElementTagNameMap['agent-mascot'];
    const root = el.shadowRoot as ShadowRoot;
    const stop = root.querySelector('stop') as SVGStopElement;
    return {
      adopted: root.adoptedStyleSheets.length,
      stop: stop.style.getPropertyValue('stop-color').startsWith('var('),
      width: el.getBoundingClientRect().width,
    };
  });
  expect(state).toEqual({ adopted: 1, stop: true, width: 200 });
  expect(violations).toEqual([]);
});
