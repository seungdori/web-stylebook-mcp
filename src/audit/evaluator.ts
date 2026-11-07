import type { CatalogRepository } from '../catalog/repository.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import type {
  AuditEvidenceType,
  AuditSeverity,
  Lang,
  UxSurface,
} from '../types.js';
import {
  planDesignAudit,
  type AuditVerdict,
  type DesignAuditPlan,
  type DesignAuditPlanInput,
  type ResolvedAuditCheck,
} from './planner.js';
import {
  AUDIT_REASON_MIN_CHARS,
  checkScopeOf,
  describeViewportRange,
  reasonIsTooShort,
  sameRoute,
  viewportWidthLabel,
  widthInRange,
  type AuditCheckScope,
} from './check-scope.js';
import { isAssertedVerdict, resolveAuditVerdict, type ViewportFit } from './verdict.js';

export const AUDIT_EVIDENCE_PHASES = [
  'static', 'before', 'input', 'after', 'recovery',
] as const;
export type AuditEvidencePhase = (typeof AUDIT_EVIDENCE_PHASES)[number];

export const AUDIT_EVIDENCE_OUTCOMES = [
  'passed', 'failed', 'cant-tell', 'inapplicable', 'error',
] as const;
export type AuditEvidenceOutcome = (typeof AUDIT_EVIDENCE_OUTCOMES)[number];

export const AUDIT_TARGET_THEMES = [
  'light', 'dark', 'high-contrast', 'system', 'other',
] as const;
export type AuditTargetTheme = (typeof AUDIT_TARGET_THEMES)[number];

export interface AuditTarget {
  id: string;
  surface: UxSurface;
  route?: string;
  screen?: string;
  stateId?: string;
  viewport?: { width: number; height: number; label?: string };
  theme?: AuditTargetTheme;
  locale?: Lang;
  userRole?: string;
  buildId?: string;
}

export interface AuditEvidenceLocation {
  route?: string;
  selector?: string;
  file?: string;
  line?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    unit: 'px' | 'normalized';
  };
}

export interface AuditEvidence {
  id: string;
  targetId: string;
  type: AuditEvidenceType;
  phase?: AuditEvidencePhase;
  summary: string;
  outcome?: AuditEvidenceOutcome;
  actual?: unknown;
  expected?: unknown;
  artifactRef?: string;
  contentHash?: string;
  capturedAt?: string;
  location?: AuditEvidenceLocation;
  producer?: { name: string; version?: string; configHash?: string };
  /**
   * Marks this item as the replacement of an earlier one of the same target and type: a re-run
   * after a fix, or a corrected false positive. The earlier item stays in the bundle unchanged,
   * but its outcome no longer counts toward any verdict.
   */
  supersedes?: { evidenceId: string; reason: string };
}

/**
 * A justified gap in the planned scope: a whole planned surface, one required state of a
 * planned state surface, or the viewport range of a check that names one.
 */
export interface AuditScopeExclusion {
  surface?: UxSurface;
  stateId?: string;
  checkId?: string;
  reason: string;
}

export interface SubmittedAuditCheckResult {
  checkId: string;
  targetId: string;
  verdict: AuditVerdict;
  evidenceRefs?: string[];
  rationale: string;
  remediation?: string;
  actual?: unknown;
  normalizedActual?: unknown;
  expected?: unknown;
}

export interface ValidateDesignAuditResultInput {
  plan: DesignAuditPlanInput;
  expectedPlanHash?: string;
  targets: AuditTarget[];
  evidence: AuditEvidence[];
  results: SubmittedAuditCheckResult[];
  scopeExclusions?: AuditScopeExclusion[];
}

export type AuditContractIssueSeverity = 'error' | 'warning';

export type AuditCoverageState = 'full' | 'partial' | 'nothing';
export type AuditScopeStatus = 'verified' | 'partial' | 'excluded' | 'not-verified';

/** How much of the planned scope, not just of the submitted targets, has verified results. */
export interface AuditScopeCoverage {
  /** submitted-targets-only: the plan names no surface or state beyond global. */
  basis: 'planned-scope' | 'submitted-targets-only';
  state: 'full' | 'partial';
  surfaces: {
    planned: UxSurface[];
    verified: UxSurface[];
    excluded: UxSurface[];
    notVerified: UxSurface[];
  };
  states: {
    required: number;
    verified: number;
    excluded: number;
    notVerified: number;
    items: Array<{
      surfaceId: string;
      stateId: string;
      status: Exclude<AuditScopeStatus, 'partial'>;
      targetIds: string[];
      reason?: string;
    }>;
  };
  viewports: Array<{
    checkId: string;
    status: AuditScopeStatus;
    ranges: Array<{ id: string; minWidth?: number; maxWidth?: number; targetIds: string[] }>;
    reason?: string;
  }>;
}

export interface AuditContractIssue {
  code: string;
  severity: AuditContractIssueSeverity;
  message: string;
  checkId?: string;
  targetId?: string;
  evidenceId?: string;
}

