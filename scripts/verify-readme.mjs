// Runs every fenced code block in README.md, docs/USAGE.md and docs/API.md, exactly as written,
// against the packed tarball in Chromium, Firefox and WebKit, then checks their facts against the repo.
// It builds nothing into the repo, opens no ports, and needs `bun run build` to have run.
//
//   bun scripts/verify-readme.mjs
//
// A block with no way to be checked fails the run. The CDN URL is served from dist/cdn.js until
// the package is on npm, and `npm install agent-mascots` installs the tarball instead.
// WebKit is skipped with a warning if it can't launch on this machine, unless CI is set.
// oxlint-disable no-console -- this script's output is its report
import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build as esbuild } from 'esbuild';
import { chromium, firefox, webkit } from 'playwright';

/** Where the docs' <source srcset> media lives. Change it with the repository's URL. */
const REPO = 'https://github.com/comfycomputer/agent-mascots';
const MEDIA_BASE = `${REPO}/raw/main/`;
/** The README's badges: CI's own, and shields.io's static ones, which ask no service anything. */
const BADGES = [`${REPO}/actions/workflows/ci.yml`, 'https://img.shields.io/badge/'];
/** The site, deployed by CI to GitHub Pages. */
const SITE = 'https://comfycomputer.github.io/agent-mascots/';
/** The author's GitHub profile, credited in the README. */
const AUTHOR = 'https://github.com/kyleoliveiro';
const local = (url) => (url.startsWith(MEDIA_BASE) ? url.slice(MEDIA_BASE.length) : url);
const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const ORIGIN = 'http://readme.invalid';
const CDN = 'https://cdn.jsdelivr.net/npm/agent-mascots/dist/cdn.js';
const MEDIA_LIMIT = 3_000_000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const results = [];
function record(status, name, detail = '') {
  results.push(status);
  console.log(`${status.padEnd(4)} ${name}${detail ? `: ${detail}` : ''}`);
}

async function check(name, action) {
  try {
    record('PASS', name, (await action()) ?? '');
  } catch (error) {
    record('FAIL', name, String(error.stderr || error.stdout || error.message).trim().slice(0, 600));
  }
}

const shell = (cwd, command, ...args) => run(command, args, { cwd, maxBuffer: 1 << 26 });

/* ---------- reading the documents ---------- */

function codeBlocks(text, file) {
  const blocks = [];
  let heading = '';
  let open = null;
  for (const line of text.split('\n')) {
    if (open) {
      if (line === '```') {
        blocks.push(open);
        open = null;
      } else {
        open.code += `${line}\n`;
      }
    } else if (line.startsWith('```')) {
      open = { lang: line.slice(3), code: '', file, heading };
    } else if (line.startsWith('#')) {
      heading = line.replace(/^#+\s*/, '');
    }
  }
  return blocks;
}

const label = ({ file, heading, lang }) => `${file} > ${heading} [${lang}]`;

/* ---------- a project that installs the tarball ---------- */

async function setUp() {
  const work = await mkdtemp(join(process.env.VERIFY_DIR ?? tmpdir(), 'agent-mascots-readme-'));
  // --ignore-scripts keeps `prepack` from rebuilding dist/ under anything else that's reading it.
  const { stdout } = await shell(root, 'npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', work);
  const [{ filename }] = JSON.parse(stdout.slice(stdout.indexOf('[\n')));
  await writeFile(join(work, 'package.json'), JSON.stringify({ name: 'readme-check', private: true, type: 'module' }));
  await shell(
    work,
    'npm',
    'install',
    '--no-audit',
    '--no-fund',
    `./${filename}`,
    'react@19',
    'react-dom@19',
    'vue@3',
    'svelte@5',
    'vite@8',
    '@vitejs/plugin-react@6',
    '@vitejs/plugin-vue@6',
    '@sveltejs/vite-plugin-svelte',
    'typescript',
    '@types/react@19',
  );
  return work;
}

/* ---------- browsers ---------- */

async function launchAll() {
  const browsers = [];
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    try {
      browsers.push([name, await type.launch()]);
    } catch (error) {
      if (process.env.CI || name !== 'webkit') throw error;
      record('SKIP', 'webkit', 'could not launch on this machine');
    }
  }
  return browsers;
}

