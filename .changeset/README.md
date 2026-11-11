# Changesets

A changeset is a short note that says how a change affects the package, and by how much. Add one
with every pull request that users would notice:

```sh
bun run changeset
```

Pick the bump, then write one line for the changelog. While the version is `0.x`, use `minor` for
breaking changes and `patch` for everything else. Changes that users won't notice, such as tests,
the site or tooling, don't need one.

On `main`, the Release workflow keeps a "Version Packages" pull request open with every pending
changeset rolled into the next version and `CHANGELOG.md`. Merging it publishes to npm.

See [changesets.dev](https://changesets.dev) for more.

`package.json` lists the root folder, `"."`, as a workspace. Without it, the examples' workspaces
make Changesets treat the repo as a monorepo, and a monorepo's root package is never published.
