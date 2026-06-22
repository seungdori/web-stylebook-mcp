<!-- Web Stylebook MCP — copy this block into your project's CLAUDE.md (or a rules file)
     if your agent host does not support skills. It is the invocation trigger. -->

## Designing UI — use Web Stylebook first

Before writing JSX/HTML/CSS for any new or redesigned UI surface (page, screen, component,
dashboard, form, checkout, chat, developer console), call the **`web-stylebook`** MCP server:

1. `recommend_design_direction` with the product context (productType, tone, density,
   usageFrequency, trustSensitivity, constraints, avoid). Use the scored `candidates` as
   evidence and pick with product context — don't blindly take `candidates[0]`. Note the
   `rejected` styles and their reasons.
2. Read `webstylebook://styles/{id}` for your picks; write a `design.md` brief (intent, color
   *roles*, type roles, layout, motion use/avoid, UI-state coverage, a11y, anti-patterns,
   assumptions, verification) with no empty sections.
3. `get_ui_state_plan` for each surface and implement required + recommended states (respect
   every `mustNot`).
4. `compose_design_tokens` for a starting token set; obey the contrast warnings.
5. Self-audit against `webstylebook://policies/verification`.

**Compose, don't recolor.** Tokens are scalars, not a design — swapping a token block over one
layout is a reskin and is not acceptable. Give each direction its own composition. For open-ended
requests, fully compose **several candidate pages** (distinct layouts) and let the user pick; drop
context-inappropriate styles even if high-scored (e.g. low-contrast for elderly/medical). Land on
**reusable components** (tokens = shared foundation, component states = the `get_ui_state_plan`
contracts), not a one-off HTML file.

**Earn trust, don't fake it.** No invented metrics ("99.2% on-time") and no compliance/IT-jargon
trust signals (TLS·AES-256, ISO 27001) — choose signals by what the real user weighs (for a patient:
doctors, departments, hours, location, insurance, emergency care). Back every claim with browsable
content (don't say "214 doctors" then show three). Never default to the formulaic hero.
**Component states (hover/focus/active/disabled) are owned by the component** — never let context
selectors (`nav a:hover`) bleed in and override a primitive's own states.

The catalog is the single source of truth — read the live resources, don't cache them here.
Output is deterministic and model-free; the server never sees your repo.
