import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CatalogRepository } from '../catalog/repository.js';
import type { VisualResolutionOptions } from '../visual-canonical/types.js';
import { REFERENCE_CATEGORIES } from '../types.js';
import { TOOL_NAMES, SERVER_NAME, SERVER_VERSION } from '../server-info.js';
import { ERROR_CODES } from './errors.js';
import { bannedPatternCatalog, styleStructure, structureManifest, structureRulesetHash } from '../structure/guidance.js';
import { MUST_HAVE_RESOURCE_URI, mustHaveCatalog } from '../structure/must-haves.js';
import { composeDesignTokens } from '../tokens/compile.js';
import { DESIGN_MD_PLACEMENTS } from '../tokens/design-md.js';
import { VISUAL_SCHEMA } from '../catalog/visual.js';
import { FOUNDATIONS, FOUNDATION_IDENTITY, foundationManifest } from '../foundations/catalog.js';
import { FOUNDATION_SOURCES } from '../foundations/sources.js';
import { localizeFoundation, localizeProtocol, localizeSources } from '../foundations/planner.js';
import { IMPROVEMENT_WORKFLOW_SCHEMA, IMPROVEMENT_WORKFLOW_URI, improvementWorkflow } from '../improvement/workflow.js';

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

  fixed('manifest', 'webstylebook://manifest', 'Server + catalog manifest', () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    catalogVersion: repo.catalogVersion,
    contentHash: repo.contentHash,
    schema: repo.envelope.schema,
    visualContract: repo.visualContractMetadata,
    structure: structureManifest(repo),
    designFoundations: foundationManifest(),
    improvementWorkflow: {
      schema: IMPROVEMENT_WORKFLOW_SCHEMA, resourceUri: IMPROVEMENT_WORKFLOW_URI,
      entryTool: 'get_design_improvement_plan', completionTool: 'validate_design_improvement_result',
      defaultIntent: 'implement-verify-report', executor: 'host-agent',
    },
    languages: repo.envelope.languages,
    counts: {
      styles: repo.allStyles().length,
      motion: repo.data.motionPatterns.length,
      components: repo.data.components.length,
      principles: repo.data.uxPrinciples.length,
      designPrinciples: repo.data.designPrinciples.length,
      auditChecks: repo.policies.auditChecks.length,
      surfaces: repo.data.stateSurfaces.length,
      stateRecipes: repo.data.stateRecipes.length,
      products: repo.data.productArchetypes.length,
      designReferences: repo.allReferences().length,
    },
    // must stay in the canonical CATALOG_DOMAINS order used by generated/manifest.v1.json
    domains: [
      'styles', 'motion', 'components', 'principles', 'design-principles',
      'states', 'products', 'references', 'policies',
    ],
    tools: TOOL_NAMES,
    errorCodes: ERROR_CODES,
    resourceUriTemplates: [
      'webstylebook://styles/{id}',
      'webstylebook://motion/{id}',
      'webstylebook://components/{id}',
      'webstylebook://design-principles/{id}',
      'webstylebook://foundations/{id}',
      'webstylebook://principles/{id}',
      'webstylebook://states/{surface}',
      'webstylebook://states/{surface}/{state}',
      'webstylebook://products/{id}',
      'webstylebook://references/{id}',
      'webstylebook://design-md/{id}',
    ],
  }));

  fixed('styles', 'webstylebook://styles', 'Compact list of visual directions', () => repo.listStyles());
  fixed('improve-ui-workflow', IMPROVEMENT_WORKFLOW_URI, 'Default existing-UI workflow: host implementation, matched comparison and evidence-backed report; localized in en/ko/ja', () => ({
    schema: IMPROVEMENT_WORKFLOW_SCHEMA,
    entryTool: 'get_design_improvement_plan', completionTool: 'validate_design_improvement_result',
    localized: Object.fromEntries((['en', 'ko', 'ja'] as const).map((locale) => [locale, improvementWorkflow(locale, undefined, FOUNDATION_IDENTITY.contentHash)])),
    notice: 'This resource explains the workflow. Obtain an execution plan with context from the entry tool before validating completion.',
  }));
  fixed('motion', 'webstylebook://motion', 'Compact list of motion patterns', () => repo.listMotion());
  fixed('components', 'webstylebook://components', 'Component vocabulary', () => repo.listComponents());
  fixed('design-foundations', 'webstylebook://foundations', 'Compact index of actionable design foundations; retrieve selected localized guidance with get_design_improvement_plan', () => ({
    ...foundationManifest(),
    entries: FOUNDATIONS.map((entry) => ({
      id: entry.id, category: entry.category, name: entry.name, concerns: entry.concerns,
      surfaces: entry.surfaces, relatedPrincipleIds: entry.relatedPrincipleIds,
      resourceUri: `webstylebook://foundations/${entry.id}`,
    })),
  }));
  fixed('design-foundation-sources', 'webstylebook://foundations/sources', 'Research provenance: reviewed sources, bounded supported claims and standard levels; external publications retain their rights', () => ({
    ...FOUNDATION_IDENTITY,
    sources: FOUNDATION_SOURCES,
    notice: 'Source summaries and application guidance are independently authored. No upstream articles, screenshots or assets are bundled. Review dates are point-in-time; the runtime does not fetch these URLs.',
  }));
  server.registerResource('design-foundation-detail', new ResourceTemplate('webstylebook://foundations/{foundationId}', {
    list: async () => ({ resources: FOUNDATIONS.map((entry) => ({ uri: `webstylebook://foundations/${entry.id}`, name: entry.id, mimeType: JSON_MIME })) }),
  }), {
    title: 'Design foundation with conditional improvements',
    description: 'One localized foundation, its cited sources and comparison protocol. Optional query: locale=en|ko|ja. Examples are illustrative, not observed outcomes.',
    mimeType: JSON_MIME,
  }, async (u, v) => {
    const id = String(v.foundationId).split('?')[0] ?? '';
    const entry = FOUNDATIONS.find((foundation) => foundation.id === id);
    if (!entry) return notFound(u.href, 'design foundation', id);
    for (const key of new Set(u.searchParams.keys())) {
      if (key !== 'locale' || u.searchParams.getAll(key).length !== 1) {
        return json(u.href, { error: { code: 'INVALID_INPUT', message: 'only one locale query parameter is supported' } });
      }
    }
    const locale = u.searchParams.get('locale') ?? 'en';
    if (locale !== 'en' && locale !== 'ko' && locale !== 'ja') {
      return json(u.href, { error: { code: 'INVALID_INPUT', message: 'locale must be en, ko or ja' } });
    }
    return json(u.href, {
      identity: FOUNDATION_IDENTITY, foundation: localizeFoundation(entry, locale),
      sources: localizeSources(entry.sourceIds, locale), protocol: localizeProtocol(locale),
    });
  });
  fixed(
    'design-principles',
    'webstylebook://design-principles',
    'Practical visual-design principles with placement and verification guidance',
    () => ({
      categories: repo.data.designPrincipleCategories,
      principles: repo.listDesignPrinciples(),
    }),
  );
  fixed('principles', 'webstylebook://principles', 'Curated UX principles with attribution and evidence labels', () => ({
    attribution: repo.uxPrincipleAttribution,
    categories: repo.data.uxPrincipleCategories,
    principles: repo.listPrinciples(),
  }));
  fixed('state-surfaces', 'webstylebook://states/surfaces', 'UI state surfaces', () => repo.listSurfaces());
  fixed('products', 'webstylebook://products', 'Product archetypes', () => repo.listProducts());
  fixed('references', 'webstylebook://references', 'Compact real-world design reference library with source and rights metadata', () => ({
    schema: repo.referenceLibrary.schema,
    generatedAt: repo.referenceLibrary.generatedAt,
    sourceRevision: repo.referenceLibrary.sourceRevision,
    sourceFiles: repo.referenceLibrary.sourceFiles,
    count: repo.allReferences().length,
    categories: REFERENCE_CATEGORIES,
    tags: repo.listReferenceTags(),
    attribution: repo.referenceLibrary.attribution,
    references: repo.listReferences(),
  }));
  fixed('anti-patterns', 'webstylebook://policies/anti-patterns', 'Common anti-patterns', () => repo.policies.antiPatterns);
  fixed('verification', 'webstylebook://policies/verification', 'Verification checklist', () => repo.policies.verification);
  fixed('audit-checks', 'webstylebook://policies/audit-checks', 'Stable audit ids, applicability, severity and evidence metadata', () => repo.policies.auditChecks);
  fixed(
    'structure-banned-patterns',
    'webstylebook://structure/banned-patterns',
    'Generic page patterns audit_page_structure flags for every style, with machine-checkable criteria, thresholds, and the ruleset hash',
    () => bannedPatternCatalog(),
  );
  fixed(
    'structure-must-haves',
    MUST_HAVE_RESOURCE_URI,
    'Elements each product type requires and the zone each must sit in, with the criteria audit_page_structure uses to find them',
    () => ({ ...mustHaveCatalog(), rulesetHash: structureRulesetHash() }),
  );

  server.registerResource('style', new ResourceTemplate('webstylebook://styles/{styleId}', {
    list: async () => ({ resources: repo.allStyles().map((s) => ({ uri: `webstylebook://styles/${s.id}`, name: s.id, mimeType: JSON_MIME })) }),
  }), {
    title: 'Style detail',
    description: 'Full detail for one style, including its resolved native visual contract, source identity, and page structure (layout archetype, signature moves, banned patterns with their detection criteria). Optional query parameters: locale=en|ko|ja, mode=light|dark, revision=<expected revision>.',
    mimeType: JSON_MIME,
  }, async (u, v) => {
    // The SDK's simple URI-template variable also captures a query suffix.
    const styleId = String(v.styleId).split('?')[0] ?? '';
    const s = repo.getStyle(styleId);
    if (!s) return notFound(u.href, 'style', styleId);
    try {
      const options: VisualResolutionOptions & { revision?: string } = {};
      for (const key of new Set(u.searchParams.keys())) {
        if (!['locale', 'mode', 'revision'].includes(key)) {
          throw new Error(`unsupported visual contract query parameter '${key}'`);
        }
        if (u.searchParams.getAll(key).length !== 1) {
          throw new Error(`visual contract query parameter '${key}' must appear once`);
        }
      }
      const locale = u.searchParams.get('locale');
      const mode = u.searchParams.get('mode');
      const revision = u.searchParams.get('revision');
      if (locale !== null) {
        if (locale !== 'en' && locale !== 'ko' && locale !== 'ja') {
          throw new Error(`unsupported visual contract locale '${locale}'`);
        }
        options.contentLocale = locale;
      }
      if (mode !== null) {
        if (mode !== 'light' && mode !== 'dark') {
          throw new Error(`unsupported visual contract mode '${mode}'`);
        }
        options.mode = mode;
      }
      if (revision !== null) options.revision = revision;
      return json(u.href, {
        ...s,
        visualContract: repo.getVisualContract(s.id, options),
        structure: styleStructure(s.id, repo, options.contentLocale ?? 'en', true),
      });
    } catch (error) {
      return json(u.href, {
        error: { code: 'INVALID_INPUT', message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  server.registerResource('design-md', new ResourceTemplate('webstylebook://design-md/{styleId}', {
    list: async () => ({ resources: repo.allStyles().map((s) => ({ uri: `webstylebook://design-md/${s.id}`, name: `${s.id} DESIGN.md`, mimeType: 'text/markdown' })) }),
  }), {
    title: 'Style as DESIGN.md',
    description: 'One style as a DESIGN.md file (google-labs-code/design.md, version alpha) built from its pinned visual contract in the authored native color mode: the same text compose_design_tokens returns for format "design-md" with contract.schema set. Optional query parameters: locale=en|ko|ja, mode=light|dark, placement=front-matter|interleaved.',
    mimeType: 'text/markdown',
  }, async (u, v) => {
    const styleId = String(v.styleId).split('?')[0] ?? '';
    if (!repo.getStyle(styleId)) return notFound(u.href, 'style', styleId);
    try {
      for (const key of new Set(u.searchParams.keys())) {
        if (!['locale', 'mode', 'placement'].includes(key)) throw new Error(`unsupported DESIGN.md query parameter '${key}'`);
        if (u.searchParams.getAll(key).length !== 1) throw new Error(`DESIGN.md query parameter '${key}' must appear once`);
      }
      const locale = u.searchParams.get('locale') ?? 'en';
      const mode = u.searchParams.get('mode');
      const placement = u.searchParams.get('placement') ?? 'front-matter';
      if (locale !== 'en' && locale !== 'ko' && locale !== 'ja') throw new Error(`unsupported DESIGN.md locale '${locale}'`);
      if (mode !== null && mode !== 'light' && mode !== 'dark') throw new Error(`unsupported DESIGN.md mode '${mode}'`);
      if (!(DESIGN_MD_PLACEMENTS as readonly string[]).includes(placement)) throw new Error(`unsupported DESIGN.md placement '${placement}'`);
      const result = composeDesignTokens({
        primaryStyleId: styleId, format: 'design-md', locale, contract: { schema: VISUAL_SCHEMA },
        ...(mode !== null ? { colorMode: mode } : {}),
        designMd: { tokenPlacement: placement as (typeof DESIGN_MD_PLACEMENTS)[number] },
      }, repo);
      return { contents: [{ uri: u.href, mimeType: 'text/markdown', text: result.content }] };
    } catch (error) {
      return json(u.href, {
        error: { code: 'INVALID_INPUT', message: error instanceof Error ? error.message : String(error) },
      });
    }
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

  server.registerResource(
    'design-principle-detail',
    new ResourceTemplate('webstylebook://design-principles/{designPrincipleId}', {
      list: async () => ({
        resources: repo.data.designPrinciples.map((principle) => ({
          uri: `webstylebook://design-principles/${principle.id}`,
          name: principle.id,
          mimeType: JSON_MIME,
        })),
      }),
    }),
    {
      title: 'Design principle detail',
      description: 'Placement, application, verification, caution, and relationships for one design principle',
      mimeType: JSON_MIME,
    },
    async (u, v) => {
      const principle = repo.getDesignPrinciple(String(v.designPrincipleId));
      return principle
        ? json(u.href, principle)
        : notFound(u.href, 'design principle', String(v.designPrincipleId));
    },
  );

  server.registerResource('principle-detail', new ResourceTemplate('webstylebook://principles/{principleId}', {
    list: async () => ({
      resources: repo.data.uxPrinciples.map((principle) => ({
        uri: `webstylebook://principles/${principle.id}`,
        name: principle.id,
        mimeType: JSON_MIME,
      })),
    }),
  }), { title: 'UX principle detail', description: 'Application, verification, caution, and evidence for one UX principle', mimeType: JSON_MIME }, async (u, v) => {
    const principle = repo.getPrinciple(String(v.principleId));
    return principle
      ? json(u.href, { ...principle, attribution: repo.uxPrincipleAttribution })
      : notFound(u.href, 'UX principle', String(v.principleId));
  });

  server.registerResource('product-detail', new ResourceTemplate('webstylebook://products/{productId}', {
    list: async () => ({ resources: repo.data.productArchetypes.map((p) => ({ uri: `webstylebook://products/${p.id}`, name: p.id, mimeType: JSON_MIME })) }),
  }), { title: 'Product archetype detail', description: 'Full detail for one product archetype', mimeType: JSON_MIME }, async (u, v) => {
    const p = repo.getProduct(String(v.productId)); return p ? json(u.href, p) : notFound(u.href, 'product', String(v.productId));
  });

  server.registerResource('reference-detail', new ResourceTemplate('webstylebook://references/{referenceId}', {
    list: async () => ({
      resources: repo.allReferences().map((reference) => ({
        uri: `webstylebook://references/${reference.id}`,
        name: reference.title,
        mimeType: JSON_MIME,
      })),
    }),
  }), {
    title: 'Design reference detail',
    description: 'Full observed design reference with tokens, attribution, adaptation notice, and rights notice',
    mimeType: JSON_MIME,
  }, async (u, v) => {
    const reference = repo.getReference(String(v.referenceId));
    return reference
      ? json(u.href, {
        ...reference,
        library: {
          schema: repo.referenceLibrary.schema,
          generatedAt: repo.referenceLibrary.generatedAt,
          sourceRevision: repo.referenceLibrary.sourceRevision,
        },
        attribution: repo.referenceLibrary.attribution,
      })
      : notFound(u.href, 'design reference', String(v.referenceId));
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
