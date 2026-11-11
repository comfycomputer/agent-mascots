/** Runs `callback` once the page is idle, or after `timeout` ms at the latest. Returns a cancel. */
export function onIdle(callback: () => void, timeout: number): () => void {
  // Safari has no requestIdleCallback before 26.
  if (!('requestIdleCallback' in window)) {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  }
  const handle = requestIdleCallback(callback, { timeout });
  return () => cancelIdleCallback(handle);
}
