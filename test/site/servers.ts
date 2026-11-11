export const BASE_PORT = Number(process.env.SITE_PORT ?? 41880);
export const PREVIEW_URL = `http://127.0.0.1:${BASE_PORT}`;
export const DEV_URL = `http://127.0.0.1:${BASE_PORT + 1}`;
