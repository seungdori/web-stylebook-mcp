// The four v0.1 compute tools (ADR-011): recommend / compare / get_ui_state_plan
// / compose_design_tokens. All read-only, deterministic. Input validated by zod.

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogRepository } from '../catalog/repository.js';
import {
  PRODUCT_TYPES, TONES, DENSITY_LEVELS, USAGE_FREQUENCIES, TRUST_LEVELS, STATE_CATEGORIES,
} from '../types.js';
import { recommendDesignDirection } from '../recommendation/index.js';
import type { ProductContext, EvidenceResult } from '../recommendation/types.js';
import { compareDirections, CompareError, type CompareResult } from '../recommendation/compare.js';
import { planUiStates, StatePlanError, type UiStatePlan } from '../state-atlas/planner.js';
import { composeDesignTokens, TokenError, type ComposeDesignTokensResult } from '../tokens/compile.js';
import { ok, errorResult, type ToolResult } from './result.js';
import { ToolError, nearestIds } from './errors.js';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const LOCALE = z.enum(['en', 'ko', 'ja']);

const productContextShape = {
  productDescription: z.string().min(1).max(2000),
  productType: z.enum(PRODUCT_TYPES).optional(),
  audience: z.array(z.string().max(200)).max(20).optional(),
  primaryTasks: z.array(z.string().max(200)).max(20).optional(),
  tone: z.array(z.enum(TONES)).max(8).optional(),
  density: z.enum(DENSITY_LEVELS).optional(),
  usageFrequency: z.enum(USAGE_FREQUENCIES).optional(),
  trustSensitivity: z.enum(TRUST_LEVELS).optional(),
  constraints: z.array(z.string().max(300)).max(20).optional(),
  avoid: z.array(z.string().max(300)).max(20).optional(),
};

// NOTE (audit L4): a tool `outputSchema` was evaluated and deliberately NOT added.
// MCP clients validate structuredContent strictly (additionalProperties:false) for
// EVERY result, including error results — which here carry a structured `{error:{…}}`
// envelope for agent introspection. A success-shaped outputSchema therefore rejects
// error results outright. Keeping the structured-error envelope is the better DX, so
// the result shape is documented in the README/types instead of an outputSchema.

function toToolError(e: unknown, repo: CatalogRepository): ToolError {
  if (e instanceof ToolError) return e;
  if (e instanceof StatePlanError) {
    return new ToolError('STATE_SURFACE_NOT_FOUND', e.message, repo.listSurfaces().map((s) => s.id));
  }
  if (e instanceof TokenError) {
    const m = /unknown (?:secondary )?style '([^']+)'/.exec(e.message);
    if (m && m[1]) return new ToolError('STYLE_NOT_FOUND', e.message, nearestIds(m[1], repo.allStyles().map((s) => s.id)));
    // a color/format problem is INVALID_INPUT, not a missing style
    return new ToolError('INVALID_INPUT', e.message);
  }
  if (e instanceof CompareError) {
    // mirror the token/state tools: an unknown style id is STYLE_NOT_FOUND + near-miss suggestions
    const m = /unknown (?:secondary )?style '([^']+)'/.exec(e.message);
    if (m && m[1]) return new ToolError('STYLE_NOT_FOUND', e.message, nearestIds(m[1], repo.allStyles().map((s) => s.id)));
    return new ToolError('INVALID_INPUT', e.message);
  }
  return new ToolError('INVALID_INPUT', e instanceof Error ? e.message : String(e));
}

