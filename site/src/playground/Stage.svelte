<!--
  The stage: the mascot, on a ground of the visitor's choice, with the edits in its corners. It
  carries every attribute in the playground's state. The guides and the draw canvas sit over it.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import { ATTRIBUTES } from '../lib/attributes';
  import { inkFor } from '../lib/colour';
  import DrawCanvas from './DrawCanvas.svelte';
  import GroundSwitch from './GroundSwitch.svelte';
  import Guides from './Guides.svelte';
  import SchemeToggle from './SchemeToggle.svelte';
  import { GROUND, usePlayground } from './state.svelte';

  let { ondownload }: { ondownload: () => void } = $props();

  const playground = usePlayground();

  let area = $state<HTMLElement>();
  let mascot = $state<HTMLElement & { poke(): void }>();
  let hovered = $state(false);
  let undo = $state<HTMLButtonElement>();
  let shuffle = $state<HTMLButtonElement>();

  const ground = $derived(playground.read(GROUND) ?? 'light');
  const custom = $derived(ground.startsWith('#'));

  /**
   * What the stage carries. Drawn outlines stay on the full renderer. Tilt is
   * left to the element, which sets it once the visitor allows it. The timeline plays over the mood.
   */
  const look = $derived.by(() => {
    const carried: Record<string, string | undefined> = {};
    for (const name of ATTRIBUTES.keys()) if (name !== 'gyro') carried[name] = playground.read(name);
    if (playground.drawn) carried.detail = 'full';
    if (playground.playing) carried.mood = playground.playing.mood;
    return carried;
  });

  $effect(() => {
    if (!playground.read('gyro')) mascot?.removeAttribute('gyro');
  });

  // A new shape or material says hello, once the page has settled: not for the one it opens with.
  let settled = false;
  onMount(() => {
    playground.stage = mascot ?? null;
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => (settled = true))));
    return () => cancelAnimationFrame(frame);
  });
  $effect(() => {
    void playground.read('shape');
    void playground.read('material');
    if (settled) untrack(() => mascot?.poke());
  });

  // A disabled button can't hold focus, and the keyboard's place would go with it.
  $effect(() => {
    if (playground.undoable === 0 && document.activeElement === undo) shuffle?.focus();
  });
</script>

<!-- Hover and focus show the guides; the stage itself does nothing with them. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="stage"
  id="area"
  data-stage-ground={custom ? 'custom' : ground}
  data-drawing={playground.drawing ? '' : undefined}
  style:--custom={custom ? ground : undefined}
  style:--custom-on={custom ? inkFor(ground) : undefined}
  bind:this={area}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
  onfocusin={() => (hovered = true)}
  onfocusout={() => (hovered = false)}
>
  <GroundSwitch />
  <div class="stage__actions" role="group" aria-label="Edits">
    <button
      class="act act--icon"
      type="button"
      id="undo"
      aria-label="undo"
      title="undo"
      aria-keyshortcuts="Meta+Z Control+Z"
      disabled={playground.undoable === 0}
      bind:this={undo}
      onclick={() => playground.stepBack()}
    >
      <Icon name="undo" />
    </button>
    <button class="act act--icon" type="button" id="reset" aria-label="reset" title="reset" onclick={() => playground.reset()}><Icon name="reset" /></button>
    <button class="act" type="button" id="shuffle" aria-keyshortcuts="r" bind:this={shuffle} onclick={() => playground.shuffle()}>
      <Icon name="shuffle" /><span>randomise</span>
    </button>
  </div>
  <SchemeToggle />
  <button class="act act--strong stage__download" type="button" id="download-open" aria-haspopup="dialog" aria-controls="download" onclick={ondownload}>
    <Icon name="download" /><span>download</span>
  </button>
  <!-- Focusable so Enter or Space can poke it, which the library does for any mascot with a tabindex. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <agent-mascot class="stage__mascot" id="mascot" tabindex="0" data-detail-priority="1" hidden={playground.drawing} {...look} bind:this={mascot}></agent-mascot>
  {#if area && mascot}
    <Guides {area} {mascot} shown={hovered} />
    <DrawCanvas {area} />
  {/if}
</div>

<style>
  /* Stage grounds. They hold fixed inks, so a mascot looks the same in either colour scheme. */
  .stage {
    --stage: var(--ink);
    --on-stage: var(--cream);
    position: relative;
    container-type: size;
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    max-height: 70svh;
    min-height: 220px;
    overflow: hidden;
    border-radius: var(--r-2);
    background: var(--stage);
    color: var(--on-stage);
    color-scheme: dark;
  }

  .stage[data-stage-ground="light"] { --stage: #fff; --on-stage: var(--ink); color-scheme: light; }
  .stage[data-stage-ground="custom"] { --stage: var(--custom); --on-stage: var(--custom-on); color-scheme: light; }

  /* A ground the same tone as the page needs an edge: white on a light page, ink on a dark one. */
  :global(:root:not([data-scheme="dark"])) .stage[data-stage-ground="light"],
  :global(:root[data-scheme="dark"]) .stage[data-stage-ground="dark"] { box-shadow: inset 0 0 0 1px var(--line-strong); }

  .stage[data-drawing] { cursor: crosshair; }

  /* The edits sit in the top-right corner, and the page's scheme switch in the bottom-right. */
  .stage__actions {
    position: absolute;
    top: var(--s-3);
    right: var(--s-3);
    z-index: 1;
    display: flex;
    gap: var(--s-1);
  }

  .stage__actions .act {
    background: var(--bg);
    color: var(--text);
    color-scheme: inherit;
  }

  .stage__actions .act:not(:disabled):hover { background: var(--surface); }

  /* Undo and reset are icons alone, named by their label and tooltip: square, at the buttons' height. */
  .stage__actions .act--icon { aspect-ratio: 1; padding: 0; }
  .stage__actions :global(.icon) { flex: none; }

  /* Download sits at the stage's foot, in the middle, clear of the scheme switch on either side. */
  .stage__download {
    position: absolute;
    bottom: var(--s-3);
    left: 50%;
    z-index: 1;
    width: min(240px, calc(100% - 2 * (var(--s-3) + 72px)));
    translate: -50% 0;
  }

  /* Too narrow for both on one line: the edits go under the background switch. */
  @container (max-width: 460px) {
    .stage__actions { top: calc(2 * var(--s-3) + 32px); right: auto; left: var(--s-3); }
  }

  .stage__mascot {
    width: min(420px, 78cqmin);
    max-width: 100%;
  }

  .stage__mascot[hidden] { display: none; }
  .stage__mascot:focus-visible { outline-offset: 8px; }

  /* Phone: the stage stays stuck through the rail and the code. Drawing needs it to hold still. */
  @media (max-width: 759px) {
    .stage {
      position: sticky;
      top: 0;
      z-index: 2;
      aspect-ratio: auto;
      height: 42svh;
      max-height: none;
    }

    .stage[data-drawing] { position: relative; }
  }

  /* Desktop: the stage takes whatever height the middle column has. */
  @media (min-width: 1100px) {
    .stage {
      flex: 1 1 auto;
      aspect-ratio: auto;
      min-height: 320px;
      max-height: none;
    }
  }
</style>
