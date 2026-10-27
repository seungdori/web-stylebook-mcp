import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { AuditPlanError, planDesignAudit, type DesignAuditPlanInput } from '../src/audit/planner.js';
import {
  comparePageRevisions, normalizeHref, REVISION_CHECKS, RevisionCompareError, type ComparePageRevisionsInput,
} from '../src/structure/revisions.js';
import { PRODUCT_MUST_HAVES } from '../src/structure/must-haves.js';

const repo = CatalogRepository.load();
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const read = (path: string) => readFileSync(join(fixtures, path), 'utf8');
const pair = (name: string) => ({ before: { html: read(`revisions/${name}/before.html`) }, after: { html: read(`revisions/${name}/after.html`) } });
const compare = (input: ComparePageRevisionsInput) => comparePageRevisions(input, repo);
const page = (body: string) => `<!doctype html><html><body><main><section><h1>Plan the week</h1>${body}</section></main></body></html>`;

const CASES: Array<[string, Omit<ComparePageRevisionsInput, 'before' | 'after'>]> = [
  ['link-loss', {}],
  ['field-loss', {}],
  ['reworded', {}],
  ['acknowledged', {
    acknowledged: [
      { kind: 'link', key: '/pricing', change: 'dropped', reason: 'Pricing moved to the sales-led contact page' },
      { kind: 'link', key: '/customers', change: 'dropped', reason: 'Case studies now live on the partner site' },
      { kind: 'link', key: '/docs/matching#rules', change: 'dropped', reason: 'Matching detail now lives in the docs only' },
      { kind: 'heading', key: 'How matching works', change: 'dropped', reason: 'Matching detail now lives in the docs only' },
    ],
  }],
  ['korean', { locale: 'ko' }],
  ['unchanged', {}],
  ['hooks', { scriptSelectors: ['#cart-form', '.js-variant', '#cart-drawer', '.js-close-drawer', '.price', '#not-on-the-old-page'] }],
  ['must-have', { productType: 'commerce' }],
];

const VOLATILE: Readonly<Record<string, string>> = { version: '<server version>', catalogVersion: '<catalog version>', catalogContentHash: '<catalog hash>' };

/** A release or a catalog sync would otherwise change every golden file without changing a comparison. */
function golden(result: ReturnType<typeof compare>): string {
  return `${JSON.stringify(result, (key, value) => VOLATILE[key] ?? value, 2)}\n`;
}

