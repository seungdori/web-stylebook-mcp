# Releasing

Builds, tests, and npm releases run from a checkout of `web-stylebook-mcp`. The package includes
the reviewed catalog and visual contracts in `generated/` and the MIT resolver in
`src/visual-canonical/`. Installing dependencies requires access to npm.

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

1. From a clean checkout, run:
   ```bash
   npm ci
   npm run build
   npm test
   ```
   The suite verifies the catalog hash, counts and schema, visual artifact and resolver hashes,
   license, import allowlist, and reference outputs against the committed fixtures.
2. Bump the version in `package.json`, `package-lock.json`, `.claude-plugin/plugin.json`,
   `server.json` (both `version` fields), `src/server-info.ts` and `tests/contract.test.ts`.
   Move the changelog's unreleased entries under the new version and commit the release.
3. Tag the release commit and push the tag. For example, for version 0.4.0:
   ```bash
   git tag -a v0.4.0 -m "Release v0.4.0"
   git push origin v0.4.0
   ```
4. The `Publish` workflow checks that the version matches the tag, builds and tests, and packs
   the release. It installs the tarball in a clean project, validates the catalog, composes design
   tokens and checks the bundled skill. It publishes that same tarball to npm using OIDC.
   Verify the public version with `npm view web-stylebook-mcp version`.
5. To update the official MCP Registry entry after the npm release, run `mcp-publisher login github`
   and `mcp-publisher publish` from the release commit. [docs/listings.md](docs/listings.md) has the
   registry and directory metadata.

## Updating the website-authored snapshot

Maintainers with access to the website source perform these steps when importing new catalog or
visual data. Ordinary MCP releases reuse the checked-in snapshot.

1. Check out the intended website revision and run `npm ci`, `npm run mcp:catalog`, and
   `npm run mcp:catalog:validate` in that checkout.
2. From the MCP checkout, import the catalog, manifest, visual artifact, license and portable
   resolver. Set `website` to the path of the website checkout:
   ```bash
   cp "$website/packages/mcp/generated/catalog.v1.json" "$website/packages/mcp/generated/manifest.v1.json" generated/
   npm run visual:sync -- "$website"
   npm run catalog:check-canonical -- "$website/packages/mcp/generated"
   npm run visual:check -- "$website"
   ```
   `visual:sync` copies the seven `src/visual/` files byte for byte, except one case: the website
   imports zod through `src/utils/zod.ts`, which only sets jitless mode for its CSP. While that
   wrapper is exactly that re-export, the copy imports `zod` directly, and
   `generated/visual-contract-source.v1.json` records the wrapper hash and the rewrite. Any other
   import outside the seven files still stops the sync.
3. Review the changes together, update the pinned expectations and website parity fixtures for
   the new revision, and run the public build and test commands above. The current website parity
   fixture records the reviewed source revision in `tests/fixtures/website-visual-parity.v1.json`.
