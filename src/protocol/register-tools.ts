// Read-only deterministic compute tools. Input is validated by zod at the
// protocol boundary; the pure engines remain SDK-free.

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogRepository } from '../catalog/repository.js';
import {
  DESIGN_CONCERNS,
  PRINCIPLE_MATCH_MODES,
  REFERENCE_CATEGORIES,
  PRODUCT_TYPES, TONES, DENSITY_LEVELS, USAGE_FREQUENCIES, TRUST_LEVELS, STATE_CATEGORIES,
  AUDIT_EVIDENCE_TYPES, UX_OUTCOMES, UX_SURFACES, UX_PHASES,
} from '../types.js';
import type { Lang } from '../types.js';
import { recommendDesignDirection } from '../recommendation/index.js';
import type { ProductContext, EvidenceResult } from '../recommendation/types.js';
import { compareDirections, CompareError, type CompareResult } from '../recommendation/compare.js';
import { planUiStates, StatePlanError, type UiStatePlan } from '../state-atlas/planner.js';
import {
  planUxPrinciples, PrinciplePlanError, type UxPrinciplePlan, type UxPrinciplePlanInput,
} from '../principles/planner.js';
import {
  DesignPrinciplePlanError,
  planDesignPrinciples,
  type DesignPrinciplePlan,
  type DesignPrinciplePlanInput,
} from '../design-principles/planner.js';
import {
  AUDIT_GROUP_IDS,
  AUDIT_VERDICTS,
  AuditPlanError,
  planDesignAudit,
  type DesignAuditPlan,
  type DesignAuditPlanInput,
} from '../audit/planner.js';
import {
  AUDIT_EVIDENCE_OUTCOMES,
  AUDIT_EVIDENCE_PHASES,
  AUDIT_TARGET_THEMES,
  validateDesignAuditResult,
  type ValidateDesignAuditResultInput,
  type ValidatedDesignAuditResult,
} from '../audit/evaluator.js';
import { composeDesignTokens, TokenError, type ComposeDesignTokensResult } from '../tokens/compile.js';
import {
  getDesignReferenceDetail,
  searchDesignReferences,
  type DesignReferenceDetail,
  type SearchDesignReferencesResult,
} from '../references/search.js';
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

const auditScalar = z.union([
  z.string().max(2000), z.number().finite(), z.boolean(), z.null(),
]);
const auditValue = z.union([
  auditScalar,
  z.array(auditScalar).max(50),
  z.record(z.string().min(1).max(100), auditScalar)
    .refine((value) => Object.keys(value).length <= 50, 'at most 50 keys'),
]);

const auditPlanInputShape = {
  styleId: z.string().min(1).max(100).optional(),
  surfaces: z.array(z.enum(UX_SURFACES)).min(1).max(12).optional(),
  designPrincipleIds: z.array(z.string().min(1).max(100)).max(12).optional(),
  uxPrincipleIds: z.array(z.string().min(1).max(100)).max(12).optional(),
  stateSurfaceIds: z.array(z.string().min(1).max(100)).max(5).optional(),
  domainSignals: z.array(z.string().max(200)).max(20).optional(),
  includeGroups: z.array(z.enum(AUDIT_GROUP_IDS)).min(1).max(AUDIT_GROUP_IDS.length).optional(),
  includeDocumentation: z.boolean().optional(),
  locale: LOCALE.optional(),
};

const auditTargetShape = {
  id: z.string().trim().min(1).max(160),
  surface: z.enum(UX_SURFACES),
  route: z.string().trim().min(1).max(500).optional(),
  screen: z.string().trim().min(1).max(300).optional(),
  stateId: z.string().trim().min(1).max(160).optional(),
  viewport: z.object({
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
    label: z.string().trim().min(1).max(100).optional(),
  }).optional(),
  theme: z.enum(AUDIT_TARGET_THEMES).optional(),
  locale: LOCALE.optional(),
  userRole: z.string().trim().min(1).max(200).optional(),
  buildId: z.string().trim().min(1).max(300).optional(),
};

const auditEvidenceLocationShape = {
  route: z.string().trim().min(1).max(500).optional(),
  selector: z.string().trim().min(1).max(1000).optional(),
  file: z.string().trim().min(1).max(2000).optional(),
  line: z.number().int().min(1).optional(),
  region: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite(),
    height: z.number().finite(),
    unit: z.enum(['px', 'normalized']),
  }).optional(),
};

