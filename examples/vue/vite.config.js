import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Vue has to be told this tag is a custom element, not a Vue component.
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'agent-mascot' } } }),
  ],
  // Uses this repo's build. Remove this, and add agent-mascots as a dependency, in your own project.
  resolve: { alias: { 'agent-mascots': new URL('../../dist/index.js', import.meta.url).pathname } },
});
