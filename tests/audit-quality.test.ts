import { describe, expect, it } from 'vitest';
import { runAuditContractBenchmark } from '../scripts/evaluate-audit-contract.js';

describe('audit result quality benchmark', () => {
  it('improves labeled verdict accuracy and removes false PASS results', () => {
    const report = runAuditContractBenchmark();

    expect(report.cases).toBe(14);
    expect(report.legacy).toEqual({ correct: 4, accuracy: 0.2857, falsePasses: 9 });
    expect(report.validated).toEqual({
      correct: 14,
      accuracy: 1,
      falsePasses: 0,
      contractStatusCorrect: 14,
      contractStatusAccuracy: 1,
    });
    expect(report.improvement.accuracyPercentagePoints).toBe(71.43);
    expect(report.improvement.falsePassesEliminated).toBe(9);
    expect(report.improvement.correctedCases).toHaveLength(10);
  });
});
