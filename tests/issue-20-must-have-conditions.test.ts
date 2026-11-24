// #20 problem C: must-haves apply by page role and feature, and first-screen placement is advice unless people can act
// before they see the information.
import { describe, expect, it } from 'vitest';
import { planDesignAudit } from '../src/audit/planner.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { StructureAuditError, auditPageStructure } from '../src/structure/audit.js';
import { mustHaveCatalog, type MustHaveCondition } from '../src/structure/must-haves.js';
import type { ProductType } from '../src/types.js';

const repo = CatalogRepository.load();
const verdictOf = (result: ReturnType<typeof auditPageStructure>, id: string) =>
  result.results.find((entry) => entry.checkId === `structure-must-have-${id}`)?.verdict;

const buyBox = '<p class="price">$48</p><button type="submit">Add to cart</button><p>Free delivery in 2 days and 30-day returns.</p>';
// One size, one shade: price, buy button, and delivery terms on the first screen; no variant control.
const singleVariant = `<main><section><h1>Brass desk lamp</h1>${buyBox}</section><section><h2>Details</h2><p>Solid brass, 40 cm tall.</p></section></main>`;
const singleVariantCondition: MustHaveCondition = { id: 'single-variant', reason: 'The lamp is sold in one finish and one size.' };

describe('#20 C: declared conditions set named must-haves aside', () => {
  it('still requires the variant choice when no condition is declared', () => {
    expect(verdictOf(auditPageStructure({ html: singleVariant, productType: 'commerce' }, repo), 'variant-choice')).toBe('FIX_NOW');
  });

  it('reports a single-variant product without a variant choice as NOT_APPLICABLE, and keeps the other must-haves', () => {
    const audit = auditPageStructure({ html: singleVariant, productType: 'commerce', mustHaveConditions: [singleVariantCondition] }, repo);
    expect(verdictOf(audit, 'variant-choice')).toBe('NOT_APPLICABLE');
    const item = audit.mustHaves!.items.find((entry) => entry.id === 'variant-choice')!;
    expect(item).toMatchObject({ status: 'not-applicable', condition: singleVariantCondition });
    expect(item.note).toMatch(/one variant/);
    expect(audit.findings.some((finding) => finding.patternId === 'must-have/variant-choice')).toBe(false);
    for (const id of ['price', 'add-to-cart', 'purchase-assurance']) expect(verdictOf(audit, id), id).toBe('PASS');
  });

  it('validates when the plan declares the same condition, and not when it does not', () => {
    const audit = auditPageStructure({ html: singleVariant, productType: 'commerce', mustHaveConditions: [singleVariantCondition] }, repo);
    const targets = [{ id: 'page', surface: 'global' as const }];
    const plan = { productType: 'commerce' as const, mustHaveConditions: [singleVariantCondition], includeGroups: ['structure' as const] };
    const planned = planDesignAudit(plan, repo);
    expect(planned.query.mustHaveConditions).toEqual([singleVariantCondition]);
    expect(planned.checks.find((check) => check.id === 'structure-must-have-variant-choice')!.applicability).toBe('when-present');
    const validated = validateDesignAuditResult({ plan, targets, evidence: audit.evidence, results: audit.results }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.results.find((entry) => entry.checkId === 'structure-must-have-variant-choice')!.verdict).toBe('NOT_APPLICABLE');

    const undeclared = { productType: 'commerce' as const, includeGroups: ['structure' as const] };
    expect(planDesignAudit(undeclared, repo).identity.planHash).not.toBe(planned.identity.planHash);
    const rejected = validateDesignAuditResult({ plan: undeclared, targets, evidence: audit.evidence, results: audit.results }, repo);
    expect(rejected.issues.map((entry) => entry.code)).toContain('NOT_APPLICABLE_FOR_ALWAYS_CHECK');
  });

  it('passes a must-have the page has even when a condition sets it aside', () => {
    const html = singleVariant.replace(buyBox, `${buyBox}<select name="size"><option>S</option><option>M</option></select>`);
    expect(verdictOf(auditPageStructure({ html, productType: 'commerce', mustHaveConditions: [singleVariantCondition] }, repo), 'variant-choice')).toBe('PASS');
  });

  it.each<[ProductType, MustHaveCondition, string, string[], string]>([
    ['documentation', { id: 'docs-article', reason: 'This is the reference page for one API method.' },
      '<main><section><h1>createInvoice()</h1><form role="search"><input type="search" aria-label="Search docs"></form><p>Creates a draft invoice for a customer.</p></section></main>',
      ['quickstart'], 'search'],
    ['data-analytics', { id: 'not-time-series', reason: 'The view compares survey answers across regions at one date.' },
      '<main><section><h1>Survey answers by region</h1><div><span>Satisfied</span><strong>72%</strong></div></section></main>',
      ['recent-changes', 'time-range'], 'current-status'],
    ['developer-tool', { id: 'no-code-interface', reason: 'People use the tool through its visual editor only.' },
      '<main><section><h1>Visual schema editor</h1><p>Drag tables together to model your data.</p><img src="/editor.png" width="900" height="560" alt="The schema editor with three linked tables"></section></main>',
      ['code-sample'], 'docs-link'],
  ])('%s: %s sets aside only its own must-haves', (productType, condition, html, exempt, stillRequired) => {
    const audit = auditPageStructure({ html, productType, mustHaveConditions: [condition] }, repo);
    for (const id of exempt) expect(verdictOf(audit, id), id).toBe('NOT_APPLICABLE');
    expect(verdictOf(audit, stillRequired), stillRequired).not.toBe('NOT_APPLICABLE');
  });

  it('rejects a condition for another product type, a short reason, a duplicate, or no product type', () => {
    const run = (productType: ProductType | undefined, mustHaveConditions: MustHaveCondition[]) => () =>
      auditPageStructure({ html: singleVariant, ...(productType ? { productType } : {}), mustHaveConditions }, repo);
    expect(run('documentation', [singleVariantCondition])).toThrow(/applies to productType 'commerce'/);
    expect(run('commerce', [{ id: 'single-variant', reason: 'one size' }])).toThrow(/reason of 12-500 characters/);
    expect(run('commerce', [singleVariantCondition, singleVariantCondition])).toThrow(/twice/);
    expect(run(undefined, [singleVariantCondition])).toThrow(StructureAuditError);
    expect(() => planDesignAudit({ productType: 'documentation', mustHaveConditions: [singleVariantCondition], includeGroups: ['structure'] }, repo))
      .toThrow(/applies to productType 'commerce'/);
  });

  it('lists every condition in the must-have resource', () => {
    expect(mustHaveCatalog().conditions.map((condition) => condition.id)).toEqual(['single-variant', 'no-code-interface', 'docs-article', 'not-time-series']);
  });
});

