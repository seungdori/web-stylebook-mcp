export const SERVER_NAME = 'web-stylebook';
export const SERVER_VERSION = '0.1.1';

export const SERVER_INSTRUCTIONS = [
  'Use Web Stylebook before implementing or redesigning UI. Start with recommend_design_direction using product context, then read webstylebook://styles/{id}, call get_ui_state_plan for each surface, and compose_design_tokens for tokens.',
  'Treat results as evidence, not code; do not blindly choose candidates[0]. The chosen style is a starting tone, not a layout mold: compose the components the brief needs and adapt the style to fit (override fonts/grid where it calls for it), not a generic page in that style. For open-ended UI work, first ask a short intake (available image/brand assets or whether to source license-free sample imagery, and anything to emphasize), then present 2-3 candidate directions and wait for user approval before final component/system implementation; once a direction is approved, confirm scope and open details (deliverable, stack, real content/data, target devices) before building. This server is deterministic, read-only, offline, and does not access the project filesystem.',
].join(' ');

export const TOOL_NAMES = [
  'recommend_design_direction',
  'compare_design_directions',
  'get_ui_state_plan',
  'compose_design_tokens',
] as const;

export const PROMPT_NAMES = [
  'design-product',
  'design-screen',
  'complete-ui-states',
  'redesign-with-style',
  'audit-design-direction',
] as const;
