<!--
  The playground: build a mascot and copy the code. Every control writes to one state, and
  everything else follows from it: the stage and its mirrors, the code and the share link.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Footer from '../../components/Footer.svelte';
  import Head from '../../components/Head.svelte';
  import Nav from '../../components/Nav.svelte';
  import Tabs from '../../components/Tabs.svelte';
  import { valuesOf } from '../../lib/attributes';
  import AccessoriesPanel from '../../playground/AccessoriesPanel.svelte';
  import BodyPanel from '../../playground/BodyPanel.svelte';
  import DownloadDialog from '../../playground/DownloadDialog.svelte';
  import MoodPicker from '../../playground/MoodPicker.svelte';
  import MotionPanel from '../../playground/MotionPanel.svelte';
  import Output from '../../playground/Output.svelte';
  import Readout from '../../playground/Readout.svelte';
  import Stage from '../../playground/Stage.svelte';
  import { Playground, providePlayground } from '../../playground/state.svelte';
  import { SCHEME_SCRIPT } from '../../playground/scheme';
  import TimelinePanel from '../../playground/TimelinePanel.svelte';

  const HASH_DELAY = 250;
  const RAIL = ['body', 'accessories', 'motion', 'timeline'].map((id) => ({ id, label: id }));
  const MOODS = valuesOf('mood');

  const playground = providePlayground(new Playground());

  let download: DownloadDialog;
  let loaded = $state(false);

  function writeHash(hash: string) {
    history.replaceState(null, '', hash === '#v=1' ? location.pathname + location.search : hash);
  }

  onMount(() => {
    playground.loadHash(location.hash);
    loaded = true;
  });

  // The URL follows the state, a moment after it settles.
  $effect(() => {
    const hash = playground.hash;
    if (!loaded) return;
    const timer = setTimeout(() => writeHash(hash), HASH_DELAY);
    return () => clearTimeout(timer);
  });

  // A hash that names an element is navigation, not state. The state's own hash goes back.
  function onhashchange() {
    if (document.getElementById(location.hash.slice(1))) writeHash(playground.hash);
    else playground.loadHash(location.hash);
  }

  /** Single keys act only on the work itself. */
  const inWorkArea = (target: Element) => target === document.body || Boolean(target.closest('.work, .rail'));

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as Element;
    if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
      if (target.matches('input[type="text"], input[type="number"]')) return;
      event.preventDefault();
      playground.stepBack();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (playground.drawing || !inWorkArea(target)) return;
    // Radios and buttons don't use these keys, and focus lands on one after every click.
    if (target.matches('input:not([type="radio"]), select, textarea')) return;
    if (event.key === 'r' || event.key === 'R') playground.shuffle();
    const mood = MOODS[Number(event.key) - 1];
    if (mood && !event.repeat) playground.set('mood', mood);
  }
</script>

<svelte:window {onkeydown} {onhashchange} />

<svelte:head>
  {@html SCHEME_SCRIPT}