export interface ValidatedAuditCheckResult {
  checkId: string;
  targetId: string;
  submittedVerdict: AuditVerdict | null;
  verdict: AuditVerdict;
  severity: AuditSeverity;
  requiredEvidenceTypes: AuditEvidenceType[];
  observedEvidenceTypes: AuditEvidenceType[];
  evidenceRefs: string[];
  rationale: string;
  remediation?: string;
  actual?: unknown;
  normalizedActual?: unknown;
  expected?: unknown;
  synthesized: boolean;
}

export interface ValidatedDesignAuditResult {
  identity: {
    schema: 'webstylebook.audit-result.v1';
    catalogVersion: string;
    catalogContentHash: string;
    planHash: string;
    evidenceBundleHash: string;
    resultHash: string;
  };
  valid: boolean;
  coverage: {
    /** full only when reportingState and scope.state are both full. */
    state: AuditCoverageState;
    /** Whether every expected check/target slot of the submitted targets has a result. */
    reportingState: AuditCoverageState;
    targets: number;
    plannedChecks: number;
    expectedSlots: number;
    reportedSlots: number;
    verifiedSlots: number;
    missingSlots: number;
    scope: AuditScopeCoverage;
  };
  verdictCounts: Record<AuditVerdict, number>;
  issues: AuditContractIssue[];
  results: ValidatedAuditCheckResult[];
  guidance: string[];
}

const localized = {
  en: {
    missingResult: 'No result was submitted for this check and target.',
    guidance: [
      'valid describes the audit-result contract, not whether the UI passed the audit.',
      'A normalized verdict may differ from the submitted verdict when evidence is missing or contradictory.',
      'Compare runs only when their plan and evidence coverage fingerprints are compatible.',
      'coverage.state is full only when every expected slot was reported and the planned surfaces, required states, and viewport ranges were verified or excluded with a reason; coverage.reportingState describes the submitted slots alone.',
    ],
  },
  ko: {
    missingResult: '이 검사와 대상에 대한 결과가 제출되지 않았습니다.',
    guidance: [
      'valid는 UI 통과 여부가 아니라 감사 결과 계약의 유효성을 뜻합니다.',
      '증거가 누락되거나 모순되면 정규화된 판정이 제출 판정과 달라질 수 있습니다.',
      'plan과 evidence coverage fingerprint가 호환되는 실행끼리만 비교하세요.',
      'coverage.state는 기대 슬롯이 모두 제출되고, 계획한 surface·필수 상태·viewport 범위가 모두 검증되었거나 이유와 함께 제외되었을 때만 full입니다. coverage.reportingState는 제출한 슬롯만 나타냅니다.',
    ],
  },
  ja: {
    missingResult: 'この検査と対象の結果が提出されていません。',
    guidance: [
      'validはUIの合否ではなく、監査結果契約の有効性を示します。',
      '証拠が不足または矛盾している場合、正規化された判定は提出判定と異なることがあります。',
      'planとevidence coverage fingerprintに互換性がある実行だけを比較してください。',
      'coverage.stateがfullになるのは、期待スロットがすべて提出され、計画したsurface・必須状態・viewport範囲がすべて検証済みか理由付きで除外された場合だけです。coverage.reportingStateは提出したスロットだけを表します。',
    ],
  },
} as const;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function compareId(a: { id: string }, b: { id: string }): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function slotKey(checkId: string, targetId: string): string {
  return `${targetId}\u0000${checkId}`;
}

function checkAppliesToTarget(check: ResolvedAuditCheck, target: AuditTarget): boolean {
  return check.surfaceTags.includes('global') || check.surfaceTags.includes(target.surface);
}

function hasDurableEvidenceRef(evidence: AuditEvidence): boolean {
  if (evidence.artifactRef || evidence.contentHash) return true;
  const location = evidence.location;
  if (!location) return false;
  return Boolean(location.route || location.selector || location.file || location.region);
}

function conclusiveEvidence(evidence: AuditEvidence): boolean {
  return evidence.outcome === undefined
    || evidence.outcome === 'passed'
    || evidence.outcome === 'failed';
}

function issue(
  issues: AuditContractIssue[],
  code: string,
  message: string,
  detail: Partial<AuditContractIssue> = {},
  severity: AuditContractIssueSeverity = 'error',
): void {
  issues.push({ code, severity, message, ...detail });
}

function validateRegion(
  evidence: AuditEvidence,
  target: AuditTarget,
  issues: AuditContractIssue[],
): boolean {
  const region = evidence.location?.region;
  if (!region) return true;
  const detail = { evidenceId: evidence.id, targetId: evidence.targetId };
  if (region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0) {
    issue(issues, 'REGION_OUT_OF_BOUNDS', `evidence '${evidence.id}' has a non-positive or negative region`, detail);
    return false;
  }
  if (region.unit === 'normalized'
      && (region.x > 1 || region.y > 1 || region.x + region.width > 1 || region.y + region.height > 1)) {
    issue(issues, 'REGION_OUT_OF_BOUNDS', `evidence '${evidence.id}' has a normalized region outside 0..1`, detail);
    return false;
  }
  if (region.unit === 'px' && target.viewport
      && (region.x + region.width > target.viewport.width || region.y + region.height > target.viewport.height)) {
    issue(issues, 'REGION_OUT_OF_BOUNDS', `evidence '${evidence.id}' has a pixel region outside its target viewport`, detail);
    return false;
  }
  return true;
}

