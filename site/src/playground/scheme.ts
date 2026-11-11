/** Where the playground keeps the visitor's colour scheme. */
export const SCHEME_KEY = 'agent-mascots:scheme';

/** For the playground's head: applies a kept dark choice before the first paint, so the page never flashes. */
export const SCHEME_SCRIPT = `<script>try { if (localStorage.getItem('${SCHEME_KEY}') === 'dark') document.documentElement.dataset.scheme = 'dark'; } catch {}</script>`;
