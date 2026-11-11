import { fix, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

/** The gem's cuts, in raw shape coordinates: crown, girdle, then the pavilion down to the culet. */
const GEM_CUTS = [
  'M92 66L104 100L136 100L148 66',
  'M62 100H178',
  'M74 100L120 182',
  'M166 100L120 182',
  'M104 100L120 182',
  'M136 100L120 182',
] as const;

/** Tinted planes between the cuts, so the gem reads as cut stone. */
const GEM_PLATES = [
  ['ac-plate', 'M92 66H148L136 100H104Z'],
  ['ac-plate-dark', 'M62 100L92 66L104 100ZM178 100L148 66L136 100Z'],
  ['ac-plate-side', 'M62 100H74L120 182ZM178 100H166L120 182Z'],
] as const;

/** Planes that catch the light in turn as it crosses the stone, each with its centre x. */
const GEM_FLASHES = [
  [76, 'M62 100L92 66L104 100Z'],
  [98, 'M74 100H104L120 182Z'],
  [120, 'M92 66H148L136 100H104Z'],
  [142, 'M136 100H166L120 182Z'],
  [164, 'M178 100L148 66L136 100Z'],
] as const;
/** A flash every `FLASH_PERIOD` of accessory time, crossing in the first `FLASH_SWEEP` of it. */
const FLASH_PERIOD = 4.6;
const FLASH_SWEEP = 1.6;
/** How wide the light is, in shape units, and how bright a plane gets at its peak. */
const FLASH_WIDTH = 26;
const FLASH_PEAK = 0.7;
/** A full width past the outer planes, so the loop wraps in the dark. */
const FLASH_CENTRES = GEM_FLASHES.map(([x]) => x);
const FLASH_FROM = Math.min(...FLASH_CENTRES) - FLASH_WIDTH;
const FLASH_TO = Math.max(...FLASH_CENTRES) + FLASH_WIDTH;
/** A still pose leaves the light on the upper left, so the stone still looks cut. */
const FLASH_REST = 86;

/** How far the fade reaches past the eyes, sideways and down, so they can look around in it. */
const FACE_MARGIN = 16;

registerAccessory('facets', {
  css: String.raw`
.ac-facet { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tile:not([data-material='glow']) .ac-facet { opacity: .7; }
.ac-plate { fill: #fff; opacity: .15; }
.ac-plate-dark { fill: var(--edge, #000); opacity: .12; }
.ac-plate-side { fill: var(--edge, #000); opacity: .1; }
.ac-flash { fill: url(#ac-flash); }
.tile[data-material='glass'] .ac-flash { fill-opacity: .6; }
.tile { --ac-flash: #fff; }
.tile { --ac-cut: #fff; }
.tile:not([data-material='glow']) { --ac-cut: var(--edge, var(--_c)); }
`,
  build({ inside, gloss, defs, config }) {
    const gem = config.shape.name === 'gem';
    // Cuts dissolve around the face, wherever it is, so no line ever runs through an eye.
    const fade = svg(
      'radialGradient',
      { id: 'ac-cut', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 1 },
      ...stops([0.7, 'ac-cut', 0], [1, 'ac-cut', 0.5]),
    );
    // Light catches a plane's upper edge and fades across it: a glint, not a lit pane.
    const glint = svg('linearGradient', { id: 'ac-flash', x1: 0, y1: 0, x2: 0.6, y2: 1 }, ...stops([0, 'ac-flash'], [1, 'ac-flash', 0.15]));
    defs.append(fade, glint);
    const lines = (gem ? GEM_CUTS : ['', '']).map((d) => svg('path', { class: 'ac-facet', stroke: 'url(#ac-cut)', d }));
    const group = svg(
      'g',
      {},
      ...(gem ? GEM_PLATES.map(([paint, d]) => svg('path', { class: paint, d })) : []),
      ...lines,
    );
    inside.append(group);
    // In the gloss layer, which may animate: `inside` holds the filters.
    const flashes = gem ? GEM_FLASHES.map(([x, d]) => [x, svg('path', { class: 'ac-flash', d, opacity: 0 })] as const) : [];
    const shimmer = svg('g', {}, ...flashes.map(([, path]) => path));
    if (gem) gloss.append(shimmer);
    /** Light at `x` across the stone; each plane brightens as it passes, and is dark between. */
    const light = (x: number, peak: number) => {
      for (const [centre, path] of flashes) {
        const near = Math.max(0, 1 - Math.abs(x - centre) / FLASH_WIDTH);
        set(path, { opacity: fix(near * near * peak) });
      }
    };
    return {
      animate: gem
        ? (clock) => {
            const u = Math.min(1, (clock.phase % FLASH_PERIOD) / FLASH_SWEEP);
            const x = clock.still ? FLASH_REST : FLASH_FROM + (FLASH_TO - FLASH_FROM) * u * u * (3 - 2 * u);
            // A downcast gem does not sparkle.
            light(x, FLASH_PEAK * (1 - clock.droop * 0.75));
          }
        : undefined,
      layout(g) {
        const rx = g.eyes.gap + g.eyes.w / 2 + FACE_MARGIN;
        const ry = g.eyes.h / 2 + FACE_MARGIN;
        if (gem) {
          set(group, { transform: g.bodyTransform });
          set(shimmer, { transform: g.bodyTransform });
          light(FLASH_REST, FLASH_PEAK);
          // In the path's own space, which `bodyTransform` stretches.
          const y = g.bottom - ((g.bottom - g.eyeY) * (config.shape.bottom - config.shape.top)) / (g.hh * 2);
          set(fade, { gradientTransform: `translate(120 ${fix(y)}) scale(${fix(rx)} ${fix(ry)})` });
          return;
        }
        set(fade, { gradientTransform: `translate(120 ${fix(g.eyeY)}) scale(${fix(rx)} ${fix(ry)})` });
        const y = fix(g.cy - g.hh * 0.35);
        const spread = fix(g.half * 0.4);
        set(lines[0] as SVGPathElement, { d: `M${fix(g.left + 10)} ${y}H${fix(g.right - 10)}` });
        set(lines[1] as SVGPathElement, {
          d: `M${fix(120 - spread)} ${fix(g.top + 4)}L120 ${y}L${fix(120 + spread)} ${fix(g.top + 4)}`,
        });
      },
    };
  },
});
