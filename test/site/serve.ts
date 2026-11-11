// Serves the built site as GitHub Pages does, so the tests see what a visitor will.
//
//   bun test/site/serve.ts [port]
//
// The site lives under SITE_BASE, `/agent-mascots/`, and `/agent-mascots` without the slash
// redirects there. A page is served at its address with or without `.html`. Anything else under
// the base that isn't a file gets the top-level 404.html, with a 404, and so does anything outside
// it. SITE_OUT_DIR picks the build, as for the build itself.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { SITE_BASE } from '../../site/config.ts';

const root = process.env.SITE_OUT_DIR ? resolve(process.env.SITE_OUT_DIR) : resolve(import.meta.dirname, '../../site/dist');
const port = Number(process.argv[2] ?? process.env.SITE_PORT ?? 41880);

const TYPES: Record<string, string> = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain;charset=utf-8',
};

/** The file at `path` under the build, if there is one. */
async function file(path: string): Promise<string | null> {
  const full = resolve(root, `.${path}`);
  if (!full.startsWith(`${root}/`) || path.endsWith('/')) return null;
  return (await stat(full).catch(() => null))?.isFile() ? full : null;
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (SITE_BASE && url.pathname === SITE_BASE) {
    response.writeHead(301, { location: `${SITE_BASE}/${url.search}` }).end();
    return;
  }
  const path = decodeURIComponent(url.pathname.slice(SITE_BASE.length));
  const inside = url.pathname.startsWith(`${SITE_BASE}/`);
  const found = inside ? ((await file(path)) ?? (await file(path.endsWith('/') ? `${path}index.html` : `${path}.html`))) : null;
  const served = found ?? resolve(root, '404.html');
  response.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(served)] ?? 'application/octet-stream' });
  response.end(await readFile(served));
}).listen(port, '127.0.0.1');