describe('#20 C: necessity and first-screen placement are separate', () => {
  // A tall gallery opens the page and the whole buy box follows it, as on a small phone screen.
  const galleryFirst = `<main><section><h1>Linen shirt</h1><img src="/shirt.jpg" width="1200" height="1500" alt="The shirt on a model"></section>
    <section><h2>Buy</h2>${buyBox}<select name="size"><option>S</option><option>M</option></select></section></main>`;

  it('reports must-haves below the first screen as RISK when the action is below it too', () => {
    const audit = auditPageStructure({ html: galleryFirst, productType: 'commerce', viewportWidth: 390 }, repo);
    expect(audit.mustHaves!.misplaced.sort()).toEqual(['add-to-cart', 'price', 'purchase-assurance', 'variant-choice']);
    for (const id of audit.mustHaves!.misplaced) expect(verdictOf(audit, id), id).toBe('RISK');
    const price = audit.results.find((entry) => entry.checkId === 'structure-must-have-price')!;
    expect(price.remediation).toMatch(/estimated from document order, not measured/);
    expect(audit.findings.every((finding) => finding.severity === 'minor')).toBe(true);
  });

  it('keeps FIX_NOW when the action is on the first screen and the information people need first is not', () => {
    const html = `<main><section><h1>Linen shirt</h1><button type="submit">Add to cart</button><img src="/shirt.jpg" width="1200" height="1500" alt="The shirt"></section>
      <section><h2>Details</h2><p class="price">$48</p><select name="size"><option>S</option></select><p>Free delivery and 30-day returns.</p></section></main>`;
    const audit = auditPageStructure({ html, productType: 'commerce' }, repo);
    for (const id of ['price', 'variant-choice', 'purchase-assurance']) expect(verdictOf(audit, id), id).toBe('FIX_NOW');
  });

  it('keeps FIX_NOW for a missing price', () => {
    const html = galleryFirst.replace('<p class="price">$48</p>', '');
    expect(verdictOf(auditPageStructure({ html, productType: 'commerce' }, repo), 'price')).toBe('FIX_NOW');
  });
});
