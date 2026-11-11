// Below 32768, where Linux hands out ports for outgoing connections: a port in that range can be
// taken by one when the server starts, which failed the site tests on CI.
export const BASE_PORT = Number(process.env.SITE_PORT ?? 4880);
export const PREVIEW_URL = `http://127.0.0.1:${BASE_PORT}`;
export const DEV_URL = `http://127.0.0.1:${BASE_PORT + 1}`;
