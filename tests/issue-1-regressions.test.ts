import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import type { DesignTokens } from '../src/types.js';
import type { ResolvedVisualContract } from '../src/visual-canonical/types.js';

const repo = CatalogRepository.load();
const contract = { schema: 'webstylebook.visual.v1' };
const formats = ['json', 'css-variables', 'tailwind', 'typescript'] as const;
const genericSoftShadows = [
  '0 1px 2px rgba(0,0,0,0.06)',
  '0 4px 12px rgba(0,0,0,0.10)',
  '0 12px 32px rgba(0,0,0,0.16)',
];
const legacyLineHeight = { tight: 1.2, normal: 1.5, relaxed: 1.7 };

function exportedJson(rendered: string, name: string): Record<string, any> {
  const marker = `export const ${name} = `;
  const start = rendered.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return JSON.parse(rendered.slice(start + marker.length).replace(/ as const;\s*$/, '').replace(/;\s*$/, ''));
}

function withoutSecondaryAccent(tokens: DesignTokens): DesignTokens {
  const color = { ...tokens.color };
  delete color.accentSecondary;
  delete color.accentSecondaryText;
  return { ...tokens, color };
}

function withHostileFamilyDensity(): CatalogRepository {
  const envelope = structuredClone(repo.envelope);
  const style = envelope.data.styles.find((item) => item.id === 'brutalist-grid');
  const family = envelope.data.styleFamilies.find((item) => item.id === style?.styleFamilyId);
  expect(family?.tokenDefaults).toBeDefined();
  family!.tokenDefaults.density = { row: '99px', gutter: '77px', panel: '30px' };
  return new CatalogRepository(envelope);
}

