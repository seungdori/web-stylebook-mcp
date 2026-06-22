// Raw ProductContext -> ResolvedContext (05 §2-3). Structured input wins; free text
// is matched against ontology aliases ONLY (never semantically analyzed). Every
// inferred/default facet is recorded in assumptions.

import type {
  ProductType, Tone, Density, UsageFrequency, TrustLevel, TaskTag, OntologyTerm,
} from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import type { ProductContext, ResolvedContext, ResolvedFacet, FacetSource } from './types.js';

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

/** Build "haystack" text from a context for alias matching. */
function haystack(ctx: ProductContext): string {
  return norm([ctx.productDescription, ...(ctx.audience ?? []), ...(ctx.primaryTasks ?? [])].join(' '));
}

const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/**
 * Does a normalized needle occur in the normalized text?
 * - CJK needles: substring match (CJK has no word boundaries).
 * - Latin needles: WORD-BOUNDARY match, so short aliases ('bi', 'ops', 'kb') don't
 *   collide with unrelated substrings ('bi' inside 'mobile', 'art' inside 'startup').
 *   This is the dominant correctness fix for natural-language briefs (round 3 #1).
 */
function needleMatches(nn: string, text: string): boolean {
  if (nn.length < 2) return false;
  if (CJK.test(nn)) return text.includes(nn);
  const esc = nn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:[^a-z0-9]|$)`).test(text);
}

/**
 * Ontology value with the MOST SPECIFIC (longest) matched alias — not first-in-array, so a
 * strong specific signal ('trading') beats a generic one ('app') regardless of array order
 * (round 4: multi-signal collision resolved by array order). Tie → earlier in array.
 */
function matchSingle(text: string, terms: OntologyTerm[]): { value: string; alias: string } | null {
  let best: { value: string; alias: string; len: number } | null = null;
  for (const term of terms) {
    for (const n of [term.value, ...term.aliases]) {
      const nn = norm(n);
      if (needleMatches(nn, text) && (!best || nn.length > best.len)) best = { value: term.value, alias: n, len: nn.length };
    }
  }
  return best ? { value: best.value, alias: best.alias } : null;
}

/** All ontology values whose value/alias appears in text. */
function matchMulti(text: string, terms: OntologyTerm[]): string[] {
  const out: string[] = [];
  for (const term of terms) {
    if ([term.value, ...term.aliases].some((n) => needleMatches(norm(n), text))) out.push(term.value);
  }
  return out;
}

function facet<T>(value: T, source: FacetSource, evidence?: string): ResolvedFacet<T> {
  return evidence ? { value, source, evidence } : { value, source };
}

export function normalizeContext(raw: ProductContext, repo: CatalogRepository): ResolvedContext {
  const ont = repo.ontology;
  const hay = haystack(raw);
  const assumptions: string[] = [];
  const missingInformation: string[] = [];

  // productType
  let productType: ResolvedFacet<ProductType>;
  if (raw.productType) {
    productType = facet(raw.productType, 'explicit');
  } else {
    const m = matchSingle(hay, ont.productTypes);
    if (m && m.value !== 'other') {
      productType = facet(m.value as ProductType, 'inferred', `matched "${m.alias}"`);
      assumptions.push(`productType inferred as ${m.value} (from "${m.alias}")`);
    } else {
      productType = facet('other', 'default');
      missingInformation.push('explicit productType');
    }
  }

  const archetype = repo.getProduct(productType.value);

  // tones
  let tones: ResolvedFacet<Tone[]>;
  if (raw.tone && raw.tone.length) {
    tones = facet(raw.tone, 'explicit');
  } else {
    const matched = matchMulti(hay, ont.tones) as Tone[];
    if (matched.length) {
      tones = facet(matched, 'inferred', matched.join(', '));
      assumptions.push(`tones inferred as ${matched.join(', ')}`);
    } else {
      tones = facet([], 'default');
    }
  }

  // density / usageFrequency / trust — explicit -> archetype default -> global default
  const density = resolveOrdinal<Density>(
    raw.density, archetype?.defaultDensity, 'medium', 'density', assumptions, !!archetype,
  );
  const usageFrequency = resolveOrdinal<UsageFrequency>(
    raw.usageFrequency, archetype?.defaultUsageFrequency, 'occasional', 'usageFrequency', assumptions, !!archetype,
  );
  const trustSensitivity = resolveOrdinal<TrustLevel>(
    raw.trustSensitivity, archetype?.defaultTrust, 'medium', 'trustSensitivity', assumptions, !!archetype,
  );

  // primary task tags
  let primaryTaskTags: ResolvedFacet<TaskTag[]>;
  const taskText = norm([...(raw.primaryTasks ?? []), raw.productDescription].join(' '));
  const matchedTasks = matchMulti(taskText, ont.taskTags) as TaskTag[];
  if (raw.primaryTasks && raw.primaryTasks.length && matchedTasks.length) {
    primaryTaskTags = facet(matchedTasks, 'explicit');
  } else if (matchedTasks.length) {
    primaryTaskTags = facet(matchedTasks, 'inferred', matchedTasks.join(', '));
  } else {
    primaryTaskTags = facet([], 'default');
    missingInformation.push('explicit primary tasks');
  }

  // constraints (normalized lowercased tokens; mapping to risks happens in scoring)
  const constraints = (raw.constraints ?? []).map((c) => norm(c));

  // avoid resolution
  const { avoidStyleIds, avoidAestheticTerms, avoidedStyleIdsViaAesthetic } = resolveAvoid(raw.avoid ?? [], repo, missingInformation);

  return {
    productType, tones, density, usageFrequency, trustSensitivity, primaryTaskTags,
    constraints, avoidStyleIds, avoidAestheticTerms, avoidedStyleIdsViaAesthetic,
    assumptions, missingInformation,
  };
}

function resolveOrdinal<T extends string>(
  explicit: T | undefined, archetypeDefault: T | undefined, globalDefault: T,
  name: string, assumptions: string[], hasArchetype: boolean,
): ResolvedFacet<T> {
  if (explicit) return { value: explicit, source: 'explicit' };
  if (archetypeDefault && hasArchetype) {
    assumptions.push(`${name} defaulted to ${archetypeDefault} (product archetype)`);
    return { value: archetypeDefault, source: 'inferred', evidence: 'archetype default' };
  }
  assumptions.push(`${name} defaulted to ${globalDefault} (conservative)`);
  return { value: globalDefault, source: 'default' };
}

function resolveAvoid(
  avoid: string[], repo: CatalogRepository, missingInformation: string[],
): { avoidStyleIds: string[]; avoidAestheticTerms: string[]; avoidedStyleIdsViaAesthetic: string[] } {
  const avoidStyleIds = new Set<string>();
  const avoidAestheticTerms: string[] = [];
  const avoidedStyleIdsViaAesthetic = new Set<string>();
  const styles = repo.allStyles();

  for (const rawTerm of avoid) {
    const term = norm(rawTerm);
    if (!term) continue;
    const tokens = term.split(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+/).filter((t) => t.length >= 3);

    // direct style id / name match
    let directHit = false;
    for (const s of styles) {
      if (s.id === term || term.includes(s.id) || s.id.includes(term)) { avoidStyleIds.add(s.id); directHit = true; }
      const names = [s.name.en, s.name.ko, s.name.ja].map(norm);
      if (names.some((n) => n && (n === term || term.includes(n)))) { avoidStyleIds.add(s.id); directHit = true; }
    }
    if (directHit) continue;

    // aesthetic term: match against id tokens, tags, risks, name tokens
    let aestheticHit = false;
    for (const s of styles) {
      const bag = norm([s.id, ...s.tags, ...s.recommendationFacets.risks, s.name.en].join(' '));
      if (tokens.some((tok) => bag.includes(tok))) { avoidedStyleIdsViaAesthetic.add(s.id); aestheticHit = true; }
    }
    if (aestheticHit) {
      avoidAestheticTerms.push(rawTerm);
    } else {
      missingInformation.push(`uninterpretable avoid: ${rawTerm}`);
    }
  }

  return {
    avoidStyleIds: [...avoidStyleIds].sort(),
    avoidAestheticTerms,
    avoidedStyleIdsViaAesthetic: [...avoidedStyleIdsViaAesthetic].sort(),
  };
}
