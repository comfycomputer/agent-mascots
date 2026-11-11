<script setup lang="ts">
import { ref } from 'vue';

const pokes = ref(0);
const mood = ref<'idle' | 'working'>('idle');
const target = ref<HTMLElement | null>(null);
</script>

<template>
  <div id="target" ref="target">target</div>
  <agent-mascot
    id="mascot"
    shape="orb"
    material="glass"
    :mood="mood"
    :size="160"
    :body-width="1.2"
    :body-height="0.9"
    accessories="ears"
    :trackElement="target"
    @mascot-poke="pokes++"
  />
  <output id="pokes">{{ pokes }}</output>
  <button id="work" @click="mood = 'working'">work</button>
</template>
