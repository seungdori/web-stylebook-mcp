// Invariants of recommend_design_direction: public contract, determinism, honest ties, truthful explanations,
// README claims and the phrase-matching guards. Briefs are generated from a fixed seed, never from Math.random.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { normalizeContext } from '../src/recommendation/normalize-context.js';
import { scoreStyle } from '../src/recommendation/scoring.js';
import type { ProductContext } from '../src/recommendation/types.js';
import { repoWith, repoWithClones } from './helpers/catalog-variants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = CatalogRepository.load();
const fixture = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'recommend-briefs.v1.json'), 'utf8')) as {
  briefs: { id: string; brief: ProductContext }[];
};

const headline: ProductContext = {
  productDescription: 'High-density monitoring dashboard for SREs, watched all day on call',
  productType: 'operational-saas',
  tone: ['calm', 'technical'],
  density: 'high',
  usageFrequency: 'daily',
  avoid: ['cyberpunk'],
};

// deterministic pseudo-random brief generator (no Math.random)
function makeBriefs(count: number, seed: number): ProductContext[] {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const types = repo.data.ontology.productTypes.map((t) => t.value).filter((v) => v !== 'other');
  const tones = ['calm', 'technical', 'trustworthy', 'premium', 'editorial', 'playful', 'bold', 'experimental'] as const;
  const descs = [
    'Dashboard for operations team monitoring services', 'Online store for handmade goods', 'Personal blog about travel and food',
    'Landing page for a startup launch', 'Internal wiki for engineers', 'Portfolio for an architect', 'AI chat assistant for lawyers',
    'Medical records portal for clinics', 'Documentation site for an SDK with search and guides',
  ];
  const out: ProductContext[] = [];
  for (let i = 0; i < count; i++) {
    const t = new Set<(typeof tones)[number]>();
    const n = 1 + Math.floor(rnd() * 2);
    while (t.size < n) t.add(pick(tones));
    out.push({
      productDescription: pick(descs),
      productType: pick(types) as ProductContext['productType'],
      tone: [...t],
      density: pick(['low', 'medium', 'high'] as const),
      usageFrequency: pick(['one-off', 'occasional', 'daily'] as const),
      trustSensitivity: pick(['low', 'medium', 'high'] as const),
    });
  }
  return out;
}

describe('1. public contract stays backward compatible', () => {
  it('keeps the recommend_design_direction input schema and adds no output schema', async () => {
    const server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'review', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    const tool = (await client.listTools()).tools.find((t) => t.name === 'recommend_design_direction')!;
    const schema = tool.inputSchema as { properties: Record<string, any>; required?: string[] };
    expect(Object.keys(schema.properties).sort()).toEqual([
      'audience', 'avoid', 'candidateLimit', 'constraints', 'density', 'locale', 'primaryTasks',
      'productDescription', 'productType', 'tone', 'trustSensitivity', 'usageFrequency',
    ]);
    expect(schema.required).toEqual(['productDescription']);
    expect(schema.properties.tone.items.enum).toEqual(['calm', 'technical', 'trustworthy', 'premium', 'editorial', 'playful', 'bold', 'experimental']);
    expect(schema.properties.candidateLimit).toMatchObject({ type: 'integer', minimum: 1, maximum: 10 });
    expect((tool as any).outputSchema).toBeUndefined();
    await client.close();
  });

  it('returns every legacy output field unchanged in shape; ranking and mustHaves are the only new top-level fields and structure the only new candidate field', async () => {
    const server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'review', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    const res: any = await client.callTool({ name: 'recommend_design_direction', arguments: headline });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent;
    expect(Object.keys(sc).sort()).toEqual(['candidates', 'confidence', 'guidance', 'mustHaves', 'pairings', 'ranking', 'rejected', 'resolvedContext']);
    expect(Object.keys(sc.candidates[0]).sort()).toEqual(['cautions', 'differentiators', 'matched', 'resourceUri', 'score', 'scoreBreakdown', 'structure', 'styleId']);
    for (const legacy of ['product', 'task', 'tone', 'density', 'usage', 'trust', 'constraint']) expect(sc.candidates[0].scoreBreakdown).toHaveProperty(legacy);
    expect(Object.keys(sc.resolvedContext).sort()).toEqual(['assumptions', 'missingInformation', 'normalizedFacets']);
    expect(Object.keys(sc.ranking).sort()).toEqual(['explanation', 'gap', 'reasonCodes', 'runnerUp', 'tied', 'winner']);
    const text = res.content.find((c: any) => c.type === 'text').text as string;
    expect(text).toContain('Ranking: ');
    expect(text).toContain(sc.ranking.explanation);
    // the structured-error envelope for bad input is unchanged
    const bad: any = await client.callTool({ name: 'recommend_design_direction', arguments: { productDescription: 'x', candidateLimit: 99 } });
    expect(bad.isError).toBe(true);
    await client.close();
  });

  it('keeps the recommendation code offline and free of clocks and randomness', () => {
    for (const f of ['scoring', 'lexicon', 'rank-reason', 'normalize-context']) {
      const src = readFileSync(join(root, 'src', 'recommendation', `${f}.ts`), 'utf8');
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date|fetch\(|process\.env|node:http|node:net|node:crypto/);
    }
  });
});

