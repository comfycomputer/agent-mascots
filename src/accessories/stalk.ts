import { fix, set, svg } from '../dom.js';
import { topAt } from '../path.js';
import { registerAccessory } from '../registry.js';
import { bulb, bulbCss, pulse } from '../render/bulb.js';

/**
 * Control points, end and bulb, relative to the body top, each as [upright, slumped]. A low
 * mood bends the stalk over to the left, away from the sweat drop and the Zs, until the bulb
 * hangs from its tip like a wilting flower.
 */
const BEND = [
  [120, 119],
  [-10, -15],
  [124, 107],
  [-18, -26],
  [132, 98],
  [-25, -18],
  [134, 97],
  [-27, -13],
] as const;
/** Degrees of sway around the base. */
const SWAY = 3.5;

registerAccessory('stalk', {
  css: bulbCss,
  above: 46,
  build({ front, config }) {
    const stem = svg('path', { class: 'ac-stalk-line' });
    const head = bulb(9, 18);
    const mast = svg('g', {}, stem, head);
    front.append(mast);
    // Where the middle of the head is, which on a heart or a cat is below its highest point.
    const crown = topAt(config.shape);
    let top = 0;
    let bent = -1;
    const bend = (d: number) => {
      if (d === bent) return;
      bent = d;
      // Odd entries are heights, from the body top.
      const [x1, y1, x2, y2, ex, ey, bx, by] = BEND.map(([up, down], i) => fix(up + (down - up) * d + (i % 2 ? top : 0)));
      set(stem, { d: `M120 ${fix(top + 2)}C${x1} ${y1} ${x2} ${y2} ${ex} ${ey}` });
      set(head, { transform: `translate(${bx} ${by})` });
    };
    return {
      layout(g) {
        top = crown(g, 120);
        bent = -1;
        bend(0);
      },
      animate(clock) {
        // Eased droop changes slowly, and rounding makes the path settle, so it is rarely rewritten.
        bend(fix(clock.droop));
        const sway = Math.sin(clock.phase * 1.9) * SWAY * Math.min(1, clock.motion) * (1 - clock.droop);
        set(mast, { transform: `rotate(${fix(sway)} 120 ${fix(top + 2)})` });
        pulse(head, clock);
      },
    };
  },
});
