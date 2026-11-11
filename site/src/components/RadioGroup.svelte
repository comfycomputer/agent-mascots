<!--
  A set of real radio inputs, so arrow keys and screen readers work with no extra code. Each is a
  `.pick` label. WebKit doesn't count a radio reached by arrow key as :focus-visible, so the group
  marks itself `data-keys` while the keyboard is in use.
-->
<script lang="ts" generics="T extends { value: string; label?: string }">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onchange'> {
    name: string;
    options: readonly T[];
    /** The checked value. A value no option has checks none. */
    value: string | undefined;
    onchange: (value: string) => void;
    /** What goes beside each input. The value, by default. */
    option?: Snippet<[option: T]>;
    /** Anything after the options, inside the group. */
    children?: Snippet;
  }

  let { name, options, value, onchange, option, children, ...rest }: Props = $props();

  let keys = $state(false);
</script>

<div role="radiogroup" {...rest} data-keys={keys ? '' : undefined} onkeydown={() => (keys = true)} onpointerdown={() => (keys = false)}>
  {#each options as item (item.value)}
    <label class="pick">
      <input type="radio" {name} value={item.value} aria-label={item.label ?? item.value} checked={item.value === value} onchange={() => onchange(item.value)} />
      {#if option}{@render option(item)}{:else}<span>{item.value}</span>{/if}
    </label>
  {/each}
  {@render children?.()}
</div>
