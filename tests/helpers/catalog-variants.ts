import { CatalogRepository } from '../../src/catalog/repository.js';
import type { CatalogStyle } from '../../src/types.js';

export function repoWith(base: CatalogRepository, styles: CatalogStyle[]): CatalogRepository {
  const envelope = structuredClone(base.envelope);
  envelope.data.styles = styles;
  return new CatalogRepository(envelope);
}

/** The bundled catalog plus an identical copy of one style, so the two score exactly alike. */
export function repoWithTwin(base: CatalogRepository, styleId: string, twinId = `${styleId}-twin`): CatalogRepository {
  const style = base.getStyle(styleId);
  if (!style) throw new Error(`unknown style '${styleId}'`);
  return repoWith(base, [...base.allStyles(), { ...structuredClone(style), id: twinId }]);
}
