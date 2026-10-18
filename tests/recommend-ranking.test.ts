import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { normalizeContext } from '../src/recommendation/normalize-context.js';
import { scoreStyle } from '../src/recommendation/scoring.js';
import { contentKeys, wordKey } from '../src/recommendation/lexicon.js';
import type { ProductContext, RankReasonCode, StyleCandidate } from '../src/recommendation/types.js';
import type { CatalogStyle } from '../src/types.js';

const repo = CatalogRepository.load();
const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'recommend-briefs.v1.json');
const briefs = (JSON.parse(readFileSync(fixturePath, 'utf8')) as { briefs: { id: string; brief: ProductContext }[] }).briefs;

const headline: ProductContext = {
  productDescription: 'High-density monitoring dashboard for SREs, watched all day on call',
  productType: 'operational-saas',
  tone: ['calm', 'technical'],
  density: 'high',
  usageFrequency: 'daily',
  avoid: ['cyberpunk'],
};

function repoWith(styles: CatalogStyle[]): CatalogRepository {
  const envelope = structuredClone(repo.envelope);
  envelope.data.styles = styles;
  return new CatalogRepository(envelope);
}

const byId = (r: { candidates: StyleCandidate[] }, id: string) => r.candidates.find((c) => c.styleId === id);

describe('scoring terms', () => {
  it('weighted terms add up to the total, with every fit inside 0..1', () => {
    for (const { id, brief } of briefs) {
      const ctx = normalizeContext(brief, repo);
      for (const style of repo.allStyles()) {
        const sc = scoreStyle(ctx, style, repo);
        const sum = Object.values(sc.terms).reduce((n, x) => n + x, 0);
        expect(sc.total, `${id}/${style.id}`).toBeCloseTo(Math.min(1, Math.max(0, sum)), 5);
        for (const [factor, fit] of Object.entries(sc.fits)) {
          expect(fit, `${id}/${style.id}/${factor}`).toBeGreaterThanOrEqual(0);
          expect(fit, `${id}/${style.id}/${factor}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('no longer saturates: the README brief separates its former five-way tie', () => {
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, repo);
    const former = ['notion-style', 'platform-core', 'quiet-utility', 'runtime-signal', 'console-launch'];
    const scores = former.map((id) => byId(r, id)!.score);
    expect(new Set(scores).size).toBeGreaterThanOrEqual(4);
    expect(r.candidates[0]!.styleId).toBe('quiet-utility');
    expect(r.ranking?.tied).toBe(false);
  });
});

describe('ranking explanation', () => {
  const observable: Partial<Record<RankReasonCode, (a: StyleCandidate, b: StyleCandidate) => boolean>> = {
    PRODUCT_FOCUS: (a, b) => a.scoreBreakdown.product! > b.scoreBreakdown.product!,
    USE_CASE_FIT: (a, b) => a.scoreBreakdown.useCase! > b.scoreBreakdown.useCase!,
    TASK_FIT: (a, b) => a.scoreBreakdown.task! > b.scoreBreakdown.task!,
    TONE_FIT: (a, b) => a.scoreBreakdown.tone! > b.scoreBreakdown.tone!,
    DENSITY_FIT: (a, b) => a.scoreBreakdown.density! > b.scoreBreakdown.density!,
    USAGE_FIT: (a, b) => a.scoreBreakdown.usage! > b.scoreBreakdown.usage!,
    TRUST_FIT: (a, b) => a.scoreBreakdown.trust! > b.scoreBreakdown.trust!,
    CONSTRAINT_FIT: (a, b) => a.scoreBreakdown.constraint! > b.scoreBreakdown.constraint!,
  };

  it('names the runner-up and a displayed-score gap that match the candidates', () => {
    for (const { id, brief } of briefs) {
      const r = recommendDesignDirection({ ...brief, candidateLimit: 3 }, repo);
      const [first, second] = r.candidates;
      expect(r.ranking, id).toBeDefined();
      expect(r.ranking!.winner, id).toBe(first!.styleId);
      expect(r.ranking!.runnerUp, id).toBe(second!.styleId);
      expect(r.ranking!.gap, id).toBeCloseTo(first!.score - second!.score, 9);
      expect(r.ranking!.tied, id).toBe(first!.score === second!.score);
      expect(r.ranking!.explanation, id).toContain(first!.styleId);
      expect(r.ranking!.explanation, id).toContain(second!.styleId);
    }
  });

  it('backs every named factor with a visible advantage over the runner-up', () => {
    for (const { id, brief } of briefs) {
      const r = recommendDesignDirection({ ...brief, candidateLimit: 3 }, repo);
      const [a, b] = r.candidates;
      for (const code of r.ranking!.reasonCodes) {
        const holds = observable[code];
        if (holds) expect(holds(a!, b!), `${id}: ${code} claimed but not visible in scoreBreakdown`).toBe(true);
      }
      if (!r.ranking!.tied) expect(r.ranking!.reasonCodes.length, id).toBeGreaterThan(0);
    }
  });

  it('explains the README brief with the factors that decide it', () => {
    const r = recommendDesignDirection(headline, repo);
    expect(r.ranking!.winner).toBe('quiet-utility');
    expect(r.ranking!.runnerUp).toBe('runtime-signal');
    expect(r.ranking!.reasonCodes).toEqual(expect.arrayContaining(['USE_CASE_FIT', 'LOWER_UPKEEP']));
    expect(r.ranking!.explanation).toMatch(/lighter upkeep for daily use/);
  });

  it('still compares with the runner-up when candidateLimit hides it', () => {
    const r = recommendDesignDirection({ ...headline, candidateLimit: 1 }, repo);
    expect(r.candidates).toHaveLength(1);
    expect(r.ranking!.runnerUp).toBe('runtime-signal');
  });

  it('localizes the explanation', () => {
    const ko = recommendDesignDirection({ ...headline, locale: 'ko' }, repo).ranking!.explanation;
    const ja = recommendDesignDirection({ ...headline, locale: 'ja' }, repo).ranking!.explanation;
    expect(/[가-힣]/.test(ko)).toBe(true);
    expect(/[ぁ-んァ-ヶ一-龯]/.test(ja)).toBe(true);
    expect(ko).toContain('quiet-utility');
    expect(ja).toContain('runtime-signal');
  });
});

describe('ties are reported, never broken silently', () => {
  const quiet = repo.getStyle('quiet-utility')!;
  const twin: CatalogStyle = { ...structuredClone(quiet), id: 'quiet-utility-twin' };

  it('reports two identical styles as a tie with no preference reason', () => {
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, repoWith([...repo.allStyles(), twin]));
    expect(r.candidates.slice(0, 2).map((c) => c.styleId)).toEqual(['quiet-utility', 'quiet-utility-twin']);
    expect(r.candidates[0]!.score).toBe(r.candidates[1]!.score);
    expect(r.ranking).toMatchObject({ winner: 'quiet-utility', runnerUp: 'quiet-utility-twin', gap: 0, tied: true, reasonCodes: ['TIED'] });
    expect(r.ranking!.explanation).toMatch(/tie at/);
    expect(r.ranking!.explanation).toMatch(/not a preference; they are listed by unrounded score, then style id/);
    expect(r.guidance).toMatch(/tied at the top/);
  });

  it('reports the tie even when candidateLimit returns only one of the tied styles', () => {
    const r = recommendDesignDirection({ ...headline, candidateLimit: 1 }, repoWith([...repo.allStyles(), twin]));
    expect(r.candidates).toHaveLength(1);
    expect(r.ranking!.tied).toBe(true);
    expect(r.guidance).toMatch(/2 candidates are tied at the top/);
  });

  it('gives the same answer whatever the order of the catalog', () => {
    const forward = repoWith([...repo.allStyles(), twin]);
    const reversed = repoWith([...repo.allStyles(), twin].reverse());
    for (const { brief } of briefs) {
      expect(JSON.stringify(recommendDesignDirection(brief, reversed))).toBe(JSON.stringify(recommendDesignDirection(brief, forward)));
    }
  });

  it('does not claim a tie when the scores differ', () => {
    const r = recommendDesignDirection(headline, repo);
    expect(r.ranking!.tied).toBe(false);
    expect(r.guidance).not.toMatch(/tied/);
  });
});

describe('inputs that used to be ignored now move the score', () => {
  const base: ProductContext = { productDescription: 'A product', productType: 'consumer-app', tone: ['bold', 'playful'], density: 'medium', usageFrequency: 'daily' };

  it('reads bestFor: a matching use case raises that style and nothing else about the facets', () => {
    const plain = recommendDesignDirection({ ...base, candidateLimit: 10 }, repo);
    const music = recommendDesignDirection({ ...base, productDescription: 'A music streaming product', candidateLimit: 10 }, repo);
    expect(byId(plain, 'duotone-bold')!.scoreBreakdown.useCase).toBe(0);
    expect(byId(music, 'duotone-bold')!.scoreBreakdown.useCase).toBeGreaterThan(0);
    expect(byId(music, 'duotone-bold')!.scoreBreakdown.tone).toBe(byId(plain, 'duotone-bold')!.scoreBreakdown.tone);
  });

  it('reads notIdealFor text that no product type maps to', () => {
    const adult = recommendDesignDirection({ productDescription: 'luxury boutique for adults', productType: 'other', candidateLimit: 10 }, repo);
    const kids = recommendDesignDirection({ productDescription: 'luxury boutique for children', productType: 'other', candidateLimit: 10 }, repo);
    expect(byId(kids, 'midnight-noir')!.score).toBeLessThan(byId(adult, 'midnight-noir')!.score);
  });

  it('ignores one incidental word shared with a notIdealFor entry', () => {
    const wellness = recommendDesignDirection({
      productDescription: 'Online shop for a small-batch ceramics brand', productType: 'commerce', tone: ['calm'], candidateLimit: 10,
    }, repo);
    const cautions = byId(wellness, 'fusion-soft-inflate')!.cautions.join(' ');
    expect(cautions).not.toMatch(/not ideal/i);
    expect(wellness.ranking!.explanation).not.toMatch(/notIdealFor/);
  });

  it('weighs the order of the requested tones', () => {
    const calmFirst = recommendDesignDirection({ ...headline, tone: ['calm', 'technical'], candidateLimit: 10 }, repo);
    const technicalFirst = recommendDesignDirection({ ...headline, tone: ['technical', 'calm'], candidateLimit: 10 }, repo);
    const gap = (r: typeof calmFirst) => byId(r, 'quiet-utility')!.scoreBreakdown.tone! - byId(r, 'runtime-signal')!.scoreBreakdown.tone!;
    expect(gap(calmFirst)).toBeGreaterThan(0);
    expect(gap(technicalFirst)).toBeLessThan(0);
  });

  it('prefers a style that declares only the requested density over one that spans two levels', () => {
    const r = recommendDesignDirection({
      productDescription: 'A product', productType: 'portfolio', tone: ['calm'], density: 'low', usageFrequency: 'one-off', candidateLimit: 10,
    }, repo);
    expect(byId(r, 'zen-minimalism')!.scoreBreakdown.density).toBe(1);
    expect(byId(r, 'editorial-silence')!.scoreBreakdown.density).toBeLessThan(1);
  });

  it('measures closeness to an avoided style and never rewards avoiding', () => {
    const without = recommendDesignDirection({ ...headline, avoid: [], candidateLimit: 10 }, repo);
    const avoiding = recommendDesignDirection({ ...headline, candidateLimit: 10 }, repo);
    for (const c of avoiding.candidates) {
      const before = byId(without, c.styleId);
      if (before) expect(c.score, c.styleId).toBeLessThanOrEqual(before.score);
    }
    const drop = (id: string) => byId(without, id)!.score - byId(avoiding, id)!.score;
    expect(drop('console-launch')).toBeGreaterThan(drop('quiet-utility'));
  });

  it('infers task tags from inflected words but not product types', () => {
    const monitoring = recommendDesignDirection({ productDescription: 'A monitoring tool watched all day' }, repo);
    expect(monitoring.resolvedContext.assumptions.join(' ')).toMatch(/primaryTasks inferred as monitor/);
    const stored = recommendDesignDirection({ productDescription: 'Stored procedures for a database' }, repo);
    expect(stored.resolvedContext.normalizedFacets[0]).toContain('other');
  });
});

describe('lexicon', () => {
  it('folds inflected forms to one key', () => {
    expect(new Set(['monitor', 'monitors', 'monitoring', 'monitored'].map(wordKey)).size).toBe(1);
    expect(new Set(['dashboard', 'dashboards'].map(wordKey)).size).toBe(1);
    expect(new Set(['write', 'writing', 'writes'].map(wordKey)).size).toBe(1);
    expect(wordKey('process')).toBe('process');
  });

  it('keeps use-case words and drops generic, function and facet words', () => {
    const keys = contentKeys('A high-density calm dashboard app for the team, used daily by 12 engineers');
    expect(keys).toEqual(expect.arrayContaining(['dashboard', 'engineer']));
    for (const dropped of ['high', 'density', 'calm', 'app', 'team', 'daily', '12', 'the', 'for']) expect(keys).not.toContain(dropped);
  });

  it('reads Latin script only', () => {
    expect(contentKeys('SRE를 위한 모니터링 대시보드')).toEqual(['sre']);
  });
});
