// The library's attributes, from its own manifest (scripts/site-metrics.mjs writes the JSON).

import list from '../../attributes.json';

export type Attribute =
  | { name: string; kind: 'enum' | 'list'; values: string[]; default?: string | number }
  | { name: string; kind: 'number'; min: number; max: number; default?: number }
  | { name: string; kind: 'color' | 'sky' | 'text' | 'boolean'; default?: string | number | boolean };

export const ATTRIBUTE_LIST = list as Attribute[];
export const ATTRIBUTES = new Map(ATTRIBUTE_LIST.map((entry) => [entry.name, entry]));

/** An attribute that must exist, of the kind the caller needs. */
export function attribute<K extends Attribute['kind']>(name: string, kind: K): Extract<Attribute, { kind: K }> {
  const found = ATTRIBUTES.get(name);
  if (found?.kind !== kind) throw new Error(`No ${kind} attribute called ${name}`);
  return found as Extract<Attribute, { kind: K }>;
}

/** The values an enum or a list attribute takes. */
export function valuesOf(name: string): string[] {
  const found = ATTRIBUTES.get(name);
  if (found?.kind !== 'enum' && found?.kind !== 'list') throw new Error(`No enum or list attribute called ${name}`);
  return found.values;
}
