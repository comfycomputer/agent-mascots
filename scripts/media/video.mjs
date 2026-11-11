// A 30-second promo video for social media, drawn by the real component on a frame-stepped stage,
// scored by audio.py to the same timeline. Run after `bun run build`:
//
//   bun scripts/media/video.mjs [out.mp4]
//
// Square, 1080 by 1080 at 30 frames a second: a square fills the most of a phone's feed on X and
// LinkedIn. Everything is timed to the music, 120 beats a minute, so cuts and pops land on beats.
// MEDIA_WORK sets the folder for the frames, the cue list and the sound. VIDEO_SKIP_FRAMES=1
// reuses the frames already there, to rescore without redrawing.
// oxlint-disable no-console -- this script's output is its report
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siHtml5, siReact, siSolid, siSvelte, siVuedotjs } from 'simple-icons';
import { PRESETS } from '../../site/src/landing/presets.ts';
import { advance, closeBrowser, openStage, root, saveFrame, shot } from './stage.mjs';

const SIZE = 1080;
const FPS = 30;
const SECONDS = 30;
const BEAT = 0.5;
const base = process.env.MEDIA_WORK ?? join(tmpdir(), 'agent-mascots-media');
const work = join(base, 'video');
const out = resolve(process.argv[2] ?? join(base, 'agent-mascots.mp4'));
const skipFrames = Boolean(process.env.VIDEO_SKIP_FRAMES);

const preset = (name) => {
  const found = PRESETS.find((p) => p.name === name);
  if (!found) throw new Error(`no preset ${name}`);
  return found;
};

/* ---------- the cast: no design is shown twice ---------- */

const HOOK = preset('onyx');
/** The hero's turn through the moods, one a second, each in its own preset. */
const MOOD_CAST = [
  ['thinking', 'midnight'],
  ['working', 'robot'],
  ['success', 'sunny'],
  ['error', 'devil'],
  ['listening', 'ufo'],
  ['speaking', 'cupid'],
  ['waiting', 'owl'],
  ['sleeping', 'luna'],
].map(([mood, name]) => ({ mood, ...preset(name) }));

const GRID_ROWS = 6;
const GRID_PER_ROW = 9;
const GALLERY_SIDE = 4;

// The rest, shuffled by a fixed seed so neighbours vary, dealt to the grid and then the end card.
let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const used = new Set([HOOK, ...MOOD_CAST].map((p) => p.name));
const rest = PRESETS.filter((p) => !used.has(p.name))
  .map((p) => ({ p, k: random() }))
  .toSorted((a, b) => a.k - b.k)
  .map(({ p }) => p);
const GRID = rest.slice(0, GRID_ROWS * GRID_PER_ROW);
const GALLERY = rest.slice(GRID.length, GRID.length + GALLERY_SIDE ** 2);
if (GALLERY.length < GALLERY_SIDE ** 2) throw new Error(`not enough presets: the video needs ${used.size + GRID_ROWS * GRID_PER_ROW + GALLERY_SIDE ** 2}`);
const shown = [HOOK, ...MOOD_CAST, ...GRID, ...GALLERY].map((p) => p.name);
if (new Set(shown).size !== shown.length) throw new Error('a design is shown twice');

const GRID_MOODS = ['idle', 'idle', 'success', 'idle', 'speaking', 'idle', 'thinking', 'idle', 'listening'];

const FRAMEWORKS = [
  ['HTML', siHtml5],
  ['React', siReact],
  ['Vue', siVuedotjs],
  ['Svelte', siSvelte],
  ['Solid', siSolid],
];

/* ---------- the timeline, in seconds ---------- */

const TIMELINE = {
  heroPop: 0.5,
  hookWords: 1.0,
  hookOut: 3.75,
  moods: 4,
  customize: 12,
  frameworks: 20,
  logos: 21,
  end: 24,
  seconds: SECONDS,
};
const moodStart = (i) => TIMELINE.moods + i * 2 * BEAT;

/** Cool tints only, one per mood. */
const TINTS = [
  ['#e2dcff', '#d8e4ff', '#f4f3fb'],
  ['#dbe4f0', '#e2ecf7', '#f5f7fa'],
  ['#d9f5e6', '#e0ecff', '#f4faf7'],
  ['#ffdbe4', '#e8ddff', '#fbf5f8'],
  ['#d3f3ec', '#dce4ff', '#f3faf9'],
  ['#ffdcef', '#e2e2ff', '#fbf5fa'],
  ['#e0e6f3', '#e6e0f5', '#f6f7fb'],
  ['#dfe3ff', '#e6dcf7', '#f5f6fc'],
];

