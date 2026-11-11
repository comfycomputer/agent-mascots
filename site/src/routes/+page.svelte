<!--
  The landing page: the hero, the preset gallery and how to use it. The page is written in the
  first preset, so it has a look before any script. With scripts, a visit gets a random one, picked
  by an inline script before the page draws (first-look.ts), or a share link's mascot. Picking a
  card puts its look on the hero, tints the page to match, and points the playground button at it.
-->
<script lang="ts">
  import fraunces from '../../fonts/fraunces.woff2?url';
  import { onMount, tick } from 'svelte';
  import Footer from '../components/Footer.svelte';
  import Head from '../components/Head.svelte';
  import Nav from '../components/Nav.svelte';
  import Hero from '../landing/Hero.svelte';
  import { FIRST_LOOK_SCRIPT } from '../landing/first-look';
  import { faceOf, playgroundLink, type Look } from '../landing/look';
  import Presets from '../landing/Presets.svelte';
  import { PRESETS, type Preset } from '../landing/presets';
  import Usage from '../landing/Usage.svelte';

  const [FIRST] = PRESETS as [Preset, ...Preset[]];

  /** The preset the hero last wore. The first is the one the inline script picked, if it ran. */
  let worn = $state.raw<Preset>(
    (typeof document !== 'undefined' && PRESETS.find((preset) => preset.name === document.documentElement.dataset.preset)) || FIRST,
  );
  /** A share link's look, which isn't a preset. */
  let cameo = $state.raw<Look | null>(null);
  /** The share link's hash, when the look came from one. */
  let shared = $state<string | null>(null);
  let mood = $state('idle');
  let walking = $state(true);
  let hero: Hero;

  const look = $derived(cameo ?? worn.attrs);
  const face = $derived(faceOf(look));

  /** Puts a preset on the hero, and its ground on the page, which the gradient below reads. */
  function wear(preset: Preset) {
    worn = preset;
    cameo = null;
    preset.ground.forEach((colour, i) => document.documentElement.style.setProperty(`--g${i + 1}`, colour));
  }

  async function pick(preset: Preset) {
    wear(preset);
    await tick();
    hero.poke();
    // Back to the hero, wherever the card was: the mascot is the point of picking one.
    if (scrollY > 0) scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  onMount(() => {
    // The inline script already picked this visit's preset. A link brings its own look, or names a section.
    if (location.hash.length <= 1) return;
    void import('../landing/cameo').then(async ({ readCameo }) => {
      const link = readCameo(location.hash);
      if (!link) return;
      cameo = link.look;
      shared = location.hash;
      if (link.mood) {
        walking = false;
        mood = link.mood;
      }
      await tick();
      hero.poke();
    });
  });
</script>

<svelte:head>
  <!-- The headline face: only this page uses it above the fold. -->
  <link rel="preload" href={fraunces} as="font" type="font/woff2" crossorigin="anonymous" />
  <!-- Picks this visit's preset before the body is parsed. Built from the presets, nothing a visitor sends. -->
  {@html FIRST_LOOK_SCRIPT}
</svelte:head>
<Head title="agent-mascots" description="An animated web component that shows what your AI agent is doing." path="" />
<Nav page="index" skipLabel="Skip to content" look={face} />
<main id="main" tabindex="-1">
  <Hero bind:this={hero} {look} bind:mood bind:walking playHref={playgroundLink(worn.attrs)} {shared} />
  <Presets pressed={cameo ? '' : worn.name} onpick={pick} />
  <Usage {face} />
</main>
<Footer />

<style>
  :global(:root) {
    /* The page column. The nav spans the page inside --gutter, as on the playground. */
    --page: 1200px;
    /* Over the gradient, surfaces and lines are see-through, so they take its colour. */
    --surface: rgb(255 255 255 / 0.55);
    --line: rgb(23 18 15 / 0.1);
    --line-strong: rgb(23 18 15 / 0.2);
  }

  /* The ground: three colours per preset, set by `wear`. Registered, so a new preset fades in rather
     than jumping. These are the first preset's, which the page opens in. */
  @property --g1 { syntax: "<color>"; inherits: true; initial-value: #ffe2b0; }
  @property --g2 { syntax: "<color>"; inherits: true; initial-value: #f8d6cf; }
  @property --g3 { syntax: "<color>"; inherits: true; initial-value: #fbf6ee; }

  :global(body) {
    background: var(--g3);
  }

  /* Fixed and behind everything, so it is painted once and scrolling never repaints it. */
  :global(body::before) {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(70% 60% at 85% 10%, var(--g1), transparent 70%),
      radial-gradient(60% 55% at 5% 45%, var(--g2), transparent 70%),
      var(--g3);
    transition: --g1 0.8s ease, --g2 0.8s ease, --g3 0.8s ease;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(body::before) { transition: none; }
  }

  :global(.site-header) {
    background: transparent;
  }

  main {
    padding: 0 var(--gutter) var(--s-9);
  }

  :global(.site-footer > p:not(.visually-hidden)) {
    width: 100%;
    max-width: var(--page);
    margin-inline: auto;
  }

  /* Entrance: the page's first paint rises into place, top to bottom, once. The one exception to
     house rule 1 in site/src/styles/base.css, so these beat its !important: only opacity, translate
     and scale, which nothing else here changes, so hovers and presses still cut. Under reduced
     motion, nothing. The hero and the presets use these keyframes too.

     Keyframes for the page load, not @starting-style: Chromium only transitions from a starting
     style if the element's first style comes after the first frame, and on a slow load it doesn't,
     so the entrance would be skipped. */

  @keyframes -global-enter-rise {
    from { translate: 0 14px; }
  }

  /* Each letter of the title, from small and out of focus. Never transparent: see Hero.svelte. */
  @keyframes -global-enter-letter {
    from { scale: 0.35; filter: blur(14px); }
  }

  @keyframes -global-enter-fade {
    from { opacity: 0; translate: 0 14px; }
  }

  @keyframes -global-enter-grow {
    from { opacity: 0; scale: 0.92; }
  }

  @keyframes -global-enter-left {
    from { opacity: 0; translate: 48px 0; }
  }

  @keyframes -global-enter-right {
    from { opacity: 0; translate: -48px 0; }
  }

  @media (prefers-reduced-motion: no-preference) {
    /* The nav only rises: it shows from the first paint. */
    :global(.site-nav) {
      animation: enter-rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) backwards !important;
    }
  }
</style>
