# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- `audit_page_structure` no longer passes three common template pages as clean (#11 follow-up):
  - A centered hero whose blob is an inline SVG painted with a `<linearGradient>`, or a decorative image named as a
    blob, is a gradient-blob hero, and that decoration no longer counts as the opening's product visual.
  - Icon feature cards are found when the icon sits inside the title, as in Tailwind UI's `<dt><svg/>Title</dt>`
    lists and `<h3><svg/>Title</h3>` cards.
  - Pages keep their sections when an empty portal root, a toast region, an announcement bar, a skip link, a dialog,
    or a fixed overlay such as a cookie banner or chat widget sits beside the content wrapper. Visually hidden
    elements (the `sr-only` clip, or a skip link moved off-screen until focused) are no longer page sections, and a
    visually hidden brand `<h1>` in the site header no longer becomes the opening.
- Fewer false positives: a fully transparent border is not a faint border, a one-sided divider rule does not make a
  card (Tailwind `border-b` now sets only the bottom border), paginated reviews with numbered or Previous/Next page
  buttons are not a testimonial carousel, a round named portrait is not an icon, and a product image is a blob only
  when it is marked as decoration. Decoration needs both aria-hidden and an out-of-flow or behind layer before it
  stops counting as the opening's product visual, so an aria-hidden demo beside the copy still counts.
- Fewer misses: `color-mix()` is evaluated, so compiled Tailwind v4 `border-white/10` is a faint border; compiled
  `rounded-full` (`calc(infinity * 1px)`) reads as fully rounded again; and an inline-SVG logo row under a heading
  that names customers, clients, or partners is a logo strip.
- Hostile input within the documented limits now stays linear: descendant, general-sibling, and `:has()` selectors on
  deep or wide pages, stray end tags against a deep open stack, thousands of claims or calls to action in one block,
  deep animated chains, claims in separate wrappers, thousands of image rows, implied end tags at a table boundary,
  and selectors with hundreds of classes. A custom-property chain deeper than 64 steps resolves as invalid instead of
  overflowing the stack, `inherit` on a deep page no longer recurses, and selector memos take one byte per element.
  The selector budget is 5,000,000 checks (the 48 specimen pages use at most about 630,000); past it every check is
  reported as not verified, a found pattern and a not-applicable one included.

### Changed

- platform-core's archetype is labelled `authored` with a `departure` note: its specimen opens with the eyebrow stack
  and icon-tile cards that the audit bans, and the guide replaces both.

## [0.12.0] — 2026-10-19

### Fixed

