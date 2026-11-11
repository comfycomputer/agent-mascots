<!-- Draw: the stage becomes a canvas, and one closed stroke becomes the shape. -->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Point } from '../lib/drawn-shape';
  import { outlineOf, surpriseOutline } from './draw';
  import { usePlayground } from './state.svelte';

  let { area }: { area: HTMLElement } = $props();

  const playground = usePlayground();

  const STROKE = 6;
  const ASK = 'Draw one closed shape.';

  let canvas: HTMLCanvasElement;
  let note = $state(ASK);
  let points: Point[] = [];

  const pen = () => canvas.getContext('2d')!;
  const clear = () => pen().clearRect(0, 0, canvas.width, canvas.height);

  // Opening sizes the canvas to the stage and hands the keyboard to the bar.
  $effect(() => {
    if (!playground.drawing) return;
    const box = area.getBoundingClientRect();
    const ratio = Math.min(2, devicePixelRatio);
    canvas.width = box.width * ratio;
    canvas.height = box.height * ratio;
    const context = pen();
    context.scale(ratio, ratio);
    context.lineCap = context.lineJoin = 'round';
    context.lineWidth = STROKE;
    context.strokeStyle = getComputedStyle(area).color;
    document.getElementById('draw-surprise')?.focus();
  });

  async function close() {
    playground.drawing = false;
    note = ASK;
    await tick();
    document.getElementById('draw-open')?.focus();
  }

  async function finish(outline: Point[] | null) {
    if (outline && playground.drawShape(outline)) {
      note = ASK;
      await tick();
      document.getElementById('draw-open')?.focus();
      return;
    }
    clear();
    note = 'Too small or too thin. Try a bigger loop.';
  }

  function down(event: PointerEvent) {
    canvas.setPointerCapture(event.pointerId);
    clear();
    points = [[event.offsetX, event.offsetY]];
  }

  function move(event: PointerEvent) {
    if (!points.length) return;
    const context = pen();
    for (const sample of event.getCoalescedEvents?.() ?? [event]) {
      const next: Point = [sample.offsetX, sample.offsetY];
      context.beginPath();
      context.moveTo(...points.at(-1)!);
      context.lineTo(...next);
      context.stroke();
      points.push(next);
    }
  }

  function up() {
    if (!points.length) return;
    const stroke = points;
    points = [];
    finish(outlineOf(stroke));
  }
</script>

<svelte:document
  onkeydown={(event) => {
    if (event.key === 'Escape' && playground.drawing) close();
  }}
/>

<canvas class="draw" id="draw" hidden={!playground.drawing} aria-hidden="true" bind:this={canvas} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}></canvas>
<div class="draw-bar" id="draw-bar" hidden={!playground.drawing}>
  <p id="draw-note">{note}</p>
  <button class="act" type="button" id="draw-surprise" onclick={() => finish(surpriseOutline())}>random</button>
  <button class="act" type="button" id="draw-cancel" onclick={close}>cancel</button>
</div>

<style>
  [hidden] { display: none !important; }

  .draw {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .draw-bar {
    position: absolute;
    inset: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-2) var(--s-3);
    background: var(--ink);
    color: var(--cream);
  }

  .draw-bar p { flex: 1 1 auto; }

  .draw-bar .act {
    border-color: color-mix(in srgb, var(--cream) 40%, transparent);
    color: inherit;
  }

  .draw-bar .act:not(:disabled):hover { background: color-mix(in srgb, var(--cream) 14%, transparent); }
</style>
