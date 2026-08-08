import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';

let client: Client;

beforeAll(async () => {
  const server = createWebStylebookServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'contract-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

describe('MCP contract', () => {
  it('advertises server instructions and the packaged server version', () => {
    expect(client.getServerVersion()).toEqual({ name: 'web-stylebook', version: '0.5.1' });
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain('recommend_design_direction');
    expect(instructions).toContain('get_design_principle_plan');
    expect(instructions).toContain('get_ux_principle_plan');
    expect(instructions).toContain('get_design_audit_plan');
    expect(instructions).toContain('read-only');
  });

  it('exposes exactly the 7 compute tools, all read-only', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'compare_design_directions', 'compose_design_tokens', 'get_design_audit_plan',
      'get_design_principle_plan', 'get_ui_state_plan', 'get_ux_principle_plan',
      'recommend_design_direction',
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('lists fixed resources and templates', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('webstylebook://manifest');
    expect(uris).toContain('webstylebook://styles');
    expect(uris).toContain('webstylebook://design-principles');
    expect(uris).toContain('webstylebook://principles');
    expect(uris).toContain('webstylebook://policies/audit-checks');
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toContain('webstylebook://styles/{styleId}');
    expect(resourceTemplates.map((t) => t.uriTemplate))
      .toContain('webstylebook://design-principles/{designPrincipleId}');
    expect(resourceTemplates.map((t) => t.uriTemplate)).toContain('webstylebook://principles/{principleId}');
  });

  it('reads the manifest resource', async () => {
    const res = await client.readResource({ uri: 'webstylebook://manifest' });
    const body = JSON.parse(res.contents[0]!.text as string);
    expect(body.counts.styles).toBe(48);
    expect(body.counts.principles).toBe(23);
    expect(body.counts.designPrinciples).toBeGreaterThan(0);
    expect(body.counts.auditChecks).toBe(41);
    expect(body.domains).toContain('design-principles');
    expect(body.domains).toContain('principles');
    expect(body.tools).toHaveLength(7);
    expect(body.resourceUriTemplates).toContain('webstylebook://design-principles/{id}');
    expect(body.resourceUriTemplates).toContain('webstylebook://principles/{id}');
    expect(body.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('reads a style detail via template', async () => {
    const res = await client.readResource({ uri: 'webstylebook://styles/runtime-signal' });
    const body = JSON.parse(res.contents[0]!.text as string);
    expect(body.id).toBe('runtime-signal');
    expect(body.recommendationFacets).toBeDefined();
  });

  it('reads a state recipe via nested template', async () => {
    const res = await client.readResource({ uri: 'webstylebook://states/checkout/payment-declined' });
    const body = JSON.parse(res.contents[0]!.text as string);
    expect(body.id).toBe('payment-declined');
    expect(body.mustNot.length).toBeGreaterThan(0);
  });

  it('reads the design-principles index and a detailed principle', async () => {
    const index = await client.readResource({ uri: 'webstylebook://design-principles' });
    const indexBody = JSON.parse(index.contents[0]!.text as string);
    expect(indexBody.principles.length).toBeGreaterThan(0);
    expect(indexBody.categories).toHaveLength(7);
    expect(indexBody).not.toHaveProperty('attribution');

    const principleId = indexBody.principles[0].id as string;
    const detail = await client.readResource({
      uri: `webstylebook://design-principles/${principleId}`,
    });
    const detailBody = JSON.parse(detail.contents[0]!.text as string);
    expect(detailBody.id).toBe(principleId);
    expect(detailBody.placement.length).toBeGreaterThan(0);
    expect(detailBody.apply.length).toBeGreaterThan(0);
    expect(detailBody.verify.length).toBeGreaterThan(0);
    expect(detailBody).not.toHaveProperty('attribution');
  });

  it('reads the principles index and a fully attributed principle detail', async () => {
    const index = await client.readResource({ uri: 'webstylebook://principles' });
    const indexBody = JSON.parse(index.contents[0]!.text as string);
    expect(indexBody.principles).toHaveLength(23);
    expect(indexBody.categories).toHaveLength(6);
    expect(indexBody.attribution.sourceLicense.name).toBe('CC BY-NC-ND 4.0');
    expect(indexBody.attribution.authoredContentLicense.name).toBe('MIT');

    const detail = await client.readResource({ uri: 'webstylebook://principles/hicks-law' });
    const detailBody = JSON.parse(detail.contents[0]!.text as string);
    expect(detailBody.id).toBe('hicks-law');
    expect(detailBody.caution.en).toBeTruthy();
    expect(detailBody.evidence.references[0].title).toBeTruthy();
    expect(detailBody.evidence.references[0].url).toMatch(/^https:\/\//);
    expect(detailBody.attribution.sourceName).toBe('Laws of UX');
  });

  it('state-recipe URI validates the surface segment, not just the state id (r3)', async () => {
    // 'populated' is a data-table recipe; requesting it under /chat must NOT succeed
    const wrong = await client.readResource({ uri: 'webstylebook://states/chat/populated' });
    const wb = JSON.parse(wrong.contents[0]!.text as string);
    expect(wb.error, 'cross-surface recipe URI must be a not-found').toBeTruthy();
    expect(wb.id).toBeUndefined();
    // correct surface still works
    const right = await client.readResource({ uri: 'webstylebook://states/data-table/populated' });
    expect(JSON.parse(right.contents[0]!.text as string).id).toBe('populated');
  });

  it('recommend: structuredContent + text fallback + golden expectations', async () => {
    const r = await client.callTool({
      name: 'recommend_design_direction',
      arguments: {
        productType: 'operational-saas',
        productDescription: 'Daily monitoring dashboard for SREs; high density; must not look busy.',
        tone: ['calm', 'technical'], density: 'high', usageFrequency: 'daily', avoid: ['cyberpunk decoration'],
      },
    });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as any;
    expect(sc.candidates.map((c: any) => c.styleId)).toContain('runtime-signal');
    expect(sc.rejected.map((x: any) => x.styleId)).toContain('cyberpunk-glitch');
    expect(sc.rejected.find((x: any) => x.styleId === 'cyberpunk-glitch').reasonCodes).toContain('EXPLICITLY_AVOIDED');
    // text fallback present
    const text = (r.content as any[]).find((c) => c.type === 'text')?.text ?? '';
    expect(text).toContain('runtime-signal');
  });

  it('get_ui_state_plan: required states for checkout', async () => {
    const r = await client.callTool({ name: 'get_ui_state_plan', arguments: { surfaceId: 'checkout' } });
    const sc = r.structuredContent as any;
    expect(sc.required.map((s: any) => s.id)).toContain('payment-declined');
    expect(sc.implementationOrder.length).toBeGreaterThan(5);
  });

  it('get_design_principle_plan: returns placement and verification guidance with resource links', async () => {
    const repo = CatalogRepository.load();
    const principle = repo.data.designPrinciples.find((item) => item.references.length > 0)!;
    const r = await client.callTool({
      name: 'get_design_principle_plan',
      arguments: {
        principleIds: [principle.id],
        locale: 'ko',
      },
    });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as any;
    expect(sc.principles[0].id).toBe(principle.id);
    expect(sc.principles[0].categoryId).toBe(principle.category);
    expect(sc.principles[0].placement.length).toBeGreaterThan(0);
    expect(sc.principles[0].apply.length).toBeGreaterThan(0);
    expect(sc.principles[0].verify.length).toBeGreaterThan(0);
    expect(sc.principles[0].relatedDesignPrincipleIds).toBeDefined();
    expect(sc.principles[0].relatedUxPrincipleIds).toBeDefined();
    expect(sc.principles[0].references).toEqual(principle.references);
    expect(sc).not.toHaveProperty('attribution');
    const fallback = (r.content as any[]).find((item) => item.type === 'text')?.text ?? '';
    expect(fallback).toContain('# 디자인 원칙 계획');
    expect(fallback).toContain('- 배치:');
    expect(fallback).toContain('- 참고 자료:');
    expect(fallback).toContain(principle.references[0]!.publisher);
    expect(fallback).toContain('리소스:');
    expect((r.content as any[]).filter((item) => item.type === 'resource_link')).toHaveLength(1);
  });

  it('localizes the complete design-principle text fallback for Japanese', async () => {
    const principleId = CatalogRepository.load().data.designPrinciples[0]!.id;
    const r = await client.callTool({
      name: 'get_design_principle_plan',
      arguments: { principleIds: [principleId], locale: 'ja' },
    });
    const fallback = (r.content as any[]).find((item) => item.type === 'text')?.text ?? '';
    expect(fallback).toContain('# デザイン原則プラン');
    expect(fallback).toContain('- 関連性:');
    expect(fallback).toContain('- 設計上の問い:');
    expect(fallback).toContain('- 配置:');
    expect(fallback).toContain('リソース:');
    expect(fallback).not.toContain('- Relevance:');
    expect(fallback).not.toContain('- Placement:');
  });

  it('get_ux_principle_plan: returns a focused, evidence-labeled plan and resource links', async () => {
    const r = await client.callTool({
      name: 'get_ux_principle_plan',
      arguments: {
        outcomes: ['feedback'],
        surface: 'chat',
        phase: 'interaction',
        limit: 2,
      },
    });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as any;
    expect(sc.principles.map((principle: any) => principle.id))
      .toEqual(['doherty-threshold', 'postels-law']);
    expect(sc.principles[0].apply.length).toBeGreaterThan(0);
    expect(sc.principles[0].verify.length).toBeGreaterThan(0);
    expect(sc.principles[0].evidence.confidence).toBeTruthy();
    expect(sc.attribution.sourceLicense.name).toBe('CC BY-NC-ND 4.0');
    const fallback = (r.content as any[]).find((item) => item.type === 'text')?.text ?? '';
    expect(fallback).toContain('webstylebook://principles/doherty-threshold');
    expect((r.content as any[]).filter((item) => item.type === 'resource_link')).toHaveLength(2);
  });

  it('get_design_audit_plan: returns localized evidence contracts without multilingual policy payloads', async () => {
    const r = await client.callTool({
      name: 'get_design_audit_plan',
      arguments: {
        styleId: 'platform-core',
        surfaces: ['settings'],
        designPrincipleIds: ['explicit-labels-and-semantics'],
        uxPrincipleIds: ['mental-model'],
        includeDocumentation: false,
        locale: 'ko',
      },
    });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as any;
    expect(sc.verdicts.map((verdict: any) => verdict.id)).toContain('NOT_VERIFIED');
    expect(sc.evidenceRule).toMatch(/증거/);
    expect(sc.evidenceLegend.screenshot).toMatch(/스크린샷/);
    expect(sc.applicabilityLegend.always).toMatch(/검사/);
    expect(sc.checks.some((check: any) => check.id === 'opening-demonstrates-product')).toBe(false);
    expect(sc.checks.some((check: any) => check.applicability === 'workflow-only')).toBe(false);
    expect(sc.principles.design[0].id).toBe('explicit-labels-and-semantics');
    expect(sc.principles.ux[0].evidenceConfidence).toBeTruthy();
    expect(JSON.stringify(sc)).not.toContain('"ja":');
    const fallback = (r.content as any[]).find((item) => item.type === 'text')?.text ?? '';
    expect(fallback).toContain('# 디자인 감사 계획');
    expect(fallback).toContain('판정:');
    expect(fallback).toContain('NOT_VERIFIED');
    expect(fallback).toContain('keyboard-focus-is-visible');
    expect((r.content as any[]).some((item) => item.type === 'resource_link'
      && item.uri === 'webstylebook://styles/platform-core')).toBe(true);
  });

  it.each([
    ['ko', '# UX 원칙 계획', '- 관련성:', '- 설계 질문:', '리소스:'],
    ['ja', '# UX原則プラン', '- 関連性:', '- 設計上の問い:', 'リソース:'],
  ])('localizes the complete UX principle text fallback for %s', async (
    locale, title, relevance, question, resources,
  ) => {
    const r = await client.callTool({
      name: 'get_ux_principle_plan',
      arguments: { principleIds: ['working-memory'], locale },
    });
    const fallback = (r.content as any[]).find((item) => item.type === 'text')?.text ?? '';
    expect(fallback).toContain(title);
    expect(fallback).toContain(relevance);
    expect(fallback).toContain(question);
    expect(fallback).toContain(resources);
    expect(fallback).not.toContain('- Relevance:');
    expect(fallback).not.toContain('- Design question:');
  });

  it('compose_design_tokens: css-variables with contrast awareness', async () => {
    const r = await client.callTool({
      name: 'compose_design_tokens',
      arguments: { primaryStyleId: 'runtime-signal', format: 'css-variables', colorMode: 'dark' },
    });
    const sc = r.structuredContent as any;
    expect(sc.rendered).toContain('--color-canvas');
    expect(Array.isArray(sc.warnings)).toBe(true);
  });

  it('compare_design_directions: no single winner', async () => {
    const r = await client.callTool({
      name: 'compare_design_directions',
      arguments: { directions: [{ primaryStyleId: 'runtime-signal' }, { primaryStyleId: 'cyberpunk-glitch' }] },
    });
    const sc = r.structuredContent as any;
    expect(sc.directions).toHaveLength(2);
    expect(sc.note.toLowerCase()).toContain('no single winner');
  });

  it('unknown style id -> STYLE_NOT_FOUND with suggestions', async () => {
    const r = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'runtime-signl', format: 'json' } });
    expect(r.isError).toBe(true);
    const sc = r.structuredContent as any;
    expect(sc.error.code).toBe('STYLE_NOT_FOUND');
    expect(sc.suggestions).toContain('runtime-signal');
  });

  it('unknown surface -> STATE_SURFACE_NOT_FOUND', async () => {
    const r = await client.callTool({ name: 'get_ui_state_plan', arguments: { surfaceId: 'nope' } });
    expect(r.isError).toBe(true);
    expect((r.structuredContent as any).error.code).toBe('STATE_SURFACE_NOT_FOUND');
  });

  it('unknown design principle id -> DESIGN_PRINCIPLE_NOT_FOUND with suggestions', async () => {
    const principleId = CatalogRepository.load().data.designPrinciples[0]!.id;
    const nearMiss = `${principleId}x`;
    const r = await client.callTool({
      name: 'get_design_principle_plan',
      arguments: { principleIds: [nearMiss] },
    });
    expect(r.isError).toBe(true);
    const sc = r.structuredContent as any;
    expect(sc.error.code).toBe('DESIGN_PRINCIPLE_NOT_FOUND');
    expect(sc.suggestions).toContain(principleId);
  });

  it('design principle planner requires at least one selector', async () => {
    const r = await client.callTool({ name: 'get_design_principle_plan', arguments: {} });
    expect(r.isError).toBe(true);
    expect((r.structuredContent as any).error.code).toBe('INVALID_INPUT');
  });

  it('unknown UX principle id -> UX_PRINCIPLE_NOT_FOUND with suggestions', async () => {
    const r = await client.callTool({
      name: 'get_ux_principle_plan',
      arguments: { principleIds: ['hicks-lw'] },
    });
    expect(r.isError).toBe(true);
    const sc = r.structuredContent as any;
    expect(sc.error.code).toBe('UX_PRINCIPLE_NOT_FOUND');
    expect(sc.suggestions).toContain('hicks-law');
  });

  it('UX principle planner requires at least one selector', async () => {
    const r = await client.callTool({ name: 'get_ux_principle_plan', arguments: {} });
    expect(r.isError).toBe(true);
    expect((r.structuredContent as any).error.code).toBe('INVALID_INPUT');
  });

  it('avoiding every surviving style for a narrow product -> NO_COMPATIBLE_STYLE', async () => {
    // derive the surviving pool dynamically (robust to facet changes), then avoid all of it.
    const repo = CatalogRepository.load();
    const probe = recommendDesignDirection({ productType: 'consumer-app', productDescription: 'x' }, repo);
    const rejected = new Set(probe.rejected.map((r) => r.styleId));
    const survivors = repo.allStyles().map((s) => s.id).filter((id) => !rejected.has(id));
    expect(survivors.length).toBeGreaterThan(0);
    expect(survivors.length).toBeLessThanOrEqual(20); // must fit the avoid-array limit for this test
    const r = await client.callTool({ name: 'recommend_design_direction', arguments: { productType: 'consumer-app', productDescription: 'x', avoid: survivors } });
    expect(r.isError).toBe(true);
    const sc = r.structuredContent as any;
    expect(sc.error.code).toBe('NO_COMPATIBLE_STYLE');
    expect(sc.suggestions.length).toBeGreaterThan(0);
  });

  it('zod input validation rejects bad args', async () => {
    // candidateLimit out of range
    const r = await client.callTool({ name: 'recommend_design_direction', arguments: { productDescription: 'x', candidateLimit: 99 } }).catch((e) => ({ thrown: e }));
    // SDK may surface this as isError or a thrown protocol error; either is acceptable, but it must NOT silently succeed with 99 candidates
    if ('thrown' in (r as any)) { expect((r as any).thrown).toBeTruthy(); } else { expect((r as any).isError ?? false).toBeTruthy(); }
  });

  it('compose_design_tokens secondary overlay surfaces accentSecondary', async () => {
    const r = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'runtime-signal', secondaryStyleId: 'quiet-utility', format: 'json', colorMode: 'light' } });
    const sc = r.structuredContent as any;
    expect(sc.tokens.color.accentSecondary).toBeTruthy();
    expect(sc.notes.some((n: string) => n.includes('Secondary overlay'))).toBe(true);
  });

  it('empty / invalid accentOverride never produces a corrupt success (#1/#2)', async () => {
    for (const bad of ['', 'red', '#xyz']) {
      const r: any = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'brutalist-grid', format: 'css-variables', accentOverride: bad } }).catch((e) => ({ thrown: e }));
      if ('thrown' in r) { expect(r.thrown).toBeTruthy(); continue; } // schema rejected at protocol layer (-32602)
      // if it ever returns a result, it must be an error — NOT a success with an empty accent token
      expect(r.isError, `accentOverride='${bad}' should not succeed`).toBe(true);
      const code = (r.structuredContent as any)?.error?.code;
      if (code) expect(code).not.toBe('STYLE_NOT_FOUND'); // a color problem is not a missing style
      const text = (r.content as any[]).find((c) => c.type === 'text')?.text ?? '';
      expect(text).not.toContain('--color-accent: ;');
    }
  });

  it('lists 7 prompts and renders one', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([
      'audit-design-direction', 'audit-design-principles', 'audit-ux-principles',
      'complete-ui-states', 'design-product', 'design-screen', 'redesign-with-style',
    ]);
    const got = await client.getPrompt({ name: 'design-product', arguments: { product: 'SRE dashboard' } });
    expect(got.messages[0]!.content.type).toBe('text');
    expect((got.messages[0]!.content as any).text).toContain('recommend_design_direction');
    expect((got.messages[0]!.content as any).text).toContain('get_design_principle_plan');
    expect((got.messages[0]!.content as any).text).toContain('get_ux_principle_plan');
  });
});
