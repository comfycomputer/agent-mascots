/**
 * The internal contract between the element, the renderers, the motion system
 * and the tracking system. Everything crossing a module boundary is typed here,
 * so the pieces can evolve independently.
 *
 * Coordinates are in the 240 x 240 design space with the body centred on x = 120.
 */

export type MaterialName = 'glow' | 'frost' | 'glass';
export type EyeShapeName = 'auto' | 'pill' | 'round' | 'square' | 'dot' | 'oval' | 'slit' | 'bar' | 'big';
export type MoodName =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'success'
  | 'error'
  | 'listening'
  | 'speaking'
  | 'waiting'
  | 'sleeping';
export type BuiltinShapeName =
  | 'blob'
  | 'orb'
  | 'egg'
  | 'squircle'
  | 'flame'
  | 'cloud'
  | 'bell'
  | 'ghost'
  | 'cap'
  | 'gem'
  | 'bean'
  | 'drop'
  | 'star'
  | 'heart'
  | 'mochi'
  | 'cat';
export type BuiltinAccessoryName =
  | 'antenna'
  | 'stalk'
  | 'ears'
  | 'arms'
  | 'ring'
  | 'leaf'
  | 'rays'
  | 'spots'
  | 'stem'
  | 'tentacles'
  | 'facets'
  | 'blush'
  | 'sheen'
  | 'iridescent'
  | 'bubbles'
  | 'outline'
  | 'horns'
  | 'halo'
  | 'crown'
  | 'bow'
  | 'wings'
  | 'tail'
  | 'whiskers'
  | 'glasses';
export type DetailSetting = 'auto' | 'full' | 'simple';
export type DetailLevel = 'full' | 'simple';
export type GyroState = 'granted' | 'denied' | 'unsupported';

/* ---------- shapes ---------- */

export interface EyeMetrics {
  /** Vertical centre of the eyes. */
  y: number;
  /** Eye width and height at multiplier 1. */
  w: number;
  h: number;
  /** Distance from the centre line to each eye's centre. */
  gap: number;
  /** Use square eyes when `eye-shape` is `auto`. */
  square?: boolean;
}

/** Eye centre y, eye gap and mouth centre y on a hand-tuned simple silhouette. */
export type SimpleFace = readonly [eyeY: number, gap: number, mouthY: number];

/** Shine ellipse: cx, cy, rx, ry. */
export type ShineSpot = readonly [number, number, number, number];

/** What `registerShape` accepts. */
export interface ShapeOptions {
  /** SVG path data in the 240 x 240 design space, centred on x = 120. */
  path: string;
  eyes: EyeMetrics;
  /** Silhouette extents; used to attach accessories and stretch the body. */
  top?: number;
  bottom?: number;
  halfWidth?: number;
  shine?: ShineSpot;
  /** Default accessories, space-separated or as a list. */
  accessories?: string | readonly string[];
}

/** Options only the built-in shape modules use. */
export interface BuiltinShapeOptions extends ShapeOptions {
  /** The outline has no corners or joins, so the goo filter would change nothing. */
  smooth?: boolean;
  /** Multiplier on the float amplitude. */
  floatScale?: number;
  /** Animated outline. `phase` is in radians; `amount` scales the deformation. */
  morph?: (phase: number, amount: number) => string;
  /** Hand-tuned silhouette for the simple detail level. */
  simplePath?: string;
  /** Face on `simplePath`: eye centre y, eye gap and mouth centre y. */
  simpleFace?: SimpleFace;
}

/** A shape after validation, with all defaults applied. */
export interface ShapeDefinition {
  name: string;
  path: string;
  eyes: Readonly<EyeMetrics>;
  top: number;
  bottom: number;
  halfWidth: number;
  shine: ShineSpot;
  accessories: readonly string[];
  smooth: boolean;
  floatScale: number;
  morph?: (phase: number, amount: number) => string;
  simplePath?: string;
  simpleFace?: SimpleFace;
}

/* ---------- configuration and geometry ---------- */

/** Everything the renderers need from the attributes, resolved and clamped. */
export interface MascotConfig {
  shape: ShapeDefinition;
  material: MaterialName;
  bodyWidth: number;
  bodyHeight: number;
  softness: number;
  accessories: readonly string[];
  eyeShape: EyeShapeName;
  eyeWidth: number;
  eyeHeight: number;
  eyeSpacing: number;
  eyeY: number;
  shadow: boolean;
}

/** Resolved eye dimensions. */
export interface EyeBox {
  w: number;
  h: number;
  r: number;
  gap: number;
}

/** Layout derived from the config. Pure numbers, cheap to recompute on a slider tick. */
export interface Geometry {
  /** Stretched silhouette extents. */
  top: number;
  bottom: number;
  half: number;
  left: number;
  right: number;
  /** Vertical centre and half height of the stretched body. */
  cy: number;
  hh: number;
  /** Lowest point of the mascot; `body-height` stretches up from `bottom`. */
  ground: number;
  /** SVG transform that stretches the raw shape path. */
  bodyTransform: string;
  /** viewBox: origin y and side length. Grows when accessories need the room. */
  viewX: number;
  viewY: number;
  viewSize: number;
  eyeY: number;
  eyes: EyeBox;
  /** Goo filter blur radius, from `softness`. */
  goo: number;
  /** The raw shape path, for anything that follows the body at a distance. */
  outline: string;
}

/* ---------- motion to renderer ---------- */

export interface EyePose {
  /** 0 closed, 1 open; above 1 is wide open. */
  open: number;
  /** Bend: 1 is a happy arch, -1 a sad droop. */
  arc: number;
  /** Rotation in degrees; the eyes mirror each other. */
  tilt: number;
}

