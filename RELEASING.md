# Releasing

The published package bundles a **frozen catalog snapshot** (`generated/catalog.v1.json`). It does
not fetch anything at runtime — so updating the Web Stylebook source does **not** automatically reach
users. A release is deliberate: regenerate the snapshot, bump the version, tag → CI publishes.

## One-time setup

Add an **`NPM_TOKEN`** repository secret (npm → Access Tokens → a Granular/Automation token with
publish rights for `web-stylebook-mcp`). The `Publish` workflow uses it — no interactive `npm login`.

## Cut a release

1. **Refresh the catalog** (only if the Web Stylebook source changed). In the source repo:
   ```bash
   npm run mcp:catalog          # regenerate from src/catalog → packages/mcp/generated
   npm run mcp:catalog:validate # sanity-check the new snapshot
   ```
   Then copy the regenerated `generated/catalog.v1.json` + `generated/manifest.v1.json` into this
   repo's `generated/`.
2. **Bump** the version in `package.json` and move CHANGELOG `[Unreleased]` → the new version.
3. **Tag and push** — the tag triggers the publish:
   ```bash
   git commit -am "Release 0.1.2"
   git tag v0.1.2
   git push origin master --follow-tags
   ```
4. The **`Publish`** workflow runs `build` + `test` + `npm publish --provenance`. Verify with
   `npm view web-stylebook-mcp version`.

> The runtime stays offline/deterministic by design; "freshness" means a fast, automated
> regenerate-and-republish, not a live fetch.
