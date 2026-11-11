<!--
  A colour: a native picker, plus a text field that also takes `var()`. With `auto`, a button
  clears it, back to whatever the mascot works out.
-->
<script lang="ts">
  import { toHex } from '../lib/colour';

  interface Props {
    name: string;
    value: string | undefined;
    /** What the picker shows while there's no value. */
    fallback: string | null;
    /** The field's placeholder. */
    placeholder: string;
    auto?: boolean;
    /** Every change, as it happens. Null clears the value. */
    oninput: (value: string | null) => void;
    /** The end of a change. */
    onchange: () => void;
  }

  let { name, value, fallback, placeholder, auto = false, oninput, onchange }: Props = $props();

  const SHAREABLE = /^(?:#[0-9a-f]{3,8}|var\(--[\w-]+\))$/i;
  const BLOCKED = /[\\"']|url\(/i;
  const id = $props.id();

  const valid = (text: string) => !BLOCKED.test(text) && CSS.supports('color', text);

  /** What is being typed, which is left alone until the field lets go. */
  let draft = $state<string | null>(null);
  let field: HTMLInputElement;

  const invalid = $derived(draft !== null && draft.trim() !== '' && !valid(draft.trim()));
  // The canvas that works a colour out only exists in a browser.
  const swatch = $derived(typeof document === 'undefined' ? '#000000' : toHex(value ?? fallback ?? '#000000'));

  function typed(text: string) {
    draft = text;
    const trimmed = text.trim();
    if (!trimmed || valid(trimmed)) oninput(trimmed || null);
  }

  function backToAuto() {
    draft = null;
    oninput(null);
    onchange();
    field.focus();
  }
</script>

<div class="colour">
  <input
    class="swatch"
    type="color"
    value={swatch}
    aria-label="{name} picker"
    oninput={(event) => oninput(event.currentTarget.value)}
    onchange={() => onchange()}
  />
  <input
    class="colour__text"
    type="text"
    spellcheck="false"
    autocomplete="off"
    {placeholder}
    value={draft ?? value ?? ''}
    aria-label="{name} value"
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby="{id}-error"
    bind:this={field}
    oninput={(event) => typed(event.currentTarget.value)}
    onchange={() => onchange()}
    onblur={() => (draft = null)}
  />
  {#if auto}
    <button class="act act--quiet colour__auto" type="button" aria-label="{name}: back to auto" disabled={value === undefined} onclick={backToAuto}>auto</button>
  {/if}
  <span class="hint hint--error" id="{id}-error" hidden={!invalid}>Not a CSS colour. The last good one stays.</span>
  <span class="hint" hidden={!value || SHAREABLE.test(value)}>stays out of share links</span>
</div>

<style>
  .colour {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-1) var(--s-2);
    min-width: 0;
  }

  .colour__text { flex: 1 1 8ch; min-width: 0; }

  .colour__auto { flex: none; }
  .colour__auto:disabled { opacity: 0.45; }

  /* An auto colour is hatched, so it reads as worked out rather than blank. */
  .colour:has(.colour__text[placeholder="auto"]:placeholder-shown) .swatch::-webkit-color-swatch {
    background: var(--surface) repeating-linear-gradient(135deg, transparent 0 3px, var(--line-strong) 3px 4px) !important;
  }

  .colour:has(.colour__text[placeholder="auto"]:placeholder-shown) .swatch::-moz-color-swatch {
    background: var(--surface) repeating-linear-gradient(135deg, transparent 0 3px, var(--line-strong) 3px 4px) !important;
  }

  .hint { flex-basis: 100%; color: var(--muted); font-size: var(--t-small); }
  .hint--error { color: var(--accent); }
  .hint[hidden] { display: none; }

  @media (pointer: coarse) {
    .colour__text { height: 40px; }
  }
</style>
