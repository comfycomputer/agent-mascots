<script>
  const MOODS = ['idle', 'thinking', 'working', 'success', 'error'];
  let mood = $state('idle');
  let pokes = $state(0);
</script>

<main id="stage">
  <agent-mascot shape="orb" color="#5b5bd6" track="#stage" {mood} onmascot-poke={() => pokes++}
  ></agent-mascot>
  <nav>
    {#each MOODS as name}
      <button aria-pressed={name === mood} onclick={() => (mood = name)}>{name}</button>
    {/each}
  </nav>
  <p>Pokes: <output>{pokes}</output></p>
</main>
