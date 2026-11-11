// The playground's one state: the mascot's attribute values, plus a few of the playground's own
// (`ground`, `anchors`, `timeline`). Every control writes here, and everything on the page is
// derived from it: the stage and its mirrors, the code and the share link. A gesture ends with
// `commit()`, which marks an undo point.

import { registerShape } from '@comfycomputer/agent-mascots';
import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { ATTRIBUTES, valuesOf } from '../lib/attributes';
import { DRAWN_SHAPE, registerDrawn, shapeFromAnchors, type Point, type ShapeOptions } from '../lib/drawn-shape';
import { formatHash, parseHash } from '../lib/hash';
import { MIN_BEAT, createSchedule, type Beat, type Schedule } from '../lib/schedule';
import { decodeSteps, encodeSteps } from './timeline';

/** `track` set to this follows the pointer over the stage's own area. */
export const AREA = '#area';
/** The playground's own values, beside the attributes. */
export const GROUND = 'ground';
export const ANCHORS = 'anchors';
export const TIMELINE = 'timeline';

/** The stage's grounds, besides a custom `#rrggbb`. It opens light. */
export const GROUNDS = ['light', 'dark'] as const;
const validGround = (ground: string | null) => (GROUNDS as readonly (string | null)[]).includes(ground) || /^#[0-9a-f]{6}$/i.test(ground ?? '');

const FALLBACK_REACH = 0.42; // What the library uses with `track="self"`.
const HISTORY = 40;
const STATUS_MS = 2600;

/** Tuned by eye: [body, accent]. Frost stays pale, because it washes out saturated bodies. */
const PAIRS: Record<string, [string, string][]> = {
  glow: [['#18c2a0', '#ffd84d'], ['#ff6a3d', '#ffe9a8'], ['#3d7bff', '#7df0d0'], ['#e8442e', '#ffc62e'], ['#ff8fb1', '#fff1dc'], ['#7a5cff', '#ffb3a7'], ['#ffc62e', '#e8442e']],
  frost: [['#f6efe2', '#ffc62e'], ['#dbe9f6', '#3d7bff'], ['#fbe3e8', '#e8442e'], ['#def3ea', '#18c2a0']],
  glass: [['#8fd8ff', '#ffd84d'], ['#ffb3a7', '#fff1dc'], ['#7df0d0', '#3d7bff'], ['#d9c8ff', '#ff8fb1']],
};
const MATERIALS = ['glow', 'glow', 'frost', 'glass'];
const EYE_SHAPES = ['auto', 'auto', 'pill', 'round', 'dot'];

const any = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const between = (least: number, most: number) => Math.round((least + Math.random() * (most - least)) * 100) / 100;

type Value = string | number | boolean | null | undefined;

export class Playground {
  #values = new SvelteMap<string, string>();
  #past: string[] = [];
  #saved = '[]';
  #statusTimer: ReturnType<typeof setTimeout> | undefined;
  #schedule: Schedule | null = null;
  #ending: ReturnType<typeof setTimeout> | undefined;

  /** How many undo points there are. */
  undoable = $state(0);
  /** The line under the stage, which is announced. */
  status = $state('');
  /** Whether the stage is a canvas to draw on. */
  drawing = $state(false);
  /** The mood the timeline is playing, over the chosen one. */
  playing = $state<{ mood: string; index: number } | null>(null);
  /** The stage's element, once it is on the page. */
  stage = $state.raw<HTMLElement | null>(null);

  read(name: string): string | undefined {
    return this.#values.get(name);
  }

