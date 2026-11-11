# Examples

The same small demo in each framework: one mascot, buttons that change its mood, a count of
pokes, and eyes that follow the pointer across the page.

| Example | Run from | Command |
|---|---|---|
| [Vanilla HTML](html/index.html) | repo root | `bun run examples:html` |
| [React](react/src/main.jsx) | `examples/react` | `bun run dev` |
| [Vue](vue/src/App.vue) | `examples/vue` | `bun run dev` |
| [Svelte](svelte/src/App.svelte) | `examples/svelte` | `bun run dev` |
| [Solid](solid/src/main.jsx) | `examples/solid` | `bun run dev` |
| [Server-sent events](sse) | repo root | `bun run build && bun examples/sse/server.mjs` |

Run `bun install && bun run build` in the repo root first. The examples use that local build
through an alias in each Vite config, so to use one as a starting point, remove the alias and add
`@comfycomputer/agent-mascots` as a dependency.

`bun run test:examples` runs all five in a real browser.
