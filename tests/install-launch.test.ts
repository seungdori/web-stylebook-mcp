import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';

// Each client's install config in the README, read the way that client reads it, must start this
// package's server. The test runs the configured command itself (npx included) and replaces only the
// published package with a tarball packed from this checkout, so it does not depend on what npm serves.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const PUBLISHED = `${pkg.name}@latest`;
const READMES = ['README.md', 'README.ko.md'];

type ServerConfig = { command: string; args: string[] };

// The text under `### <client>`, up to the next second- or third-level heading.
function section(doc: string, client: string) {
  const text = read(doc);
  const start = text.indexOf(`\n### ${client}\n`);
  expect(start, `${doc} has a "### ${client}" section`).toBeGreaterThanOrEqual(0);
  const body = text.slice(start + `\n### ${client}\n`.length);
  const end = body.search(/^#{2,3} /m);
  return end < 0 ? body : body.slice(0, end);
}

function fence(text: string, lang: string) {
  const blocks = [...text.matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]!);
  expect(blocks, `one ${lang} block`).toHaveLength(1);
  return blocks[0]!;
}

// Cursor's button and deeplink carry the server object as base64 JSON in `config`.
function cursorLink(text: string): ServerConfig {
  const configs = new Set([...text.matchAll(/[?&]config=([A-Za-z0-9+/=]+)/g)].map((m) => m[1]!));
  expect(configs.size, 'Cursor links share one config').toBe(1);
  return JSON.parse(Buffer.from([...configs][0]!, 'base64').toString('utf8'));
}

// The mcp.json shape that Cursor (.cursor/mcp.json), Claude Code (.mcp.json) and VS Code (.mcp.json,
// ~/.copilot/mcp-config.json) read. VS Code moves only entries that name their transport into its
// Copilot config, so its block must say `"type": "stdio"`; the others may leave it out.
function mcpJson(text: string, { typed = false } = {}): ServerConfig {
  const { type, ...server } = JSON.parse(fence(text, 'json')).mcpServers['web-stylebook'];
  if (typed || type !== undefined) expect(type, 'transport type').toBe('stdio');
  return server;
}

