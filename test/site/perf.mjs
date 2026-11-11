// The site's runtime budgets, against a production build: LCP, CLS and a
// scripted full-page scroll, at both viewports, at 4x CPU throttle, median of 5 runs. It fails on
// a budget, and prints frame cost as well. Raster runs in software here, so its share is reported
// but doesn't fail the run on its own. Under CI, a long task is a warning: a shared runner's task
// times say more about the runner than the page. Everything else still fails there.
//
//   bun run site:build && bun run test:perf
//
// SITE_PORT and SITE_OUT_DIR work as they do for test:site. RUNS sets the number of runs.
// oxlint-disable no-console -- this script's output is its report
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const PORT = Number(process.env.SITE_PORT ?? 41890);
const BASE = `http://127.0.0.1:${PORT}`;
const RUNS = Number(process.env.RUNS ?? 5);
const LCP_MS = 1500;
const CLS = 0.01;
const TASK_MS = 50;
const FRAME_MS = 1000 / 60;
const STEP_PX = 900;
/** A busy machine can drop a whole gesture, so one that goes nowhere isn't the end yet. */
const STALLS = 8;
const DRAG_FROM = 760;
const DRAG_TO = 120;
const DRAG_STEP = 24;
/** The gesture stops a few pixels short of the end, so "the end" is anything nearer than this. */
const END_PX = 64;

const VIEWPORTS = {
  '1440x900': { viewport: { width: 1440, height: 900 } },
  '390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const PAGES = ['/', '/playground', '/404'];

const median = (list) => list.toSorted((a, b) => a - b)[list.length >> 1];
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const round = (n) => Math.round(n * 100) / 100;

const observe = () => {
  const seen = { lcp: 0, cls: 0, longest: 0 };
  window.seen = seen;
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- this runs in the page
  function watch(type, each) {
    new PerformanceObserver((list) => list.getEntries().forEach(each)).observe({ type, buffered: true });
  }
  watch('largest-contentful-paint', (entry) => {
    seen.lcp = entry.startTime;
  });
  watch('layout-shift', (entry) => {
    if (!entry.hadRecentInput) seen.cls += entry.value;
  });
  watch('longtask', (entry) => {
    if (seen.watching) seen.longest = Math.max(seen.longest, entry.duration);
  });
};

async function open(browser, options, path) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(observe);
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  return { context, page, cdp };
}

/** Main-thread and raster cost of each frame in a trace. */
function frameCosts(buffer) {
  const events = JSON.parse(buffer.toString()).traceEvents;
  const [main] = events.filter((event) => event.name === 'thread_name' && event.args?.name === 'CrRendererMain')
    .map((event) => [`${event.pid}:${event.tid}`, events.filter((other) => other.name === 'FireAnimationFrame' && `${other.pid}:${other.tid}` === `${event.pid}:${event.tid}`).length])
    .toSorted((a, b) => b[1] - a[1])[0];
  const onMain = (event) => `${event.pid}:${event.tid}` === main;
  const tasks = events.filter((event) => event.ph === 'X' && event.name === 'RunTask' && onMain(event)).toSorted((a, b) => a.ts - b.ts);
  const frames = events.filter((event) => event.name === 'FireAnimationFrame' && onMain(event)).map((event) => event.ts);
  const framed = tasks.filter((task) => frames.some((at) => at >= task.ts && at < task.ts + task.dur));
  const raster = events.filter((event) => event.ph === 'X' && event.name === 'RasterTask').toSorted((a, b) => a.ts - b.ts);
  let next = 0;
  const costs = framed.map((task, index) => {
    const until = framed[index + 1]?.ts ?? Infinity;
    let drawn = 0;
    while (next < raster.length && raster[next].ts < until) drawn += raster[next++].dur;
    return { main: task.dur / 1000, total: (task.dur + drawn) / 1000 };
  });
  const sorted = (key) => costs.map((cost) => cost[key]).toSorted((a, b) => a - b);
  return { mainP95: percentile(sorted('main'), 0.95), totalP95: percentile(sorted('total'), 0.95) };
}