describe('compare_page_revisions golden results', () => {
  it.each(CASES)('%s', async (name, extra) => {
    await expect(golden(compare({ ...pair(name), ...extra }))).toMatchFileSnapshot(`fixtures/revisions/${name}/expected.json`);
  });

  it('reports the losses each pair was built to show', () => {
    const run = (name: string) => compare({ ...pair(name), ...CASES.find(([id]) => id === name)![1] });
    const links = run('link-loss');
    expect(links.verdict).toBe('FIX_NOW');
    expect(links.inventory.links.lost).toEqual(['/pricing', '/docs/matching#rules']);
    expect(links.findings.map((f) => `${f.checkId}:${f.verdict}:${f.severity}`)).toEqual(['redesign-kept-links:FIX_NOW:major']);

    const fields = run('field-loss');
    expect(fields.inventory.fields.lost).toEqual(['name=csrf_token', 'name=team_size', 'name=email (label)']);
    expect(fields.results.find((r) => r.checkId === 'redesign-kept-fields')!.verdict).toBe('FIX_NOW');

    const reworded = run('reworded');
    expect(reworded.verdict).toBe('RISK');
    expect(reworded.inventory.headings.reworded).toEqual([
      { key: 'Ship docs your team trusts', after: 'Docs that match the code you ship' },
      { key: 'Search that knows the API', after: 'Search by method, flag, or error code' },
    ]);
    expect(reworded.inventory.links.reworded).toEqual([{ key: '/start', after: 'Read the quickstart' }]);
    expect(reworded.findings.every((f) => f.verdict === 'RISK' && f.change === 'reworded')).toBe(true);

    const acknowledged = run('acknowledged');
    expect(acknowledged.verdict).toBe('PASS');
    expect(acknowledged.inventory.links).toMatchObject({ kept: 6, acknowledged: 3, lost: [] });
    expect(acknowledged.inventory.headings).toMatchObject({ kept: 1, acknowledged: 1, lost: [] });
    expect(acknowledged.acknowledgements).toEqual({ applied: 4, rejected: [] });

    const korean = run('korean');
    expect(korean.verdict).toBe('RISK');
    expect(korean.wordCount).toEqual({ before: 209, after: 42, ratio: 0.2 });
    expect(korean.findings.map((f) => `${f.checkId}:${f.change}`)).toEqual([
      'redesign-kept-headings:dropped', 'redesign-kept-headings:reworded', 'redesign-kept-figures:dropped', 'redesign-kept-words:shrunk',
    ]);
    expect(korean.results.find((r) => r.checkId === 'redesign-kept-words')!.rationale).toContain('보이는 단어');

    const unchanged = run('unchanged');
    expect(unchanged.verdict).toBe('PASS');
    expect(unchanged.findings).toEqual([]);

    const hooks = run('hooks');
    expect(hooks.inventory.scriptHooks).toMatchObject({ before: 5, kept: 3, lost: ['.js-variant', '.price'] });
    expect(hooks.inventory.testHooks.lost).toEqual(['data-testid=price']);
    expect(hooks.inventory.handlers.lost).toEqual(["onclick: analytics.track('add_to_cart')"]);
    expect(hooks.findings.find((f) => f.checkId === 'redesign-kept-test-hooks')).toMatchObject({ verdict: 'FIX_NOW', severity: 'minor' });
    expect(hooks.results.find((r) => r.checkId === 'redesign-kept-script-hooks')!.rationale).toContain('#not-on-the-old-page');

    const must = run('must-have');
    expect(must.mustHaves!.items.map((item) => `${item.id}:${item.before}>${item.after}`)).toEqual([
      'price:present>misplaced', 'variant-choice:present>present', 'add-to-cart:present>present', 'purchase-assurance:present>missing',
    ]);
    expect(must.inventory.mustHaves.lost).toEqual(['price', 'purchase-assurance']);
  });
});

describe('compare_page_revisions and the audit contract', () => {
  it.each(CASES)('validate_design_audit_result accepts the %s evidence and results unchanged', (name, extra) => {
    const result = compare({ ...pair(name), ...extra });
    const plan: DesignAuditPlanInput = { revisionPreservation: true, ...(extra.productType ? { productType: extra.productType } : {}), ...(extra.locale ? { locale: extra.locale } : {}) };
    const validated = validateDesignAuditResult({
      plan, expectedPlanHash: planDesignAudit(plan, repo).identity.planHash,
      targets: [{ id: 'page', surface: 'global' }], evidence: result.evidence, results: result.results,
    }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.valid).toBe(true);
    expect(validated.coverage.state).toBe('full');
    expect(validated.results.map((r) => r.verdict)).toEqual(result.results.map((r) => r.verdict));
  });

  it('plans exactly the redesign-kept checks only on request, in the structure and behavior groups', () => {
    const plan = planDesignAudit({ revisionPreservation: true }, repo);
    expect(plan.checks.map((check) => check.id)).toEqual(REVISION_CHECKS.filter((check) => check.kind !== 'must-have').map((check) => check.id));
    expect(new Set(plan.checks.map((check) => check.groupId))).toEqual(new Set(['structure', 'behavior']));
    expect(plan.query.revisionPreservation).toBe(true);
    expect(plan.coverage.revisionChecks).toBe(9);
    expect(planDesignAudit({ revisionPreservation: true, productType: 'commerce', includeGroups: ['structure', 'behavior'] }, repo).checks.at(-1)!.id).toBe('redesign-kept-must-haves');
    expect(planDesignAudit({ revisionPreservation: true, includeGroups: ['behavior'] }, repo).checks.map((check) => check.id))
      .toEqual(['redesign-kept-fields', 'redesign-kept-handlers', 'redesign-kept-test-hooks', 'redesign-kept-script-hooks']);
    expect(() => planDesignAudit({ revisionPreservation: true, includeGroups: ['structure', 'layout'] }, repo)).toThrow(AuditPlanError);
  });

  it('keeps every earlier plan and its hash when revisionPreservation is absent or false', () => {
    const queries: DesignAuditPlanInput[] = [
      {}, { includeGroups: ['structure'], styleId: 'quiet-utility', productType: 'commerce' },
      { styleId: 'editorial-silence', surfaces: ['form', 'checkout'], locale: 'ko' }, { includeGroups: ['behavior', 'structure'] },
    ];
    for (const query of queries) {
      const plain = planDesignAudit(query, repo);
      expect(plain.query).not.toHaveProperty('revisionPreservation');
      expect(plain.coverage).not.toHaveProperty('revisionChecks');
      expect(plain.checks.some((check) => check.id.startsWith('redesign-kept-'))).toBe(false);
      expect(planDesignAudit({ ...query, revisionPreservation: false }, repo).identity.planHash).toBe(plain.identity.planHash);
    }
  });
});

