// Canonical composition delegates to the website's portable resolver and exporters.
import type { CatalogRepository } from '../catalog/repository.js';
import { VISUAL_SCHEMA } from '../catalog/visual.js';
import { TokenError, type ComposeDesignTokensInput, type ComposeDesignTokensResult } from './compile.js';
import type { DesignTokens } from '../types.js';
import type { ResolvedVisualContract, VisualOverrides } from '../visual-canonical/types.js';
import { assessContrast, proposeContrastRepairs, parseVisualColor } from '../visual-canonical/contrast.js';
import { serializeVisualJson, visualContractToCss, visualContractToTheme } from '../visual-canonical/export.js';
import { zVisualOverrides } from '../visual-canonical/schema.js';
import { parseHex } from './contrast.js';

/** Backward token aliases project the same resolved values; the companion is lossless. */
export function visualToLegacyTokens(spec: ResolvedVisualContract): DesignTokens {
  const { roles } = spec.typography;
  return {
    color: { ...spec.colors },
    typography: {
      displayFamily: roles.display.fontFamily,
      bodyFamily: roles.body.fontFamily,
      monoFamily: roles.data.fontFamily,
      scale: {
        xs: `${roles.caption.sizeMaxRem}rem`, sm: `${roles.small.sizeMaxRem}rem`, base: `${roles.body.sizeMaxRem}rem`,
        lg: `${roles.subheading.sizeMaxRem}rem`, xl: `${roles.heading.sizeMinRem}rem`, '2xl': `${roles.heading.sizeMaxRem}rem`, '3xl': `${roles.display.sizeMaxRem}rem`,
      },
      lineHeight: { tight: roles.display.lineHeight, normal: roles.body.lineHeight, relaxed: roles.small.lineHeight },
    },
    spacing: { '1': `${spec.spacing.unit}px`, '2': `${spec.spacing.unit * 2}px`, '3': `${spec.spacing.stack}px`, '4': `${spec.spacing.gutter}px`, '6': `${spec.spacing.section}px`, '8': `${spec.spacing.section * 2}px` },
    radius: Object.fromEntries(Object.entries(spec.radii).map(([key, value]) => [key, `${value}px`])),
    shadow: { ...spec.shadows },
    motion: { duration: `${spec.motion.duration}ms`, easing: spec.motion.easing, reducedMotion: spec.motion.reducedMotion, continuous: String(spec.motion.continuous) },
    density: { row: `${spec.spacing.row}px`, gutter: `${spec.spacing.gutter}px` },
  };
}

function resolveOverrides(input: ComposeDesignTokensInput): VisualOverrides {
  const overrides = zVisualOverrides.parse(input.overrides ?? {});
  if (input.density !== undefined) {
    if (overrides.density !== undefined && overrides.density !== input.density) throw new TokenError('density conflicts with overrides.density; send one agreed value');
    overrides.density = input.density;
  }
  if (input.accentOverride !== undefined) {
    if (!parseHex(input.accentOverride)) throw new TokenError(`accentOverride '${input.accentOverride}' is not a valid hex color`);
    const normalizedAccent = input.accentOverride.startsWith('#') ? input.accentOverride : `#${input.accentOverride}`;
    if (overrides.colors?.accent !== undefined && JSON.stringify(parseVisualColor(overrides.colors.accent)) !== JSON.stringify(parseVisualColor(normalizedAccent))) throw new TokenError('accentOverride conflicts with overrides.colors.accent; send one agreed value');
    overrides.colors = { ...overrides.colors, accent: normalizedAccent };
  }
  return overrides;
}

