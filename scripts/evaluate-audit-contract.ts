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

type Mutation =
  | 'none'
  | 'drop-evidence'
  | 'remove-durable-reference'
  | 'unknown-evidence-reference'
  | 'cross-target-evidence'
  | 'cant-tell'
  | 'interaction-without-phase'
  | 'failed-evidence';

interface BenchmarkCase {
  id: string;
  group: AuditGroupId;
  checkId: string;
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
  const target: AuditTarget = {
    id: 'primary',
    surface: 'global',
    route: '/',
    viewport: { width: 1440, height: 900 },
    theme: 'light',
    buildId: 'benchmark-fixture',
  };
  const evidence: AuditEvidence[] = [];
  const results: SubmittedAuditCheckResult[] = [];
  for (const check of plan.checks) {
    const evidenceRefs = check.evidenceTypes.map((type) => {
      const id = `${check.id}-${type}`;
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
    results.push({
      checkId: check.id,
      targetId: target.id,
      verdict: 'PASS',
      evidenceRefs,
      rationale: 'All required benchmark evidence passed.',
    });
  }
  return {
    plan: planInput,
    expectedPlanHash: plan.identity.planHash,
    targets: [target],
    evidence,
    results,
  };
}

function targetResult(input: ValidateDesignAuditResultInput, caseDef: BenchmarkCase) {
  const result = input.results.find((item) => item.targetId === 'primary' && item.checkId === caseDef.checkId);
  if (!result) throw new Error(`benchmark case '${caseDef.id}' references missing check '${caseDef.checkId}'`);
  result.verdict = caseDef.submittedVerdict;
  result.remediation = caseDef.remediation;
  if (caseDef.submittedVerdict === 'NOT_VERIFIED' || caseDef.submittedVerdict === 'NOT_APPLICABLE') {
    result.evidenceRefs = [];
    result.rationale = caseDef.submittedVerdict === 'NOT_VERIFIED'
      ? 'The required environment was unavailable.'
      : 'The referenced element is not present in this target.';
  }
  return result;
}

function evidenceForCheck(input: ValidateDesignAuditResultInput, checkId: string): AuditEvidence[] {
  return input.evidence.filter((item) => item.targetId === 'primary' && item.id.startsWith(`${checkId}-`));
}

function applyMutation(input: ValidateDesignAuditResultInput, caseDef: BenchmarkCase): void {
  const result = targetResult(input, caseDef);
  const evidence = evidenceForCheck(input, caseDef.checkId);
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
      (item) => item.targetId === 'primary' && item.checkId === caseDef.checkId,
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
