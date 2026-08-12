<!-- Web Stylebook MCP — copy this block into your project's CLAUDE.md or rules file
     if your agent host does not support skills. For Codex, use skill/AGENTS.md instead. -->

## Designing UI — use Web Stylebook first

Before writing JSX/HTML/CSS for any new or redesigned UI surface (page, screen, component,
dashboard, form, checkout, chat, developer console), call the **`web-stylebook`** MCP server:

For an audit or redesign, if the user has not already set the scope, first ask two short questions
and wait: (1) audit coverage — visual only; visual + user-facing copy/information structure; or full
experience including interaction, accessibility, states, and build/performance evidence; (2) change
depth — findings only; prioritized proposals; or implement and verify. Do not ask again when both are
already explicit. Commit, push, release, and deployment remain separate authorizations. Map the
coverage to `get_design_audit_plan.includeGroups`: visual = `layout`, `fidelity`, `anti-patterns`;
visual + content = add `content`, `behavior`; full = every matching group plus principle, docs, and
state coverage.

1. `recommend_design_direction` with the product context (productType, tone, density,
   usageFrequency, trustSensitivity, constraints, avoid). Use the scored `candidates` as
   evidence and pick with product context — don't blindly take `candidates[0]`. Note the
   `rejected` styles and their reasons.
2. Read `webstylebook://styles/{id}` for your picks and record concise candidate-direction notes.
   Do not finalize `design.md` before the visual-design, UX-principle, and UI-state contracts are available.
3. Before composing previews, run a short intake: (a) assets — do they have images/brand assets
   (which), should you source **license-free** samples (e.g. Unsplash, free for commercial use), or
   is none needed; (b) anything to emphasize / any must-haves. Then, for open-ended UI requests, show
   2-3 distinct candidate directions or page previews with a concise critique and recommendation, and
   ask whether the feeling is right. Stop before final component/system implementation until the user
   approves a direction.
4. After a direction is approved, before building: confirm scope and the open details with a short
   checklist — full component library vs one page; framework + existing components/design system to
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
8. `compose_design_tokens` for a starting token set; obey the contrast warnings.
9. Write `design.md` using the confirmed decisions and returned design/UX/state/token contracts
   (intent, color *roles*, type roles, layout, motion use/avoid, UI-state coverage, a11y,
   anti-patterns, assumptions, verification) — plus **selected visual-design principles**, each with
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
   it. Never restate a `contextual` or `contested` principle as a law. Do this inline yourself —
   the `audit-design-direction`, `audit-design-principles`, and `audit-ux-principles` prompts are
   deeper audits the *user* invokes, not tools you can call.

**Compose, don't recolor.** Tokens are scalars, not a design — swapping a token block over one
layout is a reskin and is not acceptable. The chosen style is a starting *tone*, not a layout mold:
start from what THIS brief/content needs, compose the fitting components, and adapt the style
(override fonts/grid/structure where it calls for it) so the result reads as "built for this product,"
not "a page in style X." Give each direction its own composition. For open-ended
requests, fully compose **several candidate pages** (distinct layouts) and let the user pick; drop
context-inappropriate styles even if high-scored (e.g. low-contrast for elderly/medical). Land on
**reusable components** (tokens = shared foundation, component states = the `get_ui_state_plan`
contracts), not a one-off HTML file.

**Earn trust, don't fake it.** No invented metrics ("99.2% on-time") and no compliance/IT-jargon
trust signals (TLS, AES-256, ISO 27001) — choose signals by what the real user weighs (for a patient:
doctors, departments, hours, location, insurance, emergency care). Back every claim with browsable
content (don't say "214 doctors" then show three).

**User-facing copy puts meaning before machinery.** When content is in scope, inspect the actual
visible strings. Use the intended audience's vocabulary; translate, define, or move internal
taxonomies, workflow labels, implementation terms, unexplained abbreviations, and optional method
details out of the primary path. Lead with the user-relevant conclusion, consequence, or next action.
Counts, scores, agreement labels, confidence badges, and status language need a clear method,
denominator, uncertainty, and decision value; otherwise remove or qualify them. Make every prominent
card, statistic, navigation link, section, and disclosure earn attention through the primary task.
Keep useful instances — no content type is banned by default. Rewrite without inventing claims or
dropping material caveats, then re-check wrapping and hierarchy in target locales and viewports.
Do not treat the absence of internal jargon as a pass. Ground every personalized claim and next-step
recommendation in user-provided facts or identified domain evidence; keep facts, source interpretation,
agent inference, and advice distinct. Run grounding, substitution, specificity, and authority tests on
prominent copy: what supports it, would it fit almost anyone/product, does it name a concrete
actor/object/event/change, and did a real source justify the advice? Reject abstract consultancy filler
that merely sounds actionable. Match typographic and structural prominence to evidential substance;
demote generic advice, broad interpretation, methodology, and caveats instead of making them giant
headlines, cards, badges, or statistics.

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

**Component states (hover/focus/active/disabled) are owned by the component** — never let context
selectors (`nav a:hover`) bleed in and override a primitive's own states.

The catalog is the single source of truth — read the live resources, don't cache them here.
Output is deterministic and model-free; the server never sees your repo.
