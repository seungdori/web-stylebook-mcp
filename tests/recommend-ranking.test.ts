import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { normalizeContext } from '../src/recommendation/normalize-context.js';
import { scoreStyle } from '../src/recommendation/scoring.js';
import { contentKeys, useCaseEvidence, wordKey } from '../src/recommendation/lexicon.js';
import type { ProductContext, RankReasonCode, StyleCandidate } from '../src/recommendation/types.js';
import { repoWith, repoWithClones, repoWithTwin } from './helpers/catalog-variants.js';

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

const byId = (r: { candidates: StyleCandidate[] }, id: string) => r.candidates.find((c) => c.styleId === id);
const evidenceOf = (description: string, styleId: string) =>
  useCaseEvidence(repo.getStyle(styleId)!, new Set(contentKeys(description)), 'other', repo);

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

  it('keeps quiet-utility first without the avoid term and with the tones reversed', () => {
    for (const variant of [{ avoid: [] }, { tone: ['technical', 'calm'] as ProductContext['tone'] }]) {
      expect(recommendDesignDirection({ ...headline, ...variant }, repo).candidates[0]!.styleId).toBe('quiet-utility');
    }
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
      if (r.ranking!.tied) continue;
      for (const code of r.ranking!.reasonCodes) {
        const holds = observable[code];
        if (holds) expect(holds(a!, b!), `${id}: ${code} claimed but not visible in scoreBreakdown`).toBe(true);
      }
      expect(r.ranking!.reasonCodes.length, id).toBeGreaterThan(0);
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

  it('says assumed, not requested, for a level the caller never gave', () => {
    const { density: _density, ...withoutDensity } = headline;
    const r = recommendDesignDirection({ ...withoutDensity, productType: 'documentation', tone: ['technical'], avoid: [], usageFrequency: 'one-off', candidateLimit: 10 }, repo);
    const ranking = r.ranking!;
    expect(r.resolvedContext.assumptions.join(' ')).toMatch(/density defaulted/);
    if (/density/.test(ranking.explanation)) expect(ranking.explanation).not.toMatch(/requested density/);
    const stated = recommendDesignDirection({ ...headline, usageFrequency: 'occasional', candidateLimit: 10 }, repo);
    expect(stated.ranking!.explanation).not.toMatch(/assumed/);
  });
});

