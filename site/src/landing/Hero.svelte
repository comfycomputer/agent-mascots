<!--
  The hero: what it is, how to get it, and a large mascot wearing the page's look, with a picker
  for its mood. Until somebody picks one, the mascot walks through the moods, one every few
  seconds. Enter or Space on the mascot pokes it: the library does that for any mascot with a
  tabindex.
-->
<script lang="ts">
  import { resolve } from '$app/paths';
  import { MASCOT_MOODS } from '@comfycomputer/agent-mascots';
  import CopyButton from '../components/CopyButton.svelte';
  import Icon from '../components/Icon.svelte';
  import RadioGroup from '../components/RadioGroup.svelte';
  import { DOCS_URL, GITHUB_REPO, GITHUB_URL, INSTALL_COMMAND } from '../../config';
  import { faceAndToneOf, faceOf, type Look } from './look';
  import Stars from './Stars.svelte';

  interface Props {
    look: Look;
    mood: string;
    /** Whether the mascot is still walking through the moods. Picking one stops it. */
    walking: boolean;
    /** Where the playground button goes: the look, in the playground. */
    playHref: string;
    /** The share link the look came from, if it came from one. */
    shared: string | null;
  }

  let { look, mood = $bindable(), walking = $bindable(), playHref, shared }: Props = $props();

  /** How long the hero holds each mood while it shows them off, in milliseconds. */
  const CYCLE = 3000;
  const TITLE = 'agent-mascots';
  /** Two words, each kept whole, so a narrow screen can still break after the hyphen. */
  const WORDS = TITLE.split(/(?<=-)/);
  const MOODS = MASCOT_MOODS.map((value) => ({ value }));

  // The page as written names the repository: read before hydrating can rewrite it, so a host
  // that serves it under another name is asked about, and it stays as written.
  const githubHref = (typeof document !== 'undefined' && document.getElementById('hero-github')?.getAttribute('href')) || GITHUB_URL;

  const face = $derived(faceOf(look));
  const faceAndTone = $derived(faceAndToneOf(look));

  let mascot: HTMLElement;
  let picker: HTMLElement;
  /** The install mascot's mood while it acts out a copy. */
  let copying = $state<string>();

  export function poke() {
    (mascot as HTMLElement & { poke(): void }).poke();
  }

  $effect(() => {
    if (!walking || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let inView = true;
    const watch = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
    });
    watch.observe(mascot);
    const timer = setInterval(() => {
      // Nor while somebody is in the picker: the checked mood would move away under them.
      if (!inView || document.hidden || picker.matches(':focus-within')) return;
      mood = MASCOT_MOODS[(MASCOT_MOODS.indexOf(mood as (typeof MASCOT_MOODS)[number]) + 1) % MASCOT_MOODS.length]!;
    }, CYCLE);
    return () => {
      clearInterval(timer);
      watch.disconnect();
    };
  });
</script>

