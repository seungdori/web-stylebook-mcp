// Workflow prompts (01 §9). Prompts do NOT call tools; they hand the host model a
// recommended order. The companion skill (ADR-011) is the primary trigger; prompts
// are a secondary affordance for clients that surface them.

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

function userMessage(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt('design-product', {
    title: 'Design a product with Web Stylebook',
    description: 'Choose a visual direction, compose a brief, plan screens, and cover UI states.',
    argsSchema: {
      product: z.string(),
      audience: z.string().optional(),
      pages: z.string().optional(),
      constraints: z.string().optional(),
    },
  }, ({ product, audience, pages, constraints }) => userMessage([
    'Use the Web Stylebook MCP in this order:',
    '1. recommend_design_direction (treat candidates as scored evidence; pick using product context)',
    '2. read the chosen webstylebook://styles/{id} resources',
    '3. plan each screen around its primary user task; name its surface, intended outcomes, and current design phase',
    '4. get_design_principle_plan for the layout concerns/surface/phase; use its placement, application, and verification guidance',
    '5. get_ux_principle_plan for those outcomes/surface/phase; use the design questions and cautions, not the names as decoration',
    '6. get_ui_state_plan for each surface (cover the non-happy-path states)',
    '7. compose_design_tokens for a starting token set; heed contrast warnings',
    '8. write design.md from the full brief skeleton, incorporating the returned design principles, UX principles, cautions, states, and tokens; never leave a section empty',
    '9. implement, then self-audit against webstylebook://policies/verification',
    '',
    `Product: ${product}`,
    `Audience: ${audience ?? 'infer conservatively and record the assumption'}`,
    `Pages: ${pages ?? 'infer the minimum usable set'}`,
    `Constraints: ${constraints ?? 'none provided'}`,
  ].join('\n')));

  server.registerPrompt('design-screen', {
    title: 'Design one screen',
    description: 'Plan hierarchy, components, states, responsive and motion for a single screen.',
    argsSchema: { screenType: z.string(), goal: z.string(), styleId: z.string().optional() },
  }, ({ screenType, goal, styleId }) => userMessage([
    `Design a ${screenType} screen. Goal: ${goal}.`,
    styleId ? `Use style ${styleId} (read webstylebook://styles/${styleId}).` : 'If no style is chosen yet, call recommend_design_direction first.',
    'Organize hierarchy by the primary user task. Look up relevant components in webstylebook://components.',
    'Call get_design_principle_plan with the layout concerns, matching surface, and current design phase. Use its placement and verification guidance.',
    'Call get_ux_principle_plan with the intended outcomes, matching surface, and current design phase. Apply only the principles whose cautions fit this task.',
    'Call get_ui_state_plan for the matching surface and cover required + recommended states.',
    'State responsive and motion rules (use AND avoid). Do not default to Hero + Features + Testimonial + CTA.',
  ].join('\n')));

  server.registerPrompt('complete-ui-states', {
    title: 'Complete the UI states of a surface',
    description: 'Find missing states for a surface and implement them.',
    argsSchema: { surfaceId: z.string(), existingStates: z.string().optional() },
  }, ({ surfaceId, existingStates }) => userMessage([
    `Complete the UI states for the ${surfaceId} surface.`,
    `Already implemented: ${existingStates ?? '(unknown — infer from the code)'}.`,
    'Call get_ui_state_plan to get required / recommended / domain-specific states.',
    'Diff against what exists, read webstylebook://states/{surfaceId}/{stateId} for each missing one, and implement in the returned order.',
    'Pay attention to must-not rules (e.g. silent auto-retry, losing user input, implying a charge that did not happen).',
  ].join('\n')));

  server.registerPrompt('redesign-with-style', {
    title: 'Redesign an existing screen with a new direction',
    description: 'Keep structure, change the visual direction, verify fidelity.',
    argsSchema: { current: z.string(), goal: z.string() },
  }, ({ current, goal }) => userMessage([
    `Redesign this screen toward: ${goal}. Keep what works structurally.`,
    `Current state: ${current}.`,
    'Use compare_design_directions on 2-3 candidate styles, choose primary + secondary roles, then draft the design.md brief notes and call compose_design_tokens.',
    'Finish with the audit-design-direction checklist.',
  ].join('\n')));

  server.registerPrompt('audit-design-direction', {
    title: 'Audit an implemented design',
    description: 'Check style fidelity, anti-patterns, state coverage, accessibility and motion.',
    argsSchema: { styleId: z.string(), summary: z.string() },
  }, ({ styleId, summary }) => userMessage([
    `Audit this implementation against the ${styleId} direction.`,
    `Implementation summary: ${summary}.`,
    'Check: style fidelity, anti-patterns (webstylebook://policies/anti-patterns), UI state coverage, accessibility, motion restraint.',
    'Return a verdict per item: PASS / FIX-NOW / RISK, with a concrete fix for each FIX-NOW.',
  ].join('\n')));

  server.registerPrompt('audit-design-principles', {
    title: 'Audit design principle application',
    description: 'Check whether layout and visual-design principles were applied, verified, or turned into rigid recipes.',
    argsSchema: {
      summary: z.string(),
      surface: z.string().optional(),
      concerns: z.string().optional(),
      principleIds: z.string().optional(),
    },
  }, ({ summary, surface, concerns, principleIds }) => userMessage([
    'Audit this implementation using the Web Stylebook design principle catalog.',
    `Implementation summary: ${summary}.`,
    `Surface: ${surface ?? 'infer the closest supported surface and state the assumption'}.`,
    `Design concerns: ${concerns ?? 'infer from hierarchy, layout, typography, color, depth, imagery, and UI states'}.`,
    `Explicit principles: ${principleIds ?? 'none — select a small relevant set'}.`,
    'Call get_design_principle_plan with phase: validation, then read webstylebook://design-principles/{id} only for the selected principles.',
    'For each selected principle, check the returned design question, placement guidance, apply steps, verification checks, caution, and related UX principles.',
    'Return PASS / FIX-NOW / RISK. Flag semantic-order damage, inaccessible visual hierarchy, brittle responsive placement, decorative excess, or guidance used as a rigid recipe.',
  ].join('\n')));

  server.registerPrompt('audit-ux-principles', {
    title: 'Audit UX principle application',
    description: 'Check whether relevant UX principles were applied, verified, or overgeneralized.',
    argsSchema: {
      summary: z.string(),
      surface: z.string().optional(),
      outcomes: z.string().optional(),
      principleIds: z.string().optional(),
    },
  }, ({ summary, surface, outcomes, principleIds }) => userMessage([
    'Audit this implementation using the Web Stylebook UX principle catalog.',
    `Implementation summary: ${summary}.`,
    `Surface: ${surface ?? 'infer the closest supported surface and state the assumption'}.`,
    `Intended outcomes: ${outcomes ?? 'infer from the primary user task and state the assumption'}.`,
    `Explicit principles: ${principleIds ?? 'none — select a small relevant set'}.`,
    'Call get_ux_principle_plan with phase: validation, then read webstylebook://principles/{id} only for the selected principles.',
    'For each selected principle, check the returned design question, apply steps, verification checks, caution, and evidence confidence.',
    'Return PASS / FIX-NOW / RISK. Flag dark patterns, inaccessible simplification, misleading feedback, or claims that exceed contextual/contested evidence.',
  ].join('\n')));
}
