import { fix, set, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** u, v in -1..1 across the body; r in design units. */
const SPOTS = [
  [-0.74, -0.22, 6.5],
  [0.72, -0.3, 7.5],
  [-0.28, -0.74, 7],
  [0.32, -0.8, 5],
  [0.84, 0.3, 3.5],
] as const;

registerAccessory('spots', {
  css: String.raw`
.ac-spot { fill: #ffffffeb; }
.tile:not([data-material='glow']) .ac-spot { fill: var(--tint, var(--_c)); opacity: .55; }
`,
  build({ inside }) {
    const dots = SPOTS.map(([, , r]) => svg('ellipse', { class: 'ac-spot', rx: r, ry: fix(r * 0.85) }));
    inside.append(...dots);
    return {
      layout(g) {
        dots.forEach((dot, i) => {
          const [u, v] = SPOTS[i] as (typeof SPOTS)[number];
          set(dot, { cx: fix(120 + u * g.half), cy: fix(g.cy + v * g.hh) });
        });
      },
    };
  },
});
