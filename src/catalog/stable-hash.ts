// Runtime mirror of the build's deterministic serializer (scripts/lib/stable-json.mts),
// so `--validate-catalog` can recompute the content hash and detect a tampered body —
// not just a malformed hash string. Must stay byte-identical to the build serializer.

import { createHash } from 'node:crypto';

function nfkc(s: string): string {
  return s.normalize('NFKC');
}
function codepointCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value !== null && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort(codepointCompare)) {
      const v = stableNormalize(input[key]);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  if (typeof value === 'string') return nfkc(value);
  return value;
}
function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value), null, 2) + '\n';
}

/** Content hash over the envelope WITHOUT its own contentHash field. */
export function contentHashOf(envelopeWithoutHash: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(envelopeWithoutHash), 'utf8').digest('hex')}`;
}
