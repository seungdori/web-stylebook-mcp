// Issue #23: a verdict must agree with the outcome, phase, and route of the evidence it cites.
// The validator still never opens an artifact; it compares values already in the submission.
import { describe, expect, it } from 'vitest';
import {
  validateDesignAuditResult,
  type AuditEvidence,
  type AuditTarget,
  type SubmittedAuditCheckResult,
  type ValidateDesignAuditResultInput,
} from '../src/audit/evaluator.js';
import { sameRoute } from '../src/audit/check-scope.js';
import { planDesignAudit, type DesignAuditPlanInput } from '../src/audit/planner.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { evidenceId, wellFormedAudit } from './helpers/audit-fixture.js';

const repo = CatalogRepository.load();
const formTarget: AuditTarget = { id: 'form', surface: 'form', route: '/form' };
const behavior: DesignAuditPlanInput = {
  surfaces: ['form'], includeGroups: ['behavior'], includeDocumentation: false, locale: 'en',
};
const fidelity: DesignAuditPlanInput = {
  surfaces: ['form'], includeGroups: ['fidelity'], includeDocumentation: false, locale: 'en',
};

/** The reproduction script from issue #23. */
function run(
  query: DesignAuditPlanInput,
  target: AuditTarget,
  edit: (evidence: AuditEvidence[], results: SubmittedAuditCheckResult[]) => void,
) {
  const plan = planDesignAudit(query, repo);
  const evidence: AuditEvidence[] = plan.checks.flatMap((check) => check.evidenceTypes.map((type) => ({
    id: `${check.id}-${type}`, targetId: target.id, type,
    phase: type === 'interaction' ? 'after' as const : 'static' as const,
    summary: 'Synthetic metadata fixture; not a live UI observation.',
    outcome: 'passed' as const,
    artifactRef: `artifact://audit-fixture/${check.id}/${type}`,
  })));
  const results: SubmittedAuditCheckResult[] = plan.checks.map((check) => ({
    checkId: check.id, targetId: target.id, verdict: 'PASS' as const,
    evidenceRefs: check.evidenceTypes.map((type) => `${check.id}-${type}`),
    rationale: 'Synthetic contract reproduction.',
  }));
  edit(evidence, results);
  return validateDesignAuditResult({
    plan: query, expectedPlanHash: plan.identity.planHash, targets: [target], evidence, results,
  }, repo);
}

type Validated = ReturnType<typeof validateDesignAuditResult>;
const verdictOf = (result: Validated, checkId: string) => result.results.find((entry) => entry.checkId === checkId)?.verdict;
const errorsFor = (result: Validated, checkId: string) => result.issues
  .filter((entry) => entry.checkId === checkId && entry.severity === 'error')
  .map((entry) => entry.code);

