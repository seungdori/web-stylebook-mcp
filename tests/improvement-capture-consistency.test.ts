import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { planDesignImprovement } from '../src/foundations/planner.js';
import { validateDesignImprovementResult, type ImprovementResultInput } from '../src/improvement/evaluator.js';

const example = JSON.parse(readFileSync(new URL('../skill/web-stylebook-design/references/example-result.json', import.meta.url), 'utf8')) as Omit<ImprovementResultInput, 'expectedPlanHash'>;
const input = (): ImprovementResultInput => {
  const value = structuredClone(example);
  return { ...value, expectedPlanHash: planDesignImprovement(value.plan).workflow.planHash };
};
const targetChecks = (result: ReturnType<typeof validateDesignImprovementResult>, targetId: string) =>
  Object.fromEntries(result.checks.filter((check) => check.targetId === targetId).map((check) => [check.kind, check.verdict]));

describe('UI improvement evidence belongs to the compared captures', () => {
  it('rejects one screenshot pair reused for a mobile form and a desktop table', () => {
    const value = input();
    value.submission.captures[2]!.screenshotRef = value.submission.captures[0]!.screenshotRef;
    value.submission.captures[3]!.screenshotRef = value.submission.captures[1]!.screenshotRef;
    const result = validateDesignImprovementResult(value);
    expect(result.valid).toBe(false);
    expect(result.completion.status).toBe('needs-work');
    expect(result.coverage.matchedPairs).toBe(0);
    expect(result.issues.filter((issue) => issue.code === 'CAPTURE_ARTIFACT_CONFLICT').map((issue) => issue.targetId))
      .toEqual(expect.arrayContaining(['contact-mobile', 'incidents-desktop']));
    expect(result.checks.every((check) => check.verdict === 'not-verified')).toBe(true);
    expect(result.reportMarkdown).not.toContain('| pass ·');
  });

  const sharePageCaptures = (value: ImprovementResultInput) => {
    const [first, second] = value.plan.context!.targets;
    second!.route = first!.route;
    second!.conditions = structuredClone(first!.conditions);
    for (const [originalIndex, sharedIndex] of [[0, 2], [1, 3]]) {
      const shared = value.submission.captures[sharedIndex!]!;
      value.submission.captures[sharedIndex!] = { ...structuredClone(value.submission.captures[originalIndex!]!), id: shared.id, targetId: shared.targetId };
    }
  };

  it('allows a whole-page capture shared by two surfaces with identical capture identities', () => {
    const value = input();
    sharePageCaptures(value);
    value.expectedPlanHash = planDesignImprovement(value.plan).workflow.planHash;
    const result = validateDesignImprovementResult(value);
    expect(result.completion.status).toBe('complete');
    expect(result.coverage.matchedPairs).toBe(2);
    expect(result.issues).toEqual([]);
  });

  it.each(['route', 'source', 'state'] as const)('rejects shared screenshots when only %s identity differs', (field) => {
    const value = input();
    sharePageCaptures(value);
    if (field === 'route') value.plan.context!.targets[1]!.route = '/different-route';
    if (field === 'source') value.submission.captures[3]!.sourceRef = 'different-build';
    if (field === 'state') {
      value.plan.context!.targets[1]!.conditions.state = 'different-state';
      value.submission.captures[2]!.conditions.state = 'different-state';
      value.submission.captures[3]!.conditions.state = 'different-state';
    }
    value.expectedPlanHash = planDesignImprovement(value.plan).workflow.planHash;
    const result = validateDesignImprovementResult(value);
    expect(result.completion.status).toBe('needs-work');
    expect(result.issues.some((issue) => issue.code === 'CAPTURE_ARTIFACT_CONFLICT')).toBe(true);
  });

  it.each(['conditions', 'fonts', 'missing', 'phase', 'reused', 'source'] as const)('does not report passing checks on an invalid after capture: %s', (reason) => {
    const value = input();
    const after = value.submission.captures[1]!;
    if (reason === 'conditions') after.conditions.viewport.width = 1000;
    if (reason === 'fonts') after.fontsReady = false;
    if (reason === 'missing') value.submission.captures.splice(1, 1);
    if (reason === 'phase') after.phase = 'before';
    if (reason === 'reused') after.screenshotRef = value.submission.captures[0]!.screenshotRef;
    if (reason === 'source') after.sourceRef = value.submission.captures[0]!.sourceRef;
    const result = validateDesignImprovementResult(value);
    expect(result.completion.status).toBe('needs-work');
    expect(targetChecks(result, 'contact-mobile')).toEqual({ visual: 'not-verified', behavior: 'not-verified', preservation: 'not-verified', accessibility: 'not-verified' });
    expect(targetChecks(result, 'incidents-desktop')).toEqual({ visual: 'pass', behavior: 'pass', preservation: 'pass', accessibility: 'pass' });
    expect(result.reportMarkdown).not.toContain('| contact-mobile | visual | pass');
  });

  it.each(['conditions', 'fonts', 'missing'] as const)('keeps valid after-only checks when the baseline is invalid: %s', (reason) => {
    const value = input();
    if (reason === 'conditions') value.submission.captures[0]!.conditions.dataKey = 'different-fixture';
    if (reason === 'fonts') value.submission.captures[0]!.fontsReady = false;
    if (reason === 'missing') value.submission.captures.splice(0, 1);
    const result = validateDesignImprovementResult(value);
    expect(result.completion.status).toBe('needs-work');
    expect(targetChecks(result, 'contact-mobile')).toEqual({ visual: 'not-verified', behavior: 'pass', preservation: 'not-verified', accessibility: 'pass' });
  });

  it('requires preservation checks to identify the original as well as the edited capture', () => {
    const value = input();
    value.submission.checks.find((check) => check.id === 'contact-mobile-preservation')!.captureIds = ['contact-mobile-after'];
    const result = validateDesignImprovementResult(value);
    expect(result.completion.status).toBe('needs-work');
    expect(targetChecks(result, 'contact-mobile').preservation).toBe('not-verified');
    expect(result.outcomes.find((outcome) => outcome.targetId === 'incidents-desktop')!.outcome).toBe('improved');
  });

  it('keeps observed failures blocking when their after capture is also invalid', () => {
    const value = input();
    value.submission.captures[1]!.fontsReady = false;
    value.submission.checks[1]!.verdict = 'fail';
    value.submission.checks[1]!.summary = 'Changing tabs loses the entered draft.';
    const result = validateDesignImprovementResult(value);
    expect(result.completion.status).toBe('needs-work');
    expect(targetChecks(result, 'contact-mobile').behavior).toBe('fail');
    expect(result.issues.some((issue) => issue.code === 'CHECK_FAILED')).toBe(true);
    expect(result.reportMarkdown).toContain('fail · Changing tabs loses the entered draft.');
  });

  it('does not count build passes or noninteractive exemptions based on an invalid after capture', () => {
    const value = input();
    value.submission.captures[1]!.conditions.zoom = 2;
    value.submission.checks[1]!.verdict = 'not-applicable';
    value.submission.checks.push({ ...value.submission.checks[1]!, id: 'build', kind: 'build', verdict: 'pass' });
    const result = validateDesignImprovementResult(value);
    expect(targetChecks(result, 'contact-mobile').behavior).toBe('not-verified');
    expect(targetChecks(result, 'contact-mobile').build).toBe('not-verified');
  });

  it.each(['en', 'ko', 'ja'] as const)('renders the same %s result for normalized and whitespace-padded target ids', (locale) => {
    const canonical = input();
    canonical.plan.locale = locale;
    canonical.expectedPlanHash = planDesignImprovement(canonical.plan).workflow.planHash;
    const padded = structuredClone(canonical);
    padded.plan.context!.targets.forEach((target) => { target.id = ` ${target.id} `; });
    expect(validateDesignImprovementResult(padded)).toEqual(validateDesignImprovementResult(canonical));
  });
});

