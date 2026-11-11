import { fix, set, svg } from '../dom.js';
import { hitTest } from '../path.js';
import { registerAccessory } from '../registry.js';

/** Degrees a low mood splays the ears, tips outwards and down. */
const FLOP = 30;

registerAccessory('ears', {
  reach: 1.2,
  build({ merge, config }) {
    const left = svg('rect', { width: 22, height: 38, rx: 11 });
    const right = svg('rect', { width: 22, height: 38, rx: 11 });
    merge.append(left, right);
    const { shape } = config;
    const inside = hitTest(shape.path);
    let leftRoot = 0;
    let rightRoot = 0;
    let lx = 0;
    let rx = 0;
    let last = -1;
    const flop = (droop: number) => {
      // Ears melt into the body, which repaints for every change: step them, so a mood change
      // costs a handful of repaints, and a settled mood none.
      const step = Math.round(droop * 8) / 8;
      if (step === last) return;
      last = step;
      const angle = fix(step * FLOP);
      set(left, { transform: `rotate(${-angle} ${lx} ${leftRoot})` });
      set(right, { transform: `rotate(${angle} ${rx} ${rightRoot})` });
    };
    return {
      layout(g) {
        lx = fix(g.left + 8);
        rx = fix(g.right - 8);
        const y = fix(g.cy - 19);
        set(left, { x: fix(g.left - 12), y });
        set(right, { x: fix(g.right - 10), y });
        // Each ear turns about the lowest point it shares with the body, so it never comes
        // away. Tapered shapes such as gem only touch the ear near its top.
        const tall = g.hh / ((shape.bottom - shape.top) / 2);
        const rootAt = (x: number) => {
          let at = g.cy + 8;
          if (!inside) return fix(at);
          const rawX = 120 + ((x - 120) * shape.halfWidth) / g.half;
          while (at > g.cy - 12 && !inside(rawX, shape.bottom - (shape.bottom - at) / tall)) at -= 2;
          return fix(at);
        };
        leftRoot = rootAt(lx);
        rightRoot = rootAt(rx);
        last = -1;
        flop(0);
      },
      animate(clock) {
        flop(clock.droop);
      },
    };
  },
});
