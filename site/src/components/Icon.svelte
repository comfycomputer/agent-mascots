<!-- An inline SVG icon that takes the text colour. Decorative: name the button it sits in. -->
<script lang="ts">
  import { ICONS, type IconData, type IconName } from '../lib/icons';

  let { name, data, class: className = '' }: { name?: IconName; data?: IconData; class?: string } = $props();

  const icon = $derived(data ?? (name ? ICONS[name] : undefined));
</script>

{#if icon}
  <svg
    class={['icon', className]}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    fill={icon.filled ? 'currentColor' : 'none'}
    stroke={icon.filled ? undefined : 'currentColor'}
    stroke-width={icon.filled ? undefined : 2}
    stroke-linecap={icon.filled ? undefined : 'round'}
    stroke-linejoin={icon.filled ? undefined : 'round'}
  >
    {#each icon.parts as [tag, attributes], index (index)}
      <svelte:element this={tag} {...attributes} />
    {/each}
  </svg>
{/if}