  /** Set a value, or clear it with null. */
  write(name: string, value: Value): void {
    const next = value == null || value === false ? undefined : String(value);
    if (this.#values.get(name) === next) return;
    // The drawn shape is registered before anything can draw it.
    if (name === ANCHORS && next) registerDrawn(JSON.parse(next) as Point[], registerShape);
    if (next === undefined) this.#values.delete(name);
    else this.#values.set(name, next);
    // A mood picked by hand ends the timeline.
    if (name === 'mood') this.stop();
  }

  defaultOf(name: string): string | number | boolean | undefined {
    if (name === 'track-reach' && (this.read('track') ?? 'self') === 'self') return FALLBACK_REACH;
    return ATTRIBUTES.get(name)?.default;
  }

  /** Whether this attribute would change anything, so whether the code should mention it. */
  isSet(name: string): boolean {
    const value = this.read(name);
    return value !== undefined && value !== String(this.defaultOf(name));
  }

  /** The attributes worth printing, in the manifest's order. */
  readonly attributes = $derived([...ATTRIBUTES.keys()].filter((name) => this.isSet(name)).map((name): [string, string] => [name, this.read(name)!]));

  readonly shape = $derived(this.read('shape') ?? 'blob');
  readonly drawn = $derived(this.read('shape') === DRAWN_SHAPE);
  /** The drawn outline, while the shape is the drawn one. */
  readonly anchors = $derived(this.drawn && this.read(ANCHORS) ? (JSON.parse(this.read(ANCHORS)!) as Point[]) : null);
  /** The drawn shape's options, for the code. */
  readonly drawnOptions = $derived<ShapeOptions | null>(this.anchors ? shapeFromAnchors(this.anchors).options : null);
  readonly steps = $derived(decodeSteps(this.read(TIMELINE)));

  /**
   * The share link: the attributes that are set, the drawn outline, and the playground's own
   * values. formatHash leaves out defaults, but with `track="self"` the reach's default is another
   * number, so a reach of 2 goes beside it.
   */
  readonly hash = $derived.by(() => {
    const extras = new URLSearchParams();
    const ground = this.read(GROUND);
    const timeline = this.read(TIMELINE);
    if (ground) extras.set('g', ground);
    if (this.read('track') === AREA) extras.set('area', '1');
    if (timeline) extras.set('t', timeline);
    if (this.isSet('track-reach') && this.read('track-reach') === '2') extras.set('track-reach', '2');
    return [formatHash({ attrs: Object.fromEntries(this.attributes), anchors: this.anchors }), extras.toString()].filter(Boolean).join('&');
  });

  /** Replace everything with a share link's state. Anything that doesn't pass is left at its default. */
  loadHash(hash: string): void {
    const link = parseHash(hash);
    const params = new URLSearchParams(hash.slice(1));
    const entries = new Map(Object.entries(link?.attrs ?? {}));
    if (link) {
      if (link.attrs.shape === DRAWN_SHAPE) {
        if (link.anchors && registerDrawn(link.anchors, registerShape)) entries.set(ANCHORS, JSON.stringify(shapeFromAnchors(link.anchors).anchors));
        else entries.delete('shape');
      }
      if (params.get('area') === '1') entries.set('track', AREA);
      const ground = params.get('g');
      if (ground && validGround(ground)) entries.set(GROUND, ground);
      const timeline = encodeSteps(decodeSteps(params.get('t')));
      if (timeline) entries.set(TIMELINE, timeline);
    }
    this.stop();
    this.load(entries);
    this.settle();
  }

  /** Make the drawn outline the shape. False if it can't make one. */
  drawShape(outline: Point[]): boolean {
    if (!registerDrawn(outline, registerShape)) return false;
    this.write(ANCHORS, JSON.stringify(shapeFromAnchors(outline).anchors));
    this.write('shape', DRAWN_SHAPE);
    this.write('accessories', 'none');
    this.drawing = false;
    this.commit();
    return true;
  }

  setSteps(steps: readonly Beat[]): void {
    this.write(TIMELINE, encodeSteps(steps) || null);
  }

  /** Replace everything, as a shared link or reset does. */
  load(entries: Iterable<[string, string]>): void {
    const next = new Map(entries);
    for (const name of new Set([...this.#values.keys(), ...next.keys()])) this.write(name, next.get(name));
  }

  /** Mark an undo point. Call at the end of a gesture, not on every tick. */
  commit(): void {
    const now = this.#snapshot();
    if (now === this.#saved) return;
    this.#past.push(this.#saved);
    if (this.#past.length > HISTORY) this.#past.shift();
    this.#saved = now;
    this.undoable = this.#past.length;
  }

  /** Back to the last undo point. False if there was none. */
  undo(): boolean {
    const entries = this.#past.pop();
    if (entries === undefined) return false;
    this.#saved = entries;
    this.load(JSON.parse(entries) as [string, string][]);
    this.undoable = this.#past.length;
    return true;
  }

  /** Forget the undo points, for a state that didn't come from an edit. */
  settle(): void {
    this.#saved = this.#snapshot();
    this.#past.length = 0;
    this.undoable = 0;
  }

  /** Write and mark an undo point: one whole edit. */
  set(name: string, value: Value): void {
    this.write(name, value);
    this.commit();
  }

  stepBack(): void {
    if (this.undo()) this.say('Undone', true);
  }

  shuffle(): void {
    const material = any(MATERIALS);
    const [color, accent] = any(PAIRS[material]!);
    this.write('shape', any(valuesOf('shape').filter((shape) => shape !== this.read('shape'))));
    this.write('material', material);
    this.write('color', color);
    this.write('accent', accent);
    this.write('eye-shape', any(EYE_SHAPES));
    this.write('softness', between(0.2, 0.8));
    this.write('body-width', between(0.88, 1.14));
    this.write('body-height', between(0.88, 1.14));
    this.write('accessories', null);
    this.commit();
    this.say(`Randomised: ${this.read('shape')}, ${material}`, true);
  }

  reset(): void {
    this.stop();
    this.load([]);
    this.commit();
    this.say('Reset', true);
  }

  /** Play the timeline on the stage, from the top. */
  play(loop: boolean): void {
    this.stop();
    const steps = this.steps;
    this.#schedule = createSchedule(
      steps,
      (mood, index) => {
        this.playing = { mood, index };
        if (index === steps.length - 1 && !loop) this.#ending = setTimeout(() => this.stop(), Math.max(steps[index]![1], MIN_BEAT));
      },
      { loop },
    );
    this.#schedule.start();
  }

  stop(): void {
    clearTimeout(this.#ending);
    this.#schedule?.stop();
    this.#schedule = null;
    this.playing = null;
  }

  /** Said through the status line. `brief` messages clear themselves. */
  say(message: string, brief = false): void {
    clearTimeout(this.#statusTimer);
    this.status = message;
    if (brief) this.#statusTimer = setTimeout(() => (this.status = ''), STATUS_MS);
  }

  #snapshot(): string {
    return JSON.stringify([...this.#values]);
  }
}

export const [usePlayground, providePlayground] = createContext<Playground>();