describe('2. determinism', () => {
  const briefs = [...fixture.briefs.map((b) => b.brief), ...makeBriefs(150, 7)];

  it('returns byte-identical results for repeated calls and every locale orders candidates the same way', () => {
    for (const b of briefs) {
      const a = JSON.stringify(recommendDesignDirection({ ...b, candidateLimit: 10 }, repo));
      expect(JSON.stringify(recommendDesignDirection({ ...b, candidateLimit: 10 }, repo))).toBe(a);
      const order = (loc: 'ko' | 'ja') => recommendDesignDirection({ ...b, candidateLimit: 10, locale: loc }, repo).candidates.map((c) => [c.styleId, c.score]);
      const en = recommendDesignDirection({ ...b, candidateLimit: 10 }, repo).candidates.map((c) => [c.styleId, c.score]);
      expect(order('ko')).toEqual(en);
      expect(order('ja')).toEqual(en);
    }
  });

  it('does not depend on the order of the catalog array', () => {
    const reversed = repoWith(repo, [...repo.allStyles()].reverse());
    for (const b of briefs) {
      expect(JSON.stringify(recommendDesignDirection({ ...b, candidateLimit: 10 }, reversed)))
        .toBe(JSON.stringify(recommendDesignDirection({ ...b, candidateLimit: 10 }, repo)));
    }
  });

  it('candidateLimit only truncates: candidates are a prefix and ranking/pairings/confidence do not move', () => {
    for (const b of briefs.slice(0, 60)) {
      const full = recommendDesignDirection({ ...b, candidateLimit: 10 }, repo);
      for (const k of [1, 3, 5]) {
        const r = recommendDesignDirection({ ...b, candidateLimit: k }, repo);
        expect(r.candidates).toEqual(full.candidates.slice(0, k));
        expect(r.ranking).toEqual(full.ranking);
        expect(r.pairings).toEqual(full.pairings);
        expect(r.confidence).toBe(full.confidence);
      }
    }
  });

  it('is insensitive to the case of the description and to the order of constraints and avoid terms', () => {
    for (const b of makeBriefs(60, 11)) {
      const base = JSON.stringify(recommendDesignDirection({ ...b, candidateLimit: 10 }, repo).candidates);
      expect(JSON.stringify(recommendDesignDirection({ ...b, productDescription: `  ${b.productDescription.toUpperCase()} `, candidateLimit: 10 }, repo).candidates)).toBe(base);
      const x = recommendDesignDirection({ ...b, constraints: ['high-contrast-required', 'reduced-motion-required'], avoid: ['neon', 'retro'], candidateLimit: 10 }, repo);
      const y = recommendDesignDirection({ ...b, constraints: ['reduced-motion-required', 'high-contrast-required'], avoid: ['retro', 'neon'], candidateLimit: 10 }, repo);
      expect(JSON.stringify(x)).toBe(JSON.stringify(y));
    }
  });

  it('never raises a score because the caller added an avoid term', () => {
    for (const b of makeBriefs(80, 21)) {
      const before = recommendDesignDirection({ ...b, candidateLimit: 10 }, repo);
      const after = recommendDesignDirection({ ...b, avoid: ['glass'], candidateLimit: 10 }, repo);
      if (after.compromised) continue;
      for (const c of after.candidates) {
        const prev = before.candidates.find((x) => x.styleId === c.styleId);
        if (prev) expect(c.score).toBeLessThanOrEqual(prev.score);
      }
    }
  });
});

