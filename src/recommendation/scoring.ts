// Recommendation scoring engine. Normative implementation of 05 §4-10.
// Deterministic: fixed-precision rounding, codepoint tie-break, fixed accumulation order.

import type {
  CatalogStyle, ProductType, Ontology, ConstraintMapping,
} from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import type {
  ResolvedContext, ReasonCode, StyleCandidate, EvidenceResult, RejectedStyle, Pairing,
} from './types.js';

const W = { product: 0.24, task: 0.18, tone: 0.16, density: 0.12, usage: 0.10, trust: 0.10, constraint: 0.10 } as const;
const ORDINAL: Record<string, number> = { low: 0, medium: 1, high: 2, 'one-off': 0, occasional: 1, daily: 2 };

function round3(x: number): number { return Math.round(x * 1000) / 1000; }
function round2(x: number): number { return Math.round(x * 100) / 100; }
function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

function ordDist(a: string, set: string[]): number {
  if (!set.length) return 1;
  const av = ORDINAL[a] ?? 1;
  return Math.min(...set.map((s) => Math.abs(av - (ORDINAL[s] ?? 1))));
}

/** Symmetric productType adjacency over the catalog map. */
function adjacent(p: ProductType, ont: Ontology): Set<ProductType> {
  const out = new Set<ProductType>(ont.productAdjacency[p] ?? []);
  for (const [k, vs] of Object.entries(ont.productAdjacency)) {
    if (vs.includes(p)) out.add(k as ProductType);
  }
  return out;
}

interface FitBreakdown {
  product: number; task: number; tone: number; density: number; usage: number; trust: number; constraint: number;
}

function computeFits(ctx: ResolvedContext, s: CatalogStyle, ont: Ontology): FitBreakdown {
  const f = s.recommendationFacets;

  // 4.1 productFit
  let product: number;
  const pt = ctx.productType.value;
  if (f.productTypes.includes(pt)) product = 1.0;
  else if (pt === 'other') product = 0.5;
  else {
    const adj = adjacent(pt, ont);
    product = f.productTypes.some((x) => adj.has(x)) ? 0.5 : 0.2;
  }

  // 4.2 taskFit
  const tasks = ctx.primaryTaskTags.value;
  const strengthBag = new Set(f.strengths.map((x) => x.toLowerCase()));
  let task: number;
  if (!tasks.length) task = 0.5;
  else {
    const m = tasks.filter((t) => strengthBag.has(t.toLowerCase())).length;
    task = clamp01(m / tasks.length);
  }

  // 4.3 toneFit
  const ctxTones = ctx.tones.value;
  let tone: number;
  if (!ctxTones.length) tone = 0.4;
  else {
    const inter = ctxTones.filter((t) => f.tones.includes(t)).length;
    const base = inter / ctxTones.length;
    const conflict = 0.15 * ctxTones.filter((t) => f.antiTones.includes(t)).length;
    tone = clamp01(base - conflict);
  }

  // 4.4 densityFit
  const density = f.density.includes(ctx.density.value)
    ? 1.0 : Math.max(0, 1 - 0.5 * ordDist(ctx.density.value, f.density));

  // 4.5 usageFit
  const usage = f.usageFrequency.includes(ctx.usageFrequency.value)
    ? 1.0 : Math.max(0, 1 - 0.5 * ordDist(ctx.usageFrequency.value, f.usageFrequency));

  // 4.6 trustFit (asymmetric)
  const req = ORDINAL[ctx.trustSensitivity.value] ?? 1;
  const styleMax = f.trust.length ? Math.max(...f.trust.map((t) => ORDINAL[t] ?? 1)) : 1;
  let trust: number;
  if (f.trust.includes(ctx.trustSensitivity.value)) trust = 1.0;
  else if (req <= styleMax) trust = 0.8;
  else trust = Math.max(0, 1 - 0.5 * (req - styleMax));

  // 4.7 constraintFit
  let constraint: number;
  if (!ctx.constraints.length) constraint = 1.0;
  else {
    const violated = ctx.constraints.filter((c) => constraintViolates(c, s, ont)).length;
    constraint = clamp01(1 - violated / ctx.constraints.length);
  }

  return {
    product: round3(product), task: round3(task), tone: round3(tone), density: round3(density),
    usage: round3(usage), trust: round3(trust), constraint: round3(constraint),
  };
}

