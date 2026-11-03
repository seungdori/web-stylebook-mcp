// What each audit check needs from the submitted target matrix before an asserted verdict
// (PASS, FIX_NOW, RISK) can count. The data lives here, beside the evaluator, and never feeds
// get_design_audit_plan, so existing plan hashes stay valid. Each entry mirrors a number or a
// behavior named in the check's catalog criterion; tests/audit-scope.test.ts pins them together.

import type { AuditEvidencePhase } from './evaluator.js';

/** An inclusive CSS-pixel width range of the target viewport. */
export interface AuditViewportRange {
  id: string;
  minWidth?: number;
  maxWidth?: number;
}

export interface AuditCheckScope {
  /**
   * Viewport ranges the criterion names. An asserted verdict needs a target whose viewport
   * width falls in one of them; the check counts as verified across its range only when every
   * range has a verified target. A target outside every range may answer NOT_APPLICABLE.
   */
  viewports?: readonly AuditViewportRange[];
  /**
   * Interaction phases whose observed outcome (passed or failed) an asserted verdict must cite:
   * a check about what happens after an action cannot rest on the starting screen alone.
   */
  interactionPhases?: readonly AuditEvidencePhase[];
}

/** Minimum length of a scope-exclusion or evidence-correction reason, in code points. */
export const AUDIT_REASON_MIN_CHARS = 12;

/** Representative bands for "every breakpoint from 320px through 1440px": not every pixel width. */
export const BREAKPOINT_BANDS: readonly AuditViewportRange[] = [
  { id: 'narrow', maxWidth: 390 },
  { id: 'medium', minWidth: 391, maxWidth: 1439 },
  { id: 'wide', minWidth: 1440 },
];

const OUTCOME_AFTER_ACTION: readonly AuditEvidencePhase[] = ['after'];

export const AUDIT_CHECK_SCOPES: Readonly<Record<string, AuditCheckScope>> = {
  // "mobile viewport (≤390px) renders cleanly without zoom"
  'mobile-renders-cleanly': { viewports: [{ id: 'mobile', maxWidth: 390 }] },
  // "desktop viewport (≥1280px) does not look stretched or empty"
  'desktop-composition-holds': { viewports: [{ id: 'desktop', minWidth: 1280 }] },
  // "no horizontal scroll on any breakpoint (≥320px through ≥1440px)"
  'no-horizontal-scroll': { viewports: BREAKPOINT_BANDS },
  // Focus visibility, honored reduced motion, surfaced form errors, and working navigation are
  // results of an action (Tab, a preference change, a submit, a click), observed afterwards.
  'keyboard-focus-is-visible': { interactionPhases: OUTCOME_AFTER_ACTION },
  'reduced-motion-is-honored': { interactionPhases: OUTCOME_AFTER_ACTION },
  'form-errors-are-visible': { interactionPhases: OUTCOME_AFTER_ACTION },
  'navigation-and-route-behavior-works': { interactionPhases: OUTCOME_AFTER_ACTION },
  'navigation-semantics-match-behavior': { interactionPhases: OUTCOME_AFTER_ACTION },
};

export function checkScopeOf(checkId: string): AuditCheckScope | undefined {
  return Object.hasOwn(AUDIT_CHECK_SCOPES, checkId) ? AUDIT_CHECK_SCOPES[checkId] : undefined;
}

export function widthInRange(width: number, range: AuditViewportRange): boolean {
  return (range.minWidth === undefined || width >= range.minWidth)
    && (range.maxWidth === undefined || width <= range.maxWidth);
}

/** '≤390px', '≥1280px', or '391–1439px'. */
export function viewportWidthLabel(range: AuditViewportRange): string {
  if (range.minWidth !== undefined && range.maxWidth !== undefined) return `${range.minWidth}–${range.maxWidth}px`;
  if (range.maxWidth !== undefined) return `≤${range.maxWidth}px`;
  if (range.minWidth !== undefined) return `≥${range.minWidth}px`;
  return 'any width';
}

/** 'narrow (≤390px)'. */
export function describeViewportRange(range: AuditViewportRange): string {
  return `${range.id} (${viewportWidthLabel(range)})`;
}

export function reasonIsTooShort(reason: string | undefined): boolean {
  return [...(reason ?? '').trim()].length < AUDIT_REASON_MIN_CHARS;
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

function splitRoute(route: string): { origin?: string; rest: string } {
  const trimmed = route.trim();
  if (!ABSOLUTE_URL.test(trimmed)) return { rest: trimmed };
  try {
    const url = new URL(trimmed);
    return { origin: url.origin, rest: `${url.pathname}${url.search}${url.hash}` };
  } catch {
    return { rest: trimmed };
  }
}

/**
 * Routes match when they are the same string. An absolute URL is compared by origin plus
 * path, query, and fragment; its origin is dropped only when the other side is a bare path.
 * Trailing slashes, queries, fragments, and letter case stay significant.
 */
export function sameRoute(a: string, b: string): boolean {
  const left = splitRoute(a);
  const right = splitRoute(b);
  if (left.origin && right.origin && left.origin !== right.origin) return false;
  return left.rest === right.rest;
}