describe('3. ties are reported, not hidden', () => {
  const quiet = repo.getStyle('quiet-utility')!;

  it('three identical styles tie: ranking.tied, gap 0, TIED code, guidance counts all tied styles', () => {
    const twins = repoWithClones(repo, 'quiet-utility', ['a', 'b', 'c'].map((s) => ({ id: `quiet-twin-${s}` })));
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, twins);
    expect(r.candidates.slice(0, 4).map((c) => c.score)).toEqual([r.candidates[0]!.score, r.candidates[0]!.score, r.candidates[0]!.score, r.candidates[0]!.score]);
    expect(r.ranking).toMatchObject({ tied: true, gap: 0, reasonCodes: ['TIED'] });
    expect(r.guidance).toMatch(/4 candidates are tied at the top/);
    expect(r.candidates.slice(0, 4).map((c) => c.styleId)).toEqual(['quiet-twin-a', 'quiet-twin-b', 'quiet-twin-c', 'quiet-utility']);
  });

  it('a displayed-score tie with a sub-cent unrounded difference is reported as a tie, ordered by unrounded score', () => {
    // an unshared tag dilutes the overlap with the avoided style: a sub-cent change in the unrounded score
    const alt = repoWithClones(repo, 'quiet-utility', [{ id: 'quiet-clone', edit: (style) => { style.tags = [...style.tags, 'unrelated-tag']; } }]);
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, alt);
    const [a, b] = r.candidates;
    expect(a!.score).toBe(b!.score);
    expect(r.ranking!.tied).toBe(true);
    const ctx = normalizeContext(headline, alt);
    const ta = scoreStyle(ctx, alt.getStyle(a!.styleId)!, alt).total;
    const tb = scoreStyle(ctx, alt.getStyle(b!.styleId)!, alt).total;
    expect(ta).toBeGreaterThan(tb);
    expect(r.ranking!.explanation).toMatch(/not a preference/);
  });

  it('a one-cent difference is not called a tie', () => {
    const alt = repoWithClones(repo, 'quiet-utility', [{ id: 'quiet-clone', edit: (style) => { style.bestFor = [...style.bestFor, 'something unrelated']; } }]);
    const r = recommendDesignDirection({ ...headline, candidateLimit: 10 }, alt);
    expect(r.candidates[0]!.styleId).toBe('quiet-utility');
    expect(r.ranking).toMatchObject({ tied: false, gap: 0.01, winner: 'quiet-utility', runnerUp: 'quiet-clone' });
    expect(r.guidance).not.toMatch(/tied/);
  });

  it('omits ranking when only one style survives', () => {
    const r = recommendDesignDirection({ productDescription: 'Ops dashboard', productType: 'operational-saas' }, repoWith(repo, [quiet]));
    expect(r.candidates).toHaveLength(1);
    expect(r.ranking).toBeUndefined();
  });
});

