import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { TOOL_NAMES } from '../src/server-info.js';

// The skill falls back to these commands when no MCP client is connected, so they must give the
// same answers as the MCP tools and fail in ways an agent can act on.
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');
const run = (args: string[], input?: string) =>
  spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8', timeout: 30_000 });

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'wsm-cli-')); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

// Each command starts a fresh process that loads the catalog, so allow more than the default 5s.
describe('CLI tool commands', { timeout: 60_000 }, () => {
  it('tools lists every registered tool, one per line', () => {
    const r = run(['tools']);
    expect(r.status).toBe(0);
    const names = r.stdout.trim().split('\n').map((l) => l.split(/\s+/)[0]);
    expect(names.sort()).toEqual([...TOOL_NAMES].sort());
    const json = JSON.parse(run(['tools', '--json']).stdout) as Array<{ name: string; summary: string }>;
    expect(json.every((t) => t.summary.length > 0 && t.summary.length <= 161)).toBe(true);
  });

  it('schema prints the input schema the MCP client sees', () => {
    const r = run(['schema', 'compose_design_tokens']);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.name).toBe('compose_design_tokens');
    expect(out.inputSchema.properties.primaryStyleId).toBeDefined();
  });

  it('call returns the same structured result as an MCP tool call, from a string, a file and stdin', async () => {
    const args = { primaryStyleId: 'quiet-utility', format: 'css-variables' };
    const server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    const viaMcp = (await client.callTool({ name: 'compose_design_tokens', arguments: args })).structuredContent;
    await client.close();

    const file = join(dir, 'args.json');
    writeFileSync(file, JSON.stringify(args));
    for (const r of [
      run(['call', 'compose_design_tokens', JSON.stringify(args)]),
      run(['call', 'compose_design_tokens', '--input', file]),
      run(['call', 'compose_design_tokens', '-'], JSON.stringify(args)),
    ]) {
      expect(r.status, r.stderr).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual(viaMcp);
    }
    // Windows PowerShell 5.1 writes UTF-8 files with a byte-order mark.
    const bom = join(dir, 'args-bom.json');
    writeFileSync(bom, `﻿${JSON.stringify(args)}`);
    const withBom = run(['call', 'compose_design_tokens', '--input', bom]);
    expect(withBom.status, withBom.stderr).toBe(0);
    expect(JSON.parse(withBom.stdout)).toEqual(viaMcp);
    const utf16 = join(dir, 'args-utf16.json');
    writeFileSync(utf16, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON.stringify(args), 'utf16le')]));
    const withUtf16 = run(['call', 'compose_design_tokens', '--input', utf16]);
    expect(withUtf16.status, withUtf16.stderr).toBe(0);
    expect(JSON.parse(withUtf16.stdout)).toEqual(viaMcp);
    const text = run(['call', 'compose_design_tokens', '--input', file, '--text']);
    expect(text.stdout).toContain('--color-canvas');
  });

  it('a tool error exits 1 and still prints an error object', () => {
    const r = run(['call', 'compose_design_tokens', '{"primaryStyleId":"no-such-style","format":"json"}']);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).error.message).toBeTruthy();
  });

  it('arguments the schema rejects exit 1 with the validation message', () => {
    const r = run(['call', 'get_design_improvement_plan', '{"surface":"dashboard"}']);
    expect(r.status).toBe(1);
    const err = JSON.parse(r.stdout).error;
    expect(err.code).toBe('INVALID_ARGUMENTS');
    expect(err.message).toMatch(/surface/);
    expect(err.message).not.toMatch(/^MCP error/);
  });

  it('usage mistakes exit 2 with help on stderr and nothing on stdout', () => {
    for (const args of [['call'], ['call', 'no_such_tool'], ['call', 'compose_design_tokens', '{bad'], ['call', 'compose_design_tokens', '[1]'], ['call', 'compose_design_tokens', '--input', join(dir, 'missing.json')], ['call', 'compose_design_tokens', '--input'], ['schema'], ['read']]) {
      const r = run(args);
      expect(r.status, args.join(' ')).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/call <tool>/);
    }
  });

  it('read returns resources and reports unknown ones as errors', () => {
    const ok = run(['read', 'webstylebook://workflows/improve-ui']);
    expect(ok.status).toBe(0);
    expect(JSON.parse(ok.stdout).entryTool).toBe('get_design_improvement_plan');
    const missing = run(['read', 'webstylebook://nope']);
    expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stdout).error.message).toMatch(/not found/);
  });

  it('an unknown command fails instead of silently starting the stdio server', () => {
    const r = run(['frobnicate']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unknown option\(s\) or command: frobnicate/);
  });
});
