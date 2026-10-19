import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { planDesignAudit } from '../src/audit/planner.js';
import { auditPageStructure, PAGE_LIMITS, StructureAuditError, type StructureAuditResult } from '../src/structure/audit.js';
import { structureGuide } from '../src/structure/guidance.js';
import { GLOBAL_PATTERNS } from '../src/structure/patterns.js';
import { GLOBAL_PATTERN_IDS } from '../src/structure/types.js';

const repo = CatalogRepository.load();
const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'page-structure');
const read = (file: string) => readFileSync(join(dir, file), 'utf8');

interface FixtureCase {
  file: string;
  css?: string[];
  kind: 'positive' | 'false-positive';
  styleId?: string;
  found: string[];
  notFound?: string[];
  superseded?: string[];
  targets?: string[];
}

const { cases } = JSON.parse(read('cases.json')) as { cases: FixtureCase[] };
const run = (fixture: FixtureCase) => auditPageStructure({
  html: read(fixture.file),
  css: (fixture.css ?? []).map(read),
  styleId: fixture.styleId,
}, repo);
const statusOf = (result: StructureAuditResult, id: string) => result.checks.find((check) => check.patternId === id)?.status;

describe('audit_page_structure fixtures', () => {
  it.each(cases.map((fixture) => [fixture.file, fixture] as const))('%s', (_file, fixture) => {
    const result = run(fixture);
    for (const id of fixture.found) expect(statusOf(result, id), `${id} should be found`).toBe('found');
    for (const id of GLOBAL_PATTERN_IDS) {
      if (!fixture.found.includes(id)) expect(statusOf(result, id), `${id} must not be found`).not.toBe('found');
    }
    for (const id of fixture.notFound ?? []) expect(statusOf(result, id), `${id} must not be found`).not.toBe('found');
    const reported = result.findings.map((finding) => finding.patternId);
    for (const id of fixture.found) {
      if (fixture.superseded?.includes(id)) expect(reported).not.toContain(id);
      else expect(reported).toContain(id);
    }
    expect(result.summary.clean).toBe(reported.length === 0 && result.summary.notVerified === 0);
  });

  it('covers every global pattern with a positive fixture and a fixture designed to tempt a false positive', () => {
    for (const id of GLOBAL_PATTERN_IDS) {
      expect(cases.some((fixture) => fixture.kind === 'positive' && fixture.found.includes(id)), `${id} positive`).toBe(true);
      expect(cases.some((fixture) => fixture.kind === 'false-positive' && fixture.targets?.includes(id)), `${id} false positive`).toBe(true);
    }
  });

  it('replaces generic patterns with the chosen style moves that do the same job', () => {
    const result = run(cases[0]!);
    const guide = structureGuide('quiet-utility');
    for (const finding of result.findings.filter((item) => item.scope === 'global')) {
      const pattern = GLOBAL_PATTERNS.find((item) => item.id === finding.patternId)!;
      const expected = pattern.job === 'page' ? [] : guide.moves.filter((move) => move.jobs.includes(pattern.job as never)).map((move) => move.id);
      expect(finding.replaceWith.moves.map((move) => move.id), finding.patternId).toEqual(expected);
      expect(finding.replaceWith.instruction.length).toBeGreaterThan(20);
      expect(finding.relatedAuditCheckIds.every((id) => repo.policies.auditChecks.some((check) => check.id === id))).toBe(true);
    }
    const opening = result.findings.find((finding) => finding.patternId === 'centered-stack-hero')!;
    expect(opening.replaceWith.archetype?.hero).toBe(guide.hero);
    expect(opening.replaceWith.moves.map((move) => move.id)).toContain('breadcrumb-work-shell');
    const skeleton = result.findings.find((finding) => finding.patternId === 'generic-saas-skeleton')!;
    expect(skeleton.replaceWith.archetype?.sectionOrder).toEqual(guide.sectionOrder);
    expect(skeleton.observed.sections).toBe('opening → proof → features → testimonials → cta');
    expect(result.outline.map((section) => section.patterns)).toEqual([
      ['centered-stack-hero'], ['logo-strip', 'trusted-by-band'], ['icon-feature-grid'], ['testimonial-carousel'], ['closing-cta-banner'],
    ]);
  });

  it('without styleId it still flags the generic patterns, says how to get moves, and checks no style bans', () => {
    const result = auditPageStructure({ html: read('generic-saas-tailwind.html') }, repo);
    expect(result.styleId).toBeNull();
    expect(result.checks.every((check) => check.scope === 'global')).toBe(true);
    expect(result.findings.every((finding) => finding.replaceWith.moves.length === 0)).toBe(true);
    expect(result.findings[0]!.replaceWith.instruction).toContain('styleId');
  });

  it('reports a superseded pattern in checks but not as a second finding', () => {
    const result = auditPageStructure({ html: read('gradient-blob-hero.html') }, repo);
    const stack = result.checks.find((check) => check.patternId === 'centered-stack-hero')!;
    expect(stack.status).toBe('found');
    expect(stack.note).toContain('gradient-blob-hero');
  });

  it('honours a style that requires a global pattern', () => {
    expect(structureGuide('fusion-soft-inflate').allow?.['stock-photo-hero']).toMatch(/photograph|Unsplash/i);
    const result = auditPageStructure({ html: read('stock-photo-hero.html'), styleId: 'fusion-soft-inflate' }, repo);
    const check = result.checks.find((item) => item.patternId === 'stock-photo-hero')!;
    expect(check.status).toBe('allowed-by-style');
    expect(result.findings.some((finding) => finding.patternId === 'stock-photo-hero')).toBe(false);
    expect(result.results.some((item) => item.checkId === 'structure-stock-photo-hero')).toBe(false);
  });

  it('localizes findings and guidance', () => {
    const ko = auditPageStructure({ html: read('generic-saas-tailwind.html'), styleId: 'quiet-utility', locale: 'ko' }, repo);
    expect(ko.findings.find((finding) => finding.patternId === 'logo-strip')!.name).toBe('로고 띠');
    expect(ko.limits[0]).toMatch(/브라우저/);
    const ja = auditPageStructure({ html: read('generic-saas-tailwind.html'), locale: 'ja' }, repo);
    expect(ja.findings.find((finding) => finding.patternId === 'logo-strip')!.name).toBe('ロゴの帯');
  });
});

