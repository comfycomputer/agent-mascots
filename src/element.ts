import {
  type Bucket,
  type MascotProps,
  PROPS,
  parseSky,
  resolveAccessories,
  toAttribute,
} from './attrs.js';
import { TAG } from './constants.js';
import { createFx, type Fx } from './motion/fx.js';
import { addTick, removeTick } from './motion/loop.js';
import { onReducedMotionChange, prefersReducedMotion } from './motion/reduced.js';
import {
  createMotionState,
  type MotionInput,
  pokeMotion,
  settleMotion,
  stepMotion,
  writePose,
} from './motion/state.js';
import {
  observeSize,
  observeVisibility,
  unobserveSize,
  unobserveVisibility,
} from './observers.js';
import { fallbackShape, getShape, onRegistryChange } from './registry.js';
import { pickLevel } from './render/detail.js';
import { createFullRenderer } from './render/full.js';
import { computeGeometry } from './render/geometry.js';
import { createSimpleRenderer } from './render/simple.js';
import { applyStyles } from './styles.js';
import { createLookSource } from './tracking/index.js';
import type {
  Geometry,
  GyroState,
  LookSource,
  MascotConfig,
  MascotView,
  Renderer,
  ShapeDefinition,
} from './types.js';

/** Only touch `HTMLElement` when it exists, so importing in Node never throws. */
const Base = (typeof HTMLElement === 'undefined' ? Object : HTMLElement) as typeof HTMLElement;

const BY_ATTRIBUTE = new Map<string, Bucket>(
  Object.values(PROPS).map((spec) => [spec.attr, spec.bucket]),
);

const structureKey = ({ material, accessories }: MascotConfig): string =>
  `${material} ${accessories.join(' ')}`;

/** How long the wink is held under reduced motion. */
const STILL_WINK_MS = 340;

/** An `fx` step too small to see: a step of exactly zero would snap its cross-fades. */
const NO_STEP = 1e-6;

const AUTO_LABEL = /^Assistant, [a-z]+$/;
const DECORATIVE = /^(?:presentation|none)$/;

function reflect(el: Element, attr: string, value: unknown): void {
  const attribute = toAttribute(value);
  if (attribute == null) el.removeAttribute(attr);
  else el.setAttribute(attr, attribute);
}

/** Options for `configure()`. Null, undefined and false clear an option. */
export type ConfigureOptions = { [K in keyof MascotProps]?: MascotProps[K] | null } & {
  accessories?: string | readonly string[] | null;
  trackElement?: Element | null;
};

