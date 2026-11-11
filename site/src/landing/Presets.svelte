<!--
  The preset gallery: rows of cards under the hero. The named cards are pictures, written into the
  page at build; once they have gone by, the marquee brings random ones, drawn on the device. A card
  holds its preset until it goes round again.
-->
<script lang="ts">
  import { onIdle } from '../lib/idle';
  import { createGenerator, type GeneratedPreset } from './generate';
  import { marquee } from './marquee.svelte';
  import { PRESETS, type Preset } from './presets';

  interface Props {
    /** The name of the preset the hero wears, or '' for a look that isn't one. */
    pressed: string;
    onpick: (preset: Preset) => void;
  }

  let { pressed, onpick }: Props = $props();

  type Shown = Preset | GeneratedPreset;
  interface Card {
    id: number;
    preset: Shown;
  }

  /** Rows in the marquee. The named presets are dealt into them in order. */
  const ROWS = 3;
  const PER_ROW = Math.ceil(PRESETS.length / ROWS);

  const PICTURES = import.meta.glob<string>('./presets/*.webp', { eager: true, query: '?url', import: 'default' });
  const srcOf = (preset: Shown) => ('src' in preset ? preset.src : PICTURES[`./presets/${preset.name}.webp`]);

  let ids = 0;
  let rows = $state(Array.from({ length: ROWS }, (_, row) => PRESETS.slice(row * PER_ROW, (row + 1) * PER_ROW).map((preset): Card => ({ id: ids++, preset }))));
  /** Once the marquee runs: every picture is on its way round in a minute, so none waits to be lazy. */
  let running = $state(false);
  let paused = $state(false);

  const generator = typeof window === 'undefined' ? null : createGenerator();
  /** How many cards show a preset: a random one is on one card, unless a resize copied it. */
  const showing = (name: string) => rows.flat().filter((card) => card.preset.name === name).length;

  /** A card that has gone round gets a new preset, unless the hero wears its own. */
  function recycle(card: Card) {
    if (card.preset.name === pressed || !generator) return;
    const next = generator.take();
    if (!next) return;
    const old = card.preset;
    card.preset = next;
    if ('src' in old && !showing(old.name)) generator.release($state.snapshot(old) as GeneratedPreset);
  }

  function pick(preset: Shown) {
    onpick($state.snapshot(preset) as Preset);
  }

  $effect(() => {
    // Started once the page has settled, so the first pictures are ready before the named ones run out.
    if (!generator || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    return onIdle(() => generator.start(), 2000);
  });
</script>

<section class="section presets" id="presets" aria-label="Presets">
  <div
    class="presets__marquee"
    id="presets-marquee"
    data-running={running ? '' : undefined}
    {@attach marquee({
      count: (row) => rows[row]!.length,
      extend(row, extra) {
        const own = rows[row]!.slice();
        for (let i = 0; i < extra; i++) rows[row]!.push({ id: ids++, preset: own[i % own.length]!.preset });
      },
      wrap(row, leftward) {
        const cards = rows[row]!;
        const card = leftward ? cards.shift()! : cards.pop()!;
        if (leftward) cards.push(card);
        else cards.unshift(card);
        recycle(card);
      },
      paused: () => paused,
      started: () => (running = true),
    })}
  >
    {#each rows as cards, row (row)}
      <div class="presets__row">
        <ul class="presets__track">
          {#each cards as card (card.id)}
            {@const label = card.preset.label ?? card.preset.name}
            <li>
              <button type="button" class="preset" data-preset={card.preset.name} aria-pressed={card.preset.name === pressed} aria-label={label} title={label} onclick={() => pick(card.preset)}>
                <img src={srcOf(card.preset)} alt="" width="160" height="160" loading={running ? 'eager' : 'lazy'} decoding="async" />
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
  <button type="button" class="act act--quiet presets__pause t-label" hidden={!running} onclick={() => (paused = !paused)}>{paused ? 'play' : 'pause'}</button>
</section>

<style>
  /* A marquee of rows, edge to edge across the page, every other row running the other way. No
     heading: the rows are the section. Each row is one track, moved by a transform; its cards are
     a fixed size, so a card's step is the same everywhere. */
  .presets {
    --card: 128px;
    position: relative;
    margin: var(--s-9) calc(-1 * var(--gutter)) 0;
    scroll-margin-top: var(--s-5);
  }

  .presets__marquee {
    display: grid;
    gap: var(--s-3);
    overflow: hidden;
    /* The rows fade out at the page's sides, rather than being cut. */
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }

  .presets__row {
    overflow: hidden;
  }

  .presets__track {
    display: flex;
    gap: var(--s-3);
    width: max-content;
    padding: 0;
    list-style: none;
  }

  .presets__marquee[data-running] .presets__track {
    will-change: transform;
  }

  .presets__track > li {
    flex: none;
    width: var(--card);
  }

  /* Without the script, or under reduced motion, nothing moves: the rows scroll by hand. */
  @media (scripting: none), (prefers-reduced-motion: reduce) {
    .presets__marquee {
      mask-image: none;
    }

    .presets__row {
      overflow-x: auto;
      padding-inline: var(--gutter);
      scrollbar-width: thin;
    }
  }

  /* Just the picture: the name is the button's label, for screen readers and as a tooltip. */
  .preset {
    display: grid;
    place-items: center;
    width: 100%;
    padding: var(--s-2);
    border: 1px solid transparent;
    border-radius: var(--r-2);
    background: none;
    cursor: pointer;
  }

  .preset img {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }

  .preset:hover {
    border-color: var(--line-strong);
  }

  .preset[aria-pressed="true"] {
    border-color: var(--text);
  }

  .preset:focus-visible {
    outline-offset: -2px;
  }

  /* In the space under the rows, so the gaps above and below them stay equal. */
  .presets__pause {
    position: absolute;
    top: calc(100% + var(--s-2));
    right: var(--gutter);
    color: var(--muted);
  }

  .presets__pause[hidden] {
    display: none;
  }

  @media (max-width: 900px) {
    .presets {
      margin-top: var(--s-8);
    }
  }

  @media (max-width: 640px) {
    .presets {
      --card: 96px;
    }

    .presets__marquee, .presets__track {
      gap: var(--s-2);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    /* Each row slides in from the way it runs. */
    .presets__row {
      animation: enter-left 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) var(--enter, 0s) backwards !important;
    }

    .presets__row:nth-child(even) {
      animation-name: enter-right !important;
    }

    .presets__row:nth-child(1) { --enter: 0.4s; }
    .presets__row:nth-child(2) { --enter: 0.48s; }
    .presets__row:nth-child(3) { --enter: 0.56s; }

    /* @starting-style, not keyframes: the button appears later, once the marquee runs. */
    .presets__pause {
      transition: opacity 0.5s ease, translate 0.5s ease !important;
    }

    @starting-style {
      .presets__pause {
        opacity: 0;
        translate: 0 6px;
      }
    }
  }
</style>
