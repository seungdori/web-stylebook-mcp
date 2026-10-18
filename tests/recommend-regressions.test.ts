// Regression tests for matching, confidence, wording and ties in recommend_design_direction (#6).
// Briefs come from a fixed seed, never from Math.random.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { normalizeContext } from '../src/recommendation/normalize-context.js';
import { scoreStyle } from '../src/recommendation/scoring.js';
import { contentKeys, distinctiveKeys, useCaseEvidence } from '../src/recommendation/lexicon.js';
import type { ProductContext } from '../src/recommendation/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = CatalogRepository.load();
const fixture = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'recommend-briefs.v1.json'), 'utf8')) as {
  briefs: { id: string; brief: ProductContext }[];
};

const TONES = ['calm', 'technical', 'trustworthy', 'premium', 'editorial', 'playful', 'bold', 'experimental'] as const;
const LEVELS = ['low', 'medium', 'high'] as const;
const USES = ['one-off', 'occasional', 'daily'] as const;

// Descriptions whose wording agrees with their product type, so a brief is plausible as a whole.
const COHERENT: Record<string, string[]> = {
  'operational-saas': ['Monitoring dashboard for an operations team', 'Helpdesk ticket queue for support agents', 'Admin console for managing customer accounts'],
  'developer-tool': ['CLI and SDK for developers to configure deployments', 'Developer console for API keys and logs'],
  documentation: ['API reference and guides for developers', 'Product documentation site with search'],
  'data-analytics': ['Analytics dashboard with charts and reports', 'Business intelligence reporting tool'],
  'security-console': ['Security console for threat monitoring and audit log review', 'Access control admin for security analysts'],
  'finance-admin': ['Billing and ledger admin for a finance team', 'Payments admin with reconciliation'],
  'healthcare-portal': ['Patient portal for booking appointments and viewing results', 'Clinical dashboard for nurses'],
  commerce: ['Online store selling clothing', 'Ecommerce shop with cart and checkout'],
  'ai-chat': ['AI chat assistant for customer questions', 'Copilot chat widget inside a product'],
  'content-editorial': ['Magazine and blog publication', 'News site with long-form articles'],
  'knowledge-base': ['Internal wiki and help center', 'FAQ and support docs for customers'],
  portfolio: ['Portfolio site for a designer', 'Photography portfolio for a wedding photographer'],
  campaign: ['Landing page for a product launch', 'Marketing site for an event'],
  'consumer-app': ['Mobile app for tracking habits', 'Social app for friends'],
};

function lcg(seed: number) {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  return { rnd, pick };
}

function coherentBriefs(count: number, seed: number): ProductContext[] {
  const { rnd, pick } = lcg(seed);
  const types = Object.keys(COHERENT);
  const out: ProductContext[] = [];
  for (let i = 0; i < count; i++) {
    const productType = pick(types) as NonNullable<ProductContext['productType']>;
    const tone = new Set<(typeof TONES)[number]>();
    const n = 1 + Math.floor(rnd() * 2);
    while (tone.size < n) tone.add(pick(TONES));
    out.push({
      productDescription: pick(COHERENT[productType]!), productType, tone: [...tone],
      density: pick(LEVELS), usageFrequency: pick(USES), trustSensitivity: pick(LEVELS),
    });
  }
  return out;
}

const phrasesOf = (kind: 'bestFor' | 'notIdealFor') =>
  repo.allStyles().flatMap((style) => style[kind].map((phrase) => ({ style, phrase })));

