// Recommendation engine public shapes (01 §8.2 input, 05 §11 output).

import type {
  ProductType, Tone, Density, UsageFrequency, TrustLevel, TaskTag, Lang,
} from '../types.js';

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
  assumptions: string[];
  missingInformation: string[];
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

export interface EvidenceResult {
  candidates: StyleCandidate[];
  pairings: Pairing[];
  rejected: RejectedStyle[];
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