// VS Code's button wraps vscode:mcp/install?<URL-encoded JSON with the server name> in vscode.dev's redirect.
function vscodeLink(text: string): ServerConfig {
  const links = [...text.matchAll(/https:\/\/vscode\.dev\/redirect\?[^\s)"'`<]+/g)].map((m) => new URL(m[0]).searchParams.get('url')!);
  expect(links, 'one VS Code install link').toHaveLength(1);
  const link = links[0]!;
  const prefix = 'vscode:mcp/install?';
  expect(link.startsWith(prefix), link).toBe(true);
  const { name, ...server } = JSON.parse(decodeURIComponent(link.slice(prefix.length)));
  expect(name).toBe('web-stylebook');
  return server;
}

function addCommand(text: string, cli: string): ServerConfig {
  const line = text.match(new RegExp(`^${cli} mcp add web-stylebook -- (.+)$`, 'm'));
  expect(line, `${cli} mcp add line`).not.toBeNull();
  const [command, ...args] = line![1]!.trim().split(/\s+/);
  return { command: command!, args };
}

// Codex reads ~/.codex/config.toml. The documented table holds only basic strings and arrays of them,
// which are also valid JSON; any other TOML syntax fails here instead of being misread.
function codexToml(text: string): ServerConfig {
  const [header, ...lines] = fence(text, 'toml').trim().split('\n');
  expect(header).toBe('[mcp_servers.web-stylebook]');
  return Object.fromEntries(lines.map((line) => {
    const entry = line.match(/^(\w+) = (.+)$/);
    expect(entry, line).not.toBeNull();
    return [entry![1]!, JSON.parse(entry![2]!)];
  }));
}

const CLIENTS: { client: string; config: (doc: string) => ServerConfig }[] = [
  { client: 'Cursor install link', config: (doc) => cursorLink(section(doc, 'Cursor')) },
  { client: 'Cursor .cursor/mcp.json', config: (doc) => mcpJson(section(doc, 'Cursor')) },
  { client: 'Claude Code claude mcp add', config: (doc) => addCommand(section(doc, 'Claude Code'), 'claude') },
  { client: 'Claude Code .mcp.json', config: (doc) => mcpJson(section(doc, 'Claude Code')) },
  { client: 'Codex codex mcp add', config: (doc) => addCommand(section(doc, 'Codex'), 'codex') },
  { client: 'Codex config.toml', config: (doc) => codexToml(section(doc, 'Codex')) },
  { client: 'VS Code install link', config: (doc) => vscodeLink(section(doc, 'VS Code')) },
  { client: 'VS Code .mcp.json and ~/.copilot/mcp-config.json', config: (doc) => mcpJson(section(doc, 'VS Code'), { typed: true }) },
];

let packDir: string;
let tarball: string;
let tools: { name: string; title?: string }[];
let toolNames: string[];
// Identical configs start one process; a config that differs gets its own launch.
const launches = new Map<string, ReturnType<typeof launch>>();

beforeAll(async () => {
  // Users run their client in their own project, so npx starts from an unrelated folder.
  packDir = mkdtempSync(join(tmpdir(), 'web-stylebook-install-'));
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', packDir], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  tarball = join(packDir, packed.filename);

  const server = createWebStylebookServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'install-launch-reference', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  tools = (await client.listTools()).tools;
  toolNames = tools.map((tool) => tool.name).sort();
  await client.close();
}, 60_000);

afterAll(async () => {
  await Promise.allSettled(launches.values());
  // npx installs each package spec into its own folder under the npm cache (about 35 MB for this
  // tarball); remove the one for this run so repeated test runs do not fill the cache.
  const npxCache = join(execFileSync('npm', ['config', 'get', 'cache'], { env: getDefaultEnvironment(), encoding: 'utf8' }).trim(), '_npx');
  for (const dir of existsSync(npxCache) ? readdirSync(npxCache) : []) {
    const manifest = join(npxCache, dir, 'package.json');
    if (existsSync(manifest) && readFileSync(manifest, 'utf8').includes(basename(packDir))) {
      rmSync(join(npxCache, dir), { recursive: true, force: true });
    }
  }
  rmSync(packDir, { recursive: true, force: true });
});

async function launch(command: string, args: string[]) {
  const transport = new StdioClientTransport({
    command,
    args,
    cwd: packDir,
    stderr: 'pipe',
    // Reuse the npm cache when it already holds the dependencies, so the suite also runs offline.
    env: { npm_config_prefer_offline: 'true' },
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => { stderr += chunk; });
  const client = new Client({ name: 'install-launch-test', version: '0.0.0' });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    return { server: client.getServerVersion(), tools: listed.tools.map((tool) => tool.name).sort() };
  } catch (error) {
    throw new Error(`${command} ${args.join(' ')} did not start the server: ${error}\n${stderr}`);
  } finally {
    await client.close();
  }
}

function launched(config: ServerConfig) {
  const key = JSON.stringify(config);
  if (!launches.has(key)) {
    expect(config.args, `${config.command} ${config.args.join(' ')}`).toContain(PUBLISHED);
    launches.set(key, launch(config.command, config.args.map((arg) => (arg === PUBLISHED ? `file:${tarball}` : arg))));
  }
  return launches.get(key)!;
}

describe('every documented client config starts the server', () => {
  it.each(CLIENTS)('$client', async ({ config }) => {
    const server = config('README.md');
    for (const doc of READMES.slice(1)) expect(config(doc), doc).toEqual(server);
    const started = await launched(server);
    expect(started.server).toEqual({ name: 'web-stylebook', version: pkg.version });
    expect(started.tools).toEqual(toolNames);
  }, 60_000);
});

describe('the MCP bundle for Smithery', () => {
  const manifest = JSON.parse(read('manifest.json'));

  it('manifest.json lists every tool with its title', () => {
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    expect([...manifest.tools].sort(byName)).toEqual(tools.map(({ name, title }) => ({ name, description: title })).sort(byName));
  });

  it('starts the server from a bundle staged the way docs/listings.md stages it', async () => {
    const bundle = join(packDir, 'bundle');
    mkdirSync(bundle);
    execFileSync('tar', ['-xzf', tarball, '-C', bundle, '--strip-components=1']);
    copyFileSync(join(root, 'manifest.json'), join(bundle, 'manifest.json'));
    // Stands in for `npm install --omit=dev`: the checkout already has the production dependencies.
    symlinkSync(join(root, 'node_modules'), join(bundle, 'node_modules'), 'junction');
    expect(existsSync(join(bundle, manifest.server.entry_point)), manifest.server.entry_point).toBe(true);
    const { command, args } = manifest.server.mcp_config;
    const started = await launch(command, args.map((arg: string) => arg.replaceAll('${__dirname}', bundle)));
    expect(started.server).toEqual({ name: 'web-stylebook', version: pkg.version });
    expect(started.tools).toEqual(toolNames);
  }, 60_000);
});
