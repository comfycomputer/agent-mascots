// Renders the frames behind docs/media and site/static from the real component. Run after
// `bun run site:prepare`, which builds the library and writes site/metrics.json, then run
// encode.py over the same work folder:
//
//   bun scripts/media/capture.mjs [banner moods materials tracking shapes social icons]
//   python3 scripts/media/encode.py
//
// MEDIA_WORK sets the work folder, and MEDIA_DIST a copy of dist/ to capture from.
// oxlint-disable no-console -- this script's output is its report
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FRAME_MS, advance, closeBrowser, openStage, root, saveFile, saveFrame, shot } from './stage.mjs';
import { renderCover } from './thumbnail.mjs';

const work = process.env.MEDIA_WORK ?? join(tmpdir(), 'agent-mascots-media');
const metrics = JSON.parse(await readFile(join(root, 'site/metrics.json'), 'utf8'));

const frames = (seconds) => Math.round((seconds * 1000) / FRAME_MS);

function assertClean(errors, name) {
  if (errors.length) throw new Error(`${name} logged: ${errors.join('; ')}`);
}

/** What encode.py needs to know about each clip. */
const meta = {};

async function writeMeta() {
  await mkdir(work, { recursive: true });
  const path = join(work, 'meta.json');
  const before = await readFile(path, 'utf8').then(JSON.parse).catch(() => ({}));
  await writeFile(path, JSON.stringify({ ...before, ...meta }, null, 2));
}

/* ---------- banner ---------- */

const BANNER = { width: 1280, height: 400 };
const BANNER_CARD = 116;
/** Just enough to cover the banner once the grid is turned, so each preset shows once. */
const BANNER_GRID = { rows: 5, columns: 12 };

/**
 * The README's banner: the name, large, over the landing page's preset pictures in a grid turned a
 * little, with a soft wash of the page's ground behind the name so it reads. Still, so it costs
 * nothing to show, and drawn at twice its size for 2x screens.
 */
async function captureBanner() {
  const dir = join(root, 'site/src/landing/presets');
  const names = (await readdir(dir)).filter((name) => name.endsWith('.webp')).toSorted();
  const pictures = await Promise.all(names.map(async (name) => `data:image/webp;base64,${(await readFile(join(dir, name))).toString('base64')}`));
  const { rows, columns } = BANNER_GRID;
  // Every preset once, never twice. Steps of 7 through the list (a count that 7 divides would repeat),
  // so presets written next to each other in presets.ts land apart.
  if (pictures.length < rows * columns) throw new Error(`the banner needs ${rows * columns} presets, and there are ${pictures.length}`);
  const cards = Array.from({ length: rows * columns }, (_, i) => pictures[(i * 7) % pictures.length]);
  if (new Set(cards).size !== cards.length) throw new Error('the banner shows a preset twice');
  const css = `
    body { background: transparent; }
    .banner { position: relative; width: ${BANNER.width}px; height: ${BANNER.height}px; overflow: hidden; border-radius: 24px; background: #FAF8F4; }
    .grid { position: absolute; left: 50%; top: 50%; display: grid; grid-template-columns: repeat(${columns}, ${BANNER_CARD}px); gap: 2px;
      transform: translate(-50%, -50%) rotate(-8deg); }
    .grid img { width: ${BANNER_CARD}px; height: ${BANNER_CARD}px; display: block; }
    .wash { position: absolute; inset: 0; background: radial-gradient(ellipse 46% 42% at 50% 50%, #FAF8F4 55%, rgb(250 248 244 / 0.82) 72%, rgb(250 248 244 / 0) 100%); }
    .name { position: absolute; inset: 0; display: grid; place-items: center; margin: 0;
      font: 600 112px/1 Fraunces, serif; letter-spacing: -0.02em; color: #17120F; }`;
  const body = `<div class="banner">
    <div class="grid">${cards.map((src) => `<img src="${src}" alt="">`).join('')}</div>
    <div class="wash"></div>
    <p class="name">agent-mascots</p>
  </div>`;
  const { page, errors } = await openStage({ ...BANNER, scale: 2, css, body });
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await saveFile(join(root, 'docs/media/banner.png'), await shot(page, { x: 0, y: 0, ...BANNER }, true));
  assertClean(errors, 'banner');
  await page.close();
  console.log('banner written');
}

