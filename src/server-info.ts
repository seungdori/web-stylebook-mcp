export const SERVER_NAME = 'web-stylebook';
export const SERVER_VERSION = '0.7.0';

export const SERVER_INSTRUCTIONS = [
  'Use Web Stylebook before implementing or redesigning UI. For an audit or redesign, when the human has not already set scope, first ask two short questions and stop: audit coverage (visual only / visual plus user-facing copy and information structure / full experience including behavior, accessibility, states, and build-performance evidence) and change depth (findings only / prioritized proposals / implement and verify). Commit, push, release, and deployment remain separate authorizations. Start with recommend_design_direction using product context, then read webstylebook://styles/{id}, call get_design_principle_plan for the layout concerns/surface/phase, call get_ux_principle_plan for the task outcomes/surface/phase, call get_ui_state_plan for each surface, and compose_design_tokens for tokens. After implementation call get_design_audit_plan and inspect the actual rendered/code/interaction evidence for every included check; missing evidence is NOT_VERIFIED, never PASS. When content is in scope, lack of internal jargon is not enough: test whether personalized claims and advice are grounded, whether prominent copy names concrete actors/objects/changes instead of interchangeable consultancy abstractions, and whether visual prominence matches evidential substance. Do not invent advice while rewriting. Use design principles as practical placement and visual-review guidance rather than a fixed recipe. Treat UX principles as evidence-labeled decision prompts, not universal laws; accessibility, safety, informed consent, and truthful feedback take priority.',
  'Treat results as evidence, not code; do not blindly choose candidates[0]. The chosen style is a starting tone, not a layout mold: compose the components the brief needs and adapt the style to fit (override fonts/grid where it calls for it), not a generic page in that style. Compose the opening from the product’s single most important object/action/feeling, not the SaaS template. Two columns (copy beside a visual) are fine, but the visual must be a bespoke demonstration of THIS product’s core mechanic — NOT generic furniture (a stock photo, an abstract blob, generic app chrome, or a card you could paste onto another product); a decorative seam bridging the columns does not launder a generic visual. Avoid the all-text centered-stack and giant-word defaults too, and cap opening prose at a headline + one short line + one action. Don’t default to the AI headline cadence either — an evocative noun-phrase fragment with one word italicized in the accent color, repeated on every product; the headline must be specific to THIS product (paste-test: it couldn’t sit on a competitor by swapping a noun) and vary its form and emphasis each time. For open-ended UI work, first ask a short intake (available image/brand assets or whether to source license-free sample imagery, and anything to emphasize), then present 2-3 candidate directions that differ in opening STRUCTURE (not just color/tone) and wait for user approval before final component/system implementation; once a direction is approved, confirm scope and open details (deliverable, stack, real content/data, target devices) before building. This server is deterministic, read-only, offline, and does not access the project filesystem.',
].join(' ');

export const TOOL_NAMES = [
  'recommend_design_direction',
  'compare_design_directions',
  'get_design_principle_plan',
  'get_ux_principle_plan',
  'get_design_audit_plan',
  'get_ui_state_plan',
  'compose_design_tokens',
] as const;

export const PROMPT_NAMES = [
  'design-product',
  'design-screen',
  'complete-ui-states',
  'redesign-with-style',
  'audit-design-direction',
  'audit-design-principles',
  'audit-ux-principles',
] as const;
