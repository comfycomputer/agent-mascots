import { createApp } from 'vue';
import App from './App.vue';

// Only what the app uses, so the build also proves the rest of the package is dropped.
import 'agent-mascots/core';
import 'agent-mascots/shapes/orb';
import 'agent-mascots/accessories/ears';

createApp(App).mount('#app');
