import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');

describe('stdio hygiene', () => {
  it('stdout carries only JSON-RPC — no log pollution', async () => {
    const child = spawn(process.execPath, [cli], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));

    // Wait for protocol output and the connection log, not a machine-speed guess.
    const ready = new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(deadline);
        child.stdout.off('data', check);
        child.stderr.off('data', check);
        child.off('error', failed);
        child.off('close', earlyClose);
        child.stdin.off('error', failed);
        if (error) reject(error); else resolve();
      };
      const check = () => {
        if (out.includes('\n') && err.includes('connected via stdio')) finish();
      };
      const failed = (error: Error) => finish(error);
      const earlyClose = () => finish(new Error(`Server exited before initialization: ${err}`));
      const deadline = setTimeout(() => finish(new Error(`No initialization response: ${err}`)), 5000);
      child.stdout.on('data', check);
      child.stderr.on('data', check);
      child.once('error', failed);
      child.once('close', earlyClose);
      child.stdin.once('error', failed);
    });

    const init = {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } },
    };
    try {
      child.stdin.write(`${JSON.stringify(init)}\n`);
      await ready;
    } finally {
      child.kill();
      await closed;
    }

    const lines = out.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length, 'server should respond on stdout').toBeGreaterThan(0);
    for (const line of lines) {
      expect(() => JSON.parse(line), `non-JSON on stdout: ${line}`).not.toThrow();
      expect(JSON.parse(line).jsonrpc).toBe('2.0');
    }
    expect(lines.map((line) => JSON.parse(line))).toEqual(expect.arrayContaining([
      expect.objectContaining({ jsonrpc: '2.0', id: 1, result: expect.any(Object) }),
    ]));
    // the connect log must go to stderr, not stdout
    expect(err).toContain('web-stylebook-mcp');
  }, 10000);
});
