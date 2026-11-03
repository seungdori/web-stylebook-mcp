import type {
  AuditEvidence,
  AuditTarget,
  SubmittedAuditCheckResult,
  ValidateDesignAuditResultInput,
} from '../../src/audit/evaluator.js';
import { checkScopeOf, widthInRange } from '../../src/audit/check-scope.js';
import { planDesignAudit, type DesignAuditPlanInput } from '../../src/audit/planner.js';
import type { CatalogRepository } from '../../src/catalog/repository.js';

export function evidenceId(targetId: string, checkId: string, type: string): string {
  return `${targetId}:${checkId}:${type}`;
}

/**
 * A well-formed submission: every planned check on every target whose surface it covers, with
 * passing after-phase interaction evidence and static evidence for the other types. A check whose
 * criterion names viewports gets NOT_APPLICABLE on targets outside them.
 */
export function wellFormedAudit(
  repo: CatalogRepository,
  plan: DesignAuditPlanInput,
  targets: AuditTarget[],
): ValidateDesignAuditResultInput {
  const planned = planDesignAudit(plan, repo);
  const evidence: AuditEvidence[] = [];
  const results: SubmittedAuditCheckResult[] = [];
  for (const target of targets) {
    for (const check of planned.checks) {
      if (!check.surfaceTags.includes('global') && !check.surfaceTags.includes(target.surface)) continue;
      const ranges = checkScopeOf(check.id)?.viewports;
      if (ranges && target.viewport && !ranges.some((range) => widthInRange(target.viewport!.width, range))) {
        results.push({
          checkId: check.id,
          targetId: target.id,
          verdict: 'NOT_APPLICABLE',
          rationale: `The criterion names other viewports than ${target.viewport.width}px.`,
        });
        continue;
      }
      const refs = check.evidenceTypes.map((type) => {
        const id = evidenceId(target.id, check.id, type);
        evidence.push({
          id,
          targetId: target.id,
          type,
          phase: type === 'interaction' ? 'after' : 'static',
          summary: `${check.id} ${type} fixture observation`,
          outcome: 'passed',
          artifactRef: `artifacts/${id}.json`,
          ...(target.route ? { location: { route: target.route, selector: 'main' } } : {}),
        });
        return id;
      });
      results.push({
        checkId: check.id,
        targetId: target.id,
        verdict: 'PASS',
        evidenceRefs: refs,
        rationale: 'Every required observation passed.',
      });
    }
  }
  return { plan, expectedPlanHash: planned.identity.planHash, targets, evidence, results };
}
