<script setup>
import { ref } from 'vue';

const MOODS = ['idle', 'thinking', 'working', 'success', 'error'];
const mood = ref('idle');
const pokes = ref(0);
</script>

<template>
  <main id="stage">
    <agent-mascot shape="orb" color="#5b5bd6" track="#stage" :mood="mood" @mascot-poke="pokes++" />
    <nav>
      <button v-for="name in MOODS" :key="name" :aria-pressed="name === mood" @click="mood = name">
        {{ name }}
      </button>
    </nav>
    <p>Pokes: <output>{{ pokes }}</output></p>
  </main>
</template>
