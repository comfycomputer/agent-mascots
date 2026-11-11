import { blur, fix, inset, REGION, set, stops, svg } from '../dom.js';
import type { Material } from './types.js';

/** A thin bubble: almost clear in the middle, bright at the rim, light pooling at the base. */
export const glass: Material = ({ defs, paint, solid }) => {
  // Placed in user space around the body, so arms and ears past its sides take the rim's colour.
  const shellFade = svg(
    'radialGradient',
    { id: 'shell', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 1 },
    ...stops([0.3, 'shell-0'], [0.78, 'shell-1'], [1, 'shell-2']),
  );
  defs.append(
    blur('soft', 4),
    inset('wall', 2.4),
    shellFade,
    svg('radialGradient', { id: 'pool' }, ...stops([0, 'pool', 0.38], [1, 'pool', 0])),
  );
  // A rect, cut by the mask, so joined parts share one gradient.
  const shell = svg('rect', { ...REGION, fill: 'url(#shell)' });
  const wall = svg('use', { href: `#${solid}`, class: 'wall', filter: 'url(#wall)' });
  const pool = svg('ellipse', { fill: 'url(#pool)' });
  paint.append(shell, pool, wall);
  return {
    layout(g) {
      const height = g.bottom - g.top;
      set(shellFade, {
        gradientTransform: `translate(120 ${fix(g.top + height * 0.44)}) scale(${fix((g.half * 2 + 32) * 0.68)} ${fix(height * 0.68)})`,
      });
      set(pool, {
        cx: 120,
        cy: fix(g.bottom - g.hh * 0.14),
        rx: fix(g.half * 0.86),
        ry: fix(g.hh * 0.44),
      });
    },
  };
};

export const glassCss = String.raw`
[data-material='glass'] {
  --shine-0: #ffffff59;
  --shine-1: #ffffff1f;
  --shell-0: oklch(from var(--_c) clamp(.74, l, .86) calc(c * .7) h / .12);
  --shell-1: oklch(from var(--_c) clamp(.68, l, .8) c h / .3);
  --shell-2: oklch(from var(--_c) clamp(.62, l, .76) calc(c * 1.15) h / .72);
  --pool: oklch(from var(--_c) clamp(.8, calc(l + .14), .92) calc(c * .8) h);
  --wall: oklch(from var(--_c) clamp(.66, l, .82) c h);
  --halo-a: .16;
  --wall-a: .9;
  --edge-a: .7;
  --e0: oklch(from var(--_c) clamp(.4, calc(l - .2), .56) calc(c * 1.1) h);
  --e1: oklch(from var(--_c) clamp(.46, calc(l - .14), .62) calc(c * 1.1) h);
  --e2: oklch(from var(--_c) clamp(.56, calc(l - .04), .72) c h);
  --eye-lip: oklch(from var(--_c) .96 calc(c * .2) h / .7);
}
`;
