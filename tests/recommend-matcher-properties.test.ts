// Properties of the phrase matcher, the product fit and the ranking explanations, checked over the whole catalog or a
// wider sample of briefs. Briefs come from a fixed seed, never from Math.random.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { normalizeContext } from '../src/recommendation/normalize-context.js';
import { scoreStyle } from '../src/recommendation/scoring.js';
import { contentKeys, distinctiveKeys, useCaseEvidence, wordKey } from '../src/recommendation/lexicon.js';
import type { ProductContext } from '../src/recommendation/types.js';
import { DENSITY_LEVELS, TONES as TONE_VALUES, TRUST_LEVELS, USAGE_FREQUENCIES } from '../src/types.js';
import { repoWithClones } from './helpers/catalog-variants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = CatalogRepository.load();
const fixture = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'recommend-briefs.v1.json'), 'utf8')) as {
  briefs: { id: string; brief: ProductContext; expect: { top1: string[]; minGap: number } }[];
};

const TONES = ['calm', 'technical', 'trustworthy', 'premium', 'editorial', 'playful', 'bold', 'experimental'] as const;
const LEVELS = ['low', 'medium', 'high'] as const;
const USES = ['one-off', 'occasional', 'daily'] as const;
const GENERIC = ['app', 'application', 'company', 'customer', 'feature', 'interface', 'online', 'page', 'people', 'platform', 'product', 'service', 'site', 'team', 'tool', 'ui', 'user', 'web', 'website'];

// One description per product type whose wording agrees with the type, so a brief is plausible as a whole.
const COHERENT: Record<string, string> = {
  'operational-saas': 'Monitoring dashboard for an operations team', 'developer-tool': 'CLI and SDK for developers to configure deployments',
  documentation: 'API reference and guides for developers', 'data-analytics': 'Analytics dashboard with charts and reports',
  'security-console': 'Security console for threat monitoring and audit log review', 'finance-admin': 'Billing and ledger admin for a finance team',
  'healthcare-portal': 'Patient portal for booking appointments and viewing results', commerce: 'Online store selling clothing',
  'ai-chat': 'AI chat assistant for customer questions', 'content-editorial': 'Magazine and blog publication',
  'knowledge-base': 'Internal wiki and help center', portfolio: 'Portfolio site for a designer',
  campaign: 'Landing page for a product launch', 'consumer-app': 'Mobile app for tracking habits',
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
  return Array.from({ length: count }, () => {
    const productType = pick(types) as NonNullable<ProductContext['productType']>;
    const tone = new Set<(typeof TONES)[number]>();
    const n = 1 + Math.floor(rnd() * 2);
    while (tone.size < n) tone.add(pick(TONES));
    return { productDescription: COHERENT[productType]!, productType, tone: [...tone], density: pick(LEVELS), usageFrequency: pick(USES), trustSensitivity: pick(LEVELS) };
  });
}

// Words from the ontology's product-type values and aliases: the matcher never lets one of them fire a phrase alone.
const DOMAIN = new Set(
  repo.ontology.productTypes.flatMap((t) => [t.value, ...t.aliases])
    .flatMap((name) => name.normalize('NFKC').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(wordKey)),
);

const phrasesOf = (kind: 'bestFor' | 'notIdealFor') =>
  repo.allStyles().flatMap((style) => style[kind].map((phrase) => ({ style, phrase })));

const evidence = (styleId: string, description: string, productType: Parameters<typeof useCaseEvidence>[2] = 'other') =>
  useCaseEvidence(repo.getStyle(styleId)!, new Set(contentKeys(description)), productType, repo);

// Words the facet factors already score; a notIdealFor phrase that holds one is not matched lexically.
const FACET_KEYS = new Set([...TONE_VALUES, ...DENSITY_LEVELS, ...USAGE_FREQUENCIES, ...TRUST_LEVELS, 'dense', 'density'].map(wordKey));
const mentionsFacet = (phrase: string) => phrase.normalize('NFKC').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).some((w) => FACET_KEYS.has(wordKey(w)));

