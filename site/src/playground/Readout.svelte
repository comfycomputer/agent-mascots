<!--
  The line under the stage: what just happened, which is announced, and tilt, which starts from a
  press and remembers nothing.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { usePlayground } from './state.svelte';

  const playground = usePlayground();

  type GyroState = 'granted' | 'denied' | 'unsupported';
  const MESSAGES: Partial<Record<GyroState, string>> = {
    denied: 'Motion access was refused, so tilt stays off.',
    unsupported: 'No motion sensor here. The attribute still works on a device with one.',
  };

  let sensor = $state(false);
  onMount(() => {
    sensor = 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;
    const stage = playground.stage;
    const onGyro = (event: Event) => {
      const { state } = (event as CustomEvent<{ state: GyroState }>).detail;
      if (MESSAGES[state]) playground.say(MESSAGES[state]);
      if (state === 'denied') playground.write('gyro', null);
    };
    stage?.addEventListener('mascot-gyro', onGyro);
    return () => stage?.removeEventListener('mascot-gyro', onGyro);
  });

  async function toggle() {
    const stage = playground.stage as (HTMLElement & { enableGyro(): Promise<GyroState> }) | null;
    if (!stage) return;
    if (playground.read('gyro')) {
      playground.write('gyro', null);
      playground.say('');
      playground.commit();
      return;
    }
    const answer = await stage.enableGyro();
    // A desktop has no sensor to ask, but the code is still what a phone needs, so it stays set.
    if (answer !== 'denied') playground.write('gyro', true);
    playground.say(MESSAGES[answer] ?? 'Tilt is on. Tip the device.');
    playground.commit();
  }
</script>

<div class="readout t-label">
  <p class="readout__status" id="status" role="status">{playground.status}</p>
  <button class="act act--quiet" type="button" id="tilt" aria-pressed={Boolean(playground.read('gyro'))} hidden={!sensor} onclick={toggle}>tilt</button>
</div>

<style>
  /* The status line takes the free space, so no control moves when it shows. */
  .readout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--s-3);
    min-height: 36px;
  }

  .readout [hidden] { display: none; }

  .readout__status {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    line-height: 36px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .readout__status:empty { display: none; }
  /* Nothing to say and no tilt: no line at all, so the states sit under the stage. */
  .readout:has(.readout__status:empty):has(#tilt[hidden]) { display: none; }

  .readout .act--quiet { padding: 0 var(--s-1); }

  @media (max-width: 759px) {
    .readout__status { flex: 1 0 100%; line-height: 32px; }
  }
</style>
