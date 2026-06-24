<!-- Web Stylebook MCP - copy this block into your project's AGENTS.md if you
     want Codex to use the MCP even when the skill is not installed. -->

## Designing UI - use Web Stylebook first

Before writing JSX/HTML/CSS for any new or redesigned UI surface (page, screen, component,
dashboard, form, checkout, chat, developer console), call the **`web-stylebook`** MCP server:

1. `recommend_design_direction` with the product context (productType, tone, density,
   usageFrequency, trustSensitivity, constraints, avoid). Use the scored `candidates` as
   evidence and pick with product context; don't blindly take `candidates[0]`. Note the
   `rejected` styles and their reasons.
2. Read `webstylebook://styles/{id}` for your picks; write a `design.md` brief (intent, color
   *roles*, type roles, layout, motion use/avoid, UI-state coverage, a11y, anti-patterns,
   assumptions, verification) with no empty sections.
3. Before composing previews, run a short intake: (a) assets - do they have images/brand assets
   (which), should you source **license-free** samples (e.g. Unsplash, free for commercial use), or
   is none needed; (b) anything to emphasize / any must-haves. Then, for open-ended UI requests, show
   2-3 distinct candidate directions or page previews with a concise critique and recommendation, and
   ask whether the feeling is right. Stop before final component/system implementation until the user
   approves a direction.
4. After a direction is approved, before building: confirm scope and the open details with a short
   checklist - full component library vs one page; framework + existing components/design system to
   reuse; real brand/copy/data and must-have features (and what to leave out); target devices,
   light/dark, locales, a11y. Turn assumptions into confirmed facts; build only after the user
   answers or says to use your judgment. Don't silently assume.
5. `get_ui_state_plan` for each surface and implement required + recommended states (respect
   every `mustNot`).
6. `compose_design_tokens` for a starting token set; obey the contrast warnings.
7. Self-audit against `webstylebook://policies/verification`.

**Compose, don't recolor.** Tokens are scalars, not a design. Swapping a token block over one
layout is a reskin and is not acceptable. The chosen style is a starting tone, not a layout mold:
start from what THIS brief/content needs, compose the fitting components, and adapt the style
(override fonts/grid/structure where it calls for it) so the result reads as "built for this product,"
not "a page in style X." Give each direction its own composition. For open-ended
requests, fully compose **several candidate pages** (distinct layouts) and let the user pick; drop
context-inappropriate styles even if high-scored (e.g. low-contrast for elderly/medical). Land on
**reusable components** (tokens = shared foundation, component states = the `get_ui_state_plan`
contracts), not a one-off HTML file.

**Earn trust, don't fake it.** No invented metrics ("99.2% on-time") and no compliance/IT-jargon
trust signals (TLS, AES-256, ISO 27001). Choose signals by what the real user weighs (for a patient:
doctors, departments, hours, location, insurance, emergency care). Back every claim with browsable
content (don't say "214 doctors" then show three). Never default to the formulaic hero.
**Component states (hover/focus/active/disabled) are owned by the component** - never let context
selectors (`nav a:hover`) bleed in and override a primitive's own states.

The catalog is the single source of truth. Read the live resources, don't cache them here.
Output is deterministic and model-free; the server never sees your repo.
