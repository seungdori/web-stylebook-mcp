// #20 problem B: each selected principle's verify sentences become plan checks with the evidence method they need.
import { describe, expect, it } from 'vitest';
import { planDesignAudit } from '../src/audit/planner.js';
import { validateDesignAuditResult, type AuditEvidence } from '../src/audit/evaluator.js';
import { DESIGN_VERIFY_METHODS, UX_VERIFY_METHODS } from '../src/audit/principle-verify.js';
import { CatalogRepository } from '../src/catalog/repository.js';

const repo = CatalogRepository.load();
const base = { includeGroups: ['principles' as const], surfaces: ['navigation' as const], locale: 'ko' as const };
const META = ['design-principles-produce-decisions', 'ux-principles-keep-evidence-labels', 'principle-checks-are-observed', 'principles-respect-safety-boundaries'];

describe('#20 B: principle verify sentences are plan checks', () => {
  it('adds one check per Hick\'s law verify sentence beside the general principle checks (reproduction B)', () => {
    const plain = planDesignAudit(base, repo);
    const hick = planDesignAudit({ ...base, uxPrincipleIds: ['hicks-law'] }, repo);
    expect(plain.checks.map((check) => check.id)).toEqual(META);
    expect(hick.checks.map((check) => check.id)).toEqual([...META, 'principle-ux-hicks-law-verify-1', 'principle-ux-hicks-law-verify-2']);
    expect(hick.principles.ux[0]!.checkIds).toEqual(['principle-ux-hicks-law-verify-1', 'principle-ux-hicks-law-verify-2']);
    expect(hick.coverage.principleChecks).toBe(2);
    expect(plain.coverage).not.toHaveProperty('principleChecks');

    const [timing, priority] = hick.checks.slice(4);
    expect(timing).toMatchObject({
      groupId: 'principles', severity: 'minor', applicability: 'when-present', automation: 'manual',
      evidenceTypes: ['manual'], evidenceMethods: ['participant', 'analytics'],
      source: { kind: 'principle', principle: 'ux', principleId: 'hicks-law', verifyIndex: 0, method: 'participant' },
    });
    expect(timing!.criterion).toMatch(/^힉의 법칙: 첫 의미 있는 선택까지 걸리는 시간/);
    expect(timing!.criterion).toMatch(/NOT_VERIFIED로 두세요/);
    expect(priority).toMatchObject({ evidenceMethods: ['agent-review', 'participant'], source: { method: 'review' } });
  });

  it('adds design principle checks too, with browser evidence where static markup cannot answer', () => {
    const plan = planDesignAudit({ ...base, designPrincipleIds: ['task-sized-composition'] }, repo);
    expect(plan.checks.find((check) => check.id === 'principle-design-task-sized-composition-verify-1'))
      .toMatchObject({ evidenceTypes: ['screenshot'], evidenceMethods: ['browser'], automation: 'assisted' });
  });

  it('maps every verify sentence in the catalog, and nothing else', () => {
    const ux = [...repo.principleById.values()];
    const design = [...repo.designPrincipleById.values()];
    expect(Object.keys(UX_VERIFY_METHODS).sort()).toEqual(ux.map((principle) => principle.id).sort());
    expect(Object.keys(DESIGN_VERIFY_METHODS).sort()).toEqual(design.map((principle) => principle.id).sort());
    for (const principle of ux) expect(UX_VERIFY_METHODS[principle.id], principle.id).toHaveLength(principle.verify.length);
    for (const principle of design) expect(DESIGN_VERIFY_METHODS[principle.id], principle.id).toHaveLength(principle.verify.length);
    // Every plan with every principle builds.
    const all = planDesignAudit({ includeGroups: ['principles'], uxPrincipleIds: ux.map((p) => p.id).slice(0, 12), designPrincipleIds: design.map((p) => p.id).slice(0, 12) }, repo);
    expect(all.coverage.principleChecks).toBeGreaterThan(24);
  });
});

describe('#20 B: the evidence method decides what a principle check can claim', () => {
  const plan = { ...base, uxPrincipleIds: ['hicks-law'] };
  const targets = [{ id: 'nav', surface: 'navigation' as const }];
  const evidence = (id: string, method: AuditEvidence['method'], outcome: AuditEvidence['outcome'] = 'passed'): AuditEvidence => ({
    id, targetId: 'nav', type: 'manual', phase: 'static', summary: `${id} observation`, outcome, artifactRef: `notes/${id}.md`,
    ...(method ? { method } : {}),
  });
  const result = (checkId: string, verdict: 'PASS' | 'NOT_VERIFIED' | 'NOT_APPLICABLE', refs: string[]) => ({
    checkId, targetId: 'nav', verdict, evidenceRefs: refs, rationale: 'Checked against the stated evidence.',
  });
  const verdictOf = (validated: ReturnType<typeof validateDesignAuditResult>, id: string) =>
    validated.results.find((entry) => entry.checkId === id)!.verdict;

  it('does not let an agent\'s own run answer a participant timing check', () => {
    const validated = validateDesignAuditResult({
      plan, targets,
      evidence: [evidence('agent-timing', 'browser'), evidence('untagged', undefined)],
      results: [result('principle-ux-hicks-law-verify-1', 'PASS', ['agent-timing', 'untagged'])],
    }, repo);
    expect(validated.issues.map((entry) => entry.code)).toContain('EVIDENCE_METHOD_NOT_ACCEPTED');
    expect(verdictOf(validated, 'principle-ux-hicks-law-verify-1')).toBe('NOT_VERIFIED');
  });

  it('accepts participant data for the timing check and an agent review for the priority check', () => {
    const validated = validateDesignAuditResult({
      plan, targets,
      evidence: [evidence('session-study', 'participant'), evidence('priority-review', 'agent-review')],
      results: [
        result('principle-ux-hicks-law-verify-1', 'PASS', ['session-study']),
        result('principle-ux-hicks-law-verify-2', 'PASS', ['priority-review']),
      ],
    }, repo);
    expect(validated.issues.filter((entry) => entry.checkId?.startsWith('principle-ux-'))).toEqual([]);
    expect(verdictOf(validated, 'principle-ux-hicks-law-verify-1')).toBe('PASS');
    expect(verdictOf(validated, 'principle-ux-hicks-law-verify-2')).toBe('PASS');
  });

  it('keeps the general principle checks separate: answering them does not answer Hick\'s law', () => {
    const validated = validateDesignAuditResult({
      plan, targets,
      evidence: [evidence('meta', 'agent-review')],
      results: META.map((id) => result(id, 'PASS', ['meta'])),
    }, repo);
    expect(verdictOf(validated, 'principle-ux-hicks-law-verify-1')).toBe('NOT_VERIFIED');
    expect(validated.coverage.state).not.toBe('full');
  });

  it('accepts NOT_APPLICABLE with inapplicable evidence and an unmeasured claim left NOT_VERIFIED', () => {
    const validated = validateDesignAuditResult({
      plan, targets,
      evidence: [evidence('no-menu', 'agent-review', 'inapplicable')],
      results: [
        result('principle-ux-hicks-law-verify-1', 'NOT_VERIFIED', []),
        result('principle-ux-hicks-law-verify-2', 'NOT_APPLICABLE', ['no-menu']),
      ],
    }, repo);
    expect(validated.issues.filter((entry) => entry.checkId?.startsWith('principle-ux-'))).toEqual([]);
    expect(verdictOf(validated, 'principle-ux-hicks-law-verify-2')).toBe('NOT_APPLICABLE');
  });
});
