// Plan PR 6 (2026-11-25 design-quality plan, 6.4 and 7.3): audit_copy checks page text against the PR #50 lexicon and
// product voices, and its evidence and results answer the "copy" group of get_design_audit_plan. The Korean page
// reuses lines from the 2026-11-25 run outputs (tests/fixtures/copy).
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { createWebStylebookServer } from '../src/server.js';
import { validateDesignAuditResult, type AuditEvidence, type SubmittedAuditCheckResult } from '../src/audit/evaluator.js';
import { planDesignAudit } from '../src/audit/planner.js';
import { COPY_AUDIT_BUDGET_BYTES, auditCopy, copyChecks, renderCopyAudit } from '../src/copy/audit.js';
import { COPY_PATTERNS } from '../src/copy/lexicon.js';
import { ok } from '../src/protocol/result.js';
import { PRODUCT_TYPES } from '../src/types.js';

const repo = CatalogRepository.load();
const KO_PAGE = `<html lang="ko"><body><main>
<section><h1>회의록은 AI가, 실행 은 팀이.</h1><p>설정은 5분, 이후엔 신경 쓸 일이 없습니다</p><a class="btn" href="/signup">무료로 시작하기</a></section>
<section><h2>3,200+사용 중인 팀</h2><p>−87%회의록 정리 시간</p></section>
<section><h2>팀 규모에 맞게 시작하세요</h2><p class="hidden">무료로 시작하기</p></section>
<section><h2>다음 회의부터는<br>받아 적지 마세요.</h2></section>
</main></body></html>`;
const KO_CSS = ['.hidden { display: none; }'];
const KO_FOUND = ['ko-generic-cta', 'ko-parallel-subject-headline', 'ko-percent-outcome', 'ko-setup-minutes', 'ko-social-proof-count', 'ko-stop-doing-closer', 'ko-team-size-pricing'];
const target = [{ id: 'page', surface: 'global' as const }];

