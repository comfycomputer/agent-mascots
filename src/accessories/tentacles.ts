import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

const OFFSETS = [-22, -8, 8, 22] as const;
const LENGTH = 58;
/** The outer pair is shorter, so the bundle tapers instead of ending in a straight fringe. */
const OUTER = 0.86;
/** How far the tips draw in when limp: a deflated jelly hangs in a bunch, not in rigid bars. */
const GATHER = 0.45;

/**
 * One strand from (x, y). `pull` moves the tip sideways, and the curve eases over to it.
 * `root` is how much room there is to sway at the top: strands leaving a point would tangle.
 */
function strand(x: number, y: number, t: number, i: number, slack: number, pull: number, length: number, root: number): string {
  const wave = (shift: number, amplitude: number) =>
    Math.sin(t * 2.1 + i * 1.3 + shift) * amplitude * slack;
  const a = fix(x + wave(0, 7 * root) + pull * 0.12);
  const b = fix(x + wave(1.4, 9) + pull * 0.5);
  const c = fix(x + wave(2.6, 6) + pull);
  return `M${fix(x)} ${fix(y)}C${a} ${fix(y + length * 0.31)} ${b} ${fix(y + length * 0.59)} ${c} ${fix(y + length)}`;
}

registerAccessory('tentacles', {
  css: String.raw`
.ac-tentacle { fill: none; stroke-linecap: round; }
@supports (color: oklch(from red l c h)) {
  .tile {
    --ac-tentacle: oklch(from var(--_c) clamp(.68, calc(l + .1), .85) calc(c * .85) h);
  }
}
`,
  below: 46,
  build({ back, defs, config }) {
    // A pointed bottom has no width to hang from: the strands leave the tip and fan out.
    const root = config.shape.name === 'gem' ? 0.35 : 1;
    const gradient = svg(
      'linearGradient',
      { id: 'ac-tentacle', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0 },
      // Fades in from the root, which a clear body would otherwise show as a stub.
      ...stops([0, 'ac-tentacle', 0], [0.24, 'ac-tentacle', 1], [1, 'ac-tentacle', 0.1]),
    );
    defs.append(gradient);
    const strands = OFFSETS.map((_, i) =>
      svg('path', {
        class: 'ac-tentacle',
        stroke: 'url(#ac-tentacle)',
        'stroke-width': i === 1 || i === 2 ? 6 : 5,
      }),
    );
    back.append(...strands);
    let bottom = 0;
    let scale = 1;
    const draw = (t: number, droop = 0) => {
      strands.forEach((path, i) => {
        const offset = (OFFSETS[i] as number) * scale;
        const x = 120 + offset * root;
        const pull = offset * (1 - GATHER * droop - root);
        const length = i === 1 || i === 2 ? LENGTH : LENGTH * OUTER;
        set(path, { d: strand(x, bottom - 13, t, i, 1 - droop * 0.6, pull, length, root) });
      });
    };
    return {
      layout(g) {
        bottom = g.bottom;
        scale = g.half / 60;
        set(gradient, { y1: fix(bottom - 13), y2: fix(bottom + 50) });
        draw(0);
      },
      animate: (clock) => draw(clock.phase, clock.droop),
    };
  },
});
