// SPDX-License-Identifier: MIT
/** Sorted, timestamp-free JSON identity; undefined is excluded consistently. */
export function stableVisualJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableVisualJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableVisualJson(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
/**
 * Non-security content identity. Artifact transport separately uses SHA-256.
 * 64-bit FNV-1a over the UTF-8 bytes, kept as two 32-bit halves: a BigInt per byte made every
 * resolve spend most of its time here. The prime is 2^40 + 0x1b3, so hash * prime mod 2^64 is
 * hash * 0x1b3 plus the low half shifted 8 bits into the high half. Every sum stays below 2^53.
 */
export function visualContentHash(value: unknown): string {
  let hi = 0xcbf29ce4;
  let lo = 0x84222325;
  const bytes = new TextEncoder().encode(stableVisualJson(value));
  for (let i = 0; i < bytes.length; i++) {
    lo ^= bytes[i]!;
    const low = (lo >>> 0) * 0x1b3;
    hi = (hi * 0x1b3 + Math.floor(low / 0x100000000) + ((lo << 8) >>> 0)) >>> 0;
    lo = low >>> 0;
  }
  return `fnv1a:${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`;
}
