# Releasing

The published package bundles a **frozen catalog snapshot** (`generated/catalog.v1.json`). It does
not fetch anything at runtime — so updating the Web Stylebook source does **not** automatically reach
users. A release is deliberate: regenerate the snapshot, bump the version, tag → CI publishes.

## One-time setup

In the npm package settings, add a **Trusted Publisher** for GitHub Actions:

- Organization or user: `seungdori`
- Repository: `web-stylebook-mcp`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

The `Publish` workflow uses short-lived OIDC credentials, so no long-lived `NPM_TOKEN` or
interactive `npm login` is required. After one successful release, consider setting publishing
access to require 2FA and disallow traditional tokens.

## Cut a release

1. **Refresh the catalog** (only if the Web Stylebook source changed). In the source repo:
   ```bash
   npm run mcp:catalog          # regenerate from src/catalog → packages/mcp/generated
   npm run mcp:catalog:validate # sanity-check the new snapshot
   ```
   Then copy the regenerated `generated/catalog.v1.json` + `generated/manifest.v1.json` into this
   repo's `generated/`.
2. **Bump** the version in `package.json` and move CHANGELOG `[Unreleased]` → the new version.
3. **Tag and push** — the version tag triggers the publish and must match `package.json`:
   ```bash
   git tag -a v0.4.0 -m "Release v0.4.0"
   git push origin v0.4.0
   ```
4. The **`Publish`** workflow runs `build` + `test` + package smoke tests + `npm publish`.
   npm automatically attaches provenance for trusted publishing. Verify with
   `npm view web-stylebook-mcp version`.

> The runtime stays offline/deterministic by design; "freshness" means a fast, automated
> regenerate-and-republish, not a live fetch.
