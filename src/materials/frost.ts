import { about, blur, fix, inset, set, stops, svg } from '../dom.js';
import type { Material } from './types.js';

/** Milky ice with colour pooling low inside. Eyes are holes cut through to the page. */
export const frost: Material = ({ defs, paint, silhouette, solid }) => {
  defs.append(
    blur('soft', 13),
    inset('wall', 4.5),
    svg('linearGradient', { id: 'ice', x1: 0, y1: 0, x2: 0, y2: 1 }, ...stops([0, 'ice-0'], [1, 'ice-1'])),
  );
  // A rect, cut by the mask: a fill on the silhouette would miss the melted joins, and
  // give each of its parts a gradient of its own.
  const ice = svg('rect', { x: -20, width: 280, fill: 'url(#ice)' });
  const tint = svg('use', { href: `#${silhouette}`, class: 'tint', filter: 'url(#soft)' });
  // Ice thickens towards its edge. That gives it a form on white, without a line around it.
  const wall = svg('use', { href: `#${solid}`, class: 'wall', filter: 'url(#wall)' });
  paint.append(ice, tint, wall);
  return {
    layout(g) {
      set(ice, { y: fix(g.top), height: fix(g.bottom - g.top) });
      set(tint, { transform: `translate(-6 18) ${about(120, g.cy, 'scale(.88 .84)')}` });
    },
  };
};

export const frostCss = String.raw`
[data-material='frost'] {
  --ice-0: oklch(from var(--_c) .995 calc(c * .04) h);
  --ice-1: oklch(from var(--_c) .96 calc(c * .24) h / .95);
  --tint: oklch(from var(--_c) clamp(.6, l, .9) calc(c * 1.4) h / .46);
  --wall: oklch(from var(--_c) clamp(.6, l, .76) c h);
  --wall-a: .38;
  --halo-a: .2;
  --edge-a: .5;
  --e0: oklch(from var(--_c) clamp(.3, calc(l - .3), .44) calc(c * 1.5) h);
  --e1: oklch(from var(--_c) clamp(.36, calc(l - .24), .5) calc(c * 1.4) h);
  --e2: oklch(from var(--_c) clamp(.48, calc(l - .12), .62) calc(c * 1.2) h);
  --eye-lip: oklch(from var(--_c) clamp(.42, calc(l - .16), .6) c h / .38);
}
`;
