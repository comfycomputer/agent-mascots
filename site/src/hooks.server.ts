// Runs as each page is prerendered.

import type { Handle } from '@sveltejs/kit';

/**
 * Pages that keep to their own colour scheme, whatever the visitor's, so they look as designed.
 * The playground's toggle changes its scheme from here, and remembers it. Others follow the visitor.
 */
const LIGHT = new Set(['/', '/playground']);

export const handle: Handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%scheme%', LIGHT.has(event.route.id ?? '') ? ' data-scheme="light"' : ''),
  });
