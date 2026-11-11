import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

registerAccessory('iridescent', {
  css: String.raw`
.ac-irid { opacity: .2; }
.tile[data-material='glow'] .ac-irid { opacity: .14; }
.tile[data-material='glass'] .ac-irid { opacity: .24; }
.tile { --ac-irid-0: #fff0; }
@supports (color: oklch(from red l c h)) {
  .tile {
    --ac-irid-1: oklch(from var(--_c) .84 .13 calc(h - 75));
    --ac-irid-2: oklch(from var(--_c) .92 .06 h);
    --ac-irid-3: oklch(from var(--_c) .86 .13 calc(h + 75));
    --ac-irid-4: oklch(from var(--_c) .94 .04 calc(h - 30));
  }
}
`,
  build({ gloss, defs }) {
    defs.append(
      svg(
        'linearGradient',
        // Square to the band, which is rotated already: tilted, it would leave colour on the
        // band's long edges, and those would cut across the body.
        { id: 'ac-irid', x1: 0, y1: 0, x2: 1, y2: 0 },
        // Bands well apart in hue, as in a soap film: close hues read as a flat tint.
        ...stops(
          [0, 'ac-irid-0'],
          [0.22, 'ac-irid-1'],
          [0.42, 'ac-irid-2'],
          [0.6, 'ac-irid-3'],
          [0.78, 'ac-irid-4'],
          [1, 'ac-irid-0'],
        ),
      ),
    );
    const wash = svg('rect', {
      class: 'ac-irid',
      x: 50,
      y: 0,
      width: 140,
      height: 240,
      fill: 'url(#ac-irid)',
    });
    gloss.append(wash);
    const place = (x: number) =>
      set(wash, { transform: `translate(${fix(x)} 0) rotate(18 120 120)` });
    return {
      layout: () => place(0),
      animate: (clock) => place(Math.sin(clock.phase * 0.8) * 30),
    };
  },
});
