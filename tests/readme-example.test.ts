import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import type { RankingExplanation } from '../src/recommendation/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = CatalogRepository.load();

interface ShownExample {
  confidence: string;
  candidates: { styleId: string; score: number }[];
  ranking: RankingExplanation;
  rejected: { styleId: string; reasonCodes: string[] }[];
  pairings: { styleId: string; pairWith: string }[];
  guidance: string;
}

function shownResult(file: string, marker: string): ShownExample {
  const text = readFileSync(join(root, file), 'utf8');
  const start = text.indexOf(marker);
  expect(start, `${file} should contain the result example`).toBeGreaterThan(-1);
  const block = text.slice(text.indexOf('{', start), text.indexOf('\n```', start));
  return JSON.parse(block.replace(/\s\/\/.*$/gm, '')) as ShownExample;
}

describe.each([
  { file: 'README.md', marker: '// ← result', locale: 'en' as const },
  { file: 'README.ko.md', marker: '// ← 결과', locale: 'ko' as const },
])('$file headline example', ({ file, marker, locale }) => {
  it('is the real output of the headline brief', () => {
    const shown = shownResult(file, marker);
    const real = recommendDesignDirection({
      productDescription: 'High-density monitoring dashboard for SREs, watched all day on call',
      productType: 'operational-saas',
      tone: ['calm', 'technical'],
      density: 'high',
      usageFrequency: 'daily',
      avoid: ['cyberpunk'],
      locale,
    }, repo);
    expect(shown.confidence).toBe(real.confidence);
    expect(shown.candidates).toEqual(real.candidates.map((c) => ({ styleId: c.styleId, score: c.score })));
    expect(shown.ranking).toEqual(real.ranking);
    expect(shown.guidance).toBe(real.guidance);
    expect(shown.pairings.map((p) => [p.styleId, p.pairWith])).toEqual(real.pairings.map((p) => [p.styleId, p.pairWith]));
    for (const r of shown.rejected) {
      expect(real.rejected).toContainEqual(expect.objectContaining({ styleId: r.styleId, reasonCodes: r.reasonCodes }));
    }
  });
});