describe('audit_page_structure contract', () => {
  it('is deterministic and content-addressed', () => {
    const input = { html: read('generic-saas-tailwind.html'), styleId: 'quiet-utility' };
    const first = auditPageStructure(input, repo);
    expect(JSON.stringify(auditPageStructure(input, repo))).toBe(JSON.stringify(first));
    expect(first.identity.inputHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.identity.rulesetHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(auditPageStructure({ ...input, css: ['main { color: #111; }'] }, repo).identity.inputHash).not.toBe(first.identity.inputHash);
  });

  it('produces evidence and results that validate_design_audit_result accepts for the structure group', () => {
    const audit = auditPageStructure({ html: read('generic-saas-tailwind.html'), styleId: 'quiet-utility', targetId: 'home-desktop' }, repo);
    const planInput = { styleId: 'quiet-utility', surfaces: ['landing-page' as const], includeGroups: ['structure' as const], locale: 'en' as const };
    const plan = planDesignAudit(planInput, repo);
    expect(plan.checks.map((check) => check.id).sort()).toEqual(audit.results.map((result) => result.checkId).sort());
    const validated = validateDesignAuditResult({
      plan: planInput,
      expectedPlanHash: plan.identity.planHash,
      targets: [{ id: 'home-desktop', surface: 'landing-page', viewport: { width: 1440, height: 900 } }],
      evidence: audit.evidence,
      results: audit.results,
    }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.valid).toBe(true);
    expect(validated.coverage.state).toBe('full');
    expect(validated.verdictCounts.FIX_NOW).toBe(audit.results.filter((result) => result.verdict === 'FIX_NOW').length);
    const logo = validated.results.find((result) => result.checkId === 'structure-logo-strip')!;
    expect(logo.verdict).toBe('FIX_NOW');
  });

  it('turns a PASS that contradicts a failed structure finding into a fix', () => {
    const audit = auditPageStructure({ html: read('generic-saas-tailwind.html'), styleId: 'quiet-utility' }, repo);
    const planInput = { styleId: 'quiet-utility', includeGroups: ['structure' as const] };
    const results = audit.results.map((result) => (result.checkId === 'structure-logo-strip' ? { ...result, verdict: 'PASS' as const } : result));
    const validated = validateDesignAuditResult({
      plan: planInput, targets: [{ id: 'page', surface: 'global' }], evidence: audit.evidence, results,
    }, repo);
    expect(validated.issues.map((entry) => entry.code)).toContain('PASS_CONTRADICTS_FAILED_EVIDENCE');
    expect(validated.results.find((result) => result.checkId === 'structure-logo-strip')!.verdict).toBe('FIX_NOW');
  });

  it('keeps plans without the structure group unchanged', () => {
    const plan = planDesignAudit({ styleId: 'quiet-utility', surfaces: ['landing-page'] }, repo);
    expect(plan.query.includeGroups).not.toContain('structure');
    expect(plan.checks.some((check) => check.groupId === 'structure')).toBe(false);
    expect(plan.coverage).not.toHaveProperty('structureChecks');
    const withStructure = planDesignAudit({ styleId: 'quiet-utility', surfaces: ['landing-page'], includeGroups: ['layout', 'structure'] }, repo);
    expect(withStructure.coverage.structureChecks).toBe(withStructure.checks.filter((check) => check.groupId === 'structure').length);
    expect(withStructure.coverage.excludedChecks).toBe(withStructure.coverage.catalogChecks
      - withStructure.checks.filter((check) => check.groupId !== 'structure').length);
  });

  it('rejects unusable input explicitly', () => {
    const expectError = (input: Parameters<typeof auditPageStructure>[0], kind: string) => {
      try {
        auditPageStructure(input, repo);
        throw new Error('expected a structure audit error');
      } catch (error) {
        expect(error).toBeInstanceOf(StructureAuditError);
        expect((error as StructureAuditError).kind).toBe(kind);
      }
    };
    expectError({ html: '   ' }, 'INVALID_INPUT');
    expectError({ html: '<main></main>', styleId: 'quiet-utilty' }, 'STYLE_NOT_FOUND');
    expectError({ html: '<main></main>', viewportWidth: 100 }, 'INVALID_INPUT');
    expectError({ html: '<main></main>', css: Array.from({ length: PAGE_LIMITS.cssFiles + 1 }, () => '') }, 'INVALID_INPUT');
  });

  it('says when markup was cut off instead of reporting a silent pass', () => {
    const html = `<main><section><h1>Big page</h1>${'<i></i>'.repeat(PAGE_LIMITS.maxElements + 10)}</section></main>`;
    const result = auditPageStructure({ html }, repo);
    expect(result.limits.some((limit) => limit.includes(String(PAGE_LIMITS.maxElements)))).toBe(true);
  });

  it('stays linear on hostile nesting instead of walking every subtree per element', () => {
    const html = `<main><section><h1>Deep</h1>${'<div>'.repeat(PAGE_LIMITS.maxElements - 10)}<p>leaf</p></section></main>`;
    const started = performance.now();
    const result = auditPageStructure({ html, styleId: 'quiet-utility' }, repo);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(result.summary.checked).toBeGreaterThan(9);
  });

  it('reports absences as not verified when a stylesheet exhausts the selector budget', () => {
    const html = `<main><section><h1>Title</h1><p>Words here for the lede of the page.</p></section><section>${'<div><p>x</p></div>'.repeat(4000)}</section></main>`;
    const css = Array.from({ length: 1000 }, (_, i) => `section div:nth-child(${i}) { color: red }`).join('\n');
    const started = performance.now();
    const result = auditPageStructure({ html, css: [css], styleId: 'quiet-utility' }, repo);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(result.checks.some((check) => check.status === 'absent')).toBe(false);
    expect(result.summary.clean).toBe(false);
    expect(result.limits.some((line) => line.includes('selector matching'))).toBe(true);
  });

  it('marks opening patterns not applicable on a page without any heading, as NOT_APPLICABLE results', () => {
    const result = auditPageStructure({ html: '<main><section><form><label>Name <input name="a"></label><button>Save</button></form></section></main>', styleId: 'quiet-utility' }, repo);
    expect(result.checks.find((check) => check.patternId === 'centered-stack-hero')!.status).toBe('not-applicable');
    expect(result.results.find((item) => item.checkId === 'structure-centered-stack-hero')!.verdict).toBe('NOT_APPLICABLE');
    expect(result.evidence.find((item) => item.id === 'structure:page:centered-stack-hero')!.outcome).toBe('inapplicable');
  });

  it('reads an h2 as the opening headline when the page has no h1', () => {
    const result = auditPageStructure({ html: '<main><section><h2>Settings</h2><form><input name="a"></form></section></main>', styleId: 'quiet-utility' }, repo);
    expect(result.checks.find((check) => check.patternId === 'centered-stack-hero')!.status).toBe('absent');
  });
});