/** One frame of output from the motion system. All units are design units unless noted. */
export interface Pose {
  x: number;
  y: number;
  /** Degrees, around the body centre. */
  rotate: number;
  /** Squash, around the ground. */
  scaleX: number;
  scaleY: number;
  /** Eye parallax relative to the body. */
  eyeX: number;
  eyeY: number;
  /** Shine parallax, opposite to the eyes. */
  shineX: number;
  shineY: number;
  left: EyePose;
  right: EyePose;
  /** Ground shadow, responding to lift. */
  shadowScale: number;
  shadowOpacity: number;
}

/** Per-frame facts for accessories and FX. */
export interface FrameClock {
  /** Seconds since the mascot started; freezes while reduced motion is on. */
  t: number;
  mood: MoodName;
  /**
   * Accumulated animation time for accessories. It runs faster when busy and
   * slower when asleep, and is integrated, so a mood change never jumps it.
   */
  phase: number;
  /** Reduced motion: draw a still pose. */
  still: boolean;
  /** Master motion dial, 0 to 2. */
  motion: number;
  /** How deflated the mood is, 0 to 1 and eased; accessories wilt with it. */
  droop: number;
  /** Speech loudness, 0 to 1 and eased; the simple level draws it as a mouth. */
  voice: number;
}

/* ---------- renderers ---------- */

export interface MascotView {
  config: MascotConfig;
  geometry: Geometry;
}

/** FX slots that the motion system draws particles into. */
export interface FxLayers {
  /** Behind the body and moving with it, in stage coordinates. */
  back: SVGGElement;
  /** In front of the body, in stage coordinates. */
  front: SVGGElement;
  /** On the body, moving with the eyes; the origin is the centre between them. */
  face: SVGGElement;
}

/**
 * A detail level. The element owns one renderer at a time and swaps them when
 * the detail level changes. Motion state lives outside, so a swap or a rebuild
 * never loses animation state.
 */
export interface Renderer {
  readonly level: DetailLevel;
  /** Attach to the tile. Called once, before `build`. */
  mount(tile: HTMLElement): void;
  /** Rebuild for a new shape, material or accessory set. Implies `layout`. */
  build(view: MascotView): void;
  /** Patch attributes after a numeric change. Must not create or remove nodes. */
  layout(view: MascotView): void;
  /** Apply one frame. Only touches the DOM for values that changed. */
  frame(pose: Pose, clock: FrameClock): void;
  /** The rendered width changed. Levels that tune for pixels implement this. */
  resize?(width: number): void;
  /** Detach and release everything. */
  destroy(): void;
  /** Where particles go; null if the level draws none. */
  readonly fx: FxLayers | null;
}

/* ---------- accessories ---------- */

/** Slots an accessory can draw into, ordered back to front. */
export interface AccessorySlots {
  /** Behind the body. May animate: this layer has no filters. */
  back: SVGElement;
  /** Melted into the silhouette by the goo filter. Static shapes only. */
  merge: SVGElement;
  /** Painted on the body, masked to the exact silhouette. Static: this layer holds the filters. */
  inside: SVGElement;
  /** On the body, masked to the exact silhouette. May animate. */
  gloss: SVGElement;
  /** In front of the body. May animate. */
  front: SVGElement;
  /** Moves with the eyes. */
  face: SVGElement;
  /** Gradients and other definitions. */
  defs: SVGElement;
  /** Id of the final silhouette, joins melted, for `<use>`. */
  solid: string;
  config: MascotConfig;
}

export interface AccessoryInstance {
  /** Position everything for this geometry. Called after build and on numeric changes. */
  layout(geometry: Geometry): void;
  /** Per-frame animation; absent for static accessories. */
  animate?(clock: FrameClock, geometry: Geometry): void;
}

export interface AccessoryDefinition {
  /** Headroom needed above the body top. */
  above?: number;
  /** Extra height below the body bottom; the ground moves down by this much. */
  below?: number;
  /** Sideways reach beyond the body, as a multiple of its half width. */
  reach?: number;
  /** Styles for this accessory. Shipped with it, so core stays small. */
  css?: string;
  build(slots: AccessorySlots): AccessoryInstance;
}

/* ---------- tracking ---------- */

export type LookSourceKind = 'api' | 'pointer' | 'gyro';

/** Where the mascot should look, normalised to -1..1 on each axis. */
export interface LookTarget {
  x: number;
  y: number;
  source: LookSourceKind;
}

/** What the tracker reads from the element. */
export interface LookHost extends HTMLElement {
  readonly track: string;
  readonly trackReach: number;
  readonly trackElement: Element | null;
  readonly gyro: boolean;
}

/**
 * Answers "where should the eyes go?", arbitrating between inputs. Returns null
 * when no input is active, which hands control to the mood or idle wander.
 */
export interface LookSource {
  /** The winning target right now. `now` is in milliseconds. */
  read(now: number): LookTarget | null;
  /** Bind listeners for the current `track`. Safe to call again after it changes. */
  bind(): void;
  unbind(): void;
  /** Whether the mascot is on screen. Input listeners only run while it is. */
  setVisible(visible: boolean): void;
  /** `lookAt()` from the public API. */
  lookAt(clientX: number, clientY: number): void;
  /** `lookAway()` from the public API. */
  lookAway(): void;
  /** Shared by `enableGyro()` and the `gyro` attribute. Idempotent. */
  enableGyro(): Promise<GyroState>;
}
