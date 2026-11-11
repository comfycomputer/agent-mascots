import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** Of the body's height, how far the stem runs up under it. */
const TUCK = 0.45;
/** Design units the cut stands in from the outline, so a softened edge never leaves a gap. */
const OVERLAP = 1.5;
/** The stem's foot, and the top of its shine, in the stem's own units. */
const FOOT = 184;
const REST = 137;

/** The stem, its top `rise` above where it rests. The body hides all of that rise. */
const stem = (rise: number): string =>
  `M101 ${fix(REST - rise)}V137C98 154 95 170 103 178C111 184 129 184 137 178C145 170 142 154 139 137V${fix(REST - rise)}Z`;

registerAccessory('stem', {
  css: String.raw`
.ac-stem-shine { fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; opacity: .7; }
.tile { --ac-stem-0: #fff8ee; --ac-stem-1: #f7e3cf; --ac-stem-2: #dcb596; --ac-stem-shade: #3a2418; }
@supports (color: oklch(from red l c h)) {
  .tile { --ac-stem-shade: oklch(from var(--_c) clamp(.3, calc(l * .55), .42) calc(c * .7) h); }
  [data-material='frost'] {
    --ac-stem-0: oklch(from var(--_c) .99 calc(c * .04) h);
    --ac-stem-1: oklch(from var(--_c) .95 calc(c * .16) h);
    --ac-stem-2: oklch(from var(--_c) clamp(.72, l, .84) calc(c * .6) h);
  }
  [data-material='glass'] {
    --ac-stem-0: oklch(from var(--_c) .92 calc(c * .4) h / .55);
    --ac-stem-1: oklch(from var(--_c) .8 calc(c * .75) h / .42);
    --ac-stem-2: oklch(from var(--_c) clamp(.64, l, .78) c h / .75);
  }
}
`,
  below: 44,
  build({ back, defs }) {
    // Occlusion: the cap's shadow falling on the top, and the ground's at the foot.
    const shade = svg(
      'linearGradient',
      { id: 'ac-stem-shade', x1: 0, y1: 0, x2: 0, y2: 1 },
      ...stops([0, 'ac-stem-shade', 0.5], [0.32, 'ac-stem-shade', 0], [0.82, 'ac-stem-shade', 0], [1, 'ac-stem-shade', 0.16]),
    );
    defs.append(
      // Light from the left, turning away to the right, so the stem reads as round.
      svg('linearGradient', { id: 'ac-stem', x1: 0, y1: 0, x2: 1, y2: 0 }, ...stops([0.1, 'ac-stem-0'], [0.55, 'ac-stem-1'], [1, 'ac-stem-2'])),
      shade,
    );
    const fill = svg('path', { fill: 'url(#ac-stem)' });
    const shadow = svg('path', { fill: 'url(#ac-stem-shade)' });
    const group = svg('g', {}, fill, shadow, svg('path', { class: 'ac-stem-shine', d: 'M106 150C105 158 105 166 108 173' }));
    // The stem runs up under the body and is cut by its outline, so its top follows whatever is
    // above it: a flat cap, a point, a star's legs or a ghost's hem. Nothing shows through glass.
    const area = svg('rect', { fill: '#fff' });
    const cut = svg(
      'mask',
      { id: 'ac-stem-cut', maskUnits: 'userSpaceOnUse' },
      area,
      svg('use', { href: '#bp', fill: '#000', stroke: '#fff', 'stroke-width': OVERLAP * 2 }),
    );
    back.append(svg('defs', {}, cut), svg('g', { mask: 'url(#ac-stem-cut)' }, group));
    return {
      layout(g) {
        const rise = (g.bottom - g.top) * TUCK;
        const d = stem(rise);
        set(fill, { d });
        set(shadow, { d });
        // The cap's shadow starts where the stem used to rest, under the body's lowest point.
        set(shade, { y1: fix(rise / (FOOT - REST + rise)) });
        set(group, { transform: `translate(0 ${fix(g.bottom - 138)})` });
        const region = { x: g.viewX, y: g.viewY, width: g.viewSize, height: g.viewSize };
        set(cut, region);
        set(area, region);
      },
    };
  },
});
