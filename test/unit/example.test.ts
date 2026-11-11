import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const server = fileURLToPath(new URL('../../examples/sse/server.mjs', import.meta.url));

describe('examples/sse', () => {
  it('streams one whole run, with a mood for every event, and then ends', async () => {
    const child = spawn(process.execPath, [server], { env: { ...process.env, PORT: '0' } });
    try {
      const address = await new Promise<string>((resolve) => {
        child.stdout.once('data', (data: Buffer) => resolve(data.toString().trim()));
      });
      const page = await (await fetch(address)).text();
      const body = await (await fetch(`${address}/agent`)).text();
      const events = [...body.matchAll(/^data: (\w+)$/gm)].map(([, event]) => event);
      expect(events.at(0)).toBe('start');
      expect(events.at(-1)).toBe('done');
      for (const event of events) expect(page).toContain(`${event}: '`);
    } finally {
      child.kill();
    }
  }, 20_000);
});
