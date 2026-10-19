const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'onto', 'over',
  'under', 'as', 'is', 'are', 'be', 'it', 'its', 'this', 'that', 'these', 'those', 'each', 'per', 'than', 'then',
  'so', 'no', 'not', 'only', 'one', 'two', 'three', 'four', 'via', 'any', 'all', 'every', 'their', 'there', 'which',
  'who', 'what', 'where', 'when', 'while', 'up', 'out', 'off', 'like', 'about', 'between', 'within', 'without',
  'more', 'most', 'less', 'very', 'can', 'may', 'will', 'should', 'must', 'also', 'just', 'instead', 'rather',
]);

/** Content words with the compared styles' own name tokens removed, so a renamed copy still matches. */
export function contentWords(text: string, ignore: ReadonlySet<string>): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [])
    .filter((word) => !STOPWORDS.has(word) && !ignore.has(word));
}

export function shingles(words: readonly string[], size: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '));
  if (!out.size && words.length) out.add(words.join(' '));
  return out;
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (!a.size && !b.size) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Word-trigram Jaccard over pre-split content words. */
export function phraseOverlapOfWords(a: readonly string[], b: readonly string[]): number {
  return jaccard(shingles(a, 3), shingles(b, 3));
}

/** Word-trigram Jaccard: high only when long runs of wording are shared. */
export function phraseOverlap(a: string, b: string, ignore: ReadonlySet<string> = new Set()): number {
  return phraseOverlapOfWords(contentWords(a, ignore), contentWords(b, ignore));
}

/** Bag-of-words cosine: high when the same vocabulary is reused even if reordered. */
export function vocabularyOverlap(a: string, b: string, ignore: ReadonlySet<string> = new Set()): number {
  return vocabularyOverlapOfWords(contentWords(a, ignore), contentWords(b, ignore));
}

export function vocabularyOverlapOfWords(a: readonly string[], b: readonly string[]): number {
  const count = (words: readonly string[]) => {
    const map = new Map<string, number>();
    for (const word of words) map.set(word, (map.get(word) ?? 0) + 1);
    return map;
  };
  const x = count(a);
  const y = count(b);
  let dot = 0; let nx = 0; let ny = 0;
  for (const [word, n] of x) { nx += n * n; dot += n * (y.get(word) ?? 0); }
  for (const n of y.values()) ny += n * n;
  return nx && ny ? dot / Math.sqrt(nx * ny) : 0;
}
