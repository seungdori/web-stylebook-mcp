// Plan PR 7 (2026-11-25 design-quality plan, 5.1 and 8): a stock-photo hero is an observation when the page names the
// photo's source, and stays a defect when it does not. start_ui_design asks for credited stock photos as stand-ins on
// restaurant and product pages, so flagging every credited photo hero as a defect contradicted it. The two fixtures
// are the only run outputs with external photos: both restaurant pages credit Unsplash.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult, type AuditEvidence, type SubmittedAuditCheckResult } from '../src/audit/evaluator.js';
import { auditPageStructure } from '../src/structure/audit.js';
import { PHOTO_RULES } from '../src/start/photos.js';

const repo = CatalogRepository.load();
const read = (run: string) => readFileSync(new URL(`./fixtures/page-structure/runs-2026-11-25/${run}.html`, import.meta.url), 'utf8');
const R2 = read('restaurant-on-r2');
const R3 = read('restaurant-on-r3');
// r2 credits Unsplash in plain text in the footer; r3 in the hero figcaption and a footer link.
const uncredited = (html: string) => html.replace('<span>Photos via Unsplash</span>', '').replace('<span>Photo · Unsplash</span>', '')
  .replace(/사진: <a href="https:\/\/unsplash.com\/"[^>]*>Unsplash<\/a>/, '');
const stock = (html: string, styleId?: string) => {
  const result = auditPageStructure({ html, locale: 'ko', ...(styleId ? { styleId } : {}) }, repo);
  return {
    result,
    verdict: result.results.find((entry) => entry.checkId === 'structure-stock-photo-hero')!.verdict,
    outcome: result.evidence.find((entry) => entry.id.endsWith(':stock-photo-hero'))!.outcome,
    finding: result.findings.find((entry) => entry.patternId === 'stock-photo-hero')!,
    credit: result.assets.checks.find((entry) => entry.checkId === 'assets-image-credit')!.verdict,
  };
};

describe('stock-photo hero with a credited source', () => {
  it.each([['restaurant-on-r2', R2], ['restaurant-on-r3', R3]])('%s is an observation, with or without a style', (_run, html) => {
    for (const styleId of [undefined, 'earth-atelier']) {
      const { verdict, outcome, finding, credit } = stock(html, styleId);
      expect(verdict, styleId).toBe('NOT_VERIFIED');
      expect(outcome).toBe('cant-tell');
      expect(finding.claim).toBe('shape-observation');
      expect(finding.observed.credited).toBe(true);
      expect(finding.replaceWith.instruction).toMatch(/^사진이 이 제품의 실제 장소·소재·쓰임을 보여 줄 때만/);
      expect(credit).toBe('PASS');
    }
  });

  it.each([['restaurant-on-r2', R2], ['restaurant-on-r3', R3]])('%s without its credit is a defect again, and the asset check agrees', (_run, html) => {
    const styled = stock(uncredited(html), 'earth-atelier');
    expect(styled).toMatchObject({ verdict: 'FIX_NOW', outcome: 'failed', credit: 'RISK' });
    expect(styled.finding.claim).toBe('style-fidelity');
    expect(stock(uncredited(html)).verdict).toBe('NOT_VERIFIED');
  });

  it('never credits a placeholder service, whatever the page says', () => {
    const html = R2.replace(/https:\/\/images\.unsplash\.com\/photo-1414235077428-338989a2e8c0[^"\s]*/g, 'https://picsum.photos/1600/900');
    const { verdict, finding } = stock(html, 'earth-atelier');
    expect(verdict).toBe('FIX_NOW');
    expect(finding.observed.credited).toBe(false);
  });

  it('keeps start_ui_design, the asset check and the pattern criteria saying the same thing', () => {
    expect(PHOTO_RULES.credit).toMatch(/uncredited stock hero is a defect; a credited one, an observation/);
    const result = stock(R3).result;
    const report = result.checks.find((entry) => entry.patternId === 'stock-photo-hero')!;
    expect(report).toMatchObject({ claim: 'shape-observation', status: 'found' });
  });
});

describe('recording the judgment of a credited stock-photo hero', () => {
  const target = [{ id: 'page', surface: 'global' as const }];
  const judge = (styleId: string | undefined, evidence: (tool: AuditEvidence) => AuditEvidence[]) => {
    const { result } = stock(R3, styleId);
    const plan = { includeGroups: ['structure' as const], locale: 'ko' as const, ...(styleId ? { styleId } : {}) };
    const tool = result.evidence.find((entry) => entry.id.endsWith(':stock-photo-hero'))! as AuditEvidence;
    const added = evidence(tool);
    const results: SubmittedAuditCheckResult[] = result.results.map((entry) => (entry.checkId === 'structure-stock-photo-hero'
      ? { ...entry, verdict: 'PASS', evidenceRefs: added.length ? added.map((item) => item.id) : entry.evidenceRefs } : entry));
    return validateDesignAuditResult({ plan, targets: target, evidence: [...result.evidence as AuditEvidence[], ...added], results }, repo);
  };
  const reason = 'The hero shows the dishes this osteria serves, on its own tables in the evening light.';

  it('cannot pass on the tool evidence alone', () => {
    expect(judge('earth-atelier', () => []).issues.map((entry) => entry.code)).toContain('PASS_USES_INDETERMINATE_EVIDENCE');
  });

  it('passes with a style when DOM evidence supersedes the tool item with a reason', () => {
    const validated = judge('earth-atelier', (tool) => [{ id: 'judged-hero', targetId: 'page', type: 'dom', summary: reason, outcome: 'passed', location: tool.location, supersedes: { evidenceId: tool.id, reason } }]);
    expect(validated.issues).toEqual([]);
    expect(validated.results.find((entry) => entry.checkId === 'structure-stock-photo-hero')!.verdict).toBe('PASS');
  });

  it('passes without a style on manual evidence', () => {
    const validated = judge(undefined, (tool) => [{ id: 'judged-hero', targetId: 'page', type: 'manual', summary: reason, outcome: 'passed', location: tool.location }]);
    expect(validated.issues).toEqual([]);
  });
});
