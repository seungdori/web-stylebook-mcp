import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import type { ProductContext } from '../src/recommendation/types.js';

interface BriefCase {
  id: string;
  brief: ProductContext;
  expect: { top1: string[]; minGap: number; preferred?: string };
  rationale: string;
}

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'recommend-briefs.v1.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { briefs: BriefCase[] };
const repo = CatalogRepository.load();
const hundredths = (score: number) => Math.round(score * 100);

describe('recommend_design_direction brief fixture', () => {
  it('holds at least 12 varied briefs with unique ids', () => {
    expect(fixture.briefs.length).toBeGreaterThanOrEqual(12);
    expect(new Set(fixture.briefs.map((c) => c.id)).size).toBe(fixture.briefs.length);
    expect(new Set(fixture.briefs.map((c) => c.brief.productType)).size).toBeGreaterThanOrEqual(8);
  });

  for (const c of fixture.briefs) {
    it(`${c.id}: expected top-1 and score gap`, () => {
      const result = recommendDesignDirection({ ...c.brief, candidateLimit: 10 }, repo);
      const ranked = result.candidates.map((x) => `${x.styleId} ${x.score.toFixed(2)}`).join(', ');
      const top = result.candidates[0]!;
      expect(c.expect.top1, `ranked: ${ranked}`).toContain(top.styleId);

      const outside = result.candidates.find((x) => !c.expect.top1.includes(x.styleId));
      const gap = outside ? (hundredths(top.score) - hundredths(outside.score)) / 100 : Infinity;
      expect(gap, `gap to ${outside?.styleId}; ranked: ${ranked}`).toBeGreaterThanOrEqual(c.expect.minGap - 1e-9);

      if (c.expect.preferred) expect(top.styleId, `ranked: ${ranked}`).toBe(c.expect.preferred);
    });
  }
});