describe('4. ranking explanations tell the truth about the catalog', () => {
  const all = [...fixture.briefs.map((b) => b.brief), ...makeBriefs(300, 99)];

  it('never prints undefined/NaN/null placeholders in any locale', () => {
    for (const b of all) {
      for (const locale of ['en', 'ko', 'ja'] as const) {
        const ex = recommendDesignDirection({ ...b, locale, candidateLimit: 3 }, repo).ranking!.explanation;
        expect(ex, `${locale}: ${ex}`).not.toMatch(/undefined|NaN|\bnull\b|\[object|#0\b|; ;|: ;|,\s*,/);
      }
    }
  });

  it('product counts, facet spans, upkeep levels and tone slots quoted in English explanations match the catalog', () => {
    let quoted = 0;
    for (const b of all) {
      const r = recommendDesignDirection({ ...b, candidateLimit: 3 }, repo);
      const ctx = normalizeContext(b, repo);
      const ex = r.ranking!.explanation;
      for (const m of ex.matchAll(/([a-z0-9-]+) lists ([a-z-]+) among (\d+) product types, ([a-z0-9-]+) among (\d+)/g)) {
        const [, sa, pt, na, sb, nb] = m;
        expect(repo.getStyle(sa!)!.recommendationFacets.productTypes.length).toBe(+na!);
        expect(repo.getStyle(sb!)!.recommendationFacets.productTypes.length).toBe(+nb!);
        expect(repo.getStyle(sa!)!.recommendationFacets.productTypes).toContain(pt);
        expect(repo.getStyle(sb!)!.recommendationFacets.productTypes).toContain(pt);
        expect(pt).toBe(ctx.productType.value);
        quoted++;
      }
      for (const m of ex.matchAll(/(?:requested|assumed) (density|usage|trust) ([\w-]+): ([a-z0-9-]+) spans ([a-z/-]+), ([a-z0-9-]+) spans ([a-z/-]+)/g)) {
        const [, kind, level, s1, r1, s2, r2] = m;
        const key = kind === 'density' ? 'density' : kind === 'usage' ? 'usageFrequency' : 'trust';
        expect((repo.getStyle(s1!)!.recommendationFacets as any)[key].join('/')).toBe(r1);
        expect((repo.getStyle(s2!)!.recommendationFacets as any)[key].join('/')).toBe(r2);
        const resolved = kind === 'density' ? ctx.density.value : kind === 'usage' ? ctx.usageFrequency.value : ctx.trustSensitivity.value;
        expect(resolved).toBe(level);
        quoted++;
      }
      for (const m of ex.matchAll(/lighter upkeep for ([\w-]+) use \(([a-z0-9-]+): motion (\w+), maintenance (\w+); ([a-z0-9-]+): motion (\w+), maintenance (\w+)\)/g)) {
        const [, usage, s1, m1, k1, s2, m2, k2] = m;
        const f1 = repo.getStyle(s1!)!.recommendationFacets;
        const f2 = repo.getStyle(s2!)!.recommendationFacets;
        expect([f1.motionIntensity, f1.maintenanceComplexity, f2.motionIntensity, f2.maintenanceComplexity]).toEqual([m1, k1, m2, k2]);
        expect(usage).toBe(ctx.usageFrequency.value);
        quoted++;
      }
      for (const m of ex.matchAll(/([a-z]+) is #(\d+) in ([a-z0-9-]+)'s tones but #(\d+) in ([a-z0-9-]+)'s/g)) {
        const [, tone, p1, s1, p2, s2] = m;
        expect(repo.getStyle(s1!)!.recommendationFacets.tones.indexOf(tone as never) + 1).toBe(+p1!);
        expect(repo.getStyle(s2!)!.recommendationFacets.tones.indexOf(tone as never) + 1).toBe(+p2!);
        expect(ctx.tones.value).toContain(tone);
        quoted++;
      }
    }
    expect(quoted).toBeGreaterThan(100);
  });

  it('reason codes only ever come from the documented set and are non-empty unless tied or nearly identical', () => {
    const known = new Set(['PRODUCT_FOCUS', 'USE_CASE_FIT', 'TASK_FIT', 'TONE_FIT', 'DENSITY_FIT', 'USAGE_FIT', 'TRUST_FIT', 'CONSTRAINT_FIT', 'FEWER_CAUTIONS', 'LOWER_UPKEEP', 'FARTHER_FROM_AVOIDED', 'TIED']);
    let nearlyIdentical = 0;
    for (const b of all) {
      const rk = recommendDesignDirection({ ...b, candidateLimit: 3 }, repo).ranking!;
      for (const c of rk.reasonCodes) expect(known.has(c), c).toBe(true);
      if (!rk.tied && rk.reasonCodes.length === 0) { nearlyIdentical++; expect(rk.explanation).toMatch(/nearly identical/); }
    }
    expect(nearlyIdentical).toBeLessThan(all.length * 0.02);
  });
});

describe('5. README claims match the real tool', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const readmeKo = readFileSync(join(root, 'README.ko.md'), 'utf8');

  it('says "29 in total" / "모두 29개" and the real rejected count is 29', () => {
    const real = recommendDesignDirection(headline, repo).rejected.length;
    expect(readme).toContain(`// ${real} in total, three shown`);
    expect(readmeKo).toContain(`모두 ${real}개, 3개만 표시`);
  });

  it('shows the token values and the "0 WCAG contrast warnings" that compose_design_tokens really returns for quiet-utility', async () => {
    const server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'review', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    const res: any = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'quiet-utility', format: 'css-variables' } });
    const css = String(res.structuredContent.rendered);
    expect(res.structuredContent.warnings).toEqual([]);
    for (const doc of [readme, readmeKo]) {
      for (const name of ['canvas', 'text', 'accent', 'border']) {
        const shown = new RegExp(`--color-${name}:\\s+(#[0-9a-f]{6})`).exec(doc.slice(doc.indexOf('compose_design_tokens(style: "quiet-utility"')))?.[1];
        const real = new RegExp(`--color-${name}:\\s+(#[0-9a-f]{6})`).exec(css)?.[1];
        expect(shown, `${name} in README`).toBeDefined();
        expect(shown).toBe(real);
      }
    }
    await client.close();
  });
});

