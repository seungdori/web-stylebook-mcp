import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import type { DesignTokens } from '../src/types.js';

const repo = CatalogRepository.load();

function exportedObject(rendered: string, name: string): Record<string, any> {
  const marker = `export const ${name} = `;
  const start = rendered.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return JSON.parse(rendered.slice(start + marker.length).split(';\n')[0]!);
}

describe('legacy token fidelity', () => {
  it('applies explicit density over family defaults and preserves omitted defaults', () => {
    const envelope = structuredClone(repo.envelope);
    const style = envelope.data.styles.find((item) => item.id === 'runtime-signal')!;
    const family = envelope.data.styleFamilies.find((item) => item.id === style.styleFamilyId)!;
    family.tokenDefaults.density = { row: '51px', gutter: '23px', panel: '30px' };
    const fixture = new CatalogRepository(envelope);
    const compose = (density?: 'comfortable' | 'compact') => composeDesignTokens({
      primaryStyleId: style.id, format: 'json', density,
    }, fixture).tokens as DesignTokens;

    expect(compose().density).toEqual({ row: '51px', gutter: '23px', panel: '30px' });
    expect(compose('compact').density).toEqual({ row: '32px', gutter: '12px', panel: '30px' });
    expect(compose('comfortable').density).toEqual({ row: '40px', gutter: '20px', panel: '30px' });
    expect(family.tokenDefaults.density).toEqual({ row: '51px', gutter: '23px', panel: '30px' });
  });

  it('preserves line heights alongside motion and density in every CSS mode block', () => {
    const result = composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'css-variables', colorMode: 'both' }, repo);
    const tokens = result.tokens as { light: DesignTokens; dark: DesignTokens };
    const blocks = result.rendered.split(/\n\n/);
    expect(blocks).toHaveLength(3);
    for (const [index, block] of blocks.entries()) {
      const expected = index === 0 ? tokens.light : tokens.dark;
      for (const [key, value] of Object.entries(expected.typography.lineHeight)) {
        expect(block).toContain(`--line-height-${key}: ${value};`);
      }
      for (const field of ['motion', 'density'] as const) {
        for (const [key, value] of Object.entries(expected[field])) {
          expect(block).toContain(`--${field}-${key}: ${value};`);
        }
      }
    }
  });

  it.each(['light', 'dark', 'both'] as const)('preserves complete Tailwind projections for %s mode', (colorMode) => {
    const result = composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'tailwind', colorMode }, repo);
    const theme = exportedObject(result.rendered, 'theme');
    const modes = colorMode === 'both'
      ? exportedObject(result.rendered, 'themes')
      : { [colorMode]: theme };
    const tokens = colorMode === 'both'
      ? result.tokens as { light: DesignTokens; dark: DesignTokens }
      : { [colorMode]: result.tokens as DesignTokens };

    for (const [mode, expected] of Object.entries(tokens)) {
      const projection = modes[mode];
      expect(projection.colors).toEqual(expected.color);
      expect(projection.fontFamily).toEqual({
        display: [expected.typography.displayFamily], body: [expected.typography.bodyFamily], mono: [expected.typography.monoFamily],
      });
      expect(projection.fontSize).toEqual(expected.typography.scale);
      expect(projection.lineHeight).toEqual(expected.typography.lineHeight);
      expect(projection.spacing).toEqual(expected.spacing);
      expect(projection.borderRadius).toEqual(expected.radius);
      expect(projection.boxShadow).toEqual(expected.shadow);
      expect(projection.transitionDuration.DEFAULT).toBe(expected.motion.duration);
      expect(projection.transitionTimingFunction.DEFAULT).toBe(expected.motion.easing);
      expect(projection.motion).toEqual(expected.motion);
      expect(projection.density).toEqual(expected.density);
      if (colorMode === 'both') expect(theme.colors[mode]).toEqual(expected.color);
    }
  });
});
