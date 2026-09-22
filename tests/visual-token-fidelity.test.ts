import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CatalogRepository } from '../src/catalog/repository.js';
import { VisualContractRepository, type VisualLibrary } from '../src/catalog/visual.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import { stableVisualJson, visualContentHash } from '../src/visual-canonical/hash.js';
import { resolveContract } from '../src/visual-canonical/resolve.js';
import { typographyRoleStyle, visualContractToCss } from '../src/visual-canonical/export.js';
import type { ResolvedVisualContract, VisualContract } from '../src/visual-canonical/types.js';

const repo = CatalogRepository.load();
const contract = { schema: 'webstylebook.visual.v1' };
const compose = (args: Record<string, unknown> = {}, fixture = repo) => composeDesignTokens({ primaryStyleId: 'brutalist-grid', contract, format: 'json', ...args }, fixture);
const single = (args: Record<string, unknown> = {}, fixture = repo) => compose(args, fixture).visualContract as ResolvedVisualContract;
function withFixture(authored: VisualContract) {
  const { revision: _revision, ...data } = authored;
  authored.revision = visualContentHash(data);
  const base = { schema: 'webstylebook.visual-library.v1' as const, catalogVersion: 'test', contracts: { [authored.styleId]: authored } };
  const contentHash = `sha256:${createHash('sha256').update(stableVisualJson(base)).digest('hex')}`;
  const fixture = new CatalogRepository(repo.envelope);
  Object.defineProperty(fixture, 'visualRepository', { value: new VisualContractRepository({ ...base, contentHash }) });
  return fixture;
}
function exportedJson(source: string, name: string) {
  const marker = `export const ${name} = `;
  return JSON.parse(source.slice(source.indexOf(marker) + marker.length).replace(/ as const;\s*$/, '').replace(/;\s*$/, ''));
}

