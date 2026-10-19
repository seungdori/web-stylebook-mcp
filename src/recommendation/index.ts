import type { CatalogRepository } from '../catalog/repository.js';
import { hasStructureGuide, styleStructureSummary } from '../structure/guidance.js';
import type { ProductContext, EvidenceResult } from './types.js';
import { normalizeContext } from './normalize-context.js';
import { recommend } from './scoring.js';
import { reasonText, matchedText, cautionText } from './explain.js';

export function recommendDesignDirection(input: ProductContext, repo: CatalogRepository): EvidenceResult {
  const ctx = normalizeContext(input, repo);
  const result = recommend(ctx, repo, reasonText, matchedText, cautionText, {
    candidateLimit: input.candidateLimit,
    locale: input.locale,
  });
  return {
    ...result,
    candidates: result.candidates.map((candidate) => (hasStructureGuide(candidate.styleId)
      ? { ...candidate, structure: styleStructureSummary(candidate.styleId, repo, input.locale ?? 'en') }
      : candidate)),
  };
}

export type {
  ProductContext, EvidenceResult, RankingExplanation, RankReasonCode, RecommendedCandidate,
} from './types.js';
