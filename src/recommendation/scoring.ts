import type {
  CatalogStyle, ProductType, Ontology, ConstraintMapping, RecommendationFacets, TaskTag, Tone,
} from '../types.js';
import { TASK_TAGS } from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import type {
  ResolvedContext, ReasonCode, StyleCandidate, EvidenceResult, RejectedStyle, Pairing,
  FitKey, FitBreakdown, ScoreTerms, ScoredStyle, UseCaseEvidence,
} from './types.js';
import { useCaseEvidence } from './lexicon.js';
import { explainRanking } from './rank-reason.js';

const W = {
  product: 0.20, useCase: 0.10, task: 0.14, tone: 0.16, density: 0.12, usage: 0.10, trust: 0.08, constraint: 0.10,
} as const satisfies Record<FitKey, number>;
const ORDINAL: Record<string, number> = { low: 0, medium: 1, high: 2, 'one-off': 0, occasional: 1, daily: 2 };
const USAGE_WEIGHT: Record<string, number> = { 'one-off': 0, occasional: 0.5, daily: 1 };

// A style that claims more values for a facet is less specific to any one of them, so a membership
// hit earns less as the claim widens. productTypes and tones are authored most relevant first.
const PRODUCT_PRIMACY = 0.03;
const PRODUCT_BREADTH = 0.02;
const TASK_BREADTH = 0.015;
const RANGE_BREADTH = 0.15;
const TONE_ORDER_DECAY = 0.15;
const TONE_SLOT_DECAY = 0.10;
const UPKEEP_WEIGHT = 0.06;
const AVOID_WEIGHT = 0.12;
const NOT_IDEAL_WEIGHT = 0.08;
const RELAXED_AVOID_DEMOTION = 0.4;

function round6(x: number): number { return Math.round(x * 1e6) / 1e6; }
function round3(x: number): number { return Math.round(x * 1000) / 1000; }
function round2(x: number): number { return Math.round(x * 100) / 100; }
function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

function ordDist(a: string, set: string[]): number {
  if (!set.length) return 1;
  const av = ORDINAL[a] ?? 1;
  return Math.min(...set.map((s) => Math.abs(av - (ORDINAL[s] ?? 1))));
}

function adjacent(p: ProductType, ont: Ontology): Set<ProductType> {
  const out = new Set<ProductType>(ont.productAdjacency[p] ?? []);
  for (const [k, vs] of Object.entries(ont.productAdjacency)) {
    if (vs.includes(p)) out.add(k as ProductType);
  }
  return out;
}

function productFit(ctx: ResolvedContext, f: RecommendationFacets, ont: Ontology): number {
  const pt = ctx.productType.value;
  // A product type nobody gave is not a category some style fits: listing 'other' must not beat the rest.
  if (pt === 'other' && ctx.productType.source === 'default') return 0.5;
  const i = f.productTypes.indexOf(pt);
  if (i >= 0) return 1 - PRODUCT_PRIMACY * i - PRODUCT_BREADTH * (f.productTypes.length - 1);
  if (pt === 'other') return 0.5;
  const adj = adjacent(pt, ont);
  return f.productTypes.some((x) => adj.has(x)) ? 0.5 : 0.2;
}

function useCaseFit(pt: ProductType, ev: UseCaseEvidence): number {
  return pt === 'other' ? ev.lexical : 0.5 * ev.share + 0.5 * ev.lexical;
}

function taskFit(tasks: TaskTag[], f: RecommendationFacets, taskStrengths: number): number {
  if (!tasks.length) return 0.5;
  const strengths = new Set(f.strengths.map((x) => x.toLowerCase()));
  const covered = tasks.filter((t) => strengths.has(t)).length / tasks.length;
  // strengths highlight what a style does best; they do not list everything it supports. A task they
  // omit is therefore no better or worse than an unknown one (0.5), and a listed task lifts it.
  return 0.5 + 0.5 * covered * Math.max(0, 1 - TASK_BREADTH * (taskStrengths - 1));
}

function toneFit(ctx: ResolvedContext, f: RecommendationFacets): number {
  const requested = [...new Set(ctx.tones.value)];
  if (!requested.length) return 0.4;
  // Inferred tones arrive in ontology order, so only a caller-typed order says which tone matters most.
  const ordered = ctx.tones.source === 'explicit';
  let weights = 0;
  let credit = 0;
  requested.forEach((tone, i) => {
    const w = ordered ? Math.max(0.5, 1 - TONE_ORDER_DECAY * i) : 1;
    const slot = f.tones.indexOf(tone);
    weights += w;
    if (slot >= 0) credit += w * (1 - TONE_SLOT_DECAY * slot);
  });
  const conflicts = requested.filter((t) => f.antiTones.includes(t)).length;
  return clamp01(credit / weights - 0.15 * conflicts);
}

// The share of requested tones a style carries, minus conflicts. Confidence asks whether the winner carries
// what was asked, so unlike the ranking fit this ignores tone order and slot.
function toneCoverage(requested: Tone[], f: RecommendationFacets): number {
  const asked = [...new Set(requested)];
  if (!asked.length) return 1;
  const carried = asked.filter((t) => f.tones.includes(t)).length;
  const conflicts = asked.filter((t) => f.antiTones.includes(t)).length;
  return clamp01(carried / asked.length - 0.15 * conflicts);
}