describe('A. phrase matching: precision without losing the verbatim case', () => {
  it('a brief that repeats a bestFor phrase word for word earns at least half credit', () => {
    for (const { style, phrase } of phrasesOf('bestFor')) {
      if (distinctiveKeys(phrase).length === 0) continue;
      const ev = useCaseEvidence(style, new Set(contentKeys(phrase)), 'other', repo);
      expect(ev.lexical, `${style.id} bestFor "${phrase}"`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('a single shared word fires a phrase only when the phrase has at most two distinctive words', () => {
    for (const style of repo.allStyles()) {
      for (const kind of ['bestFor', 'notIdealFor'] as const) {
        const keys = new Set(style[kind].flatMap((p) => contentKeys(p)));
        for (const key of keys) {
          const ev = useCaseEvidence(style, new Set([key]), 'other', repo);
          const phrase = kind === 'bestFor' ? ev.lexical === 1 ? ev.phrase : undefined : ev.notIdeal === 1 ? ev.notIdealPhrase : undefined;
          if (phrase) expect(distinctiveKeys(phrase).length, `${style.id} ${kind} "${phrase}" fired on "${key}" alone`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('a product-kind word alone earns half credit for bestFor and nothing for notIdealFor', () => {
    const quiet = useCaseEvidence(repo.getStyle('quiet-utility')!, new Set(contentKeys('dashboard')), 'other', repo); // bestFor "ops dashboards"
    expect(quiet.lexical).toBe(0.5);
    const glass = useCaseEvidence(repo.getStyle('glass-orbit')!, new Set(contentKeys('admin')), 'other', repo); // notIdealFor "high-density admin tools"
    expect(glass.notIdeal).toBe(0);
  });
});

describe('B. confidence is back at the old calibration', () => {
  const briefs = coherentBriefs(400, 20260418);

  it('is high for about nine in ten fully specified, coherent briefs', () => {
    const high = briefs.filter((b) => recommendDesignDirection(b, repo).confidence === 'high').length;
    expect(high / briefs.length).toBeGreaterThan(0.85);
  });

  it('is never high when the winner carries none of the explicitly requested tones', () => {
    for (const b of briefs) {
      const r = recommendDesignDirection(b, repo);
      const carried = (b.tone ?? []).filter((t) => repo.getStyle(r.candidates[0]!.styleId)!.recommendationFacets.tones.includes(t)).length;
      if (carried === 0) expect(r.confidence, JSON.stringify(b)).not.toBe('high');
    }
  });
});

describe('C. "requested" is only said about what the caller stated', () => {
  const LABEL = {
    en: { density: ['requested density', 'assumed density'], usageFrequency: ['requested usage', 'assumed usage'], trustSensitivity: ['requested trust', 'assumed trust'] },
    ko: { density: ['요청한 밀도', '가정한 밀도'], usageFrequency: ['요청한 사용 빈도', '가정한 사용 빈도'], trustSensitivity: ['요청한 신뢰 요구', '가정한 신뢰 요구'] },
    ja: { density: ['要求された密度', '想定された密度'], usageFrequency: ['要求された利用頻度', '想定された利用頻度'], trustSensitivity: ['要求された信頼要件', '想定された信頼要件'] },
  } as const;

  it('matches the source of density, usage and trust in English, Korean and Japanese', () => {
    const { rnd, pick } = lcg(515151);
    const types = Object.keys(COHERENT);
    let said = 0;
    for (let i = 0; i < 300; i++) {
      const productType = pick(types) as NonNullable<ProductContext['productType']>;
      const brief: ProductContext = {
        productDescription: pick(COHERENT[productType]!), productType, tone: [pick(TONES)],
        ...(rnd() < 0.5 ? { density: pick(LEVELS) } : {}), ...(rnd() < 0.5 ? { usageFrequency: pick(USES) } : {}), ...(rnd() < 0.5 ? { trustSensitivity: pick(LEVELS) } : {}),
      };
      const ctx = normalizeContext(brief, repo);
      for (const locale of ['en', 'ko', 'ja'] as const) {
        const text = recommendDesignDirection({ ...brief, locale }, repo).ranking!.explanation;
        for (const facet of ['density', 'usageFrequency', 'trustSensitivity'] as const) {
          const [stated, assumed] = LABEL[locale][facet];
          if (text.includes(stated)) { said++; expect(ctx[facet].source, `${locale} ${facet}: ${text}`).toBe('explicit'); }
          if (text.includes(assumed)) { said++; expect(ctx[facet].source, `${locale} ${facet}: ${text}`).not.toBe('explicit'); }
        }
      }
    }
    expect(said).toBeGreaterThan(100);
  });
});

describe('D. an unknown product type is neutral', () => {
  const UNKNOWN = [
    'A weather app with big temperature typography and calm colors', 'Online course platform for adult learners', 'Law firm website with practice areas',
    'Nonprofit donation page for a children hospital', 'Fitness tracker companion app', 'Something for a team to use.',
  ];

  it('gives every style the same product fit and never explains a ranking with the style that lists other', () => {
    for (const productDescription of UNKNOWN) {
      const r = recommendDesignDirection({ productDescription, tone: ['calm'], candidateLimit: 10 }, repo);
      expect(r.resolvedContext.normalizedFacets[0], productDescription).toContain('other (default)');
      expect(new Set(r.candidates.map((c) => c.scoreBreakdown.product)), productDescription).toEqual(new Set([0.5]));
      expect(r.ranking!.explanation, productDescription).not.toMatch(/lists other as a product type/);
    }
  });

  it('reports the near-empty brief as a multi-way tie instead of crowning a style', () => {
    const r = recommendDesignDirection({ productDescription: 'Something for a team to use.', candidateLimit: 10 }, repo);
    expect(r.ranking!.tied).toBe(true);
    expect(r.guidance).toMatch(/\d+ candidates are tied at the top/);
  });
});

describe('E. tie explanations match the terms that produce the scores', () => {
  const TERMS = ['product', 'useCase', 'task', 'tone', 'density', 'usage', 'trust', 'constraint', 'cautions', 'upkeep', 'avoidance'] as const;

  it('says "alike on every factor" only when no term differs by 0.002, and names a side only when it leads', () => {
    const { rnd, pick } = lcg(909090);
    const types = Object.keys(COHERENT);
    let ties = 0;
    for (let i = 0; i < 1500 && ties < 120; i++) {
      const productType = pick(types) as NonNullable<ProductContext['productType']>;
      const brief: ProductContext = {
        productDescription: pick(COHERENT[productType]!), ...(rnd() < 0.8 ? { productType } : {}),
        ...(rnd() < 0.7 ? { tone: [pick(TONES)] } : {}), ...(rnd() < 0.5 ? { density: pick(LEVELS) } : {}), ...(rnd() < 0.5 ? { usageFrequency: pick(USES) } : {}),
        ...(rnd() < 0.3 ? { avoid: [pick(['cyberpunk', 'glass', 'neon', 'retro'])] } : {}), candidateLimit: 3,
      };
      const r = recommendDesignDirection(brief, repo);
      if (!r.ranking?.tied) continue;
      ties++;
      const ctx = normalizeContext(brief, repo);
      const a = scoreStyle(ctx, repo.getStyle(r.ranking.winner)!, repo);
      const b = scoreStyle(ctx, repo.getStyle(r.ranking.runnerUp)!, repo);
      const lead = (x: typeof a, y: typeof b) => TERMS.some((t) => x.terms[t] - y.terms[t] >= 0.002);
      const text = r.ranking.explanation;
      if (/alike on every factor/.test(text)) expect(lead(a, b) || lead(b, a), text).toBe(false);
      else {
        expect(text.includes(`${a.style.id} leads:`), text).toBe(lead(a, b));
        expect(text.includes(`${b.style.id} leads:`), text).toBe(lead(b, a));
      }
    }
    expect(ties).toBeGreaterThan(50);
  });
});

describe('F. the note on the revised fixture expectation is true', () => {
  it('kids-learning-app: a variant worded "education" puts paper-cut first and claymorphism third', () => {
    const brief = fixture.briefs.find((b) => b.id === 'kids-learning-app')!.brief;
    const variant = recommendDesignDirection({ ...brief, productDescription: brief.productDescription.replace('Learning app', 'Education app'), candidateLimit: 10 }, repo);
    expect(variant.candidates.map((c) => c.styleId).slice(0, 3)).toEqual(['paper-cut', 'soft-pastel', 'claymorphism']);
    const asWritten = recommendDesignDirection({ ...brief, candidateLimit: 10 }, repo);
    expect(byId(asWritten.candidates, 'claymorphism')!.scoreBreakdown.useCase).toBe(0);
  });
});

function byId<T extends { styleId: string }>(list: T[], id: string): T | undefined {
  return list.find((x) => x.styleId === id);
}

describe('G. regressions found in review', () => {
  it('appending a generic word does not move the best-fitting style', () => {
    const base: ProductContext = {
      productDescription: 'Admin console for managing customer accounts', productType: 'operational-saas',
      tone: ['calm', 'technical'], density: 'high', usageFrequency: 'daily', candidateLimit: 10,
    };
    const score = (d: string) => recommendDesignDirection({ ...base, productDescription: d }, repo).candidates.find((c) => c.styleId === 'quiet-utility')!.score;
    expect(score(`${base.productDescription} (tool)`)).toBe(score(base.productDescription));
  });

  it('notIdealFor "children products" fires on a repeat of the phrase, not on the word "children" alone', () => {
    const fires = (description: string) =>
      useCaseEvidence(repo.getStyle('cyberpunk-glitch')!, new Set(contentKeys(description)), 'consumer-app', repo).notIdeal;
    expect(fires('Learning products for children aged 6 to 10')).toBe(1);
    expect(fires('Learning app for children aged 6 to 10')).toBe(0);
  });

  it('the ranking claims a bestFor match only when the phrase was repeated in full', () => {
    for (const brief of [
      { productDescription: 'Clinical dashboard for nurses', productType: 'healthcare-portal', tone: ['calm', 'trustworthy'], density: 'high', usageFrequency: 'daily', trustSensitivity: 'high' },
      { productDescription: 'Payments admin with reconciliation', productType: 'finance-admin', tone: ['trustworthy', 'technical'], density: 'high', usageFrequency: 'daily', trustSensitivity: 'high' },
      { productDescription: 'Law firm website', tone: ['trustworthy', 'premium'] },
    ] as ProductContext[]) {
      const r = recommendDesignDirection({ ...brief, candidateLimit: 5 }, repo);
      const claimed = /bestFor "([^"]+)" matches the brief/.exec(r.ranking!.explanation);
      if (!claimed) continue;
      const ev = scoreStyle(normalizeContext(brief, repo), repo.getStyle(r.ranking!.winner)!, repo).evidence;
      expect(ev.phrase).toBe(claimed[1]);
      expect(ev.lexical, r.ranking!.explanation).toBe(1);
    }
  });

  it('an explicit productType other does not crown the style that lists other', () => {
    const r = recommendDesignDirection({ productDescription: 'Something for a team to use.', productType: 'other', candidateLimit: 10 }, repo);
    expect(r.ranking!.explanation).not.toMatch(/lists other as a product type/);
  });

  it('tasks read from the description are not called requested', () => {
    const r = recommendDesignDirection({ productDescription: 'Travel booking website for budget trips', tone: ['playful'], candidateLimit: 5 }, repo);
    expect(r.resolvedContext.assumptions.join(' ')).toMatch(/primaryTasks inferred as schedule/);
    expect(r.ranking!.explanation).not.toMatch(/requested tasks/);
  });

  it('no candidate matches a product type that was not given', () => {
    const r = recommendDesignDirection({ productDescription: 'A weather app with big temperature typography and calm colors', tone: ['calm'], candidateLimit: 10 }, repo);
    expect(r.resolvedContext.normalizedFacets[0]).toContain('other (default)');
    expect(r.candidates.flatMap((c) => c.matched)).not.toContain('Fits other');
  });

  it('"data" in a data-journalism brief does not trigger notIdealFor "high-density data"', () => {
    const ctx = normalizeContext({ productDescription: 'Content hub for a data journalism team', productType: 'content-editorial', tone: ['editorial'] }, repo);
    expect(scoreStyle(ctx, repo.getStyle('fusion-grain-mono')!, repo).evidence.notIdeal).toBe(0);
  });
});
