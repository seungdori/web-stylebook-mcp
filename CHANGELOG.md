# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/seungdori/web-stylebook-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/seungdori/web-stylebook-mcp/releases/tag/v0.1.0
