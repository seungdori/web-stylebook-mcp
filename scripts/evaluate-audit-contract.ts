import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  validateDesignAuditResult,
  type AuditEvidence,
  type AuditTarget,
  type SubmittedAuditCheckResult,
  type ValidateDesignAuditResultInput,
} from '../src/audit/evaluator.js';
import {
  planDesignAudit,
  type AuditGroupId,
  type AuditVerdict,
  type DesignAuditPlanInput,
} from '../src/audit/planner.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { checkScopeOf, widthInRange } from '../src/audit/check-scope.js';

type Mutation =
  | 'none'
  | 'drop-evidence'
  | 'remove-durable-reference'
  | 'unknown-evidence-reference'
  | 'cross-target-evidence'
  | 'cant-tell'
  | 'interaction-without-phase'
  | 'failed-evidence'
  | 'not-applicable-cites-failed'
  | 'not-applicable-cites-inapplicable'
  | 'interaction-before-only'
  | 'after-phase-route-transition'
  | 'static-route-mismatch'
  | 'superseded-failure';

interface BenchmarkCase {
  id: string;
  group: AuditGroupId;
  checkId: string;
  /** The target whose slot is judged; defaults to the 1440px 'primary' target. */
  targetId?: string;
  submittedVerdict: AuditVerdict;
  expectedVerdict: AuditVerdict;
  expectedContractValid: boolean;
  mutation: Mutation;
  remediation?: string;
}

interface BenchmarkCorpus {
  schema: string;
  description: string;
  cases: BenchmarkCase[];
}

export interface AuditContractBenchmarkReport {
  schema: string;
  cases: number;
  legacy: { correct: number; accuracy: number; falsePasses: number };
  validated: {
    correct: number;
    accuracy: number;
    falsePasses: number;
    contractStatusCorrect: number;
    contractStatusAccuracy: number;
  };
  improvement: {
    accuracyPercentagePoints: number;
    falsePassesEliminated: number;
    correctedCases: string[];
  };
  details: Array<{
    id: string;
    expected: AuditVerdict;
    submitted: AuditVerdict;
    normalized: AuditVerdict;
    expectedContractValid: boolean;
    contractValid: boolean;
  }>;
}

const repo = CatalogRepository.load();
const corpus = JSON.parse(readFileSync(
  new URL('../evals/audit-contract-cases.json', import.meta.url),
  'utf8',
)) as BenchmarkCorpus;

function completeInput(group: AuditGroupId): ValidateDesignAuditResultInput {
  const planInput: DesignAuditPlanInput = {
    surfaces: ['global'],
    includeGroups: [group],
    includeDocumentation: false,
    locale: 'en',
  };
  const plan = planDesignAudit(planInput, repo);
  const primary: AuditTarget = {
    id: 'primary',
    surface: 'global',
    route: '/',
    viewport: { width: 1440, height: 900 },
    theme: 'light',
    buildId: 'benchmark-fixture',
  };
  // A plan with viewport-scoped checks gets the narrow and medium targets those checks name, so
  // its baseline is a complete, well-formed multi-viewport audit rather than a desktop-only one.
  const viewportScoped = plan.checks.some((check) => checkScopeOf(check.id)?.viewports);
  const targets: AuditTarget[] = viewportScoped
    ? [
        primary,
        { ...primary, id: 'narrow', viewport: { width: 375, height: 812 } },
        { ...primary, id: 'medium', viewport: { width: 768, height: 1024 } },
      ]
    : [primary];
  const evidence: AuditEvidence[] = [];
  const results: SubmittedAuditCheckResult[] = [];
  for (const target of targets) {
    for (const check of plan.checks) {
      const evidenceRefs = check.evidenceTypes.map((type) => {
        const id = evidenceIdFor(target.id, check.id, type);
        evidence.push({
          id,
          targetId: target.id,
          type,
          phase: type === 'interaction' ? 'after' : 'static',
          summary: `${check.id} ${type} benchmark evidence`,
          outcome: 'passed',
          artifactRef: `benchmark/${id}.json`,
          producer: { name: 'audit-contract-benchmark', version: '1' },
        });
        return id;
      });
      const ranges = checkScopeOf(check.id)?.viewports;
      const outOfRange = ranges && !ranges.some((range) => widthInRange(target.viewport!.width, range));
      results.push(outOfRange
        ? {
            checkId: check.id,
            targetId: target.id,
            verdict: 'NOT_APPLICABLE',
            rationale: `The criterion names another viewport than ${target.viewport!.width}px.`,
          }
        : {
            checkId: check.id,
            targetId: target.id,
            verdict: 'PASS',
            evidenceRefs,
            rationale: 'All required benchmark evidence passed.',
          });
    }
  }
  return {
    plan: planInput,
    expectedPlanHash: plan.identity.planHash,
    targets,
    evidence,
    results,
  };
}

