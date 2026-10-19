import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { auditPageStructure } from '../src/structure/audit.js';
import { structureManifest } from '../src/structure/guidance.js';
import { STRUCTURE_GUIDES } from '../src/structure/guides/index.js';
import { STYLE_RULE_IDS } from '../src/structure/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = CatalogRepository.load();
const fixture = readFileSync(join(root, 'tests', 'fixtures', 'page-structure', 'generic-saas-tailwind.html'), 'utf8');

function shownBlock(file: string, marker: string) {
  const text = readFileSync(join(root, file), 'utf8');
  const start = text.indexOf(marker);
  expect(start, `${file} should contain the structure audit example`).toBeGreaterThan(-1);
  const block = text.slice(text.indexOf('{', start), text.indexOf('\n```', start));
  const others = /\/\/ [^:\n]+: ([a-z0-9/, -]+)$/m.exec(block)?.[1]?.split(', ') ?? [];
  return { text, shown: JSON.parse(block.replace(/\s\/\/.*$/gm, '')) as any, others };
}

describe.each([
  { file: 'README.md', marker: '// ← structure audit (trimmed)', locale: 'en' as const, counts: /\*\*Structure:\*\* (\d+) layout archetypes · (\d+) signature moves · (\d+) banned generic patterns · (\d+) style-specific bans from (\d+) detectors/ },
  { file: 'README.ko.md', marker: '// ← 구조 감사 결과 (일부)', locale: 'ko' as const, counts: /\*\*구조:\*\* 레이아웃 아키타입 (\d+) · 시그니처 무브 (\d+) · 일반 금지 패턴 (\d+) · 탐지기 (\d+)종으로 만든 스타일 전용 금지 항목 (\d+)/ },
])('$file structure example', ({ file, marker, locale, counts }) => {
  it('is the real audit_page_structure output for the fixture page', () => {
    const { shown, others } = shownBlock(file, marker);
    const real = auditPageStructure({ html: fixture, styleId: 'quiet-utility', locale }, repo);
    expect(shown.summary).toEqual(real.summary);
    for (const item of shown.findings) {
      const actual = real.findings.find((finding) => finding.patternId === item.patternId)!;
      expect(actual, item.patternId).toBeDefined();
      for (const key of ['name', 'severity', 'locations', 'observed'] as const) {
        if (key in item) expect(item[key], `${item.patternId}.${key}`).toEqual(actual[key]);
      }
      if (item.replaceWith.instruction) expect(item.replaceWith.instruction).toBe(actual.replaceWith.instruction);
      if (item.replaceWith.moves) {
        expect(item.replaceWith.moves).toEqual(actual.replaceWith.moves.map(({ id, name, purpose }) => ({ id, name, purpose })));
      }
      if (item.replaceWith.archetype) expect(item.replaceWith.archetype).toEqual(actual.replaceWith.archetype);
    }
    const shownIds = shown.findings.map((item: { patternId: string }) => item.patternId);
    expect([...shownIds, ...others].sort()).toEqual(real.findings.map((finding) => finding.patternId).sort());
  });

  it('states the real structure counts', () => {
    const { text } = shownBlock(file, marker);
    const match = counts.exec(text);
    expect(match, `${file} structure counts line`).not.toBeNull();
    const summary = structureManifest(repo);
    const numbers = match!.slice(1).map(Number);
    const expected = locale === 'en'
      ? [summary.styles, summary.signatureMoves, summary.globalBannedPatterns, summary.styleBans, STYLE_RULE_IDS.length]
      : [summary.styles, summary.signatureMoves, summary.globalBannedPatterns, STYLE_RULE_IDS.length, summary.styleBans];
    expect(numbers).toEqual(expected);
    expect(summary.styles).toBe(STRUCTURE_GUIDES.length);
  });
});
