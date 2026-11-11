// The site: SvelteKit, prerendered to plain files for GitHub Pages. Its config lives here too.
// Run Vite from this directory: SvelteKit resolves its own files from the working directory.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SITE_BASE } from './config.ts';

const here = dirname(fileURLToPath(import.meta.url));

const dist = resolve(here, '../dist');

/** A private output directory, so parallel builds don't empty each other's preview. Relative to the repo. */
const out = process.env.SITE_OUT_DIR ? resolve(here, '..', process.env.SITE_OUT_DIR) : resolve(here, 'dist');

/**
 * The site imports the built library, like any consumer: run `bun run build` first. These follow
 * the package's `exports` map, subpaths included. Longest first: the first match wins.
 */
export const alias = [
  { find: /^@comfycomputer\/agent-mascots\/(shapes|accessories)\/([\w-]+)$/, replacement: `${dist}/$1/$2.js` },
  { find: /^@comfycomputer\/agent-mascots\/(core|cdn|jsx)$/, replacement: `${dist}/$1.js` },
  { find: /^@comfycomputer\/agent-mascots$/, replacement: `${dist}/index.js` },
];

export default defineConfig({
  plugins: [
    sveltekit({
      // Runes everywhere, so no component can fall back to the legacy syntax.
      compilerOptions: { runes: true },
      // Every page is prerendered (src/routes/+layout.ts), so the output is plain files.
      adapter: adapter({ pages: out, assets: out }),
      // Kit's working files, beside the output when that's private too.
      outDir: process.env.SITE_OUT_DIR ? `${out}.kit` : resolve(here, '.svelte-kit'),
      // Under SITE_URL's path on GitHub Pages. The 404 is served at any depth, so assets are
      // addressed from that path, not from the page.
      paths: { base: SITE_BASE as '' | `/${string}`, relative: false },
      // The playground keeps its state in the hash, so links into it name no element. Any other must.
      prerender: {
        handleMissingId: (details) => {
          if (details.path !== `${SITE_BASE}/playground`) throw new Error(details.message);
        },
      },
    }),
  ],
  resolve: { alias },
  // The library is built outside this root.
  server: { fs: { allow: [resolve(here, '..')] } },
  build: {
    modulePreload: { polyfill: false },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Its own chunk, so scripts/site-budget.mjs can leave the library out of the JS budget.
            { name: 'agent-mascots', test: (id) => id.startsWith(`${dist}/`) },
            // The framework, shared by every page, so a visitor fetches it once.
            { name: 'svelte', test: /[\\/]node_modules[\\/](?:\.bun[\\/][^\\/]+[\\/]node_modules[\\/])?svelte[\\/]/ },
          ],
        },
      },
    },
  },
});