const auditEvidenceShape = {
  id: z.string().trim().min(1).max(160),
  targetId: z.string().trim().min(1).max(160),
  type: z.enum(AUDIT_EVIDENCE_TYPES),
  phase: z.enum(AUDIT_EVIDENCE_PHASES).optional(),
  summary: z.string().trim().min(1).max(2000),
  outcome: z.enum(AUDIT_EVIDENCE_OUTCOMES).optional(),
  actual: auditValue.optional(),
  expected: auditValue.optional(),
  artifactRef: z.string().trim().min(1).max(2048).optional(),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  capturedAt: z.string().trim().min(1).max(100).optional(),
  location: z.object(auditEvidenceLocationShape).optional(),
  producer: z.object({
    name: z.string().trim().min(1).max(200),
    version: z.string().trim().min(1).max(100).optional(),
    configHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  }).optional(),
};

const submittedAuditResultShape = {
  checkId: z.string().trim().min(1).max(160),
  targetId: z.string().trim().min(1).max(160),
  verdict: z.enum(AUDIT_VERDICTS),
  evidenceRefs: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  rationale: z.string().trim().min(1).max(3000),
  remediation: z.string().trim().min(1).max(3000).optional(),
  actual: auditValue.optional(),
  normalizedActual: auditValue.optional(),
  expected: auditValue.optional(),
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
  if (e instanceof DesignPrinciplePlanError) {
    if (e.kind === 'DESIGN_PRINCIPLE_NOT_FOUND' && e.unknownId) {
      return new ToolError(
        'DESIGN_PRINCIPLE_NOT_FOUND',
        e.message,
        nearestIds(
          e.unknownId,
          repo.data.designPrinciples.map((principle) => principle.id),
        ),
      );
    }
    return new ToolError('INVALID_INPUT', e.message);
  }
  if (e instanceof PrinciplePlanError) {
    if (e.kind === 'UX_PRINCIPLE_NOT_FOUND' && e.unknownId) {
      return new ToolError(
        'UX_PRINCIPLE_NOT_FOUND',
        e.message,
        nearestIds(e.unknownId, repo.data.uxPrinciples.map((principle) => principle.id)),
      );
    }
    return new ToolError('INVALID_INPUT', e.message);
  }
  if (e instanceof AuditPlanError) {
    if (e.kind === 'STYLE_NOT_FOUND' && e.unknownId) {
      return new ToolError('STYLE_NOT_FOUND', e.message, nearestIds(e.unknownId, repo.allStyles().map((s) => s.id)));
    }
    if (e.kind === 'DESIGN_PRINCIPLE_NOT_FOUND' && e.unknownId) {
      return new ToolError(
        'DESIGN_PRINCIPLE_NOT_FOUND', e.message,
        nearestIds(e.unknownId, repo.data.designPrinciples.map((principle) => principle.id)),
      );
    }
    if (e.kind === 'UX_PRINCIPLE_NOT_FOUND' && e.unknownId) {
      return new ToolError(
        'UX_PRINCIPLE_NOT_FOUND', e.message,
        nearestIds(e.unknownId, repo.data.uxPrinciples.map((principle) => principle.id)),
      );
    }
    if (e.kind === 'STATE_SURFACE_NOT_FOUND' && e.unknownId) {
      return new ToolError('STATE_SURFACE_NOT_FOUND', e.message, repo.listSurfaces().map((surface) => surface.id));
    }
    return new ToolError('INVALID_INPUT', e.message);
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

  // ---------------------------------------------------- real-world references
  server.registerTool('search_design_references', {
    title: 'Search real-world design references',
    description: 'Search the bundled, attributed real-world design reference library. Query text is matched deterministically against titles, ids, categories, tags, and localized analysis. category is an exact filter; every supplied tag must match case-insensitively. Returns concise localized observations and resource links, never screenshots or brand assets.',
    inputSchema: {
      query: z.string().trim().min(1).max(200).optional(),
      category: z.enum(REFERENCE_CATEGORIES).optional(),
      tags: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
      limit: z.number().int().min(1).max(20).optional(),
      locale: LOCALE.optional(),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const result = searchDesignReferences(args, repo);
      const locale = args.locale ?? 'en';
      return ok(
        result as unknown as Record<string, unknown>,
        renderReferenceSearch(result),
        result.results.map((reference) => reference.resourceUri),
        referenceLabels[locale].resources,
      );
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  server.registerTool('get_design_reference', {
    title: 'Get one real-world design reference',
    description: 'Return one complete localized design reference with observed palette, layout, interaction, motion, normalized tokens, source revision, CC BY attribution, adaptation notice, and original-site rights notice. Use it as research evidence; do not copy or redistribute excluded screenshots, brand assets, copy, typefaces, or visual identity.',
    inputSchema: {
      referenceId: z.string().trim().min(1).max(100),
      locale: LOCALE.optional(),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const reference = repo.getReference(args.referenceId);
      if (!reference) {
        throw new ToolError(
          'REFERENCE_NOT_FOUND',
          `unknown design reference '${args.referenceId}'`,
          nearestIds(args.referenceId, repo.allReferences().map((item) => item.id)),
        );
      }
      const locale = args.locale ?? 'en';
      const detail = getDesignReferenceDetail(reference, locale, repo);
      return ok(
        detail as unknown as Record<string, unknown>,
        renderReferenceDetail(detail, locale),
        [`webstylebook://references/${reference.id}`],
        referenceLabels[locale].resources,
      );
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  // ------------------------------------------------------ design principles
  server.registerTool('get_design_principle_plan', {
    title: 'Plan relevant design principles',
    description: 'Select a small set of practical visual-design principles for intent and iteration, semantic hierarchy, adaptive layout and density, typography and localization, tokens and themes, accessible interaction, and complete states and recovery. Filter by design concerns, surface, phase, or explicit ids. Returns placement guidance, application steps, verification checks, cautions, related principles, and deterministic relevance scores.',
    inputSchema: {
      principleIds: z.array(z.string().min(1).max(100)).max(12).optional(),
      concerns: z.array(z.enum(DESIGN_CONCERNS)).max(10).optional(),
      surface: z.enum(UX_SURFACES).optional(),
      phase: z.enum(UX_PHASES).optional(),
      matchMode: z.enum(PRINCIPLE_MATCH_MODES)
        .describe('ranked-union scores any matched selector dimension; all-selectors requires every supplied dimension and may return no matches')
        .optional(),
      limit: z.number().int().min(1).max(12).optional(),
      locale: LOCALE.optional(),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const plan = planDesignPrinciples(args as DesignPrinciplePlanInput, repo);
      return ok(
        plan as unknown as Record<string, unknown>,
        renderDesignPrinciplePlan(plan),
        plan.principles.map((principle) => principle.resourceUri),
        designPrincipleFallbackLabels[plan.query.locale].resources,
      );
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  // --------------------------------------------------------- UX principles
  server.registerTool('get_ux_principle_plan', {
    title: 'Plan relevant UX principles',
    description: 'Select a small, evidence-labeled set of UX principles for a target outcome, surface, design phase, or explicit principle ids. Returns design questions, application steps, verification checks, cautions, references, and relevance scores. Treat the result as decision prompts rather than universal laws.',
    inputSchema: {
      principleIds: z.array(z.string().min(1).max(100)).max(12).optional(),
      outcomes: z.array(z.enum(UX_OUTCOMES)).max(8).optional(),
      surface: z.enum(UX_SURFACES).optional(),
      phase: z.enum(UX_PHASES).optional(),
      matchMode: z.enum(PRINCIPLE_MATCH_MODES)
        .describe('ranked-union scores any matched selector dimension; all-selectors requires every supplied dimension and may return no matches')
        .optional(),
      limit: z.number().int().min(1).max(12).optional(),
      locale: LOCALE.optional(),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const plan = planUxPrinciples(args as UxPrinciplePlanInput, repo);
      return ok(
        plan as unknown as Record<string, unknown>,
        renderPrinciplePlan(plan),
        plan.principles.map((principle) => principle.resourceUri),
        principleFallbackLabels[plan.query.locale].resources,
      );
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  // ----------------------------------------------------------- design audit plan
  server.registerTool('get_design_audit_plan', {
    title: 'Build an evidence-backed design audit plan',
    description: 'Return a localized, surface-aware audit checklist with stable check ids, severity, applicability, required evidence, remediation, verdict definitions, user-facing content checks, selected principle checks, and UI-state coverage. The host should confirm audit coverage and change depth with the user before choosing includeGroups. This tool does not inspect a project: the host must collect actual rendered/code/interaction evidence, and missing evidence is NOT_VERIFIED rather than PASS.',
    inputSchema: auditPlanInputShape,
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const plan = planDesignAudit(args as DesignAuditPlanInput, repo);
      return ok(
        plan as unknown as Record<string, unknown>,
        renderAuditPlan(plan),
        plan.resourceUris,
        auditFallbackLabels[plan.query.locale].resources,
      );
    } catch (e) { return errorResult(toToolError(e, repo)); }
  });

  server.registerTool('validate_design_audit_result', {
    title: 'Validate a design audit result contract',
    description: 'Regenerate the requested audit plan, then deterministically validate target coverage, evidence references, required evidence types, verdict applicability, and contradictions. This tool does not inspect artifacts or judge visual quality. It normalizes unsupported PASS/FIX_NOW/RISK claims to NOT_VERIFIED, preserves honest NOT_VERIFIED results, and returns stable plan/evidence/result hashes for comparable rechecks.',
    inputSchema: {
      plan: z.object(auditPlanInputShape),
      expectedPlanHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
      targets: z.array(z.object(auditTargetShape)).min(1).max(20),
      evidence: z.array(z.object(auditEvidenceShape)).max(500),
      results: z.array(z.object(submittedAuditResultShape)).max(1200),
    },
    annotations: READ_ONLY,
  }, async (args): Promise<ToolResult> => {
    try {
      const result = validateDesignAuditResult(args as ValidateDesignAuditResultInput, repo);
      return ok(
        result as unknown as Record<string, unknown>,
        renderAuditResultValidation(result, args.plan.locale ?? 'en'),
      );
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

const referenceLabels: Record<Lang, {
  searchTitle: string;
  matches: string;
  showing: string;
  noMatches: string;
  tags: string;
  palette: string;
  layout: string;
  interaction: string;
  motion: string;
  source: string;
  rights: string;
  resources: string;
}> = {
  en: {
    searchTitle: 'Design references', matches: 'Matches', showing: 'showing',
    noMatches: 'No references matched the supplied filters.', tags: 'Tags', palette: 'Palette',
    layout: 'Layout', interaction: 'Interaction', motion: 'Motion', source: 'Source',
    rights: 'Rights', resources: 'Resources',
  },
  ko: {
    searchTitle: '디자인 레퍼런스', matches: '검색 결과', showing: '표시',
    noMatches: '입력한 조건에 맞는 레퍼런스가 없습니다.', tags: '태그', palette: '팔레트',
    layout: '레이아웃', interaction: '인터랙션', motion: '모션', source: '출처',
    rights: '권리', resources: '리소스',
  },
  ja: {
    searchTitle: 'デザインリファレンス', matches: '検索結果', showing: '表示',
    noMatches: '指定した条件に一致するリファレンスはありません。', tags: 'タグ', palette: 'パレット',
    layout: 'レイアウト', interaction: 'インタラクション', motion: 'モーション', source: '出典',
    rights: '権利', resources: 'リソース',
  },
};

function renderReferenceSearch(result: SearchDesignReferencesResult): string {
  const labels = referenceLabels[result.query.locale];
  const lines = [
    `# ${labels.searchTitle}`,
    `${labels.matches}: ${result.totalMatches} (${labels.showing}: ${result.returned})`,
  ];
  for (const reference of result.results) {
    lines.push(
      '',
      `- **${reference.title}** (${reference.category}) — ${reference.summary}`,
      `  ${labels.tags}: ${reference.tags.join(', ')}`,
    );
  }
  if (!result.results.length) lines.push('', labels.noMatches);
  return lines.join('\n');
}

function renderReferenceDetail(detail: DesignReferenceDetail, locale: Lang): string {
  const labels = referenceLabels[locale];
  const { reference, attribution } = detail;
  return [
    `# ${reference.title}`,
    `${reference.category} · ${labels.tags}: ${reference.tags.join(', ')}`,
    '',
    reference.analysis.notes,
    `- ${labels.palette}: ${reference.analysis.palette}`,
    `- ${labels.layout}: ${reference.analysis.layout}`,
    `- ${labels.interaction}: ${reference.analysis.interaction}`,
    `- ${labels.motion}: ${reference.analysis.motion}`,
    '',
    `${labels.source}: ${attribution.sourceName} (${attribution.sourceLicense.name}) — ${reference.sourceSpecUrl}`,
    attribution.adaptationNotice,
    `${labels.rights}: ${attribution.rightsNotice}`,
  ].join('\n');
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

const auditFallbackLabels: Record<Lang, {
  title: string;
  checks: string;
  surfaces: string;
  evidence: string;
  verdicts: string;
  stateCoverage: string;
  required: string;
  recommended: string;
  none: string;
  resources: string;
  planHash: string;
  catalog: string;
}> = {
  en: {
    title: 'Design audit plan', checks: 'Checks', surfaces: 'Surfaces', evidence: 'evidence',
    verdicts: 'Verdicts', stateCoverage: 'State coverage', required: 'required',
    recommended: 'recommended', none: 'none', resources: 'Resources',
    planHash: 'Plan hash', catalog: 'Catalog',
  },
  ko: {
    title: '디자인 감사 계획', checks: '검사', surfaces: '화면', evidence: '증거',
    verdicts: '판정', stateCoverage: '상태 범위', required: '필수',
    recommended: '권장', none: '없음', resources: '리소스',
    planHash: '계획 해시', catalog: '카탈로그',
  },
  ja: {
    title: 'デザイン監査プラン', checks: '検査', surfaces: '画面', evidence: '証拠',
    verdicts: '判定', stateCoverage: '状態カバレッジ', required: '必須',
    recommended: '推奨', none: 'なし', resources: 'リソース',
    planHash: 'プランハッシュ', catalog: 'カタログ',
  },
};

function renderAuditPlan(plan: DesignAuditPlan): string {
  const labels = auditFallbackLabels[plan.query.locale];
  const lines = [
    `# ${labels.title}`,
    `${labels.checks}: ${plan.coverage.includedChecks}/${plan.coverage.catalogChecks}`,
    `${labels.surfaces}: ${plan.query.surfaces.join(', ')}`,
    `${labels.catalog}: ${plan.identity.catalogVersion} (${plan.identity.catalogContentHash})`,
    `${labels.planHash}: ${plan.identity.planHash}`,
    '',
    plan.evidenceRule,
    `${labels.verdicts}: ${plan.verdicts.map((verdict) => verdict.id).join(' / ')}`,
  ];
  for (const check of plan.checks) {
    lines.push(
      `- [${check.severity}] ${check.id} — ${check.criterion}`
      + ` (${labels.evidence}: ${check.evidenceTypes.join(', ')}; ${check.applicability})`,
    );
  }
  if (plan.stateCoverage.length) {
    lines.push('', `${labels.stateCoverage}:`);
    for (const surface of plan.stateCoverage) {
      lines.push(`- ${surface.surfaceId}: ${labels.required} ${surface.required.map((state) => state.id).join(', ') || labels.none}; ${labels.recommended} ${surface.recommended.map((state) => state.id).join(', ') || labels.none}`);
    }
  }
  lines.push('', ...plan.guidance);
  return lines.join('\n');
}

const auditResultLabels: Record<Lang, {
  title: string;
  contract: string;
  valid: string;
  invalid: string;
  coverage: string;
  reported: string;
  verified: string;
  missing: string;
  verdicts: string;
  issues: string;
  none: string;
  planHash: string;
  evidenceHash: string;
  resultHash: string;
}> = {
  en: {
    title: 'Design audit result validation', contract: 'Contract', valid: 'valid', invalid: 'invalid',
    coverage: 'Coverage', reported: 'reported', verified: 'verified', missing: 'missing',
    verdicts: 'Verdicts', issues: 'Contract issues', none: 'none',
    planHash: 'Plan hash', evidenceHash: 'Evidence hash', resultHash: 'Result hash',
  },
  ko: {
    title: '디자인 감사 결과 검증', contract: '계약', valid: '유효', invalid: '무효',
    coverage: '범위', reported: '제출', verified: '검증', missing: '누락',
    verdicts: '판정', issues: '계약 문제', none: '없음',
    planHash: '계획 해시', evidenceHash: '증거 해시', resultHash: '결과 해시',
  },
  ja: {
    title: 'デザイン監査結果の検証', contract: '契約', valid: '有効', invalid: '無効',
    coverage: '範囲', reported: '提出', verified: '検証', missing: '不足',
    verdicts: '判定', issues: '契約上の問題', none: 'なし',
    planHash: 'プランハッシュ', evidenceHash: '証拠ハッシュ', resultHash: '結果ハッシュ',
  },
};

function renderAuditResultValidation(result: ValidatedDesignAuditResult, locale: Lang): string {
  const labels = auditResultLabels[locale];
  const verdicts = Object.entries(result.verdictCounts)
    .map(([verdict, count]) => `${verdict} ${count}`)
    .join(' · ');
  const lines = [
    `# ${labels.title}`,
    `${labels.contract}: ${result.valid ? labels.valid : labels.invalid}`,
    `${labels.coverage}: ${result.coverage.state} — ${labels.reported} ${result.coverage.reportedSlots}/${result.coverage.expectedSlots}; ${labels.verified} ${result.coverage.verifiedSlots}; ${labels.missing} ${result.coverage.missingSlots}`,
    `${labels.verdicts}: ${verdicts}`,
    `${labels.planHash}: ${result.identity.planHash}`,
    `${labels.evidenceHash}: ${result.identity.evidenceBundleHash}`,
    `${labels.resultHash}: ${result.identity.resultHash}`,
    '',
    `${labels.issues}: ${result.issues.length || labels.none}`,
  ];
  for (const entry of result.issues.slice(0, 30)) {
    const scope = [entry.targetId, entry.checkId, entry.evidenceId].filter(Boolean).join(' / ');
    lines.push(`- [${entry.severity}] ${entry.code}${scope ? ` (${scope})` : ''} — ${entry.message}`);
  }
  if (result.issues.length > 30) lines.push(`- … ${result.issues.length - 30} more`);
  lines.push('', ...result.guidance);
  return lines.join('\n');
}

const designPrincipleFallbackLabels: Record<Lang, {
  title: string;
  relevance: string;
  designQuestion: string;
  placement: string;
  apply: string;
  verify: string;
  caution: string;
  relatedUx: string;
  references: string;
  noMatches: string;
  resources: string;
}> = {
  en: {
    title: 'Design principle plan',
    relevance: 'Relevance',
    designQuestion: 'Design question',
    placement: 'Placement',
    apply: 'Apply',
    verify: 'Verify',
    caution: 'Caution',
    relatedUx: 'Related UX principles',
    references: 'Further reading',
    noMatches: 'No catalog design principles matched the supplied selectors.',
    resources: 'Resources',
  },
  ko: {
    title: '디자인 원칙 계획',
    relevance: '관련성',
    designQuestion: '설계 질문',
    placement: '배치',
    apply: '적용',
    verify: '검증',
    caution: '주의',
    relatedUx: '연결된 UX 원칙',
    references: '참고 자료',
    noMatches: '입력한 조건에 맞는 디자인 원칙이 없습니다.',
    resources: '리소스',
  },
  ja: {
    title: 'デザイン原則プラン',
    relevance: '関連性',
    designQuestion: '設計上の問い',
    placement: '配置',
    apply: '適用',
    verify: '確認',
    caution: '注意',
    relatedUx: '関連するUX原則',
    references: '参考資料',
    noMatches: '指定した条件に一致するデザイン原則はありません。',
    resources: 'リソース',
  },
};

function renderDesignPrinciplePlan(p: DesignPrinciplePlan): string {
  const labels = designPrincipleFallbackLabels[p.query.locale];
  const lines = [`# ${labels.title}`];
  for (const principle of p.principles) {
    lines.push(
      '',
      `## ${principle.name} (${principle.id})`,
      `- ${labels.relevance}: ${principle.whyRelevant.join(' · ')}`,
      `- ${labels.designQuestion}: ${principle.designQuestion}`,
      `- ${labels.placement}: ${principle.placement.join(' · ')}`,
      `- ${labels.apply}: ${principle.apply.join(' · ')}`,
      `- ${labels.verify}: ${principle.verify.join(' · ')}`,
      `- ${labels.caution}: ${principle.caution}`,
    );
    if (principle.relatedUxPrincipleIds.length) {
      lines.push(`- ${labels.relatedUx}: ${principle.relatedUxPrincipleIds.join(', ')}`);
    }
    if (principle.references.length) {
      lines.push(`- ${labels.references}: ${principle.references.map((reference) => `${reference.title} — ${reference.publisher} (${reference.url})`).join(' · ')}`);
    }
  }
  if (!p.principles.length) lines.push('', labels.noMatches);
  lines.push('', ...p.guidance.map((item) => `- ${item}`));
  return lines.join('\n');
}

const principleFallbackLabels: Record<Lang, {
  title: string;
  relevance: string;
  designQuestion: string;
  apply: string;
  verify: string;
  caution: string;
  evidence: string;
  noMatches: string;
  resources: string;
  evidenceKind: Record<string, string>;
  evidenceConfidence: Record<string, string>;
}> = {
  en: {
    title: 'UX principle plan',
    relevance: 'Relevance',
    designQuestion: 'Design question',
    apply: 'Apply',
    verify: 'Verify',
    caution: 'Caution',
    evidence: 'Evidence',
    noMatches: 'No catalog principles matched the supplied selectors.',
    resources: 'Resources',
    evidenceKind: {
      empirical: 'empirical', gestalt: 'Gestalt', heuristic: 'heuristic', 'systems-maxim': 'systems maxim',
    },
    evidenceConfidence: {
      strong: 'strong', contextual: 'contextual', contested: 'contested',
    },
  },
  ko: {
    title: 'UX 원칙 계획',
    relevance: '관련성',
    designQuestion: '설계 질문',
    apply: '적용',
    verify: '검증',
    caution: '주의',
    evidence: '근거',
    noMatches: '입력한 조건에 맞는 카탈로그 원칙이 없습니다.',
    resources: '리소스',
    evidenceKind: {
      empirical: '실증 연구', gestalt: '게슈탈트', heuristic: '휴리스틱', 'systems-maxim': '시스템 격언',
    },
    evidenceConfidence: {
      strong: '강함', contextual: '맥락 의존', contested: '논쟁적',
    },
  },
  ja: {
    title: 'UX原則プラン',
    relevance: '関連性',
    designQuestion: '設計上の問い',
    apply: '適用',
    verify: '確認',
    caution: '注意',
    evidence: 'エビデンス',
    noMatches: '指定した条件に一致するカタログ原則はありません。',
    resources: 'リソース',
    evidenceKind: {
      empirical: '実証研究', gestalt: 'ゲシュタルト', heuristic: 'ヒューリスティック', 'systems-maxim': 'システム格言',
    },
    evidenceConfidence: {
      strong: '強い', contextual: '文脈依存', contested: '議論あり',
    },
  },
};

function renderPrinciplePlan(p: UxPrinciplePlan): string {
  const labels = principleFallbackLabels[p.query.locale];
  const lines = [`# ${labels.title}`];
  for (const principle of p.principles) {
    lines.push(
      '',
      `## ${principle.name} (${principle.id})`,
      `- ${labels.relevance}: ${principle.whyRelevant.join(' · ')}`,
      `- ${labels.designQuestion}: ${principle.designQuestion}`,
      `- ${labels.apply}: ${principle.apply.join(' · ')}`,
      `- ${labels.verify}: ${principle.verify.join(' · ')}`,
      `- ${labels.caution}: ${principle.caution}`,
      `- ${labels.evidence}: ${labels.evidenceKind[principle.evidence.kind]} / ${labels.evidenceConfidence[principle.evidence.confidence]}`,
    );
  }
  if (!p.principles.length) lines.push('', labels.noMatches);
  lines.push('', ...p.guidance.map((item) => `- ${item}`));
  return lines.join('\n');
}

function renderTokens(r: ComposeDesignTokensResult): string {
  const lines = [`# Tokens — ${r.primaryStyleId} (${r.format}, ${r.colorMode})`];
  if (r.warnings.length) lines.push('', '⚠ Contrast warnings:', ...r.warnings.map((w) => `- ${w}`));
  if (r.notes.length) lines.push('', 'Notes:', ...r.notes.map((n) => `- ${n}`));
  lines.push('', '```', r.rendered, '```');
  return lines.join('\n');
}