const attrs = (look) =>
  Object.entries(look)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

const pictures = await Promise.all(
  GALLERY.map(async (p) => `data:image/webp;base64,${(await readFile(join(root, 'site/src/landing/presets', `${p.name}.webp`))).toString('base64')}`),
);

/* ---------- the page ---------- */

const css = `
  :root { --ink: #0f1115; --accent: #4f46e5; --g1: #e4e2ff; --g2: #d9ecff; --g3: #f5f6fb; }
  body { width: ${SIZE}px; height: ${SIZE}px; overflow: hidden; color: var(--ink); background: var(--g3);
    font-family: Recursive, sans-serif; -webkit-font-smoothing: antialiased; }
  .ground { position: absolute; inset: 0;
    background: radial-gradient(70% 60% at 88% 6%, var(--g1), transparent 70%), radial-gradient(70% 65% at 4% 96%, var(--g2), transparent 70%), var(--g3); }
  .scene { position: absolute; inset: 0; opacity: 0; }
  .display { font-family: Fraunces, serif; font-weight: 700; font-variation-settings: "SOFT" 30, "WONK" 0; letter-spacing: -0.035em; line-height: 0.98; margin: 0; }
  .mono { font-family: Recursive, monospace; font-variation-settings: "MONO" 1, "CASL" 0; }
  .w { display: inline-block; white-space: pre; }
  .center { position: absolute; left: 0; right: 0; text-align: center; }
  agent-mascot { display: block; }
  .em { color: var(--accent); }

  /* the hero, through the hook and the moods */
  #hero-wrap { position: absolute; left: 50%; top: 50%; width: 600px; height: 600px; margin: -300px 0 0 -300px; }
  #hero { width: 600px; }
  #hook { top: 735px; font-size: 112px; }
  #chip { position: absolute; left: 50%; top: 880px; padding: 22px 34px; border-radius: 20px;
    background: var(--ink); color: #eef0f6; font-size: 34px; white-space: pre; box-shadow: 0 20px 50px rgb(15 17 21 / 0.25); }
  #chip .attr { color: #a5b4ff; } #chip .val { color: #7cf5c8; }
  #chip .caret { display: inline-block; width: 3px; height: 36px; margin-left: 2px; vertical-align: -6px; background: #7cf5c8; }

  /* customize */
  #rows { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
  .row { position: absolute; left: 0; top: 0; display: flex; gap: 18px; transform-origin: 0 0; }
  .row .cell { flex: none; width: 200px; height: 200px; display: grid; place-items: center; border-radius: 44px;
    background: rgb(255 255 255 / 0.72); box-shadow: 0 14px 34px rgb(30 34 60 / 0.10), inset 0 0 0 1px rgb(255 255 255 / 0.9); }
  .row agent-mascot { width: 168px; }
  #customize-card { position: absolute; left: 70px; right: 70px; top: 50%; padding: 48px 40px; border-radius: 48px;
    background: rgb(15 17 21 / 0.92); color: #f4f5fa; text-align: center; box-shadow: 0 30px 90px rgb(15 17 21 / 0.35); backdrop-filter: blur(10px); }
  #customize-title { font-size: 84px; }
  #customize-title .em { color: #a5b4ff; }

  /* frameworks */
  #fw-title { top: 250px; font-size: 96px; }
  #logos { position: absolute; left: 0; right: 0; top: 580px; display: flex; justify-content: center; gap: 24px; }
  .logo { display: flex; flex-direction: column; align-items: center; gap: 18px; }
  .logo .tile { width: 172px; height: 172px; border-radius: 44px; display: grid; place-items: center; background: #fff;
    box-shadow: 0 18px 40px rgb(30 34 60 / 0.12), inset 0 0 0 1px rgb(15 17 21 / 0.05); }
  .logo svg { width: 96px; height: 96px; }
  .logo span { font-size: 26px; color: rgb(15 17 21 / 0.7); }

  /* the end card */
  #gallery { position: absolute; left: 50%; top: 50%; display: grid; grid-template-columns: repeat(${GALLERY_SIDE}, 320px); gap: 8px; }
  #gallery img { width: 320px; height: 320px; display: block; }
  #panel { position: absolute; left: 80px; right: 80px; top: 250px; height: 580px; border-radius: 56px; background: rgb(255 255 255 / 0.96);
    backdrop-filter: blur(16px); box-shadow: 0 40px 100px rgb(30 34 60 / 0.25), inset 0 0 0 1px rgb(255 255 255 / 0.8); }
  #end-title { top: 330px; font-size: 128px; }
  #end-lead { top: 490px; font-size: 31px; padding: 0 180px; line-height: 1.35; color: rgb(15 17 21 / 0.8); }
  #install { position: absolute; left: 50%; top: 630px; padding: 22px 34px; border-radius: 18px;
    background: var(--ink); color: #eef0f6; font-size: 30px; white-space: pre; }
  #install .dollar { color: #7cf5c8; }
  #url { top: 748px; font-size: 28px; color: var(--accent); }
`;

