// SPDX-License-Identifier: MIT
// Shared, serializable visual specification. No browser state or renderer imports.
export type VisualMode = 'light' | 'dark';
export type VisualLocale = 'en' | 'ko' | 'ja';
export const COLOR_ROLES = ['canvas', 'surface', 'surfaceRaised', 'surfaceMuted', 'text', 'textMuted', 'textInverse', 'border', 'borderStrong', 'accent', 'accentText', 'accentSecondary', 'accentSecondaryText', 'actionPrimary', 'actionPrimaryText', 'actionSecondary', 'actionSecondaryText', 'link', 'focus', 'positive', 'caution', 'critical', 'info'] as const;
export type ColorRole = typeof COLOR_ROLES[number];
export type VisualColors = Record<ColorRole, string>;
export const TYPOGRAPHY_ROLES = ['display', 'heading', 'subheading', 'body', 'small', 'label', 'caption', 'data'] as const;
export type TypographyRoleName = typeof TYPOGRAPHY_ROLES[number];
export interface TypographyRole {
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  sizeMinRem: number;
  sizeMaxRem: number;
  lineHeight: number;
  letterSpacingEm: number;
  paragraphSpacingEm: number;
  measureCh: number;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  wordBreak: 'normal' | 'keep-all';
  overflowWrap: 'normal' | 'anywhere';
  fontVariantNumeric: 'normal' | 'tabular-nums';
}
export interface FontMetadata {
  family: string;
  source: 'system' | 'external' | 'user';
  stylesheetUrl?: string;
  license: string;
  licenseUrl?: string;
  weights: number[];
  scripts: Array<'latin' | 'hangul' | 'japanese'>;
  fallback: string;
  availability: 'system-dependent' | 'requires-load' | 'unverified';
}
export interface VisualTypography { roles: Record<TypographyRoleName, TypographyRole>; fonts: FontMetadata[] }
export interface VisualPair {
  id: string;
  foreground: ColorRole;
  background: ColorRole;
  kind: 'text' | 'large-text' | 'control' | 'decorative';
  context: string;
}
export interface VisualProvenance {
  source: string;
  selectors: string[];
  notes: string[];
  adaptation: string;
  authoredPaths: string[];
}
export interface VisualContract {
  schema: 'webstylebook.visual.v1';
  styleId: string;
  revision: string;
  defaultMode: VisualMode;
  modes: Partial<Record<VisualMode, VisualModeRecipe>>;
  typography: VisualTypography;
  spacing: { unit: number; section: number; stack: number; density: 'comfortable' | 'compact'; row: number; gutter: number };
  borders: { width: number; style: 'solid' | 'dashed' | 'double' };
  radii: { sm: number; md: number; lg: number };
  shadows: { sm: string; md: string; lg: string };
  motion: { duration: number; easing: string; reducedMotion: 'none'; continuous: boolean };
  components: VisualPair[];
  usage: { preserve: string[]; adapt: string[]; verify: string[] };
  provenance: VisualProvenance;
}
export interface VisualModeRecipe extends Partial<Pick<VisualContract, 'typography' | 'spacing' | 'borders' | 'radii' | 'shadows' | 'motion' | 'components' | 'usage'>> {
  colors: VisualColors;
  backdropDependent: boolean;
}
export interface VisualOverrides {
  colors?: Partial<VisualColors>;
  typography?: Partial<Record<TypographyRoleName, Partial<TypographyRole>>>;
  density?: 'comfortable' | 'compact';
  spacing?: Partial<VisualContract['spacing']>;
  fonts?: FontMetadata[];
}
export interface VisualRepair {
  id: string;
  role: ColorRole;
  before: string;
  after: string;
  pairId: string;
  reason: string;
}
export interface VisualResolutionOptions {
  mode?: VisualMode;
  contentLocale?: VisualLocale;
  overrides?: VisualOverrides;
  acceptedRepairs?: VisualRepair[];
}
export interface ResolvedVisualContract extends Omit<VisualContract, 'modes' | 'defaultMode'> {
  contentHash: string;
  mode: VisualMode;
  contentLocale: VisualLocale;
  colors: VisualColors;
  backdropDependent: boolean;
  overrides: VisualOverrides;
  origins: Record<string, 'authored' | 'adaptation' | 'locale' | 'override' | 'repair'>;
  repairs: VisualRepair[];
  warnings: string[];
}
export interface ContrastCheck extends VisualPair {
  ratio: number | null;
  threshold: number | null;
  status: 'pass' | 'fail' | 'not-applicable' | 'needs-rendered-review';
}