function expectedSlots(plan: DesignAuditPlan, targets: AuditTarget[]): Array<{
  check: ResolvedAuditCheck;
  target: AuditTarget;
}> {
  const slots: Array<{ check: ResolvedAuditCheck; target: AuditTarget }> = [];
  for (const target of targets) {
    for (const check of plan.checks) {
      if (checkAppliesToTarget(check, target)) slots.push({ check, target });
    }
  }
  return slots;
}

/** Static and before-phase evidence shows the target's starting screen, so it shares its route. */
function showsStartingScreen(evidence: AuditEvidence): boolean {
  return evidence.phase === undefined || evidence.phase === 'static' || evidence.phase === 'before';
}

function viewportFit(scope: AuditCheckScope | undefined, target: AuditTarget): ViewportFit {
  const ranges = scope?.viewports;
  if (!ranges?.length) return 'unscoped';
  const width = target.viewport?.width;
  if (width === undefined) return 'unknown';
  return ranges.some((range) => widthInRange(width, range)) ? 'in-range' : 'out-of-range';
}

/** 'viewports ≤390px wide' for one range; 'narrow (≤390px), medium (…), and wide (…) viewports' for bands. */
function describeRanges(ranges: AuditCheckScope['viewports']): string {
  const list = ranges ?? [];
  if (list.length <= 1) return `viewports ${list[0] ? viewportWidthLabel(list[0]) : 'of any width'} wide`;
  const named = list.map(describeViewportRange);
  return `${named.slice(0, -1).join(', ')}, and ${named.at(-1)} viewports`;
}

function capturedTime(evidence: AuditEvidence): number | undefined {
  if (!evidence.capturedAt) return undefined;
  const time = Date.parse(evidence.capturedAt);
  return Number.isNaN(time) ? undefined : time;
}

/**
 * Validates every `supersedes` link and returns the ids of the evidence items a valid
 * correction or re-run replaces. A broken link invalidates the replacing item, not the original.
 */
function resolveSupersession(
  evidenceById: Map<string, AuditEvidence>,
  invalidEvidenceIds: Set<string>,
  issues: AuditContractIssue[],
): Set<string> {
  const links = new Map<string, string>();
  for (const evidence of evidenceById.values()) {
    if (!evidence.supersedes || invalidEvidenceIds.has(evidence.id)) continue;
    const { evidenceId, reason } = evidence.supersedes;
    const original = evidenceById.get(evidenceId);
    const originalTime = original ? capturedTime(original) : undefined;
    const time = capturedTime(evidence);
    const problem = !original ? `supersedes unknown evidence '${evidenceId}'`
      : original.id === evidence.id ? 'cannot supersede itself'
        : original.targetId !== evidence.targetId ? `cannot supersede evidence '${evidenceId}' of target '${original.targetId}'`
          : original.type !== evidence.type ? `cannot supersede ${original.type} evidence '${evidenceId}' with ${evidence.type} evidence`
            : reasonIsTooShort(reason) ? `needs a correction or re-run reason of at least ${AUDIT_REASON_MIN_CHARS} characters`
              : originalTime !== undefined && time !== undefined && time < originalTime
                ? `was captured before the evidence '${evidenceId}' it supersedes`
                : undefined;
    if (problem) {
      issue(issues, 'EVIDENCE_SUPERSEDES_INVALID', `evidence '${evidence.id}' ${problem}`, {
        evidenceId: evidence.id, targetId: evidence.targetId,
      });
      invalidEvidenceIds.add(evidence.id);
      continue;
    }
    links.set(evidence.id, evidenceId);
  }

  const superseded = new Set<string>();
  for (const [from, to] of links) {
    let cursor: string | undefined = to;
    let cyclic = false;
    for (let steps = 0; cursor !== undefined && steps <= links.size; steps += 1) {
      if (cursor === from) {
        cyclic = true;
        break;
      }
      cursor = links.get(cursor);
    }
    if (cyclic) {
      const evidence = evidenceById.get(from)!;
      issue(issues, 'EVIDENCE_SUPERSEDES_INVALID', `evidence '${from}' is part of a supersedes cycle`, {
        evidenceId: from, targetId: evidence.targetId,
      });
      invalidEvidenceIds.add(from);
      continue;
    }
    superseded.add(to);
  }
  return superseded;
}

interface ScopeExclusions {
  surfaces: Map<string, string>;
  states: Map<string, string>;
  checks: Map<string, string>;
}

