// Plan PR 6 (2026-11-25 design-quality plan, 4.4 and 5.3): audit_page_structure checks fonts and images in an
// "assets" section whose evidence and results answer the "assets" group of get_design_audit_plan.
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult, type AuditEvidence } from '../src/audit/evaluator.js';
import { planDesignAudit } from '../src/audit/planner.js';
import { auditPageStructure } from '../src/structure/audit.js';
import { ASSET_CHECK_IDS, assetChecks } from '../src/structure/assets.js';

const repo = CatalogRepository.load();
const target = [{ id: 'page', surface: 'global' as const }];
const verdicts = (html: string, css: string[] = [], styleId?: string, locale: 'en' | 'ko' | 'ja' = 'en') =>
  Object.fromEntries(auditPageStructure({ html, css, ...(styleId ? { styleId } : {}), locale }, repo).assets.checks.map((check) => [check.checkId, check]));
const page = (head: string, body: string) => `<html><head>${head}</head><body><main><section><h1>Ops console</h1>${body}</section></main></body></html>`;

const BAD_HEAD = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600">';
const BAD_BODY = [
  '<img src="https://images.unsplash.com/photo-1?w=1600" alt="Kitchen counter" width="1600" height="900">',
  '<img src="https://placehold.co/600x400" alt="Team" width="600" height="400">',
  '<img src="/img/team.jpg">',
  '<img src="https://cdn.example.com/a.jpg" alt="IMG_2041.jpg" style="aspect-ratio: 3 / 2">',
].join('');
const BAD_CSS = ["body { font-family: 'Geist', system-ui, sans-serif; } h1 { font-family: 'Playfair Display', serif; }"];
const GOOD_HEAD = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600&display=swap">';
const GOOD_BODY = [
  '<figure><img src="https://images.unsplash.com/photo-1?w=1600" alt="Kitchen counter at dawn" width="1600" height="900"><figcaption>Photo by Ana Ruiz on <a href="https://unsplash.com/photos/abc">Unsplash</a></figcaption></figure>',
  '<img src="/img/team.jpg" alt="The support team at the Seoul office" width="1200" height="800">',
].join('');
const GOOD_CSS = ["body { font-family: 'Geist', system-ui, sans-serif; } h1 { font: 600 3rem/1.1 'Geist', sans-serif; }"];

describe('asset checks', () => {
  it('find fonts that are not loaded, not swapped or not the style’s, and images that are placeholders, unknown, uncredited, without alt or size', () => {
    const checks = verdicts(page(BAD_HEAD, BAD_BODY), BAD_CSS, 'quiet-utility');
    expect(Object.keys(checks)).toEqual([...ASSET_CHECK_IDS]);
    expect(checks['assets-font-loading']).toMatchObject({ verdict: 'FIX_NOW', items: ['Playfair Display'] });
    expect(checks['assets-font-display']!.verdict).toBe('RISK');
    expect(checks['assets-font-choice']).toMatchObject({ verdict: 'RISK', items: ['Playfair Display'] });
    expect(checks['assets-image-placeholder']).toMatchObject({ verdict: 'FIX_NOW', items: ['https://placehold.co/600x400'] });
    expect(checks['assets-image-source']).toMatchObject({ verdict: 'RISK', items: ['cdn.example.com'] });
    expect(checks['assets-image-credit']!.verdict).toBe('RISK');
    expect(checks['assets-image-alt']).toMatchObject({ verdict: 'FIX_NOW', count: 2 });
    expect(checks['assets-image-dimensions']).toMatchObject({ verdict: 'RISK', count: 1 });
  });

  it('pass a page whose fonts are loaded and swapped and whose images are credited, described and sized', () => {
    const checks = verdicts(page(GOOD_HEAD, GOOD_BODY), GOOD_CSS, 'quiet-utility');
    for (const id of ASSET_CHECK_IDS) expect(checks[id]!.verdict, id).toBe('PASS');
  });

  it('accept fonts loaded by @font-face, @import or the Pretendard CDN, and check the Korean face on a Korean page', () => {
    const face = "@font-face { font-family: 'Inter'; src: url(/fonts/inter.woff2); font-display: swap; } body { font-family: 'Inter', sans-serif; }";
    expect(verdicts(page('', '<p>x</p>'), [face])['assets-font-loading']!.verdict).toBe('PASS');
    const imported = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap'); body { font-family: Inter, sans-serif; }";
    expect(verdicts(page('', '<p>x</p>'), [imported])['assets-font-loading']!.verdict).toBe('PASS');
    const korean = ["body { font-family: 'Inter', 'Pretendard Variable', sans-serif; }"];
    const interOnly = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap">';
    expect(verdicts(page(interOnly, '<p>x</p>'), korean, undefined, 'en')['assets-font-loading']!.verdict).toBe('PASS');
    expect(verdicts(page(interOnly, '<p>x</p>'), korean, undefined, 'ko')['assets-font-loading']).toMatchObject({ verdict: 'FIX_NOW', items: ['Pretendard Variable'] });
    const pretendard = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css">';
    expect(verdicts(page(interOnly + pretendard, '<p>x</p>'), korean, undefined, 'ko')['assets-font-loading']!.verdict).toBe('PASS');
  });

  it('leave checks with nothing to check not applicable, and an unknown font stylesheet unverified', () => {
    const plain = verdicts(page('', '<p>System fonts only.</p>'), ['body { font-family: system-ui, sans-serif; }']);
    for (const id of ASSET_CHECK_IDS.filter((id) => id !== 'assets-font-choice')) expect(plain[id]!.verdict, id).toBe('NOT_APPLICABLE');
    const typekit = verdicts(page('<link rel="stylesheet" href="https://use.typekit.net/abc.css">', '<p>x</p>'), ["body { font-family: 'Inter', sans-serif; }"]);
    expect(typekit['assets-font-loading']!.verdict).toBe('NOT_VERIFIED');
    expect(verdicts(page('', '<img src="" alt="x" width="1" height="1">'))['assets-image-placeholder']!.verdict).toBe('FIX_NOW');
  });

  it('add the font-choice check to the plan only with a styleId', () => {
    expect(assetChecks(undefined, 'en').map((check) => check.id)).not.toContain('assets-font-choice');
    expect(assetChecks('quiet-utility', 'ko').map((check) => check.id)).toEqual([...ASSET_CHECK_IDS]);
  });
});

