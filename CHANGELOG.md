# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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

### Fixed
- Runtime and package-lock metadata now match the published package name and `0.1.1` version.

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

[Unreleased]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/seungdori/web-stylebook-mcp/releases/tag/v0.1.0
