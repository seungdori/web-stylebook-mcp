import { SEED } from './seed.mjs';

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function assignSides(briefIds, seed = SEED) {
  const random = mulberry32(fnv1a(seed));
  return Object.fromEntries(
    briefIds.map((id) => [id, random() < 0.5 ? { left: 'control', right: 'mcp' } : { left: 'mcp', right: 'control' }]),
  );
}
