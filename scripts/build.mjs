// Builds dist/: one ESM file per source module, so the package tree-shakes well and
// every self-registering entry shares one registry, plus a minified single file for CDNs.
// Then generates custom-elements.json. dist/ only changes once the whole build has passed.
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { rolldown } from 'rolldown';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const staging = join(root, `.dist-${process.pid}`);
const retiring = join(root, `.dist-old-${process.pid}`);

/**
 * Internal property names, which no consumer can see, renamed in dist/ to save bytes. They
 * never occur as strings, and capitals can't collide with the short names the code keeps.
 */
const INTERNAL = `
  bodyTransform viewSize viewX viewY shadowScale shadowOpacity shineX shineY floatPhase hopPhase
  nextGlance nextBlink blinkAt glanceX glanceY winkAt winking nextShake squish simplePath simpleFace
  floatScale smooth morph ground half hh goo nodes weight spec stagger
  place paint layer channels lookX lookY shake voice droop clock pose blend breath wonk sway sink
  lean rate speed arc tilt dwell aloof echo still phase layout build animate frame mount destroy
  resize fx live onState onTilt movedAt followers stop move leave bind unbind setVisible
  reach above below css merge inside gloss solid silhouette config geometry
  look source turn tall count group root shift hop
`.trim().split(/\s+/);
/** The commonest names get the single letters. */
function shortNames(sources) {
  const uses = (name) => sources.split(`.${name}`).length;
  const ranked = INTERNAL.toSorted((a, b) => uses(b) - uses(a));
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Object.fromEntries(
    ranked.map((name, i) => [name, (letters[Math.floor(i / 26) - 1] ?? '') + letters[i % 26]]),
  );
}

const mangleProps = new RegExp(`^(?:${INTERNAL.join('|')})$`);

/** Minify the CSS in String.raw templates, which is the only place the source keeps CSS. */
async function minifyCss(source) {
  let out = '';
  let last = 0;
  for (const match of source.matchAll(/String\.raw`([^`]*)`/g)) {
    const { code } = await transform(match[1], { loader: 'css', minify: true, logLevel: 'silent' });
    // esbuild keeps spaces inside custom property values; these two are safe to drop.
    const css = code.trim().replace(/(--[\w-]+): /g, '$1:').replace(/\s*,\s*/g, ',');
    out += source.slice(last, match.index) + JSON.stringify(css);
    last = match.index + match[0].length;
  }
  return out + source.slice(last);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) yield path;
  }
}

async function compile() {
  const files = [];
  for await (const file of walk(src)) files.push(file);
  const texts = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  const mangleCache = shortNames(texts.join(''));
  for (const [i, file] of files.entries()) {
    const source = await minifyCss(texts[i]);
    const { code } = await transform(source, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
      minifySyntax: true,
      legalComments: 'none',
      mangleProps,
      mangleCache,
    });
    const out = join(staging, relative(src, file)).replace(/\.ts$/, '.js');
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, code);
  }

  // The bundler would otherwise apply the root `sideEffects` list, written for dist/, to the
  // staging folder and drop every shape and accessory.
  const scope = join(staging, 'package.json');
  await writeFile(scope, '{"sideEffects":true}');
  const bundle = await rolldown({
    input: join(staging, 'cdn.js'),
    transform: { define: { __DEV__: 'false' } },
    treeshake: { manualPureFunctions: ['warnOnce'] },
    logLevel: 'silent',
  });
  const { output } = await bundle.generate({ format: 'es', minify: true, legalComments: 'none' });
  await bundle.close();
  await writeFile(join(staging, 'cdn.js'), output[0].code);
  await rm(scope);

  execFileSync(
    join(root, 'node_modules/.bin/tsc'),
    ['-p', 'tsconfig.build.json', '--outDir', relative(root, staging)],
    { cwd: root, stdio: 'inherit' },
  );

  // Hand-written because the compiler drops the `@ts-ignore` comments it depends on.
  // The empty module lets `import '@comfycomputer/agent-mascots/jsx'` survive a bundler or Node.
  await copyFile(join(src, 'jsx.d.ts'), join(staging, 'jsx.d.ts'));
  await writeFile(join(staging, 'jsx.js'), 'export {};\n');
}

try {
  await compile();
  // Other processes may be reading dist/, so keep the window without one to two renames.
  await rename(dist, retiring).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await rename(staging, dist);
} finally {
  await rm(staging, { recursive: true, force: true });
  await rm(retiring, { recursive: true, force: true });
}

execFileSync(join(root, 'node_modules/.bin/cem'), ['analyze', '--quiet'], {
  cwd: root,
  stdio: 'inherit',
});
