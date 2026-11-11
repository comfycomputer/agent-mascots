<!--
  Downloads, in a dialog: the mascot in an icon frame, which can be moved, sized and turned on a
  ground of its own, saved as a PNG at a chosen size, or as a short video of it moving.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import RadioGroup from '../components/RadioGroup.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { ATTRIBUTES } from '../lib/attributes';
  import { darkFor } from '../lib/colour';
  import { tileOf } from '../lib/snapshot';
  import { SECONDS, VIDEO_PX, canRecord, downloadImage, pictureOfFrame, recordVideo, type Frame } from './capture';
  import Fader from './Fader.svelte';
  import { usePlayground } from './state.svelte';

  const playground = usePlayground();

  /** The PNG sizes on offer, each with a preview that is also its download button. */
  const SIZES = [512, 256, 128, 64, 32];
  /** The largest a preview is drawn, in CSS pixels. Smaller sizes show at their own. */
  const PREVIEW_MAX = 48;
  /** Not mirrored: the frame's mascot holds still for the pointer, and has no name of its own. */
  const NOT_MIRRORED = new Set(['size', 'label', 'gyro', 'track', 'track-reach', 'motion']);
  /** It starts large, tipped over and peeking in from the bottom-right corner, which reads as an avatar. */
  const START = { x: 0.16, y: 0.2, scale: 1.5, rotate: -30 };
  const TUNE = [
    { name: 'scale', label: 'size', min: 0.3, max: 1.6, step: 0.01 },
    { name: 'rotate', label: 'rotation', min: -180, max: 180, step: 1 },
  ] as const;
  /** Light by default; dark is worked out from the body; `transparent` saves a PNG with nothing behind. */
  const GROUNDS = { dark: 'dark', light: '#ffffff', transparent: null } as const;
  const GROUND_OPTIONS = Object.keys(GROUNDS).map((value) => ({ value }));
  /** Where the mascot may go: far enough to crop it, never so far it leaves. */
  const REACH = 0.5;
  const KEY_STEP = 0.02;
  const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const TABS = [
    { id: 'icon', label: 'icon' },
    { id: 'video', label: 'video' },
  ];

  let dialog: HTMLDialogElement;
  let frame: HTMLElement;
  let icon: HTMLElement;
  let previews: HTMLCanvasElement[] = $state([]);

  let isOpen = $state(false);
  let tab = $state('icon');
  let place = $state({ ...START });
  /** A name from GROUNDS, or a custom hex. */
  let ground = $state<string>('light');
  /** The body colour the frame's mascot paints in, resolved. */
  let body = $state('#18c2a0');
  let dragging = $state<{ x: number; y: number; from: typeof START } | null>(null);
  let busy = $state(false);
  let recording = $state<number | null>(null);
  let recordable = $state(false);
  let density = $state(1);

  const custom = $derived(!(ground in GROUNDS));
  /** The ground's colour, or null for none. */
  const fill = $derived.by(() => {
    const colour = custom ? ground : GROUNDS[ground as keyof typeof GROUNDS];
    return colour === 'dark' ? darkFor(body) : colour;
  });
  const transform = $derived(`translate(${place.x * 100}%, ${place.y * 100}%) rotate(${place.rotate}deg) scale(${place.scale})`);

  /** The stage's look. Its motion is set by the tab: still for an icon, the stage's own for a video. */
  const look = $derived.by(() => {
    const mirrored: Record<string, string | undefined> = {};
    for (const name of ATTRIBUTES.keys()) if (!NOT_MIRRORED.has(name)) mirrored[name] = playground.read(name);
    mirrored.motion = tab === 'video' ? playground.read('motion') : '0';
    return mirrored;
  });

  const current = (): Frame => ({ frame, mascot: icon, transform, fill });

  export function open() {
    dialog.showModal();
    isOpen = true;
  }

  onMount(() => {
    recordable = canRecord();
    density = devicePixelRatio;
  });

  function readBody() {
    const tile = tileOf(icon);
    body = (tile && getComputedStyle(tile).getPropertyValue('--_c').trim()) || '#18c2a0';
  }

  // The dark ground answers the body colour, once the mascot has taken the new look.
  $effect(() => {
    void look;
    let next = requestAnimationFrame(readBody);
    customElements.whenDefined('agent-mascot').then(() => (next = requestAnimationFrame(readBody)));
    return () => cancelAnimationFrame(next);
  });

  /* Each size's preview is drawn from one render, so they always agree. */

  let drawing = false;
  let again = false;

  async function drawPreviews() {
    if (drawing) {
      again = true;
      return;
    }
    // Closed, the frame has no size, and nobody is looking.
    if (!tileOf(icon) || !frame.clientWidth) return;
    drawing = true;
    try {
      const image = await pictureOfFrame(current(), Math.ceil(PREVIEW_MAX * devicePixelRatio));
      for (const canvas of previews) {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
    } catch {
      // A preview is a nicety: the download draws its own.
    } finally {
      drawing = false;
      if (again) {
        again = false;
        drawPreviews();
      }
    }
  }

  // Once the frame has held still a moment: drawing one takes a few frames of its own.
  $effect(() => {
    if (!isOpen) return;
    void [transform, fill, look, body];
    const queued = setTimeout(drawPreviews, 250);
    return () => clearTimeout(queued);
  });

  const clamp = (value: number) => Math.min(REACH, Math.max(-REACH, value));

  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = { x: event.clientX, y: event.clientY, from: { ...place } };
    frame.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!dragging) return;
    const size = frame.clientWidth;
    place.x = clamp(dragging.from.x + (event.clientX - dragging.x) / size);
    place.y = clamp(dragging.from.y + (event.clientY - dragging.y) / size);
  }

  function nudge(event: KeyboardEvent) {
    const step = KEYS[event.key];
    if (!step) return;
    event.preventDefault();
    const by = event.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    place.x = clamp(place.x + step[0] * by);
    place.y = clamp(place.y + step[1] * by);
  }

  /** A press on the backdrop, outside the dialog's box, closes it, as Escape does. */
  function backdrop(event: PointerEvent) {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  }

  async function run(job: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
      await job();
    } catch {
      playground.say('That download failed, so nothing was saved.');
    } finally {
      busy = false;
      recording = null;
    }
  }

  const saveImage = (px: number) =>
    run(async () => {
      await downloadImage(current(), px);
      playground.say(fill ? `Saved a ${px}px PNG.` : `Saved a ${px}px PNG, with a transparent background.`);
    });

  const saveVideo = () =>
    run(async () => {
      // A video has no transparency: a clear frame records on the dark ground.
      const recorded = await recordVideo(current, fill ?? darkFor(body), (left) => (recording = left));
      playground.say(recorded ? `Saved ${SECONDS} seconds of video.` : 'This browser can’t record video. The image still works.');
    });
