import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { composeDesignTokens, TokenError, type ComposeDesignTokensInput } from '../src/tokens/compile.js';
import { DESIGN_MD_SECTIONS } from '../src/tokens/design-md.js';
import { LANGS } from '../src/types.js';

const repo = CatalogRepository.load();
const contract = { schema: 'webstylebook.visual.v1' };
const designMd = (input: Omit<ComposeDesignTokensInput, 'format'>) => composeDesignTokens({ ...input, format: 'design-md' }, repo);

type Tree = { [key: string]: string | number | Tree };

/** Parses the block-map YAML subset the exporter writes; anything else throws. */
function parseYaml(source: string): Tree {
  const root: Tree = {};
  const stack: Array<{ indent: number; map: Tree }> = [{ indent: -1, map: root }];
  for (const line of source.split('\n')) {
    if (!line.trim()) continue;
    const match = /^( *)("(?:[^"\\]|\\.)*"|[A-Za-z_][\w-]*):(?: (.*))?$/.exec(line);
    if (!match) throw new Error(`unexpected YAML line: ${line}`);
    const indent = match[1]!.length;
    while (stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]!.map;
    const key = match[2]!.startsWith('"') ? JSON.parse(match[2]!) as string : match[2]!;
    if (key in parent) throw new Error(`duplicate key ${key}`);
    const raw = match[3];
    if (raw === undefined) {
      const child: Tree = {};
      parent[key] = child;
      stack.push({ indent, map: child });
    } else {
      parent[key] = raw.startsWith('"') ? JSON.parse(raw) as string : /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw;
    }
  }
  return root;
}

/** Front matter and every ```yaml block merged into one tree, as the DESIGN.md spec reads them. */
function readDesignMd(content: string) {
  const front = /^---\n([\s\S]*?)\n---\n/.exec(content);
  if (!front) throw new Error('missing front matter');
  const blocks = [front[1]!, ...[...content.matchAll(/```yaml\n([\s\S]*?)\n```/g)].map((m) => m[1]!)];
  const tree: Tree = {};
  for (const block of blocks) {
    for (const [key, value] of Object.entries(parseYaml(block))) {
      if (key in tree) throw new Error(`top-level key ${key} is defined twice`);
      tree[key] = value;
    }
  }
  const headings = [...content.matchAll(/^## (.+)$/gm)].map((m) => m[1]!);
  return { tree, headings };
}

function leaves(tree: Tree, prefix = ''): Array<[string, string | number]> {
  return Object.entries(tree).flatMap(([key, value]) => (typeof value === 'object' ? leaves(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value] as [string, string | number]]));
}

const DIMENSION = /^-?\d*\.?\d+(?:px|em|rem)$/;
const COLOR = /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\))$/i;

function expectSpecShape(content: string, sections: readonly string[]) {
  const { tree, headings } = readDesignMd(content);
  expect(tree.version).toBe('alpha');
  expect(typeof tree.name).toBe('string');
  expect(headings).toEqual(sections);
  expect(headings).toEqual(DESIGN_MD_SECTIONS.filter((section) => headings.includes(section)));
  const colors = tree.colors as Tree;
  expect(colors.primary).toBeDefined();
  for (const [path, value] of leaves(colors)) expect(String(value), path).toMatch(COLOR);
  for (const [path, value] of leaves(tree.typography as Tree)) {
    if (/\.(?:fontSize|letterSpacing)$/.test(path)) expect(value, path).toMatch(DIMENSION);
    if (/\.(?:fontWeight|lineHeight)$/.test(path)) expect(typeof value, path).toBe('number');
  }
  for (const group of ['rounded', 'spacing']) {
    for (const [path, value] of leaves(tree[group] as Tree)) expect(value, `${group}.${path}`).toMatch(DIMENSION);
  }
  const flat = new Map(leaves(tree));
  for (const [path, value] of leaves(tree.components as Tree)) {
    const ref = /^\{(.+)\}$/.exec(String(value));
    expect(ref, `${path} is a token reference`).not.toBeNull();
    expect(flat.has(ref![1]!), `${path} → ${ref![1]}`).toBe(true);
  }
  return tree;
}

