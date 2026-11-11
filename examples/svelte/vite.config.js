import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  // Uses this repo's build. Remove this, and add @comfycomputer/agent-mascots as a dependency, in your own project.
  resolve: { alias: { '@comfycomputer/agent-mascots': new URL('../../dist/index.js', import.meta.url).pathname } },
});
