<!-- The skip link and the site's header. On the landing page its mascot dresses as the hero. -->
<script lang="ts">
  import { resolve } from '$app/paths';
  import { DOCS_URL, GITHUB_URL } from '../../config';
  import type { Page } from '../lib/pages';
  import Icon from './Icon.svelte';

  let { page, skipLabel, look = {} }: { page: Page; skipLabel: string; look?: Record<string, string> } = $props();

  // The playground reads its state from the hash, where `#main` would be taken for one, so the
  // link moves focus and the URL stays put.
  function skip(event: MouseEvent) {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }
</script>

<a class="skip-link" href="#main" onclick={skip}>{skipLabel}</a>
<header class="site-header">
  <nav class="site-nav t-label" aria-label="Main">
    <a class="site-nav__home" href={resolve('/')} aria-current={page === 'index' ? 'page' : undefined}>
      <agent-mascot class="site-nav__mascot" detail="simple" track="window" color="var(--text)" accent="var(--accent)" role="presentation" data-wears={page === 'index' ? 'face' : undefined} {...look}></agent-mascot>
      <span class="site-nav__wordmark">agent-mascots</span>
    </a>
    <ul class="site-nav__links">
      <li class="site-nav__install"><a href={page === 'index' ? '#install' : `${resolve('/')}#install`}>install</a></li>
      <li><a href={resolve('/playground')} aria-current={page === 'playground' ? 'page' : undefined}>playground</a></li>
      <li><a href={DOCS_URL}>docs</a></li>
      <li><a class="site-nav__icon" href={GITHUB_URL} aria-label="github" title="github"><Icon name="github" /></a></li>
    </ul>
  </nav>
</header>