const GOLDENS: Array<[string, Omit<ComposeDesignTokensInput, 'format'>]> = [
  ['editorial-silence.legacy.en', { primaryStyleId: 'editorial-silence', designMd: { productType: 'content-editorial' } }],
  ['brutalist-grid.interleaved.ko', { primaryStyleId: 'brutalist-grid', contract, locale: 'ko', designMd: { tokenPlacement: 'interleaved', productType: 'developer-tool' } }],
  ['neumorphism.both.ja', { primaryStyleId: 'neumorphism', contract, colorMode: 'both', locale: 'ja' }],
  ['fusion-grain-mono.dark.en', { primaryStyleId: 'fusion-grain-mono', contract, colorMode: 'dark', designMd: { productType: 'portfolio' } }],
  ['quiet-utility+brutalist-grid.legacy.en', { primaryStyleId: 'quiet-utility', secondaryStyleId: 'brutalist-grid', designMd: { productType: 'operational-saas' } }],
];

describe('DESIGN.md golden files', () => {
  it.each(GOLDENS)('%s', async (name, input) => {
    const result = designMd(input);
    await expect(result.content).toMatchFileSnapshot(`fixtures/design-md/${name}.md`);
    const { content: _content, ...meta } = result;
    await expect(`${JSON.stringify(meta, null, 2)}\n`).toMatchFileSnapshot(`fixtures/design-md/${name}.json`);
    expectSpecShape(result.content, result.sections);
  });

  it('covers both placements, all three locales, a secondary overlay, a fusion style, and a two-mode request', () => {
    const inputs = GOLDENS.map(([, input]) => input);
    expect(new Set(inputs.map((input) => input.designMd?.tokenPlacement ?? 'front-matter'))).toEqual(new Set(['front-matter', 'interleaved']));
    expect(new Set(inputs.map((input) => input.locale ?? 'en'))).toEqual(new Set(LANGS));
    expect(inputs.some((input) => input.secondaryStyleId)).toBe(true);
    expect(inputs.some((input) => repo.getStyle(input.primaryStyleId)?.kind === 'fusion')).toBe(true);
    expect(inputs.some((input) => input.colorMode === 'both')).toBe(true);
  });
});

