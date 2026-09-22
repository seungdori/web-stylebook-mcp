// SPDX-License-Identifier: MIT
/** Sorted, timestamp-free JSON identity; undefined is excluded consistently. */
export function stableVisualJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableVisualJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => `${JSON.stringify(k)}:${stableVisualJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Non-security content identity. Artifact transport separately uses SHA-256. */
export function visualContentHash(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(stableVisualJson(value))) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return `fnv1a:${hash.toString(16).padStart(16, '0')}`;
}
