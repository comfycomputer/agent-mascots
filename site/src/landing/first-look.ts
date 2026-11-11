// The landing page is written wearing the first preset, but a visit gets a random one. The
// element draws as soon as the library loads, before the page hydrates, so a pick made in
// onMount would show the first preset for a moment first. This script makes the pick instead.
// It runs inline in the head, before the body is parsed: it tints the ground, and puts the
// look on each mascot as the parser adds it, before any module script can upgrade it.
//
// Each mascot that wears the look says how much of it with `data-wears`, matching look.ts:
// "look" for all of it, "face" for the shape and eyes, "face-tone" for those and the colours.

import { FACE, FACE_AND_TONE } from './look';
import { PRESETS } from './presets';

type Pick = { name: string; attrs: Record<string, string>; ground: readonly string[] };

/** Stringified into the page, so it must not use anything from outside its own body. */
function wearFirst(presets: Pick[], keys: Record<string, string[]>) {
  // A link brings its own look, or names a section: the page handles those once it runs.
  if (location.hash.length > 1) return;
  const preset = presets[Math.floor(Math.random() * presets.length)]!;
  const root = document.documentElement;
  root.dataset.preset = preset.name;
  preset.ground.forEach((colour, i) => root.style.setProperty(`--g${i + 1}`, colour));

  const dress = () => {
    for (const mascot of document.querySelectorAll<HTMLElement>('[data-wears]:not([data-worn])')) {
      for (const key of keys[mascot.dataset.wears!] ?? []) {
        const value = preset.attrs[key];
        if (value === undefined) mascot.removeAttribute(key);
        else mascot.setAttribute(key, value);
      }
      mascot.dataset.worn = '';
    }
  };
  // The parser runs its microtasks before each script it meets, so this has dressed every
  // mascot above SvelteKit's start script by the time that script runs.
  const watch = new MutationObserver(dress);
  watch.observe(root, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => {
    watch.disconnect();
    dress();
  });
}

const KEYS = {
  look: [...new Set(PRESETS.flatMap((preset) => Object.keys(preset.attrs)))],
  face: FACE,
  'face-tone': FACE_AND_TONE,
};

/** The inline script, for the landing page's head. */
export const FIRST_LOOK_SCRIPT = `<script>(${wearFirst})(${JSON.stringify(PRESETS)},${JSON.stringify(KEYS)})</script>`;
