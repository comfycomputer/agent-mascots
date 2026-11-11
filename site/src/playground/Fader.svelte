<!-- A named fader: the name, and the value on its line, over the whole width. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Scrub from './Scrub.svelte';

  let props: ComponentProps<typeof Scrub> = $props();
</script>

<div class="mixer__item">
  <code class="t-label">{props.label}</code>
  <Scrub {...props} />
</div>

<style>
  .mixer__item { position: relative; min-width: 0; }
  code { display: block; min-height: 28px; color: var(--muted); line-height: 28px; }

  /* The value sits on the name's line, so the fader gets the whole width. */
  .mixer__item :global(.scrub) { display: block; }
  .mixer__item :global(.scrub input.scrub__value) { position: absolute; top: 0; right: 0; width: 6ch; height: 28px; }
</style>
