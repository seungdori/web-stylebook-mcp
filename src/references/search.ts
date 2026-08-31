import type { CatalogRepository } from '../catalog/repository.js';
import { normalizeReferenceTag } from '../catalog/repository.js';
import { text } from '../localization.js';
import type {
  DesignReference,
  DesignReferenceAnalysis,
  Lang,
  ReferenceCategory,
} from '../types.js';

export interface SearchDesignReferencesInput {
  query?: string;
  category?: ReferenceCategory;
  tags?: string[];
  limit?: number;
  locale?: Lang;
}

export interface DesignReferenceSearchItem {
  id: string;
  title: string;
  url: string;
  category: ReferenceCategory;
  tags: string[];
  summary: string;
  palette: string;
  layout: string;
  observedAt: string;
  specCompleteness: number;
  resourceUri: string;
}

export interface SearchDesignReferencesResult {
  query: {
    text?: string;
    category?: ReferenceCategory;
    tags: string[];
    locale: Lang;
    limit: number;
  };
  totalMatches: number;
  returned: number;
  results: DesignReferenceSearchItem[];
}

export interface LocalizedDesignReference extends Omit<DesignReference, 'analysis'> {
  analysis: Record<keyof DesignReferenceAnalysis, string>;
}

export interface DesignReferenceDetail {
  reference: LocalizedDesignReference;
  library: {
    schema: string;
    generatedAt: string;
    sourceRevision: string;
    sourceFiles: Record<string, string>;
  };
  attribution: {
    sourceName: string;
    sourceUrl: string;
    repositoryUrl: string;
    sourceLicense: { name: string; url: string };
    adaptationNotice: string;
    rightsNotice: string;
  };
}

interface RankedReference {
  reference: DesignReference;
  score: number;
}

export function searchDesignReferences(
  input: SearchDesignReferencesInput,
  repo: CatalogRepository,
): SearchDesignReferencesResult {
  const locale = input.locale ?? 'en';
  const limit = Math.min(20, Math.max(1, input.limit ?? 8));
  const query = input.query?.trim();
  const requestedTags = [...new Set((input.tags ?? []).map(normalizeReferenceTag))];

  let candidates = input.category
    ? [...repo.referencesForCategory(input.category)]
    : [...repo.allReferences()];

  if (requestedTags.length) {
    const allowedIds = requestedTags.map((tag) => new Set(repo.referencesForTag(tag).map((r) => r.id)));
    candidates = candidates.filter((reference) => allowedIds.every((ids) => ids.has(reference.id)));
  }

  const ranked = candidates
    .map((reference) => rankReference(reference, query, locale))
    .filter((entry): entry is RankedReference => entry !== undefined)
    .sort((a, b) => b.score - a.score
      || b.reference.specCompleteness - a.reference.specCompleteness
      || a.reference.title.localeCompare(b.reference.title, 'en')
      || a.reference.id.localeCompare(b.reference.id, 'en'));

  const results = ranked.slice(0, limit).map(({ reference }) => summarizeReference(reference, locale));
  return {
    query: {
      ...(query ? { text: query } : {}),
      ...(input.category ? { category: input.category } : {}),
      tags: input.tags ?? [],
      locale,
      limit,
    },
    totalMatches: ranked.length,
    returned: results.length,
    results,
  };
}

export function getDesignReferenceDetail(
  reference: DesignReference,
  locale: Lang,
  repo: CatalogRepository,
): DesignReferenceDetail {
  const attribution = repo.referenceLibrary.attribution;
  return {
    reference: {
      ...reference,
      analysis: localizeAnalysis(reference.analysis, locale),
    },
    library: {
      schema: repo.referenceLibrary.schema,
      generatedAt: repo.referenceLibrary.generatedAt,
      sourceRevision: repo.referenceLibrary.sourceRevision,
      sourceFiles: repo.referenceLibrary.sourceFiles,
    },
    attribution: {
      sourceName: attribution.sourceName,
      sourceUrl: attribution.sourceUrl,
      repositoryUrl: attribution.repositoryUrl,
      sourceLicense: attribution.sourceLicense,
      adaptationNotice: text(attribution.adaptationNotice, locale),
      rightsNotice: text(attribution.rightsNotice, locale),
    },
  };
}

function summarizeReference(reference: DesignReference, locale: Lang): DesignReferenceSearchItem {
  return {
    id: reference.id,
    title: reference.title,
    url: reference.url,
    category: reference.category,
    tags: reference.tags,
    summary: text(reference.analysis.notes, locale),
    palette: text(reference.analysis.palette, locale),
    layout: text(reference.analysis.layout, locale),
    observedAt: reference.observedAt,
    specCompleteness: reference.specCompleteness,
    resourceUri: `webstylebook://references/${reference.id}`,
  };
}

function localizeAnalysis(
  analysis: DesignReferenceAnalysis,
  locale: Lang,
): Record<keyof DesignReferenceAnalysis, string> {
  return {
    palette: text(analysis.palette, locale),
    layout: text(analysis.layout, locale),
    interaction: text(analysis.interaction, locale),
    motion: text(analysis.motion, locale),
    notes: text(analysis.notes, locale),
  };
}

function rankReference(
  reference: DesignReference,
  query: string | undefined,
  locale: Lang,
): RankedReference | undefined {
  if (!query) return { reference, score: 0 };

  const phrase = normalizeSearchText(query);
  const tokens = phrase.split(' ').filter(Boolean);
  if (!tokens.length) return { reference, score: 0 };

  const id = normalizeSearchText(reference.id);
  const title = normalizeSearchText(reference.title);
  const category = normalizeSearchText(reference.category);
  const tags = reference.tags.map(normalizeSearchText);
  const analysis = Object.values(localizeAnalysis(reference.analysis, locale)).map(normalizeSearchText);
  const corpus = [id, title, category, ...tags, ...analysis].join(' ');
  if (!tokens.every((token) => corpus.includes(token))) return undefined;

  let score = 0;
  if (id === phrase) score += 180;
  if (title === phrase) score += 160;
  if (category === phrase) score += 90;
  if (tags.includes(phrase)) score += 80;
  if (title.includes(phrase)) score += 70;
  if (id.includes(phrase)) score += 60;
  if (tags.some((tag) => tag.includes(phrase))) score += 50;
  if (analysis.some((value) => value.includes(phrase))) score += 30;
  for (const token of tokens) {
    if (title.includes(token)) score += 18;
    if (id.includes(token)) score += 16;
    if (tags.some((tag) => tag.includes(token))) score += 12;
    if (category.includes(token)) score += 8;
    if (analysis.some((value) => value.includes(token))) score += 3;
  }
  return { reference, score };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
