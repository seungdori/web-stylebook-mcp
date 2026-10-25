import type { CatalogRepository } from '../catalog/repository.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import { text } from '../localization.js';
import { SERVER_VERSION } from '../server-info.js';
import type { Density, Lang, ProductType } from '../types.js';
import { STRUCTURE_GUIDES } from './guides/index.js';
import {
  MH, MUST_HAVES, PRODUCT_MUST_HAVES, ZONE_CRITERIA, ZONE_TEXT, candidateMustHaves, type CandidateMustHave,
} from './must-haves.js';
import { GLOBAL_PATTERNS, T, styleRuleText } from './patterns.js';
import {
  GLOBAL_PATTERN_IDS, type CriterionDef, type GlobalPatternId, type GuideBasis, type StructureGuideDef,
  type StructureJob, type StyleBanDef, type StyleBanSource,
} from './types.js';

export const STRUCTURE_SCHEMA = 'webstylebook.structure.v1';

export interface StyleBanView {
  id: string;
  rule: StyleBanDef['rule'];
  name: string;
  why: string;
  fix: string;
  /** Present on detailed views: the thresholds and catalog source behind the ban. */
  detect?: { params: StyleBanDef['params']; criteria: CriterionDef[]; source: StyleBanSource };
}

export interface StyleStructure {
  schema: typeof STRUCTURE_SCHEMA;
  styleId: string;
  basis: GuideBasis;
  /** Where an authored archetype breaks from the style's specimen page, and why. */
  departure?: string;
  archetype: {
    hero: string;
    grid: string;
    sectionOrder: string[];
    density: { note: string; levels: Density[]; spacing: string; rowPx: number; gutterPx: number; sectionPx: number };
    typeScale: { note: string; displayRem: { min: number; max: number }; bodyRem: number; displayToBody: number; displayFamily: string };
  };
  signatureMoves: Array<{ id: string; name: string; build: string; purpose: string; jobs: StructureJob[]; basis: GuideBasis }>;
  bannedPatterns: {
    global: GlobalPatternId[];
    style: StyleBanView[];
    allowed: Array<{ patternId: GlobalPatternId; reason: string }>;
  };
  resourceUri: string;
}

/**
 * The recommendation view: enough to compare directions by structure. Move build steps and ban detection criteria
 * stay on the style resource, which keeps a ten-candidate result readable.
 */
export interface StyleStructureSummary {
  schema: typeof STRUCTURE_SCHEMA;
  styleId: string;
  basis: GuideBasis;
  archetype: StyleStructure['archetype'];
  signatureMoves: Array<{ id: string; name: string; purpose: string; jobs: StructureJob[] }>;
  bannedPatterns: {
    global: GlobalPatternId[];
    style: Array<{ id: string; rule: StyleBanDef['rule']; name: string }>;
    allowed: Array<{ patternId: GlobalPatternId; reason: string }>;
  };
  /**
   * How this archetype places the product type's must-haves: each one's zone (a first-screen item goes in the hero)
   * and the signature moves that do the same job. Present when the product type defines must-haves.
   */
  mustHaves?: CandidateMustHave[];
  resourceUri: string;
}

const guideById = new Map(STRUCTURE_GUIDES.map((guide) => [guide.styleId, guide]));

export function hasStructureGuide(styleId: string): boolean {
  return guideById.has(styleId);
}

export function structureGuide(styleId: string): StructureGuideDef {
  const guide = guideById.get(styleId);
  if (!guide) throw new Error(`no structure guide for style '${styleId}'`);
  return guide;
}

export function styleBanId(styleId: string, ban: StyleBanDef): string {
  return `${styleId}/${ban.rule}`;
}