- `recommend_design_direction` no longer returns a wall of ties for a realistic brief (#6). On the README brief
  (SRE monitoring dashboard, calm and technical, high density, daily use, avoid cyberpunk) five styles scored
  exactly 0.91 and the order among them was decided by a hidden calmness rank and the style id. Four things caused it:
  every factor was a membership test capped at 1.0, so any style whose facet lists contained the request earned full
  credit; the task factor was a constant 0.5 because "monitoring" and "watched" did not match the `monitor` tag;
  `bestFor` and `avoid` distance were never read; and nothing weighted how specific a style's claim was.
- Task tags are now matched on inflected forms (`monitoring`, `watched`, `reading`). Tasks the caller states in
  `primaryTasks` win over words in the description, which only fill the gap when no stated task names a task. Product type
  and tone inference are unchanged.
- An unknown product type (omitted, or `other`) is neutral for every style. Before, the one style that lists `other`
  among its product types beat all others for any brief without a usable `productType`.
- Ties are judged on the displayed score across every surviving style, so `candidateLimit: 1` can no longer hide a tie
  with the runner-up.

### Changed

- Scoring is graded and specificity-aware. A style that claims more product types, task strengths or density and usage
  levels earns less from each hit; the catalog's hand-picked primary styles for a product type count as a full product
  fit; the order of a style's tones and of the requested `tone` array is weighted; unlisted tasks count as unknown instead
  of a miss; `bestFor` and `notIdealFor` are read against the brief; a style close to an avoided one loses up to 0.12; a
  heavier motion and maintenance load costs frequent-use briefs up to 0.06. The hidden calmness rank is gone. Only an
  exact tie falls back to the style id, and that tie is reported.
- Scores and candidate order change for most briefs. Clients that pinned a score or a rank should refresh them.
  The input schema and every existing output field are unchanged.
- The `tone` array is now read in priority order, so list the most important tone first.
- `bestFor` and `notIdealFor` are matched against Latin-script words of `productDescription`, `audience` and `primaryTasks`
  with no synonym table, so write the catalog's wording ("education", not "learning"). A `bestFor` entry earns full credit
  for two or more shared distinctive words, or for one shared word that does not merely name a kind of product ("dashboard",
  "developer"; the product-type factor already scores those), and half credit otherwise. A `notIdealFor` entry counts only
  when the brief repeats the whole phrase or shares two or more of its distinctive words, and a phrase that names a tone,
  density, usage or trust level and would shrink to one common word without it is left to those factors. Generic words such as "app" and "tool" never change `bestFor`
  credit. Korean and Japanese briefs still get every other signal.
- `confidence` is never `high` when the product type is `other`.
- The server instructions and the companion skill tell agents to build from `candidate.structure` and to run
  `audit_page_structure` before claiming completion. Plans requested without `includeGroups` are unchanged, because
  `structure` is not a default group. Existing input schemas only gained optional values.

### Added

- Structural guidance for all 48 styles (#11). Tokens alone only recolored the default SaaS template, so every
  direction now carries `structure`: a layout archetype (hero composition, grid rhythm, section order, density, and
  type-scale use) and two or three buildable signature moves, each with its purpose and the jobs it can do on a page.
  The guidance was written from each style's specimen page, blueprint, and catalog entry; the density and type-scale
  numbers are read from the visual contract at runtime. Where an archetype breaks from its specimen (nine styles,
  mostly to avoid the specimen's own centered opening), the guide is labelled `authored` and its `departure` says why. `structure` is a new field on every
  `recommend_design_direction` candidate (archetype, moves with their purpose and jobs, banned pattern ids) and on
  `webstylebook://styles/{id}`, which adds each move's build steps and each ban's detection criteria. The `compose_design_tokens` result (legacy and contract mode) gets a compact `structure` reference (style
  id, resource URI, move ids) so that its largest result stays inside the 48 KB benchmark budget, and its text output
  prints the hero composition, section order, and moves.
- Banned patterns with machine-checkable criteria. Nine global patterns: a centered hero over a gradient blob, an
  all-text centered stack, a stock-photo hero, a logo strip, a generic "trusted by" band, icon feature cards, a
  testimonial carousel, a generic closing CTA banner, and the page skeleton they form. Each style adds one to three
  bans from a rule library of 19 detectors (corner radius, blurred or hard shadows, gradient fills, glass blur, glow,
  centered copy, unguarded motion, accent hue count, canvas tone, text on gradient or glass, nested surfaces, icon
  tiles, faint borders, typeface, imagery, crowded grids, and more), each grounded in the style's catalog constraint,
  visual-contract value, or specimen. A style whose identity needs a global pattern says so: `fusion-soft-inflate`
  allows its photographic plates.
- `audit_page_structure`, an 11th tool. Pass the built page's HTML and CSS text (the server still reads no files) and
  an optional `styleId`; it parses the markup, resolves the cascade, understands Tailwind utility classes, and reports
  each banned pattern with its location, observed values, and replacement: the chosen style's signature moves for the
  same job, its hero composition, or its section order. It also returns `evidence` and `results` shaped for
  `validate_design_audit_result`, plus a ruleset hash and an input hash. Evidence ids carry the `targetId`, so runs at
  several viewports validate together. A page is `clean` only when every check ran and found nothing; a stylesheet
  that needs more selector matching than the audit allows reports its absences as not verified instead of passing.
- An opt-in `structure` group for `get_design_audit_plan` with one automated check per banned pattern. The audit
  prompts include it in visual coverage.
- `webstylebook://structure/banned-patterns` and a `structure` block in the manifest. `--validate-catalog` now fails
  when a catalog style has no structure guide, when a ban cites a constraint or value the catalog does not have, or
  when two styles' guidance is near-identical.
- `ranking` on the `recommend_design_direction` result (optional, absent when only one style survives): `winner`,
  `runnerUp`, `gap`, `tied`, `reasonCodes` and a short localized `explanation` of why #1 beat #2, or `TIED` when they
  score alike at the displayed precision. The text fallback prints the same sentence.
- `useCase` in each candidate's `scoreBreakdown`.
- `tests/fixtures/recommend-briefs.v1.json`: fifteen realistic briefs with an expected top-1 (or top-2 set) and a
  minimum score gap, plus ranking, tie, invariant and README-example tests.

## [0.11.1] — 2026-10-13

### Fixed

- `v0.11.0` was tagged, but the publish workflow failed canonical catalog byte parity, so 0.11.0 was never published to npm.
- Regenerated the canonical snapshot from website commit `b6771f98480eabbe3dc602ab7c5dfd665d338178` and copied `generated/catalog.v1.json` and `generated/manifest.v1.json` together. Catalog version stays `0.10.1`, content hash `sha256:33f3638c2fec095af63918f11e2c06d37127dd590bc5fdcc09ec6d66d0df4327`, with 48 styles and 57 state recipes.
- Restored `generated/visual-contracts.v1.json` and its provenance hash from that same generation. The portable resolver sources remain byte-identical to the website revision.

## [0.11.0] — 2026-10-12

### Breaking

- Calls that omit `contract` now emit authored shadows from the pinned visual contract.
  `brutalist-grid` and every other bundled style no longer receive the generic soft shadow
  `0 1px 2px rgba(0,0,0,0.06)` / `0 4px 12px rgba(0,0,0,0.10)` / `0 12px 32px rgba(0,0,0,0.16)`
  unless that exact value is what the style authored.
- Editorial styles and monospace-led styles now emit authored display, body, and mono font
  families instead of the style-family `tokenDefaults` fonts. This includes `editorial-silence`,
  `mono-type`, `brutalist-grid`, and the other editorial or mono-led styles in the catalog.

### Migration

- The `compose_design_tokens` input and the `DesignTokens` field names are unchanged. `contract`
  requests, `secondaryStyleId` accent-only overlay, explicit density, and the legacy type scale,
  line-height, color, spacing, radius, and motion behavior are unchanged.
- Clients that depended on the generic soft shadow or on family fonts for an editorial or
  monospace-led style need to pin those previous strings themselves. Pass `contract.schema`
  `webstylebook.visual.v1` when the full authored specification is required.

### Added

- Pinned website parity fixtures for `brutalist-grid`, editorial, and mono styles, compared
  locally with no network access at test time. The fixture source is website commit
  `b6771f98480eabbe3dc602ab7c5dfd665d338178`.
- Deterministic `webstylebook.audit-plan.v1` identities containing the catalog version, catalog
  content hash, and a stable plan hash.
- `validate_design_audit_result`, a read-only audit-result contract validator for target coverage,
  durable evidence references, required evidence types, verdict applicability, and contradictory
  evidence. It returns normalized verdicts plus content-addressed evidence/result hashes without
  reading artifacts or judging visual quality.
- Regression coverage for complete, incomplete, contradictory, stale, and honestly unverified audit
  result submissions.
- A reproducible 14-case audit-contract quality benchmark comparing legacy pass-through verdicts
  with normalized results. The benchmark raises labeled verdict accuracy from 28.57% to 100% and
  reduces false PASS results from 9 to 0 while explicitly excluding subjective visual-judge claims.
- `docs/issue-1-status.md`, an acceptance audit of canonical visual-contract fidelity.

### Changed

- The package version was set to `0.11.0` and the bundled catalog version string was rewritten to match. That tag was not published. 0.11.1 restores canonical catalog version `0.10.1`. The catalog schema stays v1.
- Design workflows now submit one result per planned check/target after inspecting the real UI.
  Missing result slots are materialized as `NOT_VERIFIED`, and `valid` is explicitly contract
  validity rather than an overall design-quality score.

## [0.10.1] — 2026-10-01

### Fixed

- Synchronize the website's Korean/Japanese heavy display font fallback metadata with
  the portable resolver, preserving Black Han Sans and Dela Gothic One across every
  token format while keeping ordinary body and English font behavior unchanged.
- Include `fontSources.ts` in the MIT source allowlist and SHA-256 provenance, and
  preflight the complete import/license boundary before writing synchronized files.
- Update the pinned canonical catalog/manifest/visual artifact together and verify
  website, static handoff and MCP parity for all 48 styles and supported locales/modes.

### Release source

- Website source: `b6771f98480eabbe3dc602ab7c5dfd665d338178`.
- Package/server and canonical catalog version: `0.10.1`; catalog schema remains v1.
- No font binaries, browser font loader or website UI are added to the npm package.
- Live repeated AI-output comparisons remain not run.

## [0.10.0] — 2026-09-22

### Added

- Opt-in canonical visual contracts on `compose_design_tokens` through
  `contract.schema` `webstylebook.visual.v1`, with optional library `contentHash`
  and per-style `revision` pins. The approved artifact and portable MIT resolver
  ship inside the package. A missing pin or schema fails closed, with no runtime
  request to the website.
- Contract results add `contract`, `visualContract`, and inert `repairProposals`.
  JSON, CSS variables, TypeScript, and Tailwind keep role typography, including
  line-height, and keep explicit `none` and `0` values. Non-scalar component
  pairs stay in the companion instead of being dropped.
- `docs/visual-contract-rollout.md` records resolution order, format limits,
  provenance, and the reviewed startup and size budgets.

### Changed

- An explicit `density` of `compact` or `comfortable` now sets row and gutter
  even when the style family already has density tokens. Omitting `density`
  still keeps that family density, including extra keys.
- Legacy CSS includes `--line-height-*`. The legacy Tailwind theme includes
  `lineHeight`, and `colorMode: "both"` also emits a complete per-mode `themes`
  object.

### Unchanged

- A call that omits `contract` keeps the previous light-mode default, family
  font starting points, generic shadows, and accent-only `secondaryStyleId`
  overlay. A contract request rejects `secondaryStyleId` rather than treating
  it as typography or full-style mixing.

## [0.9.0] — 2026-08-31

### Added

- A bundled, attributed library of 520 high-completeness real-world design references, with
  normalized palette, typography, spacing, surface, layout, and motion observations. Upstream
  screenshots and brand assets remain excluded.
- `search_design_references`, a deterministic and bounded text/category/tag search that returns
  concise English, Korean, or Japanese observations and reference resource links.
- `get_design_reference`, returning one localized full reference with tokens, source revision,
  CC BY 4.0 attribution, adaptation notice, and original-site rights notice.
- `webstylebook://references` and `webstylebook://references/{id}` read-only resources.

### Changed

- Extended the design workflows to consult a small set of attributed real-world examples without
  treating their screenshots, copy, typefaces, brand assets, or visual identity as reusable assets.
- Updated the canonical catalog snapshot, runtime validation, manifest counts, and package version
  to 0.9.0.

## [0.8.0] — 2026-08-12

### Changed

- Replaced an over-specific content check with a domain-neutral contract for matching material claims,
  conclusions, and recommendations to their support and expressed certainty.
- Generalized copy review around information value, task relevance, contextual specificity, and
  evidential support. The canonical rules no longer encode a particular content domain or example.
- Renamed the corresponding stable check ids to `copy-matches-claims-to-support` and
  `avoid-unsupported-claim-as-established`.

## [0.7.0] — 2026-08-12

### Added

- Three content-audit checks for supported claims, concrete and specific copy, and visual prominence
  proportional to information value and support.
- Anti-pattern contracts for unsupported claims, abstract consultancy filler, and vague or
  weakly supported claims used as oversized visual centerpieces, with localized remediation.

### Changed

- The general design-audit prompt, server instructions, and companion skill now test support,
  contextual specificity, and proportional emphasis for prominent user-facing strings. A lack of
  internal jargon no longer counts as sufficient evidence of good copy.
- Copy rewrites must not invent evidence, facts, or next steps merely to sound useful.

## [0.6.0] — 2026-08-12

### Added

- A four-check `content` audit group for audience-language copy, meaning-before-method hierarchy,
  pseudo-precision, and task-relevant prominence. The checks are contextual: cards, statistics,
  navigation, and disclosures remain when they support the primary user task.
- Audit-scope and change-depth inputs for the `audit-design-direction` prompt. When omitted, the
  workflow asks the user before inspecting or modifying an implementation.

### Changed

- The companion skill and fallback agent fragments now inspect actual visible strings, preserve
  factual caveats, and provide before/after rewrites when content is in scope.
- Commit, push, release, and deployment are explicitly kept outside inferred audit or implementation
  scope.

## [0.5.1] — 2026-08-08

### Changed

- Reframed the motion-and-preference principle around a plain cause-to-result question rather than
  abstract easing terminology, with complete English, Korean, and Japanese guidance.
- Updated the bundled canonical catalog snapshot so MCP plans return the same clearer motion
  contract now shown on webstylebook.com.

## [0.5.0] — 2026-08-08

### Added

- Three independently authored visual-design principles for claim-adjacent evidence,
  navigation semantics, and purposeful iconography, with source references to The Crit,
  Primer, and Linear.
- Source metadata in the visual-design-principle contract, planner structured output,
  localized text fallback, and the website field guide.
- Three structured audit checks for navigation semantic drift, proof-free polish, and
  decorative iconography.

### Changed

- Strengthened attention, depth, and progressive-fidelity guidance with reversible
  before/after comparison, chrome hierarchy, separator inventories, and stress views.
- Expanded the canonical catalog to 25 visual design principles and 41 audit checks.

## [0.4.0] — 2026-08-08

### Added

- `get_design_audit_plan`, a deterministic, localized audit planner that returns stable check ids,
  severity, applicability, automation level, required evidence, remediation, selected-principle
  checks, state coverage, and a five-state verdict contract including `NOT_APPLICABLE` and
  `NOT_VERIFIED`.
- 38 structured audit definitions in the canonical catalog, covering every existing verification
  item and anti-pattern exactly once without changing the website handoff's legacy text shape.
- `webstylebook://policies/audit-checks` for clients that need the language-neutral audit metadata.

### Changed

- The companion skill and audit prompts now use the compact audit planner instead of loading both
  full three-language policy resources. They require actual rendered/code/interaction evidence and
  prohibit inferring `PASS` from an implementation summary.
- Design and UX principle planners accept `matchMode: "all-selectors"` for strict intersection
  filtering. Audit prompts use it so the near-universal `validation` phase no longer widens a
  targeted concern/outcome + surface query to almost the whole catalog.
- Audit prompt inputs are bounded and structured, and no longer re-fetch principle detail resources
  already present in planner output.
- Updated `@modelcontextprotocol/sdk` to 1.30.0 and refreshed its dependency tree; the release now
  passes `npm audit` with no findings.

## [0.3.0] — 2026-07-28

### Added

- **A closing gate for the principle catalogs.** `get_design_principle_plan` and
  `get_ux_principle_plan` are only half the story if nothing checks that their output was used, so
  `webstylebook://policies/verification` carries a `principles` group (4 items, en/ko/ja) the
  end-of-workflow self-audit walks. Each selected design principle must
  appear in `design.md` with the placement decision it produced *and* its observable verification
  check; each selected UX principle must keep its caution and its `strong` / `contextual` /
  `contested` label, with no contextual or contested principle restated as a law; each recorded
  check must actually have been run against the built UI with the outcome written down; and no
  principle may be applied at the cost of accessibility, safety, informed consent, or truthful
  feedback.
- **`principle-as-decoration` anti-pattern.** Names the two mirror failures — listing principle
  names in the brief without the placement decision, caution, or observed check, and overclaiming by
  restating a contextual/contested principle as a law to end a design argument that real content,
  real tasks, and non-happy-path states should settle.
- **`opening-earns-its-frame` design principle** (22nd entry). The project's most opinionated
  guidance — derive the centerpiece, enumerate three structurally-different openings, run the
  furniture-check — existed only as prose in the skill and policies, so `get_design_principle_plan`
  could never surface it. It is now a first-class catalog entry with placement, apply, verify, and
  caution guidance, cross-linked to `aesthetic-usability-effect`, `selective-attention`, and
  `von-restorff-effect`.
- **Weak-selector guidance on both principle plans.** `phase: validation` is carried by every UX
  principle and all but one design principle, so a query built from it matched almost the whole
  catalog while reading like a targeted filter. When a selection covers ≥90% of the catalog, the
  plan now leads its `guidance` with a localized note saying the selectors did not narrow anything
  and the result is relevance ranking — narrow by concerns/outcomes or pass explicit `principleIds`.
  The threshold deliberately flags no-op selectors only: a broad-but-ranked query (a rare outcome
  paired with a common surface) stays quiet because its ranking does real work.
- `phaseTags` on the compact `webstylebook://principles` and `webstylebook://design-principles` list
  resources. `phase` is a first-class tool selector, so browsing the list without it forced a detail
  fetch per entry just to pre-filter.
- A separate visual-design-principles domain with 22 independently authored placement,
  application, verification, and misuse guides across intent and iteration, semantic hierarchy,
  adaptive layout and density, localization, tokens and themes, accessible interaction, and
  complete states and recovery.
- `get_design_principle_plan`, `webstylebook://design-principles`,
  `webstylebook://design-principles/{id}`, and the `audit-design-principles` prompt. Visual craft
  guidance stays separate from evidence-labeled behavioral UX principles.
- A modernized, task-oriented taxonomy with first-class responsive reflow, localization,
  multi-input operability, semantic tokens, recovery, and motion-preference guidance.
- A first-class UX-principles catalog with 23 independently written application guides,
  explicit evidence confidence, cautions, source attribution, and English/Korean/Japanese
  output. The catalog links to Laws of UX and primary or authoritative references without
  copying the source site's prose, illustrations, or layout.
- `get_ux_principle_plan`, a deterministic selector that turns outcomes, surface, design
  phase, or explicit principle ids into a small apply-and-verify plan. Principles are treated
  as contextual decision prompts; accessibility, safety, consent, and truthful feedback win.
- `webstylebook://principles` and `webstylebook://principles/{id}` resources, plus the
  `audit-ux-principles` workflow prompt.
- **Anti-formulaic-opening guidance with teeth.** A new "The opening — the one thing, not a hero"
  section in the skill replaces the buried "don't default to the formulaic hero" one-liner with a
  forcing function (derive the centerpiece from the product; enumerate three structurally-different
  openings, ≥1 with no running-text column) and a **furniture-check**: the disease is not two columns
  — strong products put copy beside a visual — it is *generic furniture*. A two-column opening passes
  only when the visual is a **bespoke demonstration of the product's core mechanic** (nonsensical if
  pasted onto another product); a stock photo / abstract blob / generic card fails, and a decorative
  seam bridging the columns does not launder a generic visual. The all-text centered-stack and
  giant-word defaults are out too, and opening prose is capped at a headline + one short line + one
  action. Wired into workflow steps 3 (candidates must differ in opening structure), 6 (per-screen),
  and 9 (self-audit), and mirrored in the on-init server instructions and the CLAUDE.md / AGENTS.md
  fragments.
- New catalog policy: a `formulaic-opening` anti-pattern and a layout verification check (the
  opening's visual is a bespoke product demonstration, not generic furniture, and the copy column is
  not the full quartet), so the self-audit enforces it regardless of whether the skill is installed.
- **"Kill the AI headline cadence" rule.** Names the other recurring tell — the evocative, abstract
  noun-phrase fragment headline with one word italicized in the accent color, repeated on every
  product. The headline must be specific to the product (paste-test: it couldn't sit on a competitor
  by swapping a noun) and vary its form + emphasis each time; no house voice. Added to the skill's
  opening section, the Rules, the on-init instructions, the CLAUDE.md / AGENTS.md fragments, and as an
  `ai-headline-cadence` catalog anti-pattern + a style-fidelity verification check. The guidance is
  described abstractly — no generated example phrases are baked in (a regression test guards this).
- Codex setup documentation for `codex mcp add`, `config.toml`, `.agents/skills`, and
  `AGENTS.md` fallback instructions.
- MCP server `instructions` so Codex and other clients receive the intended design workflow
  during initialization.
- An explicit direction-approval gate in the companion skill: open-ended UI work should present
  2-3 candidate directions and wait for user approval before final component/system implementation.
- A scope & detail-confirmation step after the direction is approved: confirm deliverable, stack,
  real content/data, and target environment (don't silently assume) before building. Reflected in
  SKILL.md, the CLAUDE.md/AGENTS.md fragments, and the on-init server instructions.
- A short intake before composing candidate previews: ask whether the user has image/brand assets
  (or should source license-free samples, e.g. Unsplash) and anything to emphasize.
- Stronger active-composition guidance: the chosen style is a starting tone, not a layout mold —
  compose the components the brief needs and adapt the style to fit, never a generic "page in style X."
- `publish.yml` GitHub Actions workflow: build + test + publish to npm on a `v*` tag (with provenance).

### Changed

- The skill and both agent fragments route the self-audit through the new `principles` group, and
  the `design.md` skeleton in `skill/CLAUDE.md` / `skill/AGENTS.md` now names the selected
  visual-design principles (with placement + verification) and UX principles (with cautions +
  evidence confidence) explicitly, matching `SKILL.md`. Both fragments also point at
  `webstylebook://design-principles/{id}` and `webstylebook://principles/{id}` for selected entries.
- **`landing-page` is a first-class surface in both catalogs.** The skill leads with the landing
  surface, so `surface: 'landing-page'` has to do real work rather than collapsing to the `global`
  fallback: 11 of 23 UX principles (`von-restorff-effect`, `selective-attention`, `hicks-law`,
  `choice-overload`, `jakobs-law`, `mental-model`, `serial-position-effect`, `chunking`,
  `cognitive-load`, `law-of-proximity`, `aesthetic-usability-effect`) and 10 of 22 design principles
  are tagged for it — chosen where a landing page is a genuine headline use case, not blanket-tagged.
- The `design-product` prompt enumerates every `design.md` section instead of pointing at a "full
  brief skeleton" that exists nowhere in the catalog — prompt-only clients are now self-contained.
  `audit-design-direction` walks the verification groups including `principles`, and names the two
  dedicated principle audits.
- The skill and both fragments state plainly that the three audit prompts are **user-invoked slash
  commands, not callable tools**, so the agent runs the inline audit itself rather than deferring to
  a prompt it can never reach.
- `webstylebook://manifest` now lists domains in the canonical `CATALOG_DOMAINS` order, matching
  `generated/manifest.v1.json` (previously `design-principles` and `principles` were swapped).
- Both README diagrams show all six tools, and the without/with table gains craft and
  UX-evidence rows.
- Bundled catalog snapshot: `sha256:c20eab85…`.

### Fixed

- Design-principle wiring had no regression test, unlike UX principles — `get_design_principle_plan`
  could have been dropped from `SKILL.md`, `CLAUDE.md`, and `AGENTS.md` with the whole suite still
  green. Added the mirror-image coverage plus locks on the new verification group and anti-pattern.
- Neither fragment pointed at `webstylebook://design-principles/{id}` or `webstylebook://principles/{id}`,
  so a skill-less host had no instruction to read the selected entries at all.
- Test coverage 144 → 164, locking every fix above: phaseTags on both list resources, the
  weak-selector note (including its ko/ja wording and the cases that must *not* trigger it),
  landing-page coverage floors, the opening principle's reachability from a real query and its
  cross-link integrity, the enumerated brief in `design-product`, and manifest domain parity.
- Runtime and package-lock metadata now match the published package name and `0.3.0` version.

## [0.1.1] — 2026-06-23

### Fixed
- Recommendation: a constraint like `reduced-motion-required` no longer cross-matches
  `high-contrast-required` (shared word "required"), which had wrongly hard-rejected 16 styles.
- Tokens: on-accent label color uses true black, so mid-tone accents meet WCAG AA on the primary
  action; `checkContrast` now compares the unrounded ratio (a 4.4955 case no longer rounds to pass).
- `compare_design_directions`: an unknown style id returns `STYLE_NOT_FOUND` with near-miss suggestions.
- `--validate-catalog` recomputes the content hash and checks all entity references (motion,
  components, product archetypes, style families), not just styles + recipes.

### Added
- `errorCodes` and `resourceUriTemplates` in the manifest resource.
- A contrast warning when the accent is too low against the canvas for non-text UI use.
- Task tags (triage, checkout, communicate, upload, schedule) backed by style strengths.
- `tests/audit-regression.test.ts`.

### Removed
- Vestigial `UNSUPPORTED_LOCALE` error code (unreachable — locale is a closed enum).

## [0.1.0] — 2026-06-22

### Added

- Initial release. MCP server (stdio) with four deterministic compute tools:
  `recommend_design_direction`, `compare_design_directions`, `get_ui_state_plan`,
  `compose_design_tokens`.
- Catalog resources (`webstylebook://…`) and ready-made prompts.
- Companion skill (`skill/`) that tells the agent when to call the tools and how to use the results.
- Bundled Web Stylebook catalog snapshot: 48 styles, 20 components, 5 surfaces,
  57 UI-state recipes, 29 motion profiles, 14 product archetypes.
- Output localization in English, Korean, and Japanese.
- Fully offline at runtime: no API key, no model call, no network, no filesystem access.

[Unreleased]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.1.1...v0.3.0
[0.1.1]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/seungdori/web-stylebook-mcp/releases/tag/v0.1.0
