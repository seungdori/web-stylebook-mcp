export const SERVER_NAME = 'web-stylebook';
export const SERVER_VERSION = '0.24.1';

/** The tool the on-init instructions send every new page or screen to first. */
export const ENTRY_TOOL = 'start_ui_design';
export const NEW_UI_WORKFLOW_URI = 'webstylebook://workflows/new-ui';

/** The full new-page workflow and composition guidance, served by {@link NEW_UI_WORKFLOW_URI}. */
export const NEW_UI_GUIDANCE = [
  'Use Web Stylebook before implementing or redesigning UI. Explicit audit-only requests remain read-only and use get_design_audit_plan and validate_design_audit_result. For a genuinely new visual direction, start with start_ui_design using product context and pageRole (recommend_design_direction and compare_design_directions look at more candidates), then read webstylebook://styles/{id}. Use search_design_references to find a small set of relevant real-world examples and get_design_reference for only the selected entries; treat their observations and tokens as attributed research evidence, not permission to copy or redistribute screenshots, brand assets, copy, typefaces, or visual identity. Then call get_design_principle_plan for the layout concerns/surface/phase, call get_ux_principle_plan for the task outcomes/surface/phase, call get_ui_state_plan for each surface, and compose_design_tokens for tokens. Prefer the pinned visual contract path: pass contract.schema from manifest.visualContract.contractSchema and optionally its contentHash plus the selected style revision; omit colorMode for the authored native mode and carry the website editor overrides. Keep the complete visualContract companion when delivering CSS or a theme. Calls without contract keep the legacy token shape: shadows follow the pinned visual contract, and editorial or monospace-led styles use authored font families. Other fields remain family-derived starting points. After implementation call get_design_audit_plan and inspect the actual rendered/code/interaction evidence for every included check; missing evidence is NOT_VERIFIED, never PASS. Submit the plan query, target matrix, evidence references, and one result per check/target to validate_design_audit_result before claiming completion; its valid field describes contract validity, not visual quality. A direction changes structure, not just tokens: build from candidate.structure (layout archetype and signature moves), then run audit_page_structure on the built page’s HTML and CSS with the chosen styleId, replace every finding with the move it names, and include the "structure" audit group when validating. Style never removes a product must-have: place every entry of the recommendation’s mustHaves in its zone (a first-screen item goes in the hero, whatever the archetype’s opening limits say), and pass the same productType to audit_page_structure, which lists the ones that are missing or off the first screen. When content is in scope, lack of internal jargon is not enough: test whether material claims, conclusions, and recommendations match their support and expressed certainty; whether prominent copy conveys concrete, context-specific information; and whether visual prominence matches information value, task relevance, and support. Do not invent evidence, facts, or next steps while rewriting. Use design principles as practical placement and visual-review guidance rather than a fixed recipe. Treat UX principles as evidence-labeled decision prompts, not universal laws; accessibility, safety, informed consent, and truthful feedback take priority.',
  'The following composition guidance is only for a requested new visual direction, not the existing-UI improvement workflow. Treat results as evidence, not code; do not blindly choose candidates[0]. The chosen style is a starting tone, not a layout mold: compose the components the brief needs and adapt the style to fit (override fonts/grid where it calls for it), not a generic page in that style. Compose the opening from the product’s single most important object/action/feeling, not the SaaS template. Two columns (copy beside a visual) are fine, but the visual must be a bespoke demonstration of THIS product’s core mechanic — NOT generic furniture (a stock photo, an abstract blob, generic app chrome, or a card you could paste onto another product); a decorative seam bridging the columns does not launder a generic visual. Avoid the all-text centered-stack and giant-word defaults too, and cap opening prose at a headline + one short line + one action (the product’s must-haves, such as price, options, and delivery details on a product page, are not prose and stay). Don’t default to the AI headline cadence either — an evocative noun-phrase fragment with one word italicized in the accent color, repeated on every product; the headline must be specific to THIS product (paste-test: it couldn’t sit on a competitor by swapping a noun) and vary its form and emphasis each time. For open-ended new-direction work, first ask a short intake (available image/brand assets or whether to source license-free sample imagery, and anything to emphasize), then present 2-3 candidate directions that differ in opening STRUCTURE (not just color/tone) and wait for user approval before final component/system implementation; once a direction is approved, confirm scope and open details (deliverable, stack, real content/data, target devices) before building. This server is deterministic, read-only, offline, and does not access the project filesystem.',
] as const;