function evidenceIdFor(targetId: string, checkId: string, type: string): string {
  return targetId === 'primary' ? `${checkId}-${type}` : `${targetId}:${checkId}-${type}`;
}

function evidenceForCheck(input: ValidateDesignAuditResultInput, targetId: string, checkId: string): AuditEvidence[] {
  const prefix = evidenceIdFor(targetId, checkId, '');
  return input.evidence.filter((item) => item.targetId === targetId && item.id.startsWith(prefix));
}

function targetResult(input: ValidateDesignAuditResultInput, caseDef: BenchmarkCase) {
  const targetId = caseDef.targetId ?? 'primary';
  const result = input.results.find((item) => item.targetId === targetId && item.checkId === caseDef.checkId);
  if (!result) throw new Error(`benchmark case '${caseDef.id}' references missing check '${caseDef.checkId}'`);
  result.verdict = caseDef.submittedVerdict;
  result.remediation = caseDef.remediation;
  if (caseDef.submittedVerdict === 'NOT_VERIFIED' || caseDef.submittedVerdict === 'NOT_APPLICABLE') {
    result.evidenceRefs = [];
    result.rationale = caseDef.submittedVerdict === 'NOT_VERIFIED'
      ? 'The required environment was unavailable.'
      : 'The referenced element is not present in this target.';
  } else {
    result.evidenceRefs = evidenceForCheck(input, targetId, caseDef.checkId).map((item) => item.id);
    result.rationale = 'All required benchmark evidence passed.';
  }
  return result;
}

function applyMutation(input: ValidateDesignAuditResultInput, caseDef: BenchmarkCase): void {
  const result = targetResult(input, caseDef);
  const evidence = evidenceForCheck(input, caseDef.targetId ?? 'primary', caseDef.checkId);
  const first = evidence[0];
  if (!first && caseDef.mutation !== 'none') throw new Error(`case '${caseDef.id}' has no evidence to mutate`);

  switch (caseDef.mutation) {
    case 'none':
      return;
    case 'drop-evidence':
      input.evidence = input.evidence.filter((item) => item.id !== first!.id);
      return;
    case 'remove-durable-reference':
      for (const item of evidence) {
        delete item.artifactRef;
        delete item.contentHash;
        delete item.location;
      }
      return;
    case 'unknown-evidence-reference':
      result.evidenceRefs = [...(result.evidenceRefs ?? []), 'missing-artifact'];
      return;
    case 'cross-target-evidence': {
      const otherTarget: AuditTarget = {
        ...input.targets[0]!,
        id: 'other',
        route: '/other',
      };
      const otherEvidence = input.evidence.map((item) => ({
        ...item,
        id: `other-${item.id}`,
        targetId: 'other',
      }));
      const otherResults = input.results.map((item) => ({
        ...item,
        targetId: 'other',
        verdict: 'PASS' as const,
        remediation: undefined,
        evidenceRefs: (item.evidenceRefs ?? []).map((id) => `other-${id}`),
        rationale: 'All required benchmark evidence passed.',
      }));
      input.targets.push(otherTarget);
      input.evidence.push(...otherEvidence);
      input.results.push(...otherResults);
      result.evidenceRefs = evidence.map((item) => `other-${item.id}`);
      return;
    }
    case 'cant-tell':
      first!.outcome = 'cant-tell';
      return;
    case 'interaction-without-phase': {
      const interaction = evidence.find((item) => item.type === 'interaction');
      if (!interaction) throw new Error(`case '${caseDef.id}' needs interaction evidence`);
      interaction.phase = 'static';
      return;
    }
    case 'failed-evidence':
      first!.outcome = 'failed';
      return;
    case 'not-applicable-cites-failed':
    case 'not-applicable-cites-inapplicable':
      for (const item of evidence) {
        item.outcome = caseDef.mutation === 'not-applicable-cites-failed' ? 'failed' : 'inapplicable';
      }
      result.evidenceRefs = evidence.map((item) => item.id);
      return;
    case 'interaction-before-only':
      for (const item of evidence) {
        if (item.type !== 'interaction') continue;
        item.phase = 'before';
        delete item.outcome;
        item.summary = 'Initial screen only; no input or outcome observed.';
      }
      return;
    case 'after-phase-route-transition':
      for (const item of evidence) {
        if (item.type === 'interaction') item.location = { route: '/confirmation', selector: 'main h1' };
      }
      return;
    case 'static-route-mismatch':
      for (const item of evidence) {
        item.phase = 'static';
        item.location = { route: '/login', selector: '#login-form' };
      }
      return;
    case 'superseded-failure': {
      first!.outcome = 'failed';
      first!.capturedAt = '2026-11-01T09:00:00Z';
      const rerun: AuditEvidence = {
        ...first!,
        id: `${first!.id}-rerun`,
        outcome: 'passed',
        summary: `${caseDef.checkId} re-run after the fix`,
        artifactRef: `benchmark/${first!.id}-rerun.json`,
        capturedAt: '2026-11-01T10:00:00Z',
        supersedes: { evidenceId: first!.id, reason: 'Re-run after fixing the failure the first run found.' },
      };
      input.evidence.push(rerun);
      result.evidenceRefs = [...(result.evidenceRefs ?? []), rerun.id];
      return;
    }
  }
}

