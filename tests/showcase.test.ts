import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assignSides } from '../showcase/harness/assign.mjs';
import { SEED } from '../showcase/harness/seed.mjs';

// Invariants of the with/without showcase (issue #7) that a later edit could silently break.
// SHA-256 of briefs.json as committed before the first build (be850e7); a hash read back from runs.json would not catch an edit.
const PREREGISTERED_BRIEFS_SHA256 = 'd9ca77237efeaa965866812f0b98cc6e823c13438ba069089f4d14fd3eb90d2d';
const dir = fileURLToPath(new URL('../showcase/', import.meta.url));
const readJson = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8'));

const briefs: { id: string; brief: string }[] = readJson('briefs.json').briefs;
const runs = readJson('runs.json');
const key = readJson('key.json');

function sizeOf(path: string): number {
  const info = statSync(path);
  if (!info.isDirectory()) return info.size;
  return readdirSync(path)
    .filter((name) => name !== 'node_modules')
    .reduce((total, name) => total + sizeOf(join(path, name)), 0);
}

describe('showcase: protocol integrity', () => {
  it('keeps ten briefs of two or three sentences each', () => {
    expect(briefs).toHaveLength(10);
    for (const { id, brief } of briefs) {
      const sentences = brief.split(/(?<=[.!?])\s+/).filter(Boolean).length;
      expect(sentences, id).toBeGreaterThanOrEqual(2);
      expect(sentences, id).toBeLessThanOrEqual(3);
    }
  });

  it('has not edited briefs.json since the builds ran', () => {
    const hash = createHash('sha256').update(readFileSync(join(dir, 'briefs.json'))).digest('hex');
    expect(hash).toBe(PREREGISTERED_BRIEFS_SHA256);
    expect(runs.briefsSha256).toBe(PREREGISTERED_BRIEFS_SHA256);
  });

  it('records every brief once per arm', () => {
    const seen = runs.builds.map((b: { brief: string; arm: string }) => `${b.brief}/${b.arm}`).sort();
    const expected = briefs.flatMap(({ id }) => [`${id}/control`, `${id}/mcp`]).sort();
    expect(seen).toEqual(expected);
  });

  it('has MCP outputs for every brief, matching the recorded call counts', () => {
    for (const { id } of briefs) {
      const outputs = readJson(join('mcp-outputs', `${id}.json`));
      const build = runs.builds.find((b: { brief: string; arm: string }) => b.brief === id && b.arm === 'mcp');
      expect(outputs.calls, id).toHaveLength(build.mcp.calls.length);
    }
  });
});

describe('showcase: blind comparison', () => {
  it('derives key.json from the committed seed, so the key cannot be hand-edited', () => {
    expect(key.seed).toBe(SEED);
    expect(key.assignments).toEqual(assignSides(briefs.map((b) => b.id)));
  });

  it('keeps the whole showcase folder under the 15 MB budget', () => {
    expect(sizeOf(dir)).toBeLessThan(15 * 1024 * 1024);
  });
});