const words = (text, cls = '') =>
  text
    .split(/(\s+)/)
    .map((part) => (part.trim() ? `<span class="w ${cls}">${part}</span>` : part))
    .join('');

const logo = ([name, icon]) =>
  `<div class="logo"><div class="tile"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#${icon.hex}" d="${icon.path}"/></svg></div><span class="mono">${name}</span></div>`;

const gridRow = (r) =>
  `<div class="row">${GRID.slice(r * GRID_PER_ROW, (r + 1) * GRID_PER_ROW)
    .map((p, i) => `<div class="cell"><agent-mascot detail="full" mood="${GRID_MOODS[(i + r * 4) % GRID_MOODS.length]}" ${attrs(p.attrs)}></agent-mascot></div>`)
    .join('')}</div>`;

const body = `
<div class="ground"></div>

<section class="scene" id="s-hook">
  <h1 class="display center" id="hook">${words('Give your AI agent')}<br>${words('a face.', 'em')}</h1>
</section>

<section class="scene" id="s-moods">
  <div id="chip" class="mono">&lt;agent-mascot <span class="attr">mood</span>="<span class="val"></span><span class="caret"></span>"&gt;</div>
</section>

<div class="scene" id="s-hero"><div id="hero-wrap"><agent-mascot id="hero" detail="full" ${attrs(HOOK.attrs)}></agent-mascot></div></div>

<section class="scene" id="s-customize">
  <div id="rows">${Array.from({ length: GRID_ROWS }, (_, r) => gridRow(r)).join('')}</div>
  <div id="customize-card"><h2 class="display" id="customize-title">${words('Customize body shape,')}<br>${words('materials & accessories!', 'em')}</h2></div>
</section>

<section class="scene" id="s-frameworks">
  <h2 class="display center" id="fw-title">${words('One web component,')}<br>${words('for every framework', 'em')}</h2>
  <div id="logos">${FRAMEWORKS.map(logo).join('')}</div>
</section>

<section class="scene" id="s-end">
  <div id="gallery">${pictures.map((src) => `<img src="${src}" alt="">`).join('')}</div>
  <div id="panel"></div>
  <h2 class="display center" id="end-title">agent-mascots</h2>
  <p class="center" id="end-lead">An animated web component that shows what your AI agent is doing.</p>
  <div id="install" class="mono"><span class="dollar">$ </span>npm i @comfycomputer/agent-mascots</div>
  <p class="mono center" id="url">comfycomputer.github.io/agent-mascots</p>
</section>`;

