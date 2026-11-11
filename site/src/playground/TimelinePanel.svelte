<!--
  The mood timeline: `[mood, ms]` beats, played on the stage. Nothing sweeps across it: the beat
  playing just gets an outline, by hard cut. One editor works on the selected beat.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { valuesOf } from '../lib/attributes';
  import { MIN_BEAT, type Beat } from '../lib/schedule';
  import Face from './Face.svelte';
  import { usePlayground } from './state.svelte';
  import { BEAT_STEP, MAX_BEAT, MAX_BEATS, snap } from './timeline';

  const playground = usePlayground();

  const MOODS = valuesOf('mood');
  const PIXELS_PER_MS = 0.03; // How much taller a longer beat is, and so how far an edge drag goes.
  const BEAT_FLOOR = 44; // The height of the shortest beat: a touch target.
  const ADDED = 1200;

  let chosen = $state(0);
  let loop = $state(false);
  let list: HTMLOListElement;
  let add: HTMLButtonElement;
  let earlier: HTMLButtonElement;
  let later: HTMLButtonElement;

  const steps = $derived(playground.steps);
  const selected = $derived(Math.min(chosen, steps.length - 1));
  const beat = $derived(steps[selected]!);

  const beatHeight = (ms: number) => `${Math.round(BEAT_FLOOR + (ms - MIN_BEAT) * PIXELS_PER_MS)}px`;
  const beatButton = (index: number) => list.children[index]?.querySelector('button');

  /** Every edit stops the playing, and is one undo point. */
  function edit(change: (steps: Beat[]) => void) {
    playground.stop();
    const next = steps.map(([mood, ms]): Beat => [mood, ms]);
    change(next);
    playground.setSteps(next);
    playground.commit();
  }

  function moveBy(by: -1 | 1) {
    edit((next) => {
      const [moved] = next.splice(selected, 1);
      next.splice(selected + by, 0, moved!);
    });
    chosen = selected + by;
    // At the end of the list this button goes out of use, and focus can't stay on it.
    if (chosen === 0 || chosen === steps.length - 1) (by < 0 ? later : earlier).focus();
  }

  function remove() {
    edit((next) => next.splice(selected, 1));
    add.focus();
  }

  async function addBeat() {
    const mood = MOODS[(MOODS.indexOf(beat[0]) + 1) % MOODS.length]!;
    edit((next) => next.splice(selected + 1, 0, [mood, ADDED]));
    chosen = selected + 1;
    // At the limit this button goes out of use: the keyboard goes to the new beat.
    if (steps.length < MAX_BEATS) return;
    await tick();
    beatButton(chosen)?.focus();
  }

  function toggleLoop() {
    loop = !loop;
    if (playground.playing) playground.play(loop);
  }

  /* Both drags capture on the list, which outlives the rows being moved under the pointer. */

  let drag: { kind: 'order' | 'length'; index: number; y: number; ms: number } | null = null;

  function down(event: PointerEvent) {
    const target = event.target as HTMLElement;
    const kind = target.dataset.drag;
    if (kind !== 'order' && kind !== 'length') return;
    event.preventDefault();
    playground.stop();
    const index = Number(target.closest<HTMLElement>('.beat')!.dataset.index);
    drag = { kind, index, y: event.clientY, ms: steps[index]![1] };
    chosen = index;
    list.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!drag) return;
    const next = steps.map(([mood, ms]): Beat => [mood, ms]);
    if (drag.kind === 'length') {
      const ms = snap(drag.ms + (event.clientY - drag.y) / PIXELS_PER_MS);
      if (ms === next[drag.index]![1]) return;
      next[drag.index]![1] = ms;
    } else {
      const rows = [...list.children];
      const over = rows.findIndex((row) => event.clientY < row.getBoundingClientRect().bottom);
      const to = over === -1 ? rows.length - 1 : over;
      if (to === drag.index) return;
      const [moved] = next.splice(drag.index, 1);
      next.splice(to, 0, moved!);
      drag.index = chosen = to;
    }
    playground.setSteps(next);
  }

  function up() {
    if (!drag) return;
    drag = null;
    playground.commit();
  }
</script>

