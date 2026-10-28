import { stableHashOf } from '../catalog/stable-hash.js';
import { FOUNDATIONS } from '../foundations/catalog.js';
import { planDesignImprovement } from '../foundations/planner.js';
import type { FoundationPlanInput } from '../foundations/types.js';
import { IMPROVEMENT_CHECKS, improvementSubmissionSchema, type ImprovementSubmission } from './schema.js';
import { renderImprovementResult } from './render.js';
import { localizeImprovementAction } from './actions.js';

export interface ImprovementResultInput {
  plan: FoundationPlanInput;
  expectedPlanHash: string;
  submission: ImprovementSubmission;
}
export interface ImprovementIssue {
  code: string;
  kind: 'contract' | 'incomplete' | 'regression';
  targetId?: string;
  message: string;
  nextAction: string;
}
export class ImprovementResultError extends Error {
  constructor(message: string) { super(message); this.name = 'ImprovementResultError'; }
}

/** Offline consistency and completion checks. Never opens artifacts or executes host commands. */
export function evaluateDesignImprovement(input: ImprovementResultInput) {
  const parsed = improvementSubmissionSchema.safeParse(input.submission);
  if (!parsed.success) throw new ImprovementResultError(parsed.error.message);
  const submission = parsed.data;
  const plan = planDesignImprovement(input.plan);
  const targets = plan.workflow.context?.targets ?? [];
  const targetIds = new Set(targets.map((target) => target.id));
  const issues: ImprovementIssue[] = [];
  const issue = (code: string, kind: ImprovementIssue['kind'], message: string, nextAction: string, targetId?: string) => {
    issues.push({ code, kind, ...(targetId ? { targetId } : {}), message, nextAction: localizeImprovementAction(code, nextAction, plan.query.locale) });
  };
  if (!plan.workflow.context) issue('CONTEXT_REQUIRED', 'incomplete', 'No execution context was recorded.', 'Record the user task and target conditions in get_design_improvement_plan.context.');
  if (plan.workflow.planHash !== input.expectedPlanHash) issue('PLAN_MISMATCH', 'contract', 'The submitted plan does not match expectedPlanHash.', 'Use workflow.planHash from the exact plan query; preserve the agreed target matrix.');

  const unique = (values: string[], label: string, targetId?: string) => {
    if (new Set(values).size !== values.length) issue('DUPLICATE_ID', 'contract', `Duplicate ${label}.`, `Give each ${label} a unique identity and remove duplicate references.`, targetId);
  };
  unique(submission.captures.map((capture) => capture.id), 'capture id');
  unique(submission.changes.map((change) => change.id), 'change id');
  unique(submission.checks.map((check) => check.id), 'check id');
  unique(submission.outcomes.map((outcome) => outcome.targetId), 'outcome target');
  const captures = new Map(submission.captures.map((capture) => [capture.id, capture]));
  const changes = new Map(submission.changes.map((change) => [change.id, change]));
  const outcomes = new Map(submission.outcomes.map((outcome) => [outcome.targetId, outcome]));
  const unknownTarget = (targetId: string, label: string) => {
    if (!targetIds.has(targetId)) issue('UNKNOWN_TARGET', 'contract', `${label} refers to unplanned target ${targetId}.`, 'Use the planned target ids; do not replace omitted targets with easier ones.');
  };
  for (const capture of submission.captures) unknownTarget(capture.targetId, `Capture ${capture.id}`);
  for (const outcome of submission.outcomes) unknownTarget(outcome.targetId, 'Outcome');
  for (const change of submission.changes) {
    unique(change.targetIds, `targets for ${change.id}`);
    unique(change.foundationIds, `foundations for ${change.id}`);
    for (const targetId of change.targetIds) unknownTarget(targetId, `Change ${change.id}`);
    if (change.foundationIds.some((id) => !FOUNDATIONS.some((foundation) => foundation.id === id))) {
      issue('UNKNOWN_FOUNDATION', 'contract', `Change ${change.id} cites unknown design knowledge.`, 'Retrieve a real foundation and connect its conditional remedy to the observed obstacle.');
    }
    for (const targetId of change.targetIds) {
      if (change.status === 'proposed') issue('PROPOSAL_ONLY', 'incomplete', `Change ${change.id} is only proposed.`, `Implement ${change.id} in the actual source and capture fresh results, or report the concrete blocker.`, targetId);
      if (change.status === 'implemented' && (!change.files.length || !change.diffRef)) issue('IMPLEMENTATION_EVIDENCE_MISSING', 'incomplete', `Change ${change.id} lacks changed files or a diff.`, `Attach the actual changed files and diff for ${change.id}; a plan or mock image is not an implementation.`, targetId);
    }
  }

  let matchedPairs = 0;
  for (const target of targets) {
    const outcome = outcomes.get(target.id);
    if (!outcome) {
      issue('OUTCOME_MISSING', 'incomplete', `No outcome for ${target.id}.`, 'Compare and report this planned target, including an honest unverified outcome if blocked.', target.id);
      continue;
    }
    unique(outcome.changeIds, 'outcome change references', target.id);
    const referencedChanges = outcome.changeIds.map((id) => changes.get(id));
    if (referencedChanges.some((change) => !change || !change.targetIds.includes(target.id))) issue('CHANGE_TARGET_MISMATCH', 'contract', 'Outcome references missing changes or changes for a different target.', 'Link this outcome only to changes that affect this target.', target.id);
    const applicable = submission.changes.filter((change) => change.targetIds.includes(target.id));
    if (applicable.some((change) => !outcome.changeIds.includes(change.id))) issue('CHANGE_UNREPORTED', 'incomplete', 'A change affecting this target was omitted from its outcome.', 'Report every implemented, proposed or reverted change affecting this target.', target.id);
    const implemented = referencedChanges.filter((change) => change?.status === 'implemented' && change.diffRef && change.files.length);
    if (outcome.outcome === 'improved' && !implemented.length) issue('IMPROVEMENT_WITHOUT_IMPLEMENTATION', 'contract', 'An improvement is claimed without an implemented change.', 'Implement a justified change, or report unchanged/not-verified; do not count a review as improvement.', target.id);
    if (outcome.outcome === 'regressed') issue('REGRESSION', 'regression', outcome.summary, 'Repair or revert the regression, then recapture and rerun the affected checks.', target.id);
    if (outcome.outcome === 'not-verified') issue('OUTCOME_UNVERIFIED', 'incomplete', outcome.summary, 'Collect the missing evidence or keep this target explicitly incomplete.', target.id);

    const before = outcome.beforeCaptureId ? captures.get(outcome.beforeCaptureId) : undefined;
    const after = outcome.afterCaptureId ? captures.get(outcome.afterCaptureId) : undefined;
    let pairMatches = true;
    for (const [phase, capture] of [['before', before], ['after', after]] as const) {
      if (!capture) {
        issue('CAPTURE_MISSING', 'incomplete', `Missing ${phase} capture.`, phase === 'before' ? 'Recover and capture an immutable baseline; never synthesize a before image from the edited UI.' : 'Render and capture the actual edited UI.', target.id);
        pairMatches = false;
      } else if (capture.targetId !== target.id || capture.phase !== phase) {
        issue('CAPTURE_TARGET_MISMATCH', 'contract', `The ${phase} capture belongs to another target or phase.`, 'Reference the correct before/after pair for this target.', target.id);
        pairMatches = false;
      } else {
        if (stableHashOf(capture.conditions) !== stableHashOf(target.conditions)) {
          issue('CONDITIONS_MISMATCH', 'incomplete', `The ${phase} capture differs from the recorded comparison conditions.`, 'Match viewport, theme, locale, state, input data/clock, semantic scroll anchor, zoom and device scale before comparing.', target.id);
          pairMatches = false;
        }
        if (!capture.fontsReady) {
          issue('FONTS_NOT_READY', 'incomplete', `The ${phase} capture was taken before fonts were ready.`, 'Wait for the intended fonts and recapture; do not compare a fallback font to the intended font.', target.id);
          pairMatches = false;
        }
      }
    }
    if (before && after && before.screenshotRef === after.screenshotRef) {
      issue('REUSED_SCREENSHOT', 'contract', 'Before and after point to the same screenshot artifact.', 'Keep separate immutable before and fresh after artifacts, even when the UI is unchanged.', target.id);
      pairMatches = false;
    }
    if (before && after && outcome.outcome === 'improved' && before.sourceRef === after.sourceRef) {
      issue('SOURCE_NOT_DISTINGUISHED', 'contract', 'The claimed improvement uses the same source identity on both captures.', 'Record the original and edited source/build snapshots, including uncommitted content hashes when needed.', target.id);
      pairMatches = false;
    }
    if (pairMatches) matchedPairs++;
  }

  const checks = submission.checks.map((check) => {
    const normalized = { ...check };
    unknownTarget(check.targetId, `Check ${check.id}`);
    unique(check.captureIds, `capture references for ${check.id}`, check.targetId);
    const outcome = outcomes.get(check.targetId);
    const invalidReferences = check.captureIds.some((id) => !captures.has(id) || captures.get(id)!.targetId !== check.targetId);
    if (invalidReferences) issue('CHECK_CAPTURE_MISMATCH', 'contract', `Check ${check.id} references unknown or unrelated captures.`, 'Bind verification to the actual after capture and the before capture for a visual comparison.', check.targetId);
    if (check.verdict === 'pass' || check.verdict === 'not-applicable') {
      const afterLinked = outcome?.afterCaptureId && check.captureIds.includes(outcome.afterCaptureId);
      const beforeLinked = outcome?.beforeCaptureId && check.captureIds.includes(outcome.beforeCaptureId);
      const visualPair = check.kind !== 'visual' || beforeLinked;
      const observedSteps = !['behavior', 'accessibility'].includes(check.kind) || check.verdict === 'not-applicable' || Boolean(check.steps?.length);
      if (!check.evidenceRefs.length || !afterLinked || !visualPair || !observedSteps || invalidReferences) {
        normalized.verdict = 'not-verified';
        issue('CHECK_EVIDENCE_MISSING', 'incomplete', `Check ${check.id} lacks durable evidence, the compared capture(s), or observed interaction steps.`, `Run and record the ${check.kind} check on the edited target; keep unsupported claims not-verified.`, check.targetId);
      }
      if (check.verdict === 'not-applicable' && !['behavior', 'build'].includes(check.kind)) {
        normalized.verdict = 'not-verified';
        issue('CHECK_NOT_SKIPPABLE', 'contract', `${check.kind} cannot be skipped for a UI improvement.`, 'Inspect visual quality, content preservation and affected accessibility; a static UI still needs those checks.', check.targetId);
      }
    }
    if (check.verdict === 'fail') issue('CHECK_FAILED', 'regression', `${check.id}: ${check.summary}`, 'Fix or revert the failing change and collect a fresh passing check.', check.targetId);
    if (check.verdict === 'not-verified') issue('CHECK_UNVERIFIED', 'incomplete', `${check.id}: ${check.summary}`, `Complete the ${check.kind} verification or report its concrete blocker.`, check.targetId);
    return normalized;
  });
  for (const target of targets) for (const kind of IMPROVEMENT_CHECKS) {
    if (!checks.some((check) => check.targetId === target.id && check.kind === kind)) issue('CHECK_MISSING', 'incomplete', `Missing ${kind} verification.`, `Observe and record the ${kind} result for this target.`, target.id);
  }

  const normalizedOutcomes = submission.outcomes.map((outcome) => ({
    ...outcome,
    outcome: outcome.outcome === 'regressed' ? 'regressed' as const : issues.some((item) => !item.targetId || item.targetId === outcome.targetId) ? 'not-verified' as const : outcome.outcome,
  }));
  const implementedChanges = submission.changes.filter((change) => change.status === 'implemented');
  const hasImprovement = normalizedOutcomes.some((outcome) => outcome.outcome === 'improved');
  const noChange = !implementedChanges.length && !submission.changes.some((change) => change.status === 'proposed') && normalizedOutcomes.length === targets.length && normalizedOutcomes.every((outcome) => outcome.outcome === 'unchanged');
  if (!issues.length && !hasImprovement && !noChange) issue('NO_VERIFIED_IMPROVEMENT', 'incomplete', 'Changes were made but no improvement was verified.', 'Reassess the remedy and its evidence; repair or revert unnecessary changes rather than inventing an improvement.');
  const status = issues.length ? 'needs-work' as const : noChange ? 'no-change' as const : 'complete' as const;
  return {
    schema: 'webstylebook.improvement-result.v1' as const,
    identity: { planHash: plan.workflow.planHash, resultHash: stableHashOf({ planHash: plan.workflow.planHash, expectedPlanHash: input.expectedPlanHash, submission }) },
    valid: !issues.some((item) => item.kind === 'contract'),
    completion: { status, ready: status !== 'needs-work' },
    coverage: { plannedTargets: targets.length, reportedTargets: outcomes.size, matchedPairs, implementedChanges: implementedChanges.length, requiredChecksPerTarget: [...IMPROVEMENT_CHECKS] },
    checks,
    outcomes: normalizedOutcomes,
    issues,
    nextActions: [...new Set(issues.map((item) => `${item.targetId ? `[${item.targetId}] ` : ''}${item.nextAction}`))],
  };
}

export function validateDesignImprovementResult(input: ImprovementResultInput) {
  const result = evaluateDesignImprovement(input);
  return { ...result, reportMarkdown: renderImprovementResult(input, result) };
}

export type ImprovementResult = ReturnType<typeof evaluateDesignImprovement>;
