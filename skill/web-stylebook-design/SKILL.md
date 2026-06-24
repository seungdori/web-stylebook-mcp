---
name: web-stylebook-design
description: Use BEFORE building or redesigning any frontend UI (a page, screen, component, dashboard, form, checkout, chat, or developer console). Calls the Web Stylebook MCP to choose a product-fit visual direction, cover real (non-happy-path) UI states, and compose design tokens — so the result doesn't look like a generic AI template. Trigger whenever the user asks to build/design/redesign a UI, "make a page/screen/app", "style this", or wants a design direction, even if they don't say "Web Stylebook".
---

# Web Stylebook — design before you build

You have the **Web Stylebook MCP** server (`web-stylebook`) connected. It returns design
*contracts* (scored directions, UI-state plans, tokens), not code. You still write the code.
Calling it before writing UI produces far better, less generic results.

## When to fire

Before writing JSX/HTML/CSS for any new or redesigned UI surface. If you catch yourself about
to scaffold a page from memory, stop and run step 1 first.

## Workflow

1. **`recommend_design_direction`** — pass the product context (productType, tone, density,
   usageFrequency, trustSensitivity, constraints, avoid). It returns **scored candidates** with
   reason codes, **rejected** styles with reasons, secondary **pairings**, assumptions, and a
   confidence. Treat `candidates` as evidence — *you* pick using product context; `candidates[0]`
   is the strongest match, not a mandate.
