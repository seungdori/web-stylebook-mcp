import { CatalogRepository } from '../../src/catalog/repository.js';
import type { CatalogStyle } from '../../src/types.js';

export function repoWith(base: CatalogRepository, styles: CatalogStyle[]): CatalogRepository {
  const envelope = structuredClone(base.envelope);
  envelope.data.styles = styles;
  return new CatalogRepository(envelope);
}

/**
 * A catalog copy with extra clones of one style. A clone joins every product's primary picks that the original is in,
 * because scoring reads those, so an unedited clone scores exactly like the original.
 */
export function repoWithClones(
  base: CatalogRepository, styleId: string, clones: { id: string; edit?: (style: CatalogStyle) => void }[],
): CatalogRepository {
  const original = base.getStyle(styleId);
  if (!original) throw new Error(`unknown style '${styleId}'`);
  const envelope = structuredClone(base.envelope);
  for (const { id, edit } of clones) {
    const clone: CatalogStyle = { ...structuredClone(original), id };
    edit?.(clone);
    envelope.data.styles.push(clone);
    for (const product of envelope.data.productArchetypes) {
      if (product.recommendedPrimaryStyleIds.includes(styleId)) product.recommendedPrimaryStyleIds.push(id);
    }
  }
  return new CatalogRepository(envelope);
}

export function repoWithTwin(base: CatalogRepository, styleId: string, twinId = `${styleId}-twin`): CatalogRepository {
  return repoWithClones(base, styleId, [{ id: twinId }]);
}
