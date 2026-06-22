import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');

describe('stdio hygiene', () => {
  it('stdout carries only JSON-RPC — no log pollution', async () => {
    const child = spawn('node', [cli], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });

    const init = {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    };
    child.stdin.write(`${JSON.stringify(init)}\n`);
    await new Promise((r) => setTimeout(r, 700));
    child.kill();

    const lines = out.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length, 'server should respond on stdout').toBeGreaterThan(0);
    for (const line of lines) {
      expect(() => JSON.parse(line), `non-JSON on stdout: ${line}`).not.toThrow();
      expect(JSON.parse(line).jsonrpc).toBe('2.0');
    }
    // the connect log must go to stderr, not stdout
    expect(err).toContain('web-stylebook-mcp');
  }, 10000);
});