describe('6. guards that keep the notIdealFor matcher honest', () => {
  it('one incidental word of a long notIdealFor phrase does not penalize the style', () => {
    // fusion-soft-inflate: notIdealFor "fast small-screen consumer apps"; the brief only shares "small".
    const ctx = normalizeContext({ productDescription: 'Online shop for a small-batch ceramics brand', productType: 'commerce', tone: ['calm'] }, repo);
    const sc = scoreStyle(ctx, repo.getStyle('fusion-soft-inflate')!, repo);
    expect(sc.evidence.notIdeal).toBe(0);
    expect(sc.terms.cautions).toBe(-0);
  });

  it('a brief that repeats the whole notIdealFor phrase does penalize', () => {
    // mesh-gradient: notIdealFor "craft or wellness brands"
    const ctx = normalizeContext({ productDescription: 'Online shop for a craft and wellness brand', productType: 'commerce', tone: ['calm'] }, repo);
    const sc = scoreStyle(ctx, repo.getStyle('mesh-gradient')!, repo);
    expect(sc.evidence.notIdeal).toBe(1);
    expect(sc.terms.cautions).toBeCloseTo(-0.08, 6);
  });
});

describe('7. regressions found in review', () => {
  it('a marketing word in an analytics brief does not move the best-fitting style by a full penalty', () => {
    const score = (description: string) => recommendDesignDirection({
      productDescription: description, productType: 'data-analytics', tone: ['technical', 'calm'], density: 'high', usageFrequency: 'daily', candidateLimit: 10,
    }, repo).candidates.find((c) => c.styleId === 'quiet-utility')!.score;
    expect(Math.abs(score('Marketing analytics dashboard for growth teams') - score('Growth analytics dashboard for revenue teams'))).toBeLessThan(0.04);
  });

  it('the ranking never calls a defaulted level "requested"', () => {
    const r = recommendDesignDirection({
      productDescription: 'Long-form essay blog for a small independent publication; readers come for the writing a few times a week',
      productType: 'content-editorial', tone: ['editorial', 'calm'], density: 'low', usageFrequency: 'occasional',
    }, repo);
    expect(r.resolvedContext.assumptions.join(' ')).toMatch(/trustSensitivity defaulted/);
    expect(r.ranking!.explanation).not.toMatch(/requested trust/);
  });
});
