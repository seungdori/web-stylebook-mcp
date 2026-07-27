// Runtime catalog repository. Loads the committed catalog.v1.json (ADR-003: the
// only thing the MCP runtime reads), verifies the schema id, and builds id indexes
// once at startup. Per-request schema validation is NOT repeated (02 §7).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  CatalogEnvelope, WebStylebookCatalogV1, CatalogStyle, MotionPattern, ComponentTerm,
  ProductArchetype, StateSurface, StateRecipe, StyleFamily, Ontology, NotIdealMap,
  Policies, Lang, UxPrinciple, UxPrincipleAttribution, DesignPrinciple,
} from '../types.js';
import { text } from '../localization.js';

export interface StyleSummary {
  id: string; kind: 'style' | 'fusion'; name: string; summary: string;
  tags: string[]; bestFor: string[]; notIdealFor: string[]; resourceUri: string;
}
export interface MotionSummary {
  id: string; category: string; name: string; summary: string; intensity: string; resourceUri: string;
}
export interface ComponentSummary {
  id: string; category: string; name: string; resourceUri: string;
}
// phaseTags are carried on the compact lists too: `phase` is a first-class selector on
// get_ux_principle_plan / get_design_principle_plan, so an agent browsing the list resource
// must be able to pre-filter by it without fetching every detail resource.
export interface PrincipleSummary {
  id: string; category: string; name: string; summary: string;
  outcomeTags: string[]; surfaceTags: string[]; phaseTags: string[];
  confidence: string; resourceUri: string;
}
export interface DesignPrincipleSummary {
  id: string; category: string; name: string; summary: string;
  concernTags: string[]; surfaceTags: string[]; phaseTags: string[]; resourceUri: string;
}
export interface SurfaceSummary {
  id: string; name: string; requiredStateIds: string[]; recommendedStateIds: string[]; resourceUri: string;
}
export interface ProductSummary {
  id: string; name: string; resourceUri: string;
}

export const SCHEMA_ID = 'webstylebook.catalog.v1';

function locateCatalog(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/catalog (or src/catalog under tsx)
  return join(here, '..', '..', 'generated', 'catalog.v1.json');
}

export class CatalogRepository {
  readonly envelope: CatalogEnvelope;
  readonly data: WebStylebookCatalogV1;

  private readonly styleById = new Map<string, CatalogStyle>();
  private readonly motionById = new Map<string, MotionPattern>();
  private readonly componentById = new Map<string, ComponentTerm>();
  private readonly principleById = new Map<string, UxPrinciple>();
  private readonly designPrincipleById = new Map<string, DesignPrinciple>();
  private readonly productById = new Map<string, ProductArchetype>();
  private readonly surfaceById = new Map<string, StateSurface>();
  private readonly recipeById = new Map<string, StateRecipe>();
  private readonly familyById = new Map<string, StyleFamily>();
  private readonly recipesBySurface = new Map<string, StateRecipe[]>();

  constructor(envelope: CatalogEnvelope) {
    if (envelope.schema !== SCHEMA_ID) {
      throw new Error(`unexpected catalog schema '${envelope.schema}', expected '${SCHEMA_ID}'`);
    }
    this.envelope = envelope;
    this.data = envelope.data;
    for (const s of this.data.styles) this.styleById.set(s.id, s);
    for (const m of this.data.motionPatterns) this.motionById.set(m.id, m);
    for (const c of this.data.components) this.componentById.set(c.id, c);
    for (const p of this.data.uxPrinciples) this.principleById.set(p.id, p);
    for (const p of this.data.designPrinciples) this.designPrincipleById.set(p.id, p);
    for (const p of this.data.productArchetypes) this.productById.set(p.id, p);
    for (const f of this.data.styleFamilies) this.familyById.set(f.id, f);
    for (const surf of this.data.stateSurfaces) {
      this.surfaceById.set(surf.id, surf);
      this.recipesBySurface.set(surf.id, []);
    }
    for (const r of this.data.stateRecipes) {
      this.recipeById.set(r.id, r);
      for (const sid of r.surfaceIds) {
        const list = this.recipesBySurface.get(sid);
        if (list) list.push(r);
      }
    }
  }

  static load(path: string = locateCatalog()): CatalogRepository {
    let raw: string;
    try {
      raw = readFileSync(path, 'utf8');
    } catch (err) {
      throw new Error(`failed to read catalog at ${path}: ${(err as Error).message}`, { cause: err });
    }
    const envelope = JSON.parse(raw) as CatalogEnvelope;
    return new CatalogRepository(envelope);
  }

