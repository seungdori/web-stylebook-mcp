import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogRepository } from '../src/catalog/repository.js';
import { startUiDesign } from '../src/start/start-ui-design.js';
import {
  EXPERIMENT_PAGES, buildScorecard, experimentPages, renderScorecard, repositoryPages, shorthandFamily, writeScorecard,
} from '../scripts/evaluate-design-static.js';

const repo = CatalogRepository.load();
const repositoryCard = () => {
  const { inputs, skipped } = repositoryPages();
  return buildScorecard('repository fixtures', inputs, skipped, repo);
};

describe('eval:static on the repository fixtures', () => {
  const card = repositoryCard();

  it('scores every fixture page and matches the committed scorecard', async () => {
    expect(card.pages.length).toBe(38);
    expect(card.skipped).toEqual([]);
    // A rule or detector change that moves a score shows up here; refresh with `npx vitest run tests/static-eval.test.ts -u`.
    await expect(`${JSON.stringify(card, null, 2)}\n`).toMatchFileSnapshot('./fixtures/static-eval/repository-scorecard.json');
    await expect(renderScorecard(card)).toMatchFileSnapshot('./fixtures/static-eval/repository-scorecard.md');
  });

  it('is deterministic and carries no version or hash, so a release alone does not move it', () => {
    expect(JSON.stringify(repositoryCard())).toBe(JSON.stringify(card));
    expect(JSON.stringify(card)).not.toMatch(/"(?:version|rulesetHash|inputHash|catalogContentHash)"/);
  });

  it('runs the three audits on each page', () => {
    const page = card.pages.find((entry) => entry.id === 'page-structure/korean-saas')!;
    expect(page.input.locale).toBe('ko');
    expect(page.structure.patterns).toMatchObject({ 'centered-stack-hero': expect.any(Number) });
    expect(Object.keys(page.assets).sort()).toEqual(expect.arrayContaining(['assets-font-loading', 'assets-image-alt']));
    const commerce = card.pages.find((entry) => entry.id === 'must-haves/commerce-buy-button-only')!;
    expect(commerce.input).toMatchObject({ productType: 'commerce', structureProductType: 'commerce' });
    expect(commerce.structure.mustHavesMissing.length + commerce.structure.mustHavesMisplaced.length).toBeGreaterThan(0);
  });
});

describe('eval:static inputs', () => {
  it('uses the productType start_ui_design passes to audit_page_structure for each experiment page', () => {
    for (const [page, context] of Object.entries(EXPERIMENT_PAGES)) {
      const start = startUiDesign({ productDescription: page, pageRole: context.pageRole, productType: context.productType, locale: 'ko' }, repo);
      const structure = start.next.find((step) => 'tool' in step && step.tool === 'audit_page_structure') as { arguments: { productType?: string } };
      expect(structure.arguments.productType, page).toBe(context.structure);
    }
  });

  it('reads the font family out of the font shorthand, after a weight or style', () => {
    expect(shorthandFamily('400 1rem/1.75 "Noto Sans KR", sans-serif')).toBe('"Noto Sans KR", sans-serif');
    expect(shorthandFamily('14px/1.5 Pretendard, sans-serif')).toBe('Pretendard, sans-serif');
    expect(shorthandFamily('italic 600 clamp(1rem, 2vw, 2rem)/1.2 Inter')).toBe('Inter');
  });
});

describe('eval:static on an experiment folder', () => {
  const page = (body: string, head = '') => `<!doctype html><html lang="ko"><head><title>Minutely — 회의</title>${head}</head><body><main><h1>${body}</h1></main></body></html>`;
  const make = () => {
    const dir = mkdtempSync(join(tmpdir(), 'static-eval-'));
    const run = (name: string, html: string | null, calls?: string[]) => {
      mkdirSync(join(dir, 'runs', name, 'workspace'), { recursive: true });
      if (html !== null) writeFileSync(join(dir, 'runs', name, 'workspace', 'index.html'), html);
      if (calls) writeFileSync(join(dir, 'runs', name, 'mcp-calls.jsonl'), calls.map((tool) => JSON.stringify({ tool })).join('\n'));
    };
    run('landing-off', page('무료로 시작하세요', '<style>body{font-family:"Pretendard Variable",sans-serif}</style>'), []);
    run('landing-on', page('회의록을 할 일로', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&display=swap"><style>body{font:500 16px/1.6 Inter,sans-serif}</style>'),
      ['mcp__web-stylebook__start_ui_design', 'mcp__plugin_web-stylebook_web-stylebook__audit_copy']);
    run('landing-off-interrupted', page('x'));
    run('docs-on-r2', null);
    return dir;
  };

  it('pairs off and on runs, reads their call logs and skips what it cannot score', () => {
    const dir = make();
    try {
      const { inputs, skipped } = experimentPages(dir);
      const card = buildScorecard('test', inputs, skipped, repo);
      expect(card.skipped.map((entry) => entry.source)).toEqual(['runs/docs-on-r2', 'runs/landing-off-interrupted']);
      expect(card.pairs).toHaveLength(1);
      const [off, on] = [card.pages.find((entry) => entry.id === 'landing-off')!, card.pages.find((entry) => entry.id === 'landing-on')!];
      expect(on.input).toMatchObject({ pageRole: 'marketing-landing', productType: 'operational-saas', structureProductType: 'campaign' });
      expect(on.mcp).toEqual({ calls: 2, tools: ['start_ui_design', 'audit_copy'] });
      expect(off.mcp).toEqual({ calls: 0, tools: [] });
      expect(off.facts).toMatchObject({ firstFont: 'Pretendard Variable', fontSources: [], freeStart: true, emDashes: 1 });
      expect(on.facts).toMatchObject({ firstFont: 'Inter', fontSources: ['google'], freeStart: false });
      expect(card.totals.off).toMatchObject({ pretendardVariableFirst: 1, webFontLoaded: 0, noMcpCall: 1, emDash: 1 });
      expect(card.totals.on).toMatchObject({ googleOrFontFace: 1, noMcpCall: 0 });
      expect(renderScorecard(card)).toContain('| landing r1 |');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never writes into the experiment folder', () => {
    const dir = make();
    try {
      const { inputs, skipped } = experimentPages(dir);
      const card = buildScorecard('test', inputs, skipped, repo);
      expect(() => writeScorecard(card, join(dir, 'runs', 'scores'), dir)).toThrow(/inside or contains the experiment folder/);
      expect(() => writeScorecard(card, join(dir, '..'), dir)).toThrow(/inside or contains the experiment folder/);
      const out = mkdtempSync(join(tmpdir(), 'static-eval-out-'));
      const files = writeScorecard(card, out, dir);
      expect(JSON.parse(readFileSync(files[0]!, 'utf8')).schema).toBe('webstylebook.static-eval.v1');
      rmSync(out, { recursive: true, force: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('eval:static stays out of the npm package', () => {
  it('ships no scripts folder', () => {
    const files = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).files as string[];
    expect(files.some((entry) => /^!?scripts\b/.test(entry))).toBe(false);
  });
});
