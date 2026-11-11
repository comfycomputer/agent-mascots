import { fix, set, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** Degrees a twitch lifts them, and how far a low mood lets them droop. */
const TWITCH = 7;
const DROOP = 12;

const side = (dir: number) =>
  svg('path', { class: 'ac-whisker', d: `M0-3L${18 * dir}-7M0 1H${20 * dir}M0 5L${18 * dir} 9` });

registerAccessory('whiskers', {
  css: String.raw`
.ac-whisker { fill: none; stroke: var(--ac-whisker); stroke-width: 1.8; stroke-linecap: round; }
.tile { --ac-whisker: #0000004d; }
.tile[data-sky] { --ac-whisker: #ffffffb3; }
@supports (color: oklch(from red l c h)) {
  .tile:not([data-sky]) { --ac-whisker: oklch(from var(--_c) calc(l * .5) calc(c * .7) h / .7); }
}
`,
  build({ face }) {
    const left = side(-1);
    const right = side(1);
    face.append(left, right);
    let x = 0;
    let y = 0;
    const pose = (angle: number) => {
      set(left, { transform: `translate(${-x} ${y}) rotate(${fix(-angle)})` });
      set(right, { transform: `translate(${x} ${y}) rotate(${fix(angle)})` });
    };
    return {
      layout(g) {
        x = fix(g.eyes.gap + g.eyes.w / 2 + 7);
        y = fix(g.eyes.h * 0.42);
        pose(0);
      },
      animate(clock) {
        const { phase, droop } = clock;
        // A sharp twitch now and then, not a constant wave.
        const twitch = Math.sin(phase * 1.3) ** 12 * TWITCH * Math.min(1, clock.motion);
        pose(droop * DROOP - twitch);
      },
    };
  },
});
