<!-- How to use it, a snippet per framework, each with a copy button that copies exactly what it shows. -->
<script lang="ts">
  import { resolve } from '$app/paths';
  import Icon from '../components/Icon.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { DOCS_URL, scriptSrc } from '../../config';
  import type { IconName } from '../lib/icons';
  import type { Look } from './look';
  import SnippetCopy from './SnippetCopy.svelte';
  import html from './snippets/html.txt?raw';
  import react from './snippets/react.txt?raw';
  import solid from './snippets/solid.txt?raw';
  import svelte from './snippets/svelte.txt?raw';
  import vue from './snippets/vue.txt?raw';

  /** The hero's face, for the copy buttons' mascots. */
  let { face }: { face: Look } = $props();

  /** Until the package is published, the plain HTML sample loads it from an install, not the CDN. */
  const SCRIPT_SRC = scriptSrc();

  const SNIPPETS = [
    { id: 'html', label: 'html', name: 'HTML', code: html },
    { id: 'react', label: 'react', name: 'React', code: react },
    { id: 'vue', label: 'vue', name: 'Vue', code: vue },
    { id: 'svelte', label: 'svelte', name: 'Svelte', code: svelte },
    { id: 'solid', label: 'solid', name: 'Solid', code: solid },
  ].map((snippet) => ({ ...snippet, id: snippet.id as IconName, code: snippet.code.trimEnd().replaceAll('%SCRIPT_SRC%', SCRIPT_SRC) }));
</script>

<section class="section usage" id="usage" aria-labelledby="usage-title">
  <div class="section__head">
    <h2 id="usage-title">Usage</h2>
    <p>Import the library, then customize and add the <code>&lt;agent-mascot /&gt;</code> web component to your app!</p>
    <p class="section__links"><a class="act" href={resolve('/playground')}>playground</a> <a class="act" href={DOCS_URL}>docs</a></p>
  </div>
  <div class="use__snippets">
    <Tabs items={SNIPPETS} label="Framework" tabId={(item) => `tab-${item.id}`} panelId={(item) => `use-${item.id}`}>
      {#snippet tab(item)}<Icon name={item.id} /><span>{item.label}</span>{/snippet}
      {#snippet panel(item, attributes)}
        <div class="use__panel" {...attributes}>
          <SnippetCopy text={item.code} {face} />
          <!-- Focusable, so the keyboard can scroll code wider than the panel. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre class="code-panel" tabindex="0" role="region" aria-label="{item.name} example"><code>{item.code}</code></pre>
        </div>
      {/snippet}
    </Tabs>
  </div>
</section>

<style>
  /* Sections: a heading column and a content column, across the whole page column. */
  .section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
    gap: var(--s-5) var(--s-8);
    align-items: start;
    max-width: var(--page);
    margin: var(--s-9) auto 0;
    scroll-margin-top: var(--s-5);
  }

  .section__head {
    min-width: 0;
  }

  .section__head h2 {
    font-size: var(--t-h2);
    line-height: 1.25;
    font-weight: 600;
  }

  .section__head > * + * {
    margin-top: var(--s-3);
  }

  .section__head p {
    color: var(--muted);
  }

  .section__links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
  }

  .section__head .section__links {
    margin-top: var(--s-5);
  }

  .use__snippets {
    min-width: 0;
  }

  .use__panel {
    position: relative;
    display: grid;
    min-width: 0;
  }

  .use__panel[hidden] {
    display: none;
  }

  .use__panel .code-panel {
    padding-right: 88px;
  }

  .use__snippets :global(.tabs__list) {
    margin-bottom: var(--s-3);
    overflow-x: auto;
  }

  /* The framework's mark beside its name, as in the playground. */
  .use__snippets :global([role="tab"]) { display: inline-flex; flex: none; align-items: center; gap: 6px; }
  .use__snippets :global([role="tab"] .icon) { display: block; flex: none; }

  .use__panel :global(.use__snippet-copy) {
    position: absolute;
    top: var(--s-2);
    right: var(--s-2);
  }

  @media (max-width: 900px) {
    .section {
      grid-template-columns: minmax(0, 1fr);
      margin-top: var(--s-8);
    }
  }

  @media (max-width: 640px) {
    .use__panel .code-panel {
      padding-top: calc(32px + 2 * var(--s-2));
      padding-right: var(--s-4);
    }
  }

  /* Below the fold: each piece rises in as it scrolls into view rather than on load, where nobody
     would see it. Scroll-driven, so it runs off the main thread, and only where the browser has
     view timelines; elsewhere it is simply there. Vertical only, so every edge the layout lines up
     stays put. */
  @media (prefers-reduced-motion: no-preference) {
    @supports (animation-timeline: view()) {
      #usage-title, .section__head > p, .use__snippets :global(.tabs__list), .use__panel {
        animation: enter-fade linear backwards !important;
        animation-timeline: view() !important;
        /* Measured against the view, not the element, so a short heading takes as long as the code:
           each is in place by the time it is a fifth of the way up the screen. */
        animation-range: cover 0% cover 20% !important;
      }

      .section__head > p:not(.section__links) { animation-range: cover 2% cover 22% !important; }
      .section__links { animation-range: cover 4% cover 24% !important; }
      .use__snippets :global(.tabs__list) { animation-range: cover 1% cover 21% !important; }
    }
  }
</style>