// generic qualifier words that are NOT distinguishing — must not drive a match
// (e.g. "required" is shared by reduced-motion-required AND high-contrast-required).
const CONSTRAINT_STOPWORDS = new Set([
  'required', 'first', 'only', 'mode', 'friendly', 'preferred', 'ready',
  'support', 'level', 'compliant', 'compliance', 'default', 'please', 'need', 'needs', 'want', 'wants',
]);
function constraintSignature(s: string): string[] {
  return s.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !CONSTRAINT_STOPWORDS.has(w));
}
function mappingsForConstraint(constraintToken: string, ont: Ontology): ConstraintMapping[] {
  const tokenWords = new Set(constraintSignature(constraintToken));
  return ont.constraintMappings.filter((m) => {
    const mWords = constraintSignature(m.constraint);
    // require EVERY distinguishing word of the mapping to be present in the token —
    // a single shared qualifier no longer cross-matches unrelated mappings.
    return mWords.length > 0 && mWords.every((w) => tokenWords.has(w));
  });
}

function constraintViolates(constraintToken: string, s: CatalogStyle, ont: Ontology): boolean {
  const styleRisks = new Set(s.recommendationFacets.risks.map((r) => r.toLowerCase()));
  for (const m of mappingsForConstraint(constraintToken, ont)) {
    if (m.matchesRisks.some((r) => styleRisks.has(r.toLowerCase()))) return true;
  }
  return false;
}

