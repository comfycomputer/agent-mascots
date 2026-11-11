// The preset marquee: rows of cards drifting sideways, every other row the other way. Each row is
// one transformed track, so moving it is a compositor job; a card that leaves one end goes round
// to the other, and comes back as a new preset when the generator has one ready.
//
// It runs only while the rows are in view, the tab is showing, and nobody has tabbed into it or
// paused it. Hovering and clicking don't stop it. Under reduced motion it never starts: the rows
// scroll by hand instead.

import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

/** CSS pixels a second, per row. Unequal, so the rows never line up. */
const SPEEDS = [26, 20, 32];
/** How quickly it eases to a stop or back up to speed: about a third of a second. */
const EASE = 6;

export interface MarqueeRows {
  /** How many cards row `row` has. */
  count(row: number): number;
  /** Adds `extra` cards to row `row`, copied from its own, in order. */
  extend(row: number, extra: number): void;
  /** Moves row `row`'s first card to its end, or with `leftward` false its last to its start, and gives it a new preset. */
  wrap(row: number, leftward: boolean): void;
  /** Read in an effect, so pausing and playing wake it. */
  paused(): boolean;
  /** Called once it is running, when the rows are its to move. */
  started(): void;
}

const place = (track: HTMLElement, x: number) => {
  track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
};

/** On the element that holds the rows. Does nothing under reduced motion. */
export const marquee =
  (rows: MarqueeRows): Attachment<HTMLElement> =>
  (root) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tracks = [...root.querySelectorAll<HTMLElement>('.presets__track')];
    if (!tracks.length) return;

    let step = 0;
    let width = 0;
    let inView = false;
    let focused = false;
    let speed = 0;
    let frame = 0;
    let last = 0;
    const offsets = tracks.map(() => 0);

    /** One card's width and the gap after it. Every card is the same size. */
    function measure() {
      const [first, second] = tracks[0]!.children as HTMLCollectionOf<HTMLElement>;
      if (!first) return;
      step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
      width = root.clientWidth;
      if (!step) return;
      // Wide enough to cover the row with a card spare at each end: top up from the row's own cards.
      tracks.forEach((_, row) => {
        const missing = Math.ceil((width + 3 * step) / step) - rows.count(row);
        if (missing > 0) rows.extend(row, missing);
      });
      tracks.forEach((track, row) => {
        offsets[row] = -step - (row * step) / 3;
        place(track, offsets[row]!);
      });
    }

    function tick(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // A row with no width, as when the page hides it, has nowhere to go.
      if (!step) {
        frame = 0;
        return;
      }
      const target = inView && !focused && !rows.paused() && !document.hidden ? 1 : 0;
      speed += (target - speed) * Math.min(1, dt * EASE);
      if (target === 0 && speed < 0.01) {
        speed = 0;
        frame = 0;
        return;
      }
      tracks.forEach((track, row) => {
        const leftward = row % 2 === 0;
        let x = offsets[row]! + (leftward ? -1 : 1) * SPEEDS[row % SPEEDS.length]! * speed * dt;
        // Keep one card hidden off the left end, whichever way the row runs.
        if (leftward) for (; x <= -2 * step; x += step) rows.wrap(row, true);
        else for (; x > -step; x -= step) rows.wrap(row, false);
        offsets[row] = x;
        place(track, x);
      });
      frame = requestAnimationFrame(tick);
    }

    function wake() {
      if (frame || !step) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    // Untracked: the rows change as cards go round, and that mustn't start it over.
    untrack(() => {
      measure();
      rows.started();
    });

    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      wake();
    });
    intersection.observe(root);

    let resized = 0;
    const resize = new ResizeObserver(() => {
      if (root.clientWidth === width) return;
      cancelAnimationFrame(resized);
      resized = requestAnimationFrame(measure);
    });
    resize.observe(root);

    // Hovering and clicking leave it running. A card reached by keyboard holds it, or the browser
    // would drop the focus as the card went round, and a keyboard user would lose their place.
    const onfocusin = (event: FocusEvent) => {
      focused = (event.target as Element).matches(':focus-visible');
      wake();
    };
    const onfocusout = (event: FocusEvent) => {
      if (root.contains(event.relatedTarget as Node | null)) return;
      focused = false;
      wake();
    };
    root.addEventListener('focusin', onfocusin);
    root.addEventListener('focusout', onfocusout);
    document.addEventListener('visibilitychange', wake);
    // Pausing eases it to a stop, and playing back up to speed: either way it needs a frame.
    $effect(() => {
      rows.paused();
      wake();
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resized);
      intersection.disconnect();
      resize.disconnect();
      root.removeEventListener('focusin', onfocusin);
      root.removeEventListener('focusout', onfocusout);
      document.removeEventListener('visibilitychange', wake);
    };
  };
