// Catalog types for the MCP runtime. Self-contained copy of the canonical
// src/catalog/types.ts (ADR-003: the package never imports src/ at runtime).
// The loaded catalog JSON is validated against catalog-schema.ts at load time,
// and the contract/golden tests guard against drift from the source-of-truth.

export type Lang = 'en' | 'ko' | 'ja';
export type LocalizedText = Record<Lang, string>;

export const LANGS: readonly Lang[] = ['en', 'ko', 'ja'] as const;
export const DEFAULT_LANG: Lang = 'en';

export const PRODUCT_TYPES = [
  'operational-saas', 'developer-tool', 'documentation', 'data-analytics',
  'security-console', 'finance-admin', 'healthcare-portal', 'commerce',
  'ai-chat', 'content-editorial', 'knowledge-base', 'portfolio',
  'campaign', 'consumer-app', 'other',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const TONES = [
  'calm', 'technical', 'trustworthy', 'premium',
  'editorial', 'playful', 'bold', 'experimental',
] as const;
export type Tone = (typeof TONES)[number];

export const DENSITY_LEVELS = ['low', 'medium', 'high'] as const;
export type Density = (typeof DENSITY_LEVELS)[number];

export const USAGE_FREQUENCIES = ['one-off', 'occasional', 'daily'] as const;
export type UsageFrequency = (typeof USAGE_FREQUENCIES)[number];

export const TRUST_LEVELS = ['low', 'medium', 'high'] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const INTENSITY_LEVELS = ['low', 'medium', 'high'] as const;
export type Intensity = (typeof INTENSITY_LEVELS)[number];

export const STATE_CATEGORIES = [
  'data', 'network', 'permission', 'interaction', 'content', 'environment', 'time',
] as const;
export type StateCategory = (typeof STATE_CATEGORIES)[number];

export const STATE_CRITICALITIES = ['required', 'recommended', 'domain-specific'] as const;
export type StateCriticality = (typeof STATE_CRITICALITIES)[number];

export const COMPONENT_CATEGORIES = [
  'states', 'controls', 'navigation', 'feedback', 'layout',
] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

export const MOTION_CATEGORIES = [
  'entrance', 'attention', 'interaction', 'state', 'loading', 'scroll', 'ambient',
] as const;
export type MotionCategory = (typeof MOTION_CATEGORIES)[number];

export const TASK_TAGS = [
  'monitor', 'triage', 'configure', 'analyze', 'audit', 'author', 'read', 'search',
  'browse', 'compare', 'purchase', 'checkout', 'communicate', 'onboard', 'navigate',
  'manage', 'review', 'upload', 'schedule',
] as const;
export type TaskTag = (typeof TASK_TAGS)[number];

export interface OntologyTerm {
  value: string;
  label: LocalizedText;
  aliases: string[];
}

export interface ConstraintMapping {
  constraint: string;
  matchesRisks: string[];
  hardReject?: 'ACCESSIBILITY_CONFLICT';
}

export interface Ontology {
  productTypes: OntologyTerm[];
  tones: OntologyTerm[];
  densityLevels: OntologyTerm[];
  usageFrequencies: OntologyTerm[];
  trustLevels: OntologyTerm[];
  taskTags: OntologyTerm[];
  stateCategories: OntologyTerm[];
  productAdjacency: Record<string, ProductType[]>;
  constraintMappings: ConstraintMapping[];
}

export interface RecommendationFacets {
  productTypes: ProductType[];
  tones: Tone[];
  antiTones: Tone[];
  density: Density[];
  usageFrequency: UsageFrequency[];
  trust: TrustLevel[];
  strengths: string[];
  risks: string[];
  motionIntensity: Intensity;
  continuousSpectacle: boolean;
  maintenanceComplexity: Intensity;
}

export type NotIdealMap = Record<string, ProductType[]>;

export interface CatalogStyle {
  id: string;
  kind: 'style' | 'fusion';
  name: LocalizedText;
  description: LocalizedText;
  summary: LocalizedText;
  tags: string[];
  palette: string[];
  accent: string;
  typography: string;
  layout: string;
  motion: string;
  bestFor: string[];
  constraints: string[];
  notIdealFor: string[];
  visualProfile: { headline: string; surface: string; rhythm: string };
  recommendationFacets: RecommendationFacets;
  fusionOf?: string[];
  styleFamilyId?: string;
}

export interface DesignTokenColor {
  canvas: string; surface: string; surfaceRaised: string; surfaceMuted: string;
  text: string; textMuted: string; textInverse: string;
  border: string; borderStrong: string;
  accent: string; accentText: string;
  /** Secondary style's accent for secondary surfaces (only when a secondaryStyleId is given). */
  accentSecondary?: string; accentSecondaryText?: string;
  positive: string; caution: string; critical: string; info: string;
  focus: string;
}
export interface DesignTokenTypography {
  displayFamily: string; bodyFamily: string; monoFamily: string;
  scale: Record<string, string>; lineHeight: Record<string, number>;
}

export interface DesignTokens {
  color: DesignTokenColor;
  typography: DesignTokenTypography;
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
  motion: Record<string, string>;
  density: Record<string, string>;
}

export interface StyleFamily {
  id: string;
  name: LocalizedText;
  memberStyleIds: string[];
  tokenDefaults: {
    color: Partial<DesignTokenColor>;
    typography: Partial<DesignTokenTypography>;
    radius?: Record<string, string>;
    motion?: Record<string, string>;
    density?: Record<string, string>;
  };
}

export interface MotionCategoryDef {
  id: MotionCategory;
  label: LocalizedText;
  description: LocalizedText;
}

export interface MotionPattern {
  id: string;
  category: MotionCategory;
  name: LocalizedText;
  aliases: string[];
  summary: LocalizedText;
  useWhen: LocalizedText;
  avoidWhen: LocalizedText;
  prompt: LocalizedText;
  intensity: Intensity;
  continuous: boolean;
  reducedMotionFallback: LocalizedText;
  previewKind?: string;
}

export interface ComponentCategoryDef {
  id: ComponentCategory;
  title: LocalizedText;
  description: LocalizedText;
}

export interface ComponentTerm {
  id: string;
  category: ComponentCategory;
  name: LocalizedText;
  aliases: string[];
  plain: LocalizedText;
  useWhen: LocalizedText;
  avoidWhen: LocalizedText;
  semanticRoles: string[];
  relatedStateIds: string[];
  example?: string;
}

export interface ProductArchetype {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  signals: string[];
  primaryTasks: TaskTag[];
  commonScreens: string[];
  recommendedPrimaryStyleIds: string[];
  recommendedSecondaryStyleIds: string[];
  avoidStyleIds: string[];
  defaultDensity: Density;
  defaultUsageFrequency: UsageFrequency;
  defaultTrust: TrustLevel;
  stateSurfaceIds: string[];
}

export interface StateSurface {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  requiredStateIds: string[];
  recommendedStateIds: string[];
  domainSignals: string[];
}

export interface StateAccessibility {
  announcement?: LocalizedText;
  focus?: LocalizedText;
  keyboard?: LocalizedText[];
  contrast?: LocalizedText[];
}

export interface StateMotionGuidance {
  guidance: LocalizedText[];
  reducedMotion: LocalizedText[];
}

export interface StateRecipe {
  id: string;
  surfaceIds: string[];
  category: StateCategory;
  criticality: StateCriticality;
  name: LocalizedText;
  summary: LocalizedText;
  aliases: string[];
  domainSignals: string[];
  triggers: LocalizedText[];
  userQuestions: LocalizedText[];
  mustShow: LocalizedText[];
  mustPreserve: LocalizedText[];
  primaryActions: LocalizedText[];
  secondaryActions: LocalizedText[];
  mustNot: LocalizedText[];
  accessibility: StateAccessibility;
  motion: StateMotionGuidance;
}

export interface PreflightCheck { id: string; label: LocalizedText; detail: LocalizedText; }
export interface VerificationGroup { id: string; title: LocalizedText; items: LocalizedText[]; }
export interface AntiPattern { id: string; pattern: LocalizedText; why: LocalizedText; fix: LocalizedText; }
export interface DecisionExample {
  id: string;
  product: LocalizedText;
  chosenPrimary: string;
  chosenSecondary?: string;
  reasoning: LocalizedText;
  wouldNotPick: { id: string; reason: LocalizedText }[];
}

export interface Policies {
  preflight: PreflightCheck[];
  verification: VerificationGroup[];
  antiPatterns: AntiPattern[];
  decisionExamples: DecisionExample[];
}

export interface CatalogOntologyEnums {
  productTypes: string[];
  tones: string[];
  densityLevels: string[];
  usageFrequencies: string[];
  trustLevels: string[];
  stateCategories: string[];
  taskTags: string[];
}

export interface WebStylebookCatalogV1 {
  ontology: Ontology;
  ontologyEnums: CatalogOntologyEnums;
  styles: CatalogStyle[];
  styleFamilies: StyleFamily[];
  notIdealMap: NotIdealMap;
  motionCategories: MotionCategoryDef[];
  motionPatterns: MotionPattern[];
  componentCategories: ComponentCategoryDef[];
  components: ComponentTerm[];
  productArchetypes: ProductArchetype[];
  stateSurfaces: StateSurface[];
  stateRecipes: StateRecipe[];
  policies: Policies;
}

export interface CatalogEnvelope {
  schema: 'webstylebook.catalog.v1';
  catalogVersion: string;
  contentHash: string;
  sourceRevision?: string;
  languages: ['en', 'ko', 'ja'];
  data: WebStylebookCatalogV1;
}
