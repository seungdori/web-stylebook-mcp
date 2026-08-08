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

export const UX_PRINCIPLE_CATEGORIES = [
  'perception', 'cognition', 'decision', 'interaction', 'motivation', 'memory',
] as const;
export type UxPrincipleCategory = (typeof UX_PRINCIPLE_CATEGORIES)[number];

export const UX_OUTCOMES = [
  'attention', 'comprehension', 'decision', 'action', 'feedback', 'progress', 'memory', 'trust',
] as const;
export type UxOutcome = (typeof UX_OUTCOMES)[number];

export const UX_SURFACES = [
  'global', 'landing-page', 'navigation', 'search', 'form', 'data-table', 'checkout',
  'onboarding', 'content', 'chat', 'developer-console', 'settings',
] as const;
export type UxSurface = (typeof UX_SURFACES)[number];

export const UX_PHASES = [
  'discover', 'structure', 'interaction', 'content', 'validation',
] as const;
export type UxPhase = (typeof UX_PHASES)[number];

export const AUDIT_SEVERITIES = ['blocker', 'major', 'minor'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_EVIDENCE_TYPES = [
  'command', 'dom', 'computed-style', 'screenshot', 'interaction', 'document', 'manual',
] as const;
export type AuditEvidenceType = (typeof AUDIT_EVIDENCE_TYPES)[number];

export const AUDIT_AUTOMATION_LEVELS = ['automated', 'assisted', 'manual'] as const;
export type AuditAutomationLevel = (typeof AUDIT_AUTOMATION_LEVELS)[number];

export const AUDIT_APPLICABILITY = ['always', 'when-present', 'workflow-only'] as const;
export type AuditApplicability = (typeof AUDIT_APPLICABILITY)[number];

export const UX_EVIDENCE_KINDS = [
  'empirical', 'gestalt', 'heuristic', 'systems-maxim',
] as const;
export type UxEvidenceKind = (typeof UX_EVIDENCE_KINDS)[number];

export const UX_EVIDENCE_CONFIDENCE = [
  'strong', 'contextual', 'contested',
] as const;
export type UxEvidenceConfidence = (typeof UX_EVIDENCE_CONFIDENCE)[number];

export const DESIGN_PRINCIPLE_CATEGORIES = [
  'intent-iteration', 'hierarchy-semantics', 'adaptation-density',
  'typography-localization', 'tokens-color-themes',
  'interaction-accessibility', 'states-feedback-recovery',
] as const;
export type DesignPrincipleCategory = (typeof DESIGN_PRINCIPLE_CATEGORIES)[number];

export const DESIGN_CONCERNS = [
  'focus', 'scanability', 'readability', 'grouping', 'balance',
  'consistency', 'responsiveness', 'accessibility', 'restraint', 'resilience',
] as const;
export type DesignConcern = (typeof DESIGN_CONCERNS)[number];

export const PRINCIPLE_MATCH_MODES = ['ranked-union', 'all-selectors'] as const;
export type PrincipleMatchMode = (typeof PRINCIPLE_MATCH_MODES)[number];

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

export interface UxPrincipleCategoryDef {
  id: UxPrincipleCategory;
  label: LocalizedText;
  description: LocalizedText;
}

export interface UxPrinciple {
  id: string;
  name: LocalizedText;
  aliases: string[];
  category: UxPrincipleCategory;
  summary: LocalizedText;
  designQuestion: LocalizedText;
  apply: LocalizedText[];
  verify: LocalizedText[];
  caution: LocalizedText;
  outcomeTags: UxOutcome[];
  surfaceTags: UxSurface[];
  phaseTags: UxPhase[];
  evidence: {
    kind: UxEvidenceKind;
    confidence: UxEvidenceConfidence;
    references: Array<{
      title: string;
      url: string;
    }>;
  };
  relatedPrincipleIds: string[];
  referenceUrl: string;
}

export interface UxPrincipleAttribution {
  sourceName: string;
  creator: string;
  sourceUrl: string;
  sourceLicense: {
    name: string;
    url: string;
  };
  authoredContentLicense: {
    name: string;
    url: string;
  };
  notice: LocalizedText;
}

export interface DesignPrincipleCategoryDef {
  id: DesignPrincipleCategory;
  label: LocalizedText;
  description: LocalizedText;
}

export interface DesignPrinciple {
  id: string;
  name: LocalizedText;
  aliases: string[];
  category: DesignPrincipleCategory;
  summary: LocalizedText;
  designQuestion: LocalizedText;
  placement: LocalizedText[];
  apply: LocalizedText[];
  verify: LocalizedText[];
  caution: LocalizedText;
  concernTags: DesignConcern[];
  surfaceTags: UxSurface[];
  phaseTags: UxPhase[];
  relatedDesignPrincipleIds: string[];
  relatedUxPrincipleIds: string[];
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
export type AuditCheckSource =
  | { kind: 'verification'; groupId: string; itemIndex: number }
  | { kind: 'anti-pattern'; antiPatternId: string };
export interface AuditCheckDefinition {
  id: string;
  source: AuditCheckSource;
  severity: AuditSeverity;
  evidenceTypes: AuditEvidenceType[];
  automation: AuditAutomationLevel;
  applicability: AuditApplicability;
  surfaceTags: UxSurface[];
}
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
  auditChecks: AuditCheckDefinition[];
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
  uxPrincipleCategories: string[];
  uxOutcomes: string[];
  uxSurfaces: string[];
  uxPhases: string[];
  uxEvidenceKinds: string[];
  uxEvidenceConfidence: string[];
  designPrincipleCategories: string[];
  designConcerns: string[];
  auditSeverities: string[];
  auditEvidenceTypes: string[];
  auditAutomationLevels: string[];
  auditApplicability: string[];
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
  uxPrincipleCategories: UxPrincipleCategoryDef[];
  uxPrinciples: UxPrinciple[];
  uxPrincipleAttribution: UxPrincipleAttribution;
  designPrincipleCategories: DesignPrincipleCategoryDef[];
  designPrinciples: DesignPrinciple[];
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
