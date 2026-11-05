// Shell access to the same tools and resources the MCP server exposes, for agents that can run
// commands but have no MCP connection (a skill installed without the server, CI, scripts).
// Each command starts the real server in-process over an in-memory transport, so arguments are
// validated by the same schemas and results are byte-identical to an MCP call.

import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from './server.js';
import { SERVER_NAME, SERVER_VERSION } from './server-info.js';

export const TOOL_COMMANDS = ['tools', 'schema', 'call', 'read'] as const;

export const TOOL_COMMANDS_HELP = `Tool commands (no MCP client needed; output is JSON on stdout):
  tools                          list tool names with a one-line summary
  schema <tool>                  print the tool's input JSON Schema
  call <tool> [json|-]           run a tool; arguments as a JSON string, "-" for stdin,
       [--input <file>]          or a JSON file (recommended: avoids shell quoting)
       [--text]                  print the short text summary instead of the full JSON
  read <uri>                     read a webstylebook:// resource

Exit codes: 0 ok, 1 tool error (the error JSON is still printed), 2 usage error.
`;

class UsageError extends Error {}

// `tools` is a menu; `schema <tool>` carries the full description.
const SUMMARY_MAX = 160;

async function connect(): Promise<Client> {
  const server = createWebStylebookServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: `${SERVER_NAME}-cli`, version: SERVER_VERSION });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function firstSentence(text: string | undefined): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  const end = flat.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? flat : flat.slice(0, end + 1);
  if (sentence.length <= SUMMARY_MAX) return sentence;
  const cut = sentence.slice(0, SUMMARY_MAX);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function parseArguments(raw: string, source: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new UsageError(`${source} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new UsageError(`${source} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function readArguments(rest: string[]): Record<string, unknown> {
  const inputAt = rest.indexOf('--input');
  if (inputAt !== -1) {
    const file = rest[inputAt + 1];
    if (!file) throw new UsageError('--input needs a file path');
    return parseArguments(readFileSync(file, 'utf8'), `--input ${file}`);
  }
  const positional = rest.filter((a) => !a.startsWith('--'));
  if (positional.length > 1) throw new UsageError('pass tool arguments as one JSON object (quote it), "-" or --input <file>');
  const [arg] = positional;
  if (arg === undefined) return {};
  if (arg === '-') return parseArguments(readFileSync(0, 'utf8'), 'stdin');
  return parseArguments(arg, 'the arguments');
}

function cleanMessage(message: string): string {
  return message.replace(/^(MCP error -?\d+: )+/, '');
}

function print(value: unknown): void {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

export async function runToolCommand(command: string, rest: string[]): Promise<number> {
  let client: Client | undefined;
  try {
    const target = rest[0] ?? '';
    if (command !== 'tools' && (!target || target.startsWith('--'))) {
      throw new UsageError(`${command} needs ${command === 'read' ? 'a resource URI' : 'a tool name'}`);
    }
    client = await connect();

    if (command === 'tools') {
      const { tools } = await client.listTools();
      if (rest.includes('--json')) print(tools.map((t) => ({ name: t.name, summary: firstSentence(t.description) })));
      else print(tools.map((t) => `${t.name.padEnd(36)} ${firstSentence(t.description)}`).join('\n'));
      return 0;
    }

    if (command === 'schema') {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === target);
      if (!tool) throw new UsageError(`unknown tool '${target}'. Run "${SERVER_NAME}-mcp tools" for the list.`);
      print({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
      return 0;
    }

    if (command === 'read') {
      const result = await client.readResource({ uri: target });
      const texts = result.contents.map((c) => ('text' in c ? String(c.text) : ''));
      print(texts.join('\n'));
      return 0;
    }

    // call
    const { tools } = await client.listTools();
    if (!tools.some((t) => t.name === target)) throw new UsageError(`unknown tool '${target}'. Run "${SERVER_NAME}-mcp tools" for the list.`);
    const result = await client.callTool({ name: target, arguments: readArguments(rest.slice(1)) });
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
    if (rest.includes('--text')) print(text);
    // Argument-schema failures come back without structured content; give them the error shape too.
    else print(result.structuredContent ?? { error: { code: 'INVALID_ARGUMENTS', message: cleanMessage(text) } });
    return result.isError ? 1 : 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof UsageError) {
      process.stderr.write(`${message}\n\n${TOOL_COMMANDS_HELP}`);
      return 2;
    }
    // Protocol errors (for example a resource that does not exist) are reported like tool errors.
    print({ error: { message: cleanMessage(message) } });
    return 1;
  } finally {
    await client?.close();
  }
}
