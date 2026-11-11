// Cover images: a tilted wall of presets, each shown once, with the hero from the promo video's
// opening in front, the name, the line and the install command. Drawn at twice the size and scaled
// down. Two layouts:
//
//   square  1080 by 1080, the video's cover on X and LinkedIn
//   og      1200 by 630, the site's share image, site/static/og.png
//
// Run after `bun run build`:
//
//   bun scripts/media/thumbnail.mjs [square|og] [out]
//
// capture.mjs draws the og layout as its `social` scene.
// oxlint-disable no-console -- this script's output is its report
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PRESETS } from '../../site/src/landing/presets.ts';
import { advance, closeBrowser, openStage, root, saveFile, shot } from './stage.mjs';

const HERO = 'onyx';
const GAP = 14;

/**
 * Each layout's size, wall and placing. The square stacks the hero over the words; the og image
 * sets the words on the left and the hero over the wall on the right.
 */
const LAYOUTS = {
  square: {
    width: 1080,
    height: 1080,
    columns: 9,
    rows: 6,
    card: 150,
    css: `
      #wall { left: 50%; top: 330px; }
      #fade { background: radial-gradient(38% 36% at 50% 36%, rgb(245 246 251 / 0.85), rgb(245 246 251 / 0) 100%),
        linear-gradient(to bottom, rgb(245 246 251 / 0) 42%, #f5f6fb 62%); }
      #hero { left: 50%; top: 83px; width: 580px; margin-left: -290px; }
      #words { left: 0; right: 0; top: 680px; text-align: center; align-items: center; }
      #title { font-size: 150px; }
      #tagline { font-size: 46px; margin-top: 30px; }
      #install { font-size: 28px; margin-top: 40px; }`,
  },
  og: {
    width: 1200,
    height: 630,
    columns: 7,
    rows: 6,
    card: 128,
    css: `
      #wall { left: 860px; top: 315px; }
      #fade { background: radial-gradient(26% 46% at 72% 50%, rgb(245 246 251 / 0.85), rgb(245 246 251 / 0) 100%),
        linear-gradient(to right, #f5f6fb 50%, rgb(245 246 251 / 0) 66%); }
      #hero { left: 870px; top: 315px; width: 430px; margin: -215px 0 0 -215px; }
      #words { left: 72px; top: 50%; transform: translateY(-50%); align-items: flex-start; }
      #title { font-size: 100px; }
      #tagline { font-size: 34px; margin-top: 22px; }
      #install { font-size: 22px; margin-top: 34px; padding: 13px 22px; border-radius: 13px; }`,
  },
};

const attrs = (look) =>
  Object.entries(look)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

/** Draws a layout and writes it to `out`: JPEG or PNG by its extension. */
export async function renderCover(name, out) {
  const layout = LAYOUTS[name];
  if (!layout) throw new Error(`no layout ${name}: try ${Object.keys(LAYOUTS).join(' or ')}`);
  const { width, height, columns, rows, card } = layout;

  const hero = PRESETS.find((p) => p.name === HERO);
  // Every other preset, shuffled by a fixed seed so like never sits by like.
  let seed = 5;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wall = PRESETS.filter((p) => p.name !== HERO)
    .map((p) => ({ p, k: random() }))
    .toSorted((a, b) => a.k - b.k)
    .map(({ p }) => p)
    .slice(0, columns * rows);
  if (wall.length < columns * rows) throw new Error(`the wall needs ${columns * rows} presets besides ${HERO}, and there are ${wall.length}`);
  const pictures = await Promise.all(
    wall.map(async (p) => `data:image/webp;base64,${(await readFile(join(root, 'site/src/landing/presets', `${p.name}.webp`))).toString('base64')}`),
  );

  const css = `
    body { width: ${width}px; height: ${height}px; overflow: hidden; color: #0f1115; background: #f5f6fb; font-family: Recursive, sans-serif; }
    .ground { position: absolute; inset: 0;
      background: radial-gradient(70% 60% at 88% 6%, #e2dcff, transparent 70%), radial-gradient(70% 65% at 4% 96%, #d6e8ff, transparent 70%), #f5f6fb; }
    #wall { position: absolute; display: grid; grid-template-columns: repeat(${columns}, ${card}px); gap: ${GAP}px;
      transform: translate(-50%, -50%) rotate(-8deg); }
    #wall div { width: ${card}px; height: ${card}px; border-radius: ${card * 0.24}px; display: grid; place-items: center; background: rgb(255 255 255 / 0.75);
      box-shadow: 0 10px 26px rgb(30 34 60 / 0.10), inset 0 0 0 1px rgb(255 255 255 / 0.9); }
    #wall img { width: ${card * 0.85}px; height: ${card * 0.85}px; }
    /* The wall fades out behind the words, and clears a little round the hero so it stands forward. */
    #fade { position: absolute; inset: 0; }
    #hero { position: absolute; display: block; filter: drop-shadow(0 30px 40px rgb(15 17 21 / 0.18)); }
    #words { position: absolute; display: flex; flex-direction: column; }
    #title { margin: 0; font-family: Fraunces, serif; font-weight: 700; font-variation-settings: "SOFT" 30, "WONK" 0;
      letter-spacing: -0.035em; line-height: 1; }
    #tagline { margin-bottom: 0; font-family: Recursive, sans-serif; font-variation-settings: "MONO" 0, "CASL" 0.4; font-weight: 600;
      letter-spacing: -0.01em; color: rgb(15 17 21 / 0.78); }
    #tagline .em { color: #4f46e5; }
    #install { padding: 16px 28px; border-radius: 16px; white-space: pre; background: #0f1115; color: #eef0f6;
      font-family: Recursive, monospace; font-variation-settings: "MONO" 1, "CASL" 0; }
    #install b { color: #7cf5c8; font-weight: 500; }
    ${layout.css}`;

  const body = `
    <div class="ground"></div>
    <div id="wall">${pictures.map((src) => `<div><img src="${src}" alt=""></div>`).join('')}</div>
    <div id="fade"></div>
    <agent-mascot id="hero" detail="full" motion="0" track="none" mood="idle" ${attrs(hero.attrs)}></agent-mascot>
    <div id="words">
      <h1 id="title">agent-mascots</h1>
      <p id="tagline">Give your <span class="em">AI agent</span> a face.</p>
      <div id="install"><b>$</b> npm i @comfycomputer/agent-mascots</div>
    </div>`;

  const { page, errors } = await openStage({ width, height, scale: 2, css, body });
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await advance(page, 1500);
  const png = join(tmpdir(), `agent-mascots-cover-${name}.png`);
  await saveFile(png, await shot(page, { x: 0, y: 0, width, height }));
  if (errors.length) throw new Error(`the stage logged: ${errors.join('; ')}`);
  await page.close();

  // Scaled down from twice the size, which smooths every edge.
  const quality = out.endsWith('.png') ? ['-compression_level', '9'] : ['-q:v', '2'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', `scale=${width}:${height}:flags=lanczos`, ...quality, out], { stdio: 'inherit' });
  console.log(`wrote ${out}`);
}

if (import.meta.main) {
  const name = process.argv[2] ?? 'square';
  const base = process.env.MEDIA_WORK ?? join(tmpdir(), 'agent-mascots-media');
  const fallback = name === 'og' ? join(root, 'site/static/og.png') : join(base, 'thumbnail.jpg');
  await renderCover(name, resolve(process.argv[3] ?? fallback));
  await closeBrowser();
}
