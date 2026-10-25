import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { AuditPlanError, planDesignAudit } from '../src/audit/planner.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { auditPageStructure, StructureAuditError } from '../src/structure/audit.js';
import { structureGuide } from '../src/structure/guidance.js';
import {
  MUST_HAVES, MUST_HAVE_IDS, PRODUCT_MUST_HAVES, mustHaveCheckId, mustHaveDef, productMustHaveDef, productMustHaves,
} from '../src/structure/must-haves.js';
import { validateMustHaves } from '../src/structure/validate.js';
import { LANGS, type ProductType } from '../src/types.js';

const repo = CatalogRepository.load();
const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'must-haves');
const read = (file: string) => readFileSync(join(dir, file), 'utf8');
const block = (id: string) => new RegExp(`<!--mh:${id}-->[\\s\\S]*?<!--/mh:${id}-->`, 'g');
/** The fixture without the marked must-have. */
const without = (html: string, id: string) => html.replace(block(id), '');
/** The fixture with the marked must-have moved below a long section, past the first screen. */
const movedDown = (html: string, id: string) => without(html, id).replace('<!--late-->', (html.match(block(id)) ?? []).join(''));
const audit = (html: string, productType: ProductType, extra: Partial<Parameters<typeof auditPageStructure>[0]> = {}) =>
  auditPageStructure({ html, productType, ...extra }, repo);
const statusOf = (result: ReturnType<typeof audit>, id: string) => result.mustHaves!.items.find((item) => item.id === id)?.status;
const cases = PRODUCT_MUST_HAVES.map((entry) => [entry.productType, entry] as const);

describe('must-have data', () => {
  it('gives every catalog product archetype a list and none to "other"', () => {
    expect(PRODUCT_MUST_HAVES.map((entry) => entry.productType).sort())
      .toEqual(repo.data.productArchetypes.map((product) => product.id).sort());
    expect(productMustHaveDef('other')).toBeNull();
    expect(validateMustHaves(MUST_HAVES, PRODUCT_MUST_HAVES, repo)).toEqual([]);
  });

  it('pins the examples from issue #12 with their placement', () => {
    const items = (type: ProductType) => productMustHaveDef(type)!.items.map(({ id, zone }) => `${id}@${zone}`);
    expect(items('commerce')).toEqual([
      'price@first-screen', 'variant-choice@first-screen', 'add-to-cart@first-screen', 'purchase-assurance@first-screen',
    ]);
    expect(items('operational-saas')).toEqual(['current-status@first-screen', 'recent-changes@first-screen']);
    expect(items('campaign')).toEqual(['primary-cta@first-screen', 'proof@page']);
    expect(items('documentation')).toEqual(['search@first-screen', 'quickstart@first-screen']);
  });

  it('localizes every name, build step, page, and reason, and gives every must-have criteria', () => {
    expect(MUST_HAVES.map((def) => def.id)).toEqual([...MUST_HAVE_IDS]);
    for (const def of MUST_HAVES) {
      for (const lang of LANGS) {
        expect(def.name[lang].trim(), `${def.id} name ${lang}`).not.toBe('');
        expect(def.build[lang].trim(), `${def.id} build ${lang}`).not.toBe('');
      }
      expect(def.criteria.length).toBeGreaterThan(0);
    }
    for (const entry of PRODUCT_MUST_HAVES) {
      for (const lang of LANGS) expect(entry.page[lang].trim()).not.toBe('');
      for (const item of entry.items) for (const lang of LANGS) expect(item.why[lang].trim(), `${entry.productType}/${item.id}`).not.toBe('');
    }
  });

  it('reports broken lists instead of accepting them', () => {
    const broken = [
      ...PRODUCT_MUST_HAVES.filter((entry) => entry.productType !== 'portfolio'),
      { ...PRODUCT_MUST_HAVES[0]!, items: [...PRODUCT_MUST_HAVES[0]!.items, PRODUCT_MUST_HAVES[0]!.items[0]!, { ...PRODUCT_MUST_HAVES[0]!.items[0]!, id: 'teleport' as never }] },
    ];
    const errors = validateMustHaves(MUST_HAVES, broken, repo);
    expect(errors).toEqual(expect.arrayContaining([
      'duplicate must-have list for operational-saas',
      'operational-saas lists must-have current-status twice',
      'operational-saas -> unknown must-have teleport',
      'product portfolio has no must-have list',
      'must-have work-samples is not used by any product type',
    ]));
  });
});

