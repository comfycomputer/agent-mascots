import { fix, set, stops, svg } from '../dom.js';
import { topAt } from '../path.js';
import { registerAccessory } from '../registry.js';

/** Degrees it sits askew at rest, and how much further a low mood tips it. */
const RAKE = -7;
const SLUMP = -12;

registerAccessory('crown', {
  css: String.raw`
.ac-crown-band { fill: var(--ac-crown-2); }
.ac-crown-jewel { fill: var(--_c); stroke: #fff; stroke-width: 1.2; }
.ac-crown-glint { fill: #fff; opacity: .85; }
.tile { --ac-crown-0: #fff6d8; --ac-crown-1: var(--_a); --ac-crown-2: var(--_a); }
@supports (color: oklch(from red l c h)) {
  .tile {
    --ac-crown-0: oklch(from var(--_a) .97 calc(c * .35) h);
    --ac-crown-2: oklch(from var(--_a) calc(l - .16) c calc(h - 12));
  }
}
`,
  above: 30,
  build({ front, defs, config }) {
    defs.append(svg('linearGradient', { id: 'ac-crown', x1: 0, y1: 0, x2: 0.4, y2: 1 }, ...stops([0, 'ac-crown-0'], [0.55, 'ac-crown-1'], [1, 'ac-crown-2'])));
    const crown = svg(
      'g',
      {},
      svg('path', { fill: 'url(#ac-crown)', d: 'M-19 2L-22-18Q-22-21-19-19L-10-11L-2-24Q0-27 2-24L10-11L19-19Q22-21 22-18L19 2Q0 6-19 2Z' }),
      svg('path', { class: 'ac-crown-band', d: 'M-19.6-3Q0 1 19.6-3L19 2Q0 6-19 2Z' }),
      svg('circle', { class: 'ac-crown-jewel', cy: -8, r: 3.6 }),
      svg('circle', { class: 'ac-crown-glint', cx: -13, cy: -9, r: 1.4 }),
    );
    front.append(crown);
    const top = topAt(config.shape);
    let x = 120;
    let y = 0;
    const pose = (droop: number) =>
      set(crown, { transform: `translate(${x} ${fix(y + droop * 3)}) rotate(${fix(RAKE + droop * SLUMP)}) scale(1.2)` });
    return {
      layout(g) {
        x = fix(120 + g.half * 0.08);
        y = fix(top(g, x) + 3);
        pose(0);
      },
      animate(clock) {
        pose(clock.droop);
      },
    };
  },
});