function rangeFit(level: string, declared: string[]): number {
  if (declared.includes(level)) return 1 - RANGE_BREADTH * ((declared.length - 1) / 2);
  return Math.max(0, 1 - 0.5 * ordDist(level, declared));
}

function trustFit(ctx: ResolvedContext, f: RecommendationFacets): number {
  const req = ORDINAL[ctx.trustSensitivity.value] ?? 1;
  const styleMax = f.trust.length ? Math.max(...f.trust.map((t) => ORDINAL[t] ?? 1)) : 1;
  if (f.trust.includes(ctx.trustSensitivity.value)) return 1.0;
  if (req <= styleMax) return 0.8;
  return Math.max(0, 1 - 0.5 * (req - styleMax));
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

  const aestheticAvoided = ctx.avoidedStyleIdsViaAesthetic.includes(s.id);
  if (ctx.avoidStyleIds.includes(s.id) || (!relaxAesthetic && aestheticAvoided)) codes.push('EXPLICITLY_AVOIDED');

  const pt = ctx.productType.value;
  const notIdealTypes = new Set<ProductType>();
  for (const phrase of s.notIdealFor) {
    const mapped = repo.notIdealMap[phrase.toLowerCase().trim()] ?? repo.notIdealMap[phrase] ?? [];
    for (const m of mapped) notIdealTypes.add(m);
  }
  // facet wins over a fuzzy notIdealFor phrase: if the style explicitly claims this
  // productType in its facets, a narrow notIdealFor phrase must not hard-reject it (eval #3).
  if (pt !== 'other' && notIdealTypes.has(pt) && !f.productTypes.includes(pt)) codes.push('PRODUCT_NOT_IDEAL');

  const req = ORDINAL[ctx.trustSensitivity.value] ?? 1;
  const styleMax = f.trust.length ? Math.max(...f.trust.map((t) => ORDINAL[t] ?? 1)) : 1;
  if (req - styleMax >= 2) codes.push('HIGH_TRUST_MISMATCH');

  if (ctx.usageFrequency.value === 'daily' && f.motionIntensity === 'high' && f.continuousSpectacle) {
    codes.push('DAILY_USE_OVERSTIMULATION');
  }

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

function traitsOf(s: CatalogStyle, requestedTones: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of s.tags) out.set(`tag:${t.toLowerCase()}`, t);
  for (const r of s.recommendationFacets.risks) out.set(`risk:${r.toLowerCase()}`, r);
  // A tone the brief asks for is not evidence of resemblance to a style it wants to avoid.
  for (const t of s.recommendationFacets.tones) if (!requestedTones.has(t)) out.set(`tone:${t}`, t);
  return out;
}

function avoidProximity(ctx: ResolvedContext, s: CatalogStyle, repo: CatalogRepository): { penalty: number; nearest?: ScoredStyle['nearestAvoided'] } {
  const avoided = [...new Set([...ctx.avoidStyleIds, ...ctx.avoidedStyleIdsViaAesthetic])].filter((id) => id !== s.id);
  const requestedTones = new Set<string>(ctx.tones.value);
  const mine = traitsOf(s, requestedTones);
  let nearest: { affinity: number; styleId: string; shared: string[] } | undefined;
  for (const id of avoided) {
    const other = repo.getStyle(id);
    if (!other) continue;
    const theirs = traitsOf(other, requestedTones);
    const shared = [...mine].filter(([key]) => theirs.has(key)).map(([, label]) => label);
    const overlap = shared.length / Math.max(1, Math.min(mine.size, theirs.size));
    const lineage = s.fusionOf?.includes(id) || other.fusionOf?.includes(s.id) ? 0.6 : 0;
    const affinity = Math.min(1, overlap + lineage);
    if (!nearest || affinity > nearest.affinity) nearest = { affinity, styleId: id, shared };
  }
  return nearest ? { penalty: AVOID_WEIGHT * nearest.affinity, nearest: { styleId: nearest.styleId, shared: nearest.shared } } : { penalty: 0 };
}

function upkeepPenalty(ctx: ResolvedContext, f: RecommendationFacets): number {
  const load = ((ORDINAL[f.motionIntensity] ?? 1) + (ORDINAL[f.maintenanceComplexity] ?? 1)) / 4 + (f.continuousSpectacle ? 0.25 : 0);
  return UPKEEP_WEIGHT * (USAGE_WEIGHT[ctx.usageFrequency.value] ?? 0.5) * Math.min(1, load);
}

