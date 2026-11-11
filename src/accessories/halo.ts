import { fix, set, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** A low mood lets the halo slip askew: degrees, and design units down towards the head. */
const SLIP_TILT = 16;
const SLIP = 7;

const ring = () => svg('ellipse', {});

registerAccessory('halo', {
  css: String.raw`
.ac-halo { fill: none; stroke: var(--_a); }
.ac-halo-glow { stroke-width: 11; opacity: .28; }
.ac-halo-band { stroke-width: 4.5; }
.ac-halo-glint { stroke: #fff; stroke-width: 1.6; stroke-linecap: round; opacity: .85; }
`,
  above: 36,
  build({ front }) {
    const glow = ring();
    const band = ring();
    const glint = svg('path', { class: 'ac-halo ac-halo-glint' });
    set(glow, { class: 'ac-halo ac-halo-glow' });
    set(band, { class: 'ac-halo ac-halo-band' });
    const group = svg('g', {}, glow, band, glint);
    front.append(group);
    let cy = 0;
    return {
      layout(g) {
        cy = fix(g.top - 18);
        const rx = fix(Math.min(26, g.half * 0.46));
        const ry = fix(rx * 0.3);
        for (const node of [glow, band]) set(node, { cx: 120, cy, rx, ry });
        // Light catching the near rim, on the left as on the body.
        set(glint, { d: `M${fix(120 - rx * 0.8)} ${fix(cy + ry * 0.6)}Q${fix(120 - rx * 0.4)} ${fix(cy + ry * 1.02)} 120 ${fix(cy + ry)}` });
        set(group, { transform: null });
      },
      animate(clock) {
        const { phase, droop } = clock;
        const bob = Math.sin(phase * 1.4) * 2 * Math.min(1, clock.motion);
        set(group, { transform: `translate(0 ${fix(bob + droop * SLIP)}) rotate(${fix(droop * SLIP_TILT)} 120 ${cy})` });
      },
    };
  },
});
