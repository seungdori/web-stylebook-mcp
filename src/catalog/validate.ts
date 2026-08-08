// Lightweight runtime validation of the packaged catalog (CLI --validate-catalog).
// Deep zod/reference validation lives in the repo's build scripts; this is a fast
// load-time sanity check that the shipped artifact is intact.

import type { CatalogRepository } from './repository.js';
import {
  DESIGN_CONCERNS,
  DESIGN_PRINCIPLE_CATEGORIES,
  AUDIT_APPLICABILITY,
  AUDIT_AUTOMATION_LEVELS,
  AUDIT_EVIDENCE_TYPES,
  AUDIT_SEVERITIES,
  LANGS,
  UX_EVIDENCE_CONFIDENCE,
  UX_EVIDENCE_KINDS,
  UX_OUTCOMES,
  UX_PHASES,
  UX_PRINCIPLE_CATEGORIES,
  UX_SURFACES,
} from '../types.js';
import type { LocalizedText } from '../types.js';
import { contentHashOf } from './stable-hash.js';

function localeComplete(v: unknown): v is LocalizedText {
  if (!v || typeof v !== 'object') return false;
  const localized = v as Record<string, unknown>;
  return LANGS.every((l) => typeof localized[l] === 'string' && localized[l].trim().length > 0);
}

function validEnumArray(
  value: unknown,
  allowed: readonly string[],
  label: string,
  errors: string[],
): value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return false;
  }
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item)) {
      errors.push(`${label} has unknown value ${String(item)}`);
    }
  }
  return true;
}

function exactEnum(
  actual: unknown,
  expected: readonly string[],
  label: string,
  errors: string[],
): void {
  if (!Array.isArray(actual) || actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])) {
    errors.push(`${label} does not match the runtime enum contract`);
  }
}

function validHttps(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('https://');
}

function validLocalizedTextArray(
  value: unknown,
  label: string,
  errors: string[],
): value is LocalizedText[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return false;
  }
  for (const item of value) {
    if (!localeComplete(item)) errors.push(`${label} has an entry that is not locale-complete`);
  }
  return true;
}

