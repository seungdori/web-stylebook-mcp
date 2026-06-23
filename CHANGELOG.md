# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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
