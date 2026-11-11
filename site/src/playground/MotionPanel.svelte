<!-- How the mascot moves: a fader for each channel. -->
<script lang="ts">
  import { attribute } from '../lib/attributes';
  import Fader from './Fader.svelte';
  import { usePlayground } from './state.svelte';

  const playground = usePlayground();

  const CHANNELS = ['motion', 'float', 'blink', 'glance', 'bounce', 'gaze'].map((name) => {
    const { min, max } = attribute(name, 'number');
    const span = max - min;
    return { name, min, max, step: span >= 100 ? 1 : span >= 10 ? 0.1 : 0.01 };
  });

  const rest = (name: string) => Number(playground.defaultOf(name) ?? 0);
</script>

<div class="mixer" id="mixer" role="group" aria-label="Motion">
  {#each CHANNELS as { name, min, max, step } (name)}
    <Fader
      label={name}
      {min}
      {max}
      {step}
      value={Number(playground.read(name) ?? rest(name))}
      rest={rest(name)}
      oninput={(value) => playground.write(name, value)}
      onchange={() => playground.commit()}
    />
  {/each}
</div>

<style>
  .mixer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-2) var(--s-4);
  }

  @media (max-width: 759px) {
    .mixer { grid-template-columns: minmax(0, 1fr); }
  }

  @media (min-width: 760px) and (max-width: 1099px) {
    .mixer { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
</style>
