import { mount } from 'svelte';
import 'agent-mascots';
import './style.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });
