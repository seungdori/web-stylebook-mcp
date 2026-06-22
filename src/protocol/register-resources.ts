// Read-only design knowledge as MCP resources (01 §7). Fixed compact lists +
// per-id templates. All application/json. Internal file paths / React names excluded.

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogRepository } from '../catalog/repository.js';
import { TOOL_NAMES, SERVER_NAME, SERVER_VERSION } from '../server-info.js';
import { ERROR_CODES } from './errors.js';

const JSON_MIME = 'application/json';
function json(uri: string, value: unknown) {
  return { contents: [{ uri, mimeType: JSON_MIME, text: JSON.stringify(value, null, 2) }] };
}
function notFound(uri: string, kind: string, id: string) {
  return { contents: [{ uri, mimeType: JSON_MIME, text: JSON.stringify({ error: `${kind} '${id}' not found` }) }] };
}

export function registerResources(server: McpServer, repo: CatalogRepository): void {
  const fixed = (name: string, uri: string, description: string, build: () => unknown) =>
    server.registerResource(name, uri, { title: name, description, mimeType: JSON_MIME }, async (u) => json(u.href, build()));

  // -------- fixed resources --------
  fixed('manifest', 'webstylebook://manifest', 'Server + catalog manifest', () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    catalogVersion: repo.catalogVersion,
    contentHash: repo.contentHash,
    schema: repo.envelope.schema,
    languages: repo.envelope.languages,
    counts: {
      styles: repo.allStyles().length,
      motion: repo.data.motionPatterns.length,
      components: repo.data.components.length,
      surfaces: repo.data.stateSurfaces.length,
      stateRecipes: repo.data.stateRecipes.length,
      products: repo.data.productArchetypes.length,
    },
    domains: ['styles', 'motion', 'components', 'states', 'products', 'policies'],
    tools: TOOL_NAMES,
    errorCodes: ERROR_CODES,
    resourceUriTemplates: [
      'webstylebook://styles/{id}',
      'webstylebook://motion/{id}',
      'webstylebook://components/{id}',
      'webstylebook://states/{surface}',
      'webstylebook://states/{surface}/{state}',
      'webstylebook://products/{id}',
    ],
  }));

  fixed('styles', 'webstylebook://styles', 'Compact list of visual directions', () => repo.listStyles());
  fixed('motion', 'webstylebook://motion', 'Compact list of motion patterns', () => repo.listMotion());
  fixed('components', 'webstylebook://components', 'Component vocabulary', () => repo.listComponents());
  fixed('state-surfaces', 'webstylebook://states/surfaces', 'UI state surfaces', () => repo.listSurfaces());
  fixed('products', 'webstylebook://products', 'Product archetypes', () => repo.listProducts());
  fixed('anti-patterns', 'webstylebook://policies/anti-patterns', 'Common anti-patterns', () => repo.policies.antiPatterns);
  fixed('verification', 'webstylebook://policies/verification', 'Verification checklist', () => repo.policies.verification);

  // -------- templates --------
  server.registerResource('style', new ResourceTemplate('webstylebook://styles/{styleId}', {
    list: async () => ({ resources: repo.allStyles().map((s) => ({ uri: `webstylebook://styles/${s.id}`, name: s.id, mimeType: JSON_MIME })) }),
  }), { title: 'Style detail', description: 'Full detail for one style', mimeType: JSON_MIME }, async (u, v) => {
    const s = repo.getStyle(String(v.styleId)); return s ? json(u.href, s) : notFound(u.href, 'style', String(v.styleId));
  });

  server.registerResource('motion-detail', new ResourceTemplate('webstylebook://motion/{motionId}', {
    list: async () => ({ resources: repo.data.motionPatterns.map((m) => ({ uri: `webstylebook://motion/${m.id}`, name: m.id, mimeType: JSON_MIME })) }),
  }), { title: 'Motion detail', description: 'Full detail for one motion pattern', mimeType: JSON_MIME }, async (u, v) => {
    const m = repo.getMotion(String(v.motionId)); return m ? json(u.href, m) : notFound(u.href, 'motion', String(v.motionId));
  });

  server.registerResource('component-detail', new ResourceTemplate('webstylebook://components/{componentId}', {
    list: async () => ({ resources: repo.data.components.map((c) => ({ uri: `webstylebook://components/${c.id}`, name: c.id, mimeType: JSON_MIME })) }),
  }), { title: 'Component detail', description: 'Full detail for one component term', mimeType: JSON_MIME }, async (u, v) => {
    const c = repo.getComponent(String(v.componentId)); return c ? json(u.href, c) : notFound(u.href, 'component', String(v.componentId));
  });

  server.registerResource('product-detail', new ResourceTemplate('webstylebook://products/{productId}', {
    list: async () => ({ resources: repo.data.productArchetypes.map((p) => ({ uri: `webstylebook://products/${p.id}`, name: p.id, mimeType: JSON_MIME })) }),
  }), { title: 'Product archetype detail', description: 'Full detail for one product archetype', mimeType: JSON_MIME }, async (u, v) => {
    const p = repo.getProduct(String(v.productId)); return p ? json(u.href, p) : notFound(u.href, 'product', String(v.productId));
  });

  server.registerResource('surface-detail', new ResourceTemplate('webstylebook://states/{surfaceId}', {
    list: async () => ({ resources: repo.data.stateSurfaces.map((s) => ({ uri: `webstylebook://states/${s.id}`, name: s.id, mimeType: JSON_MIME })) }),
  }), { title: 'State surface', description: 'Surface + its state ids', mimeType: JSON_MIME }, async (u, v) => {
    const sid = String(v.surfaceId);
    const surface = repo.getSurface(sid);
    if (!surface) return notFound(u.href, 'surface', sid);
    return json(u.href, { ...surface, states: repo.recipesForSurface(sid).map((r) => ({ id: r.id, criticality: r.criticality, category: r.category })) });
  });

  server.registerResource('state-recipe', new ResourceTemplate('webstylebook://states/{surfaceId}/{stateId}', {
    list: async () => ({
      resources: repo.data.stateRecipes.map((r) => ({ uri: `webstylebook://states/${r.surfaceIds[0] ?? ''}/${r.id}`, name: r.id, mimeType: JSON_MIME })),
    }),
  }), { title: 'State recipe', description: 'Full contract for one UI state', mimeType: JSON_MIME }, async (u, v) => {
    // validate the {surfaceId} path segment too — a recipe only exists "under" its own surfaces
    const r = repo.getRecipe(String(v.stateId));
    if (!r || !r.surfaceIds.includes(String(v.surfaceId))) return notFound(u.href, 'state', `${String(v.surfaceId)}/${String(v.stateId)}`);
    return json(u.href, r);
  });
}
