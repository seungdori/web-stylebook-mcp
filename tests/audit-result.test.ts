import { describe, expect, it } from 'vitest';
import {
  validateDesignAuditResult,
  type AuditEvidence,
  type AuditTarget,
  type SubmittedAuditCheckResult,
  type ValidateDesignAuditResultInput,
} from '../src/audit/evaluator.js';
import { planDesignAudit, type DesignAuditPlanInput } from '../src/audit/planner.js';
import { CatalogRepository } from '../src/catalog/repository.js';

const repo = CatalogRepository.load();
const planInput: DesignAuditPlanInput = {
  surfaces: ['global'],
  includeGroups: ['build'],
  includeDocumentation: false,
  locale: 'en',
};
const target: AuditTarget = {
  id: 'home-desktop',
  surface: 'global',
  route: '/',
  viewport: { width: 1440, height: 900 },
  theme: 'light',
  buildId: 'commit:abc123',
};

function completeInput(): ValidateDesignAuditResultInput {
  const plan = planDesignAudit(planInput, repo);
  const evidence: AuditEvidence[] = [];
  const results: SubmittedAuditCheckResult[] = [];
  for (const check of plan.checks) {
    const evidenceRefs: string[] = [];
    for (const type of check.evidenceTypes) {
      const id = `${check.id}-${type}`;
      evidenceRefs.push(id);
      evidence.push({
        id,
        targetId: target.id,
        type,
        phase: type === 'interaction' ? 'after' : 'static',
        summary: `${check.id} ${type} evidence`,
        outcome: 'passed',
        artifactRef: `artifacts/${id}.json`,
        producer: { name: 'fixture', version: '1' },
      });
    }
    results.push({
      checkId: check.id,
      targetId: target.id,
      verdict: 'PASS',
      evidenceRefs,
      rationale: 'Every required observation passed.',
    });
  }
  return { plan: planInput, expectedPlanHash: plan.identity.planHash, targets: [target], evidence, results };
}

describe('design audit result validator', () => {
  it('accepts a complete evidence-backed result and emits stable fingerprints', () => {
    const input = completeInput();
    const first = validateDesignAuditResult(input, repo);
    const second = validateDesignAuditResult({
      ...input,
      evidence: [...input.evidence].reverse(),
      results: [...input.results].reverse(),
    }, repo);

    expect(first.valid).toBe(true);
    expect(first.coverage).toMatchObject({
      state: 'full', expectedSlots: 5, reportedSlots: 5, verifiedSlots: 5, missingSlots: 0,
    });
    expect(first.verdictCounts.PASS).toBe(5);
    expect(first.identity.planHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.identity.evidenceBundleHash).toBe(second.identity.evidenceBundleHash);
    expect(first.identity.resultHash).toBe(second.identity.resultHash);
  });

  it('normalizes a PASS with missing evidence to NOT_VERIFIED', () => {
    const input = completeInput();
    input.evidence = input.evidence.filter((item) => item.id !== 'runtime-console-clean-interaction');

    const result = validateDesignAuditResult(input, repo);
    const runtime = result.results.find((item) => item.checkId === 'runtime-console-clean')!;
    expect(result.valid).toBe(false);
    expect(runtime.submittedVerdict).toBe('PASS');
    expect(runtime.verdict).toBe('NOT_VERIFIED');
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'EVIDENCE_REF_NOT_FOUND', 'MISSING_REQUIRED_EVIDENCE',
    ]));
  });

  it('rejects narrative-only and phase-less interaction evidence as non-durable', () => {
    const input = completeInput();
    input.evidence = input.evidence.map((item) => {
      if (item.id === 'lint-passes-command') {
        const { artifactRef: _artifactRef, ...rest } = item;
        return rest;
      }
      if (item.id === 'runtime-console-clean-interaction') return { ...item, phase: 'static' as const };
      return item;
    });

    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'EVIDENCE_NOT_DURABLE', 'INTERACTION_PHASE_REQUIRED', 'EVIDENCE_REF_INVALID',
    ]));
    expect(result.results.find((item) => item.checkId === 'lint-passes')?.verdict)
      .toBe('NOT_VERIFIED');
    expect(result.results.find((item) => item.checkId === 'runtime-console-clean')?.verdict)
      .toBe('NOT_VERIFIED');
  });

  it('does not let PASS override failed deterministic evidence', () => {
    const input = completeInput();
    input.evidence = input.evidence.map((item) => item.id === 'build-succeeds-command'
      ? { ...item, outcome: 'failed' as const }
      : item);
    input.results = input.results.map((item) => item.checkId === 'build-succeeds'
      ? { ...item, remediation: 'Fix the build error and collect a fresh command artifact.' }
      : item);

    const result = validateDesignAuditResult(input, repo);
    const build = result.results.find((item) => item.checkId === 'build-succeeds')!;
    expect(build.verdict).toBe('FIX_NOW');
    expect(result.issues.map((entry) => entry.code)).toContain('PASS_CONTRADICTS_FAILED_EVIDENCE');
  });

  it('keeps an evidenced FIX_NOW visible but invalidates a missing remediation', () => {
    const input = completeInput();
    input.results = input.results.map((item) => item.checkId === 'build-succeeds'
      ? { ...item, verdict: 'FIX_NOW' as const }
      : item);

    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(false);
    expect(result.results.find((item) => item.checkId === 'build-succeeds')?.verdict)
      .toBe('FIX_NOW');
    expect(result.issues.map((entry) => entry.code)).toContain('FIX_NOW_REMEDIATION_REQUIRED');
  });

  it('treats an explicit NOT_VERIFIED as an honest, contract-valid result', () => {
    const input = completeInput();
    input.results = input.results.map((item) => item.checkId === 'runtime-console-clean'
      ? {
          checkId: item.checkId,
          targetId: item.targetId,
          verdict: 'NOT_VERIFIED' as const,
          rationale: 'The browser console was unavailable in this environment.',
        }
      : item);

    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(true);
    expect(result.coverage.state).toBe('full');
    expect(result.coverage.verifiedSlots).toBe(4);
    expect(result.verdictCounts.NOT_VERIFIED).toBe(1);
  });

  it('synthesizes missing slots instead of treating an incomplete report as clean', () => {
    const input = completeInput();
    input.results = input.results.slice(0, 1);

    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(false);
    expect(result.coverage).toMatchObject({ state: 'partial', reportedSlots: 1, missingSlots: 4 });
    expect(result.results.filter((item) => item.synthesized)).toHaveLength(4);
    expect(result.verdictCounts.NOT_VERIFIED).toBe(4);
  });

  it('rejects NOT_APPLICABLE for an always-applicable check', () => {
    const input = completeInput();
    input.results = input.results.map((item) => item.checkId === 'lint-passes'
      ? {
          checkId: item.checkId,
          targetId: item.targetId,
          verdict: 'NOT_APPLICABLE' as const,
          rationale: 'Skipped.',
        }
      : item);

    const result = validateDesignAuditResult(input, repo);
    const lint = result.results.find((item) => item.checkId === 'lint-passes')!;
    expect(lint.verdict).toBe('NOT_VERIFIED');
    expect(result.issues.map((entry) => entry.code)).toContain('NOT_APPLICABLE_FOR_ALWAYS_CHECK');
  });

  it('detects stale plan identity before comparing results', () => {
    const input = completeInput();
    input.expectedPlanHash = `sha256:${'0'.repeat(64)}`;
    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toContain('PLAN_HASH_MISMATCH');
  });
});
