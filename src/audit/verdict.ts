import type { AuditApplicability, AuditSeverity } from '../types.js';
import type { AuditVerdict } from './planner.js';

export type ViewportFit = 'unscoped' | 'in-range' | 'out-of-range' | 'unknown';

/** Independent evidence and scope dimensions, resolved once after collecting contract issues. */
export interface AuditVerdictState {
  submitted: AuditVerdict;
  severity: AuditSeverity;
  applicability: AuditApplicability;
  viewport: ViewportFit;
  evidence: 'complete' | 'incomplete';
  observation: 'failed' | 'indeterminate' | 'passed' | 'none';
}

export function isAssertedVerdict(verdict: AuditVerdict): boolean {
  return verdict === 'PASS' || verdict === 'FIX_NOW' || verdict === 'RISK';
}

/**
 * Verdict precedence, highest first:
 * 1. An asserted result outside its known scope cannot verify the check.
 * 2. A failed observation contradicting PASS remains visible, even with incomplete evidence.
 * 3. Indeterminate observations cannot establish PASS; incomplete support cannot establish an asserted verdict.
 * 4. NOT_APPLICABLE must be allowed by scope and must not cite an observed outcome.
 * Otherwise keep the submitted verdict. Contract validity is calculated separately.
 */
export function resolveAuditVerdict(state: AuditVerdictState): AuditVerdict {
  const asserted = isAssertedVerdict(state.submitted);
  if (asserted && (state.viewport === 'out-of-range' || state.viewport === 'unknown')) {
    return 'NOT_VERIFIED';
  }
  if (state.submitted === 'PASS' && state.observation === 'failed') {
    return state.severity === 'minor' ? 'RISK' : 'FIX_NOW';
  }
  if (state.submitted === 'PASS' && state.observation === 'indeterminate') {
    return 'NOT_VERIFIED';
  }
  if (asserted && state.evidence === 'incomplete') return 'NOT_VERIFIED';
  if (state.submitted === 'NOT_APPLICABLE') {
    const alwaysApplies = state.applicability === 'always' && state.viewport !== 'out-of-range';
    if (alwaysApplies || state.observation !== 'none') return 'NOT_VERIFIED';
  }
  return state.submitted;
}