/** Load `html`, or a built folder, then run `probe` in the page and return what it says. */
async function inPage(browser, { html, dir, setup, probe }) {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    // Firefox says this about any page that reads orientation, and the gyro sample has to.
    if (/orientation sensor/.test(message.text())) return;
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.href === CDN) return route.fulfill({ contentType: TYPES['.js'], headers: { 'access-control-allow-origin': '*' }, body: await readFile(join(root, 'dist/cdn.js')) });
    if (url.origin !== ORIGIN) return route.abort();
    if (html && url.pathname === '/') return route.fulfill({ contentType: TYPES['.html'], body: html });
    // The stream the wiring sample opens.
    if (url.pathname === '/agent') return route.fulfill({ contentType: 'text/event-stream', body: 'data: tool\n\n' });
    const file = join(dir ?? root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!existsSync(file)) return route.fulfill({ status: 404 });
    return route.fulfill({ contentType: TYPES[extname(file)] ?? 'application/octet-stream', body: await readFile(file) });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => {
    const el = document.querySelector('agent-mascot');
    return el?.shadowRoot?.querySelector('svg');
  });
  await setup?.(page);
  const answer = await page.evaluate(probe);
  await page.close();
  if (problems.length) throw new Error(problems.join('; '));
  return answer;
}

const inEvery = async (browsers, options, expect) => {
  for (const [name, browser] of browsers) {
    const answer = await inPage(browser, options);
    if (!expect(answer)) throw new Error(`${name} said ${JSON.stringify(answer)}`);
  }
  return browsers.map(([name]) => name).join(', ');
};

const rendered = () =>
  [...document.querySelectorAll('agent-mascot')].every(
    (el) => el.shadowRoot?.querySelector('svg') && el.getBoundingClientRect().width > 0,
  );

/* ---------- framework builds ---------- */

const mountPage = '<!doctype html><title>check</title><div id="app"></div><script type="module" src="/src/main.js"></script>';

async function viteBuild(work, name, files, config) {
  const dir = join(work, name);
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(join(dir, 'index.html'), mountPage);
  await writeFile(join(dir, 'vite.config.js'), config);
  for (const [path, body] of Object.entries(files)) await writeFile(join(dir, path), body);
  await shell(dir, join(work, 'node_modules/.bin/vite'), 'build', '--logLevel', 'error', '--base', './');
  return join(dir, 'dist');
}

/** Each framework sample starts in `thinking`, and a click has to reach `success`. */
const pokedMood = {
  setup: (page) => page.locator('agent-mascot').click(),
  probe: () => new Promise((resolve) => {
    setTimeout(() => resolve(document.querySelector('agent-mascot').getAttribute('mood')), 50);
  }),
};

const FRAMEWORKS = {
  jsx: {
    name: 'react',
    config: "import react from '@vitejs/plugin-react';\nexport default { plugins: [react()] };\n",
    files: (code) => ({
      'src/App.jsx': code,
      'src/main.js': "import { createElement } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { Agent } from './App.jsx';\ncreateRoot(document.getElementById('app')).render(createElement(Agent));\n",
    }),
  },
  vue: {
    name: 'vue',
    config: null, // The README's own config block.
    files: (code) => ({
      'src/App.vue': code,
      'src/main.js': "import { createApp } from 'vue';\nimport App from './App.vue';\ncreateApp(App).mount('#app');\n",
    }),
  },
  svelte: {
    name: 'svelte',
    config: "import { svelte } from '@sveltejs/vite-plugin-svelte';\nexport default { plugins: [svelte()] };\n",
    files: (code) => ({
      'src/App.svelte': code,
      'src/main.js': "import { mount } from 'svelte';\nimport App from './App.svelte';\nmount(App, { target: document.getElementById('app') });\n",
    }),
  },
};