function validStringArray(
  value: unknown,
  label: string,
  errors: string[],
): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return false;
  }
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) errors.push(`${label} has an invalid string`);
  }
  return true;
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
  const categoryIds = new Set<string>();
  for (const category of data.uxPrincipleCategories) {
    if (categoryIds.has(category.id)) errors.push(`duplicate principle category id ${category.id}`);
    categoryIds.add(category.id);
    if (!UX_PRINCIPLE_CATEGORIES.includes(category.id)) {
      errors.push(`unknown principle category id ${category.id}`);
    }
    if (!localeComplete(category.label)) errors.push(`principle category ${category.id} label not locale-complete`);
    if (!localeComplete(category.description)) errors.push(`principle category ${category.id} description not locale-complete`);
  }
  for (const category of UX_PRINCIPLE_CATEGORIES) {
    if (!categoryIds.has(category)) errors.push(`missing principle category ${category}`);
  }

  const enums = data.ontologyEnums as unknown as Record<string, unknown>;
  if (!enums || typeof enums !== 'object') {
    errors.push('ontologyEnums missing');
  } else {
    exactEnum(enums.uxPrincipleCategories, UX_PRINCIPLE_CATEGORIES, 'ontologyEnums.uxPrincipleCategories', errors);
    exactEnum(enums.uxOutcomes, UX_OUTCOMES, 'ontologyEnums.uxOutcomes', errors);
    exactEnum(enums.uxSurfaces, UX_SURFACES, 'ontologyEnums.uxSurfaces', errors);
    exactEnum(enums.uxPhases, UX_PHASES, 'ontologyEnums.uxPhases', errors);
    exactEnum(enums.uxEvidenceKinds, UX_EVIDENCE_KINDS, 'ontologyEnums.uxEvidenceKinds', errors);
    exactEnum(enums.uxEvidenceConfidence, UX_EVIDENCE_CONFIDENCE, 'ontologyEnums.uxEvidenceConfidence', errors);
    exactEnum(
      enums.designPrincipleCategories,
      DESIGN_PRINCIPLE_CATEGORIES,
      'ontologyEnums.designPrincipleCategories',
      errors,
    );
    exactEnum(enums.designConcerns, DESIGN_CONCERNS, 'ontologyEnums.designConcerns', errors);
    exactEnum(enums.auditSeverities, AUDIT_SEVERITIES, 'ontologyEnums.auditSeverities', errors);
    exactEnum(enums.auditEvidenceTypes, AUDIT_EVIDENCE_TYPES, 'ontologyEnums.auditEvidenceTypes', errors);
    exactEnum(enums.auditAutomationLevels, AUDIT_AUTOMATION_LEVELS, 'ontologyEnums.auditAutomationLevels', errors);
    exactEnum(enums.auditApplicability, AUDIT_APPLICABILITY, 'ontologyEnums.auditApplicability', errors);
  }

  const principleIds = new Set<string>();
  const representedCategories = new Set<string>();
  for (const principle of data.uxPrinciples) {
    if (principleIds.has(principle.id)) errors.push(`duplicate principle id ${principle.id}`);
    principleIds.add(principle.id);
    representedCategories.add(principle.category);
    if (!UX_PRINCIPLE_CATEGORIES.includes(principle.category)) {
      errors.push(`principle ${principle.id} has unknown category ${principle.category}`);
    }
    validEnumArray(principle.outcomeTags, UX_OUTCOMES, `principle ${principle.id} outcomeTags`, errors);
    validEnumArray(principle.surfaceTags, UX_SURFACES, `principle ${principle.id} surfaceTags`, errors);
    validEnumArray(principle.phaseTags, UX_PHASES, `principle ${principle.id} phaseTags`, errors);
    if (!localeComplete(principle.name)) errors.push(`principle ${principle.id} name not locale-complete`);
    if (!localeComplete(principle.summary)) errors.push(`principle ${principle.id} summary not locale-complete`);
    if (!localeComplete(principle.designQuestion)) errors.push(`principle ${principle.id} question not locale-complete`);
    if (!localeComplete(principle.caution)) errors.push(`principle ${principle.id} caution not locale-complete`);
    for (const item of [...principle.apply, ...principle.verify]) {
      if (!localeComplete(item)) errors.push(`principle ${principle.id} guidance not locale-complete`);
    }
    if (!UX_EVIDENCE_KINDS.includes(principle.evidence?.kind)) {
      errors.push(`principle ${principle.id} has unknown evidence kind ${String(principle.evidence?.kind)}`);
    }
    if (!UX_EVIDENCE_CONFIDENCE.includes(principle.evidence?.confidence)) {
      errors.push(`principle ${principle.id} has unknown evidence confidence ${String(principle.evidence?.confidence)}`);
    }
    if (!Array.isArray(principle.evidence?.references) || !principle.evidence.references.length) {
      errors.push(`principle ${principle.id} missing evidence references`);
    } else {
      for (const reference of principle.evidence.references) {
        if (typeof reference.title !== 'string' || !reference.title.trim()) {
          errors.push(`principle ${principle.id} has an empty evidence title`);
        }
        if (!validHttps(reference.url)) errors.push(`principle ${principle.id} evidence reference must use HTTPS`);
      }
    }
    if (typeof principle.referenceUrl !== 'string'
      || !/^https:\/\/lawsofux\.com\/[a-z0-9-]+\/$/.test(principle.referenceUrl)) {
      errors.push(`principle ${principle.id} referenceUrl is not canonical`);
    }
  }
  for (const category of UX_PRINCIPLE_CATEGORIES) {
    if (!representedCategories.has(category)) errors.push(`principle category ${category} has no entries`);
  }
  for (const principle of data.uxPrinciples) {
    for (const relatedId of principle.relatedPrincipleIds) {
      if (!principleIds.has(relatedId)) errors.push(`principle ${principle.id} -> unknown related principle ${relatedId}`);
      if (relatedId === principle.id) errors.push(`principle ${principle.id} references itself`);
    }
  }

  const attribution = data.uxPrincipleAttribution;
  if (!attribution || typeof attribution !== 'object') {
    errors.push('uxPrincipleAttribution missing');
  } else {
    if (attribution.sourceName !== 'Laws of UX') errors.push('uxPrincipleAttribution sourceName mismatch');
    if (typeof attribution.creator !== 'string' || !attribution.creator.trim()) errors.push('uxPrincipleAttribution creator missing');
    if (attribution.sourceUrl !== 'https://lawsofux.com/') errors.push('uxPrincipleAttribution sourceUrl mismatch');
    if (attribution.sourceLicense?.name !== 'CC BY-NC-ND 4.0'
      || attribution.sourceLicense.url !== 'https://creativecommons.org/licenses/by-nc-nd/4.0/') {
      errors.push('uxPrincipleAttribution source license mismatch');
    }
    if (attribution.authoredContentLicense?.name !== 'MIT'
      || attribution.authoredContentLicense.url !== 'https://github.com/seungdori/web-stylebook-mcp/blob/main/LICENSE') {
      errors.push('uxPrincipleAttribution authored-content license mismatch');
    }
    if (!localeComplete(attribution.notice)) errors.push('uxPrincipleAttribution notice not locale-complete');
  }

  const designCategoryIds = new Set<string>();
  for (const category of data.designPrincipleCategories) {
    if (designCategoryIds.has(category.id)) {
      errors.push(`duplicate design principle category id ${category.id}`);
    }
    designCategoryIds.add(category.id);
    if (!DESIGN_PRINCIPLE_CATEGORIES.includes(category.id)) {
      errors.push(`unknown design principle category id ${category.id}`);
    }
    if (!localeComplete(category.label)) {
      errors.push(`design principle category ${category.id} label not locale-complete`);
    }
    if (!localeComplete(category.description)) {
      errors.push(`design principle category ${category.id} description not locale-complete`);
    }
  }
  for (const category of DESIGN_PRINCIPLE_CATEGORIES) {
    if (!designCategoryIds.has(category)) {
      errors.push(`missing design principle category ${category}`);
    }
  }

  const designPrincipleIds = new Set<string>();
  const representedDesignCategories = new Set<string>();
  for (const principle of data.designPrinciples) {
    if (designPrincipleIds.has(principle.id)) {
      errors.push(`duplicate design principle id ${principle.id}`);
    }
    designPrincipleIds.add(principle.id);
    representedDesignCategories.add(principle.category);
    if (!DESIGN_PRINCIPLE_CATEGORIES.includes(principle.category)) {
      errors.push(`design principle ${principle.id} has unknown category ${principle.category}`);
    }
    if (!localeComplete(principle.name)) {
      errors.push(`design principle ${principle.id} name not locale-complete`);
    }
    if (!localeComplete(principle.summary)) {
      errors.push(`design principle ${principle.id} summary not locale-complete`);
    }
    if (!localeComplete(principle.designQuestion)) {
      errors.push(`design principle ${principle.id} question not locale-complete`);
    }
    if (!localeComplete(principle.caution)) {
      errors.push(`design principle ${principle.id} caution not locale-complete`);
    }
    validStringArray(principle.aliases, `design principle ${principle.id} aliases`, errors);
    validLocalizedTextArray(
      principle.placement,
      `design principle ${principle.id} placement`,
      errors,
    );
    validLocalizedTextArray(principle.apply, `design principle ${principle.id} apply`, errors);
    validLocalizedTextArray(principle.verify, `design principle ${principle.id} verify`, errors);
    validEnumArray(
      principle.concernTags,
      DESIGN_CONCERNS,
      `design principle ${principle.id} concernTags`,
      errors,
    );
    validEnumArray(
      principle.surfaceTags,
      UX_SURFACES,
      `design principle ${principle.id} surfaceTags`,
      errors,
    );
    validEnumArray(
      principle.phaseTags,
      UX_PHASES,
      `design principle ${principle.id} phaseTags`,
      errors,
    );
    validStringArray(
      principle.relatedDesignPrincipleIds,
      `design principle ${principle.id} relatedDesignPrincipleIds`,
      errors,
    );
    validStringArray(
      principle.relatedUxPrincipleIds,
      `design principle ${principle.id} relatedUxPrincipleIds`,
      errors,
    );
  }

  const auditIds = new Set<string>();
  const expectedAuditSources = new Set<string>();
  for (const group of data.policies.verification) {
    group.items.forEach((_item, itemIndex) => expectedAuditSources.add(`verification:${group.id}:${itemIndex}`));
  }
  for (const antiPattern of data.policies.antiPatterns) {
    expectedAuditSources.add(`anti-pattern:${antiPattern.id}`);
  }
  const seenAuditSources = new Set<string>();
  for (const check of data.policies.auditChecks) {
    if (auditIds.has(check.id)) errors.push(`duplicate audit check id ${check.id}`);
    auditIds.add(check.id);
    validEnumArray(check.surfaceTags, UX_SURFACES, `audit check ${check.id} surfaceTags`, errors);
    if (!AUDIT_SEVERITIES.includes(check.severity)) {
      errors.push(`audit check ${check.id} has unknown severity ${check.severity}`);
    }
    if (!AUDIT_AUTOMATION_LEVELS.includes(check.automation)) {
      errors.push(`audit check ${check.id} has unknown automation ${check.automation}`);
    }
    if (!AUDIT_APPLICABILITY.includes(check.applicability)) {
      errors.push(`audit check ${check.id} has unknown applicability ${check.applicability}`);
    }
    validEnumArray(check.evidenceTypes, AUDIT_EVIDENCE_TYPES, `audit check ${check.id} evidenceTypes`, errors);
    const sourceKey = check.source.kind === 'verification'
      ? `verification:${check.source.groupId}:${check.source.itemIndex}`
      : `anti-pattern:${check.source.antiPatternId}`;
    if (!expectedAuditSources.has(sourceKey)) errors.push(`audit check ${check.id} -> unknown source ${sourceKey}`);
    if (seenAuditSources.has(sourceKey)) errors.push(`duplicate audit check source ${sourceKey}`);
    seenAuditSources.add(sourceKey);
  }
  for (const sourceKey of expectedAuditSources) {
    if (!seenAuditSources.has(sourceKey)) errors.push(`audit source ${sourceKey} has no check definition`);
  }
  for (const category of DESIGN_PRINCIPLE_CATEGORIES) {
    if (!representedDesignCategories.has(category)) {
      errors.push(`design principle category ${category} has no entries`);
    }
  }
  for (const principle of data.designPrinciples) {
    for (const relatedId of principle.relatedDesignPrincipleIds ?? []) {
      if (!designPrincipleIds.has(relatedId)) {
        errors.push(`design principle ${principle.id} -> unknown related design principle ${relatedId}`);
      }
      if (relatedId === principle.id) {
        errors.push(`design principle ${principle.id} references itself`);
      }
    }
    for (const relatedId of principle.relatedUxPrincipleIds ?? []) {
      if (!principleIds.has(relatedId)) {
        errors.push(`design principle ${principle.id} -> unknown related UX principle ${relatedId}`);
      }
    }
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
      principles: data.uxPrinciples.length,
      designPrinciples: data.designPrinciples.length,
      auditChecks: data.policies.auditChecks.length,
      surfaces: data.stateSurfaces.length,
      recipes: data.stateRecipes.length,
      products: data.productArchetypes.length,
    },
  };
}
