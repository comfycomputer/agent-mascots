import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

const TILT = -12;
const ORBIT_RATE = 0.7;
/** A low mood lets the ring slip down the body and hang askew: extra degrees, and half heights. */
const SLUMP_TILT = -7;
const SLIP = 0.14;

function moon(): SVGGElement {
  return svg(
    'g',
    {},
    svg('circle', { r: 11, fill: 'url(#ac-moon)' }),
    svg('ellipse', { class: 'ac-moon-glint', cx: -3, cy: -4, rx: 4, ry: 2.4 }),
  );
}

registerAccessory('ring', {
  css: String.raw`
.ac-ring { fill: none; stroke-width: 7; stroke-linecap: round; }
.ac-moon-glint { fill: #fff; opacity: .7; }
.tile { --ac-ring-0: var(--_c); --ac-ring-1: var(--_a); --ac-moon-0: #fff6d8; --ac-moon-1: var(--_a); }
.tile[data-sky] { --ac-ring-0: #fffffff2; }
@supports (color: oklch(from red l c h)) {
  .tile:not([data-sky]) { --ac-ring-0: oklch(from var(--_c) clamp(.62, l, .8) c h); }
}
`,
  reach: 1.6,
  build({ back, front, defs }) {
    defs.append(
      svg('linearGradient', { id: 'ac-ring', x1: 0, y1: 0, x2: 1, y2: 0 }, ...stops([0, 'ac-ring-0'], [0.5, 'ac-ring-1'], [1, 'ac-ring-0'])),
      svg('radialGradient', { id: 'ac-moon', cx: 0.35, cy: 0.3, r: 0.8 }, ...stops([0, 'ac-moon-0'], [1, 'ac-moon-1'])),
    );
    const paint = { class: 'ac-ring', stroke: 'url(#ac-ring)' };
    const rear = svg('path', { ...paint, opacity: 0.75 });
    const near = svg('path', paint);
    // One moon in each layer, so it passes behind the body for half the orbit.
    const moonBack = moon();
    const moonFront = moon();
    back.append(rear, moonBack);
    front.append(near, moonFront);

    let rx = 0;
    let ry = 0;
    let cy = 0;
    let hh = 0;
    let pivot = 0;
    let tilt = 0;
    let drop = 0;
    const place = (t: number) => {
      const a = t * ORBIT_RATE;
      const turn = (tilt * Math.PI) / 180;
      const mx = Math.cos(a) * rx;
      const my = Math.sin(a) * ry;
      const x = 120 + mx * Math.cos(turn) - my * Math.sin(turn);
      const y = cy + drop + mx * Math.sin(turn) + my * Math.cos(turn);
      const transform = `translate(${fix(x)} ${fix(y)}) scale(${fix(0.7 + 0.15 * Math.sin(a))})`;
      const inFront = Math.sin(a) > 0;
      set(moonFront, { transform, opacity: inFront ? 1 : 0 });
      set(moonBack, { transform, opacity: inFront ? 0 : 1 });
    };
    const pose = (droop: number) => {
      tilt = fix(TILT + droop * SLUMP_TILT);
      drop = fix(droop * hh * SLIP);
      const transform = `translate(0 ${drop}) rotate(${tilt} 120 ${pivot})`;
      set(rear, { transform });
      set(near, { transform });
    };

    return {
      layout(g) {
        rx = g.half * 1.5;
        ry = rx * 0.226;
        cy = g.cy + g.hh * 0.2;
        hh = g.hh;
        pivot = fix(cy);
        const arc = (sweep: number) =>
          `M${fix(120 - rx)} ${fix(cy)}A${fix(rx)} ${fix(ry)} 0 0 ${sweep} ${fix(120 + rx)} ${fix(cy)}`;
        set(rear, { d: arc(1) });
        set(near, { d: arc(0) });
        pose(0);
        place(1.5);
      },
      animate(clock) {
        pose(fix(clock.droop));
        place(1.5 + clock.phase);
      },
    };
  },
});
