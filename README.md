# @web-stylebook/mcp

**Design intelligence for coding agents.**

Give your coding agent a design vocabulary. Web Stylebook MCP helps AI coding agents
choose a product‑fit visual direction, plan screens, cover real UI states, compose
design tokens, and avoid generic AI‑looking interfaces — without writing the code for them.

- **No API key. No model call. No network. No project access.** Deterministic, read‑only design knowledge packaged locally.
- Same catalog as [Web Stylebook](https://webstylebook.com).
- English · Korean · Japanese.

## Install

```json
{
  "mcpServers": {
    "web-stylebook": {
      "command": "npx",
      "args": ["-y", "@web-stylebook/mcp@latest"]
    }
  }
}
```

Then ask your agent to design something. For the best results, also install the
companion skill / CLAUDE.md fragment (it tells the agent *when* to call these tools).

## Companion skill

This package ships the trigger + usage logic in `skill/`:

- **Claude Code / skill-aware hosts:** point your skills directory at `skill/web-stylebook-design/`.
- **Other hosts:** copy the block in `skill/CLAUDE.md` into your project's `CLAUDE.md` (or rules file).

It encodes *when* to call these tools and how to use the results — compose, don't recolor; offer
multiple fully-composed candidates; earn trust, don't fake it; component-owned states; land on
reusable components.

## Tools (4 compute tools)

| Tool | What it does |
|---|---|
| `recommend_design_direction` | Scored style candidates + reason codes + rejected styles with reasons + secondary pairings + confidence. Evidence‑provider: your model makes the final pick. |
| `compare_design_directions` | Compares 2–4 directions across product fit, repeated‑use, density, trust, distinctiveness, accessibility risk, motion and maintenance. No single winner. |
| `get_ui_state_plan` | Required / recommended / domain‑specific UI states for a surface (data‑table, form, checkout, chat, developer‑console) with triggers, must‑show, must‑not, a11y and motion. |
| `compose_design_tokens` | Role‑based design tokens (color, type, spacing, radius, motion, density) in json / css‑variables / tailwind / typescript, light/dark/both, with WCAG contrast warnings. |

Prose‑shaped work (search, brief composition, screen planning, and the “when to call” trigger)
is carried by the companion **skill**, not by extra tools.

## Resources

`webstylebook://manifest` · `…/styles` · `…/styles/{id}` · `…/motion` · `…/motion/{id}`
· `…/components` · `…/components/{id}` · `…/states/surfaces` · `…/states/{surface}`
· `…/states/{surface}/{state}` · `…/products` · `…/products/{id}`
· `…/policies/anti-patterns` · `…/policies/verification`

## Prompts

`design-product` · `design-screen` · `complete-ui-states` · `redesign-with-style` · `audit-design-direction`

## CLI

```bash
web-stylebook-mcp                  # start MCP server over stdio (default)
web-stylebook-mcp --version
web-stylebook-mcp --catalog-info
web-stylebook-mcp --validate-catalog
```

## Demo

> Design a high‑density monitoring dashboard for SREs. Used daily. Keep it calm and technical. Avoid cyberpunk decoration.

`recommend_design_direction` surfaces calm operational styles like `quiet-utility`,
`platform-core`, and `runtime-signal` among the scored candidates, **rejects** `cyberpunk-glitch`
(`EXPLICITLY_AVOIDED`), suggests a secondary pairing for quieter forms/navigation surfaces, and
records its assumptions and confidence. The agent then reads
the chosen style resources, plans the data‑table states with `get_ui_state_plan`, and emits a
starting token set with `compose_design_tokens`.

## Privacy & security

v0.1 reads only the immutable catalog packaged with this module. It does not access your
filesystem, git, environment, shell, browser, network, or any model API. All output is a
deterministic function of the input — the same request always yields the same result.

## Compatibility

- Node ≥ 20.
- Built on `@modelcontextprotocol/sdk` 1.x (stdio transport).

## License

MIT.
