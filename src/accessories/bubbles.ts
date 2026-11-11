import { fix, set, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** How far a bubble rises over one life, and how long a life is, in accessory time. */
const RISE = 24;
const LIFE = [3.4, 2.6] as const;
/** Where in its life a still pose holds each bubble: fully in, part way up. */
const HOLD = 0.45;

function bubble(r: number): SVGGElement {
  const glint = r * 0.28;
  return svg(
    'g',
    {},
    svg('circle', { class: 'ac-bubble', cx: 0, cy: 0, r }),
    svg('ellipse', { class: 'ac-bubble-glint', cx: fix(-r * 0.33), cy: fix(-r * 0.33), rx: fix(glint), ry: fix(glint * 0.65) }),
  );
}

registerAccessory('bubbles', {
  css: String.raw`
.ac-bubble { fill: #ffffff38; stroke: var(--_c); stroke-width: 1.6; }
.ac-bubble-glint { fill: #fff; }
@supports (color: oklch(from red l c h)) {
  /* Kept off both ends, or a near-black rim vanishes on a dark backdrop and a near-white one on white. */
  .ac-bubble { stroke: oklch(from var(--_c) clamp(.62, l, .8) c h); }
}
.tile[data-sky] .ac-bubble { stroke: #fffc; }
`,
  reach: 1.3,
  build({ back }) {
    const bubbles = [bubble(9), bubble(6)];
    back.append(...bubbles);
    // Where each bubble starts its rise.
    const start: [number, number][] = [
      [0, 0],
      [0, 0],
    ];
    /**
     * Each bubble rises, wobbling, and swells a little as it goes. It fades in at the
     * bottom and out at the top, so the loop wraps unseen instead of popping.
     */
    const place = (i: number, u: number, t: number) => {
      const [x, y] = start[i] as [number, number];
      const fade = Math.sin(u * Math.PI);
      const wobble = Math.sin(t * (1.6 + i * 0.4) + i * 2) * (3 - i);
      set(bubbles[i] as SVGGElement, {
        transform: `translate(${fix(x + wobble)} ${fix(y - u * RISE)}) scale(${fix(0.85 + u * 0.25)})`,
        opacity: fix(Math.min(1, fade * 1.6)),
      });
    };
    return {
      layout(g) {
        start[0] = [g.left - 4, g.top + 26];
        start[1] = [g.right + 8, g.ground - 4];
        place(0, HOLD, 0);
        place(1, HOLD, 0);
      },
      animate(clock) {
        const t = clock.phase;
        for (let i = 0; i < 2; i++) {
          place(i, clock.still ? HOLD : ((t + i * 1.3) / (LIFE[i] as number)) % 1, t);
        }
      },
    };
  },
});
