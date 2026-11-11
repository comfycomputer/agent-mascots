// A fake agent behind a real stream, with no dependencies and no vendor SDK. Run `bun run build`
// once, then `bun examples/sse/server.mjs` from the repo root, and open the address it prints.
//
// Swap fakeAgent for your own agent. The page only needs one event name per line of the stream.

import { createReadStream, readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const here = new URL('./', import.meta.url);
const page = readFileSync(new URL('index.html', here));
const library = new URL('../../dist/cdn.js', here);

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** One run: every event the page maps to a mood, in a believable order. */
async function fakeAgent(send) {
  for (const [event, ms] of [['start', 1800], ['tool', 2200], ['blocked', 2200], ['tool', 1800], ['done', 0]]) {
    send(event);
    await wait(ms);
  }
}

const server = createServer(async (request, response) => {
  if (request.url === '/agent') {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    await fakeAgent((event) => response.write(`data: ${event}\n\n`));
    response.end();
  } else if (request.url === '/cdn.js') {
    response.writeHead(200, { 'content-type': 'text/javascript' });
    createReadStream(library).pipe(response);
  } else {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(page);
  }
});

server.listen(Number(process.env.PORT ?? 4310), '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${server.address().port}`);
});
