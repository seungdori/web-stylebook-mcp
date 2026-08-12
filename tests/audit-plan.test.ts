import { describe, expect, it } from 'vitest';
import { AuditPlanError, planDesignAudit } from '../src/audit/planner.js';
import { CatalogRepository } from '../src/catalog/repository.js';

const repo = CatalogRepository.load();

describe('design audit planner', () => {
  it('filters surface-specific and workflow-only checks without losing stable evidence metadata', () => {
    const plan = planDesignAudit({
      styleId: 'platform-core',
      surfaces: ['settings'],
      includeDocumentation: false,
      locale: 'ko',
    }, repo);

    const ids = plan.checks.map((check) => check.id);
    expect(ids).toContain('keyboard-focus-is-visible');
    expect(ids).toContain('form-errors-are-visible');
    expect(ids).not.toContain('opening-demonstrates-product');
    expect(ids).not.toContain('avoid-formulaic-opening');
    expect(plan.checks.every((check) => check.applicability !== 'workflow-only')).toBe(true);
    expect(plan.checks.every((check) => check.evidenceTypes.length > 0)).toBe(true);
    expect(plan.verdicts.map((verdict) => verdict.id)).toEqual([
      'PASS', 'FIX_NOW', 'RISK', 'NOT_APPLICABLE', 'NOT_VERIFIED',
    ]);
    expect(plan.evidenceRule).toMatch(/증거/);
    expect(plan.evidenceLegend.screenshot).toMatch(/스크린샷/);
    expect(plan.applicabilityLegend['when-present']).toMatch(/있을 때/);
    expect(plan.verificationDefaults.remediation).toMatch(/구현/);
    expect(plan.checks.every((check) => !('evidenceRequired' in check))).toBe(true);
    expect(plan.stateAtlasUnmappedSurfaces).toEqual(['settings']);
  });

  it('includes landing-only opening and headline checks only for a landing page', () => {
    const landing = planDesignAudit({ surfaces: ['landing-page'], includeDocumentation: false }, repo);
    const global = planDesignAudit({ surfaces: ['global'], includeDocumentation: false }, repo);
    const landingIds = landing.checks.map((check) => check.id);
    const globalIds = global.checks.map((check) => check.id);

    expect(landingIds).toEqual(expect.arrayContaining([
      'opening-demonstrates-product', 'headline-is-product-specific',
      'avoid-generic-saas', 'avoid-formulaic-opening', 'avoid-ai-headline-cadence',
    ]));
    expect(globalIds).not.toContain('opening-demonstrates-product');
    expect(globalIds).not.toContain('headline-is-product-specific');
  });

  it('bundles selected principle checks and compact state coverage in one call', () => {
    const plan = planDesignAudit({
      surfaces: ['form'],
      designPrincipleIds: ['explicit-labels-and-semantics'],
      uxPrincipleIds: ['cognitive-load'],
      domainSignals: ['upload'],
      locale: 'ja',
    }, repo);

    expect(plan.principles.design[0]?.verify.length).toBeGreaterThan(0);
    expect(plan.principles.ux[0]?.evidenceConfidence).toBeTruthy();
    expect(plan.stateCoverage[0]?.surfaceId).toBe('form');
    expect(plan.stateCoverage[0]?.required.length).toBeGreaterThan(0);
    expect(plan.resourceUris).toEqual(expect.arrayContaining([
      'webstylebook://design-principles/explicit-labels-and-semantics',
      'webstylebook://principles/cognitive-load',
      'webstylebook://states/form',
    ]));
  });

  it('can isolate the user-facing content audit with localized, context-sensitive criteria', () => {
    const plan = planDesignAudit({
      surfaces: ['content'],
      includeGroups: ['content'],
      includeDocumentation: false,
      locale: 'ko',
    }, repo);

    expect(plan.query.includeGroups).toEqual(['content']);
    expect(plan.checks.map((check) => check.id)).toEqual([
      'copy-uses-audience-language',
      'meaning-precedes-method',
      'copy-avoids-pseudo-precision',
      'prominent-content-supports-task',
    ]);
    expect(plan.checks[0]?.criterion).toMatch(/내부 분류.*선택적 상세/);
    expect(plan.checks[2]?.criterion).toMatch(/분모.*불확실성.*의사결정 가치/);
    expect(plan.checks[3]?.criterion).toMatch(/맥락상 유용한 것은 유지/);
  });

  it('keeps every canonical check source resolvable and represented once', () => {
    const expected = repo.policies.verification.reduce((sum, group) => sum + group.items.length, 0)
      + repo.policies.antiPatterns.length;
    expect(repo.policies.auditChecks).toHaveLength(expected);
    expect(new Set(repo.policies.auditChecks.map((check) => check.id)).size).toBe(expected);
    expect(planDesignAudit({ surfaces: ['global'] }, repo).coverage.catalogChecks).toBe(expected);
  });

  it('reports unknown linked ids distinctly', () => {
    for (const [input, kind] of [
      [{ styleId: 'platform-cor' }, 'STYLE_NOT_FOUND'],
      [{ designPrincipleIds: ['not-a-principle'] }, 'DESIGN_PRINCIPLE_NOT_FOUND'],
      [{ uxPrincipleIds: ['not-a-principle'] }, 'UX_PRINCIPLE_NOT_FOUND'],
      [{ stateSurfaceIds: ['settings'] }, 'STATE_SURFACE_NOT_FOUND'],
    ] as const) {
      try {
        planDesignAudit(input, repo);
        throw new Error('expected audit plan failure');
      } catch (error) {
        expect(error).toBeInstanceOf(AuditPlanError);
        expect((error as AuditPlanError).kind).toBe(kind);
      }
    }
  });
});
