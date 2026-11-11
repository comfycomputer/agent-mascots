import { fix, set, stops, svg } from '../dom.js';
import { topAt } from '../path.js';
import { registerAccessory } from '../registry.js';

/**
 * Degrees a low mood folds each blade down, and leans the sprig left. Lopsided, like a real
 * wilt, and away from the sweat drop and the Zs on the right.
 */
const FOLD_LEFT = 22;
const FOLD_RIGHT = 14;
const LEAN = -6;
/** Degrees each blade flutters. */
const FLUTTER = 4;

registerAccessory('leaf', {
  css: String.raw`
.ac-sprig { fill: none; stroke: #4db548; stroke-width: 5; stroke-linecap: round; }
.ac-vein { fill: none; stroke: #ffffff8c; stroke-width: 2; stroke-linecap: round; }
.tile { --ac-leaf-0: #b9f09a; --ac-leaf-1: #4db548; }
`,
  above: 36,
  build({ back, defs, config }) {
    defs.append(svg('linearGradient', { id: 'ac-leaf', x1: 0, y1: 0, x2: 0, y2: 1 }, ...stops([0, 'ac-leaf-0'], [1, 'ac-leaf-1'])));
    const blade = { fill: 'url(#ac-leaf)' };
    const vein = { class: 'ac-vein' };
    const left = svg(
      'g',
      {},
      svg('path', { ...blade, d: 'M123 72C110 54 88 52 80 60C88 76 110 80 123 72Z' }),
      svg('path', { ...vein, d: 'M86 61C96 64 108 68 120 71' }),
    );
    const right = svg(
      'g',
      {},
      svg('path', { ...blade, d: 'M124 70C136 48 160 46 168 54C160 72 138 78 124 70Z' }),
      svg('path', { ...vein, d: 'M162 55C150 59 138 64 127 69' }),
    );
    const sprig = svg('g', {}, svg('path', { class: 'ac-sprig', d: 'M120 80C120 74 121 70 123 66' }), left, right);
    const pivot = svg('g', {}, sprig);
    back.append(pivot);
    // Where the middle of the head is, which on a heart or a cat is below its highest point.
    const crown = topAt(config.shape);
    let top = 0;
    return {
      layout(g) {
        top = crown(g, 120);
        set(sprig, { transform: `translate(0 ${fix(top - 74)})` });
      },
      animate(clock) {
        const { phase, droop } = clock;
        const life = Math.min(1, clock.motion) * (1 - droop * 0.7);
        const sway = Math.sin(phase * 1.6) * 5 * life + droop * LEAN;
        set(pivot, { transform: `rotate(${fix(sway)} 121 ${fix(top + 4)})` });
        // Each blade flutters on its own beat, and a low mood folds both down from the stem.
        const flutter = FLUTTER * life;
        set(left, { transform: `rotate(${fix(Math.sin(phase * 2.7) * flutter - droop * FOLD_LEFT)} 123.5 71)` });
        set(right, { transform: `rotate(${fix(Math.sin(phase * 2.7 + 2) * flutter + droop * FOLD_RIGHT)} 123.5 71)` });
      },
    };
  },
});
