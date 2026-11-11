<!-- The code, for each framework, live. Copy takes whichever shows. -->
<script lang="ts">
  import CopyButton from '../components/CopyButton.svelte';
  import Icon from '../components/Icon.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { FRAMEWORKS, generate, type Framework } from './code';
  import { usePlayground } from './state.svelte';

  const playground = usePlayground();

  const ITEMS = FRAMEWORKS.map((id, index) => ({ id, label: id, index }));

  let selected = $state<string>(FRAMEWORKS[0]);

  const code = $derived(Object.fromEntries(FRAMEWORKS.map((framework) => [framework, generate(framework, playground.attributes, playground.drawnOptions)])) as Record<Framework, string>);
</script>

<section class="output" aria-label="Code">
  <Tabs
    items={ITEMS}
    bind:selected
    label="Code for"
    listId="out-tabs"
    headClass="output__head"
    panelsId="out-panels"
    tabId={(item) => `out-tab-${item.index}`}
    panelId={(item) => `out-${item.index}`}
  >
    {#snippet tab(item)}<Icon name={item.id} /><span>{item.label}</span>{/snippet}
    {#snippet panelsStart()}
      <CopyButton class="act output__copy" id="copy-code" aria-label="Copy code" title="copy" text={() => code[selected as Framework]}>
        <Icon name="clipboard" class="icon--copy" /><Icon name="clipboardCheck" class="icon--copied" />
      </CopyButton>
    {/snippet}
    {#snippet panel(item, attributes)}
      <!-- A tab panel, from `attributes`, and focusable so the keyboard can scroll it. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <pre class="code-panel" tabindex="0" {...attributes} aria-labelledby={undefined} aria-label="{item.label} code">{code[item.id]}</pre>
    {/snippet}
  </Tabs>
</section>

<style>
  .output :global(.output__head) {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    border-bottom: 1px solid var(--line);
  }

  /* The code tabs keep to one line. When they overflow they scroll sideways, and the right edge fades to say so. */
  .output :global(#out-tabs) {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 40px;
    gap: 2px;
    padding-right: var(--s-2);
    overflow-x: auto;
    border-bottom: 0;
    scrollbar-width: none;
    mask-image: linear-gradient(to right, #000 calc(100% - var(--s-2)), transparent);
  }

  /* The framework's mark beside its name, at 40px: the height of the rail's tabs, so the columns start on one line. */
  .output :global(#out-tabs [role="tab"]) { display: inline-flex; flex: none; align-items: center; gap: 6px; height: 40px; padding: 0 6px; }
  .output :global(#out-tabs .icon) { display: block; flex: none; }

  /* Hold the shortest code's height, two lines. flow-root, so the code's top margin counts towards it. */
  .output :global(#out-panels) {
    position: relative;
    display: flow-root;
    min-height: calc(var(--s-3) + 2 * var(--s-4) + 2 * 1.55 * var(--t-code));
  }

  pre {
    max-height: 48svh;
    margin-top: var(--s-3);
    /* Room for the copy button, so the longest first line runs under it only when scrolled. */
    padding-right: calc(var(--s-4) + 40px);
    overflow: auto;
    white-space: pre;
  }

  pre[hidden] { display: none; }

  /* Copy sits in the code's top-right corner, over whichever tab shows. A clipboard, which becomes a
     tick for a moment once it has copied. */
  .output :global(.output__copy) {
    position: absolute;
    top: calc(var(--s-3) + var(--s-2));
    right: var(--s-2);
    z-index: 1;
    width: 32px;
    padding: 0;
    background: var(--bg);
  }

  .output :global(.output__copy .icon--copied),
  .output :global(.output__copy[data-copy-state="copied"] .icon--copy) { display: none; }
  .output :global(.output__copy[data-copy-state="copied"] .icon--copied) { display: block; }
</style>
