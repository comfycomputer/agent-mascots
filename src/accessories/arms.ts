import { fix, set, svg } from '../dom.js';
import { hitTest } from '../path.js';
import { registerAccessory } from '../registry.js';

/** Degrees a low mood lets the arms hang, outer ends down. */
const HANG = 28;

registerAccessory('arms', {
  reach: 1.2,
  build({ merge, config }) {
    const left = svg('ellipse', { rx: 12, ry: 8 });
    const right = svg('ellipse', { rx: 12, ry: 8 });
    merge.append(left, right);
    const { shape } = config;
    const inside = hitTest(shape.path);
    let cy = 0;
    let lx = 0;
    let rx = 0;

    /**
     * How far the outline reaches from the middle at height y, on one side, in stretched
     * units. Tapered shapes such as gem are far narrower at the shoulders than at their
     * widest, where arms placed by half width alone would float free.
     */
    const edge = (y: number, side: number, half: number, tall: number): number => {
      if (!inside) return half;
      const rawY = shape.bottom - (shape.bottom - y) / tall;
      for (let d = shape.halfWidth + 4; d > 4; d -= 1.5) {
        if (inside(120 + side * d, rawY)) return (d * half) / shape.halfWidth;
      }
      return half;
    };
    // Measured at the arm's middle and upper half: on an edge that slants in towards the
    // bottom, the wider of the two keeps the arm from sinking into the body as a lump.
    const reach = (side: number, half: number, tall: number) =>
      Math.max(edge(cy, side, half, tall), edge(cy - 4, side, half, tall));

    let lastHang = -1;
    const hang = (droop: number) => {
      // Arms melt into the body, which repaints for every change: step them, so a mood change
      // costs a handful of repaints, and a settled mood none.
      const step = Math.round(droop * 8) / 8;
      if (step === lastHang) return;
      lastHang = step;
      const angle = fix(step * HANG);
      set(left, { transform: `rotate(${-angle} ${fix(lx + 8)} ${cy})` });
      set(right, { transform: `rotate(${angle} ${fix(rx - 8)} ${cy})` });
    };

    return {
      layout(g) {
        cy = fix(g.cy + g.hh * 0.25);
        const tall = g.hh / ((shape.bottom - shape.top) / 2);
        lx = fix(120 - reach(-1, g.half, tall) - 2);
        rx = fix(120 + reach(1, g.half, tall) + 2);
        set(left, { cx: lx, cy });
        set(right, { cx: rx, cy });
        lastHang = -1;
        hang(0);
      },
      animate(clock) {
        hang(clock.droop);
      },
    };
  },
});