describe('issue #23 case 1 — NOT_APPLICABLE that cites failed evidence', () => {
  const result = run(behavior, formTarget, (evidence, results) => {
    for (const item of evidence) {
      if (item.id.startsWith('form-errors-are-visible-')) item.outcome = 'failed';
    }
    results.find((item) => item.checkId === 'form-errors-are-visible')!.verdict = 'NOT_APPLICABLE';
  });

  it('flags the conflict and keeps the slot out of the verified count', () => {
    expect(verdictOf(result, 'form-errors-are-visible')).toBe('NOT_VERIFIED');
    expect(errorsFor(result, 'form-errors-are-visible')).toEqual(['NOT_APPLICABLE_CONTRADICTS_EVIDENCE']);
    expect(result.issues.find((entry) => entry.code === 'NOT_APPLICABLE_CONTRADICTS_EVIDENCE')?.message)
      .toMatch(/form-errors-are-visible-interaction' \(failed\).*supersedes/);
    expect(result.valid).toBe(false);
    expect(result.coverage).toMatchObject({ reportedSlots: 4, verifiedSlots: 3 });
    expect(result.verdictCounts).toMatchObject({ PASS: 3, NOT_APPLICABLE: 0, NOT_VERIFIED: 1 });
  });

  it('also rejects NOT_APPLICABLE that cites passed or indeterminate evidence', () => {
    const passed = run(behavior, formTarget, (_evidence, results) => {
      results.find((item) => item.checkId === 'form-errors-are-visible')!.verdict = 'NOT_APPLICABLE';
    });
    expect(verdictOf(passed, 'form-errors-are-visible')).toBe('NOT_VERIFIED');
    expect(errorsFor(passed, 'form-errors-are-visible')).toEqual(['NOT_APPLICABLE_CONTRADICTS_EVIDENCE']);

    const cantTell = run(behavior, formTarget, (evidence, results) => {
      for (const item of evidence) {
        if (item.id.startsWith('form-errors-are-visible-')) item.outcome = 'cant-tell';
      }
      results.find((item) => item.checkId === 'form-errors-are-visible')!.verdict = 'NOT_APPLICABLE';
    });
    expect(verdictOf(cantTell, 'form-errors-are-visible')).toBe('NOT_VERIFIED');
    expect(errorsFor(cantTell, 'form-errors-are-visible')).toEqual(['NOT_APPLICABLE_USES_INDETERMINATE_EVIDENCE']);
  });

  it('still accepts a when-present NOT_APPLICABLE backed by inapplicable evidence, or by a reason alone', () => {
    const inapplicable = run(behavior, formTarget, (evidence, results) => {
      for (const item of evidence) {
        if (item.id.startsWith('form-errors-are-visible-')) item.outcome = 'inapplicable';
      }
      const result = results.find((item) => item.checkId === 'form-errors-are-visible')!;
      result.verdict = 'NOT_APPLICABLE';
      result.rationale = 'The page has no form fields; the DOM query found no input.';
    });
    expect(verdictOf(inapplicable, 'form-errors-are-visible')).toBe('NOT_APPLICABLE');
    expect(inapplicable.valid).toBe(true);
    expect(inapplicable.coverage.verifiedSlots).toBe(4);

    const reasonOnly = run(behavior, formTarget, (_evidence, results) => {
      const result = results.find((item) => item.checkId === 'form-errors-are-visible')!;
      result.verdict = 'NOT_APPLICABLE';
      result.evidenceRefs = [];
      result.rationale = 'The page has no form fields.';
    });
    expect(verdictOf(reasonOnly, 'form-errors-are-visible')).toBe('NOT_APPLICABLE');
    expect(reasonOnly.valid).toBe(true);
  });
});

describe('issue #23 case 2 — behavior checks need the observed result of the action', () => {
  const beforeOnly = run(behavior, formTarget, (evidence) => {
    for (const item of evidence) {
      if (item.type !== 'interaction') continue;
      item.phase = 'before';
      delete item.outcome;
      item.summary = 'Initial screen only; no input action or outcome observed.';
    }
  });

  it('does not PASS form errors, navigation, focus, or reduced motion on before-only evidence', () => {
    for (const checkId of [
      'keyboard-focus-is-visible', 'reduced-motion-is-honored',
      'form-errors-are-visible', 'navigation-and-route-behavior-works',
    ]) {
      expect(verdictOf(beforeOnly, checkId), checkId).toBe('NOT_VERIFIED');
      expect(errorsFor(beforeOnly, checkId), checkId).toEqual(['INTERACTION_OUTCOME_NOT_OBSERVED']);
    }
    expect(beforeOnly.valid).toBe(false);
    expect(beforeOnly.coverage.verifiedSlots).toBe(0);
  });

  it('does not accept an after-phase observation that records no outcome', () => {
    const result = run(behavior, formTarget, (evidence) => {
      for (const item of evidence) if (item.type === 'interaction') delete item.outcome;
    });
    expect(verdictOf(result, 'form-errors-are-visible')).toBe('NOT_VERIFIED');
    expect(errorsFor(result, 'form-errors-are-visible')).toEqual(['INTERACTION_OUTCOME_NOT_OBSERVED']);
  });

  it('accepts a real before → input → after → recovery sequence, and a FIX_NOW observed after the action', () => {
    const steps = run(behavior, formTarget, (evidence, results) => {
      const base = evidence.find((item) => item.id === 'form-errors-are-visible-interaction')!;
      const extra: AuditEvidence[] = [
        { ...base, id: 'form-errors-before', phase: 'before', summary: 'Empty form before submit.' },
        { ...base, id: 'form-errors-input', phase: 'input', summary: 'Submitted with the email field empty.' },
        { ...base, id: 'form-errors-recovery', phase: 'recovery', summary: 'Error cleared after entering an email.' },
      ];
      evidence.push(...extra);
      results.find((item) => item.checkId === 'form-errors-are-visible')!.evidenceRefs!.push(...extra.map((item) => item.id));
    });
    expect(verdictOf(steps, 'form-errors-are-visible')).toBe('PASS');
    expect(steps.valid).toBe(true);
    expect(steps.coverage.verifiedSlots).toBe(4);

    const failing = run(behavior, formTarget, (evidence, results) => {
      evidence.find((item) => item.id === 'form-errors-are-visible-interaction')!.outcome = 'failed';
      const result = results.find((item) => item.checkId === 'form-errors-are-visible')!;
      result.verdict = 'FIX_NOW';
      result.remediation = 'Render the field error next to the email input and announce it with aria-describedby.';
    });
    expect(verdictOf(failing, 'form-errors-are-visible')).toBe('FIX_NOW');
    expect(failing.valid).toBe(true);
  });

  it('keeps static and before-phase evidence fine for checks that do not judge an action', () => {
    const input = wellFormedAudit(repo, { surfaces: ['global'], includeGroups: ['build'], includeDocumentation: false }, [
      { id: 'home', surface: 'global', route: '/' },
    ]);
    for (const item of input.evidence) if (item.type === 'interaction') item.phase = 'before';
    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(true);
    expect(result.verdictCounts.PASS).toBe(5);
  });
});

describe('issue #23 case 3 — evidence located at another route', () => {
  const checkoutTarget: AuditTarget = { id: 'checkout', surface: 'form', route: '/checkout' };
  const wrongRoute = run(fidelity, checkoutTarget, (evidence) => {
    for (const item of evidence) {
      item.phase = 'static';
      item.location = { route: '/login', selector: '#login-form' };
    }
  });

  it('rejects /login static evidence for the /checkout target, including the contrast blocker', () => {
    expect(wrongRoute.valid).toBe(false);
    expect(wrongRoute.issues.filter((entry) => entry.code === 'EVIDENCE_ROUTE_MISMATCH')).toHaveLength(9);
    expect(wrongRoute.issues.find((entry) => entry.code === 'EVIDENCE_ROUTE_MISMATCH')?.message)
      .toMatch(/'\/login', not at target route '\/checkout'/);
    expect(verdictOf(wrongRoute, 'body-text-meets-contrast')).toBe('NOT_VERIFIED');
    expect(wrongRoute.verdictCounts).toMatchObject({ PASS: 0, NOT_VERIFIED: 5 });
    expect(wrongRoute.coverage.verifiedSlots).toBe(0);
  });

  it('applies the same rule to before-phase evidence, the starting screen of an interaction', () => {
    const result = run(behavior, checkoutTarget, (evidence, results) => {
      const base = evidence.find((item) => item.id === 'navigation-and-route-behavior-works-interaction')!;
      evidence.push({ ...base, id: 'nav-before', phase: 'before', location: { route: '/login' } });
      results.find((item) => item.checkId === 'navigation-and-route-behavior-works')!.evidenceRefs!.push('nav-before');
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'EVIDENCE_ROUTE_MISMATCH', evidenceId: 'nav-before' }));
    expect(verdictOf(result, 'navigation-and-route-behavior-works')).toBe('NOT_VERIFIED');
  });

  it('allows an intended route transition: before at /checkout, after at /confirmation', () => {
    const result = run(behavior, checkoutTarget, (evidence, results) => {
      const after = evidence.find((item) => item.id === 'navigation-and-route-behavior-works-interaction')!;
      after.location = { route: '/confirmation', selector: 'main h1' };
      evidence.push({
        ...after, id: 'nav-before', phase: 'before', location: { route: '/checkout', selector: 'form button[type=submit]' },
        summary: 'Checkout before pressing Pay.',
      }, {
        ...after, id: 'nav-input', phase: 'input', location: { route: '/checkout', selector: 'form button[type=submit]' },
        summary: 'Pressed Pay.',
      });
      results.find((item) => item.checkId === 'navigation-and-route-behavior-works')!.evidenceRefs!.push('nav-before', 'nav-input');
    });
    expect(result.issues.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(verdictOf(result, 'navigation-and-route-behavior-works')).toBe('PASS');
  });

  it('leaves evidence without a route, or targets without one, as before', () => {
    const noTargetRoute = run(fidelity, { id: 'checkout', surface: 'form' }, (evidence) => {
      for (const item of evidence) item.location = { route: '/login' };
    });
    expect(noTargetRoute.issues.some((entry) => entry.code === 'EVIDENCE_ROUTE_MISMATCH')).toBe(false);
    const noEvidenceRoute = run(fidelity, checkoutTarget, (evidence) => {
      for (const item of evidence) item.location = { selector: '#checkout-form' };
    });
    expect(noEvidenceRoute.valid).toBe(true);
  });

  it('compares routes exactly, dropping only the origin of an absolute URL against a bare path', () => {
    expect(sameRoute('/checkout', '/checkout')).toBe(true);
    expect(sameRoute('/checkout', 'https://shop.test/checkout')).toBe(true);
    expect(sameRoute('https://shop.test/checkout', 'https://SHOP.test/checkout')).toBe(true);
    expect(sameRoute('https://shop.test/checkout', 'https://other.test/checkout')).toBe(false);
    expect(sameRoute('/checkout', '/checkout/')).toBe(false);
    expect(sameRoute('/checkout', '/checkout?step=2')).toBe(false);
    expect(sameRoute('/checkout', '/checkout#pay')).toBe(false);
    expect(sameRoute('/checkout', '/Checkout')).toBe(false);
  });
});

describe('issue #23 — corrections and re-runs are explicit relations', () => {
  const plan: DesignAuditPlanInput = { surfaces: ['global'], includeGroups: ['build'], includeDocumentation: false };
  const target: AuditTarget = { id: 'home', surface: 'global', route: '/' };
  const buildId = evidenceId('home', 'build-succeeds', 'command');

  function withRerun(edit?: (rerun: AuditEvidence, input: ValidateDesignAuditResultInput) => void): Validated {
    const input = wellFormedAudit(repo, plan, [target]);
    const original = input.evidence.find((item) => item.id === buildId)!;
    original.outcome = 'failed';
    original.capturedAt = '2026-11-01T09:00:00Z';
    const rerun: AuditEvidence = {
      ...original,
      id: `${buildId}:rerun`,
      outcome: 'passed',
      summary: 'Build re-run after the fix.',
      artifactRef: 'artifacts/build-rerun.json',
      capturedAt: '2026-11-01T10:00:00Z',
      supersedes: { evidenceId: buildId, reason: 'Re-run after fixing the missing import.' },
    };
    edit?.(rerun, input);
    input.evidence.push(rerun);
    input.results.find((item) => item.checkId === 'build-succeeds')!.evidenceRefs!.push(rerun.id);
    return validateDesignAuditResult(input, repo);
  }

  it('lets a re-run after a fix replace the failed baseline, which stays in the evidence bundle', () => {
    const result = withRerun();
    expect(result.valid).toBe(true);
    expect(verdictOf(result, 'build-succeeds')).toBe('PASS');
    const plain = withRerun((rerun) => { delete rerun.supersedes; });
    expect(verdictOf(plain, 'build-succeeds')).toBe('FIX_NOW');
    expect(plain.issues.map((entry) => entry.code)).toContain('PASS_CONTRADICTS_FAILED_EVIDENCE');
    expect(plain.identity.evidenceBundleHash).not.toBe(result.identity.evidenceBundleHash);
  });

  it('lets a corrected false positive turn a failed observation into a justified NOT_APPLICABLE', () => {
    const input = wellFormedAudit(repo, behavior, [formTarget]);
    const checkId = 'form-errors-are-visible';
    const cited = input.evidence.filter((item) => item.id.startsWith(`form:${checkId}:`));
    for (const item of cited) item.outcome = 'failed';
    const corrections = cited.map((item) => ({
      ...item,
      id: `${item.id}:corrected`,
      outcome: 'inapplicable' as const,
      summary: 'The flagged element is a search box, not a form; the check does not apply.',
      supersedes: { evidenceId: item.id, reason: 'False positive: the selector matched the search box.' },
    }));
    input.evidence.push(...corrections);
    const result = input.results.find((item) => item.checkId === checkId)!;
    result.verdict = 'NOT_APPLICABLE';
    result.evidenceRefs = [...cited, ...corrections].map((item) => item.id);
    const validated = validateDesignAuditResult(input, repo);
    expect(verdictOf(validated, checkId)).toBe('NOT_APPLICABLE');
    expect(errorsFor(validated, checkId)).toEqual([]);
  });

  it.each([
    ['an unknown original', (rerun: AuditEvidence) => { rerun.supersedes = { evidenceId: 'nope', reason: 'Re-run after fixing the import.' }; }],
    ['itself', (rerun: AuditEvidence) => { rerun.supersedes = { evidenceId: rerun.id, reason: 'Re-run after fixing the import.' }; }],
    ['another evidence type', (rerun: AuditEvidence) => { rerun.type = 'document'; }],
    ['a too-short reason', (rerun: AuditEvidence) => { rerun.supersedes = { evidenceId: buildId, reason: 'rerun' }; }],
    ['an earlier capture time', (rerun: AuditEvidence) => { rerun.capturedAt = '2026-11-01T08:00:00Z'; }],
  ])('rejects a supersedes link to %s and keeps the failure', (_name, edit) => {
    const result = withRerun((rerun) => edit(rerun));
    expect(result.issues.map((entry) => entry.code)).toContain('EVIDENCE_SUPERSEDES_INVALID');
    expect(result.valid).toBe(false);
    expect(verdictOf(result, 'build-succeeds')).not.toBe('PASS');
  });

  it('rejects a supersedes link to evidence of another target', () => {
    const input = wellFormedAudit(repo, plan, [target, { ...target, id: 'about', route: '/about' }]);
    const other = input.evidence.find((item) => item.id === evidenceId('about', 'build-succeeds', 'command'))!;
    other.supersedes = { evidenceId: buildId, reason: 'Wrongly links across two targets.' };
    const result = validateDesignAuditResult(input, repo);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'EVIDENCE_SUPERSEDES_INVALID', evidenceId: other.id,
    }));
  });

  it('rejects a supersedes cycle', () => {
    const input = wellFormedAudit(repo, plan, [target]);
    const [first, second] = input.evidence.filter((item) => item.type === 'command').slice(0, 2);
    const reason = 'Each claims to replace the other one.';
    first!.supersedes = { evidenceId: second!.id, reason };
    second!.supersedes = { evidenceId: first!.id, reason };
    const result = validateDesignAuditResult(input, repo);
    expect(result.issues.filter((entry) => entry.code === 'EVIDENCE_SUPERSEDES_INVALID')
      .map((entry) => entry.message)).toEqual([
      expect.stringContaining('supersedes cycle'), expect.stringContaining('supersedes cycle'),
    ]);
  });
});