describe('A. the phrase matcher holds its rules across the whole catalog', () => {
  it('generic words never change how much credit a bestFor phrase earns', () => {
    const generic = GENERIC.map(wordKey);
    for (const { style, phrase } of phrasesOf('bestFor')) {
      const request = new Set(distinctiveKeys(phrase));
      const padded = new Set([...request, ...generic]);
      const [a, b] = [useCaseEvidence(style, request, 'other', repo), useCaseEvidence(style, padded, 'other', repo)];
      expect([b.lexical, b.phrase], `${style.id} bestFor "${phrase}"`).toEqual([a.lexical, a.phrase]);
    }
  });

  it('a product-kind word on its own never earns full bestFor credit, and a notIdealFor entry needs the whole phrase', () => {
    for (const style of repo.allStyles()) {
      for (const kind of ['bestFor', 'notIdealFor'] as const) {
        for (const key of new Set(style[kind].flatMap((p) => distinctiveKeys(p)))) {
          const ev = useCaseEvidence(style, new Set([key]), 'other', repo);
          if (DOMAIN.has(key)) expect(ev.lexical, `${style.id} ${kind} on "${key}"`).toBeLessThan(1);
          if (ev.notIdeal === 1) expect(contentKeys(ev.notIdealPhrase!), `${style.id} notIdealFor "${ev.notIdealPhrase}" fired on "${key}" alone`).toEqual([key]);
        }
      }
    }
  });

  it('repeating a phrase word for word earns full credit unless the phrase is one product-kind word, has no distinctive word, or names a facet level', () => {
    let capped = 0;
    for (const kind of ['bestFor', 'notIdealFor'] as const) {
      for (const { style, phrase } of phrasesOf(kind)) {
        const core = distinctiveKeys(phrase);
        if (core.length === 0) continue;
        const ev = useCaseEvidence(style, new Set(contentKeys(phrase)), 'other', repo);
        const full = kind === 'bestFor' ? ev.lexical === 1 : ev.notIdeal === 1;
        const expectedFull = kind === 'bestFor' ? core.length >= 2 || !DOMAIN.has(core[0]!) : !mentionsFacet(phrase);
        if (!expectedFull) capped++;
        expect(full, `${style.id} ${kind} "${phrase}"`).toBe(expectedFull);
      }
    }
    expect(capped).toBeGreaterThan(40);
  });
});

