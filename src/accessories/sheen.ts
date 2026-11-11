import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** A glint every `PERIOD` of accessory time, crossing in the first `SWEEP` of it, then a pause. */
const PERIOD = 3.4;
const SWEEP = 1.5;
/** Offscreen on either side, and where a still pose leaves the glint: on the left shoulder, clear of the eyes. */
const FROM = -110;
const TO = 150;
const REST = -58;

/** Slow in, slow out: light glances across, rather than scanning at a constant speed. */
const ease = (u: number): number => u * u * (3 - 2 * u);

registerAccessory('sheen', {
  css: String.raw`
.tile { --ac-glint-0: #fff0; --ac-glint-1: #ffffffb0; }
`,
  build({ gloss, defs }) {
    defs.append(
      svg(
        'linearGradient',
        { id: 'ac-glint', x1: 0, y1: 0, x2: 1, y2: 0 },
        ...stops([0, 'ac-glint-0'], [0.5, 'ac-glint-1'], [1, 'ac-glint-0']),
      ),
    );
    // A broad bar and a thin streak behind it: the pair reads as a polished surface.
    const glint = svg(
      'g',
      {},
      svg('rect', { x: 90, y: 0, width: 40, height: 240, fill: 'url(#ac-glint)' }),
      svg('rect', { x: 136, y: 0, width: 10, height: 240, fill: 'url(#ac-glint)' }),
    );
    gloss.append(glint);
    const place = (x: number, dim = 0) =>
      set(glint, { transform: `translate(${fix(x)} 0) rotate(18 120 120)`, opacity: dim ? fix(1 - dim * 0.6) : null });
    return {
      layout: () => place(REST),
      animate(clock) {
        const u = Math.min(1, (clock.phase % PERIOD) / SWEEP);
        // A downcast mascot does not gleam as brightly.
        place(clock.still ? REST : FROM + (TO - FROM) * ease(u), clock.droop);
      },
    };
  },
});
