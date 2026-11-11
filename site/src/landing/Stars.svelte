<!--
  The star count on the GitHub bar. Asked of GitHub's public API once the page is idle, and kept
  for the session, so moving around the site doesn't spend the visitor's rate limit. If GitHub
  doesn't answer, the bar is just a link, with no count.
-->
<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { onIdle } from '../lib/idle';
  import { session } from '../lib/storage';

  /** The repository's address on GitHub. */
  let { href }: { href: string } = $props();

  const KEY = 'agent-mascots:stars';
  /** An hour, in milliseconds: stars don't move fast enough to ask more often. */
  const FRESH = 60 * 60 * 1000;

  let count = $state<number | null>(null);

  const format = (n: number) => (n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`);

  function kept(repo: string): number | null {
    try {
      const saved = JSON.parse(session.get(KEY) ?? 'null');
      return saved?.repo === repo && Date.now() - saved.at < FRESH && Number.isInteger(saved.count) ? saved.count : null;
    } catch {
      return null;
    }
  }

  async function ask(repo: string) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) return;
      const stars = (await response.json()).stargazers_count;
      if (!Number.isInteger(stars)) return;
      session.set(KEY, JSON.stringify({ repo, count: stars, at: Date.now() }));
      count = stars;
    } catch {
      // Offline or refused: the bar stays a plain link.
    }
  }

  $effect(() => {
    const [, owner, name] = new URL(href).pathname.split('/');
    // OWNER is site/config.ts's placeholder until hosting is decided: there is nothing to ask about.
    if (!owner || !name || owner === 'OWNER') return;
    const repo = `${owner}/${name}`;
    count = kept(repo);
    if (count !== null) return;
    return onIdle(() => void ask(repo), 3000);
  });
</script>

<span class="hero__stars" data-stars hidden={count === null}>
  <Icon name="star" />
  <span data-stars-count>{count === null ? '' : format(count)}</span><span class="visually-hidden"> stars</span>
</span>

<style>
  /* At the bar's right edge. Hidden until GitHub answers; its space isn't held, as the bar's height
     doesn't change. */
  .hero__stars {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
    flex: none;
    margin-left: auto;
    padding-left: var(--s-3);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .hero__stars :global(.icon) {
    width: 14px;
    height: 14px;
  }

  .hero__stars[hidden] {
    display: none;
  }
</style>
