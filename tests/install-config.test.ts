import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Every published install path must start the same npx command that `claude mcp add` documents.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const json = (path: string) => JSON.parse(read(path));
const DOCS = ['README.md', 'README.ko.md', 'docs/reference.md', 'docs/reference.ko.md', 'docs/listings.md'];

const pkg = json('package.json');
const server = json('server.json');

function documentedCommand() {
  const line = read('README.md').match(/^claude mcp add web-stylebook -- (.+)$/m);
  expect(line, 'README.md documents the claude mcp add command').not.toBeNull();
  const [command, ...args] = line![1]!.trim().split(/\s+/);
  return { command, args };
}

function cursorLinks(text: string) {
  return [...text.matchAll(/(?:cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install|https:\/\/cursor\.com\/install-mcp)\?[^\s)"'`<]+/g)].map((m) => new URL(m[0]));
}

describe('install configuration', () => {
  const expected = documentedCommand();

  it('documents the npm package itself', () => {
    expect(expected).toEqual({ command: 'npx', args: ['-y', `${pkg.name}@latest`] });
  });

  it.each(DOCS)('%s: every Cursor link carries the documented command as base64 JSON', (doc) => {
    const links = cursorLinks(read(doc));
    expect(links.length, doc).toBeGreaterThan(0);
    for (const url of links) {
      expect(url.searchParams.get('name'), url.href).toBe('web-stylebook');
      const config = url.searchParams.get('config')!;
      expect(JSON.parse(Buffer.from(config, 'base64').toString('utf8')), url.href).toEqual(expected);
      // Byte-exact: the encoded value is what JSON.stringify of the server object produces.
      expect(config, url.href).toBe(Buffer.from(JSON.stringify(expected)).toString('base64'));
    }
  });

  it('README files show both the official cursor:// deeplink and a GitHub-safe https button', () => {
    for (const doc of ['README.md', 'README.ko.md']) {
      const links = cursorLinks(read(doc)).map((url) => url.protocol);
      expect(links, doc).toContain('cursor:');
      expect(links, doc).toContain('https:');
      expect(read(doc), doc).toContain('(https://cursor.com/deeplink/mcp-install-dark.svg)');
    }
  });

  it.each(DOCS)('%s: every mcpServers JSON block matches the documented command', (doc) => {
    const blocks = [...read(doc).matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]!).filter((block) => block.includes('"mcpServers"'));
    for (const block of blocks) {
      // VS Code's Copilot files and Claude Code's .mcp.json name the transport; Cursor's file may omit it.
      const { type = 'stdio', ...entry } = JSON.parse(block).mcpServers['web-stylebook'];
      expect(type, doc).toBe('stdio');
      expect(entry, doc).toEqual(expected);
    }
  });

  it('README files link VS Code to its install URL with the documented command', () => {
    // VS Code reads the URL-encoded JSON after vscode:mcp/install?; GitHub needs the https redirect around it.
    const install = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'web-stylebook', ...expected }))}`;
    for (const doc of ['README.md', 'README.ko.md']) {
      expect(read(doc), doc).toContain(`(https://vscode.dev/redirect?url=${encodeURIComponent(install)})`);
    }
  });

  it('the Claude Code plugin starts the same server', () => {
    expect(json('.claude-plugin/plugin.json').mcpServers['web-stylebook']).toEqual(expected);
  });

  it('server.json matches package.json for the MCP registry', () => {
    expect(server.$schema).toBe('https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json');
    expect(server.name).toBe(pkg.mcpName);
    expect(server.version).toBe(pkg.version);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.packages).toEqual([
      expect.objectContaining({ registryType: 'npm', identifier: pkg.name, version: pkg.version, transport: { type: 'stdio' } }),
    ]);
    expect(json('.claude-plugin/plugin.json').version).toBe(pkg.version);
  });

  it('manifest.json (MCP bundle for Smithery) matches package.json and server.json', () => {
    const manifest = json('manifest.json');
    expect(manifest).toMatchObject({
      manifest_version: '0.3',
      name: 'web-stylebook',
      version: pkg.version,
      description: server.description,
      author: pkg.author,
      license: pkg.license,
      keywords: pkg.keywords,
      repository: { type: 'git', url: server.repository.url },
      compatibility: { runtimes: { node: pkg.engines.node } },
    });
    // The bundle is staged from the npm package, so the entry point has to be a packaged file.
    expect(manifest.server.type).toBe('node');
    expect(manifest.server.entry_point).toBe(pkg.bin['web-stylebook-mcp']);
    expect(pkg.files).toContain(manifest.server.entry_point.split('/')[0]);
    expect(manifest.server.mcp_config).toMatchObject({ command: 'node', args: [`\${__dirname}/${manifest.server.entry_point}`] });
  });
});
