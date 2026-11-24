// #20 problem A: a shape found on the page is not by itself a defect in the user's task.
import { describe, expect, it } from 'vitest';
import { planDesignAudit } from '../src/audit/planner.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { auditPageStructure } from '../src/structure/audit.js';

const repo = CatalogRepository.load();

// Reproduction A from the issue: three cards that each lead to a different task.
const items = [
  ['발급 신청', '처음 신청하는 분은 증명서 발급을 신청하세요.', '/apply'],
  ['진행 조회', '접수한 신청의 처리 상태와 결과를 확인하세요.', '/status'],
  ['제출 안내', '신청에 필요한 서류와 제출 방법을 확인하세요.', '/help'],
];
const taskCards = [
  '<!doctype html><main><section>',
  '<h1>어떤 업무를 처리하시겠어요?</h1>',
  '<div style="display:grid;grid-template-columns:repeat(3,1fr)">',
  ...items.map(([name, desc, url]) => [
    '<article style="border:1px solid #aaa;border-radius:8px;padding:24px">',
    '<svg width="24" height="24" aria-hidden="true"><rect width="20" height="20"/></svg>',
    `<h2><a href="${url}">${name}</a></h2>`,
    `<p>${desc}</p></article>`,
  ].join('')),
  '</div></section></main>',
].join('');

describe('#20 A: shape observations without a chosen style', () => {
  it('reports the icon cards as a shape observation, not FIX_NOW', () => {
    const audit = auditPageStructure({ html: taskCards, locale: 'ko' }, repo);
    const finding = audit.findings.find((item) => item.patternId === 'icon-feature-grid')!;
    expect(finding.claim).toBe('shape-observation');
    expect(audit.results.filter((result) => result.verdict === 'FIX_NOW')).toEqual([]);
    const result = audit.results.find((item) => item.checkId === 'structure-icon-feature-grid')!;
    expect(result.verdict).toBe('NOT_VERIFIED');
    expect(result.rationale).toMatch(/과업을 방해하는지는 확인하지 않았습니다/);
    expect(result.remediation).toMatch(/과업을 방해할 때만/);
    expect(audit.evidence.find((item) => item.id === result.evidenceRefs[0])!.outcome).toBe('cant-tell');
    expect(audit.summary.claims['shape-observation']).toBe(1);
    expect(audit.guidance[0]).toMatch(/형태 관찰/);
  });

  it('marks shapes that are not on the page NOT_APPLICABLE instead of PASS', () => {
    const audit = auditPageStructure({ html: taskCards }, repo);
    const absent = audit.results.find((item) => item.checkId === 'structure-logo-strip')!;
    expect(absent.verdict).toBe('NOT_APPLICABLE');
    expect(audit.evidence.find((item) => item.id === absent.evidenceRefs[0])!.outcome).toBe('inapplicable');
  });

  it('validates as is, and leaves the found shape unverified until a task judgment arrives', () => {
    const audit = auditPageStructure({ html: taskCards }, repo);
    const plan = { includeGroups: ['structure' as const] };
    const planned = planDesignAudit(plan, repo);
    const check = planned.checks.find((item) => item.id === 'structure-icon-feature-grid')!;
    expect(check).toMatchObject({ evidenceTypes: ['manual'], automation: 'assisted', applicability: 'when-present' });
    expect(check.source).toMatchObject({ kind: 'structure', claim: 'shape-observation' });
    const targets = [{ id: 'page', surface: 'global' as const }];

    const asReturned = validateDesignAuditResult({ plan, targets, evidence: audit.evidence, results: audit.results }, repo);
    expect(asReturned.issues).toEqual([]);
    expect(asReturned.verdictCounts.FIX_NOW).toBe(0);
    expect(asReturned.results.find((item) => item.checkId === 'structure-icon-feature-grid')!.verdict).toBe('NOT_VERIFIED');

    const judged = {
      id: 'task-review:icon-cards',
      targetId: 'page',
      type: 'manual' as const,
      phase: 'static' as const,
      summary: 'The three cards are entry points to three different tasks; each names its task and links to it.',
      outcome: 'passed' as const,
      location: { selector: 'main > section > div' },
    };
    const results = audit.results.map((item) => (item.checkId === 'structure-icon-feature-grid'
      ? { ...item, verdict: 'PASS' as const, evidenceRefs: [judged.id], rationale: judged.summary } : item));
    const validated = validateDesignAuditResult({ plan, targets, evidence: [...audit.evidence, judged], results }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.results.find((item) => item.checkId === 'structure-icon-feature-grid')!.verdict).toBe('PASS');
  });
});

describe('#20 A: style fidelity and required elements keep their severity', () => {
  it('still reports the icon cards as FIX_NOW against a chosen style that bans them', () => {
    const audit = auditPageStructure({ html: taskCards, styleId: 'quiet-utility' }, repo);
    const finding = audit.findings.find((item) => item.patternId === 'icon-feature-grid')!;
    expect(finding.claim).toBe('style-fidelity');
    expect(audit.results.find((item) => item.checkId === 'structure-icon-feature-grid')!.verdict).toBe('FIX_NOW');
    expect(audit.summary.claims['shape-observation']).toBe(0);
  });

  it('still reports a missing must-have as a required element with FIX_NOW', () => {
    const html = '<main><section><h1>Linen shirt</h1><p>Washed linen, relaxed fit, made in Portugal.</p></section></main>';
    const audit = auditPageStructure({ html, productType: 'commerce' }, repo);
    const price = audit.findings.find((item) => item.patternId === 'must-have/price')!;
    expect(price.claim).toBe('required-element');
    expect(audit.results.find((item) => item.checkId === price.checkId)!.verdict).toBe('FIX_NOW');
  });
});