function roundRate(numerator: number, denominator: number): number {
  return Number((denominator ? numerator / denominator : 0).toFixed(4));
}

export function runAuditContractBenchmark(): AuditContractBenchmarkReport {
  const details = corpus.cases.map((caseDef) => {
    const input = completeInput(caseDef.group);
    applyMutation(input, caseDef);
    const validated = validateDesignAuditResult(input, repo);
    const normalized = validated.results.find(
      (item) => item.targetId === (caseDef.targetId ?? 'primary') && item.checkId === caseDef.checkId,
    )?.verdict;
    if (!normalized) throw new Error(`validator omitted benchmark case '${caseDef.id}'`);
    return {
      id: caseDef.id,
      expected: caseDef.expectedVerdict,
      submitted: caseDef.submittedVerdict,
      normalized,
      expectedContractValid: caseDef.expectedContractValid,
      contractValid: validated.valid,
    };
  });

  const legacyCorrect = details.filter((item) => item.submitted === item.expected).length;
  const validatedCorrect = details.filter((item) => item.normalized === item.expected).length;
  const legacyFalsePasses = details.filter((item) => item.submitted === 'PASS' && item.expected !== 'PASS').length;
  const validatedFalsePasses = details.filter((item) => item.normalized === 'PASS' && item.expected !== 'PASS').length;
  const contractStatusCorrect = details
    .filter((item) => item.contractValid === item.expectedContractValid).length;
  const correctedCases = details
    .filter((item) => item.submitted !== item.expected && item.normalized === item.expected)
    .map((item) => item.id);

  return {
    schema: corpus.schema,
    cases: details.length,
    legacy: {
      correct: legacyCorrect,
      accuracy: roundRate(legacyCorrect, details.length),
      falsePasses: legacyFalsePasses,
    },
    validated: {
      correct: validatedCorrect,
      accuracy: roundRate(validatedCorrect, details.length),
      falsePasses: validatedFalsePasses,
      contractStatusCorrect,
      contractStatusAccuracy: roundRate(contractStatusCorrect, details.length),
    },
    improvement: {
      accuracyPercentagePoints: Number((
        (roundRate(validatedCorrect, details.length) - roundRate(legacyCorrect, details.length)) * 100
      ).toFixed(2)),
      falsePassesEliminated: legacyFalsePasses - validatedFalsePasses,
      correctedCases,
    },
    details,
  };
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  const report = runAuditContractBenchmark();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.validated.accuracy <= report.legacy.accuracy || report.validated.falsePasses > 0) {
    process.exitCode = 1;
  }
}
