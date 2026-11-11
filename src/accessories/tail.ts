import { fix, set, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** Degrees it wags each way, and how far a low mood lets it hang. */
const WAG = 10;
const HANG = 34;

registerAccessory('tail', {
  css: String.raw`
.ac-tail { fill: none; stroke: var(--ac-tail); stroke-width: 8; stroke-linecap: round; }
.ac-tail-shine { fill: none; stroke: #fff; stroke-width: 2.4; stroke-linecap: round; opacity: .45; }
.tile { --ac-tail: var(--_c); }
@supports (color: oklch(from red l c h)) {
  .tile { --ac-tail: oklch(from var(--_c) clamp(.5, calc(l - .06), .7) c h); }
}
`,
  reach: 1.45,
  build({ back }) {
    const curl = 'M-8 0C12 2 22-8 22-24C22-36 32-44 41-38';
    const tail = svg(
      'g',
      {},
      svg('path', { class: 'ac-tail', d: curl }),
      svg('path', { class: 'ac-tail-shine', d: 'M20-14C21-18 21-22 21-25' }),
    );
    back.append(tail);
    let x = 0;
    let y = 0;
    const pose = (angle: number) => set(tail, { transform: `translate(${x} ${y}) rotate(${fix(angle)})` });
    return {
      layout(g) {
        x = fix(120 + g.half * 0.74);
        y = fix(g.bottom - g.hh * 0.26);
        pose(0);
      },
      animate(clock) {
        const { phase, droop } = clock;
        pose(Math.sin(phase * 2.6) * WAG * Math.min(1, clock.motion) * (1 - droop) + droop * HANG);
      },
    };
  },
});