</svelte:head>
<Head title="agent-mascots playground" description="Build a mascot and copy the code." path="playground" />
<Nav page="playground" skipLabel="Skip to playground" />
<main id="main" class="bench" tabindex="-1">
  <h1 class="visually-hidden">playground</h1>
  <div class="work">
    <Stage ondownload={() => download.open()} />
    <Readout />
    <MoodPicker />
  </div>

  <div class="rail" role="group" aria-label="Options">
    <Tabs items={RAIL} label="Options" listClass="rail__tabs" tabId={(item) => `tab-${item.id}`} panelId={(item) => `p-${item.id}`}>
      {#snippet panel(item, attributes)}
        <div class={['rail__panel', item.id === 'body' && 'rail__panel--body']} {...attributes}>
          {#if item.id === 'body'}
            <BodyPanel />
          {:else if item.id === 'accessories'}
            <AccessoriesPanel />
          {:else if item.id === 'motion'}
            <MotionPanel />
          {:else}
            <TimelinePanel />
          {/if}
        </div>
      {/snippet}
    </Tabs>
  </div>

  <div class="side">
    <Output />
    <DownloadDialog bind:this={download} />
  </div>
  <noscript><p class="note bench__noscript">The playground needs JavaScript.</p></noscript>
</main>
<Footer />

<style>
  /* One ground, 1px lines, and every state is a hard cut. Only the stage and its mirrors carry a
     colour of their own. */
  .bench {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "work" "rail" "side";
    row-gap: var(--s-5);
    width: 100%;
    max-width: 1680px;
    margin-inline: auto;
    padding: var(--s-4) var(--gutter) var(--s-8);
    font-family: var(--f-mono);
    font-variation-settings: var(--v-mono);
    font-size: var(--t-label);
  }

  /* Every display rule in here would otherwise beat the `hidden` attribute. */
  .bench :global([hidden]) { display: none !important; }

  .work {
    grid-area: work;
    container: work / inline-size;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .rail {
    grid-area: rail;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .rail :global(.rail__tabs) { margin-bottom: var(--s-4); }

  /* 40px, like the code tabs, so the columns start on one line. */
  .rail :global(.rail__tabs [role="tab"]) { flex: none; height: 40px; }

  .rail__panel { display: flex; flex-direction: column; min-width: 0; }
  .rail__panel[hidden] { display: none; }

  .side {
    grid-area: side;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Sidebar headings: small capitals in the text colour. The first in a column has no space over it. */
  :where(.bench) :global(.head) {
    margin: var(--s-5) 0 var(--s-2);
    color: var(--text);
    font-size: var(--t-small);
    font-weight: 600;
    letter-spacing: 0.08em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .rail__panel > :global(.head:first-child) { margin-top: 0; }

  :where(.bench) :global(.note) {
    max-width: 62ch;
    margin-top: var(--s-3);
    color: var(--muted);
    font-family: var(--f-text);
    font-variation-settings: var(--v-text);
    font-size: 14px;
    line-height: 1.5;
  }

  :where(.bench) :global(.note code) { color: var(--text); font-size: var(--t-label); }
  .bench__noscript { grid-column: 1 / -1; }

  /* Phone: the work column's children join the page grid, so the stage stays stuck through the rail and the code. */
  @media (max-width: 759px) {
    .bench { grid-template-areas: none; row-gap: 0; }
    .bench > * { grid-area: auto; }
    .work { display: contents; }
    .rail, .side { margin-top: var(--s-5); }
  }

  /* Tablet: the rail moves under the stage, and the code holds the right column. */
  @media (min-width: 760px) {
    .bench {
      grid-template-columns: minmax(0, 1fr) 360px;
      grid-template-areas: "work side" "rail side";
      column-gap: var(--s-6);
    }

    .side { align-self: start; }
  }

  /* Tablet: the body's shapes span the rail, with the material and the colours side by side under them. */
  @media (min-width: 760px) and (max-width: 1099px) {
    .rail__panel--body:not([hidden]) {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: var(--s-6);
      align-content: start;
    }

    .rail__panel--body > :global(:is(.head:first-child, .shapes, .pick--draw)) { grid-column: 1 / -1; }
    .rail__panel--body > :global(.head:nth-of-type(2)) { grid-area: 4 / 1; }
    .rail__panel--body > :global(.materials) { grid-area: 5 / 1; align-self: start; }
    .rail__panel--body > :global(.head:nth-of-type(3)) { grid-area: 4 / 2; }
    .rail__panel--body > :global(.colours) { grid-area: 5 / 2; }
  }

  /* Tablet: the code keeps its place, and scrolls on its own. */
  @media (min-width: 760px) and (max-width: 1099px) {
    .side {
      position: sticky;
      top: var(--s-4);
      max-height: calc(100svh - var(--s-6));
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
  }

  /* Desktop: an app. Three columns that fill the window under the nav. The options and the code
     scroll on their own, and the stage takes whatever height the middle has. */
  @media (min-width: 1100px) {
    .bench {
      grid-template-columns: 300px minmax(0, 1fr) clamp(340px, 28vw, 420px);
      grid-template-rows: minmax(0, 1fr);
      grid-template-areas: "rail work side";
      row-gap: 0;
      height: calc(100svh - var(--nav-height));
      min-height: 600px;
      padding-block: 0;
    }

    .rail, .work, .side {
      min-height: 0;
      padding-block: var(--s-4) var(--s-6);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }

    /* The side fills its row, so it scrolls instead of running off the window. */
    .side { align-self: stretch; }

    /* Room for the scrollbar, off the controls' edge. */
    .rail, .side { padding-inline-end: var(--s-3); }

    /* In a column that scrolls, nothing gives up its height: only the stage grows and shrinks. */
    :is(.rail, .rail__panel, .work) > :global(:not(.stage)) { flex-shrink: 0; }
  }
</style>
