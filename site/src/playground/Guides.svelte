<!--
  The selection frame over the stage's mascot: handles for its width and height, and one for its
  eyes. They are for pointers; every value they set has a control in the rail too.
-->
<script lang="ts">
  import { attribute } from '../lib/attributes';
  import { usePlayground } from './state.svelte';

  interface Props {
    /** The stage, which the frame is placed in. */
    area: HTMLElement;
    mascot: HTMLElement & { poke(): void };
    /** Whether the stage has the pointer or focus. */
    shown: boolean;
  }

  let { area, mascot, shown }: Props = $props();

  const playground = usePlayground();

  const HANDLE_MIN_WIDTH = 120;
  const BOUNDS = {
    'body-width': attribute('body-width', 'number'),
    'body-height': attribute('body-height', 'number'),
    'eye-y': attribute('eye-y', 'number'),
    'eye-spacing': attribute('eye-spacing', 'number'),
  };
  type Limited = keyof typeof BOUNDS;

  interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  }

  /** Where the body and its eyes rest, in client pixels, or null while there are no guides. */
  let measured = $state.raw<(Box & { eyes: Box }) | null>(null);
  let origin = $state.raw({ left: 0, top: 0 });

  /**
   * Where a part rests, in client pixels. It's worked out from the SVG's own coordinates, because a
   * measured box would catch the mascot mid-hop, and the frame must hold still.
   */
  function restingBox(graphic: SVGGraphicsElement, svg: SVGSVGElement, box: DOMRect): Box {
    const view = svg.viewBox.baseVal;
    const scale = box.width / view.width;
    const { x, y, width, height } = graphic.getBBox();
    // A bounding box leaves out the element's own transform, and the eyes are placed by one.
    const transforms = graphic.transform.baseVal;
    const shift = transforms.numberOfItems ? transforms.getItem(0).matrix : { e: 0, f: 0 };
    const left = box.left + (x + shift.e - view.x) * scale;
    const top = box.top + (y + shift.f - view.y) * scale;
    return { left, top, right: left + width * scale, bottom: top + height * scale, width: width * scale, height: height * scale };
  }

  function measure() {
    const root = mascot.shadowRoot;
    const bodyLayer = root?.querySelector<SVGSVGElement>('[part="body"]');
    const eyeLayer = root?.querySelector<SVGSVGElement>('[part="eyes"]');
    const body = bodyLayer?.querySelector<SVGGraphicsElement>(':scope > use');
    const eyes = eyeLayer?.querySelector<SVGGraphicsElement>(':scope > g');
    if (!shown || mascot.hidden || !bodyLayer || !eyeLayer || !body || !eyes || mascot.offsetWidth < HANDLE_MIN_WIDTH) {
      measured = null;
      return;
    }
    const box = mascot.getBoundingClientRect();
    origin = area.getBoundingClientRect();
    measured = { ...restingBox(body, bodyLayer, box), eyes: restingBox(eyes, eyeLayer, box) };
  }

  // Again once the library has laid out whatever just changed: a frame after any edit, resize or
  // move of the pointer in or out.
  $effect(() => {
    void shown;
    void playground.attributes;
    void playground.drawing;
    let frame = requestAnimationFrame(measure);
    const queue = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(queue);
    resize.observe(mascot);
    addEventListener('resize', queue);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      removeEventListener('resize', queue);
    };
  });

  const numeric = (name: Limited) => Number(playground.read(name) ?? BOUNDS[name].default);
  const clampTo = (name: Limited, value: number) => Math.round(Math.min(BOUNDS[name].max, Math.max(BOUNDS[name].min, value)) * 100) / 100;

  type Kind = 'left' | 'right' | 'top' | 'eyes';
  let drag: { kind: Kind; moved: boolean; x: number; y: number; centre: number; bottom: number; half: number; tall: number; eyeSpan: number; start: Record<Limited, number> } | null = null;

  function start(event: PointerEvent, kind: Kind) {
    if (!measured) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const { left, right, top, bottom, eyes } = measured;
    drag = {
      kind, moved: false, x: event.clientX, y: event.clientY,
      centre: (left + right) / 2, bottom, half: (right - left) / 2, tall: bottom - top, eyeSpan: eyes.width / 2,
      start: { 'body-width': numeric('body-width'), 'body-height': numeric('body-height'), 'eye-y': numeric('eye-y'), 'eye-spacing': numeric('eye-spacing') },
    };
  }

  function move(event: PointerEvent) {
    if (!drag) return;
    drag.moved = true;
    const { kind, start: from } = drag;
    if (kind === 'left' || kind === 'right') {
      playground.write('body-width', clampTo('body-width', from['body-width'] * (Math.abs(event.clientX - drag.centre) / drag.half)));
    } else if (kind === 'top') {
      playground.write('body-height', clampTo('body-height', from['body-height'] * ((drag.bottom - event.clientY) / drag.tall)));
    } else {
      playground.write('eye-y', clampTo('eye-y', from['eye-y'] + (event.clientY - drag.y) / (drag.tall * 0.22)));
      playground.write('eye-spacing', clampTo('eye-spacing', from['eye-spacing'] + (event.clientX - drag.x) / drag.eyeSpan));
    }
  }

  function end() {
    if (!drag) return;
    if (drag.moved) playground.commit();
    else mascot.poke();
    drag = null;
  }
</script>

<div
  class="frame"
  id="frame"
  aria-hidden="true"
  hidden={!measured}
  style:left="{(measured?.left ?? 0) - origin.left}px"
  style:top="{(measured?.top ?? 0) - origin.top}px"
  style:width="{measured?.width ?? 0}px"
  style:height="{measured?.height ?? 0}px"
>
  <!-- The handles are for pointers alone: every value they set has a control in the rail. -->
  {#each ['left', 'right', 'top'] as const as kind (kind)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="frame__handle" data-drag={kind} onpointerdown={(event) => start(event, kind)} onpointermove={move} onpointerup={end} onpointercancel={end}></span>
  {/each}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <span
    class="frame__handle frame__handle--eye"
    data-drag="eyes"
    style:left="{measured ? measured.eyes.right - measured.left : 0}px"
    style:top="{measured ? (measured.eyes.top + measured.eyes.bottom) / 2 - measured.top : 0}px"
    onpointerdown={(event) => start(event, 'eyes')}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={end}
  ></span>
</div>

<style>
  .frame {
    position: absolute;
    outline: 1px solid color-mix(in srgb, var(--on-stage) 32%, transparent);
    pointer-events: none;
  }

  .frame[hidden] { display: none; }

  .frame__handle {
    position: absolute;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    background: var(--ink);
    outline: 2px solid var(--cream);
    pointer-events: auto;
    touch-action: none;
  }

  /* A 44px target around a 12px mark. */
  .frame__handle::before {
    content: "";
    position: absolute;
    inset: -16px;
  }

  .frame__handle[data-drag="left"] { left: 0; top: 50%; cursor: ew-resize; }
  .frame__handle[data-drag="right"] { left: 100%; top: 50%; cursor: ew-resize; }
  .frame__handle[data-drag="top"] { left: 50%; top: 0; cursor: ns-resize; }

  .frame__handle--eye {
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border: 2px solid var(--on-stage);
    border-radius: 50%;
    background: none;
    outline: 0;
    cursor: move;
  }

  @media (forced-colors: active) {
    .frame__handle { background: CanvasText; outline-color: Canvas; forced-color-adjust: none; }
  }
</style>
