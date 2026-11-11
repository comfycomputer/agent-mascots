<!-- A page's title and description, and its card for links shared elsewhere. -->
<script lang="ts">
  import { SITE_URL } from '../../config';

  interface Props {
    title: string;
    description?: string;
    /** The page's path from the site root, for its canonical address. Leave out for a page with none. */
    path?: string;
  }

  let { title, description, path }: Props = $props();
</script>

<svelte:head>
  <title>{title}</title>
  {#if description}<meta name="description" content={description} />{/if}
  {#if path !== undefined}
    <meta property="og:title" content={title} />
    {#if description}<meta property="og:description" content={description} />{/if}
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{SITE_URL}/{path}" />
    <link rel="canonical" href="{SITE_URL}/{path}" />
    <meta property="og:image" content="{SITE_URL}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="The agent-mascots wordmark beside a mascot." />
    <meta name="twitter:card" content="summary_large_image" />
  {:else}
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>
