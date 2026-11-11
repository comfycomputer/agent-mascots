// The cameo: a share link from the playground puts its mascot in the hero. Loaded only for a page
// with a hash, so a plain visit doesn't pay for the allowlist. The hash is untrusted: parseHash
// lets only known attributes through.

import { registerShape } from 'agent-mascots';
import { DRAWN_SHAPE, registerDrawn } from '../lib/drawn-shape';
import { parseHash } from '../lib/hash';

/** Set by the page, not the link: the mascot has to stay full detail and inside its box. */
const PAGE_OWNED = new Set(['detail', 'size', 'track', 'track-reach', 'sky']);

export interface Cameo {
  /** The look for the hero, mood aside. */
  look: Record<string, string>;
  mood: string | undefined;
}

/** The link's mascot, or null when the hash isn't a share link with one. */
export function readCameo(hash: string): Cameo | null {
  const link = parseHash(hash);
  if (!link || !Object.keys(link.attrs).length) return null;
  const { attrs, anchors } = link;
  if (attrs.shape === DRAWN_SHAPE && !(anchors && registerDrawn(anchors, registerShape))) return null;

  const look: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) if (!PAGE_OWNED.has(name) && name !== 'mood') look[name] = value;
  if (attrs.shape === DRAWN_SHAPE && !attrs.accessories) look.accessories = 'none';
  return { look, mood: attrs.mood };
}