/** The full existing-UI improvement guidance, served with webstylebook://workflows/improve-ui. */
export const IMPROVEMENT_GUIDANCE = 'For an existing UI improvement request, default to implementation, verification and a before/after report. Use get_design_improvement_plan first, with context containing the actual user task and observed target conditions; its workflow is the default execution contract. Preserve an immutable before capture, decide with conditional design foundations and counterexamples, edit the real source using host tools, render matched after states and test affected behavior, accessibility and preservation. Call validate_design_improvement_result with the exact plan query, workflow.planHash and actual implementation/capture/check evidence. Follow nextActions for needs-work; proposals, missing evidence, mismatched conditions and regressions cannot complete an improvement. Report actual before/after artifacts, changes and reasons, verification, tradeoffs and unverified work. complete is submitted evidence coverage, not independent quality certification; no-change is never an improvement claim. A review or explanation alone is not completion unless the human explicitly requested review only. Honor explicit read-only or narrower scope. Infer a bounded scope from the task and inspect available source before asking; ask only for missing information that materially blocks execution, never for routine reapproval. Commit, push, release and deployment remain separate authorizations. Keep working behavior and product identity, and do not require a new catalog style or new-direction approval for existing-UI fixes. Record baseline strengths and compare gains against losses in grouping, visible information, continuity and reading comfort. Keep the original when benefits are unsupported; user feedback that identifies a regression reopens prior improvement claims and requires correcting the report. Familiar visual patterns are investigation cues, not automatic defects or proof of AI authorship. Source-supported concepts and authored remedies remain distinct. The host performs edits and captures; this offline MCP cannot access the project. These existing-UI instructions take precedence over the new-direction workflow below.';

/**
 * Claude Code shows at most 4,096 characters of server instructions and lists MCP tools by name only until they are
 * loaded, so the first sentence names the entry tool and the page kinds it covers; the rest lives in the workflows.
 */
export const SERVER_INSTRUCTIONS = [
  'Before writing HTML, CSS, JSX or other UI code for any new page or screen (landing pages, dashboards, docs, settings, product pages, forms), call start_ui_design once with the product context and pageRole; if tools are listed by name only, load it first.',
  'It returns the direction, structure, fonts, photos, copy and next calls; follow them and webstylebook://workflows/new-ui (compose_design_tokens, get_design_principle_plan, get_ux_principle_plan, get_ui_state_plan).',
  'recommend_design_direction lists more directions.',
  'search_design_references and get_design_reference give attributed examples: evidence, never permission to copy screenshots, brand assets, copy or typefaces.',
  'After building, run audit_page_structure and audit_copy on the page HTML and CSS, then get_design_audit_plan and validate_design_audit_result with real evidence: missing evidence is NOT_VERIFIED, and the valid field describes contract validity, not visual quality.',
  'To improve or fix an existing UI, call get_design_improvement_plan and follow webstylebook://workflows/improve-ui through validate_design_improvement_result.',
  'Check that material claims, conclusions, and recommendations match their support, and that visual prominence matches information value, task relevance, and support.',
  'Audit-only requests stay read-only; commit, push, release and deployment need their own authorization.',
  'UX principles are decision prompts, not universal laws; accessibility, safety, informed consent and truthful feedback take priority.',
].join(' ');

export const TOOL_NAMES = [
  'start_ui_design',
  'recommend_design_direction',
  'compare_design_directions',
  'search_design_references',
  'get_design_reference',
  'get_design_principle_plan',
  'get_design_improvement_plan',
  'validate_design_improvement_result',
  'get_ux_principle_plan',
  'get_design_audit_plan',
  'validate_design_audit_result',
  'get_ui_state_plan',
  'compose_design_tokens',
  'audit_page_structure',
  'audit_copy',
  'compare_page_revisions',
] as const;

export const PROMPT_NAMES = [
  'build-page',
  'improve-ui',
  'design-product',
  'design-screen',
  'complete-ui-states',
  'redesign-with-style',
  'audit-design-direction',
  'audit-design-principles',
  'audit-ux-principles',
] as const;