<section class="hero" aria-labelledby="hero-title">
  <div class="hero__text">
    <!-- The letters are hidden from assistive tech and the heading is named whole, so it is read as one word, never spelled out. -->
    <h1 class="hero__title" id="hero-title" aria-label={TITLE}>
      <span class="hero__letters" aria-hidden="true">
        {#each WORDS as word, w (w)}
          <span class="hero__word">
            {#each [...word] as letter, k (k)}<span class="hero__letter">{letter}</span>{/each}
          </span>
        {/each}
      </span>
    </h1>
    <p class="hero__lead">An animated web component that shows what your AI agent is doing.</p>
    <div class="hero__cta" id="install">
      <a class="hero__github" id="hero-github" href={githubHref}>
        <Icon name="github" />
        <span class="hero__github-repo">{GITHUB_REPO}</span>
        <Stars href={githubHref} />
      </a>
      <div class="use__command hero__install">
        <agent-mascot id="install-mascot" mood={copying ?? 'waiting'} detail="simple" track="none" color="var(--text)" accent="var(--accent)" aria-hidden="true" {...face}></agent-mascot>
        <code>{INSTALL_COMMAND}</code>
        <CopyButton
          class="act hero__copy"
          text={INSTALL_COMMAND}
          data-copy={INSTALL_COMMAND}
          aria-label="Copy the install command"
          title="copy"
          onmood={(next) => (copying = next)}
        >
          {#snippet children()}<Icon name="clipboard" class="icon--copy" /><Icon name="clipboardCheck" class="icon--copied" />{/snippet}
        </CopyButton>
      </div>
      <div class="hero__links">
        <a class="act hero__docs" id="hero-docs" href={DOCS_URL}>docs</a>
        <a class="act act--strong hero__play" id="hero-play" href={playHref}>playground</a>
      </div>
    </div>
  </div>
  <div class="hero__stage">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <agent-mascot
      class="hero__mascot"
      {...look}
      detail="full"
      track="window"
      {mood}
      tabindex="0"
      data-detail-priority="2"
      label="agent-mascots demo"
      bind:this={mascot}
    ></agent-mascot>
    <div bind:this={picker} class="hero__moods-wrap">
      <RadioGroup
        class="hero__moods"
        id="hero-moods"
        aria-label="mood"
        name="hero-mood"
        options={MOODS}
        value={mood}
        onchange={(value) => {
          walking = false;
          mood = value;
        }}
      >
        {#snippet option({ value })}
          <agent-mascot class="pick__mascot" mood={value} detail="simple" motion="0" track="none" aria-hidden="true" {...faceAndTone}></agent-mascot>
          <span>{value}</span>
        {/snippet}
      </RadioGroup>
    </div>
    <p class="hero__shared t-label" hidden={!shared}><a href="{resolve('/playground')}{shared ?? ''}">made in the playground</a></p>
  </div>
</section>

<style>
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--s-8);
    align-items: center;
    max-width: var(--page);
    margin-inline: auto;
    /* Nothing below: each section brings its own space above, so every gap is the same. */
    padding: var(--s-8) 0 0;
  }

  .hero__text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }

  .hero__title {
    font-family: var(--f-display);
    font-variation-settings: var(--v-display);
    font-size: clamp(48px, 7vw, 96px);
    line-height: 1;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  /* Each word whole: a narrow screen may break the title after its hyphen, never inside a word. */
  .hero__word {
    display: inline-block;
    white-space: nowrap;
  }

  .hero__lead {
    max-width: 26ch;
    margin-top: var(--s-5);
    font-size: clamp(20px, 1.8vw, 26px);
    line-height: 1.35;
  }

  /* The calls to action, one column as wide as the install command: the GitHub bar, the command,
     then docs and the playground side by side, sharing its width. */
  .hero__cta {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    width: fit-content;
    max-width: 100%;
    margin-top: var(--s-7);
    scroll-margin-top: var(--s-7);
  }

  .hero__github {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    height: 40px;
    padding: 0 var(--s-3) 0 var(--s-4);
    border: 1px solid var(--line);
    border-radius: var(--r-1);
    background: var(--surface);
    color: var(--text);
    font-family: var(--f-mono);
    font-variation-settings: var(--v-mono);
    font-size: var(--t-code);
    text-decoration: none;
  }

  .hero__github:hover {
    border-color: var(--line-strong);
  }

  .hero__github > :global(.icon) {
    flex: none;
    width: 18px;
    height: 18px;
  }

  .hero__github-repo {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The command, as wide as itself and its copy button. */
  .use__command {
    display: flex;
    align-items: center;
    gap: var(--s-2) var(--s-3);
    min-width: 0;
    height: 56px;
    padding: 0 var(--s-2) 0 var(--s-4);
    border: 1px solid var(--line-strong);
    font-size: var(--t-body);
    text-align: left;
  }

  .use__command agent-mascot {
    flex: none;
    width: 20px;
  }

  .hero__install code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* At the box's right edge, however wide the box is; the gap keeps it off the command. A square
     with a clipboard, which becomes a tick for a moment once it has copied. */
  .hero__install :global(.hero__copy) {
    flex: none;
    width: 40px;
    height: 40px;
    margin-left: auto;
    padding: 0;
  }

  .hero__install :global(.hero__copy .icon) {
    width: 18px;
    height: 18px;
  }

  .hero__install :global(:is(.hero__copy .icon--copied, .hero__copy[data-copy-state="copied"] .icon--copy)) {
    display: none;
  }

  .hero__install :global(.hero__copy[data-copy-state="copied"] .icon--copied) {
    display: block;
  }

  .hero__links {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-3);
  }

  .hero__links .act {
    height: 48px;
    padding: 0 var(--s-5);
    font-size: var(--t-body);
  }

  .hero__play {
    font-weight: 600;
  }

  .hero__stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  /* 420px is the largest a full-detail mascot may be on this site: MAX_FULL_WIDTH in lib/limits.ts. */
  .hero__mascot {
    width: min(420px, 100%);
    border-radius: 50%;
  }

  .hero__moods-wrap {
    display: contents;
  }

  .hero__moods-wrap :global(.hero__moods) {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--s-1);
    max-width: 520px;
    /* Two rows, so the page doesn't move as they wrap. */
    min-height: calc(2 * 32px + var(--s-1));
    margin-top: var(--s-5);
  }

  /* Without the script, a mood can't be picked. */
  @media (scripting: none) {
    .hero__moods-wrap :global(.hero__moods) { display: none; }
  }

  .hero__moods-wrap :global(.pick) {
    height: 32px;
    padding: 0 var(--s-2);
    gap: var(--s-2);
  }

  .pick__mascot {
    flex: none;
    width: 20px;
  }

  .hero__shared {
    margin-top: var(--s-2);
  }

  @media (max-width: 900px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--s-6);
      padding: var(--s-6) 0 0;
    }

    .hero__stage {
      order: -1;
    }

    /* One column: everything on the middle line, under the mascot. */
    .hero__text {
      align-items: center;
      text-align: center;
    }

    .hero__mascot {
      width: min(300px, 80vw);
    }
  }

  @media (max-width: 640px) {
    .hero__cta {
      width: 100%;
    }

    .hero__install {
      width: 100%;
      height: auto;
      min-height: 56px;
      gap: var(--s-2);
      padding-block: var(--s-2);
      padding-left: var(--s-3);
      font-size: var(--t-code);
    }

    /* The scoped name is too long for one line on a phone: it breaks after `install`, whole. */
    .hero__install code {
      white-space: normal;
    }

    .hero__moods-wrap :global(.hero__moods) {
      min-height: calc(3 * 32px + 2 * var(--s-1));
    }
  }

  /* Entrance: the first paint rises into place, top to bottom, once. See Landing.svelte. */
  @media (prefers-reduced-motion: no-preference) {
    /* The title, a letter at a time, left to right. Blurred and small but never transparent, so the
       heading is painted, and counted for LCP, from the first frame. */
    .hero__letter {
      display: inline-block;
      transform-origin: 50% 70%;
      animation: enter-letter 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) calc(0.03s + (var(--k, 0) + var(--w, 0)) * 0.025s) backwards !important;
    }

    .hero__word + .hero__word { --w: 6; }
    .hero__letter:nth-child(2) { --k: 1; }
    .hero__letter:nth-child(3) { --k: 2; }
    .hero__letter:nth-child(4) { --k: 3; }
    .hero__letter:nth-child(5) { --k: 4; }
    .hero__letter:nth-child(6) { --k: 5; }
    .hero__letter:nth-child(7) { --k: 6; }

    .hero__lead, .hero__cta > *, .hero__moods-wrap :global(.hero__moods) {
      animation: enter-fade 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) var(--enter, 0s) backwards !important;
    }

    .hero__mascot {
      animation: enter-grow 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) var(--enter, 0s) backwards !important;
    }

    /* Delays, top to bottom: text first, then the mascot beside it. */
    .hero__lead { --enter: 0.12s; }
    .hero__cta > :nth-child(1) { --enter: 0.2s; }
    .hero__cta > :nth-child(2) { --enter: 0.26s; }
    .hero__cta > :nth-child(3) { --enter: 0.32s; }
    .hero__mascot { --enter: 0.1s; }
    .hero__moods-wrap :global(.hero__moods) { --enter: 0.3s; }
  }
</style>
