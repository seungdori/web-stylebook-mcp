import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assignSides } from '../showcase/harness/assign.mjs';
import { canStart } from '../showcase/harness/governor.mjs';
import { DENIED_TOOLS, MCP_SERVER_NAME, MODEL, CLAUDE_VERSION, buildPrompt, childEnv, claudeArgs, mcpConfig } from '../showcase/harness/lib.mjs';
import { auditSession, sessionFilePath, summarizeStream } from '../showcase/harness/session.mjs';

// The harness decides what each arm is given and how a session is read back, so the invariants the
// showcase README states about it are pinned here rather than trusted.

describe('showcase harness: the two arms differ only where the protocol says they do', () => {
  const brief = 'A brief of two sentences. It names no design.';
  const control = buildPrompt(brief, 'control');
  const mcp = buildPrompt(brief, 'mcp');
  const paragraphs = (text: string) => text.trim().split('\n\n');

  it('adds exactly one paragraph, about the MCP server, for the MCP arm', () => {
    const extra = paragraphs(mcp).filter((p) => !paragraphs(control).includes(p));
    expect(extra).toHaveLength(1);
    expect(extra[0]).toContain('recommend_design_direction');
    expect(paragraphs(mcp).filter((p) => paragraphs(control).includes(p))).toEqual(paragraphs(control));
  });

  it('keeps the control prompt free of any mention of the server or of design guidance', () => {
    expect(control).not.toMatch(/stylebook|MCP|recommend_design|token|palette|typograph/i);
    expect(control).toContain(`Brief: ${brief}`);
    expect(control).toContain('Vite + React + plain CSS');
    expect(control).toContain('no Tailwind');
  });

  it('puts the MCP paragraph before the closing no-human paragraph, as the README says', () => {
    const list = paragraphs(mcp);
    expect(list.at(-1)).toMatch(/^No one is available/);
    expect(list.at(-2)).toMatch(/^The web-stylebook MCP server is attached/);
  });

  it('gives the control arm an empty server list and the MCP arm one stdio server on dist/cli.js', () => {
    expect(mcpConfig('control')).toEqual({ mcpServers: {} });
    const servers = (mcpConfig('mcp') as { mcpServers: Record<string, { type: string; command: string; args: string[] }> }).mcpServers;
    expect(Object.keys(servers)).toEqual([MCP_SERVER_NAME]);
    expect(servers[MCP_SERVER_NAME]).toMatchObject({ type: 'stdio', command: 'node' });
    expect(servers[MCP_SERVER_NAME]!.args[0]).toMatch(/web-stylebook-mcp-5a783c9[\\/]dist[\\/]cli\.js$/);
  });
});

describe('showcase harness: the session is pinned and isolated', () => {
  const args = claudeArgs('/tmp/arm/mcp-config.json') as string[];
  const after = (flag: string) => args[args.indexOf(flag) + 1];

  it('pins the model, the effort and the project-only settings', () => {
    expect(after('--model')).toBe('claude-sonnet-5-5');
    expect(after('--effort')).toBe('max');
    expect(after('--setting-sources')).toBe('project');
    expect(args).toContain('--disable-slash-commands');
    expect(args).toContain('--strict-mcp-config');
    expect(after('--mcp-config')).toBe('/tmp/arm/mcp-config.json');
  });

  it('ends with the variadic --disallowedTools list, which must stay last', () => {
    const at = args.indexOf('--disallowedTools');
    expect(args.slice(at + 1)).toEqual(DENIED_TOOLS);
    expect(args.slice(0, at).some((a: string) => DENIED_TOOLS.includes(a))).toBe(false);
    for (const tool of ['WebSearch', 'WebFetch']) expect(DENIED_TOOLS).toContain(tool);
  });

  it('builds the child environment from an allowlist, so parent-session values do not leak', () => {
    const keep = { ANTHROPIC_API_KEY: 'sk-test-leak', CLAUDE_CODE_SESSION_ID: 'abc', GH_TOKEN: 'ghp-test-leak', SSH_AUTH_SOCK: '/tmp/sock', MY_SECRET: 'x' };
    const saved = Object.fromEntries(Object.keys(keep).map((k) => [k, process.env[k]]));
    Object.assign(process.env, keep);
    try {
      const env = childEnv() as Record<string, string>;
      for (const name of Object.keys(keep)) expect(env, name).not.toHaveProperty(name);
      expect(env.CLAUDE_CODE_DISABLE_CLAUDE_MDS).toBe('1');
      expect(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe('1');
      expect(env.DISABLE_AUTOUPDATER).toBe('1');
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe('showcase harness: usage pacing and the seeded sides', () => {
  const base = { perBuild: 0.1, ceiling: 0.9 };

  it('starts a build only while the running and starting builds still fit under the ceiling', () => {
    expect(canStart({ ...base, utilization: 0.5, running: 2, starting: 2 })).toBe(true);
    expect(canStart({ ...base, utilization: 0.5, running: 2, starting: 3 })).toBe(false);
    expect(canStart({ ...base, utilization: 0.9, running: 0, starting: 1 })).toBe(false);
    expect(canStart({ ...base, utilization: 0.8, running: 0, starting: 1 })).toBe(true);
  });

  it('draws one side per brief from the seed and is stable between calls', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `brief-${i}`);
    const first = assignSides(ids) as Record<string, { left: string; right: string }>;
    expect(assignSides(ids)).toEqual(first);
    expect(Object.keys(first)).toEqual(ids);
    for (const side of Object.values(first)) expect([side.left, side.right].sort()).toEqual(['control', 'mcp']);
    expect(assignSides(ids.slice(0, 4))).toEqual(Object.fromEntries(Object.entries(first).slice(0, 4)));
    expect(assignSides(ids, 'another seed')).not.toEqual(first);
  });
});

describe('showcase harness: reading a headless transcript', () => {
  const stream = [
    { type: 'system', subtype: 'init', cwd: '/x', session_id: 's1' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', id: 'a', name: 'ToolSearch', input: { query: 'q' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'a', content: 'loaded' }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'b', name: 'mcp__web-stylebook__recommend_design_direction', input: { productType: 'x' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'b', is_error: true, content: 'rejected' }] } },
    { type: 'assistant', parent_tool_use_id: 'agent-1', message: { content: [{ type: 'tool_use', id: 'c', name: 'Bash', input: { command: 'ls' } }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'd', name: 'ReadMcpResourceTool', input: { uri: 'webstylebook://manifest' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'd', content: [{ type: 'text', text: 'ok' }] }] } },
    { type: 'rate_limit_event', rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.5 } } } },
    { type: 'result', subtype: 'success' },
  ];
  const summary = summarizeStream(stream);

  it('pairs each tool call with its result and flags errors', () => {
    expect(summary.calls.map((c: { tool: string }) => c.tool)).toEqual(['ToolSearch', 'mcp__web-stylebook__recommend_design_direction', 'Bash', 'ReadMcpResourceTool']);
    const rejected = summary.calls[1];
    expect(rejected).toMatchObject({ isError: true, output: 'rejected', seq: 2 });
    expect(summary.calls[2]).toMatchObject({ output: null, isError: null, parentToolUseId: 'agent-1' });
  });

  it('treats MCP tools and the MCP resource tools as MCP calls, and records what came before the first one', () => {
    expect(summary.mcpCalls.map((c: { tool: string }) => c.tool)).toEqual(['mcp__web-stylebook__recommend_design_direction', 'ReadMcpResourceTool']);
    expect(summary.toolsBeforeFirstMcp).toEqual(['ToolSearch']);
    expect(summary.toolCounts).toEqual({ ToolSearch: 1, 'mcp__web-stylebook__recommend_design_direction': 1, Bash: 1, ReadMcpResourceTool: 1 });
  });

  it('keeps the init, result and last rate-limit events', () => {
    expect(summary.init).toMatchObject({ session_id: 's1' });
    expect(summary.result).toMatchObject({ subtype: 'success' });
    expect(summary.rateLimit).toEqual({ unifiedWindows: { five_hour: { utilization: 0.5 } } });
    expect(summarizeStream([]).toolsBeforeFirstMcp).toBeNull();
  });
});

// os.homedir() reads $HOME on POSIX only; the audit looks for the native session file under it.
describe.skipIf(process.platform === 'win32')('showcase harness: the isolation audit can fail', () => {
  let home = '';
  let savedHome: string | undefined;

  beforeAll(() => {
    savedHome = process.env.HOME;
    home = mkdtempSync(join(tmpdir(), 'showcase-audit-'));
    process.env.HOME = home;
    expect(homedir(), 'this test needs a worker where process.env.HOME reaches os.homedir()').toBe(home);
  });
  afterAll(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    rmSync(home, { recursive: true, force: true });
  });

  const baseInit = (arm: 'control' | 'mcp', id: string) => ({
    cwd: `/runs/${id}/${arm}`,
    session_id: `session-${id}-${arm}`,
    model: MODEL,
    claude_code_version: CLAUDE_VERSION,
    permissionMode: 'bypassPermissions',
    output_style: 'default',
    skills: [] as string[],
    tools: arm === 'mcp' ? ['Bash', 'Read', `mcp__${MCP_SERVER_NAME}__recommend_design_direction`] : ['Bash', 'Read'],
    mcp_servers: arm === 'mcp' ? [{ name: MCP_SERVER_NAME, status: 'connected' }] : [],
  });

  function writeSession(init: ReturnType<typeof baseInit>, attachments: Record<string, unknown>[]) {
    const file = sessionFilePath(init) as string;
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, `${attachments.map((attachment) => JSON.stringify({ attachment })).join('\n')}\n`);
  }
  const cleanAttachments = (arm: 'control' | 'mcp', extra: Record<string, unknown>[] = []) => [
    { type: 'environment' },
    { type: 'prompt_snapshot', systemPrompt: ['You are an agent.', 'Be brief.'] },
    ...(arm === 'mcp' ? [{ type: 'mcp_instructions_delta', text: 'server instructions' }] : []),
    ...extra,
  ];

  it('encodes the session folder the way Claude Code does', () => {
    expect(sessionFilePath({ cwd: '/Users/a b/run_1/x.y', session_id: 'S' })).toBe(join(homedir(), '.claude', 'projects', '-Users-a-b-run-1-x-y', 'S.jsonl'));
  });

  it('passes a clean session for each arm', () => {
    for (const arm of ['control', 'mcp'] as const) {
      const init = baseInit(arm, 'clean');
      writeSession(init, cleanAttachments(arm));
      expect(auditSession(arm, init)).toMatchObject({ ok: true, problems: [] });
    }
  });

  it.each([
    ['a CLAUDE.md instructions attachment', 'control', (init: ReturnType<typeof baseInit>) => ({ init, attachments: cleanAttachments('control', [{ type: 'instructions' }]) }), /CLAUDE\.md instructions attachment/],
    ['MCP instructions in the control arm', 'control', (init: ReturnType<typeof baseInit>) => ({ init, attachments: cleanAttachments('mcp') }), /MCP instructions do not match the arm/],
    ['no MCP instructions in the MCP arm', 'mcp', (init: ReturnType<typeof baseInit>) => ({ init, attachments: cleanAttachments('control') }), /MCP instructions do not match the arm/],
    ['an MCP server in the control arm', 'control', (init: ReturnType<typeof baseInit>) => ({ init: { ...init, mcp_servers: [{ name: MCP_SERVER_NAME, status: 'connected' }] }, attachments: cleanAttachments('control') }), /control session had MCP servers/],
    ['a second MCP server in the MCP arm', 'mcp', (init: ReturnType<typeof baseInit>) => ({ init: { ...init, mcp_servers: [...init.mcp_servers, { name: 'other', status: 'connected' }] }, attachments: cleanAttachments('mcp') }), /MCP servers were/],
    ['a skill', 'control', (init: ReturnType<typeof baseInit>) => ({ init: { ...init, skills: ['dataviz'] }, attachments: cleanAttachments('control') }), /skills were loaded/],
    ['another model', 'control', (init: ReturnType<typeof baseInit>) => ({ init: { ...init, model: 'claude-opus-4' }, attachments: cleanAttachments('control') }), /model was claude-opus-4/],
    ['another Claude Code version', 'control', (init: ReturnType<typeof baseInit>) => ({ init: { ...init, claude_code_version: '9.9.9' }, attachments: cleanAttachments('control') }), /Claude Code was 9\.9\.9/],
    ['a denied tool', 'control', (init: ReturnType<typeof baseInit>) => ({ init: { ...init, tools: [...init.tools, 'WebSearch'] }, attachments: cleanAttachments('control') }), /denied tools were available: WebSearch/],
    ['an auto-memory section', 'control', (init: ReturnType<typeof baseInit>) => ({ init, attachments: [{ type: 'prompt_snapshot', systemPrompt: ['intro', '# Memory\nremember'] }] }), /auto-memory section/],
    ['a user CLAUDE.md fragment in the context', 'control', (init: ReturnType<typeof baseInit>) => ({ init, attachments: cleanAttachments('control', [{ type: 'session_context', text: 'Design Skill Routing table' }]) }), /session context mentions Design Skill Routing/],
  ] as const)('reports %s', (_name, arm, make, expected) => {
    const id = _name.replace(/\W+/g, '-');
    const { init, attachments } = make(baseInit(arm, id));
    writeSession(init as ReturnType<typeof baseInit>, attachments);
    const result = auditSession(arm, init) as { ok: boolean; problems: string[] };
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(expected);
  });

  it('fails when the native session file is missing instead of passing silently', () => {
    const result = auditSession('control', baseInit('control', 'absent')) as { ok: boolean; problems: string[] };
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/native session file not found/);
  });
});
