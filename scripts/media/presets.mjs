// The pictures in the landing page's preset gallery: each preset in site/src/landing/presets.ts, drawn
// by the real component at full detail, still, with no shadow, on a transparent ground. Run after
// `bun run build`:
//
//   bun scripts/media/presets.mjs
//
// The page shows them as images because it may only run a few full-detail mascots at once, and the
// simple renderer leaves accessories out. Picking one puts the live preset in the hero.
// oxlint-disable no-console -- this script's output is its report
import { join } from 'node:path';
import { PRESETS } from '../../site/src/landing/presets.ts';
import { advance, closeBrowser, openStage, root, saveFile, shot } from './stage.mjs';

/** CSS pixels: the largest the gallery draws them, at twice that for sharp screens. */
const SIZE = 160;
const SCALE = 2;
const QUALITY = 0.78;

const attributes = (attrs) =>
  Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');

const cells = PRESETS.map(
  ({ attrs }) => `<agent-mascot detail="full" shadow="none" motion="0" track="none"${attributes(attrs)} style="width:${SIZE}px"></agent-mascot>`,
).join('');

const { page, errors } = await openStage({
  width: SIZE,
  height: SIZE * PRESETS.length,
  scale: SCALE,
  css: 'body { display: flex; flex-direction: column; } agent-mascot { display: block; }',
  body: cells,
});
await advance(page, 1000);
if (errors.length) throw new Error(`the stage logged: ${errors.join('; ')}`);

for (const [index, { name }] of PRESETS.entries()) {
  const png = await shot(page, { x: 0, y: index * SIZE, width: SIZE, height: SIZE }, true);
  // Chromium encodes WebP with alpha, so no other tool is needed.
  const webp = await page.evaluate(
    async ({ data, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/webp', quality).split(',')[1];
    },
    { data: png.toString('base64'), quality: QUALITY },
  );
  const bytes = Buffer.from(webp, 'base64');
  await saveFile(join(root, 'site/src/landing/presets', `${name}.webp`), bytes);
  console.log(`${name}.webp ${bytes.length} B`);
}
await closeBrowser();
