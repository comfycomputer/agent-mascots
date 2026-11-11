<!-- Around every page: the design system's global CSS, and the body font, which every page uses. -->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import recursive from '../../fonts/recursive.woff2?url';
  import '../styles/site.css';

  let { children }: { children: Snippet } = $props();

  // SvelteKit hydrates after the load event, so the site tests wait for this before they act. The
  // layout mounts after the page inside it, so by now the page's own onMount has run too.
  onMount(() => {
    document.documentElement.dataset.hydrated = '';
  });
</script>

<svelte:head>
  <link rel="preload" href={recursive} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{@render children()}