let client: Client;
beforeAll(async () => {
  const server = createWebStylebookServer(repo);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'audit-copy-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

describe('audit_copy findings', () => {
  it('finds the template lines and unsourced claims of a page, with where they are and how to fix them', () => {
    const result = auditCopy({ html: KO_PAGE, css: KO_CSS, locale: 'ko', productType: 'operational-saas' }, repo);
    expect(result.findings.map((finding) => finding.patternId).sort()).toEqual(KO_FOUND);
    const claim = result.findings.find((finding) => finding.patternId === 'ko-social-proof-count')!;
    expect(claim).toMatchObject({ claim: 'unsourced-claim', count: 1, checkId: 'copy-ko-social-proof-count' });
    expect(claim.locations[0]!.where).toMatch(/section:nth-of-type\(2\) > h2$/);
    expect(claim.locations[0]!.match).toBe('3,200+사용 중인 팀');
    expect(claim.instead).toMatch(/source/);
    const closer = result.findings.find((finding) => finding.patternId === 'ko-stop-doing-closer')!;
    expect(closer.locations[0]).toMatchObject({ match: '다음 회의부터는 받아 적지 마세요.' });
    const cta = result.findings.find((finding) => finding.patternId === 'ko-generic-cta')!;
    expect(cta.count).toBe(1);
    expect(result.summary).toMatchObject({ fixNow: 2, observations: 5 });
  });

  it('is deterministic', () => {
    const input = { html: KO_PAGE, css: KO_CSS, locale: 'ko' as const, productType: 'commerce' as const };
    expect(JSON.stringify(auditCopy(input, repo))).toBe(JSON.stringify(auditCopy(input, repo)));
  });

  it('checks plain text by line, with no evidence or results', () => {
    const result = auditCopy({ text: 'Supercharge your meetings with seamless AI notes.\nTrusted by 10,000+ teams\nExport the notes', locale: 'en' }, repo);
    expect(result.findings.map((finding) => [finding.patternId, finding.locations[0]!.where])).toEqual([
      ['en-buzzwords', 'line 1'], ['en-social-proof-count', 'line 2'],
    ]);
    expect(result.evidence).toEqual([]);
    expect(result.results).toEqual([]);
    expect(result.guidance.at(-1)).toMatch(/pass the rendered HTML/);
    expect(auditCopy({ text: ['会議をもっとスマートに。', '無料で始める'], locale: 'ja' }, repo).findings.map((finding) => finding.locations[0]!.where)).toEqual(['item 1', 'item 2']);
  });

  it('checks the product voice: register and sentence length', () => {
    const haeyo = '<main><p>회의가 끝나면 요약을 보내 드려요.</p><p>담당자도 자동으로 붙어요.</p><p>마감일도 같이 적어요.</p><p>캘린더만 연결하면 돼요.</p></main>';
    const voice = (html: string, productType: 'operational-saas' | 'commerce') => auditCopy({ html, locale: 'ko', productType }, repo).findings.map((finding) => finding.patternId);
    expect(voice(haeyo, 'operational-saas')).toContain('voice-register');
    expect(voice(haeyo, 'commerce')).not.toContain('voice-register');
    const long = `<main>${'<p>This sentence keeps adding clauses about meetings, owners, due dates, channels, reminders and exports until the reader is lost.</p>'.repeat(3)}</main>`;
    expect(auditCopy({ html: long, locale: 'en', productType: 'campaign' }, repo).findings.map((finding) => finding.patternId)).toContain('voice-sentence-length');
    expect(copyChecks('ja', 'campaign').map((check) => check.id)).not.toContain('copy-voice-sentence-length');
  });

  it('rejects input that is neither or both of html and text', async () => {
    for (const args of [{ locale: 'en' }, { html: '<p>x</p>', text: 'x' }]) {
      const result = await client.callTool({ name: 'audit_copy', arguments: args });
      expect(result.isError).toBe(true);
      expect((result.structuredContent as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
    }
  });

  it('stays fast on a page of 20,000 text units', () => {
    const html = `<main>${'<p>Export the notes to Slack.</p><button>Get started</button>'.repeat(10_000)}</main>`;
    const began = performance.now();
    const result = auditCopy({ html, locale: 'en' }, repo);
    expect(performance.now() - began).toBeLessThan(3000);
    expect(result.findings.find((finding) => finding.patternId === 'en-generic-cta')!.count).toBe(10_000);
  }, 60_000);
});

describe('Korean buzzwords (0.22.1)', () => {
  // 0.22.0 had buzzword patterns for English and Japanese only, so this line returned no finding.
  const BUZZ = '혁신적인 솔루션으로 비즈니스를 한 단계 끌어올리세요';
  const PLAIN = '화요일 오후 3시 미팅이 끝나면, 할 일과 담당자가 붙은 요약을 슬랙으로 보냅니다.';
  const found = (input: { text?: string; html?: string; productType?: 'operational-saas' }) =>
    auditCopy({ ...input, locale: 'ko' }, repo).findings.map((finding) => finding.patternId);

  it('flags the stock Korean marketing line as text and as a page, with or without a product type', () => {
    for (const productType of [undefined, 'operational-saas' as const]) {
      expect(found({ text: BUZZ, ...(productType ? { productType } : {}) })).toEqual(['ko-buzzwords']);
      expect(found({ html: `<main><h1>${BUZZ}</h1></main>`, ...(productType ? { productType } : {}) })).toEqual(['ko-buzzwords']);
    }
  });

  it('passes a concrete line, and plain uses of the same words', () => {
    for (const productType of [undefined, 'operational-saas' as const]) {
      expect(found({ text: PLAIN, ...(productType ? { productType } : {}) })).toEqual([]);
      expect(found({ html: `<main><p>${PLAIN}</p></main>`, ...(productType ? { productType } : {}) })).toEqual([]);
    }
    for (const line of ['솔루션 엔지니어가 연락드립니다.', '목표를 너무 크게 잡으면 앱이 한 단계 작은 목표를 제안해요.', '스마트폰에서 바로 체크할 수 있어요.']) {
      expect(found({ text: line }), line).toEqual([]);
    }
  });

  it('gives Korean every pattern topic that English or Japanese has', () => {
    const topic = (id: string) => id.replace(/^(?:en|ko|ja)-/, '');
    const topics = (locale: 'en' | 'ko' | 'ja') => new Set(COPY_PATTERNS.filter((entry) => entry.locales.includes(locale)).map((entry) => topic(entry.id)));
    const ko = topics('ko');
    for (const locale of ['en', 'ja'] as const) for (const name of topics(locale)) expect(ko.has(name), `${locale} ${name}`).toBe(true);
  });
});

describe('audit_copy and validate_design_audit_result', () => {
  const planInput = { includeGroups: ['copy' as const], locale: 'ko' as const, productType: 'operational-saas' as const };

  it('answers every check of the copy group, and the validator accepts the result', () => {
    const audit = auditCopy({ html: KO_PAGE, css: KO_CSS, locale: 'ko', productType: 'operational-saas' }, repo);
    const plan = planDesignAudit(planInput, repo);
    expect(plan.checks.map((check) => check.id).sort()).toEqual(audit.results.map((result) => result.checkId).sort());
    expect(plan.checks.every((check) => check.groupId === 'copy')).toBe(true);
    const validated = validateDesignAuditResult({ plan: planInput, expectedPlanHash: plan.identity.planHash, targets: target, evidence: audit.evidence as AuditEvidence[], results: audit.results }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.valid).toBe(true);
    expect(validated.verdictCounts.FIX_NOW).toBe(2);
  });

  it('rejects a PASS over a found claim, and a PASS over a shape without a manual judgment', () => {
    const audit = auditCopy({ html: KO_PAGE, css: KO_CSS, locale: 'ko', productType: 'operational-saas' }, repo);
    const flip = (checkId: string, refs?: string[]): SubmittedAuditCheckResult[] => audit.results.map((result) => (result.checkId === checkId ? { ...result, verdict: 'PASS', ...(refs ? { evidenceRefs: refs } : {}) } : result));
    const run = (results: SubmittedAuditCheckResult[], evidence: AuditEvidence[] = audit.evidence as AuditEvidence[]) =>
      validateDesignAuditResult({ plan: planInput, targets: target, evidence, results }, repo);
    expect(run(flip('copy-ko-social-proof-count')).issues.map((entry) => entry.code)).toContain('PASS_CONTRADICTS_FAILED_EVIDENCE');
    expect(run(flip('copy-ko-setup-minutes')).issues.map((entry) => entry.code)).toContain('MISSING_REQUIRED_EVIDENCE');
    const judgment: AuditEvidence = { id: 'judged-setup-line', targetId: 'page', type: 'manual', summary: 'The setup line names the calendar connection, so it is specific to this product.', outcome: 'passed', location: { selector: 'main > section:nth-of-type(1) > p' } };
    const judged = run(flip('copy-ko-setup-minutes', ['judged-setup-line']), [...audit.evidence as AuditEvidence[], judgment]);
    expect(judged.issues).toEqual([]);
    expect(judged.results.find((result) => result.checkId === 'copy-ko-setup-minutes')!.verdict).toBe('PASS');
  });

  it('keeps plans without the copy group unchanged', () => {
    expect(planDesignAudit({ locale: 'ko' }, repo).checks.some((check) => check.groupId === 'copy' || check.groupId === 'assets')).toBe(false);
    expect(() => planDesignAudit({ productType: 'commerce', includeGroups: ['layout'] }, repo)).toThrow(/include one of them/);
    expect(planDesignAudit({ productType: 'commerce', includeGroups: ['copy'], locale: 'ko' }, repo).checks.map((check) => check.id)).toContain('copy-voice-register');
  });
});

describe('audit_copy result size', () => {
  it(`stays within ${COPY_AUDIT_BUDGET_BYTES} bytes on a page that shows every pattern many times`, () => {
    for (const locale of ['en', 'ko', 'ja'] as const) {
      const lines = COPY_PATTERNS.filter((entry) => entry.locales.includes(locale)).flatMap((entry) => Array.from({ length: 12 }, () => entry.example.flagged));
      const html = `<main>${lines.map((line) => `<p>${line}</p>`).join('')}</main>`;
      for (const productType of PRODUCT_TYPES) {
        const result = auditCopy({ html, locale, productType }, repo);
        const bytes = Buffer.byteLength(JSON.stringify(ok(result as unknown as Record<string, unknown>, renderCopyAudit(result))));
        expect(bytes, `${locale} ${productType}`).toBeLessThanOrEqual(COPY_AUDIT_BUDGET_BYTES);
      }
    }
  });
});
