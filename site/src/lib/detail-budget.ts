// Holds the page to MAX_FULL_DETAIL mascots rendering at full detail while in view, at any scroll
// position. "Full detail" matches the library: `detail="full"`, or `auto` wider than 64px.
//
// A mascot over the limit drops to `detail="simple"`, and gets its own value back when a slot
// frees up. Pages should plan to stay under the limit, as this is the backstop: in a dev build
// it warns when it has to act. `motion="0"` wouldn't do, because that doesn't stop per-frame work.
//
// Where a page knows what matters most, `data-detail-priority="1"` keeps that mascot in a slot
// (higher wins, the default is 0). Otherwise whoever holds a slot keeps it, so nothing flickers.

import { MAX_FULL_DETAIL, MAX_FULL_WIDTH, MAX_SIMPLE_ON_SCREEN } from './limits';
import { watchMascots } from './mascots';

interface Tracked {
  inView: boolean;
  width: number;
  authored: string | null;
  demoted: boolean;
}

/** Where `detail="auto"` switches renderer: SIMPLE_MAX_WIDTH in src/constants.ts. */
const AUTO_SIMPLE_MAX = 64;

const tracked = new Map<HTMLElement, Tracked>();
const stats = { limit: MAX_FULL_DETAIL, full: 0, demoted: 0, simple: 0, peakFull: 0, peakSimple: 0 };

const warned = new Set<string>();
function warnOnce(message: string) {
  if (!import.meta.env.DEV || warned.has(message)) return;
  warned.add(message);
  console.warn(`[site budget] ${message}`);
}

const wantsFull = ({ authored, width }: Tracked) =>
  authored === 'full' || (authored !== 'simple' && width > AUTO_SIMPLE_MAX);

const priorityOf = (el: HTMLElement) => Number(el.dataset.detailPriority) || 0;

function demote(el: HTMLElement, state: Tracked) {
  if (state.demoted) return;
  state.demoted = true;
  el.setAttribute('detail', 'simple');
}

function promote(el: HTMLElement, state: Tracked) {
  if (!state.demoted) return;
  state.demoted = false;
  if (state.authored === null) el.removeAttribute('detail');
  else el.setAttribute('detail', state.authored);
}

function enforce() {
  const candidates: [HTMLElement, Tracked][] = [];
  let simple = 0;
  for (const [el, state] of tracked) {
    if (!state.inView) continue;
    if (wantsFull(state)) candidates.push([el, state]);
    else simple += 1;
  }

  // Map order breaks ties, which is arrival order, so a stable sort keeps the choice steady.
  candidates.sort(([a, stateA], [b, stateB]) =>
    priorityOf(b) - priorityOf(a) || Number(stateA.demoted) - Number(stateB.demoted));

  candidates.forEach(([el, state], index) => {
    if (index < MAX_FULL_DETAIL) promote(el, state);
    else demote(el, state);
  });

  stats.full = Math.min(candidates.length, MAX_FULL_DETAIL);
  stats.demoted = candidates.length - stats.full;
  stats.simple = simple + stats.demoted;
  stats.peakFull = Math.max(stats.peakFull, stats.full);
  stats.peakSimple = Math.max(stats.peakSimple, stats.simple);

  if (stats.demoted) warnOnce(`${candidates.length} full-detail mascots in view. The limit is ${MAX_FULL_DETAIL}.`);
  if (stats.simple > MAX_SIMPLE_ON_SCREEN) warnOnce(`${stats.simple} simple mascots in view. The limit is ${MAX_SIMPLE_ON_SCREEN}.`);
  for (const [, state] of candidates) {
    if (state.width > MAX_FULL_WIDTH) warnOnce(`A full-detail mascot is ${state.width}px wide. The limit is ${MAX_FULL_WIDTH}px.`);
  }
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    enforce();
  });
}

let intersection: IntersectionObserver;
let resize: ResizeObserver;

function track(el: HTMLElement) {
  if (tracked.has(el)) return;
  tracked.set(el, { inView: false, width: 0, authored: el.getAttribute('detail'), demoted: false });
  intersection.observe(el);
  resize.observe(el);
}

function untrack(el: HTMLElement) {
  const state = tracked.get(el);
  if (!state) return;
  promote(el, state);
  tracked.delete(el);
  intersection.unobserve(el);
  resize.unobserve(el);
  schedule();
}

/** A read of the current counts, for the site tests and test:perf. */
export const detailStats = () => ({ ...stats });

export function startDetailBudget() {
  intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const state = tracked.get(entry.target as HTMLElement);
      if (state) state.inView = entry.isIntersecting;
    }
    schedule();
  });
  resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const state = tracked.get(entry.target as HTMLElement);
      if (state) state.width = entry.contentRect.width;
    }
    schedule();
  });

  watchMascots({
    added: track,
    removed: untrack,
    changed(el, name) {
      const state = tracked.get(el);
      if (!state || name !== 'detail') return;
      const value = el.getAttribute('detail');
      // Our own write comes back through here too. Anything else is the page changing its mind.
      if (state.demoted && value === 'simple') return;
      state.demoted = false;
      state.authored = value;
      schedule();
    },
  });
}