describe('ties are reported, never broken silently', () => {
  it('reports two identical styles as a tie with no preference reason', () => {
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, repoWithTwin(repo, 'quiet-utility'));
    expect(r.candidates.slice(0, 2).map((c) => c.styleId)).toEqual(['quiet-utility', 'quiet-utility-twin']);
    expect(r.candidates[0]!.score).toBe(r.candidates[1]!.score);
    expect(r.ranking).toMatchObject({ winner: 'quiet-utility', runnerUp: 'quiet-utility-twin', gap: 0, tied: true, reasonCodes: ['TIED'] });
    expect(r.ranking!.explanation).toMatch(/tie at/);
    expect(r.ranking!.explanation).toMatch(/not a preference; they are listed by unrounded score, then style id/);
    expect(r.guidance).toMatch(/tied at the top/);
  });

  it('reports the tie even when candidateLimit returns only one of the tied styles', () => {
    const r = recommendDesignDirection({ ...headline, candidateLimit: 1 }, repoWithTwin(repo, 'quiet-utility'));
    expect(r.candidates).toHaveLength(1);
    expect(r.ranking!.tied).toBe(true);
    expect(r.guidance).toMatch(/2 candidates are tied at the top/);
  });

  it('gives the same answer whatever the order of the catalog', () => {
    const twinned = repoWithTwin(repo, 'quiet-utility');
    const reversed = repoWith(twinned, [...twinned.allStyles()].reverse());
    for (const { brief } of briefs) {
      expect(JSON.stringify(recommendDesignDirection(brief, reversed))).toBe(JSON.stringify(recommendDesignDirection(brief, twinned)));
    }
  });

  it('does not claim a tie when the scores differ', () => {
    const r = recommendDesignDirection(headline, repo);
    expect(r.ranking!.tied).toBe(false);
    expect(r.guidance).not.toMatch(/tied/);
  });

  it('names what each side leads on when two near-equal styles tie', () => {
    // The clone fits density and usage exactly but carries a heavier maintenance load: the two nearly cancel.
    const mixed = repoWithClones(repo, 'quiet-utility', [{
      id: 'quiet-utility-mixed',
      edit: (style) => {
        style.recommendationFacets.density = ['high'];
        style.recommendationFacets.usageFrequency = ['daily'];
        style.recommendationFacets.maintenanceComplexity = 'medium';
      },
    }]);
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, mixed);
    expect(r.ranking).toMatchObject({ winner: 'quiet-utility-mixed', runnerUp: 'quiet-utility', tied: true, reasonCodes: ['TIED'] });
    expect(r.ranking!.explanation).toMatch(/quiet-utility-mixed leads: requested density high: .*; quiet-utility leads: lighter upkeep for daily use/);
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
    const adult = recommendDesignDirection({ productDescription: 'luxury boutique with adult products', productType: 'other', candidateLimit: 10 }, repo);
    const kids = recommendDesignDirection({ productDescription: 'luxury boutique with children products', productType: 'other', candidateLimit: 10 }, repo);
    expect(byId(kids, 'midnight-noir')!.score).toBeLessThan(byId(adult, 'midnight-noir')!.score);
  });

  it('counts a notIdealFor entry only on a vertical word or several shared words, never on one product-kind word', () => {
    expect(evidenceOf('Online shop for a small-batch ceramics brand', 'fusion-soft-inflate').notIdeal).toBe(0);
    expect(evidenceOf('Marketing analytics dashboard for growth teams', 'quiet-utility').notIdeal).toBe(0);
    expect(evidenceOf('Landing pages and consumer marketing pages', 'quiet-utility').notIdeal).toBe(1);
    expect(evidenceOf('A developer portfolio', 'earth-atelier').notIdeal).toBe(0);
    expect(evidenceOf('Developer tools for CI', 'earth-atelier').notIdeal).toBe(0);
    expect(evidenceOf('Learning app for children aged 6 to 10', 'cyberpunk-glitch').notIdeal).toBe(1);
  });

  it('gives half credit to one product-kind word and full credit to a vertical word or repeated phrase', () => {
    expect(evidenceOf('Launch page for a startup', 'fusion-cyber-console').lexical).toBe(0.5);
    expect(evidenceOf('A dashboard', 'notion-style').lexical).toBe(0.5);
    expect(evidenceOf('A music streaming service for artists', 'duotone-bold').lexical).toBe(1);
    expect(evidenceOf('Weekly gardening newsletter', 'duotone-bold').lexical).toBe(0);
  });

  it('does not let generic words such as app or tool change what a brief matches', () => {
    for (const style of ['duotone-bold', 'cyberpunk-glitch', 'quiet-utility']) {
      for (const [plain, withGeneric] of [['music streaming for artists', 'music streaming app for artists'], ['children aged 6 to 10', 'children products aged 6 to 10'], ['admin console', 'admin console tool']] as const) {
        expect(evidenceOf(withGeneric, style), `${style}: ${withGeneric}`).toEqual(evidenceOf(plain, style));
      }
    }
  });

  it('scores a style the same whatever order its productTypes are listed in', () => {
    const reversed = repoWithClones(repo, 'notion-style', [{ id: 'notion-style-reversed', edit: (style) => { style.recommendationFacets.productTypes.reverse(); } }]);
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, reversed);
    expect(byId(r, 'notion-style-reversed')!.score).toBe(byId(r, 'notion-style')!.score);
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
});

