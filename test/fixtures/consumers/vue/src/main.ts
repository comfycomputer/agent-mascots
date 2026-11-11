import { createApp } from 'vue';
import App from './App.vue';

// Only what the app uses, so the build also proves the rest of the package is dropped.
import '@comfycomputer/agent-mascots/core';
import '@comfycomputer/agent-mascots/shapes/orb';
import '@comfycomputer/agent-mascots/accessories/ears';

createApp(App).mount('#app');