function stateKey(surfaceId: string, stateId: string): string {
  return `${surfaceId}\u0000${stateId}`;
}

function validateScopeExclusions(
  exclusions: AuditScopeExclusion[],
  plan: DesignAuditPlan,
  plannedSurfaces: UxSurface[],
  issues: AuditContractIssue[],
): ScopeExclusions {
  const accepted: ScopeExclusions = { surfaces: new Map(), states: new Map(), checks: new Map() };
  const stateSurfaces = new Map(plan.stateCoverage.map((surface) => [surface.surfaceId, surface]));
  const planCheckIds = new Set(plan.checks.map((check) => check.id));
  exclusions.forEach((exclusion, index) => {
    const reject = (message: string): void => issue(
      issues,
      'SCOPE_EXCLUSION_INVALID',
      `scopeExclusions[${index}] ${message}`,
      exclusion.checkId ? { checkId: exclusion.checkId } : {},
    );
    if (reasonIsTooShort(exclusion.reason)) {
      reject(`needs a reason of at least ${AUDIT_REASON_MIN_CHARS} characters`);
      return;
    }
    const reason = exclusion.reason.trim();
    let into: Map<string, string>;
    let key: string;
    if (exclusion.checkId !== undefined) {
      if (exclusion.surface !== undefined || exclusion.stateId !== undefined) {
        reject('names a checkId together with a surface or stateId; record one exclusion per gap');
        return;
      }
      if (!planCheckIds.has(exclusion.checkId)) {
        reject(`names check '${exclusion.checkId}', which is not in this plan`);
        return;
      }
      if (!checkScopeOf(exclusion.checkId)?.viewports?.length) {
        reject(`names check '${exclusion.checkId}', which has no viewport range to exclude; answer it per target instead`);
        return;
      }
      into = accepted.checks;
      key = exclusion.checkId;
    } else if (exclusion.surface === undefined) {
      reject('needs a surface (optionally with a stateId) or a checkId');
      return;
    } else if (exclusion.stateId !== undefined) {
      const surface = stateSurfaces.get(exclusion.surface);
      if (!surface?.required.some((state) => state.id === exclusion.stateId)) {
        reject(`names state '${exclusion.stateId}', which is not a required state the plan lists for '${exclusion.surface}'`);
        return;
      }
      into = accepted.states;
      key = stateKey(exclusion.surface, exclusion.stateId);
    } else {
      if (!plannedSurfaces.includes(exclusion.surface) && !stateSurfaces.has(exclusion.surface)) {
        reject(`names surface '${exclusion.surface}', which is not a planned surface`);
        return;
      }
      into = accepted.surfaces;
      key = exclusion.surface;
    }
    if (into.has(key)) {
      reject('repeats an earlier exclusion');
      return;
    }
    into.set(key, reason);
  });
  return accepted;
}

