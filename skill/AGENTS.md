<!-- Web Stylebook MCP - copy this block into your project's AGENTS.md if you
     want Codex to use the MCP even when the skill is not installed. -->

## Designing UI - use Web Stylebook first

Before writing JSX/HTML/CSS for any new or redesigned UI surface (page, screen, component,
dashboard, form, checkout, chat, developer console), call the **`web-stylebook`** MCP server:

For existing-UI improvement or fix requests, default to **inspect → decide → implement → verify →
compare/report**. Infer bounded coverage from the task and inspect available source before asking;
ask only for information that actually blocks execution. Do not impose a scope questionnaire or
stop at a review. Explicit review-only or no-edit requests remain read-only and use the audit tools.
Commit, push, release, deployment and external messages require their own authorization.

- Save immutable before screenshots, rendered HTML/CSS or semantic structure, source identity and
  the content/interaction inventory. Record route, viewport, resolved theme, locale, state, input
  data/clock, semantic scroll anchor, zoom, device scale and font readiness.
- Call `get_design_improvement_plan` with relevant `surface`/`concerns` or `foundationIds`/`category`,
  `locale`, and `context` containing the user task and target matrix. Save its `query` and
  `workflow.planHash`. The default is 6 foundations, maximum 12; retrieve relevant omitted entries.
  `webstylebook://workflows/improve-ui` describes the default workflow.
- Apply conditional remedies and counterexamples to observed obstacles; edit the actual UI source
  and record changed files plus a diff. Keep working behavior and product identity. A new catalog
  style or candidate-approval round is not required for already authorized fixes.
- Re-render and capture the after state under matching conditions. Inspect visuals and exercise
  affected behavior, keyboard/focus, accessibility, recovery and narrow layouts; run appropriate
  build/tests. Use `compare_page_revisions` for DOM preservation and validate it under a separate
  `revisionPreservation` audit plan. Static preservation cannot replace real interaction evidence.
- Call `validate_design_improvement_result` with the exact plan query, `workflow.planHash`, actual
  captures, implemented changes, checks, per-target outcomes and limitations. Follow `nextActions`
  for `needs-work`, repair/revert regressions, and never count proposals as completed changes.
- Deliver paired before/after artifacts, what changed and why, verification, tradeoffs and remaining
  unverified work. Use `reportMarkdown` as a starting point. `complete` means the submitted evidence
  contract is satisfied, not an independent quality certification. A verified `no-change` outcome
  must not be described as an improvement. Missing source/runtime access is a concrete blocker.

Record the baseline strengths in context.constraints and compare gains against losses in group
membership, useful visible information, continuity and reading comfort. Keep the original as a valid
alternative. If the user identifies a regression, reopen the claim, correct the report and restore
rejected changes while keeping justified gains. Technical passes do not override that feedback.

The host performs edits and captures; the offline MCP does not access the repository. Familiar
patterns are contextual choices, not automatic defects. Source-supported concepts, authored remedies
and illustrative examples remain distinct. This path takes precedence over the new-direction
composition rules below, which apply only when a new build or visual direction is requested.

**For a new visual direction:**

1. `recommend_design_direction` with the product context (productType, tone, density,
   usageFrequency, trustSensitivity, constraints, avoid). Use the scored `candidates` as
   evidence and pick with product context; don't blindly take `candidates[0]`. Read `ranking` for why #1
   beat #2, or that they tie, and list the most important tone first. Note the `rejected` styles and
   their reasons. Each candidate's `structure` (layout archetype, 2-3 signature moves, banned patterns)
   is the page to build; tokens only set its surface. The top-level `mustHaves` lists what the product
   type requires and where (for a commerce product page: price, variant choice, add to cart, and
   delivery/guarantee details on the first screen). The style restyles them but never drops them, and
   they come before the archetype's opening limits; `structure.mustHaves` names the moves that present them.
2. Read `webstylebook://styles/{id}` for your picks and record concise candidate-direction notes.
   Use `search_design_references` with a narrow product/category/tag query, then
   `get_design_reference` for only a few selected examples. Record observedAt, attribution, and
   rights; borrow transferable structure and measured tokens, never upstream screenshots, brand
   assets, copy, typefaces, or visual identity.
   Do not finalize `design.md` before the visual-design, UX-principle, and UI-state contracts are available.
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
5. `get_design_principle_plan` with the layout concerns, matching surface, and design phase. Use
   its placement, apply, verify, and caution guidance as a practical craft review, not a fixed recipe.
   Read `webstylebook://design-principles/{id}` only for the entries it selected.
6. `get_ux_principle_plan` with intended outcomes, matching surface, and design phase. Use its
   questions, apply/verify checks, cautions, and evidence confidence; treat principles as contextual
   prompts, not universal laws. Accessibility, safety, informed consent, and truthful feedback win.
   Read `webstylebook://principles/{id}` only for the entries it selected.
7. `get_ui_state_plan` for each surface and implement required + recommended states (respect
   every `mustNot`).
8. `compose_design_tokens` for a starting token set; obey the contrast warnings. With
   `format: "design-md"` it returns a standard `DESIGN.md` (tokens, prose, Do's and Don'ts, structure)
   for other agents and tools; save its `content` yourself and report what `lossy` lists.