/* ---------- moods ---------- */

const MOOD_CELL = 240;
/** Captured large and scaled down by encode.py, which gives softer gradients and smaller files. */
const MOOD_SCALE = 2;
/** The README shows each at 200px, so this is twice that, for a 2x screen. */
const MOOD_OUT = 400;
const MOOD_SECONDS = 12;
const CAST = [
  ['idle', 'shape="blob"'],
  ['thinking', 'shape="cloud" material="frost" color="#5B8CFF"'],
  ['working', 'shape="squircle" color="#FFC62E" accent="#E8442E"'],
  ['success', 'shape="egg" color="#12B886" accent="#FFC62E"'],
  ['error', 'shape="flame" color="#E8442E" accent="#FFC62E"'],
  ['listening', 'shape="orb" material="glass" color="#7C5CFF"'],
  ['speaking', 'shape="bell" color="#FF7A9E"'],
  ['waiting', 'shape="cap" color="#F59E0B" accent="#FFF1DC"'],
  ['sleeping', 'shape="ghost" color="#1646D8"'],
];

async function captureMoods() {
  // A hop leaves the mascot's box, so the cell keeps room above it.
  const css = `.grid { display: grid; grid-template-columns: repeat(3, ${MOOD_CELL}px); grid-auto-rows: ${MOOD_CELL}px; justify-items: center; }
    agent-mascot { width: 200px; margin-top: 28px; }`;
  const body = `<div class="grid">${CAST.map(([mood, attrs]) => `<agent-mascot mood="${mood}" detail="full" ${attrs}></agent-mascot>`).join('')}</div>`;
  const { page, errors } = await openStage({ width: MOOD_CELL * 3, height: MOOD_CELL * 3, scale: MOOD_SCALE, css, body });
  await rm(join(work, 'moods'), { recursive: true, force: true });
  await advance(page, 1500);
  const total = frames(MOOD_SECONDS);
  for (let i = 0; i < total; i++) {
    await advance(page, FRAME_MS);
    for (const [index, [mood]] of CAST.entries()) {
      const clip = { x: (index % 3) * MOOD_CELL, y: Math.floor(index / 3) * MOOD_CELL, width: MOOD_CELL, height: MOOD_CELL };
      await saveFrame(join(work, 'moods', mood), i, await shot(page, clip, true));
    }
  }
  assertClean(errors, 'moods');
  await page.close();
  meta.moods = {
    size: MOOD_OUT,
    shortest: frames(2),
    longest: frames(4.6),
    overlap: 5,
    stride: { thinking: 2 },
    ranges: {
      // Its gaze visits three points, 2.3s each, so anything shorter ends looking the wrong way.
      thinking: [frames(6.8), frames(7.3)],
      // The rings repeat every 1.19s, and rings on alpha are expensive.
      listening: [frames(2.3), frames(2.5)],
    },
  };
  console.log(`moods: ${total} frames each`);
}

/* ---------- materials ---------- */

const ROW = { width: 1080, height: 360 };
const ROW_CROSSFADE = 8;
/** A flat ground each: alpha would cost three times as much on clips this wide. */
const ROW_GROUNDS = { light: '#FFF1DC', dark: '#17120F' };
const MATERIAL_MOODS = ['idle', 'thinking', 'working', 'success'];
const MATERIAL_BEAT = 1.2;

