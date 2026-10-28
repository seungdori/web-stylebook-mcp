import type { DesignConcern, Lang, LocalizedText, UxSurface } from '../types.js';
import type { ImprovementContext } from '../improvement/schema.js';

export const FOUNDATION_CATEGORIES = [
  'perception', 'composition', 'typography', 'color',
  'information', 'interaction', 'feedback', 'evaluation',
] as const;
export type FoundationCategory = (typeof FOUNDATION_CATEGORIES)[number];

export interface FoundationSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: 'design-guidance' | 'usability-heuristic' | 'standard-explanation' | 'internationalization';
  reviewedAt: string;
  /** The bounded claim supported by this source, not a claim that it tested our remedies. */
  supports: LocalizedText;
  standard?: { name: 'WCAG 2.2'; criterion: string; level: 'A' | 'AA' | 'AAA' };
}

export interface DesignFoundation {
  id: string;
  category: FoundationCategory;
  name: LocalizedText;
  principle: LocalizedText;
  concerns: DesignConcern[];
  surfaces: UxSurface[];
  relatedPrincipleIds: string[];
  sourceIds: string[];
  observe: LocalizedText[];
  decisions: Array<{
    when: LocalizedText;
    change: LocalizedText;
    /** Counterexample / constraint: when the proposed change is inappropriate. */
    instead: LocalizedText;
  }>;
  preserve: LocalizedText;
  compare: Array<{
    evidence: 'rendered' | 'interaction' | 'computed-style' | 'user-task';
    test: LocalizedText;
  }>;
  examples: Array<{ surface: UxSurface; before: LocalizedText; after: LocalizedText }>;
}

export interface FoundationPlanInput {
  context?: ImprovementContext;
  foundationIds?: string[];
  concerns?: DesignConcern[];
  surface?: UxSurface;
  category?: FoundationCategory;
  limit?: number;
  locale?: Lang;
}

/** Author translations together so additions cannot silently fall back to English. */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