/* oxlint-disable unicorn/consistent-function-scoping -- setup is sent to the page whole, so its helpers live inside it */
/** Runs in the page: draws the frame at `t` seconds. Everything that moves is a function of `t`. */
function setup({ cast, T, beat, rows, perRow }) {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const outQuint = (x) => 1 - (1 - x) ** 5;
  const inOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
  /** A spring that settles, for pops: overshoots once, then a smaller once. */
  const spring = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(9 * x));
  const progress = (t, start, length) => clamp((t - start) / length);
  const moodAt = (i) => T.moods + i * 2 * beat;

  /** In with a quick zoom settle, out with a quick shrink and fade: cuts on the beat. */
  function scene(el, t, from, to, enter = 0.3, leave = 0.25) {
    const a = outQuint(progress(t, from, enter));
    const b = inOut(progress(t, to - leave, leave));
    el.style.opacity = String(a * (1 - b));
    el.style.transform = `scale(${1.05 - 0.05 * a - 0.04 * b})`;
    el.style.visibility = t < from - 0.05 || t > to + 0.05 ? 'hidden' : 'visible';
  }

  /** Words land one after another, on eighth notes, each with a small spring. */
  function reveal(container, t, start, step = beat / 2, length = 0.5) {
    for (const [k, word] of [...container.querySelectorAll('.w')].entries()) {
      const x = progress(t, start + k * step, length);
      word.style.opacity = String(clamp(x * 4));
      word.style.transform = `translateY(${(1 - spring(x)) * 0.5}em)`;
    }
  }

  const GROUNDS = [
    [0, ['#e4e2ff', '#d9ecff', '#f5f6fb']],
    ...cast.map((step, i) => [moodAt(i), step.tint]),
    [T.customize, ['#dde7ff', '#ead9ff', '#f3f5fb']],
    [T.frameworks, ['#e6e9f2', '#e2f0ff', '#f6f7fb']],
    [T.end, ['#e4e2ff', '#d6f5ec', '#f5f6fb']],
  ];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k)).join(' ')})`;
  function ground(t) {
    let i = 0;
    while (i + 1 < GROUNDS.length && GROUNDS[i + 1][0] <= t) i++;
    const [at, now] = GROUNDS[i];
    const before = GROUNDS[Math.max(0, i - 1)][1];
    const k = inOut(progress(t, at, 0.4));
    now.forEach((colour, n) => document.documentElement.style.setProperty(`--g${n + 1}`, mix(before[n], colour, k)));
  }

  const LOOK = ['shape', 'color', 'accent', 'material', 'accessories', 'eye-shape'];
  function wear(el, look) {
    for (const key of LOOK) {
      if (key in look) el.setAttribute(key, look[key]);
      else el.removeAttribute(key);
    }
  }

  const hero = $('#hero');
  const fired = new Set();
  const events = [
    [T.heroPop + 0.6, () => hero.poke()],
    ...cast.map((step, i) => [
      moodAt(i),
      () => {
        wear(hero, step.attrs);
        hero.setAttribute('mood', step.mood);
      },
    ]),
  ];

  const rowEls = $$('#rows .row');
  const cellEls = $$('#rows .cell');
  const val = $('#chip .val');
  const caret = $('#chip .caret');
  const STEP = 218;

  window.render = (t) => {
    for (const [at, run] of events) {
      if (t >= at && !fired.has(at)) {
        fired.add(at);
        run();
      }
    }
    ground(t);

    // The hook: the mascot springs up on the second beat, then the line lands word by word.
    scene($('#s-hook'), t, 0, T.hookOut + 0.25, 0.01);
    reveal($('#hook'), t, T.hookWords);
    // The hero: up top for the hook, then down to the middle for the moods.
    scene($('#s-hero'), t, 0, T.customize, 0.01);
    const down = inOut(progress(t, T.hookOut - 0.1, 0.45));
    const swap = cast.map((_, i) => moodAt(i)).findLast((at) => t >= at);
    const bump = swap === undefined ? 1 : 0.92 + 0.08 * spring(progress(t, swap, 0.6));
    const pop = spring(progress(t, T.heroPop, 0.9));
    $('#hero-wrap').style.transform = `translateY(${-130 * (1 - down) - 20 * down}px) scale(${pop * bump * (0.88 + 0.12 * down)})`;

    // The moods: the chip types each one as the hero takes it on.
    scene($('#s-moods'), t, T.moods, T.customize);
    const chip = outQuint(progress(t, T.moods, 0.4));
    $('#chip').style.transform = `translateX(-50%) translateY(${(1 - chip) * 30}px)`;
    const step = cast.findLastIndex((_, i) => t >= moodAt(i));
    const word = step < 0 ? '' : cast[step].mood;
    const typed = step < 0 ? 0 : Math.ceil(clamp((t - moodAt(step)) / (word.length * 0.03)) * word.length);
    val.textContent = word.slice(0, typed);
    caret.style.opacity = typed < word.length || Math.floor(t * 4) % 2 === 0 ? '1' : '0';

    // Customize: rows of mascots pour past, every other row the other way, under the line.
    scene($('#s-customize'), t, T.customize, T.frameworks);
    // 85px a second for 8 seconds, centred: a row is 1962px long and the turned frame 1220px wide,
    // so neither end ever comes into view.
    const travel = (t - T.customize) * 85 - 340;
    rowEls.forEach((row, r) => {
      const dir = r % 2 ? 1 : -1;
      const x = -(perRow * STEP) / 2 + dir * travel;
      row.style.transform = `rotate(-8deg) translate(${x}px, ${(r - rows / 2) * STEP + 9}px)`;
    });
    cellEls.forEach((cell, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const p = spring(progress(t, T.customize + 0.05 + Math.abs(c - perRow / 2) * 0.05 + Math.abs(r - rows / 2) * 0.05, 0.7));
      cell.style.transform = `scale(${p})`;
    });
    const card = spring(progress(t, T.customize + 0.25, 0.8));
    $('#customize-card').style.transform = `translateY(-50%) scale(${0.85 + 0.15 * card})`;
    $('#customize-card').style.opacity = String(clamp(card * 3));
    reveal($('#customize-title'), t, T.customize + 0.5, beat / 4);

    // Frameworks: the line, then a logo on each beat.
    scene($('#s-frameworks'), t, T.frameworks, T.end);
    reveal($('#fw-title'), t, T.frameworks + 0.25, beat / 2);
    $$('.logo').forEach((el, i) => {
      const p = spring(progress(t, T.logos + i * beat, 0.7));
      el.style.transform = `translateY(${(1 - p) * 60}px) scale(${0.6 + 0.4 * p})`;
      el.style.opacity = String(clamp(p * 3));
    });

    // The end card: the gallery turns slowly behind the name, which lands on the downbeat.
    scene($('#s-end'), t, T.end, T.seconds + 1, 0.35);
    const zoom = progress(t, T.end, T.seconds - T.end);
    $('#gallery').style.transform = `translate(-50%, -50%) rotate(-9deg) scale(${1.06 + zoom * 0.06})`;
    const panel = spring(progress(t, T.end, 0.8));
    $('#panel').style.transform = `scale(${0.9 + 0.1 * panel})`;
    reveal($('#end-title'), t, T.end + 0.25, 0.04, 0.6);
    for (const [i, id] of ['#end-lead', '#install', '#url'].entries()) {
      const p = spring(progress(t, T.end + 1 + i * beat, 0.7));
      const el = $(id);
      el.style.opacity = String(clamp(p * 3));
      el.style.transform = `translate(${id === '#install' ? '-50%' : '0'}, ${(1 - p) * 30}px)`;
    }
  };
}
/* oxlint-enable unicorn/consistent-function-scoping */

/** Every sound the picture asks for, in seconds, for audio.py. */
function cues() {
  const list = [
    { t: TIMELINE.heroPop, type: 'pop', n: 0 },
    { t: TIMELINE.heroPop + 0.6, type: 'boop', n: 0 },
  ];
  MOOD_CAST.forEach((step, i) => {
    list.push({ t: moodStart(i), type: 'swap', n: i });
    for (let k = 0; k < step.mood.length; k++) list.push({ t: moodStart(i) + 0.05 + k * 0.03, type: 'key', n: k });
  });
  list.push({ t: TIMELINE.customize - 0.5, type: 'whoosh', length: 0.5 }, { t: TIMELINE.customize, type: 'hit' });
  for (let k = 0; k < 10; k++) list.push({ t: TIMELINE.customize + 0.08 + k * 0.06, type: 'bubble', n: k });
  list.push({ t: TIMELINE.frameworks - 0.5, type: 'whoosh', length: 0.5 }, { t: TIMELINE.frameworks, type: 'hit' });
  FRAMEWORKS.forEach((_, i) => list.push({ t: TIMELINE.logos + i * BEAT, type: 'pluck', n: i }));
  list.push({ t: TIMELINE.end - 1, type: 'riser', length: 1 }, { t: TIMELINE.end, type: 'hit' }, { t: TIMELINE.end + 0.25, type: 'sparkle' });
  return list.toSorted((a, b) => a.t - b.t);
}

await mkdir(base, { recursive: true });
await writeFile(join(base, 'cues.json'), JSON.stringify({ seconds: SECONDS, bpm: 60 / BEAT, cues: cues() }, null, 2));

if (!skipFrames) {
  const { page, errors } = await openStage({ width: SIZE, height: SIZE, css, body });
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await page.evaluate(setup, {
    cast: MOOD_CAST.map((step, i) => ({ ...step, tint: TINTS[i] })),
    T: TIMELINE,
    beat: BEAT,
    rows: GRID_ROWS,
    perRow: GRID_PER_ROW,
  });
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const total = SECONDS * FPS;
  let clock = 0;
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await page.evaluate((now) => window.render(now), t);
    // Whole milliseconds that add up to exactly 1000/FPS on average.
    const next = Math.round(((i + 1) * 1000) / FPS);
    await advance(page, next - clock);
    clock = next;
    await saveFrame(work, i, await shot(page, { x: 0, y: 0, width: SIZE, height: SIZE }));
    if (i % (FPS * 5) === 0) console.log(`${t}s`);
  }
  if (errors.length) throw new Error(`the stage logged: ${errors.join('; ')}`);
  await page.close();
  await closeBrowser();
}

const audio = join(base, 'score.wav');
execFileSync('python3', [fileURLToPath(new URL('audio.py', import.meta.url)), join(base, 'cues.json'), audio], { stdio: 'inherit' });
// prettier-ignore
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-framerate', String(FPS), '-i', join(work, '%04d.png'),
  '-i', audio,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
  '-shortest', '-movflags', '+faststart', out,
], { stdio: 'inherit' });
console.log(`wrote ${out}`);
