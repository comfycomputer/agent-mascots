<script lang="ts">
  import metrics from '../../metrics.json';
  import { announcer } from '../lib/copy.svelte';
</script>

<footer class="site-footer t-label">
  <p>agent-mascots {metrics.version}. {metrics.license}.</p>
  <p class="visually-hidden" role="status" data-copy-status>{announcer.message}</p>
</footer>
