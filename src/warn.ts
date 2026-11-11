declare const process: { env: { NODE_ENV?: string } };
/** Set by the CDN build, which has no bundler downstream to replace `process.env.NODE_ENV`. */
declare const __DEV__: boolean | undefined;

/**
 * Bundlers replace the literal `process.env.NODE_ENV`, so a production build reads a constant
 * here and stays silent. Unbundled in a browser there is no `process`, the lookup throws, and
 * nothing says this is production, so those pages warn. Guarding with `typeof process` instead
 * would be wrong: bundlers leave that alone, and it is true in every browser.
 */
let dev: boolean;
try {
  dev = typeof __DEV__ === 'undefined' ? process.env.NODE_ENV !== 'production' : __DEV__;
} catch {
  dev = true;
}

const seen = new Set<string>();

/**
 * Warn once per distinct message, unless this is a production build. The messages stay in a
 * bundler's output, silent; only the CDN build, which marks this function pure, drops them.
 */
export function warnOnce(message: string): void {
  if (!dev || seen.has(message)) return;
  seen.add(message);
  console.warn(`agent-mascot: ${message}`);
}
