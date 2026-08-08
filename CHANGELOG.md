# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.1.1...v0.3.0
[0.1.1]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/seungdori/web-stylebook-mcp/releases/tag/v0.1.0
