import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dist = join(root, 'dist');

const url = (file: string) => JSON.stringify(new URL(`file://${join(dist, file)}`).href);

const entries = () => [
  'index.js',
  'core.js',
  'cdn.js',
  ...readdirSync(join(dist, 'shapes')).filter((f) => f.endsWith('.js')).map((f) => `shapes/${f}`),
  ...readdirSync(join(dist, 'accessories')).filter((f) => f.endsWith('.js')).map((f) => `accessories/${f}`),
];

/** Runs in a clean Node process: Vitest's own environment must not hide a missing global. */
function importInNode(file: string): string {
  const script = `
    for (const name of ['HTMLElement', 'window', 'document', 'customElements']) {
      if (name in globalThis) throw new Error('Node has ' + name);
    }
    const module = await import(${url(file)});
    console.log(Object.keys(module).length);
  `;
  return execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' });
}

describe('importing in Node', () => {
  it('needs a build', () => {
    expect(existsSync(join(dist, 'index.js')), 'run bun run build first').toBe(true);
  });

  it('covers the expected entry points', () => {
    expect(entries()).toHaveLength(3 + 16 + 24);
  });

  it.each(entries())('does not throw for %s', (file) => {
    expect(() => importInNode(file)).not.toThrow();
  });

  it('exports the public API from the main entry', async () => {
    const api = await import(join(dist, 'index.js'));
    expect(Object.keys(api).toSorted()).toEqual(
      [
        'AgentMascot',
        'MASCOT_ACCESSORIES',
        'MASCOT_EYE_SHAPES',
        'MASCOT_MATERIALS',
        'MASCOT_MOODS',
        'MASCOT_SHAPES',
        'defineAgentMascot',
        'registerShape',
      ].toSorted(),
    );
  });

  it('keeps core free of shapes and accessories, and shares one registry with their modules', () => {
    const script = `
      const core = await import(${url('core.js')});
      const { getAccessory, getShape } = await import(${url('registry.js')});
      const before = [getShape('orb'), getAccessory('ears'), getShape('blob')?.name];
      await import(${url('shapes/orb.js')});
      await import(${url('accessories/ears.js')});
      console.log(JSON.stringify({
        before,
        orb: getShape('orb')?.name,
        ears: Boolean(getAccessory('ears')),
        api: typeof core.registerShape,
      }));
    `;
    const output = execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' });
    expect(JSON.parse(output)).toEqual({
      before: [null, null, 'blob'],
      orb: 'orb',
      ears: true,
      api: 'function',
    });
  });

  it('declares every self-registering module as a side effect', async () => {
    const { default: pkg } = await import(join(root, 'package.json'), { with: { type: 'json' } });
    expect(pkg.sideEffects).toEqual(
      expect.arrayContaining(['./dist/shapes/*.js', './dist/accessories/*.js', './dist/index.js', './dist/core.js']),
    );
  });
});
