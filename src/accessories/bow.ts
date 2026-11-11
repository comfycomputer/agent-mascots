import { fix, set, stops, svg } from '../dom.js';
import { topAt } from '../path.js';
import { registerAccessory } from '../registry.js';

/**
 * Degrees the bow sits at, how far it wiggles, and how far a low mood lets it flop. It sits on the
 * left, clear of the cues that float up over the right shoulder.
 */
const TILT = -18;
const WIGGLE = 3;
const FLOP = -22;

const loop = (side: number) =>
  svg('path', { d: `M0 0C${-6 * side}-11 ${-21 * side}-15 ${-23 * side}-5C${-24 * side} 4 ${-12 * side} 8 0 0Z` });

registerAccessory('bow', {
  css: String.raw`
.ac-bow path, .ac-bow circle { fill: url(#ac-bow); }
.ac-bow-glint { fill: none; stroke: #fff; stroke-width: 1.6; stroke-linecap: round; opacity: .75; }
.tile { --ac-bow-0: #ffc2d6; --ac-bow-1: #ff6f9f; --ac-bow-2: #d94279; }
`,
  above: 22,
  build({ front, defs, config }) {
    defs.append(svg('linearGradient', { id: 'ac-bow', x1: 0, y1: 0, x2: 0.3, y2: 1 }, ...stops([0, 'ac-bow-0'], [0.5, 'ac-bow-1'], [1, 'ac-bow-2'])));
    const bow = svg(
      'g',
      { class: 'ac-bow' },
      svg('path', { d: 'M-3 2L-9 15Q-6 13-3 15L1 4ZM3 2L9 14Q6 12 3 14L-1 4Z' }),
      loop(1),
      loop(-1),
      svg('circle', { r: 4.6 }),
      svg('path', { class: 'ac-bow-glint', d: 'M-19-6C-17-10-13-11-10-9' }),
    );
    front.append(bow);
    const top = topAt(config.shape);
    let x = 0;
    let y = 0;
    return {
      layout(g) {
        x = fix(120 - g.half * 0.5);
        y = fix(top(g, x) + 4);
        set(bow, { transform: `translate(${x} ${y}) rotate(${TILT})` });
      },
      animate(clock) {
        const { phase, droop } = clock;
        const wiggle = Math.sin(phase * 2.1) * WIGGLE * Math.min(1, clock.motion) * (1 - droop);
        set(bow, { transform: `translate(${x} ${y}) rotate(${fix(TILT + wiggle + droop * FLOP)})` });
      },
    };
  },
});
