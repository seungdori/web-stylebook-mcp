import { describe, expect, it } from 'vitest';
import { runAuditContractBenchmark } from '../scripts/evaluate-audit-contract.js';

describe('audit result quality benchmark', () => {
  it('improves labeled verdict accuracy and removes false PASS results', () => {
    const report = runAuditContractBenchmark();

    expect(report.cases).toBe(24);
    expect(report.legacy).toEqual({ correct: 9, accuracy: 0.375, falsePasses: 13 });
    expect(report.validated).toEqual({
      correct: 24,
      accuracy: 1,
      falsePasses: 0,
      contractStatusCorrect: 24,
      contractStatusAccuracy: 1,
    });
    expect(report.improvement.accuracyPercentagePoints).toBe(62.5);
    expect(report.improvement.falsePassesEliminated).toBe(13);
    expect(report.improvement.correctedCases).toHaveLength(15);
  });

  it('labels the scope and evidence-consistency counterexamples and their controls (#22, #23)', () => {
    const report = runAuditContractBenchmark();
    const byId = new Map(report.details.map((detail) => [detail.id, detail]));
    for (const [id, verdict, valid] of [
      ['not-applicable-cites-failed-evidence', 'NOT_VERIFIED', false],
      ['not-applicable-cites-inapplicable-evidence', 'NOT_APPLICABLE', true],
      ['before-only-interaction-pass', 'NOT_VERIFIED', false],
      ['after-phase-route-transition', 'PASS', true],
      ['static-evidence-from-another-route', 'NOT_VERIFIED', false],
      ['superseded-failure-after-fix', 'PASS', true],
      ['desktop-target-mobile-pass', 'NOT_VERIFIED', false],
      ['mobile-target-desktop-pass', 'NOT_VERIFIED', false],
      ['mobile-target-mobile-pass', 'PASS', true],
      ['desktop-target-mobile-not-applicable', 'NOT_APPLICABLE', true],
    ] as const) {
      expect(byId.get(id), id).toMatchObject({ normalized: verdict, contractValid: valid });
    }
  });
});
