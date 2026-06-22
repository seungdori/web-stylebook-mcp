// Recommendation engine public API.
import type { CatalogRepository } from '../catalog/repository.js';
import type { ProductContext, EvidenceResult } from './types.js';
import { normalizeContext } from './normalize-context.js';
import { recommend } from './scoring.js';
import { reasonText, matchedText, cautionText } from './explain.js';

export function recommendDesignDirection(input: ProductContext, repo: CatalogRepository): EvidenceResult {
  const ctx = normalizeContext(input, repo);
  return recommend(ctx, repo, reasonText, matchedText, cautionText, {
    candidateLimit: input.candidateLimit,
    locale: input.locale,
  });
}

export type { ProductContext, EvidenceResult } from './types.js';