describe('pinned visual contract fidelity', () => {
  it('has a complete approved offline artifact with exact source provenance', () => {
    expect(repo.visualContractMetadata.styleCount).toBe(repo.allStyles().length);
    const provenance = JSON.parse(readFileSync(new URL('../generated/visual-contract-source.v1.json', import.meta.url), 'utf8'));
    expect(provenance.license).toBe('MIT');
    for (const [file, digest] of Object.entries(provenance.files)) {
      const name = String(file).split('/').pop();
      const bytes = readFileSync(new URL(name === 'LICENSE' ? '../generated/visual-contract-LICENSE' : `../src/visual-canonical/${name}`, import.meta.url));
      expect(`sha256:${createHash('sha256').update(bytes).digest('hex')}`).toBe(digest);
      expect(bytes.toString('utf8')).toContain(name === 'LICENSE' ? 'MIT License' : 'SPDX-License-Identifier: MIT');
    }
  });

  it('uses the same resolver for every style and every supported locale/mode', () => {
    for (const authored of Object.values(repo.visualContracts.library.contracts)) {
      for (const mode of Object.keys(authored.modes) as Array<'light' | 'dark'>) {
        for (const locale of ['en', 'ko', 'ja'] as const) {
          const overrides = { typography: { body: { lineHeight: 1.8, letterSpacingEm: 0 } }, density: 'compact' as const };
          const expected = resolveContract(authored, { mode, contentLocale: locale, overrides });
          expect(single({ primaryStyleId: authored.styleId, colorMode: mode, locale, overrides })).toEqual(expected);
        }
      }
    }
  });

  it('preserves Brutalist text, identity accent and shadow none', () => {
    const spec = single();
    expect(spec.colors.text.toLowerCase()).toMatch(/^#(?:111|111111)$/);
    expect(spec.colors.accent.toLowerCase()).toBe('#d72600');
    expect(Object.values(spec.shadows)).toEqual(['none', 'none', 'none']);
    expect(compose().tokens).toMatchObject({ color: { text: spec.colors.text, accent: spec.colors.accent }, shadow: spec.shadows });
  });

  it('preserves the authored Editorial and mono typography rather than family substitutions', () => {
    const editorial = single({ primaryStyleId: 'editorial-silence' });
    expect(editorial.typography.roles.display.fontFamily).toMatch(/serif|georgia|fraunces|playfair|times/i);
    const mono = Object.values(repo.visualContracts.library.contracts).find((style) => /mono|courier/i.test(style.typography.roles.body.fontFamily));
    expect(mono).toBeDefined();
    expect(single({ primaryStyleId: mono!.styleId }).typography.roles.body.fontFamily).toBe(mono!.typography.roles.body.fontFamily);
  });

  it('density controls spacing, row and gutter and retains explicit zero tracking', () => {
    const compact = single({ density: 'compact', overrides: { typography: { body: { letterSpacingEm: 0, paragraphSpacingEm: 0 } } } });
    const comfortable = single({ density: 'comfortable' });
    expect(compact.spacing).toMatchObject({ density: 'compact', row: 32, gutter: 12, stack: 12 });
    expect(comfortable.spacing).toMatchObject({ density: 'comfortable', row: 44, gutter: 24, stack: 20 });
    expect(compact.typography.roles.body).toMatchObject({ letterSpacingEm: 0, paragraphSpacingEm: 0 });
    expect(compact.origins['typography.roles.body.letterSpacingEm']).toBe('override');
  });

  it('all four formats preserve role fields and expose the complete metadata companion', () => {
    for (const format of ['json', 'css-variables', 'tailwind', 'typescript'] as const) {
      const result = compose({ format, locale: 'ko', overrides: { typography: { body: { fontWeight: 550, lineHeight: 1.87, letterSpacingEm: 0, paragraphSpacingEm: 0 } } } });
      const spec = result.visualContract as ResolvedVisualContract;
      expect(spec.typography.roles.body).toMatchObject({ fontWeight: 550, lineHeight: 1.87, wordBreak: 'keep-all' });
      if (format === 'json') expect(JSON.parse(result.rendered)).toEqual(spec);
      if (format === 'typescript') expect(exportedJson(result.rendered, 'visualContract')).toEqual(spec);
      if (format === 'tailwind') {
        const theme = exportedJson(result.rendered, 'theme');
        expect(theme.metadata).toEqual(spec);
        expect(theme.roleStyles.body).toEqual(typographyRoleStyle(spec.typography.roles.body));
        expect(theme.extend.fontSize.body[1]).toMatchObject({ lineHeight: '1.87', fontWeight: '550' });
      }
      if (format === 'css-variables') {
        expect(result.rendered).toContain('--type-body-line-height: 1.87;');
        expect(result.rendered).toContain('--type-body-letter-spacing: 0em;');
        expect(result.rendered).toContain('--type-body-margin-block-end: 0em;');
        expect(result.rendered).toContain('--type-body-word-break: keep-all;');
        expect(result.rendered).toContain('.ws-type-data');
        expect(result.rendered).toContain('--shadow-md: none;');
        expect(result.rendered).toBe(visualContractToCss(spec));
      }
    }
  });

  it('keeps both mode typography/surfaces, zeros and none in every renderer', () => {
    const authored = structuredClone(repo.visualContracts.authored('brutalist-grid'));
    const light = authored.modes.light!;
    authored.modes.dark = { ...structuredClone(light), typography: { ...structuredClone(authored.typography), roles: { ...structuredClone(authored.typography.roles), body: { ...authored.typography.roles.body, lineHeight: 2, fontWeight: 650 } } }, motion: { ...authored.motion, duration: 0 }, borders: { ...authored.borders, width: 0 }, radii: { sm: 0, md: 0, lg: 0 }, shadows: { sm: 'none', md: 'none', lg: 'none' } };
    const fixture = withFixture(authored);
    for (const format of ['json', 'css-variables', 'tailwind', 'typescript'] as const) {
      const result = compose({ colorMode: 'both', format }, fixture);
      const both = result.visualContract as { light: ResolvedVisualContract; dark: ResolvedVisualContract };
      expect(both.dark.typography.roles.body.lineHeight).toBe(2);
      expect(both.light.typography.roles.body.lineHeight).not.toBe(2);
      expect(both.dark.motion.duration).toBe(0);
      expect(both.dark.borders.width).toBe(0);
      if (format === 'tailwind') expect(exportedJson(result.rendered, 'themes').dark.metadata).toEqual(both.dark);
      if (format === 'typescript') expect(exportedJson(result.rendered, 'visualContract')).toEqual(both);
      if (format === 'json') expect(JSON.parse(result.rendered)).toEqual(both);
      if (format === 'css-variables') {
        expect(result.rendered).toContain('[data-theme="dark"]');
        expect(result.rendered).toContain('--type-body-line-height: 2;');
        expect(result.rendered).toContain('--motion-duration: 0ms;');
        expect(result.rendered).toContain('--border-width: 0px;');
      }
    }
  });

  it('returns deterministic errors for stale hashes/revisions, missing modes and unsafe overrides', () => {
    expect(() => compose({ contract: { schema: 'unknown' } })).toThrow(/Unsupported visual contract schema/);
    expect(() => compose({ contract: { ...contract, contentHash: 'sha256:missing' } })).toThrow(/not bundled/);
    expect(() => compose({ contract: { ...contract, revision: 'fnv1a:missing' } })).toThrow(/not bundled/);
    expect(() => compose({ overrides: { typography: { body: { fontFamily: 'Arial; color: red' } } } })).toThrow();
    expect(() => compose({ overrides: { colors: { text: 'url(https://bad.example)' } } })).toThrow();
    expect(() => compose({ density: 'compact', overrides: { density: 'comfortable' } })).toThrow(/conflicts/);
    expect(() => compose({ overrides: { density: 'compact', spacing: { row: 70, density: 'comfortable' } } })).toThrow(/conflict/);
    expect(single({ accentOverride: 'fff', overrides: { colors: { accent: '#ffffff' } } }).colors.accent).toBe('#fff');
    expect(() => compose({ secondaryStyleId: 'editorial-silence' })).toThrow(/legacy accent-only/);
    const unsupported = Object.values(repo.visualContracts.library.contracts).find((style) => Object.keys(style.modes).length === 1)!;
    expect(() => compose({ primaryStyleId: unsupported.styleId, colorMode: 'both' })).toThrow(/no authored/);
    const broken = structuredClone(repo.visualContracts.library) as VisualLibrary;
    broken.contracts['brutalist-grid']!.typography.roles.body.lineHeight = 2;
    expect(() => new VisualContractRepository(broken)).toThrow(/contentHash mismatch/);
    expect(() => VisualContractRepository.load('/tmp/missing-webstylebook-fixture')).toThrow(/Runtime network fallback is disabled/);
  });

  it('only applies accepted current repairs and preserves identity accents', () => {
    const overrides = { colors: { text: '#e6e6e1' } };
    const result = compose({ overrides });
    const proposals = result.repairProposals as import('../src/visual-canonical/types.js').VisualRepair[];
    const textRepair = proposals.find((proposal) => proposal.role === 'text')!;
    expect(textRepair).toBeDefined();
    expect(single({ overrides }).colors.text).toBe('#e6e6e1');
    const accepted = single({ overrides, acceptedRepairs: [textRepair] });
    expect(accepted.colors.text).toBe(textRepair.after);
    expect(accepted.colors.accent).toBe(single().colors.accent);
    expect(accepted.repairs).toEqual([textRepair]);
    expect(() => compose({ colorMode: 'both', overrides, acceptedRepairs: [textRepair] })).toThrow(/mode-specific/);
    expect(() => compose({ overrides, acceptedRepairs: [{ ...textRepair, after: '#123456' }] })).toThrow(/stale|not a current proposal/);
  });
});