function scopeCoverage(
  plan: DesignAuditPlan,
  plannedSurfaces: UxSurface[],
  targets: AuditTarget[],
  results: ValidatedAuditCheckResult[],
  exclusions: ScopeExclusions,
  issues: AuditContractIssue[],
): AuditScopeCoverage {
  const verifiedTargetIds = new Set(results
    .filter((result) => result.verdict !== 'NOT_VERIFIED')
    .map((result) => result.targetId));
  const unusedExclusion = (what: string): void => issue(
    issues,
    'SCOPE_EXCLUSION_UNUSED',
    `the scope exclusion for ${what} is unused: verified results were submitted for it`,
    {},
    'warning',
  );

  const surfaces: AuditScopeCoverage['surfaces'] = {
    planned: plannedSurfaces, verified: [], excluded: [], notVerified: [],
  };
  for (const surface of plannedSurfaces) {
    const verified = targets.some((target) => target.surface === surface && verifiedTargetIds.has(target.id));
    const reason = exclusions.surfaces.get(surface);
    if (verified) {
      surfaces.verified.push(surface);
      if (reason) unusedExclusion(`surface '${surface}'`);
    } else if (reason) {
      surfaces.excluded.push(surface);
    } else {
      surfaces.notVerified.push(surface);
      issue(
        issues,
        'PLANNED_SURFACE_NOT_VERIFIED',
        `planned surface '${surface}' has no target with a verified result; add a target for it or record a scopeExclusions entry with a reason`,
        {},
        'warning',
      );
    }
  }

  const items: AuditScopeCoverage['states']['items'] = [];
  for (const coverage of plan.stateCoverage) {
    const missing: string[] = [];
    for (const state of coverage.required) {
      const stateTargets = targets.filter((target) => target.surface === coverage.surfaceId && target.stateId === state.id);
      const verified = stateTargets.some((target) => verifiedTargetIds.has(target.id));
      const ownReason = exclusions.states.get(stateKey(coverage.surfaceId, state.id));
      const reason = ownReason ?? exclusions.surfaces.get(coverage.surfaceId);
      const status = verified ? 'verified' : reason ? 'excluded' : 'not-verified';
      if (status === 'not-verified') missing.push(state.id);
      if (verified && ownReason) unusedExclusion(`state '${coverage.surfaceId}/${state.id}'`);
      items.push({
        surfaceId: coverage.surfaceId,
        stateId: state.id,
        status,
        targetIds: stateTargets.map((target) => target.id),
        ...(status === 'excluded' ? { reason } : {}),
      });
    }
    if (missing.length) {
      issue(
        issues,
        'REQUIRED_STATES_NOT_VERIFIED',
        `required states of '${coverage.surfaceId}' have no target with a verified result: ${missing.join(', ')}; add a target with surface '${coverage.surfaceId}' and that stateId, or record a scopeExclusions entry with a reason`,
        {},
        'warning',
      );
    }
  }

  const viewports: AuditScopeCoverage['viewports'] = [];
  for (const check of plan.checks) {
    const ranges = checkScopeOf(check.id)?.viewports;
    if (!ranges?.length) continue;
    const verifiedForCheck = new Set(results
      .filter((result) => result.checkId === check.id && result.verdict !== 'NOT_VERIFIED')
      .map((result) => result.targetId));
    const covered = ranges.map((range) => ({
      id: range.id,
      ...(range.minWidth !== undefined ? { minWidth: range.minWidth } : {}),
      ...(range.maxWidth !== undefined ? { maxWidth: range.maxWidth } : {}),
      targetIds: targets
        .filter((target) => target.viewport
          && widthInRange(target.viewport.width, range)
          && verifiedForCheck.has(target.id))
        .map((target) => target.id),
    }));
    const coveredCount = covered.filter((range) => range.targetIds.length).length;
    const reason = exclusions.checks.get(check.id);
    const status: AuditScopeStatus = coveredCount === ranges.length ? 'verified'
      : reason ? 'excluded'
        : coveredCount ? 'partial' : 'not-verified';
    if (status === 'verified' && reason) unusedExclusion(`check '${check.id}'`);
    if (status === 'partial' || status === 'not-verified') {
      const missing = ranges.filter((_range, index) => !covered[index]!.targetIds.length);
      issue(
        issues,
        'VIEWPORT_RANGE_NOT_VERIFIED',
        ranges.length === 1
          ? `check '${check.id}' has no verified result on ${describeRanges(ranges)}; add such a target or record a scopeExclusions entry with a reason`
          : `check '${check.id}' claims every breakpoint, represented by ${describeRanges(ranges)}; still unverified: ${missing.map(describeViewportRange).join(', ')}. One viewport is not the whole range; add a target per missing range or record a scopeExclusions entry with a reason`,
        { checkId: check.id },
        'warning',
      );
    }
    viewports.push({
      checkId: check.id,
      status,
      ranges: covered,
      ...(status === 'excluded' ? { reason } : {}),
    });
  }

  const complete = surfaces.notVerified.length === 0
    && items.every((item) => item.status !== 'not-verified')
    && viewports.every((item) => item.status === 'verified' || item.status === 'excluded');
  return {
    basis: plannedSurfaces.length || plan.stateCoverage.length ? 'planned-scope' : 'submitted-targets-only',
    state: complete ? 'full' : 'partial',
    surfaces,
    states: {
      required: items.length,
      verified: items.filter((item) => item.status === 'verified').length,
      excluded: items.filter((item) => item.status === 'excluded').length,
      notVerified: items.filter((item) => item.status === 'not-verified').length,
      items,
    },
    viewports,
  };
}