describe('DESIGN.md format', () => {
  it.each(repo.allStyles().map((style) => style.id))('%s follows the spec in both placements, with and without a contract', (styleId) => {
    for (const tokenPlacement of ['front-matter', 'interleaved'] as const) {
      for (const base of [{}, { contract }]) {
        const result = designMd({ primaryStyleId: styleId, ...base, designMd: { tokenPlacement } });
        expectSpecShape(result.content, result.sections);
        expect(result.sections.length + result.omitted.length).toBe(DESIGN_MD_SECTIONS.length);
      }
    }
  });

  it('puts every token in the front matter, or only name and description there when interleaved', () => {
    const front = designMd({ primaryStyleId: 'brutalist-grid', contract });
    const head = /^---\n([\s\S]*?)\n---\n/.exec(front.content)![1]!;
    expect(Object.keys(parseYaml(head))).toEqual(['version', 'name', 'description', 'colors', 'typography', 'rounded', 'spacing', 'components']);
    expect(front.content).not.toContain('```yaml');

    const interleaved = designMd({ primaryStyleId: 'brutalist-grid', contract, designMd: { tokenPlacement: 'interleaved' } });
    expect(Object.keys(parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(interleaved.content)![1]!))).toEqual(['name', 'description']);
    const blockKeys = [...interleaved.content.matchAll(/## (.+)\n[\s\S]*?```yaml\n(\w+):/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(blockKeys).toEqual(['Overview:version', 'Colors:colors', 'Typography:typography', 'Layout:spacing', 'Shapes:rounded', 'Components:components']);
    expect(readDesignMd(interleaved.content).tree).toEqual(readDesignMd(front.content).tree);
  });

  it('returns the same bytes and hash for the same input, and a new hash for a new input', () => {
    const input = { primaryStyleId: 'fusion-neon-swiss', contract, locale: 'ja' as const, designMd: { productType: 'campaign' as const } };
    const a = designMd(input);
    const b = designMd(structuredClone(input));
    expect(b.content).toBe(a.content);
    expect(b.sourceHash).toBe(a.sourceHash);
    expect(a.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(designMd({ ...input, locale: 'ko' }).sourceHash).not.toBe(a.sourceHash);
    expect(designMd({ ...input, designMd: { tokenPlacement: 'interleaved' } }).sourceHash).not.toBe(a.sourceHash);
  });

  it('maps color roles to DESIGN.md names and points each component at real tokens', () => {
    const result = designMd({ primaryStyleId: 'quiet-utility', contract });
    const { tree } = readDesignMd(result.content);
    const spec = composeDesignTokens({ primaryStyleId: 'quiet-utility', contract, format: 'json' }, repo).visualContract as { colors: Record<string, string> };
    const colors = tree.colors as Tree;
    expect(colors.primary).toBe(spec.colors.text);
    expect(colors.surface).toBe(spec.colors.canvas);
    expect(colors.accent).toBe(spec.colors.accent);
    expect(colors['on-accent']).toBe(spec.colors.accentText);
    expect(colors).not.toHaveProperty('positive');
    expect((tree.components as Tree)['button-primary']).toEqual({ backgroundColor: '{colors.action-primary}', textColor: '{colors.on-action-primary}' });
  });

  it('keeps fluid type at its maximum and reports what DESIGN.md cannot hold', () => {
    const result = designMd({ primaryStyleId: 'brutalist-grid', contract });
    const spec = composeDesignTokens({ primaryStyleId: 'brutalist-grid', contract, format: 'json' }, repo).visualContract as { typography: { roles: Record<string, { sizeMaxRem: number }> } };
    expect(((readDesignMd(result.content).tree.typography as Tree).display as Tree).fontSize).toBe(`${spec.typography.roles.display!.sizeMaxRem}rem`);
    expect(result.lossy.some((item) => item.startsWith('Status colors'))).toBe(true);
    expect(result.lossy.some((item) => item.startsWith('Motion'))).toBe(true);
    expect(result.lossy.some((item) => item.includes('fluid size minimums'))).toBe(true);
    expect(result.lossy.some((item) => item.startsWith('Dark theme'))).toBe(false);
    expect(designMd({ primaryStyleId: 'neumorphism', contract, colorMode: 'both' }).lossy[0]).toMatch(/^Dark theme/);
  });

  it('omits Elevation & Depth for a style without shadows and lists shadows when there are some', () => {
    const flat = designMd({ primaryStyleId: 'brutalist-grid', contract });
    expect(flat.sections).not.toContain('Elevation & Depth');
    expect(flat.omitted).toEqual([{ section: 'Elevation & Depth', reason: expect.stringContaining('no shadows') }]);
    const soft = designMd({ primaryStyleId: 'neumorphism', contract });
    expect(soft.sections).toContain('Elevation & Depth');
    expect(soft.content).toMatch(/## Elevation & Depth\n\n[^\n]+\n\n- \*\*sm\*\*: `[^`]+`/);
  });

  it('honors includeProse, includeDoDont, includeStructure, and productType', () => {
    const bare = designMd({ primaryStyleId: 'editorial-silence', designMd: { includeProse: false } });
    expect(bare.sections).toEqual(['Layout', "Do's and Don'ts"]);
    expect(bare.omitted.map((entry) => entry.section)).toEqual(['Overview', 'Colors', 'Typography', 'Elevation & Depth', 'Shapes', 'Components']);
    expectSpecShape(bare.content, bare.sections);

    const noRules = designMd({ primaryStyleId: 'editorial-silence', designMd: { includeDoDont: false } });
    expect(noRules.omitted).toContainEqual({ section: "Do's and Don'ts", reason: 'includeDoDont is false.' });

    const noStructure = designMd({ primaryStyleId: 'editorial-silence', designMd: { includeStructure: false, productType: 'commerce' } });
    expect(noStructure.content).not.toContain('### Page structure');
    expect(noStructure.content).not.toContain('Must-haves');

    const commerce = designMd({ primaryStyleId: 'editorial-silence', designMd: { productType: 'commerce' } });
    expect(commerce.content).toContain('### Page structure');
    for (const name of ['Price', 'Variant choice', 'Add to cart']) expect(commerce.content).toContain(`**${name}**`);
    expect(designMd({ primaryStyleId: 'editorial-silence', designMd: { productType: 'other' } }).content).toContain('No must-haves are defined for productType "other".');
  });

  it("builds Do's and Don'ts from the style's bans and the global patterns it does not allow", () => {
    const result = designMd({ primaryStyleId: 'brutalist-grid' });
    const rules = result.content.split("## Do's and Don'ts\n\n")[1]!.trim().split('\n');
    expect(rules.filter((line) => line.startsWith('- Do: ')).map((line) => /style rule ([\w-]+)/.exec(line)?.[1])).toEqual(['shadow-blur', 'gradient-fill', 'corner-radius']);
    expect(rules.filter((line) => line.startsWith("- Don't: "))).toHaveLength(9);
  });

  it('writes prose in the requested locale and keeps the spec headings in English', () => {
    for (const [locale, phrase] of [['en', 'Generated by web-stylebook-mcp'], ['ko', 'web-stylebook-mcp가'], ['ja', 'web-stylebook-mcpが']] as const) {
      const result = designMd({ primaryStyleId: 'swiss-poster', contract, locale });
      expect(result.content).toContain(phrase);
      expect(readDesignMd(result.content).headings[0]).toBe('Overview');
    }
  });

  it('rejects designMd options for the other formats and leaves those formats unchanged', () => {
    expect(() => composeDesignTokens({ primaryStyleId: 'quiet-utility', format: 'json', designMd: {} }, repo)).toThrow(TokenError);
    const json = composeDesignTokens({ primaryStyleId: 'quiet-utility', format: 'json' }, repo);
    expect(json).toHaveProperty('rendered');
    expect(json).not.toHaveProperty('content');
    expect(json).not.toHaveProperty('lossy');
  });
});

describe('DESIGN.md over MCP', () => {
  let client: Client;
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'design-md-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  it('returns the file as structured content and as a text fallback', async () => {
    const res = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'brutalist-grid', format: 'design-md', contract, designMd: { tokenPlacement: 'interleaved' } } });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as { content: string; fileName: string; specVersion: string };
    expect(sc.fileName).toBe('DESIGN.md');
    expect(sc.specVersion).toBe('alpha');
    const textOut = (res.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')!.text!;
    expect(textOut).toContain(`\`\`\`\`markdown\n${sc.content.trimEnd()}\n\`\`\`\``);
  });

  it('rejects designMd with another format and an unknown option', async () => {
    const wrongFormat = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'brutalist-grid', format: 'json', designMd: {} } });
    expect(wrongFormat.isError).toBe(true);
    expect((wrongFormat.structuredContent as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
    const unknown = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'brutalist-grid', format: 'design-md', designMd: { yamlOnly: true } } });
    expect(unknown.isError).toBe(true);
  });

  it('serves webstylebook://design-md/{id} with the same text the tool returns in contract mode', async () => {
    const res = await client.readResource({ uri: 'webstylebook://design-md/editorial-silence?locale=ko&placement=interleaved' });
    const entry = res.contents[0] as { mimeType: string; text: string };
    expect(entry.mimeType).toBe('text/markdown');
    expect(entry.text).toBe(designMd({ primaryStyleId: 'editorial-silence', contract, locale: 'ko', designMd: { tokenPlacement: 'interleaved' } }).content);
    const bad = await client.readResource({ uri: 'webstylebook://design-md/editorial-silence?mode=dark' });
    expect(JSON.parse((bad.contents[0] as { text: string }).text).error.code).toBe('INVALID_INPUT');
    const manifest = JSON.parse(((await client.readResource({ uri: 'webstylebook://manifest' })).contents[0] as { text: string }).text);
    expect(manifest.resourceUriTemplates).toContain('webstylebook://design-md/{id}');
  });
});
