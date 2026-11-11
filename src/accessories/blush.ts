import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

const cheek = (): SVGEllipseElement => svg('ellipse', { fill: 'url(#ac-blush)', rx: 10, ry: 6.5 });

registerAccessory('blush', {
  css: String.raw`
.tile { --bl: #ff5f8fb0; --bl-0: #ff5f8f00; }
`,
  build({ face, defs }) {
    defs.append(svg('radialGradient', { id: 'ac-blush' }, ...stops([0.2, 'bl'], [1, 'bl-0'])));
    const left = cheek();
    const right = cheek();
    face.append(left, right);
    return {
      layout(g) {
        const offset = g.eyes.gap + g.eyes.w / 2 + 8;
        const cy = fix(g.eyes.h * 0.5);
        set(left, { cx: fix(-offset), cy });
        set(right, { cx: fix(offset), cy });
      },
      // Colour drains from the cheeks as the mood sinks. `droop` is eased, and only
      // changes in a transition, so a steady mood writes nothing.
      animate(clock) {
        const opacity = clock.droop ? fix(1 - clock.droop * 0.5) : null;
        set(left, { opacity });
        set(right, { opacity });
      },
    };
  },
});
