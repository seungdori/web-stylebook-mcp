// Issue #22: a result is only as complete as the planned scope it covers. Checks that name a
// viewport need a target in it, a single viewport is not the whole breakpoint range, and planned
// surfaces and required states count even when no target was submitted for them.
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  validateDesignAuditResult,
  type AuditTarget,
  type ValidateDesignAuditResultInput,
} from '../src/audit/evaluator.js';
import { AUDIT_CHECK_SCOPES, BREAKPOINT_BANDS } from '../src/audit/check-scope.js';
import { planDesignAudit, type DesignAuditPlanInput } from '../src/audit/planner.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { createWebStylebookServer } from '../src/server.js';
import { wellFormedAudit } from './helpers/audit-fixture.js';

const repo = CatalogRepository.load();

const desktopOnlyTarget: AuditTarget = {
  id: 'form-pristine-only', surface: 'form', route: '/profile',
  stateId: 'pristine', viewport: { width: 1440, height: 900 },
  locale: 'en', theme: 'light',
};
const layoutPlan: DesignAuditPlanInput = {
  surfaces: ['form'], includeGroups: ['layout'], includeDocumentation: false, locale: 'en',
};
const omittedPlan: DesignAuditPlanInput = {
  surfaces: ['form', 'checkout'],
  stateSurfaceIds: ['form', 'checkout'],
  includeGroups: ['behavior'],
  includeDocumentation: false,
  locale: 'en',
};
const globalLayoutPlan: DesignAuditPlanInput = {
  surfaces: ['global'], includeGroups: ['layout'], includeDocumentation: false, locale: 'en',
};

/** The reproduction script from issue #22: every check PASSes on one target, citing every evidence type. */
function issueReproduction(query: DesignAuditPlanInput, target: AuditTarget): ValidateDesignAuditResultInput {
  const plan = planDesignAudit(query, repo);
  const evidence = plan.checks.flatMap((check) => check.evidenceTypes.map((type) => ({
    id: `${check.id}-${type}`, targetId: target.id, type,
    phase: type === 'interaction' ? 'after' as const : 'static' as const,
    summary: 'Synthetic metadata fixture; not a live UI observation.',
    outcome: 'passed' as const,
    artifactRef: `artifact://audit-fixture/${check.id}/${type}`,
  })));
  const results = plan.checks.map((check) => ({
    checkId: check.id, targetId: target.id, verdict: 'PASS' as const,
    evidenceRefs: check.evidenceTypes.map((type) => `${check.id}-${type}`),
    rationale: 'Synthetic contract reproduction.',
  }));
  return { plan: query, expectedPlanHash: plan.identity.planHash, targets: [target], evidence, results };
}

const viewportTargets = (widths: number[]): AuditTarget[] => widths.map((width) => ({
  id: `home-${width}`, surface: 'global', route: '/', viewport: { width, height: 900 }, theme: 'light',
}));

const codes = (result: ReturnType<typeof validateDesignAuditResult>) => result.issues.map((entry) => entry.code);
const verdictOf = (result: ReturnType<typeof validateDesignAuditResult>, checkId: string, targetId: string) => result
  .results.find((entry) => entry.checkId === checkId && entry.targetId === targetId)?.verdict;

