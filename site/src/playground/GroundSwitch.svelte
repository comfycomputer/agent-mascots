<!-- The stage's ground: light, dark, or a colour of the visitor's own. -->
<script lang="ts">
  import RadioGroup from '../components/RadioGroup.svelte';
  import { GROUND, GROUNDS, usePlayground } from './state.svelte';

  const playground = usePlayground();

  const OPTIONS = GROUNDS.map((value) => ({ value }));
  const ground = $derived(playground.read(GROUND) ?? 'light');
  const custom = $derived(ground.startsWith('#'));
</script>

<RadioGroup
  class="segmented stage__grounds"
  id="grounds"
  aria-label="background"
  name="ground"
  options={OPTIONS}
  value={ground}
  onchange={(value) => playground.set(GROUND, value)}
>
  <label class="ground-custom">
    <input
      class="swatch"
      type="color"
      value={custom ? ground : '#c9d8e6'}
      aria-label="Custom background"
      data-on={custom ? '' : undefined}
      oninput={(event) => playground.write(GROUND, event.currentTarget.value)}
      onchange={() => playground.commit()}
    />
    <span>custom</span>
  </label>
</RadioGroup>

<style>
  /* The background switch sits in the stage's top corner, on a plate of the page's own ground, so it
     reads the same over any. */
  :global(.stage__grounds) {
    position: absolute;
    top: var(--s-3);
    left: var(--s-3);
    z-index: 1;
    max-width: calc(100% - 2 * var(--s-3));
    min-height: 32px;
    overflow-x: auto;
    scrollbar-width: none;
    background: var(--bg);
    color: var(--text);
    color-scheme: inherit;
  }

  /* Tighter segments on a phone. */
  @media (max-width: 759px) {
    :global(.stage__grounds > label) { padding: 0 6px; }
  }

  .ground-custom { cursor: pointer; }
  .ground-custom .swatch { width: 16px; height: 16px; border-radius: 3px; }

  .ground-custom:has([data-on]) {
    background: var(--surface);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--text);
  }

  .ground-custom .swatch:focus-visible { outline: 0; }

  @media (forced-colors: active) {
    .ground-custom:has([data-on]) { outline: 2px solid Highlight; outline-offset: -2px; }
  }
</style>