function accessibilityConflict(ctx: ResolvedContext, s: CatalogStyle, ont: Ontology): boolean {
  const styleRisks = new Set(s.recommendationFacets.risks.map((r) => r.toLowerCase()));
  for (const c of ctx.constraints) {
    for (const m of mappingsForConstraint(c, ont)) {
      if (m.hardReject === 'ACCESSIBILITY_CONFLICT' && m.matchesRisks.some((r) => styleRisks.has(r.toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
}

interface HardRejectResult { rejected: boolean; codes: ReasonCode[] }

function hardReject(ctx: ResolvedContext, s: CatalogStyle, repo: CatalogRepository, relaxAesthetic: boolean): HardRejectResult {
  const ont = repo.ontology;
  const codes: ReasonCode[] = [];
  const f = s.recommendationFacets;

  // EXPLICITLY_AVOIDED
  const aestheticAvoided = ctx.avoidedStyleIdsViaAesthetic.includes(s.id);
  if (ctx.avoidStyleIds.includes(s.id) || (!relaxAesthetic && aestheticAvoided)) codes.push('EXPLICITLY_AVOIDED');

  // PRODUCT_NOT_IDEAL via notIdealMap
  const pt = ctx.productType.value;
  const notIdealTypes = new Set<ProductType>();
  for (const phrase of s.notIdealFor) {
    const mapped = repo.notIdealMap[phrase.toLowerCase().trim()] ?? repo.notIdealMap[phrase] ?? [];
    for (const m of mapped) notIdealTypes.add(m);
  }
  // facet wins over a fuzzy notIdealFor phrase: if the style explicitly claims this
  // productType in its facets, a narrow notIdealFor phrase must not hard-reject it (eval #3).
  if (pt !== 'other' && notIdealTypes.has(pt) && !f.productTypes.includes(pt)) codes.push('PRODUCT_NOT_IDEAL');

  // HIGH_TRUST_MISMATCH (gap >= 2)
  const req = ORDINAL[ctx.trustSensitivity.value] ?? 1;
  const styleMax = f.trust.length ? Math.max(...f.trust.map((t) => ORDINAL[t] ?? 1)) : 1;
  if (req - styleMax >= 2) codes.push('HIGH_TRUST_MISMATCH');

  // DAILY_USE_OVERSTIMULATION
  if (ctx.usageFrequency.value === 'daily' && f.motionIntensity === 'high' && f.continuousSpectacle) {
    codes.push('DAILY_USE_OVERSTIMULATION');
  }

  // ACCESSIBILITY_CONFLICT
  if (accessibilityConflict(ctx, s, ont)) codes.push('ACCESSIBILITY_CONFLICT');

  return { rejected: codes.length > 0, codes };
}

function softPenalties(ctx: ResolvedContext, s: CatalogStyle): { total: number; codes: ReasonCode[] } {
  const f = s.recommendationFacets;
  const codes: ReasonCode[] = [];
  let total = 0;
  if (ordDist(ctx.density.value, f.density) >= 2) { total += 0.2; codes.push('DENSITY_MISMATCH'); }
  if ((ctx.usageFrequency.value === 'occasional' || ctx.usageFrequency.value === 'daily')
      && f.motionIntensity === 'high' && !f.continuousSpectacle) { total += 0.15; codes.push('MOTION_INTENSITY_CONFLICT'); }
  if (ctx.tones.value.some((t) => f.antiTones.includes(t))) { total += 0.1; codes.push('TONE_CONFLICT'); }
  if (f.maintenanceComplexity === 'high' && ctx.usageFrequency.value === 'daily') { total += 0.05; codes.push('MAINTENANCE_RISK'); }
  return { total: round3(total), codes };
}

interface ScoredStyle {
  style: CatalogStyle;
  fits: FitBreakdown;
  weightedTotal: number;
  adjustedTotal: number;
  softCodes: ReasonCode[];
  softCount: number;
}

function scoreStyle(ctx: ResolvedContext, s: CatalogStyle, ont: Ontology): ScoredStyle {
  const fits = computeFits(ctx, s, ont);
  return scoreFromFits(ctx, s, fits);
}

function scoreFromFits(ctx: ResolvedContext, s: CatalogStyle, fits: FitBreakdown): ScoredStyle {
  const weightedTotal = round3(
    W.product * fits.product + W.task * fits.task + W.tone * fits.tone + W.density * fits.density
    + W.usage * fits.usage + W.trust * fits.trust + W.constraint * fits.constraint,
  );
  const soft = softPenalties(ctx, s);
  const adjustedTotal = round3(clamp01(weightedTotal - soft.total));
  return { style: s, fits, weightedTotal, adjustedTotal, softCodes: soft.codes, softCount: soft.codes.length };
}

// Among score-tied candidates, the calmer + more durable style ranks first
// (a conservative, non-arbitrary default — beats styleId-alphabetical). styleId is
// only the final determinism tiebreak. (eval issue #2)
function meritRank(s: ScoredStyle): number {
  const f = s.style.recommendationFacets;
  return (f.continuousSpectacle ? 4 : 0) + (ORDINAL[f.motionIntensity] ?? 1) + (ORDINAL[f.maintenanceComplexity] ?? 1);
}

function compareScored(a: ScoredStyle, b: ScoredStyle): number {
  if (b.adjustedTotal !== a.adjustedTotal) return b.adjustedTotal - a.adjustedTotal;
  if (b.fits.product !== a.fits.product) return b.fits.product - a.fits.product;
  if (a.softCount !== b.softCount) return a.softCount - b.softCount;
  const ma = meritRank(a); const mb = meritRank(b);
  if (ma !== mb) return ma - mb;
  return a.style.id < b.style.id ? -1 : a.style.id > b.style.id ? 1 : 0;
}

type Tri = { en: string; ko: string; ja: string };
function pickLocale(t: Tri, locale: string): string {
  return locale === 'ko' ? t.ko : locale === 'ja' ? t.ja : t.en;
}

function differentiatorsOf(s: CatalogStyle): string[] {
  const f = s.recommendationFacets;
  const out = [`motion:${f.motionIntensity}`, `maintenance:${f.maintenanceComplexity}`];
  if (f.continuousSpectacle) out.push('continuous-spectacle');
  if (s.styleFamilyId) out.push(`family:${s.styleFamilyId}`);
  if (f.tones.length) out.push(`tones:${f.tones.join('/')}`);
  return out;
}

export interface RecommendOptions {
  candidateLimit?: number;
  locale?: 'en' | 'ko' | 'ja';
}

export function recommend(
  ctx: ResolvedContext,
  repo: CatalogRepository,
  reasonText: (codes: ReasonCode[], styleId: string, locale: string) => string,
  matchedText: (s: CatalogStyle, ctx: ResolvedContext, locale: string) => string[],
  cautionText: (codes: ReasonCode[], s: CatalogStyle, locale: string) => string[],
  opts: RecommendOptions = {},
): EvidenceResult {
  const locale = opts.locale ?? 'en';
  const limit = Math.max(1, Math.min(opts.candidateLimit ?? 5, 10));

  const run = (relaxAesthetic: boolean): { survivors: ScoredStyle[]; rejected: RejectedStyle[] } => {
    const survivors: ScoredStyle[] = [];
    const rejected: RejectedStyle[] = [];
    for (const s of repo.allStyles()) {
      const hr = hardReject(ctx, s, repo, relaxAesthetic);
      if (hr.rejected) {
        rejected.push({ styleId: s.id, reasonCodes: hr.codes, explanation: reasonText(hr.codes, s.id, locale) });
      } else {
        survivors.push(scoreStyle(ctx, s, repo.ontology));
      }
    }
    survivors.sort(compareScored);
    rejected.sort((a, b) => (a.styleId < b.styleId ? -1 : 1));
    return { survivors, rejected };
  };

  let { survivors, rejected } = run(false);
  let compromised = false;
  let relaxed: string[] | undefined;

  // 05 §10 degradation: relax aesthetic avoids if everything was rejected
  if (survivors.length === 0 && ctx.avoidAestheticTerms.length > 0) {
    const second = run(true);
    if (second.survivors.length > 0) {
      // demote aesthetic-avoided styles by 0.40 instead of hard reject
      second.survivors = second.survivors.map((sc) =>
        ctx.avoidedStyleIdsViaAesthetic.includes(sc.style.id)
          ? { ...sc, adjustedTotal: round3(clamp01(sc.adjustedTotal - 0.4)) }
          : sc,
      ).sort(compareScored);
      survivors = second.survivors;
      rejected = second.rejected;
      compromised = true;
      relaxed = ctx.avoidAestheticTerms.map((t) => `avoid:${t}`);
    }
  }

  const top = survivors.slice(0, limit);
  const candidates: StyleCandidate[] = top.map((sc) => ({
    styleId: sc.style.id,
    score: round2(sc.adjustedTotal),
    scoreBreakdown: { ...sc.fits },
    matched: matchedText(sc.style, ctx, locale),
    differentiators: differentiatorsOf(sc.style),
    cautions: cautionText(sc.softCodes, sc.style, locale),
    resourceUri: `webstylebook://styles/${sc.style.id}`,
  }));

  const pairings = computePairings(ctx, top[0], survivors, repo, locale);
  const confidence = compromised ? 'low' : computeConfidence(ctx, survivors);

  // Communicate intra-set ordering uncertainty separately from set confidence (eval #5).
  // Detect ties at the DISPLAYED (round2) precision so the count matches the visible scores
  // (round 4: round3 detection vs round2 display produced user-visible contradictions).
  const topDisp = top[0] ? round2(top[0].adjustedTotal) : 0;
  const tiedAtTop = top.filter((t) => round2(t.adjustedTotal) === topDisp).length;
  let guidance = pickLocale({
    en: 'Treat candidates as scored evidence; choose using product context. candidates[0] is the strongest match, not a mandate.',
    ko: '후보는 점수화된 근거다 — 제품 맥락으로 직접 고르라. candidates[0]은 가장 강한 후보일 뿐 강제가 아니다.',
    ja: '候補は点数化された根拠だ — 製品文脈で選ぶこと。candidates[0]は最有力だが強制ではない。',
  }, locale);
  if (tiedAtTop > 1) {
    guidance += pickLocale({
      en: ` ${tiedAtTop} candidates are tied at the top score — the ordering among them is not meaningful; pick using their "differentiators" and your product context.`,
      ko: ` 상위 ${tiedAtTop}개 후보가 동점이다 — 그 사이 순서는 의미가 없으니 각 후보의 differentiators와 제품 맥락으로 고르라.`,
      ja: ` 上位${tiedAtTop}件が同点だ — その間の順序に意味は無いため、各候補のdifferentiatorsと製品文脈で選ぶこと。`,
    }, locale);
  }

  return {
    candidates,
    pairings,
    rejected,
    resolvedContext: {
      normalizedFacets: normalizedFacetLines(ctx),
      assumptions: ctx.assumptions,
      missingInformation: ctx.missingInformation,
    },
    confidence,
    ...(compromised ? { compromised, relaxed } : {}),
    guidance,
  };
}

function computeConfidence(ctx: ResolvedContext, survivors: ScoredStyle[]): 'low' | 'medium' | 'high' {
  let e = 0;
  if (ctx.productType.source === 'explicit') e++;
  if (ctx.tones.source === 'explicit' && ctx.tones.value.length) e++;
  if (ctx.density.source === 'explicit') e++;
  if (ctx.usageFrequency.source === 'explicit') e++;
  if (ctx.trustSensitivity.source === 'explicit') e++;
  const top1 = survivors[0]?.adjustedTotal ?? 0;
  // SET confidence: how sure are we the candidate SET fits — NOT coupled to the top-2
  // margin, since a strong facet tie (several equally-good options) should not read as
  // low confidence (eval #5). Intra-set ordering uncertainty is surfaced in guidance.
  // But never claim 'high' when the winner fails the user's EXPLICIT tone — the score can
  // clear 0.6 on non-tone facets while the direction is tonally wrong (hardening #4).
  const topToneFit = survivors[0]?.fits.tone ?? 0;
  const toneSatisfied = ctx.tones.source !== 'explicit' || topToneFit >= 0.5;
  if (e >= 4 && top1 >= 0.6 && ctx.productType.source === 'explicit' && toneSatisfied) return 'high';
  if (e >= 2 && top1 >= 0.5) return 'medium';
  return 'low';
}


// 05 §8.1 (v0.1): pairings come from the authored archetype.recommendedSecondaryStyleIds
// (hand-curated good pairs) intersected with surviving candidates, minus token conflicts.
// Computed pairing is deferred to v0.2 (avoids over-inference).
function computePairings(
  ctx: ResolvedContext, primary: ScoredStyle | undefined, survivors: ScoredStyle[], repo: CatalogRepository, locale: string,
): Pairing[] {
  if (!primary) return [];
  const survivingById = new Map(survivors.map((t) => [t.style.id, t.style]));
  const archetype = repo.getProduct(ctx.productType.value);
  const pool = archetype?.recommendedSecondaryStyleIds ?? [];

  const pairings: Pairing[] = [];
  for (const id of pool) {
    if (id === primary.style.id) continue;
    const s = survivingById.get(id);
    if (!s) continue;
    const f = s.recommendationFacets;
    // tone conflict: a secondary that actively breaks the requested feel must not surface
    // (eval #3 — e.g. duotone-bold[antiTones: trustworthy] for a trustworthy checkout)
    if (ctx.tones.value.some((tone) => f.antiTones.includes(tone))) continue;
    // productType mismatch: when productType is known, the secondary must not be off-domain
    if (ctx.productType.value !== 'other' && !f.productTypes.includes(ctx.productType.value)) continue;
    // token conflict: two loud styles average into noise — skip
    const bothHighMotion = f.motionIntensity === 'high' && primary.style.recommendationFacets.motionIntensity === 'high';
    if (bothHighMotion) continue;
    pairings.push({
      styleId: s.id,
      pairWith: primary.style.id,
      role: ['forms', 'navigation', 'repetitive surfaces'],
      rationale: pickLocale({
        en: `Hand-paired secondary for ${ctx.productType.value}: covers ${primary.style.id}'s quieter, repeated surfaces.`,
        ko: `${ctx.productType.value}용으로 짝지은 보조 스타일 — ${primary.style.id}의 차분하고 반복적인 화면을 보완한다.`,
        ja: `${ctx.productType.value}向けの補助スタイル — ${primary.style.id}の静かで反復的な画面を補う。`,
      }, locale),
    });
  }
  return pairings.slice(0, 2);
}

function normalizedFacetLines(ctx: ResolvedContext): string[] {
  const line = (name: string, val: string, src: string) => `${name}: ${val} (${src})`;
  return [
    line('productType', ctx.productType.value, ctx.productType.source),
    line('tones', ctx.tones.value.join(', ') || '(none)', ctx.tones.source),
    line('density', ctx.density.value, ctx.density.source),
    line('usageFrequency', ctx.usageFrequency.value, ctx.usageFrequency.source),
    line('trustSensitivity', ctx.trustSensitivity.value, ctx.trustSensitivity.source),
  ];
}
