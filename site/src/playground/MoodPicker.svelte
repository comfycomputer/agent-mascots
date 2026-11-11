<!-- The states. Keys 1 to 9 pick one too. -->
<script lang="ts">
  import RadioGroup from '../components/RadioGroup.svelte';
  import { valuesOf } from '../lib/attributes';
  import { DRAWN_SHAPE } from '../lib/drawn-shape';
  import Face from './Face.svelte';
  import { usePlayground } from './state.svelte';

  const playground = usePlayground();

  const OPTIONS = valuesOf('mood').map((value) => ({ value }));

  /** The stage's look, as far as a small simple mascot draws it. It can't draw a drawn shape. */
  const look = $derived({
    shape: playground.read('shape') === DRAWN_SHAPE ? undefined : playground.read('shape'),
    'eye-shape': playground.read('eye-shape'),
    color: playground.read('color'),
    accent: playground.read('accent'),
    'eye-color': playground.read('eye-color'),
  });
</script>

<h2 class="head">state</h2>
<RadioGroup
  class="moods"
  id="moods"
  aria-label="State. Keys 1 to 9 pick one."
  name="mood"
  options={OPTIONS}
  value={playground.read('mood') ?? 'idle'}
  onchange={(mood) => playground.set('mood', mood)}
>
  {#snippet option({ value })}
    <Face class="pick__mascot" mood={value} {...look} /><span>{value}</span>
  {/snippet}
</RadioGroup>

<style>
  :global(.moods) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--s-1);
    min-height: calc(3 * 64px + 2 * var(--s-1));
  }

  :global(.moods .pick) {
    flex-direction: column;
    height: 64px;
    padding-inline: 2px;
    font-size: var(--t-small);
  }

  :global(.moods .pick__mascot) { width: 32px; }

  /* One row of nine once every tile fits its label. */
  @container work (min-width: 540px) {
    :global(.moods) { grid-template-columns: repeat(9, minmax(0, 1fr)); min-height: 64px; }
    :global(.moods .pick) { font-size: 11px; }
  }

  @media (max-width: 759px) {
    :global(.moods) { min-height: calc(3 * 56px + 2 * var(--s-1)); }
    :global(.moods .pick) { height: 56px; }
    :global(.moods .pick__mascot) { width: 28px; }
  }
</style>