export function registerTools(server: McpServer, repo: CatalogRepository): void {
  // ---------------------------------------------------------------- recommend
  server.registerTool('recommend_design_direction', {
    title: 'Recommend a design direction',
    description: 'Given product context, return scored style candidates with reason codes, rejected styles with reasons, secondary pairings, assumptions and confidence. Evidence-provider: the host model makes the final pick. Call before writing UI. The "tone" field (named "tone", not "tones") is an ARRAY of zero or more of: calm, technical, trustworthy, premium, editorial, playful, bold, experimental. Each candidate.score already includes soft penalties (density/motion/tone fit) that are not itemized in scoreBreakdown.',
    inputSchema: { ...productContextShape, locale: LOCALE.optional(), candidateLimit: z.number().int().min(1).max(10).optional() },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const result = recommendDesignDirection(args as ProductContext, repo);
      if (result.candidates.length === 0) {
        throw new ToolError('NO_COMPATIBLE_STYLE', 'No style satisfies all the hard constraints (every candidate was rejected).', [
          'relax or remove some entries from "avoid"',
          'loosen conflicting constraints',
          'broaden or drop an over-specific productType',
        ], { rejectedCount: result.rejected.length });
      }
      return ok(result as unknown as Record<string, unknown>, renderRecommend(result), result.candidates.map((c) => c.resourceUri));
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  // ---------------------------------------------------------------- compare
  server.registerTool('compare_design_directions', {
    title: 'Compare design directions',
    description: 'Compare 2-4 directions across product fit, repeated-use suitability, density, trust, distinctiveness, accessibility risk, motion and maintenance. Returns each direction\'s favorable conditions and likely failure mode — never a single winner.',
    inputSchema: {
      directions: z.array(z.object({ primaryStyleId: z.string(), secondaryStyleId: z.string().optional() })).min(2).max(4),
      product: z.object(productContextShape).optional(),
      locale: LOCALE.optional(),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const result = compareDirections(args as Parameters<typeof compareDirections>[0], repo);
      return ok(result as unknown as Record<string, unknown>, renderCompare(result),
        result.directions.map((d) => `webstylebook://styles/${d.primaryStyleId}`));
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  // ------------------------------------------------------------ ui state plan
  server.registerTool('get_ui_state_plan', {
    title: 'Plan UI states for a surface',
    description: 'For a surface (data-table, form, checkout, chat, developer-console), return required / recommended / domain-specific states with triggers, must-show, must-not, accessibility and motion guidance, plus an implementation order. Covers the non-happy-path.',
    inputSchema: {
      surfaceId: z.string().describe(`surface id — one of: ${repo.listSurfaces().map((s) => s.id).join(' | ')}`),
      productContext: z.string().max(2000).optional(),
      domainSignals: z.array(z.string().max(200)).max(20).optional(),
      includeCategories: z.array(z.enum(STATE_CATEGORIES)).optional(),
      styleId: z.string().describe('optional catalog style id (see webstylebook://styles) to tailor state guidance').optional(),
      criticalOnly: z.boolean().optional(),
      locale: LOCALE.optional(),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      if (args.styleId && !repo.getStyle(args.styleId)) {
        throw new ToolError('STYLE_NOT_FOUND', `unknown style '${args.styleId}'`, nearestIds(args.styleId, repo.allStyles().map((s) => s.id)));
      }
      const plan = planUiStates(args, repo);
      const uris = [...plan.required, ...plan.recommended, ...plan.domainSpecific].map((s) => s.resourceUri);
      return ok(plan as unknown as Record<string, unknown>, renderStatePlan(plan), uris);
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  // ----------------------------------------------------------------- tokens
  server.registerTool('compose_design_tokens', {
    title: 'Compose design tokens',
    description: 'Compile a starting set of role-based design tokens (color, typography, spacing, radius, motion, density) for a style in json / css-variables / tailwind / typescript, with light/dark/both modes, accent override, and WCAG contrast warnings.',
    inputSchema: {
      primaryStyleId: z.string(),
      secondaryStyleId: z.string().optional(),
      accentOverride: z.string().regex(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'must be a 3/6/8-digit hex color').optional(),
      format: z.enum(['json', 'css-variables', 'tailwind', 'typescript']),
      density: z.enum(['comfortable', 'compact']).optional(),
      colorMode: z.enum(['light', 'dark', 'both']).optional(),
      locale: LOCALE.optional(),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      if (!repo.getStyle(args.primaryStyleId)) {
        throw new ToolError('STYLE_NOT_FOUND', `unknown style '${args.primaryStyleId}'`, nearestIds(args.primaryStyleId, repo.allStyles().map((s) => s.id)));
      }
      const result = composeDesignTokens(args, repo);
      return ok(result as unknown as Record<string, unknown>, renderTokens(result), [`webstylebook://styles/${args.primaryStyleId}`]);
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });
}

/* ----------------------------- text renderers ----------------------------- */

function renderRecommend(r: EvidenceResult): string {
  const lines = ['# Design direction (scored evidence)'];
  for (const c of r.candidates) lines.push(`- ${c.score.toFixed(2)} **${c.styleId}** — ${c.matched.join(' · ')}`);
  if (r.pairings.length) lines.push('', 'Secondary pairings:', ...r.pairings.map((p) => `- ${p.styleId} → ${p.role.join(', ')}`));
  if (r.rejected.length) lines.push('', `Rejected (${r.rejected.length}), e.g.: ${r.rejected.slice(0, 3).map((x) => `${x.styleId} (${x.reasonCodes.join(',')})`).join('; ')}`);
  lines.push('', `Confidence: ${r.confidence}${r.compromised ? ' (compromised — constraints relaxed)' : ''}`);
  if (r.resolvedContext.assumptions.length) lines.push(`Assumptions: ${r.resolvedContext.assumptions.join('; ')}`);
  lines.push('', r.guidance);
  return lines.join('\n');
}

function renderCompare(r: CompareResult): string {
  const lines = ['# Direction comparison'];
  for (const d of r.directions) {
    lines.push(`\n## ${d.primaryStyleId}${d.secondaryStyleId ? ` + ${d.secondaryStyleId}` : ''}`);
    lines.push(`- product fit ${d.axes.productFit} · repeated-use ${d.axes.repeatedUseSuitability} · density ${d.axes.informationDensity} · trust ${d.axes.trust}`);
    lines.push(`- distinctiveness ${d.axes.visualDistinctiveness} · a11y risk ${d.axes.accessibilityRisk} · motion ${d.axes.motionIntensity} · maintenance ${d.axes.maintenanceRisk}`);
    lines.push(`- failure mode: ${d.likelyFailureMode}`);
  }
  lines.push('', r.note);
  return lines.join('\n');
}

function renderStatePlan(p: UiStatePlan): string {
  const lines = [`# UI states — ${p.surfaceId}`];
  const fmt = (label: string, arr: { id: string; name: string }[]) => arr.length ? `${label}: ${arr.map((s) => s.id).join(', ')}` : '';
  lines.push(fmt('Required', p.required), fmt('Recommended', p.recommended), fmt('Domain-specific', p.domainSpecific));
  lines.push('', `Implementation order: ${p.implementationOrder.join(' → ')}`);
  if (p.styleNote) lines.push('', p.styleNote);
  if (p.unresolvedQuestions.length) lines.push('', `Unresolved: ${p.unresolvedQuestions.join(' ')}`);
  return lines.filter(Boolean).join('\n');
}

function renderTokens(r: ComposeDesignTokensResult): string {
  const lines = [`# Tokens — ${r.primaryStyleId} (${r.format}, ${r.colorMode})`];
  if (r.warnings.length) lines.push('', '⚠ Contrast warnings:', ...r.warnings.map((w) => `- ${w}`));
  if (r.notes.length) lines.push('', 'Notes:', ...r.notes.map((n) => `- ${n}`));
  lines.push('', '```', r.rendered, '```');
  return lines.join('\n');
}