export function scoreStyle(ctx: ResolvedContext, s: CatalogStyle, repo: CatalogRepository): ScoredStyle {
  const f = s.recommendationFacets;
  const pt = ctx.productType.value;
  const evidence = useCaseEvidence(s, new Set(ctx.requestKeys), pt, repo);
  const violated = ctx.constraints.filter((c) => constraintViolates(c, s, repo.ontology));
  const taskStrengths = f.strengths.filter((x) => (TASK_TAGS as readonly string[]).includes(x.toLowerCase())).length;
  const fits: FitBreakdown = {
    product: productFit(ctx, f, repo.ontology),
    useCase: useCaseFit(pt, evidence),
    task: taskFit(ctx.primaryTaskTags.value, f, taskStrengths),
    tone: toneFit(ctx, f),
    density: rangeFit(ctx.density.value, f.density),
    usage: rangeFit(ctx.usageFrequency.value, f.usageFrequency),
    trust: trustFit(ctx, f),
    constraint: ctx.constraints.length ? clamp01(1 - violated.length / ctx.constraints.length) : 1,
  };
  const soft = softPenalties(ctx, s);
  const avoid = avoidProximity(ctx, s, repo);
  const terms: ScoreTerms = {
    product: W.product * fits.product,
    useCase: W.useCase * fits.useCase,
    task: W.task * fits.task,
    tone: W.tone * fits.tone,
    density: W.density * fits.density,
    usage: W.usage * fits.usage,
    trust: W.trust * fits.trust,
    constraint: W.constraint * fits.constraint,
    cautions: -(soft.total + NOT_IDEAL_WEIGHT * evidence.notIdeal),
    upkeep: -upkeepPenalty(ctx, f),
    avoidance: -avoid.penalty,
  };
  const total = round6(clamp01(Object.values(terms).reduce((sum, x) => sum + x, 0)));
  return { style: s, fits, terms, total, softCodes: soft.codes, violated, taskStrengths, evidence, nearestAvoided: avoid.nearest };
}

function demoteRelaxed(sc: ScoredStyle): ScoredStyle {
  return {
    ...sc,
    terms: { ...sc.terms, avoidance: sc.terms.avoidance - RELAXED_AVOID_DEMOTION },
    total: round6(clamp01(sc.total - RELAXED_AVOID_DEMOTION)),
  };
}

// Only an exact tie reaches the id comparison. It keeps the output byte-stable and says nothing
// about preference: the result reports the tie in `ranking` and `guidance`.
function compareScored(a: ScoredStyle, b: ScoredStyle): number {
  if (a.total !== b.total) return b.total - a.total;
  return a.style.id < b.style.id ? -1 : a.style.id > b.style.id ? 1 : 0;
}

function roundedFits(fits: FitBreakdown): Record<string, number> {
  return {
    product: round3(fits.product), task: round3(fits.task), tone: round3(fits.tone), density: round3(fits.density),
    usage: round3(fits.usage), trust: round3(fits.trust), constraint: round3(fits.constraint), useCase: round3(fits.useCase),
  };
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
        survivors.push(scoreStyle(ctx, s, repo));
      }
    }
    survivors.sort(compareScored);
    rejected.sort((a, b) => (a.styleId < b.styleId ? -1 : 1));
    return { survivors, rejected };
  };

  let { survivors, rejected } = run(false);
  let compromised = false;
  let relaxed: string[] | undefined;

  if (survivors.length === 0 && ctx.avoidAestheticTerms.length > 0) {
    const second = run(true);
    if (second.survivors.length > 0) {
      // demote aesthetic-avoided styles instead of hard reject
      second.survivors = second.survivors.map((sc) =>
        ctx.avoidedStyleIdsViaAesthetic.includes(sc.style.id) ? demoteRelaxed(sc) : sc,
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
    score: round2(sc.total),
    scoreBreakdown: roundedFits(sc.fits),
    matched: matchedText(sc.style, ctx, locale),
    differentiators: differentiatorsOf(sc.style),
    cautions: cautionText(sc.softCodes, sc.style, locale),
    resourceUri: `webstylebook://styles/${sc.style.id}`,
  }));

  const pairings = computePairings(ctx, top[0], survivors, repo, locale);
  const confidence = compromised ? 'low' : computeConfidence(ctx, survivors);

  // Ties are judged on the displayed score and across every survivor: the count then matches what the
  // caller sees, and candidateLimit cannot hide a tie with the runner-up.
  const topShown = survivors[0] ? round2(survivors[0].total) : 0;
  const tiedAtTop = survivors.filter((sc) => round2(sc.total) === topShown).length;
  const [winner, runnerUp] = survivors;
  const ranking = winner && runnerUp ? explainRanking(winner, runnerUp, ctx, locale) : undefined;
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
    ...(ranking ? { ranking } : {}),
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
  const winner = survivors[0];
  const top1 = winner?.total ?? 0;
  // SET confidence: how sure are we the candidate SET fits — NOT coupled to the top-2
  // margin, since a strong facet tie (several equally-good options) should not read as
  // low confidence (eval #5). Intra-set ordering uncertainty is surfaced in guidance.
  // But never claim 'high' when the winner fails the user's EXPLICIT tone — the score can
  // clear 0.6 on non-tone facets while the direction is tonally wrong (hardening #4).
  const toneSatisfied = ctx.tones.source !== 'explicit'
    || (winner !== undefined && toneCoverage(ctx.tones.value, winner.style.recommendationFacets) >= 0.5);
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
