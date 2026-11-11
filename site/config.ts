// The only place these values live. The pages and the build read them, so links work without JS.

export const GITHUB_URL = 'https://github.com/comfycomputer/agent-mascots';
export const DOCS_URL = `${GITHUB_URL}/blob/main/docs/API.md`;
export const EXAMPLE_URL = `${GITHUB_URL}/tree/main/examples/sse`;

/** Where the site is hosted, on GitHub Pages, with no trailing slash. Pages serve without `.html`. */
export const SITE_URL = 'https://comfycomputer.github.io/agent-mascots';

/** The path the site is served under, `/agent-mascots`, or '' at a domain's root. */
export const SITE_BASE = new URL(SITE_URL).pathname.replace(/\/$/, '');

/** False prints "Not on npm yet" by the install command. Pages must also hide any CDN snippet. */
export const NPM_PUBLISHED: boolean = true;

export const INSTALL_COMMAND = 'npm install @comfycomputer/agent-mascots';
export const CDN_URL = 'https://cdn.jsdelivr.net/npm/@comfycomputer/agent-mascots/dist/cdn.js';
/** What the plain HTML sample loads until the CDN URL exists. Checked against a real install. */
export const LOCAL_SCRIPT = './node_modules/@comfycomputer/agent-mascots/dist/cdn.js';

/** The script the plain HTML sample loads: the CDN once the package is published. */
export const scriptSrc = (published = NPM_PUBLISHED) => (published ? CDN_URL : LOCAL_SCRIPT);

/** `owner/name`, from the GitHub URL. */
export const GITHUB_REPO = new URL(GITHUB_URL).pathname.replace(/^\/|\/$/g, '');
