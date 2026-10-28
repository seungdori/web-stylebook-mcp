import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { planDesignImprovement } from '../src/foundations/planner.js';
import { validateDesignImprovementResult, type ImprovementResultInput } from '../src/improvement/evaluator.js';
import { IMPROVEMENT_WORKFLOW_URI } from '../src/improvement/workflow.js';

const example = JSON.parse(readFileSync(new URL('../skill/web-stylebook-design/references/example-result.json', import.meta.url), 'utf8')) as Omit<ImprovementResultInput, 'expectedPlanHash'>;
const input = (): ImprovementResultInput => {
  const cloned = structuredClone(example);
  return { ...cloned, expectedPlanHash: planDesignImprovement(cloned.plan).workflow.planHash };
};
const codes = (value: ImprovementResultInput) => validateDesignImprovementResult(value).issues.map((issue) => issue.code);

describe('existing-UI completion across a mobile form and a desktop table', () => {
  it('connects observed task, real-change references, matched captures, checks and report in one deterministic contract', () => {
    const value = input();
    const plan = planDesignImprovement(value.plan);
    expect(plan.workflow.defaultIntent).toBe('implement-verify-report');
    expect(plan.workflow.executor).toBe('host-agent');
    expect(plan.workflow.stages.map((stage) => stage.id)).toEqual(['capture-before', 'decide', 'implement', 'verify', 'report']);
    const result = validateDesignImprovementResult(value);
    expect(result.completion).toEqual({ status: 'complete', ready: true });
    expect(result.valid).toBe(true);
    expect(result.coverage).toMatchObject({ plannedTargets: 2, reportedTargets: 2, matchedPairs: 2, implementedChanges: 2 });
    expect(result.issues).toEqual([]);
    expect(result.reportMarkdown).toContain('contact-mobile-before.png');
    expect(result.reportMarkdown).toContain('incidents-desktop-after.png');
    expect(result.reportMarkdown).toContain('clarify-form');
    expect(result.reportMarkdown).toContain('illustrative contract fixture');
    expect(validateDesignImprovementResult(value)).toEqual(result);
  });

  it('does not turn a critique, proposal, or diff-free implementation claim into a completed improvement', () => {
    for (const status of ['proposed', 'implemented'] as const) {
      const value = input();
      value.submission.changes[0]!.status = status;
      value.submission.changes[0]!.files = [];
      delete value.submission.changes[0]!.diffRef;
      const result = validateDesignImprovementResult(value);
      expect(result.completion.ready).toBe(false);
      expect(result.outcomes[0]!.outcome).toBe('not-verified');
      expect(result.nextActions.length).toBeGreaterThan(0);
    }
    const noEdits = input();
    noEdits.submission.changes = [];
    noEdits.submission.outcomes.forEach((outcome) => { outcome.changeIds = []; });
    expect(codes(noEdits)).toContain('IMPROVEMENT_WITHOUT_IMPLEMENTATION');
  });

  it('requires genuine paired artifacts with matched data, viewport and font readiness', () => {
    for (const mutate of [
      (value: ImprovementResultInput) => { value.submission.captures.splice(0, 1); },
      (value: ImprovementResultInput) => { value.submission.captures[1]!.conditions.dataKey = 'different-input'; },
      (value: ImprovementResultInput) => { value.submission.captures[1]!.conditions.viewport.width = 1000; },
      (value: ImprovementResultInput) => { value.submission.captures[0]!.fontsReady = false; },
      (value: ImprovementResultInput) => { value.submission.captures[1]!.screenshotRef = value.submission.captures[0]!.screenshotRef; },
      (value: ImprovementResultInput) => { value.submission.captures[1]!.sourceRef = value.submission.captures[0]!.sourceRef; },
    ]) {
      const value = input(); mutate(value);
      const result = validateDesignImprovementResult(value);
      expect(result.completion).toEqual({ status: 'needs-work', ready: false });
      expect(result.coverage.matchedPairs).toBe(1);
      expect(result.outcomes[0]!.outcome).toBe('not-verified');
      expect(result.outcomes[1]!.outcome).toBe('improved');
    }
  });

  it('cannot substitute a static preservation pass for rendered and interaction verification', () => {
    const value = input();
    value.submission.checks = value.submission.checks.filter((check) => check.kind === 'preservation');
    const result = validateDesignImprovementResult(value);
    expect(result.valid).toBe(true); // honest missing work is distinct from contradictory data
    expect(result.completion.status).toBe('needs-work');
    expect(result.issues.filter((issue) => issue.code === 'CHECK_MISSING')).toHaveLength(6);
    const unsupported = input();
    unsupported.submission.checks[1]!.steps = [];
    unsupported.submission.checks[3]!.evidenceRefs = [];
    const normalized = validateDesignImprovementResult(unsupported);
    expect(normalized.checks[1]!.verdict).toBe('not-verified');
    expect(normalized.checks[3]!.verdict).toBe('not-verified');
    expect(normalized.completion.ready).toBe(false);
  });

  it('keeps failures and regressions blocking even alongside successful checks', () => {
    const value = input();
    value.submission.checks.push({ ...value.submission.checks[1]!, id: 'lost-draft', verdict: 'fail', summary: 'Input was lost on navigation.' });
    value.submission.outcomes[0]!.outcome = 'regressed';
    const result = validateDesignImprovementResult(value);
    expect(result.completion.status).toBe('needs-work');
    expect(result.outcomes[0]!.outcome).toBe('regressed');
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['REGRESSION', 'CHECK_FAILED']));
    expect(result.reportMarkdown).toContain('Input was lost');
  });

  it('rejects skipped targets, cross-target evidence, duplicates and stale plan hashes', () => {
    const missing = input(); missing.submission.outcomes.pop();
    expect(codes(missing)).toContain('OUTCOME_MISSING');
    const crossed = input(); crossed.submission.outcomes[0]!.afterCaptureId = 'incidents-desktop-after';
    expect(codes(crossed)).toContain('CAPTURE_TARGET_MISMATCH');
    const duplicate = input(); duplicate.submission.captures.push(duplicate.submission.captures[0]!);
    expect(codes(duplicate)).toContain('DUPLICATE_ID');
    const stale = input(); stale.plan.context!.targets.pop();
    const result = validateDesignImprovementResult(stale);
    expect(result.valid).toBe(false);
    expect(result.completion.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('PLAN_MISMATCH');
  });

  it('allows honest no-change without manufacturing edits, but does not reward changes with no verified gain', () => {
    const value = input();
    value.submission.changes = [];
    value.submission.outcomes.forEach((outcome) => { outcome.outcome = 'unchanged'; outcome.changeIds = []; outcome.summary = 'The existing hierarchy already supports the task; no justified change.'; });
    expect(validateDesignImprovementResult(value).completion).toEqual({ status: 'no-change', ready: true });
    const noGain = input(); noGain.submission.outcomes.forEach((outcome) => { outcome.outcome = 'unchanged'; });
    expect(codes(noGain)).toContain('NO_VERIFIED_IMPROVEMENT');
  });

  it('supports native/static preservation evidence without allowing visual or accessibility checks to be skipped', () => {
    const value = input();
    value.plan.context!.userTask = 'Read static information in a native viewer.';
    value.plan.context!.targets.forEach((target) => { target.surface = 'content'; });
    value.expectedPlanHash = planDesignImprovement(value.plan).workflow.planHash;
    value.submission.captures.forEach((capture) => { delete capture.stylesRef; capture.structureRef = '/example-evidence/native-structure.json'; });
    value.submission.checks.filter((check) => check.kind === 'behavior').forEach((check) => { check.verdict = 'not-applicable'; check.summary = 'Static read-only information surface, with no input or navigation controls.'; delete check.steps; });
    expect(validateDesignImprovementResult(value).completion.status).toBe('complete');
    value.submission.checks[0]!.verdict = 'not-applicable';
    expect(codes(value)).toContain('CHECK_NOT_SKIPPABLE');
  });

  it('keeps context-free discovery available but incomplete and bounds unsafe artifact references', () => {
    const value = input(); delete value.plan.context;
    value.expectedPlanHash = planDesignImprovement(value.plan).workflow.planHash;
    expect(codes(value)).toContain('CONTEXT_REQUIRED');
    const unsafe = input(); unsafe.submission.captures[0]!.screenshotRef = 'javascript:alert(1)';
    expect(() => validateDesignImprovementResult(unsafe)).toThrow(/file path/);
    const duplicateTarget = input(); duplicateTarget.plan.context!.targets.push(duplicateTarget.plan.context!.targets[0]!);
    expect(() => planDesignImprovement(duplicateTarget.plan)).toThrow(/unique/);
  });
});

