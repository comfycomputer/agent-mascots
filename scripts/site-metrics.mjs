// Generates site/metrics.json and site/attributes.json from this repo, so no number on the site
// is typed by hand. Reads dist/ and custom-elements.json, so `bun run build` must run first.
import { execFileSync } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n) => {
  const text = NUMBER_WORDS[n] ?? String(n);
  return text[0].toUpperCase() + text.slice(1);
};

/** 17,150 B is 17.2 kB, as size-limit reports it. `toFixed` would see 17.149999 and say 17.1. */
const kilobytes = (bytes) => (Math.round(bytes / 100) / 10).toFixed(1);

/** The site's own bounds, where the library has none. Share links clamp to these. */
const SITE_RANGES = { size: [16, 420] };

const COLOURS = new Set(['color', 'accent', 'eye-color']);

function group(name) {
  if (name.startsWith('eye-')) return 'Eyes';
  if (['shape', 'material', 'color', 'accent', 'body-width', 'body-height', 'softness', 'accessories'].includes(name)) return 'Body';
  if (['sky', 'shadow', 'size', 'detail'].includes(name)) return 'Backdrop';
  return 'Behaviour';
}

/** One attribute of the manifest, as much as a control or an allowlist needs. */
function describe(attribute, arrays) {
  const { name, type, description = '' } = attribute;
  const text = type?.text ?? 'string';
  const parsedDefault = attribute.default === undefined ? undefined : JSON.parse(attribute.default);
  const base = { name, group: group(name), default: parsedDefault };

  const values = arrays[name] ?? text.match(/'[^']+'/g)?.map((value) => value.slice(1, -1));
  if (name === 'accessories') return { ...base, kind: 'list', values };
  if (name === 'track') return { ...base, kind: 'enum', values: ['self', 'window', 'none'] };
  if (name === 'sky') return { ...base, kind: 'sky' };
  if (values) return { ...base, kind: 'enum', values };
  if (COLOURS.has(name)) return { ...base, kind: 'color' };
  if (text.includes('boolean')) return { ...base, kind: 'boolean' };
  if (text.includes('number')) {
    const range = description.match(/(-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?)/)?.slice(1).map(Number) ?? SITE_RANGES[name];
    if (!range) throw new Error(`No range for the numeric attribute "${name}"`);
    return { ...base, kind: 'number', min: range[0], max: range[1] };
  }
  return { ...base, kind: 'text' };
}

const pkg = await readJson('package.json');
const library = await import(pathToFileURL(join(root, 'dist/index.js')).href);
const manifest = await readJson('custom-elements.json');

const sizes = JSON.parse(execFileSync(join(root, 'node_modules/.bin/size-limit'), ['--json'], { cwd: root, encoding: 'utf8' }));
const bytes = (name) => {
  const entry = sizes.find((row) => row.name === name);
  if (!entry) throw new Error(`size-limit has no entry named "${name}"`);
  return entry.size;
};

const lists = {
  moods: [...library.MASCOT_MOODS],
  shapes: [...library.MASCOT_SHAPES],
  materials: [...library.MASCOT_MATERIALS],
  accessories: [...library.MASCOT_ACCESSORIES],
  eyeShapes: [...library.MASCOT_EYE_SHAPES],
};
const counts = Object.fromEntries(Object.entries(lists).map(([key, list]) => [key, list.length]));
const sized = { full: bytes('agent-mascots (full)'), core: bytes('agent-mascots/core'), cdn: bytes('agent-mascots/cdn') };

const metrics = {
  version: pkg.version,
  license: pkg.license,
  dependencies: Object.keys(pkg.dependencies ?? {}).length,
  bytes: sized,
  kB: Object.fromEntries(Object.entries(sized).map(([key, value]) => [key, kilobytes(value)])),
  counts,
  words: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, word(value)])),
  ...lists,
};

const element = manifest.modules.flatMap((module) => module.declarations ?? []).find((declaration) => declaration.attributes);
const arrays = { shape: lists.shapes, material: lists.materials, mood: lists.moods, 'eye-shape': lists.eyeShapes, accessories: lists.accessories };
const attributes = element.attributes.map((attribute) => describe(attribute, arrays));

/** Write then rename, so a server reading the file never sees half of it. */
async function publish(path, value) {
  const staging = join(root, `${path}.${process.pid}.tmp`);
  await writeFile(staging, `${JSON.stringify(value, null, 2)}\n`);
  await rename(staging, join(root, path));
}

await publish('site/metrics.json', metrics);
await publish('site/attributes.json', attributes);
