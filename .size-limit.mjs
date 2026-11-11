// What a production build ships. The warnings stay in that output, silent, so this define
// barely moves the number; the CDN file is the only one without them.
const production = (config) => ({
  ...config,
  transform: { ...config.transform, define: { 'process.env.NODE_ENV': '"production"' } },
});

// The library's size budget. Keep at least 500 B of margin under each limit.
export default [
  { name: 'agent-mascots (full)', path: 'dist/index.js', import: '*', gzip: true, limit: '29 kB', modifyRolldownConfig: production },
  { name: 'agent-mascots/core', path: 'dist/core.js', import: '*', gzip: true, limit: '20 kB', modifyRolldownConfig: production },
  { name: 'agent-mascots/cdn', path: 'dist/cdn.js', rolldown: false, gzip: true, limit: '29 kB' },
];
