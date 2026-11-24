// #20 problem D: the method behind a check and the kind of claim behind a change decide what an improvement can claim.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planDesignImprovement } from '../src/foundations/planner.js';
import { validateDesignImprovementResult, type ImprovementResultInput } from '../src/improvement/evaluator.js';

const example = JSON.parse(readFileSync(new URL('../skills/web-stylebook-design/references/example-result.json', import.meta.url), 'utf8')) as Omit<ImprovementResultInput, 'expectedPlanHash'>;
const input = (): ImprovementResultInput => {
  const value = structuredClone(example);
  return { ...value, expectedPlanHash: planDesignImprovement(value.plan).workflow.planHash };
};
const codes = (result: ReturnType<typeof validateDesignImprovementResult>) => result.issues.map((issue) => issue.code);
const check = (value: ImprovementResultInput, id: string) => value.submission.checks.find((entry) => entry.id === id)!;
const change = (value: ImprovementResultInput, id: string) => value.submission.changes.find((entry) => entry.id === id)!;

describe('#20 D: evidence methods on improvement checks', () => {
  it('keeps the example complete, with or without methods that can show each check', () => {
    expect(validateDesignImprovementResult(input()).completion.status).toBe('complete');
    const value = input();
    for (const entry of value.submission.checks) entry.method = entry.kind === 'preservation' ? 'static' : 'browser';
    expect(validateDesignImprovementResult(value).completion.status).toBe('complete');
  });

  it.each([
    ['contact-mobile-behavior', 'static'],
    ['contact-mobile-behavior', 'agent-review'],
    ['contact-mobile-accessibility', 'agent-review'],
    ['contact-mobile-visual', 'static'],
  ] as const)('does not accept %s passed by %s', (id, method) => {
    const value = input();
    check(value, id).method = method;
    const result = validateDesignImprovementResult(value);
    expect(codes(result)).toContain('CHECK_METHOD_INSUFFICIENT');
    expect(result.checks.find((entry) => entry.id === id)!.verdict).toBe('not-verified');
    expect(result.completion.status).toBe('needs-work');
    expect(result.outcomes.find((entry) => entry.targetId === 'contact-mobile')!.outcome).toBe('not-verified');
  });

  it('localizes the next action', () => {
    const value = input();
    value.plan.locale = 'ko';
    value.expectedPlanHash = planDesignImprovement(value.plan).workflow.planHash;
    check(value, 'contact-mobile-behavior').method = 'static';
    expect(validateDesignImprovementResult(value).nextActions.join('\n')).toMatch(/정적 검사나 검토만으로는 보여 주지 못합니다/);
  });
});

describe('#20 D: claim kinds and success criteria on changes', () => {
  it('does not count a style preference alone as an improvement', () => {
    const value = input();
    change(value, 'clarify-form').claim = 'style-preference';
    const result = validateDesignImprovementResult(value);
    expect(codes(result)).toContain('STYLE_PREFERENCE_NOT_IMPROVEMENT');
    expect(result.valid).toBe(false);
  });

  it('asks a concern or hypothesis behind an improvement for its success criterion', () => {
    const value = input();
    change(value, 'clarify-form').claim = 'improvement-hypothesis';
    expect(codes(validateDesignImprovementResult(value))).toContain('SUCCESS_CRITERION_MISSING');
    change(value, 'clarify-form').successCriterion = 'At 390 px each field error appears under its field and the entered values stay after a failed submit.';
    expect(validateDesignImprovementResult(value).completion.status).toBe('complete');
  });

  it('accepts an observed defect without more fields', () => {
    const value = input();
    change(value, 'clarify-form').claim = 'observed-defect';
    change(value, 'align-table').claim = 'observed-defect';
    expect(validateDesignImprovementResult(value).completion.status).toBe('complete');
  });
});