describe('issue #22 reproduction A — one desktop target cannot verify mobile or the whole breakpoint range', () => {
  const result = validateDesignAuditResult(issueReproduction(layoutPlan, desktopOnlyTarget), repo);

  it('turns PASS for mobile-renders-cleanly on a 1440px target into NOT_VERIFIED with a contract error', () => {
    expect(verdictOf(result, 'mobile-renders-cleanly', desktopOnlyTarget.id)).toBe('NOT_VERIFIED');
    const viewportIssue = result.issues.find((entry) => entry.code === 'TARGET_VIEWPORT_OUT_OF_RANGE');
    expect(viewportIssue).toMatchObject({ severity: 'error', checkId: 'mobile-renders-cleanly' });
    expect(viewportIssue?.message).toMatch(/≤390px.*1440px wide/);
    expect(result.valid).toBe(false);
  });

  it('keeps the desktop observation but does not report it as the whole responsive range', () => {
    expect(verdictOf(result, 'desktop-composition-holds', desktopOnlyTarget.id)).toBe('PASS');
    expect(verdictOf(result, 'no-horizontal-scroll', desktopOnlyTarget.id)).toBe('PASS');
    const range = result.coverage.scope.viewports.find((item) => item.checkId === 'no-horizontal-scroll')!;
    expect(range.status).toBe('partial');
    expect(range.ranges.map((entry) => [entry.id, entry.targetIds])).toEqual([
      ['narrow', []], ['medium', []], ['wide', [desktopOnlyTarget.id]],
    ]);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'VIEWPORT_RANGE_NOT_VERIFIED', severity: 'warning', checkId: 'no-horizontal-scroll',
    }));
  });

  it('reports partial coverage: every slot reported, but the planned scope is not covered', () => {
    expect(result.coverage).toMatchObject({
      state: 'partial',
      reportingState: 'full',
      expectedSlots: 6,
      reportedSlots: 6,
      verifiedSlots: 5,
      missingSlots: 0,
    });
    expect(result.coverage.scope.state).toBe('partial');
    expect(result.coverage.scope.viewports.map((item) => [item.checkId, item.status])).toEqual([
      ['no-horizontal-scroll', 'partial'],
      ['mobile-renders-cleanly', 'not-verified'],
      ['desktop-composition-holds', 'verified'],
    ]);
    expect(result.verdictCounts).toMatchObject({ PASS: 5, NOT_VERIFIED: 1 });
  });
});