/* ---------- plain JavaScript ---------- */

/** What each sample should have done, appended after its own code. */
const FOLLOW_UPS = [
  // The bare import: all it has to do is define the element.
  [/^import 'agent-mascots';?\s*$/, "window.answer = customElements.get('agent-mascot') !== undefined;\n"],
  [/onAgentEvent/, "onAgentEvent('fail');\nwindow.answer = mascot.mood === 'error' && (onAgentEvent('nonsense'), mascot.mood === 'idle');\n"],
  [/mascot\.level/, "window.answer = mascot.level === 0.6 && mascot.mood === 'speaking';\n"],
  [/lookAway/, 'window.answer = true;\n'],
  [/registerShape/, "const el = document.querySelector('agent-mascot');\nel.shape = 'kite';\nwindow.answer = el.shape === 'kite';\n"],
  [/agent-mascots\/core/, "const el = document.querySelector('agent-mascot');\nel.shape = 'orb';\nel.accessories = 'ears';\nwindow.answer = el.shape === 'orb' && el.accessories.includes('ears');\n"],
];

async function runScript(work, browsers, code, index) {
  const follow = FOLLOW_UPS.find(([pattern]) => pattern.test(code));
  if (!follow) throw new Error('no follow-up check for this sample');
  const entry = join(work, `sample-${index}.js`);
  await writeFile(entry, `${/import/.test(code) ? '' : "import 'agent-mascots';\n"}${code}\n${follow[1]}`);
  const { outputFiles } = await esbuild({ entryPoints: [entry], bundle: true, write: false, format: 'iife', logLevel: 'silent' });
  const script = outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  // The element first: samples look it up as soon as they run.
  const html = `<!doctype html><title>check</title><agent-mascot></agent-mascot><script type="module">${script}</script>`;
  return inEvery(browsers, { html, probe: () => window.answer }, (answer) => answer === true);
}

/* ---------- the blocks ---------- */

async function verifyBlocks(blocks, work, browsers) {
  const viteConfig = blocks.find(({ code }) => code.includes('// vite.config.js'));
  for (const [index, block] of blocks.entries()) {
    const { lang, code } = block;
    await check(label(block), async () => {
      if (lang === 'html') {
        const hasScript = code.includes(CDN);
        const html = `<!doctype html><title>check</title>${hasScript ? '' : `<script type="module" src="${CDN}"></script>`}${code}`;
        const options = code.includes('enableGyro')
          ? {
              html,
              setup: (page) => page.locator('#tilt').click(),
              probe: () => document.querySelector('#tilty').shadowRoot !== null,
            }
          : { html, probe: rendered };
        return inEvery(browsers, options, (answer) => answer === true);
      }
      if (lang === 'css') {
        const html = `<!doctype html><title>check</title><style>${code}</style><script type="module" src="${CDN}"></script><agent-mascot></agent-mascot>`;
        const rules = code.match(/\{/g).length;
        const answer = await inEvery(browsers, {
          html,
          probe: () => {
            const count = (list) => [...list].reduce((n, rule) => n + 1 + (rule.cssRules ? count(rule.cssRules) : 0), 0);
            return count(document.styleSheets[0].cssRules);
          },
        }, (found) => found === rules);
        return `${rules} rules parsed in ${answer}`;
      }
      if (lang === 'js' && block === viteConfig) return 'built with the Vue sample below';
      if (lang === 'js') return runScript(work, browsers, code, index);
      if (lang in FRAMEWORKS) {
        const { name, config, files } = FRAMEWORKS[lang];
        const dir = await viteBuild(work, name, files(code), config ?? viteConfig.code);
        return inEvery(browsers, { dir, ...pokedMood }, (mood) => mood === 'success');
      }
      if (lang === 'ts') {
        await writeFile(join(work, 'types.ts'), code);
        await writeFile(join(work, 'use.tsx'), "export const a = <agent-mascot mood=\"idle\" onmascot-poke={() => {}} />;\n// @ts-expect-error not a mood\nexport const b = <agent-mascot mood=\"nope\" />;\n");
        await writeFile(join(work, 'tsconfig.json'), JSON.stringify({
          compilerOptions: { module: 'esnext', moduleResolution: 'bundler', target: 'es2022', jsx: 'react-jsx', strict: true, noEmit: true, types: ['react'], lib: ['es2023', 'dom'] },
          files: ['types.ts', 'use.tsx'],
        }));
        await shell(work, join(work, 'node_modules/.bin/tsc'), '-p', '.');
        return 'typed a React sample, and rejected a bad mood';
      }
      if (lang === 'sh') {
        const scripts = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).scripts;
        const named = [...code.matchAll(/bun run (\S+)/g)].map((match) => match[1]);
        for (const name of named) if (!scripts[name]) throw new Error(`no script ${name}`);
        return code.includes('install agent-mascots') ? 'not on npm yet, so the tarball was installed instead' : `scripts exist: ${named.join(', ')}`;
      }
      throw new Error('no way to check this block');
    });
  }
}