2. **Read the chosen styles** — `webstylebook://styles/{id}` for each pick (primary + any pairing).
3. **Intake, then get direction approval — before component work.** First run a short intake so the
   previews use the right material (ask, don't assume):
   - **Assets** — do they have images/brand assets to use (and which)? If not, may you pull
     **license-free** sample imagery (e.g. Unsplash, free for commercial use) for the example, or is
     no imagery needed? *(A: provided — they say which · B: none — you source license-free samples ·
     C: not needed)*
   - **Emphasis** — anything they specifically want emphasized, or any must-have / non-negotiable?
   Then, for open-ended UI requests, compose and show 2-3 distinct candidate directions or page
   previews, each with a concise critique and a clear recommendation, and ask which feeling/direction
   is right. The candidates must differ in **opening structure** (different dominant element +
   first-read element — see *The opening* below), not merely color/type tone; present **at most one**
   two-column-derived option, and make at least one carry no running-text column. **Stop here** until
   the user picks a direction or explicitly tells you to proceed. Do not build the final component
   system, reusable components, or production page before this approval gate.
4. **Confirm scope & resolve open details — before building.** Once a direction is approved, do
   **not** start implementing. First surface the decisions that change *what* you build, as a short,
   concrete checklist — ask, don't assume:
   - **Scope & deliverable** — the full reusable component library, or a single page/screen? One
     surface or several? A throwaway preview, or production code committed to the repo?
   - **Stack & integration** — framework (React / Vue / Svelte / plain), styling (CSS variables /
     Tailwind / CSS-in-JS), TypeScript, and any existing design system or components to reuse/extend.
   - **Real content & data** — brand/product name, real copy or placeholder, actual data shape and
     entities, must-have features, and explicitly what to leave out. (This is where you get the real
     numbers or omit them — never invent metrics to fill space.)
   - **Audience & environment** — primary devices/breakpoints, light/dark/both, locales, accessibility
     level, any performance budget.
   Turn the `design.md` assumptions into **confirmed facts** here. Build only after the user answers —
   or explicitly says "use your judgment," in which case record the assumption and proceed. Keep it to
   3–6 high-leverage questions; don't interrogate.
5. **Write `design.md`** — a brief with: intent, audience/tasks, chosen direction + why, rejected
   directions, tone, color *roles* (not a raw palette), type roles, spacing/density, layout rules,
   surface hierarchy, component behavior, motion (use AND avoid), UI-state coverage, responsive,
   accessibility, anti-patterns, confirmed decisions (from step 4), verification checklist. Never
   leave a section empty.
6. **Plan each screen around *the one thing*** — drop the word "hero"; it summons the SaaS template.
   Name the single most important thing the user is there for, build the screen around it, and make
   everything else earn its place or cut it. Run the furniture-check (see *The opening* below)
   on **each** screen, not just the first. Do **not** default to Hero + Features + Testimonial + CTA.
   Look up component vocabulary in `webstylebook://components`.
7. **`get_ui_state_plan`** — for each surface (data-table, form, checkout, chat, developer-console).
   Implement the required + recommended states, honoring `mustNot` (e.g. no silent auto-retry, don't
   lose user input, don't imply a charge that didn't happen).
8. **`compose_design_tokens`** — emit a starting token set (css-variables / tailwind / typescript).
   Heed the contrast warnings; don't ship 8–12% ghost borders.
9. **Implement, then self-audit** against `webstylebook://policies/verification` and
   `…/anti-patterns` — including the opening's **furniture-check** (below): if the visual is generic
   furniture (a stock photo, an abstract shape, or a card you could paste onto another product)
   rather than a bespoke product demonstration, or the copy column is the full quartet, recompose.

## Active design — compose, don't recolor

`compose_design_tokens` returns color/radius/type/spacing **scalars**. Tokens are not a design.
Swapping a token block over one fixed layout is a *reskin* — it reads as "one screen recolored"
and is **not acceptable** as a design direction. A real direction has its **own composition**:
layout, hierarchy, density, component choice, motion — built from the style's facets + component
vocabulary, not just its tokens.

- **The chosen direction is a starting tone, not a mold.** Don't pour the content into the style's
  "typical" layout — that produces a generic "page in style X." Start from what THIS brief and THIS
  content actually need: decide the sections and components from the product, then apply the style as
  *tone*, **adapting freely** — override its fonts, grid, density, and structure where the brief calls
  for it (the token `notes` literally invite this, e.g. a "mono" style that ships serif defaults). The
  result should read as "built for this product," not "applied a catalog style." When one style is too
  rigid, pair a secondary (`compare_design_directions`) or treat the style as inspiration.
- **Offer a candidate set, not one screen.** For an open-ended design request, take the top
  context-fit candidates and **fully compose each as a distinct page** (different layouts, not the
  same layout recolored). Present them with an honest per-candidate critique + a recommendation, and
  let the user choose. This is an approval gate: after presenting candidates, ask whether the feeling
  is right and wait. A single one-shot output is the weaker default.
- **Apply active judgment over the score.** Drop a high-scored candidate when the context defeats it
  — e.g. low-contrast styles (neumorphism) for elderly / medical / high-trust — even if it ranks #1.
  The score is evidence; product context decides. The MCP's own guidance says so.
- **Lead with the landing surface.** When the user just says "design X", start from the landing/opening
  surface, not an internal dashboard.
- **Land on reusable components.** The deliverable is a component library: tokens as the shared
  foundation (swap to re-skin everything), and components whose states are exactly the
  `get_ui_state_plan` contracts. Not a one-off HTML file.

## The opening — the one thing, not a hero

The word "hero" summons the SaaS template, and "reach for the default" shows worst in the first
screen. But the disease was never *two columns* — strong products (Linear, Stripe) put copy beside a
visual. The disease is **generic furniture**: a copy stack (eyebrow + headline + sub + buttons +
stats) next to a *decorative* panel — a stock photo, an abstract blob / gradient / 3D shape, generic
app chrome, or a card you could paste onto a different product by swapping the logo. Replace the
reflex with a method plus a gate that targets genericness, not column count.

1. **Derive the centerpiece** (in `design.md`): *what is the single most important object, action,
   or feeling here?* The page is built **around** that, not beside it. The opening must be
   impossible to paste verbatim onto a different product — if it could be, it's generic; redo.
2. **Enumerate three structurally-different openings, in writing, before you commit.** For each,
   name the **organizing device**, **what owns >50% of the frame**, and **where the eye lands
   first**. Two openings are the *same structure* if their dominant element and first-landing
   element are the same type — "a copy block + a side card" is **one** structure no matter what you
   relabel the card; redo until genuinely distinct. **At least one must carry no running-text
   column at all.** Starter menu (starting points, not molds — invent your own):
   - **product-as-protagonist** — the object/tool *is* the frame (full-bleed, or centered-and-
     dominant with copy orbiting it small), never a card beside a copy column.
   - **type-wall** — typography fills the opening; no visual panel; the words are the design.
   - **inline-first-action** — the opening *is* a working interface spanning the frame; the user
     does the core action immediately. (Not a control parked in a side panel next to a pitch.)
   - **ambient / broken-grid** — off-axis, asymmetric; mood through space + one focal element.
   - **full-bleed single element** — one number / word / image fills the frame; all else tucked small.
   - **horizon / architectural** — a structural line or grid organizes above/below, not copy-vs-visual.
3. **Furniture-check: does the visual earn its half?** (mandatory; gate at step 9). A two-column
   "copy + visual" opening is fine — *only* when the visual earns it. It **FAILS** if the other side
   is **generic furniture**: a stock photo, an abstract blob / gradient / 3D shape, generic app
   chrome, or a card / panel you could paste onto a *different* product by swapping the logo. It
   **passes** only if that side is a **bespoke demonstration of THIS product's core mechanic** — its
   actual input→output with realistic domain content, such that swapping the product would make the
   visual nonsensical. A decorative bridge (a "seam", a connecting thread, an overlapping chip) does
   **not** rescue a generic visual — judge the bulk, not the garnish. Still forbidden outright are the
   all-text defaults everyone reads as AI: the **centered stack** (eyebrow + headline + sub + two
   buttons, centered) and the **giant-centered-word** hero. If it fails, ship one of the
   structurally-different alternatives you enumerated.

**Prose cap.** Unless type *is* the centerpiece (type-wall), the opening carries **at most a headline
plus one short line**; the eyebrow + headline + sub-paragraph + two-buttons (+ stats) quartet must
not appear together in the opening, in any axis or order. More copy earns its place in a later
section, not the first screen.

**Kill the AI headline cadence.** The reflexive AI headline is an *evocative, abstract noun-phrase
fragment* — often two beats split by a comma, mood over substance — with **one word italicized in the
accent color**. The same cadence and the same emphasis move on every product **is the tell** — it
reads as designed-by-AI, not written for this product. Don't default to it:
- **Say something only THIS product could say.** Paste-test the headline: if swapping one noun lets
  it sit on a competitor, it's generic — rewrite until it's specific (a real claim, fact, or offer).
- **Vary the form every time** — full sentence vs. fragment, plain vs. blunt, long vs. terse — and
  **don't reflexively italicize one accent word**; choose the emphasis (or none) to fit, and don't
  repeat the same type move you used last project. There is no house voice to reach for — reach for
  what this product actually is.

This generalizes: **every** screen (dashboard, form, checkout) has a stock shape it defaults to. Run
the same furniture-check per screen — is each block doing product-specific work, or is it template
filler? — so the default can't just migrate below the fold.

## Editorial discipline — earn trust, don't fake it

The fastest "AI smell" is filler content dressed as substance. Hold the line:

- **No invented metrics.** Don't fabricate impressive-sounding numbers ("99.2% on-time rate",
  "1.4-min average booking"). If it didn't come from the user/product, don't print it.