describe('B. product fit', () => {
  it('lists every curated primary pick among the style\'s own product types, so the bonus never lifts an unlisted style', () => {
    let links = 0;
    for (const archetype of repo.data.productArchetypes) {
      for (const id of archetype.recommendedPrimaryStyleIds) {
        links++;
        expect(repo.getStyle(id)!.recommendationFacets.productTypes, `${archetype.id} -> ${id}`).toContain(archetype.id);
      }
    }
    expect(links).toBeGreaterThan(30);
  });

  it('gives a primary pick a full fit; the most that is worth over a listed style is 0.028 of score', () => {
    for (const archetype of repo.data.productArchetypes) {
      const ctx = normalizeContext({ productDescription: COHERENT[archetype.id] ?? 'A product', productType: archetype.id as never }, repo);
      for (const id of archetype.recommendedPrimaryStyleIds) {
        const style = repo.getStyle(id)!;
        expect(scoreStyle(ctx, style, repo).fits.product, `${archetype.id} -> ${id}`).toBe(1);
        const escapedDiscount = 0.02 * (style.recommendationFacets.productTypes.length - 1);
        expect(0.2 * escapedDiscount, `${id} lists ${style.recommendationFacets.productTypes.length} types`).toBeLessThanOrEqual(0.028 + 1e-9);
      }
    }
  });

  it('does not depend on the order a style lists its product types, measured on the unrounded fit', () => {
    const reversed = repoWithClones(repo, 'notion-style', [{ id: 'notion-style-reversed', edit: (s) => { s.recommendationFacets.productTypes.reverse(); } }]);
    const ctx = normalizeContext({ productDescription: COHERENT['operational-saas']!, productType: 'operational-saas', tone: ['calm', 'technical'], density: 'high', usageFrequency: 'daily' }, reversed);
    const a = scoreStyle(ctx, reversed.getStyle('notion-style')!, reversed);
    const b = scoreStyle(ctx, reversed.getStyle('notion-style-reversed')!, reversed);
    expect(a.fits.product).toBeLessThan(1);
    expect(b.fits.product).toBe(a.fits.product);
    expect(b.total).toBe(a.total);
  });

  it('leaves most winners to non-primary styles and keeps the curated avoid lists out of the top five', () => {
    const briefs = coherentBriefs(300, 20261018);
    const primaryWins = briefs.filter((b) => {
      const winner = recommendDesignDirection({ ...b, candidateLimit: 1 }, repo).candidates[0]!.styleId;
      return repo.getProduct(b.productType!)!.recommendedPrimaryStyleIds.includes(winner);
    }).length;
    expect(primaryWins / briefs.length).toBeLessThan(0.6);
    for (const archetype of repo.data.productArchetypes) {
      const r = recommendDesignDirection({ productDescription: COHERENT[archetype.id]!, productType: archetype.id as never, candidateLimit: 5 }, repo);
      for (const avoided of archetype.avoidStyleIds) expect(r.candidates.map((c) => c.styleId), `${archetype.id} avoids ${avoided}`).not.toContain(avoided);
    }
  });
});

describe('C. the explanations agree with the evidence', () => {
  const briefs = coherentBriefs(400, 777001);

  it('says "matches the brief" only for full credit and "shares a word" only for half credit', () => {
    let full = 0;
    let half = 0;
    for (const b of briefs) {
      const r = recommendDesignDirection({ ...b, candidateLimit: 3 }, repo);
      const ctx = normalizeContext(b, repo);
      const ev = [r.ranking!.winner, r.ranking!.runnerUp].map((id) => scoreStyle(ctx, repo.getStyle(id)!, repo).evidence);
      const text = r.ranking!.explanation;
      const matches = /bestFor "([^"]+)" matches the brief/.exec(text);
      const shares = /bestFor "([^"]+)" shares a word with the brief/.exec(text);
      if (matches) { full++; expect(ev.find((e) => e.phrase === matches[1])?.lexical, text).toBe(1); }
      if (shares) { half++; expect(ev.find((e) => e.phrase === shares[1])?.lexical, text).toBe(0.5); }
    }
    expect(full + half).toBeGreaterThan(20);
  });

  it('cites a catalog primary pick only when the catalog says so', () => {
    let cited = 0;
    for (const b of briefs) {
      const text = recommendDesignDirection({ ...b, candidateLimit: 3 }, repo).ranking!.explanation;
      for (const m of text.matchAll(/([a-z0-9-]+) is a catalog primary pick for ([a-z-]+), ([a-z0-9-]+) is not/g)) {
        cited++;
        const primaries = repo.getProduct(m[2]!)!.recommendedPrimaryStyleIds;
        expect(primaries, text).toContain(m[1]);
        expect(primaries, text).not.toContain(m[3]);
        expect(m[2]).toBe(b.productType);
      }
    }
    expect(cited).toBeGreaterThan(10);
  });

  it('calls tasks requested only when the caller stated them, in English, Korean and Japanese', () => {
    const { rnd, pick } = lcg(31337);
    const label = { en: ['requested tasks', 'inferred tasks'], ko: ['요청한 작업', '추론한 작업'], ja: ['要求タスク', '推定タスク'] } as const;
    const stated = [undefined, ['monitor'], ['author', 'search'], ['review']];
    let said = 0;
    for (let i = 0; i < 300; i++) {
      const base = pick(briefs);
      const primaryTasks = pick(stated);
      const brief: ProductContext = { ...base, ...(primaryTasks && rnd() < 0.8 ? { primaryTasks } : {}), productDescription: pick(['Travel booking website for budget trips', 'Internal wiki for engineers to search and write articles', base.productDescription]) };
      const ctx = normalizeContext(brief, repo);
      for (const locale of ['en', 'ko', 'ja'] as const) {
        const text = recommendDesignDirection({ ...brief, locale, candidateLimit: 3 }, repo).ranking!.explanation;
        const [requested, inferred] = label[locale];
        if (text.includes(requested)) { said++; expect(ctx.primaryTaskTags.source, text).toBe('explicit'); }
        if (text.includes(inferred)) { said++; expect(ctx.primaryTaskTags.source, text).toBe('inferred'); }
      }
    }
    expect(said).toBeGreaterThan(50);
  });
});

