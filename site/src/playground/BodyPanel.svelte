<!-- The rail's first tab: the shape, drawn or picked, the material and the colours. -->
<script lang="ts">
  import RadioGroup from '../components/RadioGroup.svelte';
  import { ATTRIBUTES, valuesOf } from '../lib/attributes';
  import ColourField from './ColourField.svelte';
  import Face from './Face.svelte';
  import { usePlayground } from './state.svelte';

  const playground = usePlayground();

  const SHAPES = valuesOf('shape').map((value) => ({ value }));
  const MATERIALS = valuesOf('material').map((value) => ({ value }));
  /** The eye colour follows the body until it's set, and `auto` hands it back. */
  const COLOURS = [
    { name: 'color', label: 'color', auto: false },
    { name: 'accent', label: 'accent', auto: false },
    { name: 'eye-color', label: 'eye', auto: true },
  ];

  const defaultHex = (name: string) => String(ATTRIBUTES.get(name)?.default ?? '').match(/#[0-9a-f]{6}/i)?.[0] ?? null;

  const tint = $derived({ color: playground.read('color'), accent: playground.read('accent'), 'eye-color': playground.read('eye-color') });

  /** The colour the stage's eyes paint in, which the library works out while it's auto. */
  let eyes = $state<string | null>(null);
  $effect(() => {
    void playground.attributes;
    const stage = playground.stage;
    if (!stage) return;
    // A frame later, and once more after that for the first: the library has drawn by then.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const stop = stage.shadowRoot?.querySelector('[part="eyes"] stop');
        eyes = stop ? getComputedStyle(stop).stopColor : null;
      });
    });
    return () => cancelAnimationFrame(frame);
  });

  function pickShape(shape: string) {
    if (playground.read('accessories') === 'none') playground.write('accessories', null);
    playground.set('shape', shape);
  }
</script>

<h2 class="head">shape</h2>
<RadioGroup class="shapes" id="shapes" aria-label="Shape" name="shape" options={SHAPES} value={playground.shape} onchange={pickShape}>
  {#snippet option({ value })}
    <Face class="pick__mascot" shape={value} {...tint} /><span>{value}</span>
  {/snippet}
</RadioGroup>
<button class="act pick--draw" type="button" id="draw-open" aria-pressed={playground.drawn} onclick={() => (playground.drawing = true)}>draw a shape</button>
<h2 class="head">material</h2>
<RadioGroup
  class="segmented materials"
  id="materials"
  aria-label="Material"
  name="material"
  options={MATERIALS}
  value={playground.read('material') ?? 'glow'}
  onchange={(material) => playground.set('material', material)}
/>
<h2 class="head">colour</h2>
<div class="colours" id="colours">
  {#each COLOURS as { name, label, auto } (name)}
    <div class="colours__row">
      <code class="t-label">{label}</code>
      <ColourField
        {name}
        {auto}
        value={playground.read(name)}
        placeholder={defaultHex(name) ?? 'auto'}
        fallback={defaultHex(name) ?? (auto ? eyes : null)}
        oninput={(value) => playground.write(name, value)}
        onchange={() => playground.commit()}
      />
    </div>
  {/each}
</div>

<style>
  :global(.shapes) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--s-1);
    /* Sixteen shapes, four to a row. */
    min-height: calc(4 * 56px + 3 * var(--s-1));
  }

  :global(.shapes .pick) {
    flex-direction: column;
    height: 56px;
    padding: 0;
    color: var(--muted);
    font-size: var(--t-small);
  }

  :global(.shapes .pick:has(:checked)) { color: var(--text); }
  :global(.shapes .pick__mascot) { width: 28px; }

  .pick--draw { width: 100%; margin-top: var(--s-2); }

  :global(.materials) { display: flex; width: 100%; min-height: 32px; }
  :global(.materials > label) { flex: 1 1 0; justify-content: center; }

  .colours { display: grid; gap: var(--s-2); min-height: calc(3 * 32px + 2 * var(--s-2)); }

  .colours__row {
    display: grid;
    grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
    align-items: start;
    gap: var(--s-2) var(--s-3);
    min-width: 0;
  }

  .colours__row > code { font-size: var(--t-small); line-height: 32px; }

  @media (pointer: coarse) {
    .colours { min-height: calc(3 * 40px + 2 * var(--s-2)); }
  }

  @media (min-width: 760px) and (max-width: 1099px) {
    :global(.shapes) { grid-template-columns: repeat(8, minmax(0, 1fr)); min-height: calc(2 * 56px + var(--s-1)); }
  }
</style>
