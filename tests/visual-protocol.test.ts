import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';

let client: Client;
let manifest: Record<string, any>;
let nativeStyle: Record<string, any>;

beforeAll(async () => {
  const server = createWebStylebookServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'visual-protocol-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const [manifestResource, styleResource] = await Promise.all([
    client.readResource({ uri: 'webstylebook://manifest' }),
    client.readResource({ uri: 'webstylebook://styles/brutalist-grid' }),
  ]);
  manifest = JSON.parse(manifestResource.contents[0]!.text as string);
  nativeStyle = JSON.parse(styleResource.contents[0]!.text as string);
});

afterAll(async () => { await client?.close(); });

function contractIdentity() {
  return {
    schema: manifest.visualContract.contractSchema,
    contentHash: manifest.visualContract.contentHash,
    revision: nativeStyle.visualContract.revision,
  };
}

async function compose(input: Record<string, unknown> = {}) {
  return client.callTool({
    name: 'compose_design_tokens',
    arguments: {
      primaryStyleId: 'brutalist-grid', format: 'json', contract: contractIdentity(), ...input,
    },
  });
}

function fallbackText(result: Awaited<ReturnType<typeof compose>>): string {
  return (result.content as Array<{ type: string; text?: string }>)
    .filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n');
}

function fallbackCompanion(result: Awaited<ReturnType<typeof compose>>) {
  const match = /Visual contract (?:companion|metadata) \(JSON\)\n```json\n([^\n]+)\n```/.exec(fallbackText(result));
  expect(match, 'current source and repair metadata must remain accessible in text').not.toBeNull();
  return JSON.parse(match![1]!);
}

