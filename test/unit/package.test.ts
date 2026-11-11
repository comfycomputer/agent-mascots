import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import { scriptSrc } from '../../site/config.ts';
import { alias } from '../../site/vite.config.ts';
import { PROPS } from '../../src/attrs.js';
import { MASCOT_ACCESSORIES, MASCOT_SHAPES } from '../../src/constants.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dist = join(root, 'dist');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  exports: Record<string, string | { types: string; default: string }>;
  customElements: string;
};

const names = (entries: { name: string }[]) => entries.map(({ name }) => name).toSorted();

function published(dir: string, extension: string): string[] {
  return readdirSync(join(dist, dir))
    .filter((file) => file.endsWith(extension))
    .map((file) => file.slice(0, -extension.length))
    .toSorted();
}

const cdn = () => read('dist/cdn.js');

describe('the site', () => {
  it('resolves every kind of package entry, as a consumer would', async () => {
    const entry = [
      "import { MASCOT_SHAPES } from 'agent-mascots';",
      "import { defineAgentMascot } from 'agent-mascots/core';",
      "import 'agent-mascots/shapes/orb';",
      "import 'agent-mascots/accessories/ears';",
      'console.log(MASCOT_SHAPES, defineAgentMascot);',
    ].join('\n');
    const virtual = {
      name: 'entry',
      resolveId: (id: string) => (id === 'entry' ? id : null),
      load: (id: string) => (id === 'entry' ? entry : null),
    };
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [virtual],
      resolve: { alias },
      build: { write: false, rollupOptions: { input: 'entry' } },
    });
    const { output } = (Array.isArray(result) ? result[0] : result) as { output: { code?: string }[] };
    expect(output[0]?.code).toContain('agent-mascot');
  });
});

describe('exports map', () => {
  const targets = Object.entries(pkg.exports).flatMap(([subpath, target]) =>
    typeof target === 'string'
      ? [[subpath, target]]
      : [[subpath, target.types], [subpath, target.default]],
  ) as [string, string][];

  it.each(targets.filter(([, target]) => !target.includes('*')))('%s has %s', (_subpath, target) => {
    expect(existsSync(join(root, target))).toBe(true);
  });

  it('lists the types condition first, as TypeScript requires', () => {
    for (const target of Object.values(pkg.exports)) {
      if (typeof target !== 'string') expect(Object.keys(target)[0]).toBe('types');
    }
  });

  it('has one module and one declaration per public shape and accessory', () => {
    expect(published('shapes', '.js')).toEqual(MASCOT_SHAPES.toSorted());
    expect(published('shapes', '.d.ts')).toEqual(MASCOT_SHAPES.toSorted());
    expect(published('accessories', '.js')).toEqual(MASCOT_ACCESSORIES.toSorted());
    expect(published('accessories', '.d.ts')).toEqual(MASCOT_ACCESSORIES.toSorted());
  });
});

describe('CDN bundle', () => {
  it('is a single file with no imports left', () => {
    expect(cdn()).not.toMatch(/\bimport\s*["'{]|\bfrom\s*["']/);
  });

  // The element falls back to the blob, so a bundle that lost these would still look alive.
  it.each([...MASCOT_SHAPES, ...MASCOT_ACCESSORIES])('registers %s', (name) => {
    expect(cdn()).toMatch(new RegExp(`\\(["'\`]${name}["'\`],`));
  });

  it('has no development warnings', () => {
    expect(cdn()).not.toContain('is not loaded');
  });
});

interface Entry {
  name: string;
  attribute?: string;
  fieldName?: string;
  kind?: string;
  description?: string;
  default?: string;
  type?: { text: string };
}

function manifest() {
  return JSON.parse(read(pkg.customElements)) as {
    modules: {
      path: string;
      declarations: {
        name: string;
        tagName?: string;
        attributes?: Entry[];
        members?: Entry[];
        events?: Entry[];
        cssParts?: Entry[];
        cssProperties?: Entry[];
      }[];
      exports?: { kind: string; name: string; declaration: { module: string } }[];
    }[];
  };
}

function element() {
  const found = manifest()
    .modules.flatMap((module) => module.declarations)
    .find((declaration) => declaration.tagName === 'agent-mascot');
  if (!found) throw new Error('the manifest has no agent-mascot');
  return found;
}

const attributeNamed = (name: string) => element().attributes?.find((entry) => entry.name === name);

describe('custom-elements.json', () => {
  it('points at files that are published', () => {
    for (const module of manifest().modules) {
      expect(existsSync(join(root, module.path)), module.path).toBe(true);
    }
  });

  it('records where the tag is defined', () => {
    const definitions = manifest()
      .modules.flatMap((module) => module.exports ?? [])
      .filter(({ kind }) => kind === 'custom-element-definition');
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.name).toBe('agent-mascot');
    expect(definitions[0]?.declaration.module).toBe('dist/element.js');
  });

  it('documents every attribute and its property', () => {
    const { attributes = [], members = [] } = element();
    expect(attributes.map(({ name }) => name).toSorted()).toEqual(
      Object.values(PROPS)
        .map(({ attr }) => attr)
        .toSorted(),
    );
    for (const attribute of attributes) {
      expect(attribute.description, attribute.name).toBeTruthy();
      expect(attribute.type?.text, attribute.name).toBeTruthy();
    }
    for (const [name, { attr }] of Object.entries(PROPS)) {
      expect(attributes.find((entry) => entry.fieldName === name)?.name).toBe(attr);
      expect(members.find((entry) => entry.name === name)?.attribute).toBe(attr);
    }
  });

  it('documents the rest of the public surface', () => {
    const { members = [], events = [], cssParts = [], cssProperties = [] } = element();
    expect(names(events)).toEqual(['mascot-gyro', 'mascot-poke']);
    expect(names(cssParts)).toEqual(['body', 'eyes', 'tile']);
    expect(names(cssProperties)).toEqual(['--mascot-accent', '--mascot-color', '--mascot-cue', '--mascot-radius']);
    expect(names(members.filter(({ kind }) => kind === 'method'))).toEqual(
      ['configure', 'enableGyro', 'lookAt', 'lookAway', 'poke'],
    );
    expect(names(members)).toContain('trackElement');
    expect(names(members).filter((name) => name.startsWith('#'))).toEqual([]);
  });

  it('records real defaults', () => {
    expect(attributeNamed('shape')?.default).toBe('"blob"');
    expect(attributeNamed('softness')?.default).toBe('0.4');
    expect(attributeNamed('level')?.default).toBeUndefined();
  });
});

describe('the plain HTML sample', () => {
  it('loads the local install until the package is published, then the CDN', () => {
    expect(scriptSrc(false)).toContain('node_modules');
    expect(scriptSrc(true)).toContain('cdn.jsdelivr.net');
  });
});
