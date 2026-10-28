import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { createWebStylebookServer } from '../src/server.js';
import { FOUNDATIONS, FOUNDATION_IDENTITY, IMPROVEMENT_PROTOCOL, validateFoundations } from '../src/foundations/catalog.js';
import { FOUNDATION_SOURCES } from '../src/foundations/sources.js';
import { FOUNDATION_CATEGORIES, type FoundationPlanInput } from '../src/foundations/types.js';
import { FoundationPlanError, planDesignImprovement } from '../src/foundations/planner.js';
import { stableHashOf } from '../src/catalog/stable-hash.js';
import { UX_SURFACES } from '../src/types.js';

const repo = CatalogRepository.load();

describe('researched design foundations', () => {
  it('keeps source, translation, cross-reference and cross-surface content intact', () => {
    expect(validateFoundations(repo)).toEqual([]);
    expect(FOUNDATIONS).toHaveLength(24);
    expect(FOUNDATION_SOURCES).toHaveLength(30);
    expect(new Set(FOUNDATIONS.map((entry) => entry.category))).toEqual(new Set(FOUNDATION_CATEGORIES));
    expect(new Set(FOUNDATIONS.flatMap((entry) => entry.examples.map((example) => example.surface))))
      .toEqual(new Set(UX_SURFACES.filter((surface) => surface !== 'global')));
    const related = new Set(FOUNDATIONS.flatMap((entry) => entry.relatedPrincipleIds));
    expect(repo.allDesignPrinciples().filter((entry) => !related.has(entry.id)).map((entry) => entry.id)).toEqual([]);
    expect(FOUNDATION_IDENTITY.contentHash).toBe(stableHashOf({ foundations: FOUNDATIONS, sources: FOUNDATION_SOURCES, protocol: IMPROVEMENT_PROTOCOL }));
  });

  it('rejects missing exceptions, broken sources and incomplete standard attribution', () => {
    const content = structuredClone(FOUNDATIONS);
    (content[0]!.decisions[0] as any).instead = undefined;
    content[1]!.sourceIds = ['invented-source'];
    const sources = structuredClone(FOUNDATION_SOURCES);
    delete sources.find((source) => source.id === 'interaction-motion')!.standard;
    const errors = validateFoundations(repo, content, sources);
    expect(errors).toContain('priority-hierarchy.decisions.0.instead.ko missing translation');
    expect(errors).toContain('relational-grouping unknown source invented-source');
    expect(errors).toContain('source interaction-motion missing criterion/level');
  });

  it('distinguishes standards and exceptions instead of turning advice into universal thresholds', () => {
    expect(FOUNDATION_SOURCES.find((source) => source.id === 'interaction-motion')!.standard)
      .toEqual({ name: 'WCAG 2.2', criterion: '2.3.3', level: 'AAA' });
    expect(FOUNDATION_SOURCES.find((source) => source.id === 'target-size')!.standard?.level).toBe('AA');
    const plan = planDesignImprovement({ foundationIds: ['reading-measure', 'action-affordance', 'truthful-evidence'] });
    expect(plan.foundations[0]!.decisions[1]!.instead).toContain('not mandatory default');
    expect(plan.foundations[1]!.decisions[1]!.instead).toContain('listed exceptions');
    expect(plan.foundations[2]!.decisions[0]!.instead).toContain('do not ban');
    expect(plan.protocol.report).toContain('never invent user testing');
    expect(plan.protocol.comparisonConditions).toContain('same route, viewport, zoom, theme, locale, data, state');
  });
});

