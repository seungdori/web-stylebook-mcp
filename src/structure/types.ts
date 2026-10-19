import type { LocalizedText } from '../types.js';

export const STRUCTURE_JOBS = ['opening', 'proof', 'capabilities', 'action', 'orientation'] as const;
/** What a section does for the visitor; a banned pattern is replaced by a move that does the same job. */
export type StructureJob = (typeof STRUCTURE_JOBS)[number];

export const GUIDE_BASES = ['specimen', 'blueprint', 'catalog', 'authored'] as const;
/** Where an authored statement comes from: the style's specimen page, its blueprint, its catalog entry, or new authoring. */
export type GuideBasis = (typeof GUIDE_BASES)[number];

export const GLOBAL_PATTERN_IDS = [
  'gradient-blob-hero',
  'centered-stack-hero',
  'stock-photo-hero',
  'logo-strip',
  'trusted-by-band',
  'icon-feature-grid',
  'testimonial-carousel',
  'closing-cta-banner',
  'generic-saas-skeleton',
] as const;
export type GlobalPatternId = (typeof GLOBAL_PATTERN_IDS)[number];

export const STYLE_RULE_IDS = [
  'corner-radius',
  'shadow-blur',
  'hard-shadow',
  'shadow-layers',
  'gradient-fill',
  'backdrop-blur',
  'glow',
  'centered-copy',
  'unguarded-motion',
  'eased-motion',
  'accent-hues',
  'canvas',
  'text-on-effect',
  'nested-surfaces',
  'icon-tiles',
  'faint-borders',
  'typeface',
  'imagery',
  'crowded-grid',
] as const;
export type StyleRuleId = (typeof STYLE_RULE_IDS)[number];

export interface StyleRuleParams {
  'corner-radius': { max?: number; min?: number; allowCircles?: boolean };
  'shadow-blur': { maxBlurPx: number };
  'hard-shadow': { minOffsetPx: number };
  'shadow-layers': { maxLayers: number };
  'gradient-fill': { scope: 'any' | 'cards' | 'text' };
  'backdrop-blur': { maxBlurPx: number };
  glow: { maxElements: number; target: 'any' | 'text' };
  'centered-copy': { minWords: number };
  'unguarded-motion': { includeFinite: boolean };
  'eased-motion': { maxDurationMs: number };
  'accent-hues': { max?: number; min?: number; minSaturation: number };
  canvas: { forbid: 'pure-white' | 'light' | 'dark' | 'tinted' };
  'text-on-effect': { surface: 'gradient' | 'glass'; minWords: number };
  'nested-surfaces': { kind: 'card' | 'glass' };
  'icon-tiles': { maxTiles: number };
  'faint-borders': { minAlpha: number };
  typeface: { role: 'display' | 'body'; require?: 'monospace' | 'serif' | 'sans'; forbid?: Array<'monospace' | 'serif' | 'sans'>; forbidFamilies?: string[] };
  imagery: { forbid: Array<'illustration' | 'photo' | 'emoji'> };
  'crowded-grid': { maxColumns: number };
}

export type StyleBanSource =
  | { kind: 'constraint'; text: string }
  | { kind: 'visual-contract'; path: string; value: string | number }
  | { kind: 'specimen'; note: string };

export type StyleBanDef = {
  [R in StyleRuleId]: { rule: R; params: StyleRuleParams[R]; why: string; source: StyleBanSource };
}[StyleRuleId];

export interface SignatureMoveDef {
  id: string;
  name: string;
  build: string;
  purpose: string;
  jobs: StructureJob[];
  basis: GuideBasis;
}

/** Authored structural guidance for one catalog style; numbers come from the catalog at runtime. */
export interface StructureGuideDef {
  styleId: string;
  hero: string;
  grid: string;
  sectionOrder: string[];
  density: string;
  typeScale: string;
  basis: GuideBasis;
  /** Where an authored archetype breaks from the style's specimen page, and why. */
  departure?: string;
  moves: SignatureMoveDef[];
  bans: StyleBanDef[];
  /** Global patterns this style's own identity requires, with the reason they are allowed. */
  allow?: Partial<Record<GlobalPatternId, string>>;
}

export interface CriterionDef {
  id: string;
  text: string;
}

export interface GlobalPatternDef {
  id: GlobalPatternId;
  job: StructureJob | 'page';
  severity: 'major' | 'minor';
  scope: 'opening' | 'section' | 'page';
  name: LocalizedText;
  description: LocalizedText;
  replace: LocalizedText;
  antiPatternIds: string[];
  auditCheckIds: string[];
  criteria: CriterionDef[];
  /** A finding of any listed pattern on the same element replaces this one. */
  supersededBy?: GlobalPatternId[];
}

export interface StyleRuleDef<R extends StyleRuleId = StyleRuleId> {
  id: R;
  name: (params: StyleRuleParams[R]) => LocalizedText;
  fix: (params: StyleRuleParams[R]) => LocalizedText;
  criteria: (params: StyleRuleParams[R]) => CriterionDef[];
}
