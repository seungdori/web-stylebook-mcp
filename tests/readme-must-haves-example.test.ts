import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { auditPageStructure } from '../src/structure/audit.js';
import { MUST_HAVES, PRODUCT_MUST_HAVES } from '../src/structure/must-haves.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = CatalogRepository.load();
const fixture = readFileSync(join(root, 'tests', 'fixtures', 'must-haves', 'commerce-buy-button-only.html'), 'utf8');

describe.each([
  { file: 'README.md', marker: '// ← must-have audit (trimmed)', locale: 'en' as const, counts: /(\d+) must-haves across (\d+) product types/ },
  { file: 'README.ko.md', marker: '// ← 필수 요소 감사 결과 (일부)', locale: 'ko' as const, counts: /제품 유형 (\d+)개의 필수 요소 (\d+)종/ },
])('$file must-haves', ({ file, marker, locale, counts }) => {
  const text = readFileSync(join(root, file), 'utf8');

  it('shows the real audit_page_structure output for the fixture page', () => {
    const start = text.indexOf(marker);
    expect(start, `${file} should contain the must-have audit example`).toBeGreaterThan(-1);
    const block = text.slice(text.indexOf('{', start), text.indexOf('\n```', start));
    const shown = JSON.parse(block.replace(/^\s*\/\/.*$/gm, '')) as any;
    const real = auditPageStructure({ html: fixture, styleId: 'midnight-noir', productType: 'commerce', locale }, repo);
    for (const key of ['productType', 'page', 'missing', 'misplaced'] as const) expect(shown.mustHaves[key], key).toEqual(real.mustHaves![key]);
    for (const item of shown.mustHaves.items) {
      const actual = real.mustHaves!.items.find((candidate) => candidate.id === item.id) as any;
      for (const key of Object.keys(item)) expect(item[key], `${item.id}.${key}`).toEqual(actual[key]);
    }
    const realFindings = real.findings.filter((finding) => finding.scope === 'must-have');
    for (const item of shown.findings) {
      const actual = realFindings.find((finding) => finding.patternId === item.patternId)!;
      for (const key of ['scope', 'severity', 'observed'] as const) expect(item[key], `${item.patternId}.${key}`).toEqual(actual[key]);
      expect(item.replaceWith.instruction).toBe(actual.replaceWith.instruction);
      expect(item.replaceWith.moves).toEqual(actual.replaceWith.moves);
      expect(actual.replaceWith.archetype!.hero.startsWith(item.replaceWith.archetype.hero.replace(/\s*…$/, ''))).toBe(true);
    }
    const named = block.match(/must-have\/[a-z-]+/g) ?? [];
    expect([...new Set(named)].sort()).toEqual(realFindings.map((finding) => finding.patternId).sort());
  });

  it('lists each product type\'s must-haves and zones as the data defines them', () => {
    for (const entry of PRODUCT_MUST_HAVES) {
      const row = text.split('\n').find((line) => line.startsWith(`| \`${entry.productType}\` |`));
      expect(row, `${file} row for ${entry.productType}`).toBeDefined();
      const [, , page, first, anywhere] = row!.split('|').map((cell) => cell.trim());
      const ids = (cell: string) => [...cell.matchAll(/`([a-z-]+)`/g)].map((match) => match[1]);
      expect(page).toBe(entry.page[locale]);
      expect(ids(first!)).toEqual(entry.items.filter((item) => item.zone === 'first-screen').map((item) => item.id));
      expect(ids(anywhere!)).toEqual(entry.items.filter((item) => item.zone === 'page').map((item) => item.id));
    }
    const match = counts.exec(text);
    expect(match, `${file} must-have counts`).not.toBeNull();
    const numbers = match!.slice(1).map(Number);
    expect(numbers).toEqual(locale === 'en' ? [MUST_HAVES.length, PRODUCT_MUST_HAVES.length] : [PRODUCT_MUST_HAVES.length, MUST_HAVES.length]);
  });
});