export function styleBanView(styleId: string, ban: StyleBanDef, locale: Lang, detail: boolean): StyleBanView {
  const wording = styleRuleText(ban.rule, ban.params as never);
  return {
    id: styleBanId(styleId, ban),
    rule: ban.rule,
    name: text(wording.name, locale),
    why: ban.why,
    fix: text(wording.fix, locale),
    ...(detail ? { detect: { params: ban.params, criteria: wording.criteria, source: ban.source } } : {}),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Structural guidance for one style: authored archetype and moves plus the catalog's own spacing and type numbers. */
export function styleStructure(styleId: string, repo: CatalogRepository, locale: Lang = 'en', detail = false): StyleStructure {
  const style = repo.getStyle(styleId);
  if (!style) throw new Error(`unknown style '${styleId}'`);
  const guide = structureGuide(styleId);
  const contract = style.visualContract;
  const display = contract?.typography.roles.display;
  const body = contract?.typography.roles.body;
  const spacing = contract?.spacing;
  const allowed = Object.entries(guide.allow ?? {}) as Array<[GlobalPatternId, string]>;
  return {
    schema: STRUCTURE_SCHEMA,
    styleId,
    basis: guide.basis,
    ...(guide.departure ? { departure: guide.departure } : {}),
    archetype: {
      hero: guide.hero,
      grid: guide.grid,
      sectionOrder: [...guide.sectionOrder],
      density: {
        note: guide.density,
        levels: [...style.recommendationFacets.density],
        spacing: spacing?.density ?? 'unknown',
        rowPx: spacing?.row ?? 0,
        gutterPx: spacing?.gutter ?? 0,
        sectionPx: spacing?.section ?? 0,
      },
      typeScale: {
        note: guide.typeScale,
        displayRem: { min: display?.sizeMinRem ?? 0, max: display?.sizeMaxRem ?? 0 },
        bodyRem: body?.sizeMaxRem ?? 0,
        displayToBody: display && body?.sizeMaxRem ? round2(display.sizeMaxRem / body.sizeMaxRem) : 0,
        displayFamily: display?.fontFamily ?? '',
      },
    },
    signatureMoves: guide.moves.map((move) => ({ ...move, jobs: [...move.jobs] })),
    bannedPatterns: {
      global: GLOBAL_PATTERN_IDS.filter((id) => !allowed.some(([patternId]) => patternId === id)),
      style: guide.bans.map((ban) => styleBanView(styleId, ban, locale, detail)),
      allowed: allowed.map(([patternId, reason]) => ({ patternId, reason })),
    },
    resourceUri: `webstylebook://styles/${styleId}`,
  };
}

/** A pointer that fits the token result's size budget; the full structure lives on the candidate and the style resource. */
export interface StructureReference {
  schema: typeof STRUCTURE_SCHEMA;
  styleId: string;
  resourceUri: string;
  signatureMoves: string[];
}

export function structureReference(styleId: string): StructureReference {
  return {
    schema: STRUCTURE_SCHEMA,
    styleId,
    resourceUri: `webstylebook://styles/${styleId}`,
    signatureMoves: structureGuide(styleId).moves.map((move) => move.id),
  };
}

export function styleStructureSummary(
  styleId: string, repo: CatalogRepository, locale: Lang = 'en', productType?: ProductType,
): StyleStructureSummary {
  const full = styleStructure(styleId, repo, locale);
  const mustHaves = productType ? candidateMustHaves(productType, full.signatureMoves) : [];
  return {
    schema: full.schema,
    styleId,
    basis: full.basis,
    archetype: full.archetype,
    signatureMoves: full.signatureMoves.map(({ id, name, purpose, jobs }) => ({ id, name, purpose, jobs })),
    bannedPatterns: {
      global: full.bannedPatterns.global,
      style: full.bannedPatterns.style.map(({ id, rule, name }) => ({ id, rule, name })),
      allowed: full.bannedPatterns.allowed,
    },
    ...(mustHaves.length ? { mustHaves } : {}),
    resourceUri: full.resourceUri,
  };
}

export interface BannedPatternCatalog {
  schema: typeof STRUCTURE_SCHEMA;
  rulesetHash: string;
  thresholds: typeof T;
  global: typeof GLOBAL_PATTERNS;
}

let rulesetHashMemo: string | null = null;

/**
 * Hash of the guides, patterns, thresholds, and rule wording. Detector code is not hashable data, so the server
 * version stands in for it: a detector change without a release does not change this hash.
 */
export function structureRulesetHash(): string {
  rulesetHashMemo ??= stableHashOf({
    schema: STRUCTURE_SCHEMA,
    serverVersion: SERVER_VERSION,
    thresholds: T,
    global: GLOBAL_PATTERNS,
    guides: STRUCTURE_GUIDES.map((guide) => ({
      ...guide,
      bans: guide.bans.map((ban) => ({ ...ban, wording: styleRuleText(ban.rule, ban.params as never) })),
    })),
    mustHaves: { thresholds: MH, zones: { text: ZONE_TEXT, criteria: ZONE_CRITERIA }, items: MUST_HAVES, productTypes: PRODUCT_MUST_HAVES },
  });
  return rulesetHashMemo;
}

export function bannedPatternCatalog(): BannedPatternCatalog {
  return { schema: STRUCTURE_SCHEMA, rulesetHash: structureRulesetHash(), thresholds: T, global: GLOBAL_PATTERNS };
}

export function structureManifest(repo: CatalogRepository) {
  return {
    schema: STRUCTURE_SCHEMA,
    rulesetHash: structureRulesetHash(),
    styles: STRUCTURE_GUIDES.length,
    signatureMoves: STRUCTURE_GUIDES.reduce((sum, guide) => sum + guide.moves.length, 0),
    globalBannedPatterns: GLOBAL_PATTERNS.length,
    styleBans: STRUCTURE_GUIDES.reduce((sum, guide) => sum + guide.bans.length, 0),
    mustHaves: MUST_HAVES.length,
    mustHaveProductTypes: PRODUCT_MUST_HAVES.length,
    catalogStyles: repo.allStyles().length,
  };
}