/**
 * `<agent-mascot>`: an animated, configurable mascot.
 *
 * Attribute changes are sorted by cost. Colours write CSS custom properties.
 * Numeric props patch attributes in place. Shape, material and accessories
 * rebuild the SVG. Motion state lives on the element, so none of these reset it.
 *
 * @customElement agent-mascot
 * @csspart tile - The square that holds everything, and paints the sky.
 * @csspart body - The mascot's body.
 * @csspart eyes - The mascot's eyes.
 * @cssprop [--mascot-color=#18c2a0] - Body colour, when `color` is not set.
 * @cssprop [--mascot-accent=#ffd84d] - Accent colour, when `accent` is not set.
 * @cssprop [--mascot-radius=22%] - Tile corner radius when there is a sky.
 * @cssprop [--mascot-cue] - The `waiting` and `sleeping` marks, for a ground the accent can't read on.
 * @fires mascot-poke - The mascot was poked by a click, Enter, Space or `poke()`.
 * @fires {CustomEvent<{ state: GyroState }>} mascot-gyro - The gyro state changed.
 */
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export class AgentMascot extends Base {
  static get observedAttributes(): string[] {
    return [...BY_ATTRIBUTE.keys()];
  }

  #root: ShadowRoot | null = null;
  #tile: HTMLDivElement | null = null;
  #renderer: Renderer | null = null;
  #fx: Fx | null = null;
  #geometry: Geometry | null = null;
  #motion = createMotionState();
  #visible = false;
  #running = false;
  #connected = false;
  #dirty: 'layout' | 'structure' | null = null;
  /** A layout change arrived off-screen. It costs nothing until the mascot is seen. */
  #parked = false;
  /** Last observed width, so nothing has to measure the DOM. */
  #width = 0;
  /** The last `aria-label` written here. Any other value is the consumer's. */
  #named = '';
  #trackElement: Element | null = null;
  #builtFrom = '';
  #builtShape: ShapeDefinition | null = null;
  #cleanups: (() => void)[] = [];
  #winkTimer: ReturnType<typeof setTimeout> | undefined;
  #look: LookSource = createLookSource(this, () => this.#draw());

  #input: MotionInput = {
    mood: 'idle',
    channels: { motion: 1, float: 1, blink: 1, glance: 1, bounce: 1, gaze: 1 },
    look: null,
    level: null,
    floatScale: 1,
    still: false,
  };

  /** The element to follow. Overrides `track`; handy with framework refs. */
  get trackElement(): Element | null {
    return this.#trackElement;
  }

  set trackElement(element: Element | null) {
    this.#trackElement = element ?? null;
    if (this.#connected) this.#look.bind();
  }

  /** The active accessories: the attribute, or the defaults for this shape and material. */
  get accessories(): string[] {
    return resolveAccessories(this.getAttribute('accessories'), this.#shapeDefinition(), this.material);
  }

  set accessories(value: string | readonly string[] | null) {
    reflect(this, 'accessories', value);
  }

  connectedCallback(): void {
    this.#adoptEarlyProperties();
    this.#connected = true;
    const root = (this.#root ??= this.attachShadow({ mode: 'open' }));
    applyStyles(root);
    if (!this.#tile) {
      this.#tile = document.createElement('div');
      this.#tile.className = 'tile';
      this.#tile.setAttribute('part', 'tile');
      root.append(this.#tile);
    }
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    this.#syncLabel();
    this.#syncSize();
    this.#syncPaint();
    this.#syncInput();

    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeyDown);
    this.#cleanups.push(
      onReducedMotionChange(() => this.#sync()),
      onRegistryChange(() => this.#onRegistered()),
    );
    this.#look.bind();
    observeVisibility(this, (visible) => {
      this.#visible = visible;
      this.#look.setVisible(visible);
      if (visible && this.#parked) this.#schedule('layout');
      this.#sync();
    });
    observeSize(this, (width) => {
      this.#width = width;
      this.#pickDetail();
      this.#draw();
    });

    // Before the first draw, so the first pose already knows about reduced motion.
    this.#sync();
    // With a known width, build now. Otherwise the first resize callback does it, which
    // fires before paint, without forcing layout, and builds only one detail level.
    const size = this.size;
    if (size != null) this.#width = size;
    if (this.detail !== 'auto' || size != null) this.#pickDetail();
    // Registrations aren't heard while disconnected.
    this.#rebuildIfStale();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('keydown', this.#onKeyDown);
    for (const cleanup of this.#cleanups) cleanup();
    this.#cleanups = [];
    unobserveVisibility(this);
    unobserveSize(this);
    this.#look.unbind();
    clearTimeout(this.#winkTimer);
    this.#motion.winking = false;
    // A DOM move is a disconnect and a connect in one go, and must not lose the pose.
    queueMicrotask(() => {
      if (this.#connected) return;
      this.#visible = false;
      this.#stop();
    });
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    // Before the first connect there is nothing to update; connecting reads every attribute.
    if (before === after || !this.#tile) return;
    switch (BY_ATTRIBUTE.get(name)) {
      case 'structure':
        this.#schedule('structure');
        break;
      case 'layout':
        this.#schedule('layout');
        break;
      case 'paint':
        this.#syncPaint();
        break;
      case 'motion':
        this.#syncInput();
        // `level` can arrive every frame; only the mood reaches the label.
        if (name === 'mood') this.#syncLabel(true);
        this.#draw();
        break;
      case 'track':
        if (this.#connected) this.#look.bind();
        break;
      case 'detail':
        this.#pickDetail();
        break;
      case 'size':
        this.#syncSize();
        break;
      case 'label':
        this.#syncLabel();
        break;
    }
  }

  /** Squash and wink, and tell the page. */
  poke(): void {
    if (prefersReducedMotion()) {
      this.#motion.winking = true;
      this.#draw();
      clearTimeout(this.#winkTimer);
      this.#winkTimer = setTimeout(() => {
        this.#motion.winking = false;
        this.#draw();
      }, STILL_WINK_MS);
    } else {
      pokeMotion(this.#motion);
    }
    this.dispatchEvent(new CustomEvent('mascot-poke', { bubbles: true, composed: true }));
  }

  /** Look at a point in client coordinates, overriding every other input. */
  lookAt(clientX: number, clientY: number): void {
    this.#look.lookAt(clientX, clientY);
  }

  /** Release `lookAt`. */
  lookAway(): void {
    this.#look.lookAway();
  }

  /** Set several options at once. Null, undefined and false clear an option. */
  configure(options: ConfigureOptions): void {
    for (const [key, value] of Object.entries(options ?? {})) {
      if (key === 'trackElement' || Object.hasOwn(PROPS, key)) (this as Record<string, unknown>)[key] = value;
    }
  }

  /** Ask for device orientation. Call from a click handler; iOS requires a user gesture. */
  enableGyro(): Promise<GyroState> {
    return this.#look.enableGyro();
  }

  /** Frameworks can set properties before the element upgrades; route those through the setters. */
  #adoptEarlyProperties(): void {
    for (const name of [...Object.keys(PROPS), 'trackElement'] as (keyof this)[]) {
      if (!Object.hasOwn(this, name)) continue;
      const value = this[name];
      delete this[name];
      this[name] = value;
    }
  }

  #shapeDefinition() {
    return getShape(this.shape) ?? fallbackShape;
  }

  #config(): MascotConfig {
    const shape = this.#shapeDefinition();
    const material = this.material;
    return {
      shape,
      material,
      bodyWidth: this.bodyWidth,
      bodyHeight: this.bodyHeight,
      softness: this.softness,
      accessories: resolveAccessories(this.getAttribute('accessories'), shape, material),
      eyeShape: this.eyeShape,
      eyeWidth: this.eyeWidth,
      eyeHeight: this.eyeHeight,
      eyeSpacing: this.eyeSpacing,
      eyeY: this.eyeY,
      shadow: this.shadow !== 'none',
    };
  }

  #view(): MascotView {
    const config = this.#config();
    return { config, geometry: computeGeometry(config) };
  }

  #schedule(kind: 'layout' | 'structure'): void {
    const idle = this.#dirty == null;
    if (kind === 'structure' || idle) this.#dirty = kind;
    if (idle) queueMicrotask(() => this.#flush());
  }

  #flush(): void {
    const dirty = this.#dirty;
    this.#dirty = null;
    const renderer = this.#renderer;
    if (!dirty || !renderer) return;
    if (dirty === 'structure') {
      this.#build(renderer);
      this.#syncInput();
      // A rebuild leaves the eyes unposed, and this frame's tick may have already run.
      if (this.#running) this.#paint(NO_STEP);
    } else if (this.#visible) {
      const view = this.#view();
      this.#geometry = view.geometry;
      renderer.layout(view);
    } else {
      this.#parked = true;
      return;
    }
    this.#settle();
  }

  /** Follow the rendered width. A swap keeps every bit of motion state: it lives on the element. */
  #pickDetail(): void {
    const width = this.#width;
    const current = this.#renderer;
    const level = pickLevel(this.detail, width, current?.level ?? null);
    if (level && level !== current?.level && this.#tile) {
      current?.destroy();
      const renderer = level === 'full' ? createFullRenderer() : createSimpleRenderer();
      this.#renderer = renderer;
      this.#fx = renderer.fx && createFx(renderer.fx);
      this.#tile.setAttribute('data-detail', level);
      renderer.resize?.(width);
      renderer.mount(this.#tile);
      this.#build(renderer);
      this.#dirty = null;
      // Size callbacks run after this frame's tick, so pose it now or it paints blank.
      if (this.#running) this.#paint(0);
      else this.#settle();
      return;
    }
    current?.resize?.(width);
  }

  #build(renderer: Renderer): void {
    const view = this.#view();
    this.#builtFrom = structureKey(view.config);
    this.#builtShape = view.config.shape;
    this.#geometry = view.geometry;
    this.#parked = false;
    this.#tile?.setAttribute('data-material', view.config.material);
    renderer.build(view);
  }

  /** Colours, sky and eye colour. CSS only: this never touches the SVG. */
  #syncPaint(): void {
    const tile = this.#tile;
    if (!tile) return;
    const { style } = tile;
    style.setProperty('--_c', this.color);
    style.setProperty('--_a', this.accent);

    const eye = this.eyeColor;
    tile.toggleAttribute('data-eye', eye != null);
    style.setProperty('--_e', eye ?? '');

    const [sky, top, bottom] = parseSky(this.sky);
    tile.toggleAttribute('data-sky', sky !== 'none');
    if (sky !== 'none') tile.setAttribute('data-sky', sky);
    // An empty value removes the property.
    style.setProperty('--_s', top ?? '');
    style.setProperty('--_s2', bottom ?? '');
  }

  /** A custom property, not `width`: inline styles belong to the consumer. */
  #syncSize(): void {
    const size = this.size;
    this.style.setProperty('--_w', size == null ? '' : `${size}px`);
  }

  /** A mood change only ever updates the default name, never an explicit one. */
  #syncLabel(moodOnly = false): void {
    const mood = this.mood;
    this.#tile?.setAttribute('data-mood', mood);
    const current = this.getAttribute('aria-label');
    // A clone copies the attribute but not `#named`, so the default is told by its form.
    const ours = current == null || current === this.#named || AUTO_LABEL.test(current);
    const label = this.label?.trim() ? this.label : null;
    if (label == null && DECORATIVE.test(this.getAttribute('role') ?? '')) {
      if (ours) this.removeAttribute('aria-label');
    } else if (ours || (label != null && !moodOnly)) {
      this.setAttribute('aria-label', (this.#named = label ?? `Assistant, ${mood}`));
    }
  }

  /** Start or stop the frame loop to match visibility and the motion preference. */
  #sync(): void {
    this.#input.still = prefersReducedMotion();
    const run = this.#connected && this.#visible && !this.#input.still;
    if (run && !this.#running) {
      // Whatever changed off-screen lands at once, rather than easing in on arrival.
      this.#settle();
      this.#running = true;
      addTick(this.#tick);
    } else if (!run) {
      this.#stop();
      this.#settle();
    }
  }

  #stop(): void {
    if (!this.#running) return;
    this.#running = false;
    removeTick(this.#tick);
  }

  /** Parse the motion attributes. Runs when they change, so frames never read the DOM. */
  #syncInput(): void {
    const input = this.#input;
    const { channels } = input;
    input.mood = this.mood;
    channels.motion = this.motion;
    channels.float = this.float;
    channels.blink = this.blink;
    channels.glance = this.glance;
    channels.bounce = this.bounce;
    channels.gaze = this.gaze;
    input.level = this.level;
    input.floatScale = this.#shapeDefinition().floatScale;
  }

  #tick = (dt: number): void => {
    const input = this.#input;
    input.look = this.#look.read(performance.now());
    stepMotion(this.#motion, dt, input);
    this.#paint(dt);
  };

  #paint(dt: number): void {
    const motion = this.#motion;
    this.#renderer?.frame(writePose(motion, this.#input), motion.clock);
    if (this.#geometry) this.#fx?.frame(motion, this.#geometry, dt);
  }

  /** Redraw at rest when the loop is not running; otherwise the next frame picks the change up. */
  #settle(): void {
    if (this.#running || !this.#renderer) return;
    const input = this.#input;
    input.look = this.#look.read(performance.now());
    settleMotion(this.#motion, input);
    this.#paint(0);
  }

  /** For changes that can wait: off-screen they cost nothing, and waking applies them. */
  #draw(): void {
    if (this.#visible) this.#settle();
  }

  /** A late import may be what this mascot was waiting for. Others stay untouched. */
  #onRegistered(): void {
    if (this.#root) applyStyles(this.#root);
    this.#rebuildIfStale();
  }

  #rebuildIfStale(): void {
    const config = this.#config();
    if (this.#renderer && (config.shape !== this.#builtShape || structureKey(config) !== this.#builtFrom)) {
      this.#schedule('structure');
    }
  }

  #onClick = (): void => this.poke();

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this || !this.hasAttribute('tabindex')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) this.poke();
  };
}

// The accessors are defined below from the PROPS table, so the class cannot declare them.
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export interface AgentMascot extends MascotProps {}

for (const [name, spec] of Object.entries(PROPS)) {
  if (name === 'accessories') continue;
  Object.defineProperty(AgentMascot.prototype, name, {
    configurable: true,
    enumerable: true,
    get(this: AgentMascot) {
      return spec.read(this.getAttribute(spec.attr));
    },
    set(this: AgentMascot, value: unknown) {
      reflect(this, spec.attr, value);
    },
  });
}

/** Register the element. Safe to call more than once, and a no-op outside a browser. */
export function defineAgentMascot(): void {
  if (typeof customElements !== 'undefined' && !customElements.get(TAG)) {
    customElements.define(TAG, AgentMascot);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'agent-mascot': AgentMascot;
  }
  interface HTMLElementEventMap {
    'mascot-poke': CustomEvent<null>;
    'mascot-gyro': CustomEvent<{ state: GyroState }>;
  }
}
