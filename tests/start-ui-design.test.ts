// Plan PR 5 (2026-11-25 design-quality plan, 3.3, 5.3 and 8): in the 0.16.0 runs 7 of the 26 sessions that called the
// server stopped after recommend_design_direction and 15 never received a font. start_ui_design returns the direction,
// structure, fonts, photo plan, copy brief and next calls in one result of at most 16 KiB.
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { createWebStylebookServer } from '../src/server.js';
import { ENTRY_TOOL, SERVER_INSTRUCTIONS } from '../src/server-info.js';
import { PAGE_ROLES } from '../src/recommendation/page-roles.js';
import { COPY_PATTERNS } from '../src/copy/lexicon.js';
import { START_UI_DESIGN_BUDGET_BYTES, startUiDesign } from '../src/start/start-ui-design.js';
import { PHOTO_PLANS } from '../src/start/photos.js';

const repo = CatalogRepository.load();
const LOCALES = ['en', 'ko', 'ja'] as const;
const LANDING = { productDescription: 'A marketing landing page for an AI meeting notes SaaS', productType: 'operational-saas' as const };

let client: Client;
beforeAll(async () => {
  const server = createWebStylebookServer(repo);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'start-ui-design-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});
const call = (args: Record<string, unknown>) => client.callTool({ name: 'start_ui_design', arguments: args });
const body = async (args: Record<string, unknown>) => (await call(args)).structuredContent as ReturnType<typeof startUiDesign>;

describe('start_ui_design is the entry tool', () => {
  it('is what the instructions and the new-ui workflow send a new page to', async () => {
    expect(ENTRY_TOOL).toBe('start_ui_design');
    expect(SERVER_INSTRUCTIONS.split(/(?<=\.)\s/)[0]).toContain('start_ui_design');
    const workflow = JSON.parse((await client.readResource({ uri: 'webstylebook://workflows/new-ui' })).contents[0]!.text as string);
    expect(workflow.entryTool).toBe('start_ui_design');
    expect(workflow.steps[0]).toMatch(/^start_ui_design/);
  });

  it('sends recommend_design_direction callers to it first', async () => {
    const { tools } = await client.listTools();
    const description = (name: string) => tools.find((tool) => tool.name === name)!.description!;
    expect(description('recommend_design_direction')).toMatch(/^Call after start_ui_design when you need more than its three directions/);
    expect(description('start_ui_design')).toMatch(/^Call first, before writing HTML, CSS or JSX for any new page or screen/);
  });
});

describe('start_ui_design results', () => {
  it(`stay within ${START_UI_DESIGN_BUDGET_BYTES} bytes and are deterministic for every page role and locale`, async () => {
    for (const pageRole of PAGE_ROLES) {
      for (const locale of LOCALES) {
        const args = { ...LANDING, pageRole, locale };
        const first = await call(args);
        await call({ ...LANDING, pageRole: 'dashboard', locale: 'en' });
        const second = await call(args);
        expect(JSON.stringify(second), `${pageRole} ${locale}`).toBe(JSON.stringify(first));
        expect(Buffer.byteLength(JSON.stringify(first)), `${pageRole} ${locale}`).toBeLessThanOrEqual(START_UI_DESIGN_BUDGET_BYTES);
        expect(first.isError, `${pageRole} ${locale}`).toBeFalsy();
      }
    }
  });

  it('give a landing page its direction, structure, fonts, photo plan, copy brief and next calls', async () => {
    const result = await body({ ...LANDING, locale: 'ko' });
    expect(result.page.pageRole).toEqual({ value: 'marketing-landing', source: 'inferred' });
    expect(result.directions).toHaveLength(3);
    expect(result.style).toMatchObject({ styleId: result.directions[0]!.styleId, chosen: 'top-ranked' });
    expect(result.style.signatureMoves.length).toBeGreaterThan(0);
    expect(result.mustHaves?.productType).toBe('campaign');
    expect(result.fonts.authored.head).toContain('<link rel="stylesheet" href="https://');
    expect(result.fonts.authored.css).toContain('--font-display:');
    expect(result.fonts.alternatives).toHaveLength(2);
    for (const alt of result.fonts.alternatives) expect(alt.css).toMatch(/--font-body: '[^']+', '[^']+'/);
    expect(result.photos.use).toBe(true);
    expect(result.copy.voice).toMatchObject({ productType: 'operational-saas', register: '합니다체' });
    expect(result.copy.watch.map((entry) => entry.id)).toEqual(['ko-social-proof-count', 'ko-setup-minutes', 'ko-stop-doing-closer', 'ko-generic-cta', 'ko-team-size-pricing']);
    const tools = result.next.filter((step) => 'tool' in step).map((step) => (step as { tool: string }).tool);
    expect(tools).toEqual(['compose_design_tokens', 'get_ui_state_plan', 'audit_page_structure', 'get_design_audit_plan']);
    const audit = result.next.find((step) => 'tool' in step && step.tool === 'audit_page_structure') as { arguments: Record<string, unknown> };
    expect(audit.arguments).toMatchObject({ styleId: result.style.styleId, productType: 'campaign' });
  });

  it('give five copy patterns of the requested language for every page role', async () => {
    for (const pageRole of PAGE_ROLES) {
      for (const locale of LOCALES) {
        const watch = startUiDesign({ ...LANDING, pageRole, locale }, repo).copy.watch;
        expect(watch, `${pageRole} ${locale}`).toHaveLength(5);
        for (const entry of watch) expect(COPY_PATTERNS.find((pattern) => pattern.id === entry.id)!.locales, entry.id).toContain(locale);
      }
    }
  });

  it('plan photos only where they carry information', () => {
    const uses = Object.fromEntries(PAGE_ROLES.map((role) => [role, PHOTO_PLANS[role].use]));
    expect(uses).toMatchObject({ dashboard: false, 'data-table': false, settings: false, docs: false, signup: false, 'restaurant-local': true, portfolio: true, 'product-detail': true });
    expect(startUiDesign({ productDescription: 'A product page', productType: 'developer-tool', pageRole: 'product-detail' }, repo).photos.use).toBe(false);
    const shop = startUiDesign({ productDescription: 'A product page for a hand blender', productType: 'commerce', pageRole: 'product-detail', locale: 'ja' }, repo).photos;
    expect(shop.use).toBe(true);
    if (!('slots' in shop)) throw new Error('expected photo slots');
    expect(shop.slots.map((slot) => slot.slot)).toEqual(['hero', 'detail', 'scale']);
    expect(shop.credit).toContain('Photo by {name} on {Source}');
    expect(shop.termsChecked).toBe('2026-11-25');
    const portfolio = startUiDesign({ productDescription: 'My design portfolio', productType: 'portfolio', pageRole: 'portfolio' }, repo).photos;
    if (!('slots' in portfolio)) throw new Error('expected photo slots');
    expect(portfolio.slots.every((slot) => slot.own && !slot.query)).toBe(true);
  });

  it('keep the product must-haves off pages that are not the product main page', () => {
    expect(startUiDesign({ ...LANDING, pageRole: 'settings' }, repo).mustHaves).toBeUndefined();
    expect(startUiDesign({ ...LANDING, pageRole: 'dashboard' }, repo).mustHaves?.productType).toBe('operational-saas');
  });

  it('build with a requested style and reject an unknown one', async () => {
    const result = await body({ ...LANDING, styleId: 'swiss-poster' });
    expect(result.style).toMatchObject({ styleId: 'swiss-poster', chosen: 'requested' });
    expect(result.next[0]).toMatchObject({ tool: 'compose_design_tokens', arguments: { primaryStyleId: 'swiss-poster' } });
    const bad = await call({ ...LANDING, styleId: 'swiss-postr' });
    expect(bad.isError).toBe(true);
    expect((bad.structuredContent as { error: { code: string } }).error.code).toBe('STYLE_NOT_FOUND');
    expect((bad.structuredContent as { suggestions?: string[] }).suggestions).toContain('swiss-poster');
  });

  it('say when no page role is known instead of guessing one', () => {
    const result = startUiDesign({ productDescription: 'Team analytics', productType: 'data-analytics' }, repo);
    expect(result.page.pageRole).toBeNull();
    expect(result.photos).toMatchObject({ use: false });
    expect(result.copy.watch).toHaveLength(5);
  });

  it('carry the font code, photo slots, copy watch list and next calls in the text fallback', async () => {
    const result = await call({ ...LANDING, pageRole: 'restaurant-local', productType: 'other', locale: 'en' });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toMatch(/^# Start: /);
    expect(text).toContain('```html');
    expect(text).toContain('- dishes (own photo):');
    expect(text).toMatch(/- Watch en-generic-cta: "/);
    expect(text).toContain('1. compose_design_tokens {"primaryStyleId":');
  });
});
