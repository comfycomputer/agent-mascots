// Every icon on the site, as data that Icon.svelte draws: brand marks from simple-icons, the rest
// from lucide, and the accessories drawn here. They take the text colour.

import { Clipboard, ClipboardCheck, Download, RotateCcw, Shuffle, Star, Undo2, X } from 'lucide';
import { siGithub, siHtml5, siReact, siSolid, siSvelte, siVuedotjs } from 'simple-icons';

type Part = [tag: string, attributes: Record<string, string | number>];

export interface IconData {
  /** A brand mark is filled; the rest are stroked. */
  filled: boolean;
  parts: readonly Part[];
}

const brand = ({ path }: { path: string }): IconData => ({ filled: true, parts: [['path', { d: path }]] });
const outline = (parts: readonly (readonly [string, object])[]): IconData => ({ filled: false, parts: parts as readonly Part[] });

export const ICONS = {
  github: brand(siGithub),
  html: brand(siHtml5),
  react: brand(siReact),
  vue: brand(siVuedotjs),
  svelte: brand(siSvelte),
  solid: brand(siSolid),
  clipboard: outline(Clipboard),
  clipboardCheck: outline(ClipboardCheck),
  star: outline(Star),
  undo: outline(Undo2),
  reset: outline(RotateCcw),
  shuffle: outline(Shuffle),
  download: outline(Download),
  close: outline(X),
} satisfies Record<string, IconData>;

export type IconName = keyof typeof ICONS;

/* Accessories: drawn for the playground, on a 24 grid like the rest. Each sits on a faint head, so
   it reads as worn: the dome's top is at y 7, its sides at x 6 and 18, its foot at y 19. */

const HEAD: Part = ['path', { d: 'M6 19v-6a6 6 0 0 1 12 0v6z', opacity: 0.35 }];
const dot = (cx: number, cy: number, r = 1.1): Part => ['circle', { cx, cy, r, fill: 'currentColor', stroke: 'none' }];
const worn = (...parts: Part[]): IconData => ({ filled: false, parts: [HEAD, ...parts] });

/** One per accessory, by its name. */
export const ACCESSORY_ICONS: Record<string, IconData> = {
  antenna: worn(['path', { d: 'M12 7V4' }], ['circle', { cx: 12, cy: 2.5, r: 1.5 }]),
  stalk: worn(['path', { d: 'M12 7c0-2 1.5-3 3.5-4' }], ['circle', { cx: 17, cy: 2.5, r: 1.5 }]),
  ears: worn(['path', { d: 'M6.6 10a2.5 2.5 0 0 0-.6 5' }], ['path', { d: 'M17.4 10a2.5 2.5 0 0 1 .6 5' }]),
  arms: worn(['path', { d: 'M6 15.5 3 13.5' }], ['path', { d: 'm18 15.5 3-2' }]),
  ring: worn(['ellipse', { cx: 12, cy: 14, rx: 10.5, ry: 3 }]),
  leaf: worn(['path', { d: 'M12 7V5' }], ['path', { d: 'M12 5c0-2.5 2.5-4 5.5-4 0 2.5-2 4-5.5 4z' }]),
  rays: worn(['path', { d: 'M12 2v2M6.3 7.3 4.9 5.9M17.7 7.3l1.4-1.4M2 13h2M20 13h2' }]),
  spots: worn(dot(9.5, 10.5), dot(14.5, 11.5), dot(9, 16), dot(15, 16.5)),
  stem: worn(['path', { d: 'm9.5 19 .5 3.5h4l.5-3.5' }]),
  tentacles: worn(['path', { d: 'M8.5 19c-1 1 1 2 0 3.5M12 19c-1 1 1 2 0 3.5M15.5 19c-1 1 1 2 0 3.5' }]),
  facets: worn(['path', { d: 'M9 13l3-6 3 6-3 6zM6 13h12' }]),
  blush: worn(['path', { d: 'm7 16.5 1-1.5M9 16.5l1-1.5M14 16.5l1-1.5M16 16.5l1-1.5' }]),
  sheen: worn(['path', { d: 'M8.5 12a4.5 4.5 0 0 1 3-3.3' }], dot(8.4, 14.2, 0.8)),
  iridescent: worn(['path', { d: 'M7.5 17a4.5 4.5 0 0 1 9 0M10 17a2 2 0 0 1 4 0' }]),
  bubbles: worn(['circle', { cx: 18.5, cy: 5, r: 2 }], ['circle', { cx: 21.5, cy: 9.5, r: 1.2 }], ['circle', { cx: 15, cy: 2.5, r: 1 }]),
  outline: worn(['path', { d: 'M4 21v-8a8 8 0 0 1 16 0v8', 'stroke-dasharray': '2 2.5' }]),
  horns: worn(['path', { d: 'M8 8.3 7 4l3.3 3.2' }], ['path', { d: 'm16 8.3 1-4.3-3.3 3.2' }]),
  halo: worn(['ellipse', { cx: 12, cy: 3.5, rx: 5, ry: 1.6 }]),
  crown: worn(['path', { d: 'M8 7.5 7.5 3l2.5 2 2-2.5 2 2.5 2.5-2-.5 4.5z' }]),
  bow: worn(['path', { d: 'M16 5 13 3v4zM16 5l3-2v4z' }], dot(16, 5, 0.8)),
  wings: worn(['path', { d: 'M6 13c-3 0-4.5-2.5-4.5-5 2 0 3.5.8 4.5 2.5' }], ['path', { d: 'M18 13c3 0 4.5-2.5 4.5-5-2 0-3.5.8-4.5 2.5' }]),
  tail: worn(['path', { d: 'M18 18.5c2.5 0 4-1.5 3.5-4.5' }]),
  whiskers: worn(['path', { d: 'M7.5 14H2M7.5 15.5 2.5 17.5M7.5 12.5 2.5 10.5M16.5 14H22M16.5 15.5l5 2M16.5 12.5l5-2' }]),
  glasses: worn(['circle', { cx: 9, cy: 14, r: 2.2 }], ['circle', { cx: 15, cy: 14, r: 2.2 }], ['path', { d: 'M11.2 14h1.6M6.8 14H6M17.2 14h.8' }]),
};
