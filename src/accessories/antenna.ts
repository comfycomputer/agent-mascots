import { fix, set, svg } from '../dom.js';
import { topAt } from '../path.js';
import { registerAccessory } from '../registry.js';
import { bulb, bulbCss, pulse } from '../render/bulb.js';

/** Degrees. A low mood tips it to the left, clear of the sweat and the Zs on the right. */
const SWAY = 4;
const SLUMP = -24;

registerAccessory('antenna', {
  css: bulbCss,
  above: 46,
  build({ front, config }) {
    const stem = svg('rect', { class: 'ac-stalk', x: 117.5, width: 5, height: 30, rx: 2.5 });
    const head = bulb(7, 16);
    const mast = svg('g', {}, stem, head);
    front.append(mast);
    // Where the middle of the head is, which on a heart or a cat is below its highest point.
    const crown = topAt(config.shape);
    let base = 0;
    return {
      layout(g) {
        const top = crown(g, 120);
        base = fix(top + 2);
        set(stem, { y: fix(top - 26) });
        set(head, { transform: `translate(120 ${fix(top - 28)})` });
      },
      animate(clock) {
        // A springy wobble from the base: two sines, so the top never swings like a metronome.
        const { phase, droop } = clock;
        const wobble = Math.sin(phase * 2.3) + 0.35 * Math.sin(phase * 5.1);
        const angle = wobble * SWAY * Math.min(1, clock.motion) * (1 - droop) + droop * SLUMP;
        set(mast, { transform: `rotate(${fix(angle)} 120 ${base})` });
        pulse(head, clock);
      },
    };
  },
});