export function validateDesignAuditResult(
  input: ValidateDesignAuditResultInput,
  repo: CatalogRepository,
): ValidatedDesignAuditResult {
  const plan = planDesignAudit(input.plan, repo);
  const labels = localized[plan.query.locale];
  const issues: AuditContractIssue[] = [];
  const plannedSurfaces = plan.query.surfaces.filter((surface) => surface !== 'global');

  if (input.expectedPlanHash && input.expectedPlanHash !== plan.identity.planHash) {
    issue(
      issues,
      'PLAN_HASH_MISMATCH',
      `expected plan hash '${input.expectedPlanHash}' does not match '${plan.identity.planHash}'`,
    );
  }

  const targets = new Map<string, AuditTarget>();
  for (const target of input.targets) {
    if (targets.has(target.id)) {
      issue(issues, 'DUPLICATE_TARGET_ID', `duplicate audit target '${target.id}'`, { targetId: target.id });
      continue;
    }
    if (!plan.query.surfaces.includes('global') && !plan.query.surfaces.includes(target.surface)) {
      issue(
        issues,
        'TARGET_SURFACE_OUT_OF_SCOPE',
        `target '${target.id}' uses surface '${target.surface}' outside the audit plan`,
        { targetId: target.id },
      );
    }
    const stateSurface = plan.stateCoverage.find((surface) => surface.surfaceId === target.surface);
    if (stateSurface && target.stateId !== undefined
        && ![...stateSurface.required, ...stateSurface.recommended, ...stateSurface.domainSpecific]
          .some((state) => state.id === target.stateId)) {
      issue(
        issues,
        'TARGET_STATE_NOT_IN_PLAN',
        `target '${target.id}' uses state '${target.stateId}', which the plan does not list for '${target.surface}'; it covers no required state`,
        { targetId: target.id },
        'warning',
      );
    }
    targets.set(target.id, target);
  }

  const invalidEvidenceIds = new Set<string>();
  const evidenceById = new Map<string, AuditEvidence>();
  for (const evidence of input.evidence) {
    if (evidenceById.has(evidence.id)) {
      issue(issues, 'DUPLICATE_EVIDENCE_ID', `duplicate evidence id '${evidence.id}'`, { evidenceId: evidence.id });
      invalidEvidenceIds.add(evidence.id);
      continue;
    }
    evidenceById.set(evidence.id, evidence);
    const target = targets.get(evidence.targetId);
    if (!target) {
      issue(
        issues,
        'EVIDENCE_TARGET_NOT_FOUND',
        `evidence '${evidence.id}' references unknown target '${evidence.targetId}'`,
        { evidenceId: evidence.id, targetId: evidence.targetId },
      );
      invalidEvidenceIds.add(evidence.id);
      continue;
    }
    if (!hasDurableEvidenceRef(evidence)) {
      issue(
        issues,
        'EVIDENCE_NOT_DURABLE',
        `evidence '${evidence.id}' needs an artifactRef, contentHash, or exact location`,
        { evidenceId: evidence.id, targetId: evidence.targetId },
      );
      invalidEvidenceIds.add(evidence.id);
    }
    if (evidence.type === 'interaction' && (!evidence.phase || evidence.phase === 'static')) {
      issue(
        issues,
        'INTERACTION_PHASE_REQUIRED',
        `interaction evidence '${evidence.id}' must identify before, input, after, or recovery phase`,
        { evidenceId: evidence.id, targetId: evidence.targetId },
      );
      invalidEvidenceIds.add(evidence.id);
    }
    const route = evidence.location?.route;
    if (target.route && route && showsStartingScreen(evidence) && !sameRoute(target.route, route)) {
      issue(
        issues,
        'EVIDENCE_ROUTE_MISMATCH',
        `${evidence.phase ?? 'static'} evidence '${evidence.id}' was located at route '${route}', not at target route '${target.route}'; only input, after, or recovery evidence may record the route an interaction led to`,
        { evidenceId: evidence.id, targetId: evidence.targetId },
      );
      invalidEvidenceIds.add(evidence.id);
    }
    if (!validateRegion(evidence, target, issues)) invalidEvidenceIds.add(evidence.id);
  }
  const supersededIds = resolveSupersession(evidenceById, invalidEvidenceIds, issues);
  const exclusions = validateScopeExclusions(input.scopeExclusions ?? [], plan, plannedSurfaces, issues);

  const checkById = new Map(plan.checks.map((check) => [check.id, check]));
  const submittedBySlot = new Map<string, SubmittedAuditCheckResult>();
  for (const result of input.results) {
    const target = targets.get(result.targetId);
    const check = checkById.get(result.checkId);
    if (!target) {
      issue(
        issues,
        'RESULT_TARGET_NOT_FOUND',
        `result '${result.checkId}' references unknown target '${result.targetId}'`,
        { checkId: result.checkId, targetId: result.targetId },
      );
      continue;
    }
    if (!check) {
      issue(
        issues,
        'CHECK_NOT_IN_PLAN',
        `result references check '${result.checkId}' that is not in this plan`,
        { checkId: result.checkId, targetId: result.targetId },
      );
      continue;
    }
    if (!checkAppliesToTarget(check, target)) {
      issue(
        issues,
        'CHECK_NOT_APPLICABLE_TO_TARGET',
        `check '${result.checkId}' is not planned for target surface '${target.surface}'`,
        { checkId: result.checkId, targetId: result.targetId },
      );
      continue;
    }
    const key = slotKey(result.checkId, result.targetId);
    if (submittedBySlot.has(key)) {
      issue(
        issues,
        'DUPLICATE_RESULT',
        `duplicate result for check '${result.checkId}' and target '${result.targetId}'`,
        { checkId: result.checkId, targetId: result.targetId },
      );
      continue;
    }
    submittedBySlot.set(key, result);
  }

  const slots = expectedSlots(plan, [...targets.values()]);
  const results: ValidatedAuditCheckResult[] = [];
  let reportedSlots = 0;

  for (const { check, target } of slots) {
    const submitted = submittedBySlot.get(slotKey(check.id, target.id));
    if (!submitted) {
      issue(
        issues,
        'MISSING_CHECK_RESULT',
        `missing result for check '${check.id}' and target '${target.id}'`,
        { checkId: check.id, targetId: target.id },
      );
      results.push({
        checkId: check.id,
        targetId: target.id,
        submittedVerdict: null,
        verdict: 'NOT_VERIFIED',
        severity: check.severity,
        requiredEvidenceTypes: check.evidenceTypes,
        observedEvidenceTypes: [],
        evidenceRefs: [],
        rationale: labels.missingResult,
        synthesized: true,
      });
      continue;
    }

    reportedSlots += 1;
    const slot = { checkId: check.id, targetId: target.id };
    const evidenceRefs = unique(submitted.evidenceRefs ?? []);
    const usableEvidence: AuditEvidence[] = [];
    let badEvidenceRef = false;
    for (const evidenceId of evidenceRefs) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) {
        issue(
          issues,
          'EVIDENCE_REF_NOT_FOUND',
          `result references unknown evidence '${evidenceId}'`,
          { ...slot, evidenceId },
        );
        badEvidenceRef = true;
        continue;
      }
      if (invalidEvidenceIds.has(evidenceId)) {
        issue(
          issues,
          'EVIDENCE_REF_INVALID',
          `result references invalid evidence '${evidenceId}'`,
          { ...slot, evidenceId },
        );
        badEvidenceRef = true;
        continue;
      }
      if (evidence.targetId !== target.id) {
        issue(
          issues,
          'EVIDENCE_TARGET_MISMATCH',
          `evidence '${evidenceId}' belongs to target '${evidence.targetId}', not '${target.id}'`,
          { ...slot, evidenceId },
        );
        badEvidenceRef = true;
        continue;
      }
      usableEvidence.push(evidence);
    }

    // A corrected or re-run observation replaces the one it supersedes; only current outcomes count.
    const currentEvidence = usableEvidence.filter((evidence) => !supersededIds.has(evidence.id));
    const conclusive = currentEvidence.filter(conclusiveEvidence);
    const observedEvidenceTypes = unique(conclusive.map((evidence) => evidence.type));
    const missingEvidenceTypes = check.evidenceTypes
      .filter((type) => !observedEvidenceTypes.includes(type));
    const failedEvidence = currentEvidence.filter((evidence) => evidence.outcome === 'failed');
    const passedEvidence = currentEvidence.filter((evidence) => evidence.outcome === 'passed');
    const indeterminateEvidence = currentEvidence
      .filter((evidence) => evidence.outcome === 'cant-tell' || evidence.outcome === 'error');
    const scope = checkScopeOf(check.id);
    const fit = viewportFit(scope, target);

    if (submitted.verdict === 'NOT_APPLICABLE') {
      if (check.applicability === 'always' && fit !== 'out-of-range') {
        issue(
          issues,
          'NOT_APPLICABLE_FOR_ALWAYS_CHECK',
          `always-applicable check '${check.id}' cannot be NOT_APPLICABLE${fit === 'unscoped' ? ''
            : ` on a target whose recorded viewport is not outside ${describeRanges(scope?.viewports)}`}`,
          slot,
        );
      }
      if (failedEvidence.length || passedEvidence.length) {
        const cited = [...failedEvidence, ...passedEvidence]
          .map((evidence) => `'${evidence.id}' (${evidence.outcome})`).join(', ');
        issue(
          issues,
          'NOT_APPLICABLE_CONTRADICTS_EVIDENCE',
          `NOT_APPLICABLE for '${check.id}' cites evidence that evaluated the check: ${cited}. Evidence showing the check does not apply uses outcome 'inapplicable'; to correct a wrong observation, add evidence that supersedes it with a reason`,
          slot,
        );
      } else if (indeterminateEvidence.length) {
        issue(
          issues,
          'NOT_APPLICABLE_USES_INDETERMINATE_EVIDENCE',
          `NOT_APPLICABLE for '${check.id}' cites evidence that could not be evaluated`,
          slot,
        );
      }
    }

    const asserted = isAssertedVerdict(submitted.verdict);
    const missingEvidence = badEvidenceRef || evidenceRefs.length === 0 || missingEvidenceTypes.length > 0;
    if (asserted && missingEvidence) {
      issue(
        issues,
        'MISSING_REQUIRED_EVIDENCE',
        `check '${check.id}' is missing required evidence: ${missingEvidenceTypes.join(', ') || 'valid evidence reference'}`,
        slot,
      );
    }

    const missingPhases = asserted
      ? (scope?.interactionPhases ?? []).filter((phase) => !currentEvidence.some((evidence) => evidence.type === 'interaction'
        && evidence.phase === phase
        && (evidence.outcome === 'passed' || evidence.outcome === 'failed')))
      : [];
    if (missingPhases.length) {
      issue(
        issues,
        'INTERACTION_OUTCOME_NOT_OBSERVED',
        `check '${check.id}' judges the result of an action; cite interaction evidence from the ${missingPhases.join(' and ')} phase with a passed or failed outcome`,
        slot,
      );
    }

    if (submitted.verdict === 'PASS' && failedEvidence.length) {
      issue(
        issues,
        'PASS_CONTRADICTS_FAILED_EVIDENCE',
        `PASS for '${check.id}' contradicts failed evidence`,
        slot,
      );
    } else if (submitted.verdict === 'PASS' && indeterminateEvidence.length) {
      issue(
        issues,
        'PASS_USES_INDETERMINATE_EVIDENCE',
        `PASS for '${check.id}' uses evidence that could not be evaluated`,
        slot,
      );
    }

    // A finding at a viewport the criterion does not name says nothing about that criterion.
    if (asserted && fit === 'out-of-range') {
      issue(
        issues,
        'TARGET_VIEWPORT_OUT_OF_RANGE',
        `check '${check.id}' applies to ${describeRanges(scope?.viewports)}, but target '${target.id}' is ${target.viewport!.width}px wide; judge it on a target in range and answer NOT_APPLICABLE here`,
        slot,
      );
    } else if (asserted && fit === 'unknown') {
      issue(
        issues,
        'TARGET_VIEWPORT_REQUIRED',
        `check '${check.id}' applies to ${describeRanges(scope?.viewports)}; record the viewport of target '${target.id}' so its result can be placed in that range`,
        slot,
      );
    }

    const verdict = resolveAuditVerdict({
      submitted: submitted.verdict,
      severity: check.severity,
      applicability: check.applicability,
      viewport: fit,
      evidence: missingEvidence || missingPhases.length ? 'incomplete' : 'complete',
      observation: failedEvidence.length ? 'failed'
        : indeterminateEvidence.length ? 'indeterminate'
          : passedEvidence.length ? 'passed' : 'none',
    });

    if (verdict === 'FIX_NOW' && !submitted.remediation?.trim()) {
      issue(
        issues,
        'FIX_NOW_REMEDIATION_REQUIRED',
        `FIX_NOW for '${check.id}' requires the smallest concrete remediation`,
        slot,
      );
    }

    results.push({
      checkId: check.id,
      targetId: target.id,
      submittedVerdict: submitted.verdict,
      verdict,
      severity: check.severity,
      requiredEvidenceTypes: check.evidenceTypes,
      observedEvidenceTypes,
      evidenceRefs,
      rationale: submitted.rationale,
      remediation: submitted.remediation,
      actual: submitted.actual,
      normalizedActual: submitted.normalizedActual,
      expected: submitted.expected,
      synthesized: false,
    });
  }

  const verdictCounts: Record<AuditVerdict, number> = {
    PASS: 0,
    FIX_NOW: 0,
    RISK: 0,
    NOT_APPLICABLE: 0,
    NOT_VERIFIED: 0,
  };
  for (const result of results) verdictCounts[result.verdict] += 1;

  const scope = scopeCoverage(plan, plannedSurfaces, [...targets.values()], results, exclusions, issues);
  const expectedCount = slots.length;
  const missingSlots = expectedCount - reportedSlots;
  const reportingState: AuditCoverageState = reportedSlots === 0
    ? 'nothing'
    : missingSlots === 0 ? 'full' : 'partial';
  const coverageState: AuditCoverageState = reportingState === 'nothing'
    ? 'nothing'
    : reportingState === 'full' && scope.state === 'full' ? 'full' : 'partial';
  const canonicalTargets = [...targets.values()].sort(compareId);
  const canonicalEvidence = [...evidenceById.values()].sort(compareId);
  const canonicalExclusions = [...(input.scopeExclusions ?? [])]
    .map((exclusion) => ({ ...exclusion, reason: String(exclusion.reason ?? '').trim() }))
    .sort((a, b) => {
      const left = `${a.checkId ?? ''}\u0000${a.surface ?? ''}\u0000${a.stateId ?? ''}`;
      const right = `${b.checkId ?? ''}\u0000${b.surface ?? ''}\u0000${b.stateId ?? ''}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
  const evidenceBundleHash = stableHashOf({ targets: canonicalTargets, evidence: canonicalEvidence });
  const resultHash = stableHashOf({
    planHash: plan.identity.planHash,
    evidenceBundleHash,
    results,
    // Present only when given, so results without exclusions keep their hash.
    ...(canonicalExclusions.length ? { scopeExclusions: canonicalExclusions } : {}),
  });

  return {
    identity: {
      schema: 'webstylebook.audit-result.v1',
      catalogVersion: repo.catalogVersion,
      catalogContentHash: repo.contentHash,
      planHash: plan.identity.planHash,
      evidenceBundleHash,
      resultHash,
    },
    valid: !issues.some((entry) => entry.severity === 'error'),
    coverage: {
      state: coverageState,
      reportingState,
      targets: targets.size,
      plannedChecks: plan.checks.length,
      expectedSlots: expectedCount,
      reportedSlots,
      verifiedSlots: results.filter((result) => result.verdict !== 'NOT_VERIFIED').length,
      missingSlots,
      scope,
    },
    verdictCounts,
    issues,
    results,
    guidance: [...labels.guidance],
  };
}
