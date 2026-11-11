// Measures frame time for the spec's performance targets in headless Chromium.
//
//   bun test/perf/run.mjs [--throttle=N] [--seconds=N] [--headed] [--json=path] [scene ...]
//
// Run after `bun run build`. It reports rAF cadence, and main-thread and raster cost from a
// devtools trace, because in headless Chromium a slow frame does not always delay rAF.
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const PORT = Number(process.env.PORT ?? 4874);
const BUDGET = 1000 / 60;

const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [key, value] = a.slice(2).split('=');
    return [key, value ?? true];
  }),
);
const chosen = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const throttle = Number(flags.throttle ?? 1);
const seconds = Number(flags.seconds ?? 6);

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const round = (n) => Math.round(n * 100) / 100;

/** Attribute trace events to frames: main-thread tasks running rAF, and raster work between them. */
function analyseTrace(trace) {
  const events = JSON.parse(trace).traceEvents;
  const main = new Set(
    events.filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`),
  );
  const onMain = (e) => main.has(`${e.pid}:${e.tid}`);
  const tasks = events
    .filter((e) => e.ph === 'X' && onMain(e) && (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask'))
    .toSorted((a, b) => a.ts - b.ts);
  const sum = (name, filter = () => true) =>
    events.filter((e) => e.name === name && e.ph === 'X' && filter(e)).reduce((total, e) => total + e.dur, 0) / 1000;
  const raf = events.filter((e) => e.name === 'FireAnimationFrame' && onMain(e)).toSorted((a, b) => a.ts - b.ts);
  const frameTasks = [];
  let next = 0;
  for (const task of tasks) {
    while (next < raf.length && raf[next].ts < task.ts) next++;
    if (next < raf.length && raf[next].ts < task.ts + task.dur) frameTasks.push(task.dur / 1000);
  }
  const frames = Math.max(1, raf.length);
  const sorted = frameTasks.toSorted((a, b) => a - b);
  return {
    frames: raf.length,
    mainP50: round(percentile(sorted, 0.5)),
    mainP95: round(percentile(sorted, 0.95)),
    mainP99: round(percentile(sorted, 0.99)),
    scriptPerFrame: round(sum('FireAnimationFrame', onMain) / frames),
    stylePerFrame: round(sum('UpdateLayoutTree', onMain) / frames),
    prePaintPerFrame: round(sum('PrePaint', onMain) / frames),
    paintPerFrame: round(sum('Paint', onMain) / frames),
    rasterPerFrame: round(sum('RasterTask') / frames),
    gpuPerFrame: round(sum('GPUTask') / frames),
  };
}

const server = spawn('node', ['test/browser/serve.mjs', String(PORT)], { cwd: root, stdio: 'ignore' });
// Poll rather than sleep: on a busy machine the server can take seconds to listen.
for (let tries = 0; ; tries++) {
  const up = await fetch(`http://127.0.0.1:${PORT}/test/browser/harness.html`).then((r) => r.ok, () => false);
  if (up) break;
  if (tries > 100) throw new Error('the static server did not start');
  await new Promise((resolve) => setTimeout(resolve, 100));
}
const browser = await chromium.launch({ headless: !flags.headed });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${PORT}/test/perf/bench.html`);
  await page.waitForFunction(() => 'ready' in window);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

  const scenes = chosen.length ? chosen : await page.evaluate(() => window.scenes);
  for (const scene of scenes) {
    // Trace a second run of the scene: tracing has overhead, so it must not touch the cadence.
    const cadence = await page.evaluate(([s, ms]) => window.bench(s, ms), [scene, seconds * 1000]);
    await browser.startTracing(page, {
      categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'cc'],
    });
    await page.evaluate(([s, ms]) => window.bench(s, ms, 300), [scene, 3000]);
    const trace = analyseTrace((await browser.stopTracing()).toString());

    const sorted = cadence.toSorted((a, b) => a - b);
    const late = cadence.filter((ms) => ms > BUDGET * 1.5).length;
    results.push({
      scene,
      fps: round(cadence.length / (cadence.reduce((a, b) => a + b, 0) / 1000)),
      p50: round(percentile(sorted, 0.5)),
      p95: round(percentile(sorted, 0.95)),
      p99: round(percentile(sorted, 0.99)),
      max: round(sorted.at(-1) ?? 0),
      droppedPct: round((late / cadence.length) * 100),
      ...trace,
    });
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
  server.kill();
}

const out = [`CPU throttle ${throttle}x. All times in ms. Budget ${round(BUDGET)}ms per frame.`];
out.push('scene                 fps    p50    p95    p99    max  drop%  main50 main95 main99  script  style prepnt  paint raster');
for (const r of results) {
  out.push(
    [
      r.scene.padEnd(19),
      ...[r.fps, r.p50, r.p95, r.p99, r.max, r.droppedPct, r.mainP50, r.mainP95, r.mainP99, r.scriptPerFrame, r.stylePerFrame, r.prePaintPerFrame, r.paintPerFrame, r.rasterPerFrame].map((n) =>
        String(n).padStart(6),
      ),
    ].join(' '),
  );
}
process.stdout.write(`${out.join('\n')}\n`);
if (typeof flags.json === 'string') await writeFile(flags.json, JSON.stringify(results, null, 2));
