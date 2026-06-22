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
  it('exposes exactly the 4 compute tools, all read-only', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'compare_design_directions', 'compose_design_tokens', 'get_ui_state_plan', 'recommend_design_direction',
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('lists fixed resources and templates', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('webstylebook://manifest');
    expect(uris).toContain('webstylebook://styles');
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toContain('webstylebook://styles/{styleId}');
  });

  it('reads the manifest resource', async () => {
    const res = await client.readResource({ uri: 'webstylebook://manifest' });
    const body = JSON.parse(res.contents[0]!.text as string);
    expect(body.counts.styles).toBe(48);
    expect(body.tools).toHaveLength(4);
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

  it('lists 5 prompts and renders one', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([
      'audit-design-direction', 'complete-ui-states', 'design-product', 'design-screen', 'redesign-with-style',
    ]);
    const got = await client.getPrompt({ name: 'design-product', arguments: { product: 'SRE dashboard' } });
    expect(got.messages[0]!.content.type).toBe('text');
    expect((got.messages[0]!.content as any).text).toContain('recommend_design_direction');
  });
});
