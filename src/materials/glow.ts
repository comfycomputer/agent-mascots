import { about, blur, fix, set, stops, svg } from '../dom.js';
import type { Material } from './types.js';

/** A saturated body lit from inside, with a pale rim that reaches further in at the top. */
export const glow: Material = ({ defs, paint, silhouette }) => {
  const soft = blur('soft', 5.5);
  defs.append(
    soft,
    svg('linearGradient', { id: 'rim', x1: 0, y1: 0, x2: 0, y2: 1 }, ...stops([0, 'rim-0'], [1, 'rim-1'])),
    svg('radialGradient', { id: 'core', cx: 0.5, cy: 0.4, r: 0.74 }, ...stops([0, 'core-0'], [0.55, 'core-1'], [1, 'core-2'])),
  );
  const rim = svg('rect', { x: -20, y: -20, width: 280, height: 280, fill: 'url(#rim)' });
  const core = svg('use', { href: `#${silhouette}`, fill: 'url(#core)', filter: 'url(#soft)' });
  paint.append(rim, core);
  let cy = 120;
  let size = 0;
  // A rim a few pixels wide at full size would be one pale, blurred pixel on a small mascot,
  // and on white that is the edge gone. So the core grows towards the outline as it shrinks.
  const place = () => {
    set(core, {
      transform: `translate(0 ${fix(4 - size * 2)}) ${about(120, cy, `scale(${fix(0.95 + size * 0.03)} ${fix(0.93 + size * 0.04)})`)}`,
    });
    set(soft.firstChild as Element, { stdDeviation: fix(5.5 - size * 2.5) });
  };
  return {
    layout(g) {
      cy = g.cy;
      set(rim, { y: fix(g.top - 12), height: fix(g.bottom - g.top + 24) });
      place();
    },
    fit(small) {
      size = small;
      place();
    },
  };
};

export const glowCss = String.raw`
[data-material='glow'] {
  --rim-0: oklch(from var(--_c) .95 calc(c * .28) h);
  --rim-1: oklch(from var(--_c) .9 calc(c * .5) h);
  --_top: calc(.8 + (.16 - min(c, .16)) * 1.1);
  --_pale: clamp(0, (.8 - l) * 99, 1);
  /* The core is lifted to read as lit from inside, but a dark colour is lifted less, so a black
     body stays black: charcoal in the middle, a little lighter towards the rim. */
  --core-0: oklch(from var(--_c) clamp(min(.5, calc(l + .12)), l, var(--_top)) calc(c * 1.04) h);
  --core-1: oklch(from var(--_c) clamp(min(.56, calc(l + .18)), calc(l + .03), calc(var(--_top) + .05)) c calc(h + 4));
  --core-2: oklch(from var(--_c) clamp(min(.68, calc(l + .3)), calc(l + .12), .86) calc(c * .86) calc(h + 8));
  --halo-a: .26;
  --edge-a: .8;
  --e0: oklch(from var(--_c) calc(.25 + .75 * var(--_pale)) calc(c * .1) h);
  --e1: oklch(from var(--_c) calc(.25 + .72 * var(--_pale)) calc(c * .1) h);
  --e2: oklch(from var(--_c) calc(.25 + .66 * var(--_pale)) calc(c * .28) h);
  --eye-lip: oklch(from var(--_c) calc(l * .6) c h / .24);
}
[data-sky][data-material='glow'] { --rim-1: #fff; }
`;