export function composeContractTokens(input: ComposeDesignTokensInput, repo: CatalogRepository): ComposeDesignTokensResult {
  if (input.contract?.schema !== VISUAL_SCHEMA) throw new TokenError(`Unsupported visual contract schema '${input.contract?.schema}'; use '${VISUAL_SCHEMA}'`);
  if (!repo.getStyle(input.primaryStyleId)) throw new TokenError(`unknown style '${input.primaryStyleId}'`);
  if (input.secondaryStyleId !== undefined) throw new TokenError('secondaryStyleId is a legacy accent-only overlay; contract requests must send explicit colors, typography or spacing in overrides');
  if (input.colorMode === 'both' && input.acceptedRepairs?.length) throw new TokenError('Accepted contrast repairs are mode-specific; request light or dark separately when applying acceptedRepairs');
  const metadata = repo.visualContractMetadata;
  if (input.contract.contentHash !== undefined && input.contract.contentHash !== metadata.contentHash) throw new TokenError(`Visual library hash '${input.contract.contentHash}' is not bundled; installed hash is '${metadata.contentHash}'`);
  const overrides = resolveOverrides(input);
  const selected = (mode?: 'light' | 'dark') => repo.getVisualContract(input.primaryStyleId, {
    ...(mode !== undefined ? { mode } : {}), contentLocale: input.locale ?? 'en', overrides,
    ...(input.acceptedRepairs !== undefined ? { acceptedRepairs: input.acceptedRepairs } : {}),
    ...(input.contract?.revision !== undefined ? { revision: input.contract.revision } : {}),
  });
  const both = input.colorMode === 'both';
  const visual = input.colorMode === 'both' ? { light: selected('light'), dark: selected('dark') } : selected(input.colorMode);
  const specs = 'light' in visual ? [visual.light, visual.dark] : [visual];
  const tokens = 'light' in visual ? { light: visualToLegacyTokens(visual.light), dark: visualToLegacyTokens(visual.dark) } : visualToLegacyTokens(visual);
  const colorMode = both ? 'both' : specs[0]!.mode;
  const warnings = [...new Set(specs.flatMap((spec) => [
    ...spec.warnings,
    ...assessContrast(spec).filter((pair) => pair.status === 'fail' || pair.status === 'needs-rendered-review').map((pair) => `${spec.mode}: ${pair.context} — ${pair.status === 'fail' ? `${pair.ratio!.toFixed(2)}:1; requires ${pair.threshold}:1` : 'requires rendered contrast review'}`),
  ]))];
  let rendered: string;
  if (input.format === 'css-variables') {
    rendered = 'light' in visual
      ? `${visualContractToCss(visual.light)}\n${visualContractToCss(visual.dark, '[data-theme="dark"]')}\n@media (prefers-color-scheme: dark) {\n${visualContractToCss(visual.dark, ':root:not([data-theme="light"])')}\n}\n`
      : visualContractToCss(visual);
  } else if (input.format === 'tailwind') {
    const themes = 'light' in visual ? { light: visualContractToTheme(visual.light), dark: visualContractToTheme(visual.dark) } : visualContractToTheme(visual);
    rendered = `// Use extend in the theme and roleStyles for full typography; metadata is the lossless companion.\nexport const ${both ? 'themes' : 'theme'} = ${serializeVisualJson(themes)};\n`;
  } else if (input.format === 'typescript') {
    rendered = `export const visualContract = ${serializeVisualJson(visual)} as const;\n`;
  } else if (input.format === 'json') {
    rendered = serializeVisualJson(visual, 0);
  } else {
    throw new TokenError(`Unsupported token format '${input.format}'`);
  }
  return {
    primaryStyleId: input.primaryStyleId, format: input.format, colorMode, tokens, rendered, warnings,
    notes: [
      'Values resolve from the pinned website contract, locale adjustments, then validated overrides; no palette-position or family inference is used.',
      'visualContract is the complete companion for component color pairs, font provenance, responsive roles, usage, field origins and accepted repairs. tokens contains compatibility aliases.',
      'Contrast repair proposals are inert until supplied in acceptedRepairs. Identity accents remain unchanged. Font files are not bundled or loaded by MCP.',
    ],
    contract: metadata,
    visualContract: visual,
    repairProposals: 'light' in visual ? { light: proposeContrastRepairs(visual.light), dark: proposeContrastRepairs(visual.dark) } : proposeContrastRepairs(visual),
  };
}