describe('recommend_design_direction returns the product type\'s must-haves', () => {
  it.each(cases)('%s', (productType, entry) => {
    const input = { productDescription: `A ${productType} product`, productType, candidateLimit: 4 };
    const result = recommendDesignDirection(input, repo);
    expect(result.mustHaves).toMatchObject({ schema: 'webstylebook.must-haves.v1', productType, source: 'explicit', resourceUri: 'webstylebook://structure/must-haves' });
    expect(result.mustHaves.items.map(({ id, zone }) => ({ id, zone }))).toEqual(entry.items.map(({ id, zone }) => ({ id, zone })));
    expect(result.mustHaves.page).toBe(entry.page.en);
    expect(result.mustHaves.rule).toContain(`productType "${productType}"`);
    for (const candidate of result.candidates) {
      const placed = candidate.structure!.mustHaves!;
      expect(placed.map((item) => item.id)).toEqual(entry.items.map((item) => item.id));
      const guide = structureGuide(candidate.styleId);
      for (const item of placed) {
        const job = mustHaveDef(item.id).job;
        expect(item.moves).toEqual(guide.moves.filter((move) => move.jobs.includes(job)).map((move) => move.id));
      }
    }
    expect(JSON.stringify(recommendDesignDirection(input, repo))).toBe(JSON.stringify(result));
  });

  it('keeps the commerce must-haves whatever the archetype allows in its opening', () => {
    const result = recommendDesignDirection({
      productDescription: 'A luxury skincare product page for one overnight serum', productType: 'commerce', tone: ['premium', 'editorial'],
    }, repo);
    expect(result.mustHaves.rule).toMatch(/must not remove them/);
    expect(result.mustHaves.rule).toMatch(/every first-screen item goes in the hero/);
    for (const candidate of result.candidates) {
      expect(candidate.structure!.mustHaves!.filter((item) => item.zone === 'first-screen').map((item) => item.id))
        .toEqual(['price', 'variant-choice', 'add-to-cart', 'purchase-assurance']);
    }
  });

  it('says how to get must-haves when the product type is unknown, and says when it was inferred', () => {
    const unknown = recommendDesignDirection({ productDescription: 'A tool for planning' }, repo);
    expect(unknown.mustHaves).toMatchObject({ productType: 'other', source: 'default', page: null, items: [] });
    expect(unknown.mustHaves.rule).toMatch(/Pass a specific productType/);
    expect(unknown.candidates.every((candidate) => candidate.structure?.mustHaves === undefined)).toBe(true);
    const inferred = recommendDesignDirection({ productDescription: 'An online store selling handmade ceramics' }, repo);
    expect(inferred.mustHaves).toMatchObject({ productType: 'commerce', source: 'inferred' });
    expect(inferred.mustHaves.rule).toMatch(/inferred/);
  });

  it('localizes the must-haves', () => {
    const ko = productMustHaves('commerce', 'explicit', 'ko');
    expect(ko.items.map((item) => item.name)).toEqual(['가격', '옵션 선택', '장바구니 담기', '배송·보증 안내']);
    expect(ko.page).toBe('상품 상세 페이지');
    expect(productMustHaves('documentation', 'explicit', 'ja').items[0]!.placement).toMatch(/ファーストビュー/);
  });
});

