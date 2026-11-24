<div align="center">

# web-stylebook-mcp

**Design judgment for coding agents. It improves the UI you already have and shows the evidence.**

[![npm version](https://img.shields.io/npm/v/web-stylebook-mcp?logo=npm&color=cb3837)](https://www.npmjs.com/package/web-stylebook-mcp)
[![downloads](https://img.shields.io/npm/dm/web-stylebook-mcp?color=cb3837)](https://www.npmjs.com/package/web-stylebook-mcp)
[![license](https://img.shields.io/npm/l/web-stylebook-mcp?color=3b82f6)](./LICENSE)
[![node](https://img.shields.io/node/v/web-stylebook-mcp?logo=nodedotjs&color=339933)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-server-6E56CF)](https://modelcontextprotocol.io)

**English** · [한국어](./README.ko.md)

</div>

![Left: a dashboard in a common generated style, with the outage below the fold. Right: the same page after one pass of the skill, with the degraded service and the open incident at the top.](https://raw.githubusercontent.com/seungdori/web-stylebook-mcp/master/docs/demo/before-after.png)

<sub>Left: a fixture dashboard written in a common generated style. Right: the same page after one
pass of the `web-stylebook-design` skill, run by Claude Opus 5.5 with no human edits. Fictional
data. [How it was made, what was measured, and what it does not show →](./docs/demo/README.md)</sub>

- **It knows design.** It bundles 24 researched foundations with 30 attributed sources, 25
  interface principles, 23 UX principles, 48 visual directions and 520 real-world references. Each
  rule says when it applies, when it does not, and how to check the result.
- **It makes the agent finish the job.** The agent captures the page, plans, edits the real source,
  captures again and compares. The run counts as `complete` only with matched before/after
  captures, kept links and test hooks, and behavior and accessibility checks. Otherwise the result
  is `needs-work`, with a list of what is missing.
- **It stays local.** No API key, no model calls, no network, and it never reads your files. The
  same input always gives the same output.

## Install

Node 20 or later is required.

### Cursor

Click the button:

[![Add web-stylebook to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=web-stylebook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIndlYi1zdHlsZWJvb2stbWNwQGxhdGVzdCJdfQ==)

The button opens Cursor's install deeplink. If Cursor does not open, paste the deeplink into your
browser:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=web-stylebook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIndlYi1zdHlsZWJvb2stbWNwQGxhdGVzdCJdfQ==
```

Or add the server to `.cursor/mcp.json` in your project (`~/.cursor/mcp.json` for every project):

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

### Claude Code

The plugin installs the skill and the MCP server together (Claude Code 2.1.275 or later):

```text
/plugin install web-stylebook --marketplace seungdori/web-stylebook-mcp
```

For the MCP server only, run:

```bash
claude mcp add web-stylebook -- npx -y web-stylebook-mcp@latest
```

This turns the server on for you in the current project. For every project, add `--scope user`
after `add`. To share the server with your team, add `--scope project`: Claude Code then writes it
to `.mcp.json` in the project root. You can also write that file yourself:

```json
{
  "mcpServers": {
    "web-stylebook": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "web-stylebook-mcp@latest"]
    }
  }
}
```

Claude Code asks each person once to approve the servers in `.mcp.json`. `claude mcp list` shows
whether the server connects.

### Codex

```bash
codex mcp add web-stylebook -- npx -y web-stylebook-mcp@latest
```

The command adds the server to `~/.codex/config.toml`. You can also add these lines to that file
yourself:

```toml
[mcp_servers.web-stylebook]
command = "npx"
args = ["-y", "web-stylebook-mcp@latest"]
```

### VS Code

For GitHub Copilot in VS Code, click the button:

[![Install web-stylebook in VS Code](https://img.shields.io/badge/VS_Code-Install_web--stylebook-0098FF?logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522web-stylebook%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522web-stylebook-mcp%2540latest%2522%255D%257D)

VS Code opens the server's page, where you review the command before you install it.

Or add the server to `.mcp.json` at the workspace root, the same file Claude Code reads. For every
workspace, add it to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "web-stylebook": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "web-stylebook-mcp@latest"]
    }
  }
}
```

In a trusted workspace, VS Code starts servers from `.mcp.json` without another prompt. **MCP: List
Servers** in the Command Palette shows the server. Older guides use `.vscode/mcp.json` with a
`servers` key; VS Code now marks that format as deprecated.

### Skill and other clients

Any agent with skills (Claude Code, Codex, Cursor and others) can install the skill. `npx skills`
needs Node 22.20 or later:

```bash
npx skills add seungdori/web-stylebook-mcp
```

Windsurf and Claude Desktop settings are in the [reference](./docs/reference.md#install).

## Use

Ask for a change to a screen you already have:

> Improve the dashboard so on-call sees what is broken first.

The agent captures the page and calls `get_design_improvement_plan`. Then it edits your code,
checks what the edit kept with `compare_page_revisions`, and finishes with
`validate_design_improvement_result`. You get before/after screenshots, each change with its
reason, the checks that ran, and what was not verified.

For a new page, describe the product instead, for example *"a landing page for a payments API"*.
The agent starts with `recommend_design_direction` and shows the candidates it ranked, plus the ones
it rejected and why.

If you ask for a review only, the agent audits and reports without editing anything.

## Without MCP

The skill works without the MCP server. It runs the same tools from the shell and gets the same
results:

```bash
npx -y web-stylebook-mcp tools
```

```bash
npx -y web-stylebook-mcp call get_design_improvement_plan --input plan-args.json
```

## Tools

| For | Tools |
|---|---|
| Improving an existing UI | `get_design_improvement_plan`, `compare_page_revisions`, `validate_design_improvement_result` |
| Reviewing | `get_design_audit_plan`, `audit_page_structure`, `validate_design_audit_result` |
| Choosing a direction | `recommend_design_direction`, `compare_design_directions`, `search_design_references`, `get_design_reference` |
| Principles and states | `get_design_principle_plan`, `get_ux_principle_plan`, `get_ui_state_plan` |
| Building | `compose_design_tokens` (JSON, CSS variables, Tailwind, TypeScript or DESIGN.md) |

The [reference](./docs/reference.md) has an example for each tool, the result contracts, the
resources and prompts, and the CLI.

## More

- [Reference](./docs/reference.md): tool examples, contracts, CLI and compatibility
- [Demo](./docs/demo/README.md): the before/after above, with every evidence file
- [With/without showcase](./showcase/): ten paired builds, blind comparisons and recorded results
- [Changelog](./CHANGELOG.md) · [Security](./SECURITY.md) · [Releasing](./RELEASING.md)

## License

[MIT](./LICENSE). It covers the code and the bundled catalog snapshot. The webstylebook.com website
itself is CC BY-NC; attribution details are in the [reference](./docs/reference.md#license).