describe('D. the premise behind tone order holds in the catalog (the premise behind product-type order did not)', () => {
  it('names the first-listed tone in a style\'s own prose more often than the second, and the second more often than the third', () => {
    const aliases = new Map(repo.ontology.tones.map((t) => [t.value, [t.value, ...t.aliases.filter((a) => /^[a-z -]+$/i.test(a))].map((a) => a.toLowerCase())]));
    const seen = [0, 0, 0];
    const total = [0, 0, 0];
    for (const style of repo.allStyles()) {
      const prose = `${style.summary.en} ${style.description.en} ${style.tags.join(' ')}`.toLowerCase();
      style.recommendationFacets.tones.slice(0, 3).forEach((tone, i) => {
        total[i]!++;
        if (aliases.get(tone)!.some((w) => new RegExp(`\\b${w.replace(/-/g, '[- ]')}\\w*`).test(prose))) seen[i]!++;
      });
    }
    const share = seen.map((n, i) => n / total[i]!);
    expect(share[0]!).toBeGreaterThan(share[1]!);
    expect(share[1]!).toBeGreaterThan(share[2]!);
  });
});

describe('E. regressions found in the final review', () => {
  it('"form" in "demo request form" does not fire notIdealFor "editorial long-form"', () => {
    const brief = 'Marketing site for a B2B analytics SaaS with pricing and a demo request form';
    expect(evidence('fusion-neon-swiss', brief).notIdeal).toBe(0);
    expect(evidence('fusion-product-swiss', brief).notIdeal).toBe(0);
  });

  it('"motion" in a motion-graphics portfolio does not fire notIdealFor "low-motion contexts"', () => {
    expect(evidence('framer-motion', 'Portfolio for a motion graphics designer showing reels').notIdeal).toBe(0);
  });

  it('"trust" in a trust-and-safety console does not fire notIdealFor "finance trust products"', () => {
    expect(evidence('brutalist-grid', 'Trust and safety review console for content moderators').notIdeal).toBe(0);
  });

  it('"brand" in a ceramics brand does not fire notIdealFor "luxury brand sites"', () => {
    const brief = fixture.briefs.find((b) => b.id === 'craft-wellness-store')!.brief;
    expect(evidence('bento-bloom', brief.productDescription).notIdeal).toBe(0);
  });

  it('a brief that repeats "developer tools" with no product type still warns against claymorphism', () => {
    const ctx = normalizeContext({ productDescription: 'Developer tools for CI' }, repo);
    expect(ctx.productType.value).toBe('other');
    expect(scoreStyle(ctx, repo.getStyle('claymorphism')!, repo).evidence.notIdeal).toBe(1);
  });

  it('confidence is not high when the product type is other', () => {
    const r = recommendDesignDirection({
      productDescription: 'Law firm website with practice areas', productType: 'other', tone: ['trustworthy', 'premium'],
      density: 'medium', usageFrequency: 'occasional', trustSensitivity: 'high',
    }, repo);
    expect(r.confidence).not.toBe('high');
  });
});
