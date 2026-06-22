// Lightweight runtime validation of the packaged catalog (CLI --validate-catalog).
// Deep zod/reference validation lives in the repo's build scripts; this is a fast
// load-time sanity check that the shipped artifact is intact.

import type { CatalogRepository } from './repository.js';
import { LANGS } from '../types.js';
import type { LocalizedText } from '../types.js';
import { contentHashOf } from './stable-hash.js';

function localeComplete(v: LocalizedText): boolean {
  return LANGS.every((l) => typeof v[l] === 'string' && v[l].trim().length > 0);
}

export interface ValidateReport { ok: boolean; errors: string[]; summary: Record<string, number>; }

export function validateLoaded(repo: CatalogRepository): ValidateReport {
  const errors: string[] = [];
  const data = repo.data;

  if (!/^sha256:[0-9a-f]{64}$/.test(repo.contentHash)) {
    errors.push('contentHash malformed');
  } else {
    // recompute over the body (hash self-excluded) — catches a tampered catalog, not just a malformed string
    const base: Record<string, unknown> = { ...(repo.envelope as unknown as Record<string, unknown>) };
    delete base.contentHash;
    if (contentHashOf(base) !== repo.contentHash) errors.push('contentHash mismatch — catalog body does not match its hash');
  }

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
    if (!localeComplete(surf.name)) errors.push(`surface ${surf.id} name not locale-complete`);
  }
  const motionIds = new Set<string>();
  for (const m of data.motionPatterns) {
    if (motionIds.has(m.id)) errors.push(`duplicate motion id ${m.id}`);
    motionIds.add(m.id);
    if (!localeComplete(m.name)) errors.push(`motion ${m.id} name not locale-complete`);
  }
  const compIds = new Set<string>();
  for (const comp of data.components) {
    if (compIds.has(comp.id)) errors.push(`duplicate component id ${comp.id}`);
    compIds.add(comp.id);
    if (!localeComplete(comp.name)) errors.push(`component ${comp.id} name not locale-complete`);
    for (const sid of comp.relatedStateIds ?? []) if (!repo.getRecipe(sid)) errors.push(`component ${comp.id} -> unknown state ${sid}`);
  }
  const prodIds = new Set<string>();
  for (const p of data.productArchetypes) {
    if (prodIds.has(p.id)) errors.push(`duplicate product id ${p.id}`);
    prodIds.add(p.id);
    if (!localeComplete(p.name)) errors.push(`product ${p.id} name not locale-complete`);
    for (const sid of [...(p.recommendedPrimaryStyleIds ?? []), ...(p.recommendedSecondaryStyleIds ?? []), ...(p.avoidStyleIds ?? [])]) {
      if (!repo.getStyle(sid)) errors.push(`product ${p.id} -> unknown style ${sid}`);
    }
    for (const sid of p.stateSurfaceIds ?? []) if (!repo.getSurface(sid)) errors.push(`product ${p.id} -> unknown surface ${sid}`);
  }
  for (const s of data.styles) {
    if (s.styleFamilyId && !repo.getFamily(s.styleFamilyId)) errors.push(`style ${s.id} -> unknown family ${s.styleFamilyId}`);
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
