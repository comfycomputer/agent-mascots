import type { detailStats } from './lib/detail-budget';

declare global {
  interface Window {
    /** For the detail-budget checks in the site tests and test:perf, which run against production builds. */
    siteDetailStats: typeof detailStats;
  }
}
