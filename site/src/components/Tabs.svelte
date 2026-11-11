<!--
  Tabs from real buttons. Every panel is rendered; the unselected ones are `hidden`, so without
  JS only the first shows. Arrow keys, Home and End move between tabs.
-->
<script lang="ts" generics="T extends { id: string; label: string }">
  import type { Snippet } from 'svelte';

  interface Props {
    items: readonly T[];
    /** The selected item's id. */
    selected?: string;
    /** The tab list's accessible name. */
    label: string;
    /** Each item's tab and panel ids. */
    tabId: (item: T) => string;
    panelId: (item: T) => string;
    listId?: string;
    listClass?: string;
    /** A tab's content. Its label by default. */
    tab?: Snippet<[item: T]>;
    /** A panel. Spread `attributes` on its root: they wire it to its tab, and hide it when it isn't selected. */
    panel: Snippet<[item: T, attributes: PanelAttributes]>;
    /** Wraps the tab list in a `div` of this class, when given. */
    headClass?: string;
    /** Wraps the panels in a `div` with this id, when given, after `panelsStart`. */
    panelsId?: string;
    panelsStart?: Snippet;
  }

  interface PanelAttributes {
    id: string;
    role: 'tabpanel';
    'aria-labelledby': string;
    hidden: boolean;
  }

  let { items, selected = $bindable(items[0]?.id), label, tabId, panelId, listId, listClass, tab, panel, headClass, panelsId, panelsStart }: Props = $props();

  const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

  /** Inside a tab list that scrolls sideways, the selected tab stays in view. The page doesn't move. */
  function reveal(button: HTMLElement) {
    const list = button.parentElement!;
    const start = button.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    if (start < list.scrollLeft) list.scrollLeft = start;
    else if (start + button.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = Math.ceil(start + button.getBoundingClientRect().width - list.clientWidth);
  }

  function choose(index: number, button: HTMLElement, focus = false) {
    selected = items[index]!.id;
    reveal(button);
    if (focus) button.focus();
  }

  function onkeydown(event: KeyboardEvent & { currentTarget: HTMLElement }, index: number) {
    let next: number | undefined;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (STEP[event.key]) next = (index + STEP[event.key]! + items.length) % items.length;
    if (next === undefined) return;
    event.preventDefault();
    choose(next, event.currentTarget.parentElement!.children[next] as HTMLElement, true);
  }
</script>

{#snippet list()}
  <div class={['tabs__list', listClass]} id={listId} role="tablist" aria-label={label}>
    {#each items as item, index (item.id)}
      {@const on = item.id === selected}
      <button
        type="button"
        role="tab"
        id={tabId(item)}
        aria-selected={on}
        aria-controls={panelId(item)}
        tabindex={on ? 0 : -1}
        onclick={(event) => choose(index, event.currentTarget)}
        onkeydown={(event) => onkeydown(event, index)}
      >
        {#if tab}{@render tab(item)}{:else}{item.label}{/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet panels()}
  {#each items as item (item.id)}
    {@render panel(item, { id: panelId(item), role: 'tabpanel', 'aria-labelledby': tabId(item), hidden: item.id !== selected })}
  {/each}
{/snippet}

{#if headClass}
  <div class={headClass}>{@render list()}</div>
{:else}
  {@render list()}
{/if}
{#if panelsId}
  <div id={panelsId}>
    {@render panelsStart?.()}
    {@render panels()}
  </div>
{:else}
  {@render panels()}
{/if}