describe('issue #22 — viewport-scoped checks', () => {
  it('a mobile target cannot PASS the desktop-only check', () => {
    const input = issueReproduction(layoutPlan, { ...desktopOnlyTarget, id: 'form-mobile', viewport: { width: 375, height: 812 } });
    const result = validateDesignAuditResult(input, repo);
    expect(verdictOf(result, 'desktop-composition-holds', 'form-mobile')).toBe('NOT_VERIFIED');
    expect(verdictOf(result, 'mobile-renders-cleanly', 'form-mobile')).toBe('PASS');
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TARGET_VIEWPORT_OUT_OF_RANGE', checkId: 'desktop-composition-holds',
    }));
    expect(result.valid).toBe(false);
  });

  it('does not place a result on a target without a viewport; it asks for the viewport instead', () => {
    const { viewport: _viewport, ...noViewport } = desktopOnlyTarget;
    const result = validateDesignAuditResult(issueReproduction(layoutPlan, noViewport), repo);
    for (const checkId of ['mobile-renders-cleanly', 'desktop-composition-holds', 'no-horizontal-scroll']) {
      expect(verdictOf(result, checkId, noViewport.id), checkId).toBe('NOT_VERIFIED');
      expect(result.issues, checkId).toContainEqual(expect.objectContaining({ code: 'TARGET_VIEWPORT_REQUIRED', checkId }));
    }
    expect(verdictOf(result, 'no-meaningful-text-clipping', noViewport.id)).toBe('PASS');
    expect(result.coverage.scope.viewports.every((item) => item.status === 'not-verified')).toBe(true);
  });

  it('accepts a full mobile, medium, and desktop matrix with NOT_APPLICABLE where a criterion names another viewport', () => {
    const input = wellFormedAudit(repo, globalLayoutPlan, viewportTargets([375, 768, 1440]));
    const result = validateDesignAuditResult(input, repo);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.coverage).toMatchObject({
      state: 'full', reportingState: 'full', expectedSlots: 18, reportedSlots: 18, verifiedSlots: 18,
    });
    expect(result.coverage.scope).toMatchObject({ basis: 'submitted-targets-only', state: 'full' });
    expect(result.coverage.scope.viewports.map((item) => [item.checkId, item.status])).toEqual([
      ['no-horizontal-scroll', 'verified'],
      ['mobile-renders-cleanly', 'verified'],
      ['desktop-composition-holds', 'verified'],
    ]);
    // an always-applicable check may be NOT_APPLICABLE when the target is outside the viewport it names
    expect(verdictOf(result, 'mobile-renders-cleanly', 'home-1440')).toBe('NOT_APPLICABLE');
    expect(verdictOf(result, 'desktop-composition-holds', 'home-375')).toBe('NOT_APPLICABLE');
    expect(verdictOf(result, 'mobile-renders-cleanly', 'home-375')).toBe('PASS');
    expect(result.verdictCounts).toMatchObject({ PASS: 14, NOT_APPLICABLE: 4, NOT_VERIFIED: 0 });
  });

  it('still rejects NOT_APPLICABLE for a viewport check on a target inside its range', () => {
    const input = wellFormedAudit(repo, globalLayoutPlan, viewportTargets([375, 768, 1440]));
    const mobile = input.results.find((entry) => entry.checkId === 'mobile-renders-cleanly' && entry.targetId === 'home-375')!;
    mobile.verdict = 'NOT_APPLICABLE';
    mobile.evidenceRefs = [];
    const result = validateDesignAuditResult(input, repo);
    expect(verdictOf(result, 'mobile-renders-cleanly', 'home-375')).toBe('NOT_VERIFIED');
    expect(codes(result)).toContain('NOT_APPLICABLE_FOR_ALWAYS_CHECK');
    expect(result.coverage.scope.viewports.find((item) => item.checkId === 'mobile-renders-cleanly')?.status).toBe('not-verified');
  });

  it('counts the breakpoint bands at their edges: 390 is narrow, 391 medium, 1439 medium, 1440 wide', () => {
    const result = validateDesignAuditResult(wellFormedAudit(repo, globalLayoutPlan, viewportTargets([390, 1439, 1440])), repo);
    const range = result.coverage.scope.viewports.find((item) => item.checkId === 'no-horizontal-scroll')!;
    expect(range.ranges.map((entry) => [entry.id, entry.targetIds])).toEqual([
      ['narrow', ['home-390']], ['medium', ['home-1439']], ['wide', ['home-1440']],
    ]);
    expect(range.status).toBe('verified');
    const narrowOnly = validateDesignAuditResult(wellFormedAudit(repo, globalLayoutPlan, viewportTargets([391, 1440])), repo);
    expect(narrowOnly.coverage.scope.viewports.find((item) => item.checkId === 'no-horizontal-scroll')?.status).toBe('partial');
    expect(narrowOnly.coverage.scope.viewports.find((item) => item.checkId === 'mobile-renders-cleanly')?.status).toBe('not-verified');
    expect(narrowOnly.coverage.state).toBe('partial');
    expect(narrowOnly.valid).toBe(true);
  });

  it('records a justified viewport exclusion with its reason instead of leaving the range open', () => {
    const input = wellFormedAudit(repo, globalLayoutPlan, viewportTargets([1440]));
    input.scopeExclusions = [
      { checkId: 'mobile-renders-cleanly', reason: 'Internal desktop-only operations console; phones are blocked by policy.' },
      { checkId: 'no-horizontal-scroll', reason: 'Internal desktop-only operations console; only wide screens are supported.' },
    ];
    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(true);
    expect(result.coverage.state).toBe('full');
    expect(result.coverage.scope.viewports.map((item) => [item.checkId, item.status])).toEqual([
      ['no-horizontal-scroll', 'excluded'],
      ['mobile-renders-cleanly', 'excluded'],
      ['desktop-composition-holds', 'verified'],
    ]);
    expect(result.coverage.scope.viewports[0]?.reason).toMatch(/desktop-only/);
  });
});

