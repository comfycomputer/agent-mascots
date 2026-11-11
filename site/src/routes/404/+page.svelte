<script lang="ts">
  import { resolve } from '$app/paths';
  import Footer from '../../components/Footer.svelte';
  import Head from '../../components/Head.svelte';
  import Nav from '../../components/Nav.svelte';
</script>

<Head title="Nothing here: agent-mascots" />
<Nav page="404" skipLabel="Skip to content" />
<main id="main" class="not-found" tabindex="-1">
  <!-- Focusable so Enter or Space can poke it, which the library does for any mascot with a tabindex. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <agent-mascot class="not-found__mascot" mood="error" track="window" tabindex="0" label="A mascot looking sorry"></agent-mascot>
  <h1 class="not-found__title">Nothing here.</h1>
  <p><a class="act" href={resolve('/')}>home</a></p>
</main>
<Footer />

<style>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--s-5);
    padding: var(--s-8) var(--gutter);
    text-align: center;
  }

  .not-found__mascot {
    width: 240px;
    max-width: 100%;
  }

  .not-found__title {
    font-family: var(--f-display);
    font-variation-settings: var(--v-display);
    font-size: calc(var(--t-h2) * 1.5);
    line-height: 1.1;
    font-weight: 600;
  }
</style>