describe('retrieval across UI tasks', () => {
  // These are authored routing expectations, not evidence of better end-user UX.
  it.each([
    ['comparison table', { surface: 'data-table', concerns: ['scanability', 'consistency'] }, ['data-encoding', 'task-density', 'scannable-content']],
    ['form grouping', { surface: 'form', concerns: ['grouping', 'readability'] }, ['relational-grouping', 'labels-instructions']],
    ['multilingual chat', { surface: 'chat', concerns: ['readability', 'resilience'] }, ['language-resilience', 'reading-measure', 'scannable-content']],
    ['accessible settings', { surface: 'settings', concerns: ['accessibility', 'resilience'] }, ['action-affordance', 'error-recovery', 'responsive-composition']],
    ['purchase information', { surface: 'checkout', concerns: ['focus', 'readability'] }, ['truthful-evidence', 'labels-instructions']],
    ['editorial balance', { surface: 'landing-page', category: 'perception', concerns: ['balance'] }, ['visual-balance']],
  ] as Array<[string, FoundationPlanInput, string[]]>)('%s receives applicable decision content', (_name, input, expected) => {
    const plan = planDesignImprovement({ ...input, limit: 12, locale: 'ko' });
    expect(plan.foundations.map((entry) => entry.id)).toEqual(expect.arrayContaining(expected));
    for (const entry of plan.foundations) {
      expect(entry.surfaces.includes(input.surface!) || entry.surfaces.includes('global')).toBe(true);
      expect(entry.decisions.every((rule) => rule.when && rule.change && rule.instead)).toBe(true);
      expect(entry.examplesAre).toBe('illustrative-not-observed-results');
    }
  });

  it('does not invent fallback matches or bypass filters for explicit ids', () => {
    const plan = planDesignImprovement({ foundationIds: ['type-roles'], category: 'feedback' });
    expect(plan.foundations).toEqual([]);
    expect(plan.sources).toEqual([]);
    expect(plan.coverage.filteredRequestedIds).toEqual(['type-roles']);
    expect(plan.notice).toContain('No entry matches');
  });

  it('makes truncation and source coverage explicit and canonicalizes concern order', () => {
    const a = planDesignImprovement({ concerns: ['readability', 'focus'], limit: 2 });
    const b = planDesignImprovement({ concerns: ['focus', 'readability', 'focus'], limit: 2 });
    expect(a).toEqual(b);
    expect(a.coverage.matching).toBeGreaterThan(a.coverage.selected);
    expect(a.coverage.omittedIds).toHaveLength(a.coverage.matching - a.coverage.selected);
    expect(new Set(a.sources.map((source) => source.id)))
      .toEqual(new Set(a.foundations.flatMap((entry) => entry.sourceIds)));
    expect(a.sources).not.toHaveLength(FOUNDATION_SOURCES.length);
  });

  it.each(['en', 'ko', 'ja'] as const)('delivers complete %s guidance without bundling other translations', (locale) => {
    const result = planDesignImprovement({ foundationIds: ['relational-grouping'], locale });
    expect(result.foundations[0]!.name).toBe(FOUNDATIONS.find((entry) => entry.id === 'relational-grouping')!.name[locale]);
    expect(typeof result.sources[0]!.supports).toBe('string');
    expect(result.identity.planHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(JSON.stringify(result)).not.toContain('"ko":');
  });

  it.each([
    {}, { concerns: ['invented'] }, { surface: 'invented' }, { locale: 'fr' },
    { category: 'invented' }, { foundationIds: ['invented'] },
    { surface: 'form', limit: 0 }, { surface: 'form', limit: 13 }, { surface: 'form', limit: 1.5 },
  ])('rejects an invalid selector or budget: %j', (input) => {
    expect(() => planDesignImprovement(input as FoundationPlanInput)).toThrow(FoundationPlanError);
  });

  it('keeps default and maximum localized responses within bounded text budgets', () => {
    for (const locale of ['en', 'ko', 'ja'] as const) {
      for (const surface of UX_SURFACES) {
        const plan = planDesignImprovement({ surface, locale });
        expect(Buffer.byteLength(JSON.stringify(plan, null, 2))).toBeLessThan(64 * 1024);
      }
      const plan = planDesignImprovement({ concerns: ['accessibility', 'readability', 'resilience'], locale, limit: 12 });
      expect(Buffer.byteLength(JSON.stringify(plan, null, 2))).toBeLessThan(96 * 1024);
    }
  });
});

describe('design knowledge over MCP', () => {
  let client: Client;
  let server: ReturnType<typeof createWebStylebookServer>;
  beforeAll(async () => {
    server = createWebStylebookServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'foundations-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });
  afterAll(async () => { await client?.close(); await server?.close(); });

  it('makes knowledge, provenance and the new tool discoverable without rewriting canonical domains', async () => {
    const [manifestResource, indexResource, sourcesResource, tools] = await Promise.all([
      client.readResource({ uri: 'webstylebook://manifest' }),
      client.readResource({ uri: 'webstylebook://foundations' }),
      client.readResource({ uri: 'webstylebook://foundations/sources' }),
      client.listTools(),
    ]);
    const parse = (resource: typeof indexResource) => JSON.parse(resource.contents[0]!.text as string);
    const manifest = parse(manifestResource);
    expect(manifest.designFoundations.contentHash).toBe(FOUNDATION_IDENTITY.contentHash);
    expect(manifest.contentHash).toBe(repo.contentHash);
    const index = parse(indexResource);
    expect(index.entries).toHaveLength(24);
    expect(index.entries[0].decisions).toBeUndefined();
    expect(parse(sourcesResource).sources).toHaveLength(30);
    expect(tools.tools.find((tool) => tool.name === 'get_design_improvement_plan')!.annotations?.readOnlyHint).toBe(true);
    expect(client.getInstructions()).toContain('validate_design_improvement_result');
    expect(client.getInstructions()).not.toContain('first ask two short questions');
  });

  it('keeps conditional changes, counterexamples and sources in the text-only fallback', async () => {
    const result = await client.callTool({ name: 'get_design_improvement_plan', arguments: { foundationIds: ['task-density'], locale: 'ko' } });
    expect(result.isError).not.toBe(true);
    const textBlock = (result.content as Array<{ type: string; text?: string }>).find((block) => block.type === 'text')!.text!;
    const fallback = JSON.parse(textBlock.split('\n\nResources:')[0]!);
    expect(fallback).toEqual(result.structuredContent);
    expect(fallback.foundations[0].decisions[0].instead).toContain('비용');
    expect(result.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'resource_link', uri: 'webstylebook://foundations/task-density?locale=ko' })]));
    const resource = await client.readResource({ uri: fallback.foundations[0].resourceUri });
    const detail = JSON.parse(resource.contents[0]!.text as string);
    const { match: _match, ...foundation } = fallback.foundations[0];
    expect(detail.foundation).toEqual(foundation);
    expect(detail.sources).toEqual(fallback.sources);
  });

  it('reports unknown ids and rejects invalid resource locale parameters', async () => {
    const missing = await client.callTool({ name: 'get_design_improvement_plan', arguments: { foundationIds: ['task-densit'] } });
    expect(missing.isError).toBe(true);
    expect((missing.structuredContent as any).error.code).toBe('FOUNDATION_NOT_FOUND');
    expect((missing.structuredContent as any).suggestions).toContain('task-density');
    for (const query of ['locale=xx', 'locale=ko&locale=en', 'mode=dark']) {
      const result = await client.readResource({ uri: `webstylebook://foundations/task-density?${query}` });
      expect(JSON.parse(result.contents[0]!.text as string).error.code).toBe('INVALID_INPUT');
    }
  });
});
