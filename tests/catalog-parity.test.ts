import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateLoaded } from '../src/catalog/validate.js';
import { contentHashOf } from '../src/catalog/stable-hash.js';
import { SERVER_VERSION } from '../src/server-info.js';
import {
  DESIGN_CONCERNS,
  DESIGN_PRINCIPLE_CATEGORIES,
  AUDIT_APPLICABILITY,
  AUDIT_AUTOMATION_LEVELS,
  AUDIT_EVIDENCE_TYPES,
  AUDIT_SEVERITIES,
  UX_EVIDENCE_CONFIDENCE,
  UX_EVIDENCE_KINDS,
  UX_OUTCOMES,
  UX_PHASES,
  UX_PRINCIPLE_CATEGORIES,
  UX_SURFACES,
} from '../src/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = CatalogRepository.load();
const manifest = JSON.parse(readFileSync(join(root, 'generated/manifest.v1.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(root, 'generated/catalog.v1.json'), 'utf8'));

function reportAfter(mutator: (envelope: any) => void) {
  const envelope = structuredClone(repo.envelope) as any;
  mutator(envelope);
  const base = { ...envelope };
  delete base.contentHash;
  envelope.contentHash = contentHashOf(base);
  return validateLoaded(new CatalogRepository(envelope));
}

describe('bundled catalog integrity', () => {
  it('keeps manifest identity, hash, and version aligned with the runtime catalog', () => {
    expect(manifest.schema).toBe(catalog.schema);
    expect(manifest.catalogVersion).toBe(catalog.catalogVersion);
    expect(manifest.catalogVersion).toBe(SERVER_VERSION);
    expect(manifest.contentHash).toBe(catalog.contentHash);
    expect(manifest.contentHash).toBe(repo.contentHash);
  });

  it('keeps all generated counts and domains aligned with runtime data', () => {
    expect(manifest.counts).toEqual({
      styles: repo.data.styles.length,
      motionPatterns: repo.data.motionPatterns.length,
      components: repo.data.components.length,
      designPrinciples: repo.data.designPrinciples.length,
      auditChecks: repo.data.policies.auditChecks.length,
      principles: repo.data.uxPrinciples.length,
      productArchetypes: repo.data.productArchetypes.length,
      stateSurfaces: repo.data.stateSurfaces.length,
      stateRecipes: repo.data.stateRecipes.length,
    });
    expect(manifest.domains).toEqual([
      'styles', 'motion', 'components', 'principles',
      'design-principles', 'states', 'products', 'policies',
    ]);
  });

  it('passes runtime hash, locale, and reference validation', () => {
    const report = validateLoaded(repo);
    expect(report.errors, report.errors.join('\n')).toEqual([]);
    expect(report.summary.principles).toBe(23);
    expect(report.summary.designPrinciples).toBe(repo.data.designPrinciples.length);
  });

  it('keeps self-described UX enums aligned with the runtime contract', () => {
    expect(repo.data.ontologyEnums.uxPrincipleCategories).toEqual([...UX_PRINCIPLE_CATEGORIES]);
    expect(repo.data.ontologyEnums.uxOutcomes).toEqual([...UX_OUTCOMES]);
    expect(repo.data.ontologyEnums.uxSurfaces).toEqual([...UX_SURFACES]);
    expect(repo.data.ontologyEnums.uxPhases).toEqual([...UX_PHASES]);
    expect(repo.data.ontologyEnums.uxEvidenceKinds).toEqual([...UX_EVIDENCE_KINDS]);
    expect(repo.data.ontologyEnums.uxEvidenceConfidence).toEqual([...UX_EVIDENCE_CONFIDENCE]);
    expect(repo.data.ontologyEnums.designPrincipleCategories)
      .toEqual([...DESIGN_PRINCIPLE_CATEGORIES]);
    expect(repo.data.ontologyEnums.designConcerns).toEqual([...DESIGN_CONCERNS]);
    expect(repo.data.ontologyEnums.auditSeverities).toEqual([...AUDIT_SEVERITIES]);
    expect(repo.data.ontologyEnums.auditEvidenceTypes).toEqual([...AUDIT_EVIDENCE_TYPES]);
    expect(repo.data.ontologyEnums.auditAutomationLevels).toEqual([...AUDIT_AUTOMATION_LEVELS]);
    expect(repo.data.ontologyEnums.auditApplicability).toEqual([...AUDIT_APPLICABILITY]);
  });

  it.each([
    ['unknown category', (envelope: any) => { envelope.data.uxPrinciples[0].category = 'not-a-category'; }],
    ['unknown surface', (envelope: any) => { envelope.data.uxPrinciples[0].surfaceTags = ['not-a-surface']; }],
    ['unknown confidence', (envelope: any) => { envelope.data.uxPrinciples[0].evidence.confidence = 'made-up'; }],
    ['drifted ontology enum', (envelope: any) => { envelope.data.ontologyEnums.uxOutcomes = ['attention']; }],
    ['missing attribution', (envelope: any) => { delete envelope.data.uxPrincipleAttribution; }],
    ['unknown design category', (envelope: any) => {
      envelope.data.designPrinciples[0].category = 'not-a-design-category';
    }],
    ['unknown design concern', (envelope: any) => {
      envelope.data.designPrinciples[0].concernTags = ['not-a-concern'];
    }],
    ['unknown related UX principle', (envelope: any) => {
      envelope.data.designPrinciples[0].relatedUxPrincipleIds = ['not-a-ux-principle'];
    }],
    ['missing design principle references', (envelope: any) => {
      delete envelope.data.designPrinciples[0].references;
    }],
    ['insecure design principle reference', (envelope: any) => {
      const principle = envelope.data.designPrinciples.find((item: any) => item.references.length > 0);
      principle.references[0].url = 'http://example.com/reference';
    }],
    ['unknown audit source', (envelope: any) => {
      envelope.data.policies.auditChecks[0].source = {
        kind: 'anti-pattern', antiPatternId: 'not-an-anti-pattern',
      };
    }],
  ])('rejects a rehashed catalog with %s', (_label, mutate) => {
    const report = reportAfter(mutate);
    expect(report.ok).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });
});
