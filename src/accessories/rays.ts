import { about, fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

const COUNT = 12;
const SPIN = 10;
/** How far the short rays breathe in and out against the long ones, so the crown shimmers. */
const SHIMMER = 0.07;

const length = (i: number): number => (i % 2 ? 12 : 16);

registerAccessory('rays', {
  css: String.raw`
.ac-ray { fill: var(--_a); }
.tile { --ac-corona: var(--_a); }
`,
  above: 22,
  below: 2,
  reach: 1.45,
  build({ back, defs }) {
    defs.append(svg('radialGradient', { id: 'ac-corona' }, ...stops([0.62, 'ac-corona', 0], [0.8, 'ac-corona', 0.3], [1, 'ac-corona', 0])));
    const corona = svg('circle', { fill: 'url(#ac-corona)' });
    const beams = Array.from({ length: COUNT }, (_, i) =>
      svg('rect', { class: 'ac-ray', x: 116, width: 8, height: length(i), rx: 4 }),
    );
    const long = svg('g', {}, ...beams.filter((_, i) => i % 2 === 0));
    const short = svg('g', {}, ...beams.filter((_, i) => i % 2));
    const wheel = svg('g', {}, long, short);
    back.append(corona, wheel);
    let cy = 0;
    return {
      layout(g) {
        cy = fix(g.cy);
        const radius = Math.max(g.half, g.hh) + 6;
        set(corona, { cx: 120, cy, r: fix(radius + 26) });
        beams.forEach((beam, i) => {
          set(beam, {
            y: fix(cy - radius - length(i)),
            transform: `rotate(${i * (360 / COUNT)} 120 ${cy})`,
          });
        });
      },
      animate(clock) {
        const { phase, droop } = clock;
        const angle = (phase * SPIN) % 360;
        const scale = fix(1 - droop * 0.1);
        set(wheel, { transform: about(120, cy, `rotate(${fix(angle)}) scale(${scale})`) });
        // A low mood dims the halo and stills the shimmer: a sun behind cloud.
        const breathe = Math.sin(phase * 2.4) * SHIMMER * Math.min(1, clock.motion) * (1 - droop);
        // Only one group moves: against the other, that reads the same, for half the writes.
        set(short, { transform: about(120, cy, `scale(${fix(1 + breathe)})`) });
        set(corona, { opacity: fix(1 - droop * 0.55) });
      },
    };
  },
});
