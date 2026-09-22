# Visual contract rollout (0.10.0)

The website is the authoring authority. `generated/catalog.v1.json` contains the additive per-style `visualContract`; `generated/visual-contracts.v1.json` is the compact, offline contract artifact. The MCP reads its approved snapshot, verifies its SHA-256 envelope and byte provenance, validates every specification and revision, and verifies catalog version/revision agreement. It never reaches the website to fill in missing data.

The resolver, validator, contrast assessment and exporters are portable MIT source generated into `src/visual-canonical`. They are copied byte for byte from the website allowlist by `npm run visual:sync -- /path/to/web-stylebook`. `generated/visual-contract-source.v1.json` records source hashes, artifact hash, source repository and license. The copy excludes web UI, screenshots, font files, images and third-party reference content. Font family/availability/license metadata is descriptive; no remote assets are loaded by MCP.

## Compatibility and projection

Existing `compose_design_tokens` requests retain the light-mode default and legacy secondary-accent overlay. Explicit density now controls row/gutter even when a family defines defaults. CSS includes line-height variables; the legacy Tailwind theme includes line-height/motion/density and a complete `themes` companion for both modes.

Opt in using `contract: { "schema": "webstylebook.visual.v1" }`. Read the manifest to pin the library `contentHash`; read the selected style resource to pin its `revision`. The omitted color mode resolves the authored native mode. Unsupported modes, schemas, revisions, conflicting overrides and unsafe scalar values fail with an actionable error. A contract request cannot silently fall back to family defaults. `secondaryStyleId` remains legacy-only; per-axis selections from the website are explicit color/typography/spacing/font overrides.

Resolution follows authored mode values, locale reading adjustments, valid explicit overrides, then explicitly accepted current contrast proposals. Accepted repairs are mode-specific: when applying them, request light or dark separately. The existing legacy accessible-on-accent repair stays unchanged. In the canonical path, repair proposals remain inert until supplied in `acceptedRepairs`, matching the website. Authored or edited insufficient contrast is reported honestly; output is not a blanket accessibility pass. Accent identity and actual action/link/focus roles remain separate.

The canonical `visualContract` companion contains all colors, type roles, font metadata, responsive sizes, surface/motion/density values, component pairs, usage rules, origins and actual repairs. `tokens` retains compatibility aliases. CSS exports scalar variables and full `.ws-type-*` classes; non-scalar metadata remains in the companion. Tailwind exports `extend`, complete `roleStyles`, and metadata, per mode. JSON and TypeScript contain the full resolved specification. Text-only MCP clients also receive source identity and repair proposals; CSS text output carries the complete edited specification as a compact JSON companion. Fluid text uses the same 320–1280 px viewport range and 16 px root baseline in previews and CSS. Both-mode tests vary typography, motion and surfaces as well as colors.

## Validation and observed cost

Baseline was measured before changes on Node 24.4.1/macOS. These local timings are observations, not universal performance claims. The post-change sample follows the final shared resolver integration; rerun `npm run build && npm run visual:benchmark` for the pinned current hashes.

| Measurement | Before | After sample |
| --- | ---: | ---: |
| Repository/compiler import and catalog load | 17.1 ms | 37.0 ms |
| First canonical request, including artifact integrity validation | n/a | 42.1 ms |
| Warm legacy request | 0.0192 ms | 0.0161 ms |
| Warm canonical request | n/a | 1.163 ms |
| Largest composed JSON result, 48 styles × 3 locales | legacy Brutalist fixture 3,254 B | 47,337 B |
| Visual sidecar artifact | n/a | 834,347 B |
| npm package compressed | 920,576 B | 1,061,573 B |
| npm package unpacked | 4,273,435 B | 6,228,728 B |

The complete hierarchy and compatibility aliases require more response bytes than a family-derived token seed. Canonical JSON rendering is compact to avoid unnecessary duplicate whitespace. Font-metadata origins are recorded once as a group while individual token-field origins remain complete. Reviewed byte budgets are 48 KiB per composed JSON result (before the MCP text fallback/envelope), 1 MiB for the visual artifact, and 1.5 MiB for the compressed package. Startup pays the shared schema import cost; artifact validation happens once per repository on first canonical access. Responses contain only the requested style, mode(s), content locale and applicable guidance.

Automated coverage includes existing invalid-accent/contrast/secondary-overlay contracts, exact shared-source hashes, all 48 styles and supported modes/locales, explicit zero/none, density overrides, all four renderers, mode-specific noncolor fields, unsafe values, stale artifact/revision errors, accepted-repair verification and MCP resource/tool wiring. Website-to-MCP parity is additionally run from the website with `npm run quality:parity -- --mcp-root /path/to/web-stylebook-mcp`. No browser or downstream AI output quality is inferred from these token tests.

## Publication order

Publish the reviewed website source and regenerated catalog first, preserving the approved hash/revisions. Then synchronize all catalog/manifest/visual artifacts and portable source into the MCP package, validate, run source parity, and publish the matching MCP version. The publish workflow checks both catalog bytes and portable source/provenance before package smoke testing. No release or deployment is performed by these implementation changes.
