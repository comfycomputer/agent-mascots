import { fix, set, stops, svg } from '../dom.js';
import { topAt } from '../path.js';
import { registerAccessory } from '../registry.js';

/** One horn, curling out. Its root sinks well below the head, so a rounded top never shows it. */
const HORN = 'M-10 18C-11 2-8-10-13-24Q-14-28-11-26C1-18 9-6 10 18Z';

registerAccessory('horns', {
  css: String.raw`
.tile { --ac-horn-0: #fff6d8; --ac-horn-1: var(--_a); --ac-horn-2: var(--_a); }
@supports (color: oklch(from red l c h)) {
  .tile {
    --ac-horn-0: oklch(from var(--_a) .97 calc(c * .3) h);
    --ac-horn-2: oklch(from var(--_a) calc(l - .2) c calc(h - 14));
  }
}
`,
  above: 30,
  build({ back, defs, config }) {
    // Lit at the tip, deepening into the head.
    defs.append(svg('linearGradient', { id: 'ac-horn', x1: 0.2, y1: 1, x2: 0.5, y2: 0 }, ...stops([0.3, 'ac-horn-2'], [0.7, 'ac-horn-1'], [1, 'ac-horn-0'])));
    const left = svg('path', { d: HORN, fill: 'url(#ac-horn)' });
    const right = svg('path', { d: HORN, fill: 'url(#ac-horn)' });
    back.append(left, right);
    const top = topAt(config.shape);
    return {
      layout(g) {
        const x = g.half * 0.38;
        set(left, { transform: `translate(${fix(120 - x)} ${fix(top(g, 120 - x))})` });
        set(right, { transform: `translate(${fix(120 + x)} ${fix(top(g, 120 + x))}) scale(-1 1)` });
      },
    };
  },
});
