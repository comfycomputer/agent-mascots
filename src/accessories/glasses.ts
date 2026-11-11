import { fix, set, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

registerAccessory('glasses', {
  css: String.raw`
.ac-frame { fill: #ffffff1f; stroke: var(--ac-frame); stroke-width: 3; }
.ac-bridge { fill: none; stroke: var(--ac-frame); stroke-width: 3; stroke-linecap: round; }
.ac-lens-glint { fill: none; stroke: #fff; stroke-width: 1.6; stroke-linecap: round; opacity: .8; }
.tile { --ac-frame: #2b2f3a; }
@supports (color: oklch(from red l c h)) {
  .tile { --ac-frame: oklch(from var(--_c) .28 calc(c * .35) h); }
}
`,
  build({ face }) {
    const left = svg('ellipse', { class: 'ac-frame' });
    const right = svg('ellipse', { class: 'ac-frame' });
    const bridge = svg('path', { class: 'ac-bridge' });
    const glints = svg('path', { class: 'ac-lens-glint' });
    const group = svg('g', {}, left, right, bridge, glints);
    face.append(group);
    return {
      layout(g) {
        const { gap, w, h } = g.eyes;
        // Round where there is room, and narrowed to ovals where the eyes sit close.
        const ry = fix(Math.max(w, h) / 2 + 5);
        const r = fix(Math.min(ry, gap - 2.5, w / 2 + 9));
        const y = fix(-ry * 0.3);
        set(left, { cx: -gap, rx: r, ry });
        set(right, { cx: gap, rx: r, ry });
        // A bridge over the nose, and temples running back to the sides.
        set(bridge, {
          d: `M${fix(-gap + r)} ${y}Q0 ${fix(y - 5)} ${fix(gap - r)} ${y}M${fix(-gap - r)} ${y}h-7M${fix(gap + r)} ${y}h7`,
        });
        const arc = (cx: number) => `M${fix(cx - r * 0.66)} ${fix(-ry * 0.3)}Q${fix(cx - r * 0.6)} ${fix(-ry * 0.7)} ${fix(cx - r * 0.15)} ${fix(-ry * 0.74)}`;
        set(glints, { d: arc(-gap) + arc(gap) });
      },
      animate(clock) {
        set(group, { transform: clock.droop ? `translate(0 ${fix(clock.droop * 3)})` : null });
      },
    };
  },
});
