import { fix, set, stops, svg } from '../dom.js';
import type { FrameClock } from '../types.js';

export const bulbCss = String.raw`
.ac-stalk { fill: var(--stalk); }
.ac-stalk-line { fill: none; stroke: var(--stalk); stroke-width: 5; stroke-linecap: round; }
.ac-bulb { fill: var(--_a); }
.ac-bulb-glint { fill: #fff; opacity: .9; }
.tile { --ac-bulb: var(--_a); }
`;

/** A glowing bulb centred on the origin, with a highlight, so it reads as a lit sphere. */
export function bulb(radius: number, glow: number): SVGGElement {
  const id = `ac-bulb-${radius}`;
  return svg(
    'g',
    {},
    svg('radialGradient', { id }, ...stops([0.2, 'ac-bulb', 0.55], [1, 'ac-bulb', 0])),
    svg('circle', { r: glow, fill: `url(#${id})` }),
    svg('circle', { class: 'ac-bulb', r: radius }),
    svg('circle', { class: 'ac-bulb-glint', cx: fix(-radius * 0.3), cy: fix(-radius * 0.3), r: fix(radius * 0.34) }),
  );
}

/** A soft breathing pulse. The mood's activity sets the speed, and a low mood dims it. */
export function pulse(head: SVGGElement, clock: FrameClock): void {
  set(head, { opacity: fix((0.75 + 0.25 * Math.sin(clock.phase * 2)) * (1 - clock.droop * 0.6)) });
}
