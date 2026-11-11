// Pictures of the icon frame: its mascot's shadow DOM, drawn into an SVG image and painted onto
// a canvas, so nothing leaves the device and nothing needs a server.

import { blobOf, canvasOf, copyTile, imageOf, pictureOf, save, stylesOf, xhtml } from '../lib/snapshot';

/** Long enough to show every mood's loop at least once. */
export const SECONDS = 4;
const FPS = 30;
/**
 * The video's size. The browser rasterises every frame on the CPU, blurs and all, so much larger
 * falls well short of the frame rate.
 */
export const VIDEO_PX = 432;
/** Best first: MP4 plays everywhere, and WebM is what Chromium and Firefox record. */
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

/** The frame, its mascot and how the mascot sits in it, as they show right now. */
export interface Frame {
  frame: HTMLElement;
  mascot: HTMLElement;
  /** The mascot's CSS transform in the frame. */
  transform: string;
  /** The ground, or null for none. */
  fill: string | null;
}

export const canRecord = () => 'MediaRecorder' in window && 'captureStream' in HTMLCanvasElement.prototype;

/** The frame as markup for an SVG image `px` pixels square. `css` is the mascot's, from `stylesOf`. */
function markupOf({ frame, mascot, transform, fill }: Frame, css: string, px: number): string {
  const size = frame.clientWidth;
  // The mascot at its own size and place in the frame, then moved, turned and sized as it shows.
  const seat = xhtml('div', `position:absolute;left:${mascot.offsetLeft}px;top:${mascot.offsetTop}px;width:${mascot.offsetWidth}px;height:${mascot.offsetHeight}px;transform:${transform}`);
  seat.append(copyTile(mascot));
  const box = xhtml('div', `position:relative;width:${size}px;height:${size}px;overflow:hidden${fill ? `;background:${fill}` : ''}`);
  box.append(seat);
  return pictureOf(box, css, size, size, px);
}

/** The frame drawn once, `px` square. */
export const pictureOfFrame = (frame: Frame, px: number) => imageOf(markupOf(frame, stylesOf(frame.mascot.shadowRoot!), px));

const fileName = (mascot: HTMLElement & { shape?: string; mood?: string }, end: string) => `mascot-${mascot.shape}-${mascot.mood}${end}`;

export async function downloadImage(frame: Frame, px: number): Promise<void> {
  const { canvas, ctx } = canvasOf(px);
  ctx.drawImage(await pictureOfFrame(frame, px), 0, 0, px, px);
  const blob = await blobOf(canvas, 'image/png');
  if (!blob) throw new Error('The browser drew no PNG');
  save(blob, fileName(frame.mascot, `-${px}.png`));
}

/**
 * Records `SECONDS` of the frame moving. `frame()` is read for every frame of video, and
 * `onSecond(left)` hears the countdown. False if this browser can't record.
 */
export async function recordVideo(frame: () => Frame, fill: string, onSecond: (left: number) => void): Promise<boolean> {
  const type = VIDEO_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!type) return false;
  const { canvas, ctx } = canvasOf(VIDEO_PX);
  const css = stylesOf(frame().mascot.shadowRoot!);
  // Frames are pushed by hand, so a slow one stretches rather than repeats.
  const stream = canvas.captureStream(0);
  const [track] = stream.getVideoTracks() as CanvasCaptureMediaStreamTrack[];
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
  const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve));
  recorder.start();
  const start = performance.now();
  let left = -1;
  for (let at = start; at - start < SECONDS * 1000; at = performance.now()) {
    const seconds = Math.ceil(SECONDS - (at - start) / 1000);
    if (seconds !== left) onSecond((left = seconds));
    const image = await imageOf(markupOf(frame(), css, VIDEO_PX));
    // A video has no transparency: the ground goes under every frame.
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, VIDEO_PX, VIDEO_PX);
    ctx.drawImage(image, 0, 0, VIDEO_PX, VIDEO_PX);
    track?.requestFrame();
    const wait = start + Math.ceil((performance.now() - start) / (1000 / FPS)) * (1000 / FPS) - performance.now();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, wait)));
  }
  recorder.stop();
  await stopped;
  save(new Blob(chunks, { type }), fileName(frame().mascot, type.startsWith('video/mp4') ? '.mp4' : '.webm'));
  return true;
}
