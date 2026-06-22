// Lightweight runtime validation of the packaged catalog (CLI --validate-catalog).
// Deep zod/reference validation lives in the repo's build scripts; this is a fast
// load-time sanity check that the shipped artifact is intact.

import type { CatalogRepository } from './repository.js';
import { LANGS } from '../types.js';
import type { LocalizedText } from '../types.js';

function localeComplete(v: LocalizedText): boolean {
  return LANGS.every((l) => typeof v[l] === 'string' && v[l].trim().length > 0);
}

export interface ValidateReport { ok: boolean; errors: string[]; summary: Record<string, number>; }

export function validateLoaded(repo: CatalogRepository): ValidateReport {
  const errors: string[] = [];
  const data = repo.data;

  if (!/^sha256:[0-9a-f]{64}$/.test(repo.contentHash)) errors.push('contentHash malformed');

  const ids = new Set<string>();
  for (const s of data.styles) {
    if (ids.has(`style:${s.id}`)) errors.push(`duplicate style id ${s.id}`);
    ids.add(`style:${s.id}`);
    if (!s.recommendationFacets) errors.push(`style ${s.id} missing facets`);
    if (!localeComplete(s.name)) errors.push(`style ${s.id} name not locale-complete`);
  }
  for (const r of data.stateRecipes) {
    if (!r.mustShow.length || !r.mustNot.length) errors.push(`recipe ${r.id} missing mustShow/mustNot`);
    for (const sid of r.surfaceIds) if (!repo.getSurface(sid)) errors.push(`recipe ${r.id} -> unknown surface ${sid}`);
  }
  for (const surf of data.stateSurfaces) {
    for (const sid of [...surf.requiredStateIds, ...surf.recommendedStateIds]) {
      if (!repo.getRecipe(sid)) errors.push(`surface ${surf.id} -> unknown state ${sid}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      styles: data.styles.length,
      motion: data.motionPatterns.length,
      components: data.components.length,
      surfaces: data.stateSurfaces.length,
      recipes: data.stateRecipes.length,
      products: data.productArchetypes.length,
    },
  };
}