describe('issue #22 reproduction B — omitted planned surfaces and required states', () => {
  const plan = planDesignAudit(omittedPlan, repo);
  const result = validateDesignAuditResult(issueReproduction(omittedPlan, desktopOnlyTarget), repo);

  it('reports the missing checkout surface and every required state left unverified', () => {
    expect(plan.stateCoverage.map((surface) => [surface.surfaceId, surface.required.length])).toEqual([
      ['checkout', 5], ['form', 5],
    ]);
    expect(result.coverage).toMatchObject({
      state: 'partial', reportingState: 'full', expectedSlots: 4, reportedSlots: 4, verifiedSlots: 4,
    });
    expect(result.coverage.scope).toMatchObject({
      basis: 'planned-scope',
      state: 'partial',
      surfaces: { planned: ['checkout', 'form'], verified: ['form'], excluded: [], notVerified: ['checkout'] },
      states: { required: 10, verified: 1, excluded: 0, notVerified: 9 },
    });
    expect(result.coverage.scope.states.items.find((item) => item.stateId === 'pristine'))
      .toMatchObject({ surfaceId: 'form', status: 'verified', targetIds: [desktopOnlyTarget.id] });
    expect(result.issues.map((entry) => [entry.code, entry.severity])).toEqual([
      ['PLANNED_SURFACE_NOT_VERIFIED', 'warning'],
      ['REQUIRED_STATES_NOT_VERIFIED', 'warning'],
      ['REQUIRED_STATES_NOT_VERIFIED', 'warning'],
    ]);
    expect(result.issues[0]?.message).toContain("'checkout'");
    expect(result.issues[2]?.message).toMatch(/form-success, invalid, submission-failed, submitting/);
  });

  it('keeps the submitted slots contract-valid: the gap is reported coverage, not a broken result', () => {
    expect(result.valid).toBe(true);
    expect(result.verdictCounts.PASS).toBe(4);
  });
});