describe('asset results and validate_design_audit_result', () => {
  it('answer every check of the assets group, and the validator accepts them', () => {
    const audit = auditPageStructure({ html: page(BAD_HEAD, BAD_BODY), css: BAD_CSS, styleId: 'quiet-utility' }, repo);
    const planInput = { styleId: 'quiet-utility', includeGroups: ['assets' as const] };
    const plan = planDesignAudit(planInput, repo);
    expect(plan.checks.map((check) => check.id)).toEqual([...ASSET_CHECK_IDS]);
    const validated = validateDesignAuditResult({ plan: planInput, expectedPlanHash: plan.identity.planHash, targets: target, evidence: audit.assets.evidence as AuditEvidence[], results: audit.assets.results }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.verdictCounts).toMatchObject({ FIX_NOW: 3, RISK: 5 });
  });

  it('validate structure and assets together, and keep a structure-only submission valid', () => {
    const audit = auditPageStructure({ html: page(GOOD_HEAD, GOOD_BODY), css: GOOD_CSS, styleId: 'quiet-utility' }, repo);
    const both = { styleId: 'quiet-utility', includeGroups: ['structure' as const, 'assets' as const] };
    const together = validateDesignAuditResult({ plan: both, targets: target, evidence: [...audit.evidence, ...audit.assets.evidence] as AuditEvidence[], results: [...audit.results, ...audit.assets.results] }, repo);
    expect(together.issues).toEqual([]);
    const structureOnly = validateDesignAuditResult({ plan: { styleId: 'quiet-utility', includeGroups: ['structure'] }, targets: target, evidence: audit.evidence as AuditEvidence[], results: audit.results }, repo);
    expect(structureOnly.issues).toEqual([]);
  });

  it('turn a PASS over a missing font into a fix', () => {
    const audit = auditPageStructure({ html: page(BAD_HEAD, BAD_BODY), css: BAD_CSS, styleId: 'quiet-utility' }, repo);
    const results = audit.assets.results.map((result) => (result.checkId === 'assets-font-loading' ? { ...result, verdict: 'PASS' as const } : result));
    const validated = validateDesignAuditResult({ plan: { styleId: 'quiet-utility', includeGroups: ['assets'] }, targets: target, evidence: audit.assets.evidence as AuditEvidence[], results }, repo);
    expect(validated.issues.map((entry) => entry.code)).toContain('PASS_CONTRADICTS_FAILED_EVIDENCE');
  });
});
