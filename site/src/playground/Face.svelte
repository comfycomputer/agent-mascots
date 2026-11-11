<!-- A small, still mascot: the face on a picker or a beat. It draws simple, so many can show. -->
<script lang="ts">
  let { class: className, ...look }: { class: string } & Record<string, string | undefined> = $props();
</script>

<agent-mascot class={className} detail="simple" motion="0" track="none" aria-hidden="true" {...look}></agent-mascot>
