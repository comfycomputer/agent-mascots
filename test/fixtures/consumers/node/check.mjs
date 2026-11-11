// Runs against the installed tarball. Every import goes through the package name, so the
// exports map is what's under test, and nothing here may touch a DOM global.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

for (const name of ['HTMLElement', 'window', 'document', 'customElements']) {
  assert(!(name in globalThis), `${name} should not exist in Node`);
}

const main = await import('agent-mascots');
assert.equal(typeof main.registerShape, 'function');
assert.equal(typeof main.AgentMascot, 'function');
assert.equal(main.MASCOT_SHAPES.length, 16);
assert.equal(main.MASCOT_ACCESSORIES.length, 24);

const entries = [
  'agent-mascots/core',
  'agent-mascots/cdn',
  'agent-mascots/jsx',
  ...main.MASCOT_SHAPES.map((name) => `agent-mascots/shapes/${name}`),
  ...main.MASCOT_ACCESSORIES.map((name) => `agent-mascots/accessories/${name}`),
];
for (const entry of entries) await import(entry);

const require = createRequire(import.meta.url);
assert.equal(typeof require('agent-mascots').registerShape, 'function');

const { default: manifest } = await import('agent-mascots/custom-elements.json', {
  with: { type: 'json' },
});
assert.equal(manifest.schemaVersion, '1.0.0');

await assert.rejects(import('agent-mascots/dist/element.js'), {
  code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
});

// The tag renders as an inert element on the server and upgrades on the client.
const html = renderToString(createElement('agent-mascot', { mood: 'working', 'body-width': 1.2 }));
assert.match(html, /<agent-mascot[^>]*mood="working"/);
assert.match(html, /body-width="1.2"/);

// The elements register themselves, but only in a browser.
assert.throws(() => main.registerShape('bad', { path: 'M0 0L', eyes: {} }), TypeError);

console.log(`node: imported ${entries.length + 1} entry points, SSR ok`);