9. Write `design.md` using the confirmed decisions and returned design/UX/state/token contracts
   (intent, color *roles*, type roles, layout, motion use/avoid, UI-state coverage, a11y,
   anti-patterns, assumptions, verification) - plus **selected visual-design principles**, each with
   the placement decision it produced and its observable verification check, and
   **selected UX principles**, each with its caution and evidence confidence label.
   No empty sections; then implement.
10. Call `get_design_audit_plan` with `styleId`, `surfaces`, `designPrincipleIds`, `uxPrincipleIds`,
   matching `stateSurfaceIds`, and `locale`. Inspect the actual rendered UI, source, interactions,
   console, and commands for every returned stable check id. Use `PASS` / `FIX_NOW` / `RISK` /
   `NOT_APPLICABLE` / `NOT_VERIFIED`; every PASS needs observed evidence, and missing evidence is
   NOT_VERIFIED. Do not skip its `principles` group: run each recorded principle check against the
   built UI and write down the outcome. When content is in scope, do not skip its `content` group or
   substitute component names for inspecting the visible strings. A principle
   name listed without a placement decision and an observed check is decoration; drop it or verify
   it. Never restate a `contextual` or `contested` principle as a law. Do this inline yourself -
   the `audit-design-direction`, `audit-design-principles`, and `audit-ux-principles` prompts are
   deeper audits the *user* invokes, not tools you can call.
11. Run `audit_page_structure` on each built page's rendered HTML and CSS with the chosen `styleId` and
   the same `productType`, replace every finding with the move it names, add every must-have it lists as
   missing or misplaced, and rerun it. Include `structure` in `includeGroups` (with the same `productType`)
   and submit its `evidence` and `results` with the rest of the audit.
   For a redesign of an existing page, save the original's rendered HTML and CSS before changing it, then
   run `compare_page_revisions` on the original and the redesign (with the `scriptSelectors` its scripts
   use and the same `productType`). Restore every lost item or acknowledge it with a reason of 12+
   characters, and validate its results under a separate plan query with `revisionPreservation: true`.
12. Call `validate_design_audit_result` with the same plan query, its `identity.planHash`, a target
   for each inspected route/screen/state/viewport/theme/locale, durable evidence references, and one
   result per planned check/target. Fix contract errors or preserve normalized `NOT_VERIFIED`.
   `valid` describes contract validity, never overall design quality.

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
content (don't say "214 doctors" then show three).

**User-facing copy puts meaning before machinery.** When content is in scope, inspect the actual
visible strings. Use the intended audience's vocabulary; translate, define, or move internal
taxonomies, workflow labels, implementation terms, unexplained abbreviations, and optional method
details out of the primary path. Lead with the user-relevant conclusion, consequence, or next action.
Counts, scores, agreement labels, confidence badges, and status language need a clear method,
denominator, uncertainty, and decision value; otherwise remove or qualify them. Make every prominent
card, statistic, navigation link, section, and disclosure earn attention through the primary task.
Keep useful instances - no content type is banned by default. Rewrite without inventing claims or
dropping material caveats, then re-check wrapping and hierarchy in target locales and viewports.
Do not treat the absence of internal jargon as a pass. For every material claim, conclusion, or
recommendation, ask what supports it and whether wording and certainty match that support. Qualify or
remove unsupported content; never invent evidence, facts, or next steps. Ask what concrete information
each prominent sentence adds and whether it would remain equally plausible on an unrelated product or
page. Reject interchangeable consultancy filler. Match typographic and structural prominence to
information value, task relevance, and support; demote vague, generic, redundant, or weakly supported
content instead of making it a giant headline, card, badge, or statistic.

**No formulaic opening.** The disease was never *two columns* — strong products (Linear, Stripe) put
copy beside a visual. The disease is **generic furniture**: a copy stack
(eyebrow+headline+sub+buttons+stats) next to a *decorative* panel — a stock photo, an abstract blob,
generic app chrome, or a card you could paste onto another product by swapping the logo. Method: (1)
derive the opening from the product's single most important object/action/feeling; (2) enumerate three
structurally-different openings (each: organizing device + what owns >50% of the frame + first-read
element), at least one with no running-text column; (3) furniture-check — the visual passes ONLY if
it's a bespoke demonstration of THIS product's core mechanic (its actual input→output with realistic
domain content, nonsensical if pasted onto another product); a stock photo / abstract shape / generic
card FAILS, and a decorative seam bridging the columns does NOT launder a generic visual. Also avoid
the all-text centered-stack and giant-word defaults. Cap opening prose at a headline + one short line
+ one action. The 2-3 candidate directions must differ in opening structure, not just color/tone.
Apply the same furniture-check to every screen so the default can't migrate below the fold.

**Kill the AI headline cadence.** Don't default to the evocative, abstract noun-phrase fragment with
one word italicized in the accent color — the same cadence + same emphasis move on every product is
the tell. The headline must be specific to THIS product (paste-test: it couldn't sit on a competitor
by swapping a noun), and its form + emphasis must vary per project (sentence vs fragment, plain vs
blunt, emphasis or none) — don't reflexively italic one accent word. No house voice; write what this
product actually is.

**Component states (hover/focus/active/disabled) are owned by the component** - never let context
selectors (`nav a:hover`) bleed in and override a primitive's own states.

The catalog is the single source of truth. Read the live resources, don't cache them here.
Output is deterministic and model-free; the server never sees your repo.