async function captureMaterials(variant) {
  const css = `body { background: ${ROW_GROUNDS[variant]}; }
    .row { display: grid; grid-template-columns: repeat(3, 360px); } agent-mascot { width: 360px; }`;
  const body = `<div class="row">
    <agent-mascot shape="blob" material="glow"></agent-mascot>
    <agent-mascot shape="cloud" material="frost" color="#5B8CFF"></agent-mascot>
    <agent-mascot shape="orb" material="glass" color="#7C5CFF"></agent-mascot>
  </div>`;
  const { page, errors } = await openStage({ ...ROW, scale: 2, css, body });
  const dir = join(work, `materials-${variant}`);
  await rm(dir, { recursive: true, force: true });
  const beat = frames(MATERIAL_BEAT);
  const cycle = beat * MATERIAL_MOODS.length;
  const setMood = (mood) => page.evaluate((name) => {
    for (const el of document.querySelectorAll('agent-mascot')) el.mood = name;
  }, mood);
  let saved = 0;
  // Two passes: the second starts from where the first ended, so its tail meets its head.
  for (let i = 0; i < cycle * 2; i++) {
    if (i % beat === 0) await setMood(MATERIAL_MOODS[Math.floor(i / beat) % MATERIAL_MOODS.length]);
    await advance(page, FRAME_MS);
    if (i >= cycle - ROW_CROSSFADE) await saveFrame(dir, saved++, await shot(page, { x: 0, y: 0, ...ROW }));
  }
  assertClean(errors, 'materials');
  await page.close();
  // Twice the width GitHub shows it at, so it stays sharp on a 2x screen.
  meta.materials = { overlap: ROW_CROSSFADE, size: [1800, 600] };
  console.log(`materials-${variant}: ${saved} frames`);
}

/* ---------- tracking ---------- */