describe('issue 1 fidelity regressions', () => {
  it('keeps brutalist-grid free of generic soft shadows in every contract renderer', () => {
    for (const format of formats) {
      const result = composeDesignTokens({
        primaryStyleId: 'brutalist-grid', contract, format,
      }, repo);
      const spec = result.visualContract as ResolvedVisualContract;
      expect(spec.colors.text.toLowerCase()).toMatch(/^#(?:111|111111)$/);
      expect(spec.colors.accent.toLowerCase()).toBe('#d72600');
      expect(spec.shadows).toEqual({ sm: 'none', md: 'none', lg: 'none' });
      expect((result.tokens as DesignTokens).shadow).toEqual(spec.shadows);
      for (const shadow of genericSoftShadows) expect(result.rendered).not.toContain(shadow);
      if (format === 'json') expect(JSON.parse(result.rendered).shadows).toEqual(spec.shadows);
      if (format === 'typescript') expect(exportedJson(result.rendered, 'visualContract').shadows).toEqual(spec.shadows);
      if (format === 'tailwind') expect(exportedJson(result.rendered, 'theme').extend.boxShadow).toEqual(spec.shadows);
      if (format === 'css-variables') {
        expect(result.rendered).toContain('--shadow-sm: none;');
        expect(result.rendered).toContain('--shadow-md: none;');
        expect(result.rendered).toContain('--shadow-lg: none;');
      }
    }
  });

  it('applies compact and comfortable density to row and gutter when family defaults exist', () => {
    const fixture = withHostileFamilyDensity();
    const legacy = (density?: 'comfortable' | 'compact') => composeDesignTokens({
      primaryStyleId: 'brutalist-grid', format: 'json', density,
    }, fixture).tokens as DesignTokens;
    expect(legacy().density).toEqual({ row: '99px', gutter: '77px', panel: '30px' });
    expect(legacy('compact').density).toEqual({ row: '32px', gutter: '12px', panel: '30px' });
    expect(legacy('comfortable').density).toEqual({ row: '40px', gutter: '20px', panel: '30px' });

    for (const format of formats) {
      const compact = composeDesignTokens({
        primaryStyleId: 'brutalist-grid', contract, format, density: 'compact',
      }, fixture);
      const comfortable = composeDesignTokens({
        primaryStyleId: 'brutalist-grid', contract, format, density: 'comfortable',
      }, fixture);
      const compactSpec = compact.visualContract as ResolvedVisualContract;
      const comfortableSpec = comfortable.visualContract as ResolvedVisualContract;
      expect(compactSpec.spacing).toMatchObject({ density: 'compact', row: 32, gutter: 12, stack: 12 });
      expect(comfortableSpec.spacing).toMatchObject({ density: 'comfortable', row: 44, gutter: 24, stack: 20 });
      expect((compact.tokens as DesignTokens).density).toEqual({ row: '32px', gutter: '12px' });
      expect((comfortable.tokens as DesignTokens).density).toEqual({ row: '44px', gutter: '24px' });
      expect(compact.rendered).not.toContain('99px');
      expect(compact.rendered).not.toContain('77px');
      if (format === 'css-variables') {
        expect(compact.rendered).toContain('--density-row: 32px;');
        expect(compact.rendered).toContain('--density-gutter: 12px;');
        expect(compact.rendered).toContain('--spacing-row: 32px;');
        expect(comfortable.rendered).toContain('--density-row: 44px;');
        expect(comfortable.rendered).toContain('--spacing-gutter: 24px;');
      }
    }
  });

  it('keeps line-height in legacy json, css, typescript, and tailwind output', () => {
    for (const colorMode of ['light', 'both'] as const) {
      for (const format of formats) {
        const result = composeDesignTokens({
          primaryStyleId: 'brutalist-grid', format, colorMode,
        }, repo);
        const tokens = colorMode === 'both'
          ? result.tokens as { light: DesignTokens; dark: DesignTokens }
          : { [colorMode]: result.tokens as DesignTokens };
        for (const expected of Object.values(tokens)) {
          expect(expected.typography.lineHeight).toEqual(legacyLineHeight);
        }
        if (format === 'json') {
          const parsed = JSON.parse(result.rendered);
          const rendered = colorMode === 'both' ? [parsed.light, parsed.dark] : [parsed];
          for (const item of rendered) expect(item.typography.lineHeight).toEqual(legacyLineHeight);
        }
        if (format === 'typescript') {
          const parsed = exportedJson(result.rendered, 'tokens');
          const rendered = colorMode === 'both' ? [parsed.light, parsed.dark] : [parsed];
          for (const item of rendered) expect(item.typography.lineHeight).toEqual(legacyLineHeight);
        }
        if (format === 'css-variables') {
          for (const [key, value] of Object.entries(legacyLineHeight)) {
            expect(result.rendered).toContain(`--line-height-${key}: ${value};`);
          }
        }
        if (format === 'tailwind') {
          const theme = exportedJson(result.rendered, 'theme');
          if (colorMode === 'both') {
            const themes = exportedJson(result.rendered, 'themes');
            expect(themes.light.lineHeight).toEqual(legacyLineHeight);
            expect(themes.dark.lineHeight).toEqual(legacyLineHeight);
          } else {
            expect(theme.lineHeight).toEqual(legacyLineHeight);
          }
        }
      }
    }
  });

  it('keeps authored role line-heights in every contract renderer', () => {
    for (const format of formats) {
      const result = composeDesignTokens({
        primaryStyleId: 'brutalist-grid', contract, format, colorMode: 'light',
      }, repo);
      const spec = result.visualContract as ResolvedVisualContract;
      expect(spec.typography.roles.display.lineHeight).toBe(0.82);
      expect(spec.typography.roles.body.lineHeight).toBe(1.65);
      expect((result.tokens as DesignTokens).typography.lineHeight).toEqual({
        tight: spec.typography.roles.display.lineHeight,
        normal: spec.typography.roles.body.lineHeight,
        relaxed: spec.typography.roles.small.lineHeight,
      });
      if (format === 'json') {
        const parsed = JSON.parse(result.rendered);
        expect(parsed.typography.roles.display.lineHeight).toBe(0.82);
        expect(parsed.typography.roles.body.lineHeight).toBe(1.65);
      }
      if (format === 'typescript') {
        const parsed = exportedJson(result.rendered, 'visualContract');
        expect(parsed.typography.roles.display.lineHeight).toBe(0.82);
        expect(parsed.typography.roles.body.lineHeight).toBe(1.65);
      }
      if (format === 'css-variables') {
        expect(result.rendered).toContain('--line-height-tight: 0.82;');
        expect(result.rendered).toContain('--line-height-normal: 1.65;');
        expect(result.rendered).toContain('--type-display-line-height: 0.82;');
        expect(result.rendered).toContain('--type-body-line-height: 1.65;');
      }
      if (format === 'tailwind') {
        const theme = exportedJson(result.rendered, 'theme');
        expect(theme.roleStyles.display.lineHeight).toBe(0.82);
        expect(theme.roleStyles.body.lineHeight).toBe(1.65);
        expect(theme.extend.fontSize.display[1].lineHeight).toBe('0.82');
        expect(theme.extend.fontSize.body[1].lineHeight).toBe('1.65');
        expect(theme.metadata.typography.roles.body.lineHeight).toBe(1.65);
      }
    }
  });

  it('preserves explicit none and zero through every contract renderer', () => {
    for (const format of formats) {
      const result = composeDesignTokens({
        primaryStyleId: 'brutalist-grid',
        contract,
        format,
        overrides: { typography: { body: { letterSpacingEm: 0, paragraphSpacingEm: 0 } } },
      }, repo);
      const spec = result.visualContract as ResolvedVisualContract;
      const tokens = result.tokens as DesignTokens;
      expect(spec.shadows).toEqual({ sm: 'none', md: 'none', lg: 'none' });
      expect(spec.radii).toEqual({ sm: 0, md: 0, lg: 0 });
      expect(spec.motion.duration).toBe(0);
      expect(spec.motion.reducedMotion).toBe('none');
      expect(spec.typography.roles.body.letterSpacingEm).toBe(0);
      expect(spec.typography.roles.body.paragraphSpacingEm).toBe(0);
      expect(spec.typography.roles.body.textTransform).toBe('none');
      expect(tokens.radius).toEqual({ sm: '0px', md: '0px', lg: '0px' });
      expect(tokens.motion.duration).toBe('0ms');
      expect(tokens.shadow).toEqual(spec.shadows);
      if (format === 'json') {
        const parsed = JSON.parse(result.rendered);
        expect(parsed.radii.lg).toBe(0);
        expect(parsed.motion.duration).toBe(0);
        expect(parsed.shadows.sm).toBe('none');
        expect(parsed.motion.reducedMotion).toBe('none');
        expect(parsed.typography.roles.body.letterSpacingEm).toBe(0);
        expect(parsed.typography.roles.body.paragraphSpacingEm).toBe(0);
        expect(parsed.typography.roles.display.textTransform).toBe('none');
      }
      if (format === 'typescript') {
        const parsed = exportedJson(result.rendered, 'visualContract');
        expect(parsed.radii).toEqual({ sm: 0, md: 0, lg: 0 });
        expect(parsed.motion.duration).toBe(0);
        expect(parsed.shadows.lg).toBe('none');
        expect(parsed.typography.roles.body.paragraphSpacingEm).toBe(0);
      }
      if (format === 'css-variables') {
        expect(result.rendered).toContain('--radius-sm: 0px;');
        expect(result.rendered).toContain('--radius-md: 0px;');
        expect(result.rendered).toContain('--radius-lg: 0px;');
        expect(result.rendered).toContain('--motion-duration: 0ms;');
        expect(result.rendered).toContain('--motion-reduced: none;');
        expect(result.rendered).toContain('--shadow-md: none;');
        expect(result.rendered).toContain('--type-body-letter-spacing: 0em;');
        expect(result.rendered).toContain('--type-body-margin-block-end: 0em;');
        expect(result.rendered).toContain('--type-body-text-transform: none;');
        expect(result.rendered).toContain('--type-display-line-height: 0.82;');
      }
      if (format === 'tailwind') {
        const theme = exportedJson(result.rendered, 'theme');
        expect(theme.extend.borderRadius).toEqual({ sm: '0px', md: '0px', lg: '0px' });
        expect(theme.extend.boxShadow).toEqual({ sm: 'none', md: 'none', lg: 'none' });
        expect(theme.extend.transitionDuration.DEFAULT).toBe('0ms');
        expect(theme.metadata.radii.sm).toBe(0);
        expect(theme.metadata.motion.duration).toBe(0);
        expect(theme.roleStyles.body.letterSpacing).toBe('0em');
        expect(theme.roleStyles.body.marginBlockEnd).toBe('0em');
        expect(theme.roleStyles.body.textTransform).toBe('none');
      }
    }
  });

  it('lets legacy secondaryStyleId change only the accent overlay', () => {
    const secondary = repo.getStyle('editorial-silence');
    expect(secondary).toBeDefined();
    for (const format of formats) {
      for (const colorMode of ['light', 'both'] as const) {
        const plain = composeDesignTokens({ primaryStyleId: 'brutalist-grid', format, colorMode }, repo);
        const overlaid = composeDesignTokens({
          primaryStyleId: 'brutalist-grid', secondaryStyleId: 'editorial-silence', format, colorMode,
        }, repo);
        const plainTokens = colorMode === 'both'
          ? plain.tokens as { light: DesignTokens; dark: DesignTokens }
          : { light: plain.tokens as DesignTokens };
        const overlaidTokens = colorMode === 'both'
          ? overlaid.tokens as { light: DesignTokens; dark: DesignTokens }
          : { light: overlaid.tokens as DesignTokens };
        for (const mode of colorMode === 'both' ? ['light', 'dark'] as const : ['light'] as const) {
          const before = plainTokens[mode]!;
          const after = overlaidTokens[mode]!;
          expect(withoutSecondaryAccent(after)).toEqual(withoutSecondaryAccent(before));
          expect(after.color.accent).toBe(before.color.accent);
          expect(after.color.accentSecondary).toBe(secondary!.accent);
          expect(after.typography).toEqual(before.typography);
          expect(after.spacing).toEqual(before.spacing);
          expect(after.radius).toEqual(before.radius);
          expect(after.shadow).toEqual(before.shadow);
          expect(after.motion).toEqual(before.motion);
          expect(after.density).toEqual(before.density);
        }
        expect(overlaid.notes.some((note) => note.includes("editorial-silence's accent"))).toBe(true);
        expect(overlaid.rendered).not.toMatch(/Fraunces|Playfair|Georgia/);
      }
    }
  });
});