describe('issue #22 — required states and justified exclusions', () => {
  const formAndCheckoutTargets = (): AuditTarget[] => planDesignAudit(omittedPlan, repo).stateCoverage
    .flatMap((surface) => surface.required.map((state) => ({
      id: `${surface.surfaceId}-${state.id}`,
      surface: surface.surfaceId as AuditTarget['surface'],
      route: `/${surface.surfaceId}`,
      stateId: state.id,
      viewport: { width: 1440, height: 900 },
    })));

  it('is full when every planned surface and required state has a verified target', () => {
    const result = validateDesignAuditResult(wellFormedAudit(repo, omittedPlan, formAndCheckoutTargets()), repo);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.coverage.state).toBe('full');
    expect(result.coverage.scope).toMatchObject({
      state: 'full',
      surfaces: { verified: ['checkout', 'form'], notVerified: [] },
      states: { required: 10, verified: 10, excluded: 0, notVerified: 0 },
    });
  });

  it('records a justified state exclusion with its reason and still reaches full coverage', () => {
    const targets = formAndCheckoutTargets().filter((target) => target.stateId !== 'session-expired');
    const input = wellFormedAudit(repo, omittedPlan, targets);
    input.scopeExclusions = [{
      surface: 'checkout', stateId: 'session-expired',
      reason: 'Guest checkout keeps no server session, so it cannot expire.',
    }];
    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(true);
    expect(result.coverage.state).toBe('full');
    expect(result.coverage.scope.states).toMatchObject({ verified: 9, excluded: 1, notVerified: 0 });
    expect(result.coverage.scope.states.items.find((item) => item.stateId === 'session-expired'))
      .toMatchObject({ status: 'excluded', reason: 'Guest checkout keeps no server session, so it cannot expire.' });
  });

  it('excludes a whole planned surface, with its required states, only with a reason', () => {
    const targets = formAndCheckoutTargets().filter((target) => target.surface === 'form');
    const input = wellFormedAudit(repo, omittedPlan, targets);
    input.scopeExclusions = [{ surface: 'checkout', reason: 'Checkout ships in the next release and is audited there.' }];
    const result = validateDesignAuditResult(input, repo);
    expect(result.coverage.state).toBe('full');
    expect(result.coverage.scope.surfaces).toMatchObject({ verified: ['form'], excluded: ['checkout'], notVerified: [] });
    expect(result.coverage.scope.states).toMatchObject({ verified: 5, excluded: 5, notVerified: 0 });

    const silent = validateDesignAuditResult(wellFormedAudit(repo, omittedPlan, targets), repo);
    expect(silent.coverage.state).toBe('partial');
    expect(silent.coverage.scope.surfaces.notVerified).toEqual(['checkout']);
  });

  it('does not count a state whose target has no verified result', () => {
    const input = wellFormedAudit(repo, omittedPlan, formAndCheckoutTargets());
    for (const result of input.results) {
      if (result.targetId !== 'form-invalid') continue;
      result.verdict = 'NOT_VERIFIED';
      result.evidenceRefs = [];
      result.rationale = 'The validation endpoint was down during the audit.';
    }
    const result = validateDesignAuditResult(input, repo);
    expect(result.valid).toBe(true);
    expect(result.coverage.reportingState).toBe('full');
    expect(result.coverage.state).toBe('partial');
    expect(result.coverage.scope.states.items.find((item) => item.stateId === 'invalid'))
      .toMatchObject({ status: 'not-verified', targetIds: ['form-invalid'] });
  });

  it('rejects exclusions without a real reason or outside the plan', () => {
    const input = wellFormedAudit(repo, omittedPlan, formAndCheckoutTargets().slice(0, 1));
    input.scopeExclusions = [
      { surface: 'checkout', reason: 'n/a' },
      { surface: 'checkout', stateId: 'not-a-state', reason: 'This state does not exist in the plan at all.' },
      { surface: 'settings', reason: 'Settings is not part of this audit plan at all.' },
      { checkId: 'keyboard-focus-is-visible', reason: 'Keyboard focus has no viewport range to exclude.' },
      { checkId: 'mobile-renders-cleanly', reason: 'Layout checks are not in this behavior plan.' },
      { reason: 'An exclusion that names nothing in particular.' },
      { surface: 'form', checkId: 'mobile-renders-cleanly', reason: 'Mixes a surface and a check in one entry.' },
    ];
    const result = validateDesignAuditResult(input, repo);
    const invalid = result.issues.filter((entry) => entry.code === 'SCOPE_EXCLUSION_INVALID');
    expect(invalid).toHaveLength(7);
    expect(invalid.every((entry) => entry.severity === 'error')).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.coverage.scope.surfaces.excluded).toEqual([]);
  });

  it('flags repeated and unused exclusions', () => {
    const input = wellFormedAudit(repo, omittedPlan, formAndCheckoutTargets());
    const reason = 'Recorded twice by mistake in this submission.';
    input.scopeExclusions = [
      { surface: 'form', stateId: 'invalid', reason },
      { surface: 'form', stateId: 'invalid', reason },
    ];
    const result = validateDesignAuditResult(input, repo);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'SCOPE_EXCLUSION_INVALID', severity: 'error' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'SCOPE_EXCLUSION_UNUSED', severity: 'warning' }));
    expect(result.coverage.scope.states.items.find((item) => item.stateId === 'invalid')?.status).toBe('verified');
  });

  it('warns when a target names a state the plan does not list, since it covers no required state', () => {
    const input = wellFormedAudit(repo, omittedPlan, [{ ...desktopOnlyTarget, stateId: 'invalid-state' }]);
    const result = validateDesignAuditResult(input, repo);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'TARGET_STATE_NOT_IN_PLAN', severity: 'warning', targetId: desktopOnlyTarget.id,
    }));
    expect(result.coverage.scope.states.verified).toBe(0);
  });
});

