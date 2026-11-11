<!--
  A button that copies `text`. It shows what happened as `data-copy-state` ("copied" or "copy
  failed"), which an icon button's CSS reads, and in the label it is given. A mascot, passed as
  `mascot`, acts it out: working, then success, or error where the browser refuses.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { SHOWN_MS, WORKING_MS, copyText, type CopyResult } from '../lib/copy.svelte';

  type Mood = 'working' | 'success' | 'error' | undefined;

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    /** What to copy, read at the moment of the click. */
    text: string | (() => string);
    /** The button's content. `state` is what just happened, for a moment, or undefined. */
    children: Snippet<[state: CopyResult | undefined]>;
    /** Called with the mood a mascot should show, and undefined when it should go back to its own. */
    onmood?: (mood: Mood) => void;
  }

  let { text, children, onmood, ...rest }: Props = $props();

  let state = $state<CopyResult>();
  let shown: ReturnType<typeof setTimeout> | undefined;
  let acting: ReturnType<typeof setTimeout> | undefined;

  function act(mood: Mood, then?: () => void, ms = 0) {
    clearTimeout(acting);
    onmood?.(mood);
    if (then) acting = setTimeout(then, ms);
  }

  async function copy() {
    act('working');
    const result = await copyText(typeof text === 'function' ? text() : text);
    clearTimeout(shown);
    state = result;
    shown = setTimeout(() => (state = undefined), SHOWN_MS);
    if (result === 'copied') act('working', () => act('success', () => act(undefined), SHOWN_MS), WORKING_MS);
    else act('error', () => act(undefined), SHOWN_MS);
  }

  $effect(() => () => {
    clearTimeout(shown);
    clearTimeout(acting);
  });
</script>

<button type="button" {...rest} data-copy-state={state} onclick={copy}>
  {@render children(state)}
</button>
