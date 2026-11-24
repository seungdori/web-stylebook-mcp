# Directory and registry listings

Metadata for listing `web-stylebook-mcp` in MCP directories. Nothing here has been submitted. Each
submission needs the maintainer's approval first.

`tests/install-config.test.ts` checks that every install link and config block below starts the
same command as the README. `tests/install-launch.test.ts` starts the server from each README
config and from a bundle staged as in [Smithery](#smithery).

## Shared metadata

| Field | Value |
|---|---|
| Name | Web Stylebook |
| Server key | `web-stylebook` |
| npm package | [`web-stylebook-mcp`](https://www.npmjs.com/package/web-stylebook-mcp) |
| One-line description | Design judgment for coding agents. It improves the UI you already have and shows the evidence. |
| Repository | https://github.com/seungdori/web-stylebook-mcp |
| Website | https://webstylebook.com |
| License | MIT |
| Transport | stdio, local. No API key, no network access, no environment variables. |
| Requirements | Node 20 or later |
| Categories | Design; Developer Tools |
| Tags | `design`, `ui`, `ux`, `frontend`, `design-system`, `design-tokens`, `accessibility`, `mcp`, `cursor`, `claude-code`, `codex`, `vscode` |
| Logo | https://webstylebook.com/favicon.svg (SVG, 512 × 512 viewBox) |
| Social card | https://webstylebook.com/social-card.jpg (JPEG, 1280 × 800) |
| Screenshot | https://raw.githubusercontent.com/seungdori/web-stylebook-mcp/master/docs/demo/before-after.png |
| Screenshot caption | Left: a fixture dashboard written in a common generated style. Right: the same page after one pass of the `web-stylebook-design` skill. Fictional data. |

The logo is SVG only. A directory that needs PNG or JPEG gets the social card, or a PNG export of
the favicon made before submitting.

Longer description, taken from the README:

> It bundles 24 researched foundations with 30 attributed sources, 25 interface principles, 23 UX
> principles, 48 visual directions and 520 real-world references. The agent captures the page,
> plans, edits the real source, captures again and compares. The run counts as `complete` only with
> matched before/after captures, kept links and test hooks, and behavior and accessibility checks.
> It stays local: no API key, no model calls, no network, and it never reads your files.

## Install configuration

Server object (the value of `config` in Cursor links):

```json
{"command":"npx","args":["-y","web-stylebook-mcp@latest"]}
```

`mcp.json` block for Cursor (`.cursor/mcp.json` or `~/.cursor/mcp.json`), Windsurf and other clients:

```json
{
  "mcpServers": {
    "web-stylebook": {
      "command": "npx",
      "args": ["-y", "web-stylebook-mcp@latest"]
    }
  }
}
```

Cursor install deeplink (`config` is the base64 of the server object above):

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=web-stylebook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIndlYi1zdHlsZWJvb2stbWNwQGxhdGVzdCJdfQ==
```

GitHub removes `cursor://` links from rendered Markdown, so READMEs link the button to Cursor's web
page with the same parameters. That page opens the deeplink above:

```text
https://cursor.com/install-mcp?name=web-stylebook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIndlYi1zdHlsZWJvb2stbWNwQGxhdGVzdCJdfQ==
```

Button image: `https://cursor.com/deeplink/mcp-install-dark.svg` (light variant:
`https://cursor.com/deeplink/mcp-install-light.svg`).

Claude Code and Codex:

```bash
claude mcp add web-stylebook -- npx -y web-stylebook-mcp@latest
codex mcp add web-stylebook -- npx -y web-stylebook-mcp@latest
```

VS Code (GitHub Copilot) install link. `url` is the URL-encoded `vscode:mcp/install?` link, and that
link's query is the URL-encoded server object with `"name": "web-stylebook"` added:

```text
https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522web-stylebook%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522web-stylebook-mcp%2540latest%2522%255D%257D
```

For a manual setup, VS Code reads the `mcpServers` block with `"type": "stdio"` added from `.mcp.json`
at the workspace root or from `~/.copilot/mcp-config.json`.

## Official MCP Registry

- File: [`server.json`](../server.json), schema `2025-12-11`, the current released schema.
- Server name: `io.github.seungdori/web-stylebook-mcp`. It uses the GitHub namespace, so
  `mcp-publisher login github` as `seungdori` proves ownership.
- npm ownership: the registry checks that `mcpName` in the published `package.json` equals the
  server name. `mcpName` is in `package.json` from 0.16.0, so publish 0.16.0 to npm first.
- On each release, set `version` and `packages[0].version` in `server.json` to the npm version.
  The install-config test fails if they differ from `package.json`.
- Publish after the npm release: `mcp-publisher login github`, then `mcp-publisher publish`.

## Smithery

Checked on 2026-11-25. Smithery is now part of Arcade, and its old documentation site returns 404.
Its home page says the hosted MCP proxy and managed identity shut down on 2026-10-31; whether the
registry still accepts new servers was not checked. The `smithery` CLI (npm `smithery` 1.2.0,
source moved to `arcadeai-labs/smithery-cli`) publishes a server URL or an MCP bundle (`.mcpb`).
This server runs locally over stdio, so it is listed as a bundle.

- File: [`manifest.json`](../manifest.json), MCPB manifest version 0.3. Smithery reads `name`,
  `version`, `server.mcp_config` and `tools` from it. The listing shows only the tools in `tools`.
- Size: the CLI rejects bundles over 25 MB. The 0.16.0 bundle is 5.1 MB.
- On each release, set `version` in `manifest.json` to the npm version. The install-config test
  fails if they differ, and the launch test fails if `tools` misses a server tool.
- The CLI reads only `name` from an optional `smithery.yaml`. The `-n` option below replaces it, so
  the repository has no `smithery.yaml`.

Build the bundle from the released npm package, in an empty folder with this repository's
`manifest.json`:

```bash
npm pack web-stylebook-mcp@<version>
mkdir bundle
tar -xzf web-stylebook-mcp-<version>.tgz -C bundle --strip-components=1
cp manifest.json bundle/
(cd bundle && npm install --omit=dev --ignore-scripts)
npx -y @anthropic-ai/mcpb validate bundle/manifest.json
npx -y @anthropic-ai/mcpb pack bundle server.mcpb
```

Publish after the maintainer approves. The CLI asks for a Smithery API key:

```bash
smithery mcp publish ./server.mcpb -n <namespace>/web-stylebook
```

## cursor.directory

The submission form returned HTTP 429 to automated requests on 2026-11-24, so its exact fields are
not recorded here. Use the shared metadata: name, one-line description, repository, website, logo,
`mcp.json` block, Cursor deeplink, categories and tags.

## mcp.so

The submit page (https://mcp.so/submit) asks for a type, a name and a repository URL. The rest of
the form loads after the type is chosen.

| Field | Value |
|---|---|
| Type | MCP Server |
| Name | Web Stylebook |
| Repository URL | https://github.com/seungdori/web-stylebook-mcp |

Fill any later fields from the shared metadata. The page also offers a paid submission. Do not
choose it without the maintainer's approval.
