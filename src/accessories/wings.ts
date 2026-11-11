import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** One wing, rooted at the origin and reaching right, its trailing edge scalloped in feathers. */
const WING = 'M0 0C10-20 34-30 50-24Q56-21 52-15C49-11 50-6 45-3C46 2 41 7 35 5C34 11 27 14 21 10C16 16 6 14 0 8Z';
/** Degrees a beat lifts the wing, and how far a low mood folds it down. */
const BEAT = 12;
const FOLD = 26;

const wing = (): SVGGElement =>
  svg(
    'g',
    {},
    svg('path', { class: 'ac-wing', d: WING }),
    svg('path', { class: 'ac-wing-quill', d: 'M8 0C18-8 30-12 42-12M8 4C16 0 24-1 33-1' }),
  );

registerAccessory('wings', {
  css: String.raw`
.ac-wing { fill: url(#ac-wing); stroke: var(--ac-wing-edge); stroke-width: 1.6; stroke-linejoin: round; }
.ac-wing-quill { fill: none; stroke: var(--ac-wing-edge); stroke-width: 1.4; stroke-linecap: round; }
.tile { --ac-wing-0: #fff; --ac-wing-1: #dfe8f1; --ac-wing-edge: #9fb2c6; }
@supports (color: oklch(from red l c h)) {
  .tile {
    --ac-wing-1: oklch(from var(--_c) .88 calc(c * .4) h);
    --ac-wing-edge: oklch(from var(--_c) clamp(.55, calc(l - .04), .7) calc(c * .7) h);
  }
}
`,
  reach: 1.6,
  build({ back, defs }) {
    defs.append(svg('linearGradient', { id: 'ac-wing', x1: 0, y1: 0, x2: 1, y2: 0.4 }, ...stops([0, 'ac-wing-1'], [0.75, 'ac-wing-0'])));
    const left = wing();
    const right = wing();
    back.append(left, right);
    let lx = 0;
    let rx = 0;
    let y = 0;
    const pose = (beat: number) => {
      set(left, { transform: `translate(${lx} ${y}) scale(-1 1) rotate(${fix(-beat)})` });
      set(right, { transform: `translate(${rx} ${y}) rotate(${fix(-beat)})` });
    };
    return {
      layout(g) {
        lx = fix(120 - g.half * 0.72);
        rx = fix(120 + g.half * 0.72);
        y = fix(g.cy - g.hh * 0.18);
        pose(0);
      },
      animate(clock) {
        const { phase, droop } = clock;
        // Quick to lift, slow to settle, as a flap is.
        const s = Math.sin(phase * 3.2);
        const beat = (s > 0 ? s : s * 0.5) * BEAT * Math.min(1, clock.motion) * (1 - droop);
        pose(beat - droop * FOLD);
      },
    };
  },
});
