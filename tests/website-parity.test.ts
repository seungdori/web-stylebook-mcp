import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import type { DesignTokens } from '../src/types.js';
import type { ResolvedVisualContract } from '../src/visual-canonical/types.js';

const repo = CatalogRepository.load();
const contract = { schema: 'webstylebook.visual.v1' };
const genericSoftShadows = [
  '0 1px 2px rgba(0,0,0,0.06)',
  '0 4px 12px rgba(0,0,0,0.10)',
  '0 12px 32px rgba(0,0,0,0.16)',
];
const legacyLineHeight = { tight: 1.2, normal: 1.5, relaxed: 1.7 };

interface ParityCase {
  styleId: string;
  group: 'brutalist-grid' | 'editorial' | 'mono' | 'control';
  authoredFonts: boolean;
  mode: 'light' | 'dark';
  locale: 'en';
  defaultMode: 'light' | 'dark';
  overrides?: { colors: { text: string }; typography: { body: { lineHeight: number; letterSpacingEm: number } }; density: 'compact' };
  resolved: ResolvedVisualContract;
  css: string;
}

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/website-visual-parity.v1.json'), 'utf8')) as {
  schema: string;
  source: string;
  sourceRevision: string;
  cases: ParityCase[];
};

function familyFonts(styleId: string) {
  const style = repo.getStyle(styleId);
  const family = style?.styleFamilyId ? repo.getFamily(style.styleFamilyId) : undefined;
  return family?.tokenDefaults.typography;
}

describe('pinned website visual parity', () => {
  it('covers brutalist-grid, editorial, and mono styles from the published website revision', () => {
    expect(fixture.schema).toBe('webstylebook.website-parity-fixture.v1');
    expect(fixture.source).toBe('https://github.com/seungdori/web-stylebook');
    expect(fixture.sourceRevision).toBe('b6771f98480eabbe3dc602ab7c5dfd665d338178');
    expect(new Set(fixture.cases.map((item) => item.group))).toEqual(new Set(['brutalist-grid', 'editorial', 'mono', 'control']));
    expect(fixture.cases.some((item) => item.styleId === 'brutalist-grid')).toBe(true);
    expect(fixture.cases.some((item) => item.styleId === 'editorial-silence')).toBe(true);
    expect(fixture.cases.some((item) => item.styleId === 'mono-type')).toBe(true);
  });

  it('matches contract-path color, type, and surface output to the pinned website artifact without network', () => {
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args);
      throw new Error('website parity tests must not use the network');
    }) as typeof fetch;
    try {
      for (const item of fixture.cases) {
        const input = {
          primaryStyleId: item.styleId,
          contract,
          colorMode: item.mode,
          locale: item.locale,
          ...(item.overrides ? { overrides: item.overrides } : {}),
        };
        const json = composeDesignTokens({ ...input, format: 'json' }, repo);
        const css = composeDesignTokens({ ...input, format: 'css-variables' }, repo);
        const label = `${item.styleId}/${item.mode}/${item.overrides ? 'edited' : 'authored'}`;
        expect(json.visualContract, label).toEqual(item.resolved);
        expect(JSON.parse(json.rendered), label).toEqual(item.resolved);
        expect(css.rendered, label).toBe(item.css);
        expect((json.visualContract as ResolvedVisualContract).colors.text).toBe(item.resolved.colors.text);
        expect((json.visualContract as ResolvedVisualContract).colors.accent).toBe(item.resolved.colors.accent);
        expect((json.visualContract as ResolvedVisualContract).shadows).toEqual(item.resolved.shadows);
        expect((json.visualContract as ResolvedVisualContract).typography.roles.display.fontFamily).toBe(item.resolved.typography.roles.display.fontFamily);
        expect((json.visualContract as ResolvedVisualContract).typography.roles.body.fontFamily).toBe(item.resolved.typography.roles.body.fontFamily);
      }
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('emits authored shadows and editorial or mono fonts from calls that omit contract', () => {
    const plain = fixture.cases.filter((item) => item.overrides === undefined);
    for (const item of plain) {
      const result = composeDesignTokens({
        primaryStyleId: item.styleId, format: 'json', colorMode: item.mode,
      }, repo);
      const tokens = result.tokens as DesignTokens;
      const label = `${item.styleId}/${item.mode}`;
      expect(result.visualContract, label).toBeUndefined();
      expect(tokens.shadow, label).toEqual(item.resolved.shadows);
      expect(tokens.typography.lineHeight, label).toEqual(legacyLineHeight);
      for (const shadow of genericSoftShadows) {
        if (!Object.values(item.resolved.shadows).includes(shadow)) expect(result.rendered, label).not.toContain(shadow);
      }
      const defaults = familyFonts(item.styleId);
      expect(defaults, label).toBeDefined();
      if (item.authoredFonts) {
        expect(tokens.typography.displayFamily, label).toBe(item.resolved.typography.roles.display.fontFamily);
        expect(tokens.typography.bodyFamily, label).toBe(item.resolved.typography.roles.body.fontFamily);
        expect(tokens.typography.monoFamily, label).toBe(item.resolved.typography.roles.data.fontFamily);
        const changed = defaults!.displayFamily !== tokens.typography.displayFamily
          || defaults!.bodyFamily !== tokens.typography.bodyFamily
          || defaults!.monoFamily !== tokens.typography.monoFamily;
        expect(changed, label).toBe(true);
        expect(result.notes.some((note) => note.includes('authored faces')), label).toBe(true);
        expect(result.notes.some((note) => note.includes('suggests a serif')), label).toBe(false);
      } else {
        expect(tokens.typography.displayFamily, label).toBe(defaults!.displayFamily);
        expect(tokens.typography.bodyFamily, label).toBe(defaults!.bodyFamily);
        expect(tokens.typography.monoFamily, label).toBe(defaults!.monoFamily);
        expect(result.notes.some((note) => note.includes('family starting points') || note.includes('family-defaults')), label).toBe(true);
      }
    }
  });
});
