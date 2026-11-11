import { mount } from 'svelte';
import '@comfycomputer/agent-mascots';
import './style.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });
