import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CLAUDE_VERSION, DENIED_TOOLS, MCP_SERVER_NAME, MODEL } from './lib.mjs';

const MCP_RESOURCE_TOOLS = new Set(['ListMcpResourcesTool', 'ReadMcpResourceTool', 'ReadMcpResourceDirTool']);

export function readJsonl(path) {
  const events = [];
  let badLines = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      badLines += 1;
    }
  }
  return { events, badLines };
}

// Claude Code stores the native transcript under the cwd with every non-alphanumeric character replaced by "-".
export function sessionFilePath(init) {
  const encoded = init.cwd.replace(/[^a-zA-Z0-9]/g, '-');
  return join(homedir(), '.claude', 'projects', encoded, `${init.session_id}.jsonl`);
}

export function summarizeStream(events) {
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? null;
  const result = events.find((e) => e.type === 'result') ?? null;

  const calls = [];
  const byId = new Map();
  for (const event of events) {
    const blocks = Array.isArray(event.message?.content) ? event.message.content : [];
    if (event.type === 'assistant') {
      for (const block of blocks) {
        if (block.type !== 'tool_use') continue;
        const call = {
          seq: calls.length + 1,
          toolUseId: block.id,
          tool: block.name,
          input: block.input,
          parentToolUseId: event.parent_tool_use_id ?? null,
          isError: null,
          output: null,
        };
        calls.push(call);
        byId.set(block.id, call);
      }
    } else if (event.type === 'user') {
      for (const block of blocks) {
        if (block.type !== 'tool_result') continue;
        const call = byId.get(block.tool_use_id);
        if (call) {
          call.isError = block.is_error === true;
          call.output = block.content;
        }
      }
    }
  }

  const toolCounts = {};
  for (const call of calls) toolCounts[call.tool] = (toolCounts[call.tool] ?? 0) + 1;

  const mcpCalls = calls.filter((c) => c.tool.startsWith('mcp__') || MCP_RESOURCE_TOOLS.has(c.tool));
  const firstMcp = mcpCalls[0] ?? null;
  const rateLimit = [...events].reverse().find((e) => e.type === 'rate_limit_event')?.rate_limit_info ?? null;

  return {
    init,
    result,
    calls,
    mcpCalls,
    toolCounts,
    toolsBeforeFirstMcp: firstMcp ? calls.slice(0, firstMcp.seq - 1).map((c) => c.tool) : null,
    assistantMessages: events.filter((e) => e.type === 'assistant').length,
    rateLimit,
  };
}

// A leaked CLAUDE.md, memory section, skill or extra MCP server would contaminate an arm, so each session is audited
// against what its arm should have received.
export function auditSession(arm, init) {
  const problems = [];
  const expect = (ok, message) => {
    if (!ok) problems.push(message);
  };

  expect(init.model === MODEL, `model was ${init.model}`);
  expect(init.claude_code_version === CLAUDE_VERSION, `Claude Code was ${init.claude_code_version}`);
  expect(init.permissionMode === 'bypassPermissions', `permission mode was ${init.permissionMode}`);
  expect(init.output_style === 'default', `output style was ${init.output_style}`);
  expect((init.skills ?? []).length === 0, 'skills were loaded');

  const presentDenied = DENIED_TOOLS.filter((t) => !t.includes('(') && init.tools.includes(t));
  expect(presentDenied.length === 0, `denied tools were available: ${presentDenied.join(', ')}`);

  const mcpTools = init.tools.filter((t) => t.startsWith('mcp__'));
  if (arm === 'control') {
    expect(init.mcp_servers.length === 0, 'control session had MCP servers');
    expect(mcpTools.length === 0, 'control session had MCP tools');
  } else {
    const server = init.mcp_servers.find((s) => s.name === MCP_SERVER_NAME);
    expect(init.mcp_servers.length === 1 && server?.status === 'connected', `MCP servers were ${JSON.stringify(init.mcp_servers)}`);
    expect(mcpTools.includes(`mcp__${MCP_SERVER_NAME}__recommend_design_direction`), 'recommend_design_direction was not exposed');
    expect(mcpTools.every((t) => t.startsWith(`mcp__${MCP_SERVER_NAME}__`)), 'tools from another MCP server were exposed');
  }

  const sessionFile = sessionFilePath(init);
  const observed = { sessionFile, tools: init.tools, mcp_servers: init.mcp_servers };
  if (!existsSync(sessionFile)) {
    problems.push(`native session file not found: ${sessionFile}`);
    return { ok: false, problems, observed };
  }

  const { events: rows } = readJsonl(sessionFile);
  const attachments = rows.filter((r) => r.attachment).map((r) => r.attachment);
  const attachmentTypes = [...new Set(attachments.map((a) => a.type))];
  observed.attachmentTypes = attachmentTypes;

  expect(!attachmentTypes.includes('instructions'), 'a CLAUDE.md instructions attachment was injected');
  expect(attachmentTypes.includes('mcp_instructions_delta') === (arm === 'mcp'), 'MCP instructions do not match the arm');

  const snapshot = attachments.find((a) => a.type === 'prompt_snapshot');
  const systemPrompt = snapshot ? [].concat(snapshot.systemPrompt).join('\n') : '';
  observed.systemPromptChars = systemPrompt.length;
  expect(systemPrompt.length > 0, 'system prompt snapshot not found');
  expect(!/^# Memory/m.test(systemPrompt), 'system prompt has an auto-memory section');
  for (const needle of ['Output Style', 'CLAUDE.md', 'web-stylebook']) {
    expect(!systemPrompt.includes(needle), `system prompt mentions ${needle}`);
  }

  // These needles come from the maintainer's own CLAUDE.md and output style, so this check only bites on a machine that has them.
  const contextText = JSON.stringify(attachments.filter((a) => a.type !== 'prompt_snapshot'));
  for (const needle of ['korean-ste', 'Design Skill Routing', 'Second plan from Sol', 'web-stylebook-design', 'MEMORY.md']) {
    expect(!contextText.includes(needle), `session context mentions ${needle}`);
  }

  return { ok: problems.length === 0, problems, observed };
}