describe('capture consistency through MCP', () => {
  let client: Client;
  let server: ReturnType<typeof createWebStylebookServer>;
  beforeAll(async () => {
    server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'capture-consistency-test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
  });
  afterAll(async () => { await client.close(); await server.close(); });

  it.each(['en', 'ko', 'ja'] as const)('exposes versioned capture requirements and consistent %s JSON/text results', async (locale) => {
    const value = input();
    value.plan.locale = locale;
    const planned = await client.callTool({ name: 'get_design_improvement_plan', arguments: value.plan as unknown as Record<string, unknown> });
    const plan = planned.structuredContent as ReturnType<typeof planDesignImprovement>;
    expect(plan.workflow.validationVersion).toBe(2);
    expect(plan.workflow.captureRequirements).toBeTruthy();
    value.submission.captures[3]!.screenshotRef = value.submission.captures[1]!.screenshotRef;
    const checked = await client.callTool({ name: 'validate_design_improvement_result', arguments: { plan: plan.query, expectedPlanHash: plan.workflow.planHash, submission: value.submission } });
    expect(checked.isError).not.toBe(true);
    const result = checked.structuredContent as ReturnType<typeof validateDesignImprovementResult>;
    expect(result.identity.validationVersion).toBe(plan.workflow.validationVersion);
    expect(result.completion.status).toBe('needs-work');
    expect(result.valid).toBe(false);
    expect(result.nextActions.join(' ')).toContain({ en: 'separate immutable screenshots', ko: '별도의 불변 스크린샷', ja: '別の不変画像' }[locale]);
    const fallback = (checked.content as Array<{ type: string; text?: string }>).find((block) => block.type === 'text')!.text!;
    expect(JSON.parse(fallback)).toEqual(result);
  });
});