</script>

<dialog class="download" id="download" aria-labelledby="download-head" bind:this={dialog} onclose={() => (isOpen = false)} onpointerdown={backdrop}>
  <div class="download__head">
    <h2 class="download__title" id="download-head">download</h2>
    <button class="act act--icon" type="button" id="download-close" aria-label="Close" title="close" onclick={() => dialog.close()}><Icon name="close" /></button>
  </div>
  <div class="download__body">
    <!-- A widget of its own: a drag, or the arrow keys, move the mascot in it. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="icon-frame"
      id="icon-frame"
      tabindex="0"
      role="group"
      aria-label="Icon frame. Drag the mascot, or use the arrow keys, to move it."
      aria-describedby="icon-note"
      data-clear={fill ? undefined : ''}
      data-dragging={dragging ? '' : undefined}
      style:background={fill ?? undefined}
      bind:this={frame}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={() => (dragging = null)}
      onpointercancel={() => (dragging = null)}
      onkeydown={nudge}
    >
      <agent-mascot class="icon-frame__mascot" id="icon-mascot" track="none" aria-hidden="true" style:transform {...look} bind:this={icon}></agent-mascot>
    </div>
    <div class="download__controls">
      <RadioGroup
        class="segmented icon-grounds"
        id="icon-grounds"
        aria-label="Icon background"
        name="icon-ground"
        options={GROUND_OPTIONS}
        value={ground}
        onchange={(value) => (ground = value)}
      >
        <label class="ground-custom">
          <input
            class="swatch"
            type="color"
            value={custom ? ground : '#c9d8e6'}
            aria-label="Custom icon background"
            data-on={custom ? '' : undefined}
            oninput={(event) => (ground = event.currentTarget.value)}
          />
          <span>custom</span>
        </label>
      </RadioGroup>
      <div class="mixer icon-tune" id="icon-tune" role="group" aria-label="Icon frame">
        {#each TUNE as { name, label, min, max, step } (name)}
          <Fader {label} {min} {max} {step} value={place[name]} rest={START[name]} oninput={(value) => (place[name] = value)} />
        {/each}
        <button class="act icon-tune__reset" type="button" onclick={() => (place = { ...START })}>reset</button>
      </div>
    </div>
  </div>
  <p class="note icon-note" id="icon-note">Drag the mascot to move it in the frame.</p>
  <div class="download__tabs">
    <Tabs items={TABS} bind:selected={tab} label="Save as" tabId={(item) => `dl-tab-${item.id}`} panelId={(item) => `dl-${item.id}`}>
      {#snippet panel(item, attributes)}
        <div class="download__panel" {...attributes}>
          {#if item.id === 'icon'}
            <p class="note">A still. Pick a size to save it as a PNG.</p>
            <div class="icon-sizes" id="icon-sizes" role="group" aria-label="Save as PNG">
              {#each SIZES as px, index (px)}
                {@const shown = Math.min(px, PREVIEW_MAX)}
                <button class="pick icon-size" type="button" aria-label="Save a {px}px PNG" title="{px} × {px}" disabled={busy} onclick={() => saveImage(px)}>
                  <span class="icon-size__well">
                    <canvas
                      class="icon-size__preview"
                      width={Math.ceil(shown * density)}
                      height={Math.ceil(shown * density)}
                      style:width="{shown}px"
                      style:height="{shown}px"
                      aria-hidden="true"
                      bind:this={previews[index]}
                    ></canvas>
                  </span>
                  <span>{px}</span>
                </button>
              {/each}
            </div>
          {:else}
            <p class="note">The frame moving, as on the stage: {SECONDS} seconds, {VIDEO_PX}px square.</p>
            <button class="act act--strong icon-video" type="button" id="save-video" hidden={!recordable} disabled={busy} onclick={saveVideo}>
              {recording === null ? 'record video' : `recording ${recording}`}
            </button>
          {/if}
        </div>
      {/snippet}
    </Tabs>
  </div>
</dialog>

<style>
  .download {
    width: min(520px, calc(100vw - 2 * var(--gutter)));
    max-height: calc(100svh - 2 * var(--s-4));
    margin: auto;
    padding: var(--s-5);
    overflow-y: auto;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-2);
    background: var(--bg);
    color: var(--text);
  }

  .download::backdrop { background: color-mix(in srgb, var(--ink) 55%, transparent); }
  .download [hidden] { display: none !important; }

  .download__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--s-4);
  }

  .download__title {
    font-size: var(--t-small);
    font-weight: 600;
    letter-spacing: 0.08em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .act--icon { aspect-ratio: 1; padding: 0; }

  .download__body {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    align-items: start;
    gap: var(--s-4);
  }

  .download__controls { display: grid; gap: var(--s-3); min-width: 0; }
  .download__controls :global(.icon-grounds) { display: flex; width: 100%; }
  .download__controls :global(.icon-grounds > label) { flex: 1 1 auto; justify-content: center; padding-inline: 6px; }

  .ground-custom { cursor: pointer; }
  .ground-custom .swatch { width: 16px; height: 16px; border-radius: 3px; }

  .ground-custom:has([data-on]) {
    background: var(--surface);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--text);
  }

  .ground-custom .swatch:focus-visible { outline: 0; }

  /* 96px, on its ground, or a checkerboard when clear, so what is transparent reads as such. */
  .icon-frame {
    position: relative;
    width: 96px;
    height: 96px;
    overflow: hidden;
    border-radius: var(--r-1);
    box-shadow: inset 0 0 0 1px var(--line-strong);
    cursor: grab;
    touch-action: none;
  }

  .icon-frame[data-clear] { background: repeating-conic-gradient(var(--surface) 0 25%, var(--bg) 0 50%) 0 0 / 12px 12px; }
  .icon-frame[data-dragging] { cursor: grabbing; }
  .icon-frame:focus-visible { outline-offset: 2px; }

  .icon-frame__mascot {
    position: absolute;
    inset: 0;
    width: 100%;
    pointer-events: none;
  }

  .mixer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-2) var(--s-4);
  }

  .icon-tune__reset { grid-column: 1 / -1; justify-self: end; }
  .icon-note { margin: var(--s-3) 0 var(--s-4); }

  /* Icon or video: what the frame is saved as. */
  .download__tabs :global(.tabs__list [role="tab"]) { flex: none; height: 40px; }
  /* Both as tall as the icon's, so the dialog doesn't jump between them. */
  .download__panel { min-height: 136px; padding-top: var(--s-3); }
  .download__panel > .note { margin: 0 0 var(--s-3); }

  .icon-sizes {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--s-1);
  }

  .icon-size {
    flex-direction: column;
    gap: var(--s-1);
    height: auto;
    padding: var(--s-2) 2px;
    color: var(--muted);
    font-size: var(--t-small);
  }

  .icon-size:not(:disabled):hover { color: var(--text); }

  /* Every preview on one line, whatever its size. */
  .icon-size__well { display: grid; place-items: center; width: 48px; height: 48px; }
  .icon-size__preview { display: block; border-radius: 2px; box-shadow: 0 0 0 1px var(--line); }

  .icon-video { width: 100%; }

  /* Too narrow for the frame beside its controls: the frame goes over them. */
  @media (max-width: 519px) {
    .download { padding: var(--s-4); }
    .download__body { grid-template-columns: minmax(0, 1fr); justify-items: center; }
    .download__controls { width: 100%; }
  }
</style>