describe('issue #22 — compatibility', () => {
  it('keeps a global plan on the submitted-targets-only basis and its result hash without exclusions', () => {
    const plan: DesignAuditPlanInput = { surfaces: ['global'], includeGroups: ['build'], includeDocumentation: false };
    const input = wellFormedAudit(repo, plan, viewportTargets([1440]));
    const result = validateDesignAuditResult(input, repo);
    expect(result.coverage).toMatchObject({ state: 'full', reportingState: 'full' });
    expect(result.coverage.scope).toEqual({
      basis: 'submitted-targets-only',
      state: 'full',
      surfaces: { planned: [], verified: [], excluded: [], notVerified: [] },
      states: { required: 0, verified: 0, excluded: 0, notVerified: 0, items: [] },
      viewports: [],
    });
    expect(validateDesignAuditResult({ ...input, scopeExclusions: [] }, repo).identity.resultHash)
      .toBe(result.identity.resultHash);
  });

  it('keeps scope requirements out of the plan, so plan hashes do not move', () => {
    const plan = planDesignAudit(layoutPlan, repo);
    for (const check of plan.checks) {
      expect(Object.keys(check)).not.toContain('viewports');
      expect(Object.keys(check)).not.toContain('interactionPhases');
    }
  });

  it('pins each scope requirement to the number or behavior its catalog criterion names', () => {
    const criterion = (id: string) => planDesignAudit({ includeDocumentation: true }, repo)
      .checks.find((check) => check.id === id)?.criterion;
    expect(criterion('mobile-renders-cleanly')).toContain('≤390px');
    expect(AUDIT_CHECK_SCOPES['mobile-renders-cleanly']?.viewports).toEqual([{ id: 'mobile', maxWidth: 390 }]);
    expect(criterion('desktop-composition-holds')).toContain('≥1280px');
    expect(AUDIT_CHECK_SCOPES['desktop-composition-holds']?.viewports).toEqual([{ id: 'desktop', minWidth: 1280 }]);
    expect(criterion('no-horizontal-scroll')).toMatch(/≥320px through ≥1440px/);
    expect(BREAKPOINT_BANDS.at(-1)).toEqual({ id: 'wide', minWidth: 1440 });

    const catalog = new Map(repo.policies.auditChecks.map((check) => [check.id, check]));
    for (const [id, scope] of Object.entries(AUDIT_CHECK_SCOPES)) {
      expect(catalog.has(id), id).toBe(true);
      if (scope.interactionPhases) expect(catalog.get(id)?.evidenceTypes, id).toContain('interaction');
      if (scope.viewports) expect(catalog.get(id)?.evidenceTypes, id).toContain('screenshot');
    }
  });
});

describe('issue #22 over MCP — JSON and text say the same thing', () => {
  let client: Client;
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'audit-scope-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  it('accepts scopeExclusions and renders reporting and planned-scope coverage separately', async () => {
    const input = issueReproduction(omittedPlan, desktopOnlyTarget);
    const r = await client.callTool({
      name: 'validate_design_audit_result',
      arguments: {
        ...input,
        scopeExclusions: [{ surface: 'form', stateId: 'submitting', reason: 'The form submits synchronously; there is no pending state.' }],
      } as unknown as Record<string, unknown>,
    });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as ReturnType<typeof validateDesignAuditResult>;
    expect(sc.coverage).toMatchObject({ state: 'partial', reportingState: 'full' });
    expect(sc.coverage.scope.states).toMatchObject({ verified: 1, excluded: 1, notVerified: 8 });
    const text = (r.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')?.text ?? '';
    expect(text).toContain('Coverage: partial (reporting full; planned scope partial) — reported 4/4; verified 4; missing 0');
    expect(text).toContain('Planned scope (planned surfaces and states): partial');
    expect(text).toContain('- Planned surfaces: verified form; excluded none; not verified checkout');
    expect(text).toMatch(/- Required states: verified 1\/10; excluded 1; not verified 8 \(checkout\/checkout-success, .*form\/submission-failed\)/);
    expect(text).toContain('PLANNED_SURFACE_NOT_VERIFIED');
  });

  it('localizes the scope lines and lists the unverified viewport ranges', async () => {
    const input = issueReproduction({ ...layoutPlan, locale: 'ko' }, desktopOnlyTarget);
    const r = await client.callTool({
      name: 'validate_design_audit_result',
      arguments: input as unknown as Record<string, unknown>,
    });
    const text = (r.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')?.text ?? '';
    expect(text).toContain('범위: partial (보고 full; 계획 범위 partial)');
    expect(text).toContain('계획 범위 (계획한 surface·상태 기준): partial');
    expect(text).toContain('- Viewport 범위: no-horizontal-scroll partial (누락 narrow ≤390px, medium 391–1439px); mobile-renders-cleanly not-verified (누락 mobile ≤390px); desktop-composition-holds verified');
    expect(text).toContain('TARGET_VIEWPORT_OUT_OF_RANGE');
  });
});
