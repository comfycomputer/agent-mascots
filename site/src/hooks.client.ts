// Runs once, before any page hydrates: the element first, so every mascot the build wrote
// upgrades, then the detail budget that watches them.

import '@comfycomputer/agent-mascots';
import type { ClientInit } from '@sveltejs/kit';
import { detailStats, startDetailBudget } from './lib/detail-budget';

export const init: ClientInit = () => {
  startDetailBudget();
  // For the detail-budget checks in the site tests and test:perf, which run against production builds.
  window.siteDetailStats = detailStats;
};
