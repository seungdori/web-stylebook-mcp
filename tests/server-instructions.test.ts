// Plan PR 1 (2026-11-25 design-quality plan, 3.2-3.3): Claude Code shows at most 4,096 characters of server
// instructions and lists MCP tools by name only until they are loaded, so in the 0.16.0 runs ten of 36 sessions with
// the server connected never called it. The instructions now lead with the new-page rule, and every tool description
// starts with when to call it.
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { ENTRY_TOOL, IMPROVEMENT_GUIDANCE, NEW_UI_GUIDANCE, NEW_UI_WORKFLOW_URI, SERVER_INSTRUCTIONS, TOOL_NAMES } from '../src/server-info.js';
import { IMPROVEMENT_WORKFLOW_URI } from '../src/improvement/workflow.js';

const LIMITS = { instructions: 1500, entryWithin: 400, description: 2048, firstSentence: 200 } as const;
const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0]!;

let client: Client;
beforeAll(async () => {
  const server = createWebStylebookServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'server-instructions-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

describe('on-init server instructions', () => {
  it(`stay within ${LIMITS.instructions} characters, well under the 4,096 Claude Code shows`, () => {
    expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(LIMITS.instructions);
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
  });

  it(`name the entry tool within the first ${LIMITS.entryWithin} characters, in the first sentence`, () => {
    expect(SERVER_INSTRUCTIONS.indexOf(ENTRY_TOOL)).toBeGreaterThanOrEqual(0);
    expect(SERVER_INSTRUCTIONS.indexOf(ENTRY_TOOL)).toBeLessThan(LIMITS.entryWithin);
    expect(firstSentence(SERVER_INSTRUCTIONS)).toContain(ENTRY_TOOL);
  });

  it('cover functional screens, which the 0.16.0 runs built without calling the server', () => {
    const first = firstSentence(SERVER_INSTRUCTIONS);
    for (const kind of ['dashboard', 'docs', 'settings']) expect(first, kind).toContain(kind);
  });

  it('send the existing-UI flow to one sentence and its workflow resource', () => {
    const sentences = SERVER_INSTRUCTIONS.split(/(?<=\.)\s/).filter((sentence) => sentence.includes('get_design_improvement_plan'));
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toContain(IMPROVEMENT_WORKFLOW_URI);
    expect(sentences[0]).toContain('validate_design_improvement_result');
    expect(SERVER_INSTRUCTIONS).toContain(NEW_UI_WORKFLOW_URI);
  });

  it('serve the moved guidance in full from the two workflow resources', async () => {
    const read = async (uri: string) => JSON.parse(((await client.readResource({ uri })).contents[0] as { text: string }).text);
    const newUi = await read(NEW_UI_WORKFLOW_URI);
    expect(newUi.entryTool).toBe(ENTRY_TOOL);
    expect(newUi.guidance).toBe(NEW_UI_GUIDANCE.join(' '));
    const improve = await read(IMPROVEMENT_WORKFLOW_URI);
    expect(improve.guidance).toBe(IMPROVEMENT_GUIDANCE);
    const manifest = await read('webstylebook://manifest');
    expect(manifest.newUiWorkflow).toMatchObject({ resourceUri: NEW_UI_WORKFLOW_URI, entryTool: ENTRY_TOOL });
  });
});

describe('tool descriptions', () => {
  it('cover every registered tool', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it(`open with when to call the tool, in at most ${LIMITS.firstSentence} characters`, async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const first = firstSentence(tool.description ?? '');
      expect(first, tool.name).toMatch(/^Call /);
      expect(first, tool.name).toMatch(/\b(?:first|last|before|after|when)\b/);
      expect(first.length, tool.name).toBeLessThanOrEqual(LIMITS.firstSentence);
    }
  });

  it(`stay within ${LIMITS.description} characters`, async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) expect((tool.description ?? '').length, tool.name).toBeLessThanOrEqual(LIMITS.description);
  });

  it('send new pages to the entry tool and existing UI to the improvement plan', async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool.description ?? '']));
    expect(firstSentence(byName.get(ENTRY_TOOL)!)).toMatch(/^Call first, before writing HTML, CSS or JSX for any new page or screen/);
    expect(firstSentence(byName.get('get_design_improvement_plan')!)).toMatch(/^Call first when the task is to improve or fix an existing UI/);
  });
});
