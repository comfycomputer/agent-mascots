const QUERY = '(prefers-reduced-motion: reduce)';

let query: MediaQueryList | undefined;

/** Lazily, because importing has to work outside a browser. */
const media = (): MediaQueryList => (query ??= matchMedia(QUERY));

export const prefersReducedMotion = (): boolean => media().matches;

/** Follow the media query at runtime. Returns the unsubscriber. */
export function onReducedMotionChange(listener: () => void): () => void {
  media().addEventListener('change', listener);
  return () => media().removeEventListener('change', listener);
}
