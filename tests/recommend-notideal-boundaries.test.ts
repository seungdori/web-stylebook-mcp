// Boundary checks for the notIdealFor rule (whole phrase, or two or more distinctive words covering 60%), the
// independence of the two phrase lists, and the cap on confidence for an unknown product type. Briefs come from a
// fixed seed, never from Math.random.
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { normalizeContext } from '../src/recommendation/normalize-context.js';
import { scoreStyle } from '../src/recommendation/scoring.js';
import { contentKeys, distinctiveKeys, useCaseEvidence } from '../src/recommendation/lexicon.js';
import type { ProductContext } from '../src/recommendation/types.js';

const repo = CatalogRepository.load();

const TONES = ['calm', 'technical', 'trustworthy', 'premium', 'editorial', 'playful', 'bold', 'experimental'] as const;
const LEVELS = ['low', 'medium', 'high'] as const;
const USES = ['one-off', 'occasional', 'daily'] as const;
const COHERENT: Record<string, string> = {
  'operational-saas': 'Monitoring dashboard for an operations team', 'developer-tool': 'CLI and SDK for developers to configure deployments',
  documentation: 'API reference and guides for developers', 'data-analytics': 'Analytics dashboard with charts and reports',
  'security-console': 'Security console for threat monitoring and audit log review', 'finance-admin': 'Billing and ledger admin for a finance team',
  'healthcare-portal': 'Patient portal for booking appointments and viewing results', commerce: 'Online store selling clothing',
  'ai-chat': 'AI chat assistant for customer questions', 'content-editorial': 'Magazine and blog publication',
  'knowledge-base': 'Internal wiki and help center', portfolio: 'Portfolio site for a designer',
  campaign: 'Landing page for a product launch', 'consumer-app': 'Mobile app for tracking habits',
};

function briefs(count: number, seed: number, productType?: 'other'): ProductContext[] {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const types = Object.keys(COHERENT);
  return Array.from({ length: count }, () => {
    const type = pick(types) as NonNullable<ProductContext['productType']>;
    const tone = new Set<(typeof TONES)[number]>();
    const n = 1 + Math.floor(rnd() * 2);
    while (tone.size < n) tone.add(pick(TONES));
    return { productDescription: COHERENT[type]!, productType: productType ?? type, tone: [...tone], density: pick(LEVELS), usageFrequency: pick(USES), trustSensitivity: pick(LEVELS) };
  });
}

const evidence = (styleId: string, description: string) =>
  useCaseEvidence(repo.getStyle(styleId)!, new Set(contentKeys(description)), 'other', repo);

describe('A. the 60% coverage rule for notIdealFor phrases of four distinctive words', () => {
  it('needs three of the four words of "fast small-screen consumer apps"', () => {
    expect(distinctiveKeys('fast small-screen consumer apps')).toHaveLength(4);
    expect(evidence('fusion-soft-inflate', 'A fast small shop').notIdeal).toBe(0); // 2 of 4
    expect(evidence('fusion-soft-inflate', 'A fast small-screen shop').notIdeal).toBe(1); // 3 of 4
  });

  it('needs three of the four words of "financial products needing sober trust"', () => {
    expect(distinctiveKeys('financial products needing sober trust')).toHaveLength(4);
    expect(evidence('fusion-studio-pixel', 'Financial trust dashboard').notIdeal).toBe(0); // 2 of 4
    expect(evidence('fusion-studio-pixel', 'Financial products needing trust').notIdeal).toBe(1); // 3 of 4
  });
});

describe('B. the two phrase lists do not influence each other', () => {
  it('leaves bestFor credit unchanged when notIdealFor is emptied, and the penalty unchanged when bestFor is emptied', () => {
    const pool = new Set<string>();
    for (const style of repo.allStyles()) for (const phrase of [...style.bestFor, ...style.notIdealFor]) pool.add(phrase);
    const requests = [...pool].flatMap((p) => [contentKeys(p), distinctiveKeys(p)]);
    requests.push(...Object.values(COHERENT).map((d) => contentKeys(d)));
    for (const style of repo.allStyles()) {
      const noPenaltyList = { ...style, notIdealFor: [] as string[] };
      const noCreditList = { ...style, bestFor: [] as string[] };
      for (const keys of requests) {
        const request = new Set(keys);
        const full = useCaseEvidence(style, request, 'other', repo);
        const credit = useCaseEvidence(noPenaltyList, request, 'other', repo);
        const penalty = useCaseEvidence(noCreditList, request, 'other', repo);
        expect([credit.lexical, credit.phrase], `${style.id} credit`).toEqual([full.lexical, full.phrase]);
        expect([penalty.notIdeal, penalty.notIdealPhrase], `${style.id} penalty`).toEqual([full.notIdeal, full.notIdealPhrase]);
      }
    }
  });

  it('rarely lets a notIdealFor penalty reach a top-three style of a coherent brief', () => {
    const sample = briefs(400, 20261019);
    let reached = 0;
    for (const brief of sample) {
      const ctx = normalizeContext(brief, repo);
      const top = recommendDesignDirection({ ...brief, candidateLimit: 3 }, repo).candidates;
      if (top.some((c) => scoreStyle(ctx, repo.getStyle(c.styleId)!, repo).evidence.notIdeal === 1)) reached++;
    }
    expect(reached / sample.length).toBeLessThan(0.01);
  });
});

describe('C. confidence is capped only for an unknown product type', () => {
  it('is never high when the product type is other, however much else the caller states', () => {
    for (const brief of briefs(200, 4711, 'other')) {
      expect(recommendDesignDirection(brief, repo).confidence, JSON.stringify(brief)).not.toBe('high');
    }
  });

  it('is still high for most of the same briefs once the product type is named', () => {
    const named = briefs(200, 4711);
    const high = named.filter((b) => recommendDesignDirection(b, repo).confidence === 'high').length;
    expect(high / named.length).toBeGreaterThan(0.8);
  });
});

describe('D. a facet word that is only an adjective does not silence a phrase', () => {
  it('"high-energy campaigns" and "low-motion contexts" still fire when a brief repeats them', () => {
    expect(evidence('zen-minimalism', 'A high-energy campaigns site').notIdeal).toBe(1);
    expect(evidence('framer-motion', 'A low-motion contexts study').notIdeal).toBe(1);
  });

  it('but "high-density data" stays with the density factor, so a data brief does not fire it', () => {
    expect(evidence('fusion-grain-mono', 'Content hub for a data journalism team').notIdeal).toBe(0);
  });
});