- **No compliance/IT jargon as trust signals.** "TLS·AES-256", "ISO 27001", cipher specs — the
  end user doesn't care. Choose trust signals by what THIS audience actually weighs. For a hospital
  patient: doctors by name/specialty/experience, departments, location·transit·parking, hours
  (incl. nights/weekends), insurance, wait time, reviews, emergency capability. Compliance, if shown
  at all, goes small in the footer — not a hero trust band.
- **Back every claim with content.** "214 specialists" requires a way to browse them (or a few
  representatives + "see all →"). A headline number with three cards reads as a lie.
- **No formulaic opening.** Compose the first screen via *the one thing* + the furniture-check
  (above). Two columns are fine when the visual is a **bespoke product demonstration**; they fail when
  it's **generic furniture** (stock photo / abstract blob / a card you could paste onto another
  product) — and a decorative seam bridging the columns doesn't launder a generic visual. Avoid the
  all-text centered-stack and giant-word defaults too. Cap opening prose at a headline + one short
  line + one action.
- **Intentional typography.** Generic system-sans (especially for Korean/CJK) reads as default —
  pick a real display face.

## `compare_design_directions`

When the user is torn between looks, pass 2–4 directions. It returns each one's favorable
conditions and likely failure mode — there is deliberately no single winner; choose by product fit.
Each direction may carry an optional `secondaryStyleId` to model a primary+secondary pairing; the
comparison reflects the merged pairing in its axes (e.g. a louder secondary raises distinctiveness).

## Rules

- **Never present a token-swap recolor as a design direction** — compose each direction's own layout.
- **Direction = starting tone, not a mold** — compose the components THIS brief needs and adapt the
  style (fonts, grid, structure) to fit; never ship a generic "page in style X."
- **The opening's visual is a product demonstration, not furniture** — a stock photo, abstract blob,
  or a card you could paste onto another product fails (a decorative seam bridging it doesn't change
  that); two columns are fine when the visual earns its half. Keep the copy column off the full
  eyebrow + headline + sub + buttons quartet. Enumerate three structurally-distinct openings and
  derive the pick from the product's *one thing*.
- **No AI headline cadence** — don't default to the evocative noun-phrase fragment with one
  italic-accent word (same move on every product = the tell). The headline must pass the paste-test
  (couldn't sit on a competitor by swapping a noun), and its form + emphasis must vary per project,
  not repeat last time's move.
- **Default to a multi-candidate set + an honest recommendation**, not one screen; the user picks.
  Stop before final component/system implementation until the user approves a direction.
- **After the direction is picked, confirm scope + open details before building** — don't silently
  assume the deliverable, stack, real content/data, or what to leave out; ask a short checklist first.
- **Component states are owned by the component.** Interaction states (hover/focus/active/disabled)
  live on the primitive's own classes — never let an ancestor/context selector (`nav a:hover`,
  `.card a`) bleed in and override them. Scope context rules with `:not(.btn)` etc. A primitive must
  look and behave the same wherever it's placed.
- The MCP is the single source of design knowledge — **don't** paraphrase or cache its catalog here.
  Always read the live resources.
- Everything it returns is deterministic and model-free: same input → same output.
- It never sees your repo. Give it a short product summary as input; it gives you a contract back.
