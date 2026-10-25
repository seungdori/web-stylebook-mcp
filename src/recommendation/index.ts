import type { CatalogRepository } from '../catalog/repository.js';
import { hasStructureGuide, styleStructureSummary } from '../structure/guidance.js';
import { productMustHaves } from '../structure/must-haves.js';
import type { ProductContext, RecommendationResult } from './types.js';
import { normalizeContext } from './normalize-context.js';
import { recommend } from './scoring.js';
import { reasonText, matchedText, cautionText } from './explain.js';

export function recommendDesignDirection(input: ProductContext, repo: CatalogRepository): RecommendationResult {
  const ctx = normalizeContext(input, repo);
  const locale = input.locale ?? 'en';
  const productType = ctx.productType.value;
  const result = recommend(ctx, repo, reasonText, matchedText, cautionText, {
    candidateLimit: input.candidateLimit,
    locale: input.locale,
  });
  return {
    ...result,
    candidates: result.candidates.map((candidate) => (hasStructureGuide(candidate.styleId)
      ? { ...candidate, structure: styleStructureSummary(candidate.styleId, repo, locale, productType) }
      : candidate)),
    mustHaves: productMustHaves(productType, ctx.productType.source, locale),
  };
}

export type {
  ProductContext, EvidenceResult, RankingExplanation, RankReasonCode, RecommendedCandidate, RecommendationResult,
} from './types.js';