  get ontology(): Ontology { return this.data.ontology; }
  get notIdealMap(): NotIdealMap { return this.data.notIdealMap; }
  get policies(): Policies { return this.data.policies; }
  get uxPrincipleAttribution(): UxPrincipleAttribution { return this.data.uxPrincipleAttribution; }
  get styleFamilies(): StyleFamily[] { return this.data.styleFamilies; }
  get catalogVersion(): string { return this.envelope.catalogVersion; }
  get contentHash(): string { return this.envelope.contentHash; }

  allStyles(): CatalogStyle[] { return this.data.styles; }
  allDesignPrinciples(): DesignPrinciple[] { return this.data.designPrinciples; }
  getStyle(id: string): CatalogStyle | undefined { return this.styleById.get(id); }
  getFamily(id: string): StyleFamily | undefined { return this.familyById.get(id); }
  getMotion(id: string): MotionPattern | undefined { return this.motionById.get(id); }
  getComponent(id: string): ComponentTerm | undefined { return this.componentById.get(id); }
  getPrinciple(id: string): UxPrinciple | undefined { return this.principleById.get(id); }
  getDesignPrinciple(id: string): DesignPrinciple | undefined { return this.designPrincipleById.get(id); }
  getProduct(id: string): ProductArchetype | undefined { return this.productById.get(id); }
  getSurface(id: string): StateSurface | undefined { return this.surfaceById.get(id); }
  getRecipe(id: string): StateRecipe | undefined { return this.recipeById.get(id); }
  recipesForSurface(surfaceId: string): StateRecipe[] { return this.recipesBySurface.get(surfaceId) ?? []; }

  listStyles(locale: Lang = 'en'): StyleSummary[] {
    return this.data.styles.map((s) => ({
      id: s.id, kind: s.kind, name: text(s.name, locale), summary: text(s.summary, locale),
      tags: s.tags, bestFor: s.bestFor, notIdealFor: s.notIdealFor,
      resourceUri: `webstylebook://styles/${s.id}`,
    }));
  }
  listMotion(locale: Lang = 'en'): MotionSummary[] {
    return this.data.motionPatterns.map((m) => ({
      id: m.id, category: m.category, name: text(m.name, locale), summary: text(m.summary, locale),
      intensity: m.intensity, resourceUri: `webstylebook://motion/${m.id}`,
    }));
  }
  listComponents(locale: Lang = 'en'): ComponentSummary[] {
    return this.data.components.map((c) => ({
      id: c.id, category: c.category, name: text(c.name, locale),
      resourceUri: `webstylebook://components/${c.id}`,
    }));
  }
  listPrinciples(locale: Lang = 'en'): PrincipleSummary[] {
    return this.data.uxPrinciples.map((p) => ({
      id: p.id,
      category: p.category,
      name: text(p.name, locale),
      summary: text(p.summary, locale),
      outcomeTags: p.outcomeTags,
      surfaceTags: p.surfaceTags,
      phaseTags: p.phaseTags,
      confidence: p.evidence.confidence,
      resourceUri: `webstylebook://principles/${p.id}`,
    }));
  }
  listDesignPrinciples(locale: Lang = 'en'): DesignPrincipleSummary[] {
    return this.data.designPrinciples.map((p) => ({
      id: p.id,
      category: p.category,
      name: text(p.name, locale),
      summary: text(p.summary, locale),
      concernTags: p.concernTags,
      surfaceTags: p.surfaceTags,
      phaseTags: p.phaseTags,
      resourceUri: `webstylebook://design-principles/${p.id}`,
    }));
  }
  listSurfaces(locale: Lang = 'en'): SurfaceSummary[] {
    return this.data.stateSurfaces.map((s) => ({
      id: s.id, name: text(s.name, locale),
      requiredStateIds: s.requiredStateIds, recommendedStateIds: s.recommendedStateIds,
      resourceUri: `webstylebook://states/${s.id}`,
    }));
  }
  listProducts(locale: Lang = 'en'): ProductSummary[] {
    return this.data.productArchetypes.map((p) => ({
      id: p.id, name: text(p.name, locale), resourceUri: `webstylebook://products/${p.id}`,
    }));
  }
}
