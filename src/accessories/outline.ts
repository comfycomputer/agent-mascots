import { filter, fix, inset, REGION, set, stops, svg } from '../dom.js';
import { registerAccessory } from '../registry.js';

registerAccessory('outline', {
  css: String.raw`
.ac-rim { fill: #fff; }
.ac-rim-arc { fill: #fff; opacity: .6; }
.tile { --ac-rim-lit: #fff; }
`,
  build({ inside, solid, defs, config }) {
    defs.append(inset('ac-rim', 1.8));
    const rim = svg('use', { class: 'ac-rim', href: `#${solid}`, filter: 'url(#ac-rim)' });
    inside.append(rim);
    // The highlight would read as one more cut across a faceted body.
    if (config.accessories.includes('facets')) return { layout() {} };
    // Traced from the outline itself, a little inside it: the body, less a copy of itself
    // shifted down and right, leaves a crescent on every edge that faces the light. It
    // tapers on its own wherever the edge turns away, whatever the shape.
    defs.append(
      filter(
        'ac-rim-arc',
        svg('feMorphology', { in: 'SourceAlpha', operator: 'erode', radius: 3.5, result: 'e' }),
        svg('feOffset', { in: 'e', dx: 2.5, dy: 4, result: 'o' }),
        svg('feComposite', { in: 'e', in2: 'o', operator: 'out' }),
        svg('feGaussianBlur', { stdDeviation: 1.3, result: 'c' }),
        svg('feComposite', { in: 'SourceGraphic', in2: 'c', operator: 'in' }),
      ),
    );
    // Only the upper left catches the light: the crescent fades out down the side.
    const fade = svg(
      'radialGradient',
      { id: 'ac-rim-lit', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 1 },
      ...stops([0, 'ac-rim-lit', 1], [0.55, 'ac-rim-lit', 0.6], [1, 'ac-rim-lit', 0]),
    );
    const lit = svg('rect', { ...REGION, fill: 'url(#ac-rim-lit)' });
    defs.append(fade, svg('mask', { id: 'ac-rim-mask', ...REGION, maskUnits: 'userSpaceOnUse' }, lit));
    const arc = svg('use', { class: 'ac-rim-arc', href: `#${solid}`, filter: 'url(#ac-rim-arc)' });
    inside.append(svg('g', { mask: 'url(#ac-rim-mask)' }, arc));
    return {
      layout(g) {
        set(fade, {
          gradientTransform: `translate(${fix(g.left + g.half * 0.5)} ${fix(g.top + g.hh * 0.2)}) scale(${fix(g.half * 0.95)} ${fix(g.hh * 0.85)})`,
        });
      },
    };
  },
});
