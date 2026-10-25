import type {
  ProductType, Tone, Density, UsageFrequency, TrustLevel, TaskTag, Lang, CatalogStyle,
} from '../types.js';
import type { StyleStructureSummary } from '../structure/guidance.js';
import type { ProductMustHaves } from '../structure/must-haves.js';

export interface ProductContext {
  productDescription: string;
  productType?: ProductType;
  audience?: string[];
  primaryTasks?: string[];
  tone?: Tone[];
  density?: Density;
  usageFrequency?: UsageFrequency;
  trustSensitivity?: TrustLevel;
  constraints?: string[];
  avoid?: string[];
  locale?: Lang;
  candidateLimit?: number;
}

export type FacetSource = 'explicit' | 'inferred' | 'default';

export interface ResolvedFacet<T> {
  value: T;
  source: FacetSource;
  evidence?: string;
}

export interface ResolvedContext {
  productType: ResolvedFacet<ProductType>;
  tones: ResolvedFacet<Tone[]>;
  density: ResolvedFacet<Density>;
  usageFrequency: ResolvedFacet<UsageFrequency>;
  trustSensitivity: ResolvedFacet<TrustLevel>;
  primaryTaskTags: ResolvedFacet<TaskTag[]>;
  constraints: string[];
  avoidStyleIds: string[];
  avoidAestheticTerms: string[];
  /** style ids matched by an aesthetic avoid term (soft-relaxable in degradation, 05 §10). */
  avoidedStyleIdsViaAesthetic: string[];
  /** Distinct use-case words from the description, audience and tasks (Latin script only). */
  requestKeys: string[];
  assumptions: string[];
  missingInformation: string[];
}

export type FitKey = 'product' | 'useCase' | 'task' | 'tone' | 'density' | 'usage' | 'trust' | 'constraint';
export type FitBreakdown = Record<FitKey, number>;

export type TermKey = FitKey | 'cautions' | 'upkeep' | 'avoidance';
/** Weighted score points per factor. Adjustments are negative; the terms sum to the style's total. */
export type ScoreTerms = Record<TermKey, number>;

export interface UseCaseEvidence {
  targeted: number;
  total: number;
  /** Share of bestFor entries aimed at the requested product type. */
  share: number;
  /** 0, 0.5 or 1 from the words the best-matching bestFor entry shares with the brief. */
  lexical: number;
  phrase?: string;
  /** 1 when a notIdealFor entry matches the brief, otherwise 0. */
  notIdeal: number;
  notIdealPhrase?: string;
}

export interface ScoredStyle {
  style: CatalogStyle;
  fits: FitBreakdown;
  terms: ScoreTerms;
  total: number;
  softCodes: ReasonCode[];
  violated: string[];
  /** How many of the style's strengths are task tags; the more it lists, the less any one task defines it. */
  taskStrengths: number;
  /** The catalog lists this style among the hand-picked primaries for the requested product type. */
  primaryPick: boolean;
  evidence: UseCaseEvidence;
  nearestAvoided?: { styleId: string; shared: string[] };
}

export type ReasonCode =
  | 'EXPLICITLY_AVOIDED'
  | 'PRODUCT_NOT_IDEAL'
  | 'HIGH_TRUST_MISMATCH'
  | 'DAILY_USE_OVERSTIMULATION'
  | 'ACCESSIBILITY_CONFLICT'
  | 'DENSITY_MISMATCH'
  | 'MOTION_INTENSITY_CONFLICT'
  | 'TONE_CONFLICT'
  | 'MAINTENANCE_RISK';

export interface StyleCandidate {
  styleId: string;
  score: number;
  scoreBreakdown: Record<string, number>;
  matched: string[];
  /** Facet traits that distinguish this candidate from score-tied neighbors (motion, distinctiveness, durability). */
  differentiators: string[];
  cautions: string[];
  resourceUri: string;
}

export interface Pairing {
  styleId: string;
  pairWith: string;
  role: string[];
  rationale: string;
}

export interface RejectedStyle {
  styleId: string;
  reasonCodes: ReasonCode[];
  explanation: string;
}

export type RankReasonCode =
  | 'PRODUCT_FOCUS'
  | 'USE_CASE_FIT'
  | 'TASK_FIT'
  | 'TONE_FIT'
  | 'DENSITY_FIT'
  | 'USAGE_FIT'
  | 'TRUST_FIT'
  | 'CONSTRAINT_FIT'
  | 'FEWER_CAUTIONS'
  | 'LOWER_UPKEEP'
  | 'FARTHER_FROM_AVOIDED'
  | 'TIED';

/** Why candidates[0] ranks above the next-best surviving style, or an honest tie. */
export interface RankingExplanation {
  winner: string;
  runnerUp: string;
  /** Displayed-score gap, 0 when tied. */
  gap: number;
  tied: boolean;
  /** The factors that decided the order, largest first; ['TIED'] when tied. */
  reasonCodes: RankReasonCode[];
  explanation: string;
}

export interface RecommendedCandidate extends StyleCandidate {
  /**
   * Layout archetype, signature moves, and banned patterns for this style; tokens alone only recolor a page.
   * Build steps and ban criteria are on `structure.resourceUri`. Every bundled style has a structure guide
   * (--validate-catalog enforces it); only a style added to a catalog copy can lack one.
   */
  structure?: StyleStructureSummary;
}

export interface EvidenceResult<Candidate extends StyleCandidate = RecommendedCandidate> {
  candidates: Candidate[];
  pairings: Pairing[];
  rejected: RejectedStyle[];
  /** Absent when only one style survives. */
  ranking?: RankingExplanation;
  resolvedContext: {
    normalizedFacets: string[];
    assumptions: string[];
    missingInformation: string[];
  };
  confidence: 'low' | 'medium' | 'high';
  compromised?: boolean;
  relaxed?: string[];
  guidance: string;
}

export interface RecommendationResult extends EvidenceResult {
  /**
   * The elements the resolved product type requires and where each goes, returned once for every candidate. A style
   * restyles them but never removes them; each candidate's structure.mustHaves says how its archetype places them.
   */
  mustHaves: ProductMustHaves;
}
