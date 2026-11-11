<!--
  The accessories: a grid of toggles, one icon each. They start from whatever the shape and
  material use by default, so a shape's own show as on, and turning the last one off is
  `accessories="none"`.
-->
<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { valuesOf } from '../lib/attributes';
  import { ACCESSORY_ICONS } from '../lib/icons';
  import { usePlayground } from './state.svelte';

  const playground = usePlayground();

  const NAMES = valuesOf('accessories');

  /** What the stage wears, as the library works it out from its shape, material and list. */
  let worn = $state<readonly string[]>([]);
  $effect(() => {
    void playground.attributes;
    worn = (playground.stage as (HTMLElement & { accessories: string[] }) | null)?.accessories ?? [];
  });

  function toggle(name: string) {
    const active = new Set(worn);
    if (!active.delete(name)) active.add(name);
    playground.set('accessories', active.size ? [...active].join(' ') : 'none');
  }
</script>

<div class="accessories" id="accessories" role="group" aria-label="Accessories">
  {#each NAMES as name (name)}
    <button class="pick" type="button" aria-pressed={worn.includes(name)} onclick={() => toggle(name)}>
      <Icon data={ACCESSORY_ICONS[name]} /><span>{name}</span>
    </button>
  {/each}
</div>

<style>
  .accessories {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--s-1);
  }

  .pick {
    flex-direction: column;
    gap: var(--s-2);
    height: 64px;
    padding: 0 2px;
    color: var(--muted);
    font-size: var(--t-small);
  }

  .pick[aria-pressed="true"] { color: var(--text); }
  .pick > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick :global(.icon) { width: 28px; height: 28px; }

  @media (min-width: 760px) and (max-width: 1099px) {
    .accessories { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  }
</style>
