<!--
  The playground's light and dark switch. Light unless the visitor picks dark, and the choice is
  kept. An inline script in the page's head applies a kept choice before the first paint.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { local } from '../lib/storage';
  import { SCHEME_KEY } from './scheme';

  let dark = $state(false);

  onMount(() => {
    dark = document.documentElement.dataset.scheme === 'dark';
  });

  function toggle() {
    dark = !dark;
    local.set(SCHEME_KEY, dark ? 'dark' : 'light');
    document.documentElement.dataset.scheme = dark ? 'dark' : 'light';
  }
</script>

<button class="act act--quiet stage__scheme" type="button" id="scheme" aria-pressed={dark} onclick={toggle}>dark</button>

<style>
  .stage__scheme {
    position: absolute;
    right: var(--s-3);
    bottom: var(--s-3);
    z-index: 1;
  }

  /* On a plate of the page's own ground. As weighty as `.act--quiet`, which it overrides, and no
     more, so the shared pressed state still shows. */
  :global(.stage__scheme) {
    background: var(--bg);
    color: var(--text);
    color-scheme: inherit;
  }
</style>
