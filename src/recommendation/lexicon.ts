import type { CatalogStyle, ProductType } from '../types.js';
import { DENSITY_LEVELS, TONES, TRUST_LEVELS, USAGE_FREQUENCIES } from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import type { UseCaseEvidence } from './types.js';

const FUNCTION_WORDS = new Set([
  'a', 'about', 'after', 'all', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'before', 'both', 'but', 'by', 'can', 'day', 'days',
  'during', 'each', 'every', 'for', 'from', 'get', 'has', 'have', 'in', 'into', 'is', 'it', 'its', 'let', 'made', 'make', 'month',
  'months', 'more', 'most', 'no', 'not', 'of', 'off', 'on', 'once', 'one', 'or', 'our', 'out', 'over', 'per', 'so', 'than', 'that',
  'the', 'their', 'them', 'then', 'there', 'they', 'this', 'time', 'times', 'to', 'too', 'up', 'use', 'used', 'uses', 'using', 'very',
  'was', 'we', 'week', 'weeks', 'were', 'when', 'where', 'which', 'while', 'who', 'will', 'with', 'year', 'years', 'you', 'your',
]);

// Words that describe any product, so sharing one says nothing about the use case.
const GENERIC_WORDS = [
  'app', 'application', 'company', 'customer', 'feature', 'interface', 'online', 'page', 'people', 'platform', 'product', 'service',
  'site', 'team', 'tool', 'ui', 'user', 'web', 'website',
];

// Tone, density, usage and trust are scored by their own factors; matching their words again would double count.
const FACET_WORDS = [...TONES, ...DENSITY_LEVELS, ...USAGE_FREQUENCIES, ...TRUST_LEVELS, 'dense', 'density'];

export function wordKey(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(?:ch|sh|ss|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  for (const suffix of ['ing', 'ed']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 4) { w = w.slice(0, -suffix.length); break; }
  }
  return w.length > 3 && w.endsWith('e') ? w.slice(0, -1) : w;
}

const GENERIC_KEYS = new Set(GENERIC_WORDS.map(wordKey));
const FACET_KEYS = new Set(FACET_WORDS.map(wordKey));

function words(text: string): string[] {
  return text.normalize('NFKC').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 0);
}

function wordKeys(text: string): string[] {
  return words(text).map(wordKey);
}

export function contentKeys(text: string): string[] {
  const out = new Set<string>();
  for (const w of words(text)) {
    if (w.length < 2 || /^\d+$/.test(w) || FUNCTION_WORDS.has(w)) continue;
    const key = wordKey(w);
    if (!FACET_KEYS.has(key)) out.add(key);
  }
  return [...out];
}

export function distinctiveKeys(text: string): string[] {
  return contentKeys(text).filter((k) => !GENERIC_KEYS.has(k));
}

// Words that name a kind of product ("dashboard", "developer", "docs") are scored by the product-type factor and its
// hard rejections. Sharing one is not evidence of a vertical, so it never counts alone.
const domainKeysByRepo = new WeakMap<CatalogRepository, ReadonlySet<string>>();
function domainKeys(repo: CatalogRepository): ReadonlySet<string> {
  let keys = domainKeysByRepo.get(repo);
  if (!keys) {
    keys = new Set(repo.ontology.productTypes.flatMap((t) => [t.value, ...t.aliases]).flatMap(wordKeys));
    domainKeysByRepo.set(repo, keys);
  }
  return keys;
}

function targetsProduct(phrase: string, productType: ProductType, repo: CatalogRepository): boolean {
  const mapped = repo.notIdealMap[phrase.toLowerCase().trim()] ?? repo.notIdealMap[phrase];
  if (mapped?.includes(productType)) return true;
  const term = repo.ontology.productTypes.find((t) => t.value === productType);
  if (!term) return false;
  const phraseKeys = new Set(wordKeys(phrase));
  return [term.value, ...term.aliases].some((name) => {
    const keys = wordKeys(name);
    return keys.length > 0 && keys.every((k) => phraseKeys.has(k));
  });
}

// One shared word is weak evidence, because common words such as "small" or "form" recur in unrelated phrases.
// bestFor is positive evidence and earns graded credit: full when the brief shares two or more distinctive words
// covering 40% of the phrase, or one word that does not merely name a kind of product and is half of the phrase;
// half for any other shared word. Generic words never count, so "app" or "tool" in a brief changes nothing.
// notIdealFor excludes a style, so it needs more: the brief must repeat the whole phrase, or share two or more
// distinctive words covering 60% of it. A notIdealFor phrase that names a tone, density, usage or trust level
// ("high-density data", "editorial pages") is left to those factors: without that word it would shrink to a
// common one.
function bestMatch(
  phrases: string[], request: ReadonlySet<string>, domain: ReadonlySet<string>, negative: boolean,
): { strength: number; phrase?: string } {
  let best: { strength: number; hits: number; phrase: string } | undefined;
  for (const phrase of phrases) {
    if (negative && wordKeys(phrase).some((k) => FACET_KEYS.has(k))) continue;
    const all = contentKeys(phrase);
    const core = distinctiveKeys(phrase);
    const hits = core.filter((k) => request.has(k));
    if (hits.length === 0) continue;
    const covered = hits.length / core.length;
    const full = negative
      ? all.every((k) => request.has(k)) || (hits.length >= 2 && covered >= 0.6)
      : hits.length >= 2 ? covered >= 0.4 : covered >= 0.5 && hits.some((k) => !domain.has(k));
    const strength = full ? 1 : 0.5;
    if (!best || strength > best.strength || (strength === best.strength && hits.length > best.hits)) best = { strength, hits: hits.length, phrase };
  }
  return { strength: best?.strength ?? 0, phrase: best?.phrase };
}

export function useCaseEvidence(
  style: CatalogStyle, request: ReadonlySet<string>, productType: ProductType, repo: CatalogRepository,
): UseCaseEvidence {
  const total = style.bestFor.length;
  const targeted = productType === 'other' || total === 0
    ? 0 : style.bestFor.filter((p) => targetsProduct(p, productType, repo)).length;
  const domain = domainKeys(repo);
  const best = bestMatch(style.bestFor, request, domain, false);
  const worst = bestMatch(style.notIdealFor, request, domain, true);
  return {
    targeted,
    total,
    share: total === 0 ? 0 : targeted / total,
    lexical: best.strength,
    phrase: best.phrase,
    // Negative evidence excludes a style, so a partial match does not count.
    notIdeal: worst.strength === 1 ? 1 : 0,
    notIdealPhrase: worst.strength === 1 ? worst.phrase : undefined,
  };
}
