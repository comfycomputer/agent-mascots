<!-- A snippet's copy button: its mascot acts the copy out, and "copy" says what happened. -->
<script lang="ts">
  import CopyButton from '../components/CopyButton.svelte';
  import type { Look } from './look';

  let { text, face }: { text: string; face: Look } = $props();

  let acting = $state<string>();
</script>

<CopyButton class="act act--strong use__snippet-copy" aria-label="Copy this snippet" {text} onmood={(mood) => (acting = mood)}>
  {#snippet children(state)}
    <agent-mascot class="act__mascot" mood={acting ?? 'idle'} detail="simple" track="none" color="var(--on-text)" accent="var(--accent)" role="presentation" {...face}></agent-mascot>
    <span class="label" data-copy-label>{state ?? 'copy'}</span>
  {/snippet}
</CopyButton>

<style>
  .act__mascot {
    flex: none;
    width: 20px;
  }

  /* "copy" becomes "copied" for a moment. A fixed width with room for the longer word, so the button
     never changes size. A rare "copy failed" spills over its edges rather than moving anything. */
  .label {
    display: inline-block;
    width: 7ch;
    text-align: center;
    white-space: nowrap;
  }
</style>