const CURSOR_SVG = `<svg class="cursor" viewBox="0 0 26 34" aria-hidden="true">
  <path d="M2 2v26l7-6 5 11 6-3-5-10h9Z" fill="#17120F" stroke="#FFF1DC" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

const TRACK = { width: 1080, height: 300 };
const TRACK_SECONDS = 4;

async function captureTracking(variant) {
  const css = `body { background: ${ROW_GROUNDS[variant]}; }
    .row { display: grid; grid-template-columns: repeat(4, 270px); justify-items: center; padding-top: 30px; }
    agent-mascot { width: 240px; }`;
  const body = `<div class="row">
    <agent-mascot track="window" track-reach="3" gaze="1.4" shape="egg" color="#FFC62E"></agent-mascot>
    <agent-mascot track="window" track-reach="3" gaze="1.4" shape="ghost" color="#FF7A9E"></agent-mascot>
    <agent-mascot track="window" track-reach="3" gaze="1.4" shape="blob"></agent-mascot>
    <agent-mascot track="window" track-reach="3" gaze="1.4" shape="orb" color="#E8442E"></agent-mascot>
  </div>${CURSOR_SVG}`;
  const { page, errors } = await openStage({
    ...TRACK,
    scale: 2,
    css: `${css} .cursor { position: absolute; left: 0; top: 0; width: 26px; height: 34px; }`,
    body,
  });
  const dir = join(work, `tracking-${variant}`);
  await rm(dir, { recursive: true, force: true });
  const cycle = frames(TRACK_SECONDS);
  const at = (i) => {
    const k = (i / cycle) * Math.PI * 2;
    return { x: 540 + 480 * Math.sin(k), y: 150 + 130 * Math.sin(k * 2 + 0.6) };
  };
  let saved = 0;
  for (let i = 0; i < cycle * 2; i++) {
    const point = at(i);
    await page.mouse.move(point.x, point.y);
    await page.evaluate(({ x, y }) => {
      document.querySelector('.cursor').style.transform = `translate(${x}px,${y}px)`;
    }, point);
    await advance(page, FRAME_MS);
    if (i >= cycle - ROW_CROSSFADE) await saveFrame(dir, saved++, await shot(page, { x: 0, y: 0, ...TRACK }));
  }
  assertClean(errors, 'tracking');
  await page.close();
  meta.tracking = { overlap: ROW_CROSSFADE, size: [1800, 500] };
  console.log(`tracking-${variant}: ${saved} frames`);
}

/* ---------- shapes ---------- */

const SHAPE_CELL = 120;
const SHAPES_PER_ROW = 8;
/** One ink per shape, in turn, so neighbours never match. */
const INKS = ['#18C2A0', '#FFC62E', '#FF7A9E', '#5B8CFF', '#E8442E', '#F6EFE2', '#7C5CFF', '#FFB3A7'];

async function captureShapes() {
  const rows = Math.ceil(metrics.shapes.length / SHAPES_PER_ROW);
  const size = { width: SHAPE_CELL * SHAPES_PER_ROW, height: SHAPE_CELL * rows };
  const css = `.grid { display: grid; grid-template-columns: repeat(${SHAPES_PER_ROW}, ${SHAPE_CELL}px); } agent-mascot { width: ${SHAPE_CELL}px; }`;
  const body = `<div class="grid">${metrics.shapes
    .map((shape, i) => `<agent-mascot shape="${shape}" color="${INKS[(i + Math.floor(i / SHAPES_PER_ROW) * 3) % INKS.length]}" motion="0"></agent-mascot>`)
    .join('')}</div>`;
  const { page, errors } = await openStage({ ...size, scale: 2, css, body });
  await advance(page, 400);
  await saveFile(join(root, 'docs/media/shapes.png'), await shot(page, { x: 0, y: 0, ...size }, true));
  assertClean(errors, 'shapes');
  await page.close();
  console.log(`shapes: ${metrics.shapes.length}`);
}

/* ---------- social ---------- */

/** The site's share image: the cover in its og layout, which thumbnail.mjs draws. */
async function captureSocial() {
  await renderCover('og', join(root, 'site/static/og.png'));
  console.log('social written');
}

/* ---------- icons ---------- */

async function captureIcon(size, out, attrs, scale = 1) {
  const css = `body { background: transparent; } agent-mascot { display: block; width: ${size}px; }`;
  const { page, errors } = await openStage({ width: size, height: size, scale, css, body: `<agent-mascot detail="simple" motion="0" shadow="none" ${attrs}></agent-mascot>` });
  await advance(page, 200);
  await saveFile(out, await shot(page, { x: 0, y: 0, width: size, height: size }, true));
  assertClean(errors, out);
  await page.close();
}

/** The favicon is the real 32px simple mascot, lifted out of its shadow root and flattened. */
async function captureFaviconSvg() {
  const css = 'agent-mascot { display: block; width: 32px; }';
  const body = '<agent-mascot detail="simple" motion="0" shadow="none"></agent-mascot>';
  const { page, errors } = await openStage({ width: 32, height: 32, css, body });
  await advance(page, 200);
  const parts = await page.evaluate(() => {
    const svg = document.querySelector('agent-mascot').shadowRoot.querySelector('svg');
    const [outline, left, right] = [...svg.querySelectorAll('.simple-body, .simple-eye')].map((node) => ({
      d: node.getAttribute('d'),
      transform: node.getAttribute('transform'),
    }));
    return {
      viewBox: svg.getAttribute('viewBox'),
      body: outline,
      eyes: [left, right],
      eyesAt: svg.querySelector('.simple-eye').parentElement.getAttribute('transform'),
    };
  });
  assertClean(errors, 'favicon');
  await page.close();
  const eyes = parts.eyes.map(({ d, transform }) => `<path transform="${transform}" d="${d}"/>`).join('');
  const file = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${parts.viewBox}"><path fill="#E8442E" transform="${parts.body.transform}" d="${parts.body.d}"/><g fill="#17120F" transform="${parts.eyesAt}">${eyes}</g></svg>\n`;
  await saveFile(join(root, 'site/static/favicon.svg'), file);
}

async function captureIcons() {
  await captureFaviconSvg();
  await captureIcon(32, join(root, 'site/static/favicon-32.png'), 'color="#E8442E" eye-color="#17120F"');
  // Home screens fill transparent corners with black, so the tile runs edge to edge.
  await captureIcon(180, join(root, 'site/static/apple-touch-icon.png'), 'color="#FFF1DC" sky="#E8442E" eye-color="#17120F" style="--mascot-radius:0"');
  console.log('icons written');
}

/* ---------- entry ---------- */

const scenes = {
  banner: captureBanner,
  moods: captureMoods,
  materials: async () => {
    await captureMaterials('light');
    await captureMaterials('dark');
  },
  tracking: async () => {
    await captureTracking('light');
    await captureTracking('dark');
  },
  shapes: captureShapes,
  social: captureSocial,
  icons: captureIcons,
};

const wanted = process.argv.slice(2);
for (const name of wanted.length ? wanted : Object.keys(scenes)) {
  await scenes[name]();
  // After each scene, so a later one failing leaves encode.py the right settings for this one.
  await writeMeta();
}
await closeBrowser();