/* ---------- the facts around the code ---------- */

/** Rounded the way scripts/site-metrics.mjs rounds, so the README and the site agree. */
const kilobytes = (bytes) => `${(Math.round(bytes / 100) / 10).toFixed(1)} kB`;

async function verifyFacts(readme, usage, api) {
  const manifest = JSON.parse(await readFile(join(root, 'custom-elements.json'), 'utf8'));
  const element = manifest.modules.flatMap((mod) => mod.declarations ?? []).find((item) => item.tagName === 'agent-mascot');
  const attributes = element.attributes.map(({ name }) => name);
  // The API reference is the complete list; the usage guide covers how to use them, not every one.
  await check('every attribute is in the API reference', () => {
    const missing = attributes.filter((name) => !api.includes(`\`${name}\``));
    if (missing.length) throw new Error(missing.join(', '));
    return `${attributes.length} attributes`;
  });

  await check('every listed value is in the API reference', async () => {
    const lists = await import(join(root, 'dist/index.js'));
    const values = ['MASCOT_SHAPES', 'MASCOT_MATERIALS', 'MASCOT_ACCESSORIES', 'MASCOT_EYE_SHAPES', 'MASCOT_MOODS'].flatMap((name) => lists[name]);
    const missing = values.filter((value) => !api.includes(`\`${value}\``));
    if (missing.length) throw new Error(missing.join(', '));
    return `${values.length} values`;
  });

  await check('sizes match size-limit', async () => {
    const { stdout } = await shell(root, join(root, 'node_modules/.bin/size-limit'), '--json');
    const sizes = JSON.parse(stdout.slice(stdout.indexOf('[')));
    for (const { name, size } of sizes) {
      const entry = name.replace(' (full)', '');
      const row = usage.split('\n').find((line) => line.startsWith(`| \`${entry}\``));
      const kB = kilobytes(size);
      if (!row?.includes(kB)) throw new Error(`${entry} is ${kB}, the table says ${row}`);
    }
    if (!readme.includes(`gzipped-${kilobytes(sizes[0].size).replace(' ', '%20')}-`)) throw new Error('the size badge has the wrong size');
    return sizes.map(({ size }) => `${size} B`).join(', ');
  });

  // GitHub resolves a relative <img src> against the document, but not a relative <source srcset>:
  // that one breaks for whoever matches it, such as everyone in dark mode. So srcset is absolute.
  const docs = { 'README.md': readme, 'docs/USAGE.md': usage };
  await check('every srcset is absolute, under the repo', () => {
    for (const [file, text] of Object.entries(docs)) {
      const relative = [...text.matchAll(/srcset="(?!https?:)([^"]+)"/g)].map((match) => match[1]);
      if (relative.length) throw new Error(`${file}: relative srcset: ${relative.join(', ')}`);
      const elsewhere = [...text.matchAll(/srcset="(https?:[^"]+)"/g)].map((match) => match[1]).filter((url) => !url.startsWith(MEDIA_BASE));
      if (elsewhere.length) throw new Error(`${file}: srcset outside ${MEDIA_BASE}: ${elsewhere.join(', ')}`);
    }
  });

  await check('local links and media exist, and media is under 3 MB', () => {
    let count = 0;
    for (const [file, text] of Object.entries(docs)) {
      const paths = [...text.matchAll(/(?:src|srcset|href)="((?!https?:|#)[^"]+|https?:[^"]+)"|\]\((?!#|https?:)([^)]+)\)/g)]
        .map((match) => match[1] ?? match[2])
        .filter((path) => !/^https?:/.test(path) || path.startsWith(MEDIA_BASE))
        // An absolute URL is from the repo's root; a relative one from the document's folder.
        .map((path) => (path.startsWith(MEDIA_BASE) ? join(root, local(path)) : join(root, dirname(file), path.replace(/#.*/, ''))));
      for (const path of paths) {
        if (!existsSync(path)) throw new Error(`${file}: missing ${path.slice(root.length)}`);
        if (path.includes('/media/') && statSync(path).size > MEDIA_LIMIT) throw new Error(`${path.slice(root.length)} is over 3 MB`);
      }
      count += paths.length;
    }
    return `${count} paths`;
  });

  await check('every animation has a still for reduced motion', () => {
    let count = 0;
    for (const [file, text] of Object.entries(docs)) {
      const clips = [...text.matchAll(/(?:docs\/)?media\/((?:mood|materials|tracking)[\w-]*?)(-light|-dark)?\.webp/g)];
      const missing = clips.filter(([, name, theme = '']) => {
        const still = name.startsWith('mood') ? `${name}-still.png` : `${name}-still${theme}.png`;
        return !text.includes(`srcset="${MEDIA_BASE}docs/media/${still}"`);
      });
      if (missing.length) throw new Error(`${file}: ${missing.map(([path]) => path).join(', ')}`);
      count += clips.length;
    }
    return `${count} clips`;
  });

  await check('no links to services that are not set up', () => {
    const external = Object.values(docs)
      .flatMap((text) => [...text.matchAll(/https?:\/\/[^\s"')]+/g)].map(([url]) => url))
      .filter((url) => url !== CDN && url !== AUTHOR && !url.startsWith(MEDIA_BASE) && !url.startsWith(SITE) && !BADGES.some((badge) => url.startsWith(badge)));
    if (external.length) throw new Error(external.join(', '));
  });
}

/* ---------- entry ---------- */

const readme = await readFile(join(root, 'README.md'), 'utf8');
const usage = await readFile(join(root, 'docs/USAGE.md'), 'utf8');
const api = await readFile(join(root, 'docs/API.md'), 'utf8');
const blocks = [...codeBlocks(readme, 'README'), ...codeBlocks(usage, 'USAGE'), ...codeBlocks(api, 'API')];

await mkdir(dirname(process.env.VERIFY_DIR ?? tmpdir()), { recursive: true });
const work = await setUp();
const browsers = await launchAll();
try {
  await verifyBlocks(blocks, work, browsers);
  await verifyFacts(readme, usage, api);
} finally {
  await Promise.all(browsers.map(([, browser]) => browser.close()));
  if (!process.env.VERIFY_KEEP) await rm(work, { recursive: true, force: true });
}

const failed = results.filter((status) => status === 'FAIL').length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
if (failed) process.exitCode = 1;