describe('audit_page_structure finds missing and misplaced must-haves', () => {
  it.each(cases)('%s: a complete page has every must-have', (productType) => {
    const result = audit(read(`${productType}.html`), productType);
    expect(result.mustHaves!.items.map((item) => [item.id, item.status])).toEqual(
      productMustHaveDef(productType)!.items.map((item) => [item.id, 'present']),
    );
    expect(result.mustHaves!.missing).toEqual([]);
    expect(result.mustHaves!.misplaced).toEqual([]);
    expect(result.findings.filter((finding) => finding.scope === 'must-have')).toEqual([]);
  });

  it.each(cases)('%s: removing a must-have reports it missing; moving a first-screen one down reports it misplaced', (productType, entry) => {
    const html = read(`${productType}.html`);
    for (const item of entry.items) {
      const gone = audit(without(html, item.id), productType, { styleId: 'quiet-utility' });
      expect(statusOf(gone, item.id), `${item.id} removed`).toBe('missing');
      expect(gone.mustHaves!.missing).toEqual([item.id]);
      const finding = gone.findings.find((candidate) => candidate.checkId === mustHaveCheckId(item.id))!;
      expect(finding).toMatchObject({ scope: 'must-have', severity: 'major', patternId: `must-have/${item.id}`, count: 0 });
      expect(finding.replaceWith.instruction).toContain(mustHaveDef(item.id).build.en);
      if (item.zone !== 'first-screen') continue;
      const moved = audit(movedDown(html, item.id), productType);
      expect(statusOf(moved, item.id), `${item.id} moved`).toBe('misplaced');
      expect(moved.mustHaves!.misplaced).toEqual([item.id]);
      expect(moved.mustHaves!.items.find((candidate) => candidate.id === item.id)!.locations[0]).toMatch(/section\.late/);
    }
  });

  it('flags the issue #7 page: one buy button above the fold, price, sizes, and delivery below it', () => {
    const result = audit(read('commerce-buy-button-only.html'), 'commerce', { styleId: 'editorial-silence' });
    expect(result.mustHaves).toMatchObject({ productType: 'commerce', page: 'product detail page', missing: [], misplaced: ['price', 'variant-choice', 'purchase-assurance'] });
    expect(statusOf(result, 'add-to-cart')).toBe('present');
    const price = result.findings.find((finding) => finding.patternId === 'must-have/price')!;
    expect(price.locations[0]).toMatch(/section#buy/);
    expect(price.observed).toMatchObject({ status: 'misplaced', zone: 'first-screen', inZone: 0 });
    expect(price.replaceWith.instruction).toMatch(/^Move it onto the first screen/);
    expect(price.replaceWith.archetype?.hero).toBe(structureGuide('editorial-silence').hero);
    const assurance = result.findings.find((finding) => finding.patternId === 'must-have/purchase-assurance')!;
    expect(assurance.replaceWith.moves.map((move) => move.id))
      .toEqual(structureGuide('editorial-silence').moves.filter((move) => move.jobs.includes('proof')).map((move) => move.id));
  });

  it('reads Korean and Japanese pages', () => {
    const ko = audit(read('commerce-ko.html'), 'commerce', { locale: 'ko' });
    expect(ko.mustHaves!.items.map((item) => item.status)).toEqual(['present', 'present', 'present', 'present']);
    expect(ko.mustHaves!.items[0]!.name).toBe('가격');
    expect(ko.mustHaves!.page).toBe('상품 상세 페이지');
    const ja = audit(read('documentation-ja.html'), 'documentation', { locale: 'ja' });
    expect(ja.mustHaves!.items.map((item) => item.status)).toEqual(['present', 'present']);
    const missing = audit(without(read('commerce.html'), 'price'), 'commerce', { locale: 'ko' });
    expect(missing.results.find((entry) => entry.checkId === 'structure-must-have-price')!.rationale).toMatch(/찾지 못했습니다/);
  });

  it('does not count must-haves a person cannot see or hear', () => {
    const html = read('commerce.html');
    const swap = (replacement: string) => html.replace('<p class="price">$68</p>', replacement);
    expect(statusOf(audit(swap('<p class="price" hidden>$68</p>'), 'commerce'), 'price')).toBe('missing');
    expect(statusOf(audit(swap('<p class="price" aria-hidden="true">$68</p>'), 'commerce'), 'price')).toBe('missing');
    expect(statusOf(audit(swap('<p class="price">$68</p>'), 'commerce', { css: ['.price { display: none }'] }), 'price')).toBe('missing');
    const srOnly = '.sr { position: absolute; width: 1px; height: 1px; clip: rect(0 0 0 0); overflow: hidden }';
    expect(statusOf(audit(swap('<p class="price sr">$68</p>'), 'commerce', { css: [srOnly] }), 'price')).toBe('missing');
  });

  it('counts the footer only where the must-have may live there', () => {
    const assurance = without(read('commerce.html'), 'purchase-assurance')
      .replace('<p>© 2026 Example Studio</p>', '<p>Free delivery and 30-day returns.</p>');
    expect(statusOf(audit(assurance, 'commerce'), 'purchase-assurance')).toBe('missing');
    expect(statusOf(audit(read('portfolio.html'), 'portfolio'), 'contact')).toBe('present');
    expect(audit(read('portfolio.html'), 'portfolio').mustHaves!.items.find((item) => item.id === 'contact')!.locations[0]).toMatch(/^body > footer/);
  });

  it('extends the first screen past a short title band but not past an opening that fills the viewport', () => {
    const dashboard = (openingCss = '') => auditPageStructure({
      html: `<main>
        <header class="bar"><h1>Overview</h1><button>Export</button></header>
        <section><h2>Queues</h2><p><span>Ingest</span> <strong>Degraded</strong></p></section>
        <section><h2>Activity</h2><ul><li>Deploy 4821 finished 5 min ago</li></ul></section>
        <section><p>${'Long notes about the queue that keep going for a while. '.repeat(8)}</p></section>
      </main>`,
      css: [openingCss],
      productType: 'operational-saas',
    }, repo);
    expect(dashboard().mustHaves!.items.map((item) => item.status)).toEqual(['present', 'present']);
    expect(dashboard('.bar { min-height: 100vh }').mustHaves!.misplaced).toEqual(['current-status', 'recent-changes']);
  });

  // The selector-budget case shares the costly page in page-structure.test.ts.
  it('reports not verified instead of guessing', () => {
    const truncated = audit(`<main><section><h1>Big page</h1>${'<i></i>'.repeat(40_010)}<p>$68</p></section></main>`, 'commerce');
    expect(truncated.mustHaves!.items.map((item) => item.status)).toEqual(['not-verified', 'not-verified', 'not-verified', 'not-verified']);
    expect(truncated.mustHaves!.items[0]!.note).toMatch(/further down/);
    const noSections = audit('<header><input type="search" name="q"></header><main></main>', 'documentation');
    expect(statusOf(noSections, 'search')).toBe('not-verified');
    expect(statusOf(noSections, 'quickstart')).toBe('missing');
    expect(noSections.summary.clean).toBe(false);
  });

  it('leaves the audit unchanged without productType and rejects an unknown one', () => {
    const html = read('commerce-buy-button-only.html');
    const plain = auditPageStructure({ html, styleId: 'editorial-silence' }, repo);
    expect(plain.mustHaves).toBeNull();
    expect(plain.results.some((entry) => entry.checkId.startsWith('structure-must-have-'))).toBe(false);
    const withType = audit(html, 'commerce', { styleId: 'editorial-silence' });
    expect(withType.checks).toEqual(plain.checks);
    expect(withType.identity.inputHash).toBe(plain.identity.inputHash);
    expect(withType.summary.checked).toBe(plain.summary.checked + 4);
    expect(audit(html, 'other').mustHaves).toEqual({ productType: 'other', page: null, missing: [], misplaced: [], items: [] });
    expect(() => audit(html, 'shop' as ProductType)).toThrow(StructureAuditError);
  });

  it('is deterministic', () => {
    const html = read('commerce-buy-button-only.html');
    expect(JSON.stringify(audit(html, 'commerce', { styleId: 'editorial-silence' })))
      .toBe(JSON.stringify(audit(html, 'commerce', { styleId: 'editorial-silence' })));
  });
});

describe('must-haves in the audit contract', () => {
  it('needs the structure group and keeps plans without productType unchanged', () => {
    expect(() => planDesignAudit({ productType: 'commerce' }, repo)).toThrow(AuditPlanError);
    const base = planDesignAudit({ styleId: 'editorial-silence', includeGroups: ['structure'] }, repo);
    expect(planDesignAudit({ styleId: 'editorial-silence', includeGroups: ['structure'], productType: undefined }, repo).identity.planHash)
      .toBe(base.identity.planHash);
    const withType = planDesignAudit({ styleId: 'editorial-silence', includeGroups: ['structure'], productType: 'commerce' }, repo);
    expect(withType.query.productType).toBe('commerce');
    expect(withType.identity.planHash).not.toBe(base.identity.planHash);
    expect(withType.checks.filter((check) => check.source.kind === 'structure' && check.source.scope === 'must-have').map((check) => check.id))
      .toEqual(['price', 'variant-choice', 'add-to-cart', 'purchase-assurance'].map((id) => `structure-must-have-${id}`));
  });

  it('produces evidence and results that validate_design_audit_result accepts', () => {
    const result = audit(read('commerce-buy-button-only.html'), 'commerce', { styleId: 'editorial-silence', targetId: 'pdp-desktop' });
    const planInput = { styleId: 'editorial-silence', productType: 'commerce' as const, includeGroups: ['structure' as const] };
    const plan = planDesignAudit(planInput, repo);
    expect(plan.checks.map((check) => check.id).sort()).toEqual(result.results.map((entry) => entry.checkId).sort());
    const validated = validateDesignAuditResult({
      plan: planInput,
      expectedPlanHash: plan.identity.planHash,
      targets: [{ id: 'pdp-desktop', surface: 'global' }],
      evidence: result.evidence,
      results: result.results,
    }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.valid).toBe(true);
    const verdict = (id: string) => validated.results.find((entry) => entry.checkId === mustHaveCheckId(id as never))!.verdict;
    expect(verdict('add-to-cart')).toBe('PASS');
    expect(verdict('price')).toBe('FIX_NOW');
    const lying = result.results.map((entry) => (entry.checkId === 'structure-must-have-price' ? { ...entry, verdict: 'PASS' as const } : entry));
    const contradicted = validateDesignAuditResult({ plan: planInput, targets: [{ id: 'pdp-desktop', surface: 'global' }], evidence: result.evidence, results: lying }, repo);
    expect(contradicted.issues.map((entry) => entry.code)).toContain('PASS_CONTRADICTS_FAILED_EVIDENCE');
  });
});

describe('must-haves over MCP', () => {
  let client: Client;
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'must-haves-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  it('returns must-haves from recommend_design_direction in structured and text output', async () => {
    const r = await client.callTool({ name: 'recommend_design_direction', arguments: { productDescription: 'Night serum product page', productType: 'commerce', candidateLimit: 2 } });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as any;
    expect(sc.mustHaves.items.map((item: any) => item.id)).toEqual(['price', 'variant-choice', 'add-to-cart', 'purchase-assurance']);
    expect(sc.candidates[0].structure.mustHaves).toHaveLength(4);
    const text = (r.content as any[]).find((c) => c.type === 'text')?.text ?? '';
    expect(text).toContain('## Must-haves — commerce (product detail page)');
    expect(text).toContain('**Price** (price)');
  });

  it('accepts productType on audit_page_structure and get_design_audit_plan', async () => {
    const { tools } = await client.listTools();
    for (const name of ['audit_page_structure', 'get_design_audit_plan', 'validate_design_audit_result']) {
      const tool = tools.find((candidate) => candidate.name === name)!;
      const properties = (name === 'validate_design_audit_result'
        ? (tool.inputSchema.properties as any).plan.properties : tool.inputSchema.properties) as Record<string, any>;
      expect(properties.productType.enum, name).toContain('commerce');
    }
    const r = await client.callTool({ name: 'audit_page_structure', arguments: { html: read('commerce-buy-button-only.html'), productType: 'commerce' } });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as any).mustHaves.misplaced).toEqual(['price', 'variant-choice', 'purchase-assurance']);
    const text = (r.content as any[]).find((c) => c.type === 'text')?.text ?? '';
    expect(text).toContain('Must-haves (commerce, product detail page): Missing: none · Not on the first screen: Price, Variant choice, Delivery and guarantee details');
    const bad = await client.callTool({ name: 'get_design_audit_plan', arguments: { productType: 'commerce' } });
    expect(bad.isError).toBe(true);
    expect((bad.structuredContent as any).error.code).toBe('INVALID_INPUT');
  });

  it('serves the must-have catalog as a resource', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toContain('webstylebook://structure/must-haves');
    const res = await client.readResource({ uri: 'webstylebook://structure/must-haves' });
    const body = JSON.parse(res.contents[0]!.text as string);
    expect(body.schema).toBe('webstylebook.must-haves.v1');
    expect(body.productTypes).toHaveLength(14);
    expect(body.mustHaves).toHaveLength(MUST_HAVE_IDS.length);
    expect(body.zones['first-screen'].criterion.text).toMatch(/opening section/);
    expect(body.rulesetHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    const manifest = JSON.parse((await client.readResource({ uri: 'webstylebook://manifest' })).contents[0]!.text as string);
    expect(manifest.structure).toMatchObject({ mustHaves: MUST_HAVE_IDS.length, mustHaveProductTypes: 14 });
  });
});