describe('what the brief says about product type, tasks and tone', () => {
  it('treats an unknown product type as neutral instead of favouring the style that lists other', () => {
    const unknown = recommendDesignDirection({ productDescription: 'A weather app with big temperature typography', tone: ['calm'], candidateLimit: 10 }, repo);
    expect(unknown.resolvedContext.normalizedFacets[0]).toContain('other (default)');
    expect(new Set(unknown.candidates.map((c) => c.scoreBreakdown.product))).toEqual(new Set([0.5]));
    expect(unknown.ranking!.explanation).not.toMatch(/lists other as a product type/);
  });

  it('treats an explicit product type of other as unknown too', () => {
    const explicit = recommendDesignDirection({ productDescription: 'Something for a team to use.', productType: 'other', tone: ['calm'], candidateLimit: 10 }, repo);
    expect(new Set(explicit.candidates.map((c) => c.scoreBreakdown.product))).toEqual(new Set([0.5]));
    expect(explicit.ranking!.explanation).not.toMatch(/lists other as a product type/);
    expect(explicit.candidates.flatMap((c) => c.matched)).not.toContain('Fits other');
  });

  it('counts the catalog primary picks for a product type as a full product fit', () => {
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, repo);
    for (const id of ['quiet-utility', 'platform-core', 'runtime-signal']) expect(byId(r, id)!.scoreBreakdown.product, id).toBe(1);
    expect(byId(r, 'notion-style')!.scoreBreakdown.product).toBeLessThan(1);
    expect(repo.getProduct('operational-saas')!.recommendedPrimaryStyleIds).toEqual(['quiet-utility', 'platform-core', 'runtime-signal']);
  });

  it('lets stated primaryTasks win over words in the description', () => {
    const ctx = normalizeContext({ productDescription: 'Long-form essay blog; readers come for the writing', primaryTasks: ['read'] }, repo);
    expect(ctx.primaryTaskTags).toEqual({ value: ['read'], source: 'explicit' });
  });

  it('falls back to the description when the stated tasks name no task', () => {
    const ctx = normalizeContext({ productDescription: 'A monitoring tool watched all day', primaryTasks: ['do the thing'] }, repo);
    expect(ctx.primaryTaskTags.source).toBe('inferred');
    expect(ctx.primaryTaskTags.value).toEqual(['monitor']);
    expect(ctx.assumptions.join(' ')).toMatch(/primaryTasks inferred as monitor/);
  });

  it('infers task tags from inflected words but not product types', () => {
    const monitoring = recommendDesignDirection({ productDescription: 'A monitoring tool watched all day' }, repo);
    expect(monitoring.resolvedContext.assumptions.join(' ')).toMatch(/primaryTasks inferred as monitor/);
    const stored = recommendDesignDirection({ productDescription: 'Stored procedures for a database' }, repo);
    expect(stored.resolvedContext.normalizedFacets[0]).toContain('other');
  });

  it('keeps confidence high when the winner carries one of two requested tones', () => {
    const r = recommendDesignDirection({
      productDescription: 'Internal wiki for engineers', productType: 'knowledge-base', tone: ['trustworthy', 'technical'],
      density: 'high', usageFrequency: 'daily', trustSensitivity: 'high',
    }, repo);
    expect(r.confidence).toBe('high');
  });
});

describe('lexicon', () => {
  it('folds inflected forms to one key', () => {
    expect(new Set(['monitor', 'monitors', 'monitoring', 'monitored'].map(wordKey)).size).toBe(1);
    expect(new Set(['dashboard', 'dashboards'].map(wordKey)).size).toBe(1);
    expect(new Set(['write', 'writing', 'writes'].map(wordKey)).size).toBe(1);
    expect(wordKey('process')).toBe('process');
  });

  it('drops function, number and facet words and keeps the rest', () => {
    const keys = contentKeys('A high-density calm dashboard app for the team, used daily by 12 engineers');
    expect(keys).toEqual(expect.arrayContaining(['dashboard', 'app', 'team', 'engineer']));
    for (const dropped of ['high', 'density', 'calm', 'daily', '12', 'the', 'for']) expect(keys).not.toContain(dropped);
  });

  it('reads Latin script only', () => {
    expect(contentKeys('SRE를 위한 모니터링 대시보드')).toEqual(['sre']);
  });
});