describe('canonical visual contract over MCP', () => {
  it('makes the source identity discoverable and exposes only the selected native contract', () => {
    expect(manifest.visualContract.schema).toBe('webstylebook.visual-library.v1');
    expect(manifest.visualContract.contractSchema).toBe('webstylebook.visual.v1');
    expect(manifest.visualContract.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(nativeStyle.visualContract.schema).toBe(manifest.visualContract.contractSchema);
    expect(nativeStyle.visualContract.styleId).toBe('brutalist-grid');
    expect(nativeStyle.visualContract.colors.text).toBe('#111');
    expect(nativeStyle.visualContract.colors.accent).toBe('#d72600');
    expect(nativeStyle.visualContract.modes).toBeUndefined();
    expect(nativeStyle.visualContract.styles).toBeUndefined();
  });

  it('preserves the resource values when the discovered contract is composed', async () => {
    const result = await compose();
    expect(result.isError).not.toBe(true);
    const data = result.structuredContent as any;
    expect(data.visualContract).toEqual(nativeStyle.visualContract);
    expect(data.contract.contentHash).toBe(manifest.visualContract.contentHash);
    expect(data.colorMode).toBe(nativeStyle.visualContract.mode);
    expect(result.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'resource_link', uri: 'webstylebook://styles/brutalist-grid' }),
    ]));
  });

  it('passes explicit color and typography edits through to the resolved contract and output', async () => {
    const result = await compose({
      format: 'css-variables',
      overrides: { colors: { text: '#242424' }, typography: { body: { lineHeight: 1.75 } } },
    });
    expect(result.isError).not.toBe(true);
    const data = result.structuredContent as any;
    expect(data.visualContract.colors.text).toBe('#242424');
    expect(data.visualContract.typography.roles.body.lineHeight).toBe(1.75);
    expect(data.rendered).toContain('#242424');
    expect(data.rendered).toContain('1.75');
    expect(data.visualContract.colors.accent).toBe(nativeStyle.visualContract.colors.accent);
  });

  it('delivers edited font metadata and accepted repairs in the CSS text companion', async () => {
    const input = {
      format: 'css-variables',
      overrides: {
        colors: { link: '#eeeeee' },
        typography: { body: { fontFamily: 'Companion Test Font, sans-serif' } },
        fonts: [{
          family: 'Companion Test Font', source: 'user', license: 'Protocol companion license marker',
          weights: [400], scripts: ['latin'], fallback: 'system-ui, sans-serif', availability: 'unverified',
        }],
      },
    };
    const initial = await compose(input);
    expect(initial.isError).not.toBe(true);
    const proposal = (initial.structuredContent as any).repairProposals.find((repair: any) => repair.role === 'link');
    expect(proposal).toBeDefined();
    const result = await compose({ ...input, acceptedRepairs: [proposal] });
    expect(result.isError).not.toBe(true);
    const data = result.structuredContent as any;
    const companion = fallbackCompanion(result);
    expect(companion).toEqual({
      contract: data.contract, visualContract: data.visualContract, repairProposals: data.repairProposals,
    });
    expect(fallbackText(result)).toContain('Protocol companion license marker');
    expect(companion.visualContract.repairs).toEqual([proposal]);
    expect(companion.visualContract.typography.roles.body.fontFamily).toBe('Companion Test Font, sans-serif');
    expect(companion.visualContract.overrides).toEqual(input.overrides);
  });

  it.each(['json', 'typescript', 'tailwind'])('keeps source and repair metadata in %s text output without duplicating the spec', async (format) => {
    const result = await compose({ format, overrides: { colors: { link: '#eeeeee' } } });
    expect(result.isError).not.toBe(true);
    const data = result.structuredContent as any;
    const companion = fallbackCompanion(result);
    expect(companion).toEqual({ contract: data.contract, repairProposals: data.repairProposals });
    expect(companion.repairProposals.length).toBeGreaterThan(0);
    expect(companion.visualContract).toBeUndefined();
    expect(fallbackText(result)).toContain(data.visualContract.contentHash);
  });

  it('uses locale and revision query parameters for the same resource contract', async () => {
    const revision = encodeURIComponent(nativeStyle.visualContract.revision);
    const resource = await client.readResource({
      uri: `webstylebook://styles/brutalist-grid?locale=ko&revision=${revision}`,
    });
    const data = JSON.parse(resource.contents[0]!.text as string);
    expect(data.id).toBe('brutalist-grid');
    expect(data.visualContract.contentLocale).toBe('ko');
    const result = await compose({ locale: 'ko' });
    expect((result.structuredContent as any).visualContract).toEqual(data.visualContract);
  });

  it.each([
    { schema: 'webstylebook.visual.v99' },
    { contentHash: `sha256:${'0'.repeat(64)}` },
    { revision: 'missing-revision' },
  ])('returns a deterministic error for mismatched source identity %j', async (mismatch) => {
    const result = await compose({ contract: { ...contractIdentity(), ...mismatch } });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as any).error.code).toBe('INVALID_INPUT');
    expect((result.structuredContent as any).error.message).toBeTruthy();
  });

  it('rejects the ambiguous legacy secondary overlay in contract mode', async () => {
    const result = await compose({ secondaryStyleId: 'quiet-utility' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as any).error.code).toBe('INVALID_INPUT');
  });

  it.each([
    { colors: { typoColorRole: '#000000' } },
    { typography: { body: { lineHieght: 1.6 } } },
  ])('rejects unknown override fields instead of silently dropping edits %j', async (overrides) => {
    const result = await compose({ overrides }).catch(() => ({ isError: true }));
    expect(result.isError).toBe(true);
  });

  it('rejects unsupported input fields instead of silently dropping selected axes', async () => {
    const result = await compose({ composition: { colors: 'quiet-utility' } })
      .catch(() => ({ isError: true }));
    expect(result.isError).toBe(true);
  });

  it('requires contract opt-in when explicit web-editor values are supplied', async () => {
    const result = await client.callTool({
      name: 'compose_design_tokens',
      arguments: { primaryStyleId: 'brutalist-grid', format: 'json', overrides: { colors: { text: '#242424' } } },
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as any).error.code).toBe('INVALID_INPUT');
  });

  it.each([
    { density: 'compact', overrides: { density: 'comfortable' } },
    { accentOverride: '#000000', overrides: { colors: { accent: '#ffffff' } } },
  ])('rejects conflicting aliases and explicit overrides %j', async (input) => {
    const result = await compose(input);
    expect(result.isError).toBe(true);
    expect((result.structuredContent as any).error.code).toBe('INVALID_INPUT');
  });

  it('returns a clear resource error for unsupported query values', async () => {
    const result = await client.readResource({ uri: 'webstylebook://styles/brutalist-grid?locale=fr' });
    const data = JSON.parse(result.contents[0]!.text as string);
    expect(data.error.code).toBe('INVALID_INPUT');
    expect(data.error.message).toContain('locale');
  });

  it('keeps the existing invocation available without opting into a contract', async () => {
    const result = await client.callTool({
      name: 'compose_design_tokens',
      arguments: { primaryStyleId: 'runtime-signal', format: 'css-variables', colorMode: 'dark' },
    });
    expect(result.isError).not.toBe(true);
    expect((result.structuredContent as any).rendered).toContain('--color-canvas');
    expect((result.structuredContent as any).visualContract).toBeUndefined();
    expect(fallbackText(result)).not.toContain('Visual contract companion (JSON)');
    expect(fallbackText(result)).not.toContain('Visual contract metadata (JSON)');
  });
});
