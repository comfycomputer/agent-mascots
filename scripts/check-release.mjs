// Runs before `npm publish`. package.json can't read site/config.ts, so this holds them together.
// npm also resolves the README's relative images and links through `repository`: without it, the
// package page would show broken media, because docs/ isn't in the tarball.
//
//   bun scripts/check-release.mjs
// oxlint-disable no-console -- this script's output is its report
import { readFileSync } from 'node:fs';
import { GITHUB_URL, NPM_PUBLISHED, SITE_URL } from '../site/config.ts';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

const expected = {
  repository: `git+${GITHUB_URL}.git`,
  homepage: SITE_URL,
  bugs: `${GITHUB_URL}/issues`,
};
const actual = {
  repository: pkg.repository?.url,
  homepage: pkg.homepage,
  bugs: pkg.bugs?.url,
};

const problems = [];
if (GITHUB_URL.includes('OWNER')) problems.push('GITHUB_URL in site/config.ts is still the placeholder.');
if (SITE_URL.includes('OWNER')) problems.push('SITE_URL in site/config.ts is still the placeholder.');
for (const [field, value] of Object.entries(expected)) {
  if (actual[field] !== value) problems.push(`package.json ${field} should be ${value}, and is ${actual[field]}.`);
}

// The README ships in the tarball, so this would print on the npm page itself.
if (readme.includes('Not on npm yet')) problems.push('README.md still says "Not on npm yet".');
if (!readme.includes(SITE_URL)) problems.push('README.md has no link to the site, where the playground is.');

if (problems.length) {
  console.error(`Not ready to publish:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Ready to publish.');
// This one can only follow the publish: it says the package exists.
if (!NPM_PUBLISHED) console.log('After publishing, set NPM_PUBLISHED to true in site/config.ts and rebuild the site.');
