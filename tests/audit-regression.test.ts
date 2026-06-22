// Regression tests for the content audit (2026-06). Each test locks a confirmed fix.
import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import { compareDirections } from '../src/recommendation/compare.js';
import { contrastRatio } from '../src/tokens/contrast.js';

const repo = CatalogRepository.load();
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.js');

function rejectedFor(constraint: string): Set<string> {
  const r = recommendDesignDirection({ productDescription: 'an app', constraints: [constraint] } as never, repo);
  return new Set(r.rejected.filter((x) => x.reasonCodes.includes('ACCESSIBILITY_CONFLICT')).map((x) => x.styleId));
}

describe('audit HIGH#1 — constraint matcher no longer cross-matches on shared qualifier words', () => {
  it('reduced-motion-required rejects motion-risky styles but NOT contrast-only styles', () => {
    const r = rejectedFor('reduced-motion-required');
    expect(r.has('kinetic-pop')).toBe(true);        // genuine continuous-motion risk
    expect(r.has('quiet-utility')).toBe(false);      // contrast-only risk — must not be rejected
    expect(r.has('bento-bloom')).toBe(false);
  });
  it('high-contrast-required still rejects low-contrast styles', () => {
    expect(rejectedFor('high-contrast-required').has('quiet-utility')).toBe(true);
  });
});

describe('audit HIGH#2 / M2 — accent label color meets WCAG AA for every style and mode', () => {
  it('accentText (and accentSecondaryText) >= 4.5:1 across all styles, light + dark', () => {
    const failures: string[] = [];
    for (const s of repo.allStyles()) {
      for (const mode of ['light', 'dark'] as const) {
        const c = (composeDesignTokens({ primaryStyleId: s.id, format: 'json', colorMode: mode }, repo).tokens as { color: Record<string, string> }).color;
        const r = contrastRatio(c.accentText, c.accent);
        if (r < 4.5) failures.push(`${s.id}/${mode}: accentText ${r.toFixed(3)}`);
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });
});

describe('audit L10 — compose_design_tokens both-mode render branches', () => {
  it('css-variables + both emits :root, dark theme, and prefers-color-scheme blocks', () => {
    const out = composeDesignTokens({ primaryStyleId: 'platform-core', format: 'css-variables', colorMode: 'both' }, repo).rendered;
    expect(out).toContain(':root');
    expect(out).toContain('[data-theme="dark"]');
    expect(out).toContain('prefers-color-scheme');
  });
  it('typescript + both carries light and dark token sets', () => {
    const out = composeDesignTokens({ primaryStyleId: 'platform-core', format: 'typescript', colorMode: 'both' }, repo).rendered;
    expect(out).toContain('light');
    expect(out).toContain('dark');
  });
});

describe('audit M7 — unknown secondaryStyleId is rejected, not silently ignored', () => {
  it('compose_design_tokens throws on an unknown secondaryStyleId', () => {
    expect(() => composeDesignTokens({ primaryStyleId: 'platform-core', secondaryStyleId: 'nope-xyz', format: 'json' }, repo)).toThrow();
  });
  it('compare_design_directions throws on an unknown secondaryStyleId', () => {
    expect(() => compareDirections({ directions: [{ primaryStyleId: 'platform-core' }, { primaryStyleId: 'quiet-utility', secondaryStyleId: 'nope-xyz' }] } as never, repo)).toThrow();
  });
});

describe('audit L12 — all five workflow prompts render a non-empty user message', () => {
  let client: Client;
  const args: Record<string, Record<string, string>> = {
    'design-product': { product: 'a billing dashboard' },
    'design-screen': { screenType: 'data-table', goal: 'triage incidents' },
    'complete-ui-states': { surfaceId: 'form' },
    'redesign-with-style': { current: 'a cluttered form', goal: 'calmer' },
    'audit-design-direction': { styleId: 'platform-core', summary: 'a settings page' },
  };
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'audit-test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
  });
  it('renders each prompt with a substantive instruction', async () => {
    for (const [name, a] of Object.entries(args)) {
      const res = await client.getPrompt({ name, arguments: a });
      const text = (res.messages[0]?.content as { text?: string }).text ?? '';
      expect(text.length, name).toBeGreaterThan(40);
      expect(text, name).toMatch(/webstylebook:\/\/|recommend_design_direction|get_ui_state_plan|compare_design_directions|compose_design_tokens|anti-patterns/);
    }
  });
});

describe('audit L11 — CLI flags', () => {
  const run = (args: string[]): Promise<{ code: number | null; out: string; err: string }> =>
    new Promise((resolve) => {
      const child = spawn('node', [cli, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let err = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { err += d.toString(); });
      child.on('close', (code) => resolve({ code, out, err }));
    });

  it('--version prints a semver and exits 0', async () => {
    const r = await run(['--version']);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toMatch(/\d+\.\d+\.\d+/);
  }, 10000);
  it('--catalog-info emits JSON with catalogVersion + counts', async () => {
    const r = await run(['--catalog-info']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.catalogVersion).toBeDefined();
    expect(j.counts.styles).toBe(48);
  }, 10000);
  it('--validate-catalog exits 0 for the bundled catalog', async () => {
    const r = await run(['--validate-catalog']);
    expect(r.code).toBe(0);
  }, 10000);
});
