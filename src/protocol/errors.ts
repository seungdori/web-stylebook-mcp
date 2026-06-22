// Error model (02 §15, 04 §11). Stable error codes are public API (ADR-009).

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'STYLE_NOT_FOUND'
  | 'MOTION_NOT_FOUND'
  | 'COMPONENT_NOT_FOUND'
  | 'STATE_SURFACE_NOT_FOUND'
  | 'STATE_RECIPE_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'NO_COMPATIBLE_STYLE'
  | 'CATALOG_SCHEMA_MISMATCH'
  | 'CATALOG_INTEGRITY_ERROR'
  | 'OUTPUT_TOO_LARGE';

/** Stable error codes with one-line meanings — surfaced in the manifest resource so an
 *  agent can read the full set up front. Record<ErrorCode,…> keeps it in sync with the union. */
export const ERROR_CODES: Record<ErrorCode, string> = {
  INVALID_INPUT: 'malformed or out-of-range input',
  STYLE_NOT_FOUND: 'unknown style id (near-miss suggestions provided)',
  MOTION_NOT_FOUND: 'unknown motion id',
  COMPONENT_NOT_FOUND: 'unknown component id',
  STATE_SURFACE_NOT_FOUND: 'unknown surface id (suggestions provided)',
  STATE_RECIPE_NOT_FOUND: 'unknown surface/state recipe',
  PRODUCT_NOT_FOUND: 'unknown product archetype id',
  NO_COMPATIBLE_STYLE: 'every candidate was hard-rejected — relax constraints/avoid',
  CATALOG_SCHEMA_MISMATCH: 'bundled catalog failed schema validation',
  CATALOG_INTEGRITY_ERROR: 'bundled catalog failed integrity checks',
  OUTPUT_TOO_LARGE: 'result exceeded the size budget',
};

export interface ToolErrorPayload {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
  suggestions?: string[];
}

export class ToolError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly suggestions?: string[],
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ToolError';
  }
  payload(): ToolErrorPayload {
    return {
      error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) },
      ...(this.suggestions && this.suggestions.length ? { suggestions: this.suggestions } : {}),
    };
  }
}

/** Levenshtein distance (small inputs only). */
export function editDistance(a: string, b: string): number {
  const m = a.length; const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min((dp[j] ?? 0) + 1, (dp[j - 1] ?? 0) + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n] ?? 0;
}

/** Near-miss ids (edit distance <= 3), closest first, max 3. */
export function nearestIds(target: string, ids: string[]): string[] {
  return ids
    .map((id) => ({ id, d: editDistance(target, id) }))
    .filter((x) => x.d <= 3)
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
    .slice(0, 3)
    .map((x) => x.id);
}
