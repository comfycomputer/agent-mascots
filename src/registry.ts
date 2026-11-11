import { FALLBACK_BODY } from './fallback-body.js';
import { isValidPath } from './path.js';
import type {
  AccessoryDefinition,
  BuiltinShapeOptions,
  ShapeDefinition,
  ShapeOptions,
  ShineSpot,
} from './types.js';

const shapes = new Map<string, ShapeDefinition>();
const accessories = new Map<string, AccessoryDefinition>();
const accessoryStyles = new Set<string>();
const listeners = new Set<() => void>();

const NAME = /^[a-z][a-z0-9-]*$/i;

/** Split a space-separated list, or pass an array through. */
export function parseList(value: string | readonly string[] | undefined | null): string[] {
  if (value == null) return [];
  return typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [...value];
}

function fail(what: string): never {
  throw new TypeError(`invalid shape ${what}`);
}

function finite(value: unknown, label: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) fail(label);
  return value as number;
}

function normalizeShape(name: string, options: BuiltinShapeOptions): ShapeDefinition {
  if (typeof name !== 'string' || !NAME.test(name)) fail(`name "${name}"`);
  // Read once: a getter could otherwise pass validation and then return something else.
  const path = options?.path;
  const simplePath = options?.simplePath;
  if (!isValidPath(path) || (simplePath != null && !isValidPath(simplePath))) fail(`path in "${name}"`);
  const eyes = options.eyes;
  if (!eyes) fail('eyes');
  finite(eyes.y, 'eyes.y');
  finite(eyes.w, 'eyes.w', true);
  finite(eyes.h, 'eyes.h', true);
  finite(eyes.gap, 'eyes.gap', true);

  const top = finite(options.top ?? 60, 'top');
  const bottom = finite(options.bottom ?? 180, 'bottom');
  if (bottom <= top) fail('top and bottom');
  const halfWidth = finite(options.halfWidth ?? 60, 'halfWidth');
  const [cx, cy, rx, ry] = options.shine ?? [
    120 - halfWidth * 0.3,
    top + (bottom - top) * 0.2,
    22,
    9,
  ];
  const shine = [cx, cy, rx, ry].map((n) => finite(n, 'shine')) as unknown as ShineSpot;

  const shape: ShapeDefinition = {
    name,
    path,
    eyes: { ...eyes },
    top,
    bottom,
    halfWidth,
    shine,
    accessories: parseList(options.accessories),
    smooth: options.smooth ?? false,
    floatScale: options.floatScale ?? 1,
  };
  if (options.morph) shape.morph = options.morph;
  if (simplePath != null) shape.simplePath = simplePath;
  if (options.simpleFace) shape.simpleFace = options.simpleFace;
  return shape;
}

/** The body drawn when no registered shape matches. Part of core. */
export const fallbackShape: ShapeDefinition = normalizeShape('blob', FALLBACK_BODY);

/** Register a built-in shape. These may also set the options kept from the public API. */
export function defineShape(name: string, options: BuiltinShapeOptions): void {
  shapes.set(name, normalizeShape(name, options));
  notify();
}

/**
 * Register a shape. Throws a TypeError on invalid input, so a bad path fails
 * loudly at the call site rather than as an invisible mascot.
 */
export function registerShape(name: string, options: ShapeOptions): void {
  const { path, eyes, top, bottom, halfWidth, shine, accessories: extras } = options ?? {};
  defineShape(name, { path, eyes, top, bottom, halfWidth, shine, accessories: extras } as ShapeOptions);
}

export function getShape(name: string): ShapeDefinition | undefined {
  return shapes.get(name) ?? (name === fallbackShape.name ? fallbackShape : undefined);
}

export function registerAccessory(name: string, definition: AccessoryDefinition): void {
  accessories.set(name, definition);
  if (definition.css) accessoryStyles.add(definition.css);
  notify();
}

/** CSS of every registered accessory. */
export function registeredCss(): string {
  return [...accessoryStyles].join('');
}

export function getAccessory(name: string): AccessoryDefinition | undefined {
  return accessories.get(name);
}

/**
 * Run `listener` when something is registered, so a mascot waiting on a
 * dynamically imported shape redraws once it arrives. Returns the unsubscriber.
 */
export function onRegistryChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}
