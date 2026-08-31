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
}

export type AuditContractIssueSeverity = 'error' | 'warning';

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
    state: 'full' | 'partial' | 'nothing';
    targets: number;
    plannedChecks: number;
    expectedSlots: number;
    reportedSlots: number;
    verifiedSlots: number;
    missingSlots: number;
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
    ],
  },
  ko: {
    missingResult: '이 검사와 대상에 대한 결과가 제출되지 않았습니다.',
    guidance: [
      'valid는 UI 통과 여부가 아니라 감사 결과 계약의 유효성을 뜻합니다.',
      '증거가 누락되거나 모순되면 정규화된 판정이 제출 판정과 달라질 수 있습니다.',
      'plan과 evidence coverage fingerprint가 호환되는 실행끼리만 비교하세요.',
    ],
  },
  ja: {
    missingResult: 'この検査と対象の結果が提出されていません。',
    guidance: [
      'validはUIの合否ではなく、監査結果契約の有効性を示します。',
      '証拠が不足または矛盾している場合、正規化された判定は提出判定と異なることがあります。',
      'planとevidence coverage fingerprintに互換性がある実行だけを比較してください。',
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

function failedVerdict(severity: AuditSeverity): AuditVerdict {
  return severity === 'minor' ? 'RISK' : 'FIX_NOW';
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

export function validateDesignAuditResult(
  input: ValidateDesignAuditResultInput,
  repo: CatalogRepository,
): ValidatedDesignAuditResult {
  const plan = planDesignAudit(input.plan, repo);
  const labels = localized[plan.query.locale];
  const issues: AuditContractIssue[] = [];

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
    if (!validateRegion(evidence, target, issues)) invalidEvidenceIds.add(evidence.id);
  }

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
          { checkId: check.id, targetId: target.id, evidenceId },
        );
        badEvidenceRef = true;
        continue;
      }
      if (invalidEvidenceIds.has(evidenceId)) {
        issue(
          issues,
          'EVIDENCE_REF_INVALID',
          `result references invalid evidence '${evidenceId}'`,
          { checkId: check.id, targetId: target.id, evidenceId },
        );
        badEvidenceRef = true;
        continue;
      }
      if (evidence.targetId !== target.id) {
        issue(
          issues,
          'EVIDENCE_TARGET_MISMATCH',
          `evidence '${evidenceId}' belongs to target '${evidence.targetId}', not '${target.id}'`,
          { checkId: check.id, targetId: target.id, evidenceId },
        );
        badEvidenceRef = true;
        continue;
      }
      usableEvidence.push(evidence);
    }

    const conclusive = usableEvidence.filter(conclusiveEvidence);
    const observedEvidenceTypes = unique(conclusive.map((evidence) => evidence.type));
    const missingEvidenceTypes = check.evidenceTypes
      .filter((type) => !observedEvidenceTypes.includes(type));
    let verdict = submitted.verdict;

    if (submitted.verdict === 'NOT_APPLICABLE' && check.applicability === 'always') {
      issue(
        issues,
        'NOT_APPLICABLE_FOR_ALWAYS_CHECK',
        `always-applicable check '${check.id}' cannot be NOT_APPLICABLE`,
        { checkId: check.id, targetId: target.id },
      );
      verdict = 'NOT_VERIFIED';
    }

    const asserted = submitted.verdict === 'PASS'
      || submitted.verdict === 'FIX_NOW'
      || submitted.verdict === 'RISK';
    if (asserted && (badEvidenceRef || evidenceRefs.length === 0 || missingEvidenceTypes.length > 0)) {
      issue(
        issues,
        'MISSING_REQUIRED_EVIDENCE',
        `check '${check.id}' is missing required evidence: ${missingEvidenceTypes.join(', ') || 'valid evidence reference'}`,
        { checkId: check.id, targetId: target.id },
      );
      verdict = 'NOT_VERIFIED';
    }

    if (submitted.verdict === 'PASS' && usableEvidence.some((evidence) => evidence.outcome === 'failed')) {
      verdict = failedVerdict(check.severity);
      issue(
        issues,
        'PASS_CONTRADICTS_FAILED_EVIDENCE',
        `PASS for '${check.id}' contradicts failed evidence`,
        { checkId: check.id, targetId: target.id },
      );
    } else if (submitted.verdict === 'PASS'
        && usableEvidence.some((evidence) => evidence.outcome === 'cant-tell' || evidence.outcome === 'error')) {
      verdict = 'NOT_VERIFIED';
      issue(
        issues,
        'PASS_USES_INDETERMINATE_EVIDENCE',
        `PASS for '${check.id}' uses evidence that could not be evaluated`,
        { checkId: check.id, targetId: target.id },
      );
    }

    if (verdict === 'FIX_NOW' && !submitted.remediation?.trim()) {
      issue(
        issues,
        'FIX_NOW_REMEDIATION_REQUIRED',
        `FIX_NOW for '${check.id}' requires the smallest concrete remediation`,
        { checkId: check.id, targetId: target.id },
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

  const expectedCount = slots.length;
  const missingSlots = expectedCount - reportedSlots;
  const coverageState = reportedSlots === 0
    ? 'nothing'
    : missingSlots === 0 ? 'full' : 'partial';
  const canonicalTargets = [...targets.values()].sort(compareId);
  const canonicalEvidence = [...evidenceById.values()].sort(compareId);
  const evidenceBundleHash = stableHashOf({ targets: canonicalTargets, evidence: canonicalEvidence });
  const resultHash = stableHashOf({
    planHash: plan.identity.planHash,
    evidenceBundleHash,
    results,
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
      targets: targets.size,
      plannedChecks: plan.checks.length,
      expectedSlots: expectedCount,
      reportedSlots,
      verifiedSlots: results.filter((result) => result.verdict !== 'NOT_VERIFIED').length,
      missingSlots,
    },
    verdictCounts,
    issues,
    results,
    guidance: [...labels.guidance],
  };
}
