import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { composeDesignTokens, type ComposeDesignTokensInput } from '../src/tokens/compile.js';
import { planDesignAudit } from '../src/audit/planner.js';

const repo = CatalogRepository.load();
const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT = { schema: 'webstylebook.visual.v1' };
const ORDER = ['Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts"];
const DIM = /^-?\d*\.?\d+(px|em|rem)$/;
const md = (input: Omit<ComposeDesignTokensInput, 'format'>) => composeDesignTokens({ ...input, format: 'design-md' }, repo);

type Tree = { [key: string]: string | number | Tree };
function yaml(source: string): Tree {
  const root: Tree = {};
  const stack: Array<{ indent: number; node: Tree }> = [{ indent: -1, node: root }];
  for (const line of source.split('\n')) {
    if (!line.trim()) continue;
    const m = /^( *)("(?:[^"\\]|\\.)*"|[A-Za-z_][\w-]*): ?(.*)$/.exec(line);
    if (!m) throw new Error(`bad YAML line: ${line}`);
    const indent = m[1]!.length;
    while (stack.at(-1)!.indent >= indent) stack.pop();
    const parent = stack.at(-1)!.node;
    const key = m[2]!.startsWith('"') ? JSON.parse(m[2]!) as string : m[2]!;
    if (key in parent) throw new Error(`duplicate key ${key}`);
    const raw = m[3]!;
    if (raw === '') { const child: Tree = {}; parent[key] = child; stack.push({ indent, node: child }); continue; }
    if (/^[#&*!|>%@`]/.test(raw) || / #/.test(raw)) throw new Error(`unsafe plain scalar: ${raw}`);
    parent[key] = raw.startsWith('"') ? JSON.parse(raw) as string : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  }
  return root;
}

function split(content: string) {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(content);
  if (!fm) throw new Error('no front matter');
  const body = content.slice(fm[0].length);
  const blocks = [...body.matchAll(/^```yaml\n([\s\S]*?)\n```$/gm)].map((x) => ({ at: x.index!, tree: yaml(x[1]!) }));
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((x) => ({ at: x.index!, name: x[1]! }));
  const front = yaml(fm[1]!);
  const tree: Tree = {};
  for (const t of [front, ...blocks.map((b) => b.tree)]) for (const [k, v] of Object.entries(t)) {
    if (k in tree) throw new Error(`top-level key ${k} defined twice`);
    tree[k] = v;
  }
  return { front, body, blocks, headings, tree };
}

describe('review: compose_design_tokens format "design-md"', () => {
  it('returns the documented output shape', () => {
    const r = md({ primaryStyleId: 'brutalist-grid', contract: CONTRACT });
    expect(r).toMatchObject({ format: 'design-md', fileName: 'DESIGN.md', specVersion: 'alpha' });
    expect(typeof r.content).toBe('string');
    expect(Array.isArray(r.sections) && Array.isArray(r.omitted) && Array.isArray(r.lossy)).toBe(true);
    expect(r.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it.each(['front-matter', 'interleaved'] as const)('%s placement follows the spec layout for every style, locale, and contract mode', (placement) => {
    for (const style of repo.allStyles()) for (const locale of ['en', 'ko', 'ja'] as const) for (const contract of [true, false]) {
      const r = md({ primaryStyleId: style.id, locale, ...(contract ? { contract: CONTRACT } : {}), designMd: { tokenPlacement: placement } });
      const { front, blocks, headings, tree } = split(r.content);
      const names = headings.map((h) => h.name);
      expect(names).toEqual(r.sections);
      expect(names).toEqual(ORDER.filter((n) => names.includes(n)));
      expect([...names, ...r.omitted.map((o) => o.section)].sort()).toEqual([...ORDER].sort());
      expect(tree.version).toBe('alpha');
      expect('omitted' in tree).toBe(false);
      if (placement === 'front-matter') {
        expect(blocks).toEqual([]);
        expect(Object.keys(front)).toEqual(['version', 'name', 'description', 'colors', 'typography', 'rounded', 'spacing', 'components']);
      } else {
        expect(Object.keys(front)).toEqual(['name', 'description']);
        const home: Record<string, string> = { version: 'Overview', colors: 'Colors', typography: 'Typography', spacing: 'Layout', rounded: 'Shapes', components: 'Components' };
        for (const b of blocks) for (const k of Object.keys(b.tree)) expect([k, headings.filter((h) => h.at < b.at).at(-1)?.name]).toEqual([k, home[k]]);
      }
      const get = (path: string) => path.split('.').reduce<unknown>((o, p) => (o && typeof o === 'object' ? (o as Tree)[p] : undefined), tree);
      for (const props of Object.values(tree.components as Tree)) for (const v of Object.values(props as Tree)) {
        const ref = /^\{(.+)\}$/.exec(String(v));
        expect(ref, String(v)).not.toBeNull();
        expect(['string', 'number']).toContain(typeof get(ref![1]!));
      }
      for (const level of Object.values(tree.typography as Tree) as Tree[]) {
        if (level.fontSize !== undefined) expect(String(level.fontSize)).toMatch(DIM);
        if (level.letterSpacing !== undefined) expect(String(level.letterSpacing)).toMatch(DIM);
        if (level.lineHeight !== undefined) expect(typeof level.lineHeight === 'number' || DIM.test(String(level.lineHeight))).toBe(true);
      }
      for (const group of ['rounded', 'spacing']) for (const v of Object.values(tree[group] as Tree)) expect(String(v)).toMatch(DIM);
      expect((tree.colors as Tree).primary).toBeTruthy();
    }
  });

  it('is byte-identical for the same input and the hash ignores key order and explicit defaults', () => {
    const a = md({ primaryStyleId: 'editorial-silence', locale: 'ja', designMd: { productType: 'content-editorial' } });
    const b = md({ designMd: { productType: 'content-editorial', includeProse: true, tokenPlacement: 'front-matter' }, locale: 'ja', primaryStyleId: 'editorial-silence' });
    expect(b.content).toBe(a.content);
    expect(b.sourceHash).toBe(a.sourceHash);
    const c = md({ primaryStyleId: 'editorial-silence', locale: 'en', designMd: { productType: 'content-editorial' } });
    expect(c.sourceHash).not.toBe(a.sourceHash);
  });

  it('sourceHash does not depend on the server version (decision 7)', () => {
    const src = readFileSync(join(here, '../src/tokens/design-md.ts'), 'utf8');
    expect(src).not.toMatch(/SERVER_VERSION|server-info/);
  });

  it('dark-only requests add no lossy dark entry and say which theme the file describes (decision 6); both adds one', () => {
    const darkCapable = repo.allStyles().find((s) => {
      try { md({ primaryStyleId: s.id, contract: CONTRACT, colorMode: 'both' }); return true; } catch { return false; }
    })!;
    expect(darkCapable).toBeTruthy();
    const dark = md({ primaryStyleId: darkCapable.id, contract: CONTRACT, colorMode: 'dark' });
    expect(dark.lossy.some((l) => /dark theme/i.test(l))).toBe(false);
    expect(dark.content).toMatch(/This file describes the dark theme/);
    const both = md({ primaryStyleId: darkCapable.id, contract: CONTRACT, colorMode: 'both' });
    expect(both.lossy.some((l) => /^Dark theme/.test(l))).toBe(true);
    expect(both.content).toMatch(/This file describes the light theme/);
  });

  it('always reports status colors and motion as lossy', () => {
    for (const contract of [true, false]) {
      const r = md({ primaryStyleId: 'quiet-utility', ...(contract ? { contract: CONTRACT } : {}) });
      expect(r.lossy.some((l) => l.startsWith('Status colors'))).toBe(true);
      expect(r.lossy.some((l) => l.startsWith('Motion'))).toBe(true);
    }
  });

  it('includeProse false with front-matter lists the prose-only sections in omitted, without a YAML omitted key (decision 4)', () => {
    const r = md({ primaryStyleId: 'brutalist-grid', designMd: { includeProse: false, includeStructure: false } });
    expect(r.omitted.map((o) => o.section)).toEqual(expect.arrayContaining(['Overview', 'Colors', 'Typography', 'Shapes', 'Components', 'Layout']));
    expect(r.omitted.every((o) => o.reason.length > 0)).toBe(true);
    expect(r.content).not.toMatch(/^omitted:/m);
  });

  it('includeDoDont false omits that section; includeStructure toggles the page structure; productType adds must-haves', () => {
    const noDo = md({ primaryStyleId: 'brutalist-grid', designMd: { includeDoDont: false } });
    expect(noDo.sections).not.toContain("Do's and Don'ts");
    expect(noDo.omitted.find((o) => o.section === "Do's and Don'ts")?.reason).toMatch(/includeDoDont/);
    const withPt = md({ primaryStyleId: 'brutalist-grid', designMd: { productType: 'commerce' } });
    expect(withPt.content).toMatch(/### Must-haves on/);
    const noStructure = md({ primaryStyleId: 'brutalist-grid', designMd: { productType: 'commerce', includeStructure: false } });
    expect(noStructure.content).not.toMatch(/### Must-haves on|### Page structure/);
  });

  it('Do\'s and Don\'ts carry style rules and global anti-patterns', () => {
    const r = md({ primaryStyleId: 'brutalist-grid' });
    const section = r.content.split("## Do's and Don'ts")[1]!;
    expect(section).toMatch(/- Do: .*\(style rule [\w-]+\)/);
    expect(section).toMatch(/- Don't: .*\(pattern [\w-]+\)/);
  });

  it('a fusion (secondaryStyleId) exports and names both styles', () => {
    const r = md({ primaryStyleId: 'quiet-utility', secondaryStyleId: 'brutalist-grid' });
    expect(split(r.content).front.name).toMatch(/quiet-utility \+ brutalist-grid/);
  });

  it('rejects designMd with another format', () => {
    expect(() => composeDesignTokens({ primaryStyleId: 'quiet-utility', format: 'json', designMd: {} }, repo)).toThrow(/designMd/);
  });

  it('color values are hex (issue #17 conversion rule "colors.<name>: hex")', () => {
    const offenders: string[] = [];
    for (const style of repo.allStyles()) for (const contract of [true, false]) {
      const r = md({ primaryStyleId: style.id, ...(contract ? { contract: CONTRACT } : {}) });
      for (const [k, v] of Object.entries(split(r.content).tree.colors as Tree)) {
        if (!/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(v))) offenders.push(`${style.id}${contract ? '' : ' (legacy)'} ${k}=${v}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('review: MCP surface for #17/#18', () => {
  let client: Client;
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    client = new Client({ name: 'review', version: '0.0.0' });
    await client.connect(b);
  });

  it('registers compare_page_revisions read-only and closed-world, and no tool has an outputSchema', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'compare_page_revisions')!;
    expect(tool).toBeTruthy();
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    expect(tool.annotations?.destructiveHint ?? false).toBe(false);
    expect(tools.filter((t) => t.outputSchema)).toEqual([]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it('compose_design_tokens design-md over MCP returns the file in structured content and text', async () => {
    const res = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'brutalist-grid', format: 'design-md', contract: CONTRACT, designMd: { tokenPlacement: 'interleaved' } } });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { content: string; fileName: string };
    expect(sc.fileName).toBe('DESIGN.md');
    const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain(sc.content.trimEnd());
  });

  it('rejects designMd with a non-design-md format over MCP', async () => {
    const res = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'brutalist-grid', format: 'json', designMd: {} } });
    expect(res.isError).toBe(true);
  });

  it('serves webstylebook://design-md/{id} identical to the tool output, with query parameters', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.some((t) => t.uriTemplate === 'webstylebook://design-md/{styleId}')).toBe(true);
    const plain = await client.readResource({ uri: 'webstylebook://design-md/brutalist-grid' });
    expect(plain.contents[0]!.mimeType).toBe('text/markdown');
    expect((plain.contents[0] as { text: string }).text).toBe(md({ primaryStyleId: 'brutalist-grid', contract: CONTRACT }).content);
    const ko = await client.readResource({ uri: 'webstylebook://design-md/brutalist-grid?locale=ko&placement=interleaved' });
    expect((ko.contents[0] as { text: string }).text).toBe(md({ primaryStyleId: 'brutalist-grid', contract: CONTRACT, locale: 'ko', designMd: { tokenPlacement: 'interleaved' } }).content);
    const bad = await client.readResource({ uri: 'webstylebook://design-md/brutalist-grid?locale=fr' });
    expect((bad.contents[0] as { text: string }).text).toMatch(/INVALID_INPUT/);
    const missing = await client.readResource({ uri: 'webstylebook://design-md/no-such-style' }).catch((e: Error) => e);
    expect(missing instanceof Error ? missing.message : JSON.stringify(missing)).toMatch(/not.?found|NOT_FOUND|no-such-style/i);
  });

  it('compare_page_revisions over MCP rejects a missing after side and returns results that validate', async () => {
    const bad = await client.callTool({ name: 'compare_page_revisions', arguments: { before: { html: '<p>x</p>' } } });
    expect(bad.isError).toBe(true);
    const html = '<!doctype html><html><body><nav><a href="/a">A</a></nav><main><h1>T</h1></main></body></html>';
    const res = await client.callTool({ name: 'compare_page_revisions', arguments: { before: { html }, after: { html: html.replace('<a href="/a">A</a>', '') }, targetId: 'home' } });
    const sc = res.structuredContent as { verdict: string; evidence: unknown[]; results: unknown[] };
    expect(sc.verdict).toBe('FIX_NOW');
    const v = await client.callTool({ name: 'validate_design_audit_result', arguments: { plan: { revisionPreservation: true }, targets: [{ id: 'home', surface: 'global' }], evidence: sc.evidence, results: sc.results } });
    expect(v.isError).toBeFalsy();
    expect((v.structuredContent as { valid: boolean }).valid).toBe(true);
  });
});

describe('review: revisionPreservation plans (decision 1)', () => {
  it('holds only redesign-kept checks in structure/behavior; the must-have check needs productType', () => {
    const plan = planDesignAudit({ revisionPreservation: true }, repo);
    expect(plan.checks.length).toBeGreaterThan(0);
    expect(plan.checks.every((c) => c.id.startsWith('redesign-kept-') && ['structure', 'behavior'].includes(c.groupId))).toBe(true);
    expect(plan.checks.some((c) => c.id === 'redesign-kept-must-haves')).toBe(false);
    const withPt = planDesignAudit({ revisionPreservation: true, productType: 'commerce' }, repo);
    expect(withPt.checks.some((c) => c.id === 'redesign-kept-must-haves')).toBe(true);
  });

  it('revisionPreservation false or absent leaves the plan hash unchanged; a non-revision group with the flag is rejected', () => {
    const base = planDesignAudit({}, repo).identity.planHash;
    expect(planDesignAudit({ revisionPreservation: false }, repo).identity.planHash).toBe(base);
    expect(() => planDesignAudit({ revisionPreservation: true, includeGroups: ['layout'] }, repo)).toThrow();
  });

  it('a revision plan with includeGroups ["behavior"] still validates compare results only for its own checks', () => {
    const plan = planDesignAudit({ revisionPreservation: true, includeGroups: ['behavior'] }, repo);
    expect(plan.checks.every((c) => c.groupId === 'behavior')).toBe(true);
  });
});
