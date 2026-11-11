// External so the page can run under a CSP with no inline scripts.
import { MASCOT_MOODS, registerShape } from './node_modules/@comfycomputer/agent-mascots/dist/cdn.js';

registerShape('fixture-kite', {
  path: 'M120 50L180 120L120 190L60 120Z',
  eyes: { y: 120, w: 14, h: 24, gap: 14 },
  top: 50,
  bottom: 190,
  halfWidth: 60,
});
document.querySelector('#status').textContent = `${MASCOT_MOODS.length} moods`;
