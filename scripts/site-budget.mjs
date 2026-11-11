// Checks the built site against its size budgets. Exits non-zero over any limit.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { SITE_BASE } from '../site/config.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.SITE_OUT_DIR ? resolve(process.env.SITE_OUT_DIR) : join(root, 'site/dist');
/** SvelteKit's working files, as site/vite.config.ts places them. Its build manifest names each chunk. */
const kit = process.env.SITE_OUT_DIR ? `${out}.kit` : join(root, 'site/.svelte-kit');

const KB = 1000;
const LIMITS = { js: 100 * KB, cssPerPage: 10 * KB, fonts: 102 * KB };

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const files = [];
for await (const file of walk(out)) files.push(file);
const named = (ext) => files.filter((file) => extname(file) === ext);
const gzipped = async (file) => gzipSync(await readFile(file), { level: 9 }).length;

const failures = [];
const report = (label, value, limit) => {
  console.warn(`${value <= limit ? 'ok  ' : 'OVER'} ${label}: ${value} B of ${limit} B`);
  if (value > limit) failures.push(label);
};

// Chunks are named by hash alone; the manifest knows which one the library's group became.
const manifest = JSON.parse(await readFile(join(kit, 'output/client/.vite/manifest.json'), 'utf8'));
const library = Object.values(manifest).filter((chunk) => chunk.name === 'agent-mascots').map((chunk) => join(out, chunk.file));
if (library.length !== 1) throw new Error(`Expected one library chunk, found ${library.length}`);

let js = 0;
for (const file of named('.js')) if (file !== library[0]) js += await gzipped(file);
report('non-library JS, gzip, all pages and lazy chunks', js, LIMITS.js);

for (const page of named('.html')) {
  const html = await readFile(page, 'utf8');
  let css = 0;
  for (const [link] of html.matchAll(/<link\b[^>]*>/g)) {
    // Addresses start with the site's path on GitHub Pages; the build's files don't.
    const href = new RegExp(`\\bhref="${SITE_BASE}/([^"]+)"`).exec(link)?.[1];
    if (href && /\brel="stylesheet"/.test(link)) css += await gzipped(join(out, href));
  }
  report(`CSS, gzip, ${relative(out, page)}`, css, LIMITS.cssPerPage);
}

let fonts = 0;
for (const file of named('.woff2')) fonts += (await readFile(file)).length;
report('fonts, on disk', fonts, LIMITS.fonts);

if (failures.length) {
  console.error(`Over budget: ${failures.join(', ')}`);
  process.exitCode = 1;
}