describe('improvement workflow through the MCP protocol', () => {
  let client: Client;
  let server: ReturnType<typeof createWebStylebookServer>;
  beforeAll(async () => {
    server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'improvement-workflow-test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
  });
  afterAll(async () => { await client.close(); await server.close(); });

  it('discovers the default flow and returns the same complete result for forms and tables in all output locales', async () => {
    const manifest = JSON.parse((await client.readResource({ uri: 'webstylebook://manifest' })).contents[0]!.text as string);
    expect(manifest.improvementWorkflow).toMatchObject({ entryTool: 'get_design_improvement_plan', completionTool: 'validate_design_improvement_result', defaultIntent: 'implement-verify-report' });
    const workflow = JSON.parse((await client.readResource({ uri: IMPROVEMENT_WORKFLOW_URI })).contents[0]!.text as string);
    expect(Object.keys(workflow.localized)).toEqual(['en', 'ko', 'ja']);
    for (const locale of ['en', 'ko', 'ja'] as const) {
      const value = input(); value.plan.locale = locale;
      const planned = await client.callTool({ name: 'get_design_improvement_plan', arguments: value.plan as unknown as Record<string, unknown> });
      expect(planned.isError).not.toBe(true);
      const plan = planned.structuredContent as ReturnType<typeof planDesignImprovement>;
      const checked = await client.callTool({ name: 'validate_design_improvement_result', arguments: { plan: plan.query, expectedPlanHash: plan.workflow.planHash, submission: value.submission } });
      expect(checked.isError).not.toBe(true);
      expect(checked.structuredContent).toMatchObject({ completion: { status: 'complete', ready: true }, valid: true });
      const fallback = (checked.content as Array<{ type: string; text?: string }>).find((block) => block.type === 'text')!.text!;
      expect(JSON.parse(fallback)).toEqual(checked.structuredContent);
      const prompt = await client.getPrompt({ name: 'improve-ui', arguments: { target: 'An existing form and incident table', locale } });
      expect(prompt.messages[0]?.content.type).toBe('text');
      expect((prompt.messages[0]?.content as { text: string }).text).toContain('validate_design_improvement_result');
    }
  });
});