/** A finger, because a synthesized touch gesture leaves an emulated phone where it started. */
async function drag(page, cdp) {
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
  await touch('touchStart', DRAG_FROM);
  for (let y = DRAG_FROM; y > DRAG_TO; y -= DRAG_STEP) {
    await touch('touchMove', y);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd');
}

async function scrollRun(browser, options) {
  const { context, page, cdp } = await open(browser, options, '/');
  await page.evaluate(() => {
    window.seen.watching = true;
  });
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel'] });
  let previous = -1;
  let stalled = 0;
  while (stalled < STALLS) {
    await page.waitForTimeout(150);
    const { y, max } = await page.evaluate(() => ({ y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    if (max - y < END_PX) break;
    stalled = y === previous ? stalled + 1 : 0;
    previous = y;
    if (options.hasTouch) await drag(page, cdp);
    else await cdp.send('Input.synthesizeScrollGesture', { x: 180, y: 400, yDistance: -STEP_PX, speed: 1000, gestureSourceType: 'mouse' });
  }
  const costs = frameCosts(await browser.stopTracing());
  const result = await page.evaluate(() => ({ ...window.seen, y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  await context.close();
  return { ...result, ...costs };
}

const server = spawn('bun', ['test/site/serve.ts', String(PORT)], { cwd: root, stdio: 'ignore', detached: true });
const failures = [];
const warnings = [];

try {
  for (let tries = 0; ; tries += 1) {
    if (await fetch(`${BASE}/`).then(({ ok }) => ok, () => false)) break;
    if (tries > 100) throw new Error(`No server on port ${PORT}.`);
    await new Promise((done) => setTimeout(done, 100));
  }
  const browser = await chromium.launch();
  for (const [name, options] of Object.entries(VIEWPORTS)) {
    for (const path of PAGES) {
      const lcp = [];
      const cls = [];
      for (let run = 0; run < RUNS; run += 1) {
        const { context, page } = await open(browser, options, path);
        const seen = await page.evaluate(() => window.seen);
        lcp.push(seen.lcp);
        cls.push(seen.cls);
        await context.close();
      }
      console.log(`${name} ${path}: LCP ${round(median(lcp))} ms, CLS ${round(Math.max(...cls))}`);
      if (median(lcp) >= LCP_MS) failures.push(`${name} ${path}: LCP ${round(median(lcp))} ms`);
      if (Math.max(...cls) > CLS) failures.push(`${name} ${path}: CLS ${round(Math.max(...cls))}`);
    }
    const runs = [];
    for (let run = 0; run < RUNS; run += 1) runs.push(await scrollRun(browser, options));
    const reachedEnd = runs.every(({ y, max }) => max - y < END_PX);
    const longest = median(runs.map((run) => run.longest));
    console.log(`${name} scroll: longest task ${round(longest)} ms, frame p95 ${round(median(runs.map((run) => run.mainP95)))} ms main, ${round(median(runs.map((run) => run.totalP95)))} ms with raster (budget ${round(FRAME_MS)}), CLS ${round(Math.max(...runs.map((run) => run.cls)))}`);
    if (!reachedEnd) failures.push(`${name} scroll: stopped at ${runs.map(({ y, max }) => `${y} of ${max}`).join(', ')}`);
    if (longest > TASK_MS) (process.env.CI ? warnings : failures).push(`${name} scroll: a ${round(longest)} ms task`);
    if (Math.max(...runs.map((run) => run.cls)) > CLS) failures.push(`${name} scroll: CLS over ${CLS}`);
  }
  await browser.close();
} finally {
  // The server may already be gone. That must not replace the error that got us here.
  try {
    process.kill(-server.pid);
  } catch {
    console.warn('The preview server had already stopped.');
  }
}

if (warnings.length) console.warn(`\nOver budget on this runner, not failing CI:\n- ${warnings.join('\n- ')}`);

if (failures.length) {
  console.error(`\nOver budget:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nInside the budgets.');
