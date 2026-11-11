import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Uses this repo's build. Remove this, and add @comfycomputer/agent-mascots as a dependency, in your own project.
  resolve: { alias: { '@comfycomputer/agent-mascots': new URL('../../dist/index.js', import.meta.url).pathname } },
});
