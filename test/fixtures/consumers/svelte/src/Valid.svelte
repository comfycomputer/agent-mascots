<script lang="ts">
  import type { AgentMascot } from 'agent-mascots';

  let { target }: { target: Element } = $props();
  let mascot = $state<AgentMascot>();
</script>

<agent-mascot
  bind:this={mascot}
  class="mascot"
  shape="my-registered-shape"
  body-width="1.2"
  eyeSpacing={1.1}
  mood="listening"
  trackElement={target}
  onmascot-gyro={(event) => console.log(event.detail.state)}
  onclick={() => mascot?.poke()}
></agent-mascot>