<div class="timeline-bar">
  <button class="act act--strong" type="button" id="tl-play" onclick={() => (playground.playing ? playground.stop() : playground.play(loop))}>
    {playground.playing ? 'stop' : 'play'}
  </button>
  <button class="act" type="button" id="tl-loop" aria-pressed={loop} onclick={toggleLoop}>loop</button>
  <button class="act" type="button" id="tl-add" disabled={steps.length >= MAX_BEATS} bind:this={add} onclick={addBeat}>add beat</button>
</div>
<p class="note timeline-note">Drag a grip to reorder, or an edge to change the length.</p>
<div class="beat-edit" id="beat-edit">
  <select class="text-select" aria-label="Beat state" value={beat[0]} onchange={(event) => edit((next) => (next[selected]![0] = event.currentTarget.value))}>
    {#each MOODS as mood (mood)}<option>{mood}</option>{/each}
  </select>
  <label class="beat-edit__ms t-label">
    <input
      class="scrub__value"
      type="number"
      min={MIN_BEAT}
      max={MAX_BEAT}
      step={BEAT_STEP}
      value={beat[1]}
      aria-label="Beat length in milliseconds"
      onchange={(event) => edit((next) => (next[selected]![1] = snap(Number(event.currentTarget.value) || MIN_BEAT)))}
    />ms
  </label>
  <button class="act" type="button" disabled={selected === 0} bind:this={earlier} onclick={() => moveBy(-1)}>earlier</button>
  <button class="act" type="button" disabled={selected === steps.length - 1} bind:this={later} onclick={() => moveBy(1)}>later</button>
  <button class="act" type="button" disabled={steps.length === 1} onclick={remove}>remove</button>
</div>
<ol
  class="beats"
  id="beats"
  aria-label="Beats, in order"
  style:--mascot-color={playground.read('color')}
  style:--mascot-accent={playground.read('accent')}
  bind:this={list}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
>
  {#each steps as [mood, ms], index (index)}
    <li class="beat" data-index={index} data-selected={index === selected ? '' : undefined} data-current={playground.playing?.index === index ? '' : undefined} style:--beat={beatHeight(ms)}>
      <span class="beat__grip" data-drag="order" aria-hidden="true"></span>
      <button class="beat__pick" type="button" aria-pressed={index === selected} aria-label="Beat {index + 1}: {mood} {ms} milliseconds" onclick={() => (chosen = index)}>
        <Face class="beat__mascot" {mood} /><span>{mood}</span> <span class="beat__ms">{ms}</span>
      </button>
      <span class="beat__edge" data-drag="length" aria-hidden="true"></span>
    </li>
  {/each}
</ol>

<style>
  .timeline-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }

  .timeline-note { margin: 0 0 var(--s-3); }

  .beats { display: grid; gap: 2px; }

  .beat {
    position: relative;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    height: var(--beat);
    border-radius: var(--r-1);
    background: var(--surface);
  }

  .beat[data-selected] { box-shadow: inset 0 0 0 1px var(--text); }
  .beat[data-current] { outline: 2px solid var(--text); outline-offset: -2px; }

  .beat__grip {
    position: relative;
    cursor: grab;
    touch-action: none;
  }

  .beat__grip::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 10px;
    width: 12px;
    height: 7px;
    margin-top: -4px;
    border-block: 1px solid var(--muted);
    pointer-events: none;
  }

  .beat__pick {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--s-2);
    padding-right: var(--s-3);
    text-align: left;
  }

  .beat__pick:focus-visible { outline-offset: -2px; }
  .beat__pick :global(.beat__mascot) { width: 24px; }
  .beat__ms { color: var(--muted); }

  .beat__edge {
    position: absolute;
    inset: auto 0 -5px 32px;
    z-index: 1;
    height: 12px;
    cursor: ns-resize;
    touch-action: none;
  }

  .beat__edge::before {
    content: "";
    position: absolute;
    inset: 5px var(--s-3) auto 0;
    height: 1px;
    background: var(--line-strong);
    pointer-events: none;
  }

  .beat-edit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-3);
    margin-bottom: var(--s-3);
  }

  .beat-edit .text-select { min-height: 32px; font-weight: 600; }

  .beat-edit__ms {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
  }

  .beat-edit__ms input { width: 8ch; }

  @media (forced-colors: active) {
    .beat[data-selected] { outline: 2px solid Highlight; outline-offset: -2px; }
  }
</style>