describe('compare_page_revisions rules', () => {
  const structure = readdirSync(join(fixtures, 'page-structure')).filter((file) => file.endsWith('.html'));

  it.each(structure)('finds nothing lost when %s is compared with itself or a minified copy', (file) => {
    const html = read(`page-structure/${file}`);
    const css = file === 'icon-cards-css.html' ? [read('page-structure/icon-cards.css')] : [];
    for (const after of [html, html.replace(/>\s+</g, '><')]) {
      const result = compare({ before: { html, css }, after: { html: after, css } });
      expect(result.findings, file).toEqual([]);
      expect(result.verdict).toBe('PASS');
    }
  });

  it.each(PRODUCT_MUST_HAVES.map((entry) => entry.productType))('keeps every %s must-have when its fixture is compared with itself', (productType) => {
    const file = `must-haves/${productType}.html`;
    const html = read(file);
    const result = compare({ before: { html }, after: { html }, productType });
    expect(result.findings).toEqual([]);
    expect(result.inventory.mustHaves.before).toBeGreaterThan(0);
  });

  it('normalizes hrefs: sorted query, lowercase scheme and host, fragment kept, relative and absolute distinct', () => {
    expect(normalizeHref('/docs?v=2&section=api#auth')).toBe('/docs?section=api&v=2#auth');
    expect(normalizeHref('HTTPS://Example.COM/Path?b=1&a=2')).toBe('https://example.com/Path?a=2&b=1');
    expect(normalizeHref('https://example.com/pricing')).not.toBe(normalizeHref('/pricing'));
    expect(normalizeHref('/pricing/')).not.toBe(normalizeHref('/pricing'));
    for (const empty of ['', '  ', '#', 'javascript:void(0)', 'JavaScript:go()']) expect(normalizeHref(empty)).toBeNull();
    expect(normalizeHref('mailto:Team@Example.com')).toBe('mailto:Team@Example.com');
  });

  it('counts only visible links and headings, but hidden fields, handlers, and hooks too', () => {
    const before = page('<div hidden><a href="/old-promo">Old promo</a><h2>Old promo</h2></div><form action="/s"><input type="hidden" name="csrf"></form><div style="display:none" data-testid="drawer" onclick="openDrawer()"></div>');
    const after = page('<form action="/s"></form>');
    const result = compare({ before: { html: before }, after: { html: after }, scriptSelectors: ['[data-testid="drawer"]'] });
    expect(result.inventory.links.before).toBe(0);
    expect(result.inventory.headings.lost).toEqual([]);
    expect(result.inventory.fields.lost).toEqual(['name=csrf']);
    expect(result.inventory.handlers.lost).toEqual(['onclick: openDrawer()']);
    expect(result.inventory.testHooks.lost).toEqual(['data-testid=drawer']);
    expect(result.inventory.scriptHooks.lost).toEqual(['[data-testid="drawer"]']);
  });

  it('counts Korean, Chinese, and Japanese text by character and other text by word', () => {
    const result = compare({ before: { html: page('<p>오늘 볶은 원두 React로 만든 page</p>') }, after: { html: page('<p>今日の豆</p>') } });
    expect(result.wordCount.before).toBe(3 + 6 + 4 + 1);
    expect(result.wordCount.after).toBe(3 + 4);
  });

  it('flags a large text cut only above the word floor and below the kept ratio', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
    const verdictOf = (before: number, after: number) => compare({ before: { html: page(`<p>${words(before)}</p>`) }, after: { html: page(`<p>${words(after)}</p>`) } })
      .results.find((r) => r.checkId === 'redesign-kept-words')!.verdict;
    expect(verdictOf(200, 100)).toBe('RISK');
    expect(verdictOf(200, 140)).toBe('PASS');
    expect(verdictOf(70, 10)).toBe('PASS');
  });

  it('applies an acknowledgement only for the matching kind, key, and change with a reason of 12 or more characters', () => {
    const base = { before: { html: page('<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>') }, after: { html: page('<p>Nothing linked</p>') } };
    const result = compare({
      ...base,
      acknowledged: [
        { kind: 'link', key: '/a', change: 'dropped', reason: '열두 글자가 넘는 한국어 이유입니다' },
        { kind: 'link', key: '/b', change: 'dropped', reason: 'too short' },
        { kind: 'link', key: '/c', change: 'reworded', reason: 'the wrong change for a dropped link' },
        { kind: 'heading', key: '/c', change: 'dropped', reason: 'the wrong kind for a dropped link' },
      ],
    });
    expect(result.inventory.links).toMatchObject({ acknowledged: 1, lost: ['/b', '/c'] });
    expect(result.findings.map((f) => `${f.verdict}:${f.change}:${f.keys.join(',')}`)).toEqual(['FIX_NOW:dropped:/b,/c', 'RISK:acknowledgement:/b']);
    expect(result.acknowledgements).toEqual({
      applied: 1,
      rejected: [
        { kind: 'link', key: '/b', reason: 'short' },
        { kind: 'link', key: '/c', reason: 'unmatched' },
        { kind: 'heading', key: '/c', reason: 'unmatched' },
      ],
    });
  });

  it('marks script hooks not applicable without selectors and not verified for unsupported syntax', () => {
    const html = page('<button class="js-buy">Buy</button>');
    const none = compare({ before: { html }, after: { html } });
    expect(none.results.find((r) => r.checkId === 'redesign-kept-script-hooks')!.verdict).toBe('NOT_APPLICABLE');
    const odd = compare({ before: { html }, after: { html }, scriptSelectors: ['.js-buy', 'x-cart::part(total)'] });
    expect(odd.results.find((r) => r.checkId === 'redesign-kept-script-hooks')!.verdict).toBe('NOT_VERIFIED');
    expect(odd.verdict).toBe('RISK');
    expect(odd.limits.some((limit) => limit.includes('x-cart::part(total)'))).toBe(true);
  });

  it('applies the page limits to each side and validates the input', () => {
    const html = page('<p>ok</p>');
    expect(() => compare({ before: { html: ' ' }, after: { html } })).toThrow(RevisionCompareError);
    expect(() => compare({ before: { html }, after: { html, css: Array.from({ length: 21 }, () => '') } })).toThrow(/at most 20 stylesheets/);
    expect(() => compare({ before: { html }, after: { html }, scriptSelectors: Array.from({ length: 51 }, (_, i) => `#a${i}`) })).toThrow(/at most 50/);
    expect(() => compare({ before: { html }, after: { html }, viewportWidth: 100 })).toThrow(/viewportWidth/);
  });

  it('returns the same result for the same input', () => {
    const input = { ...pair('hooks'), ...CASES.find(([name]) => name === 'hooks')![1] };
    expect(JSON.stringify(compare(input))).toBe(JSON.stringify(compare(structuredClone(input))));
  });
});

describe('compare_page_revisions over MCP', () => {
  let client: Client;
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'revisions-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  it('is a read-only tool that returns structured results and a text summary', async () => {
    const tool = (await client.listTools()).tools.find((entry) => entry.name === 'compare_page_revisions')!;
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    const res = await client.callTool({ name: 'compare_page_revisions', arguments: { ...pair('link-loss'), locale: 'ja' } });
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as { verdict: string }).verdict).toBe('FIX_NOW');
    const textOut = (res.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')!.text!;
    expect(textOut).toContain('リデザイン保持チェック');
    expect(textOut).toContain('/pricing');
  });

  it('rejects a missing side and an unknown acknowledgement kind', async () => {
    const missing = await client.callTool({ name: 'compare_page_revisions', arguments: { before: { html: '<p>x</p>' } } });
    expect(missing.isError).toBe(true);
    const badKind = await client.callTool({
      name: 'compare_page_revisions',
      arguments: { ...pair('unchanged'), acknowledged: [{ kind: 'paragraph', key: 'x', change: 'dropped', reason: 'a long enough reason' }] },
    });
    expect(badKind.isError).toBe(true);
  });
});
