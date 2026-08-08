import { text, texts } from '../localization.js';
import type { CatalogRepository } from '../catalog/repository.js';
import { DESIGN_CONCERNS } from '../types.js';
import type {
  DesignConcern, DesignPrinciple, DesignPrincipleCategory, Lang, UxPhase, UxSurface,
  PrincipleMatchMode,
} from '../types.js';

export interface DesignPrinciplePlanInput {
  principleIds?: string[];
  concerns?: DesignConcern[];
  surface?: UxSurface;
  phase?: UxPhase;
  matchMode?: PrincipleMatchMode;
  limit?: number;
  locale?: Lang;
}

export interface PlannedDesignPrinciple {
  id: string;
  name: string;
  categoryId: DesignPrincipleCategory;
  category: string;
  summary: string;
  designQuestion: string;
  score: number;
  whyRelevant: string[];
  placement: string[];
  apply: string[];
  verify: string[];
  caution: string;
  relatedDesignPrincipleIds: string[];
  relatedUxPrincipleIds: string[];
  references: DesignPrinciple['references'];
  resourceUri: string;
}

export interface DesignPrinciplePlan {
  query: {
    principleIds: string[];
    concerns: DesignConcern[];
    surface?: UxSurface;
    phase?: UxPhase;
    matchMode: PrincipleMatchMode;
    limit: number;
    locale: Lang;
  };
  principles: PlannedDesignPrinciple[];
  coverage: {
    selected: number;
    matching: number;
    catalogTotal: number;
  };
  guidance: string[];
}

export class DesignPrinciplePlanError extends Error {
  constructor(
    message: string,
    readonly kind: 'INVALID_INPUT' | 'DESIGN_PRINCIPLE_NOT_FOUND' = 'INVALID_INPUT',
    readonly unknownId?: string,
  ) {
    super(message);
    this.name = 'DesignPrinciplePlanError';
  }
}

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

// Mirrors the UX planner: a query built only from near-universal tags (e.g. the `validation` phase)
// matches almost the whole catalog, so ranking — not filtering — produced the result. Say so.
const WEAK_SELECTOR_RATIO = 0.9;

const labels: Record<Lang, {
  requested: string;
  concern: string;
  surface: string;
  globalSurface: string;
  phase: string;
  guidance: string[];
  weakSelectors: (matching: number, total: number) => string;
  strictNoMatches: string;
}> = {
  en: {
    requested: 'requested directly',
    concern: 'addresses concern',
    surface: 'applies to surface',
    globalSurface: 'applies across surfaces',
    phase: 'useful during phase',
    guidance: [
      'Use these principles to make and review concrete layout decisions, not as a fixed visual recipe.',
      'Preserve semantic order, accessibility, responsive behavior, and truthful state communication when applying visual guidance.',
      'Verify placement with real content, edge cases, and target viewport sizes before treating the composition as complete.',
    ],
    weakSelectors: (matching, total) => `These selectors matched ${matching} of ${total} principles, so they did not narrow the catalog — the returned set reflects relevance ranking, not a targeted filter. Add more specific concerns, or pass explicit principleIds, when you need a precise set.`,
    strictNoMatches: 'No design principle matched every selector dimension. Keep strict matching and remove only the least relevant selector, or pass explicit principleIds; do not silently treat a ranked union as an exact match.',
  },
  ko: {
    requested: '직접 지정됨',
    concern: '설계 관심사와 연결',
    surface: '해당 화면에 적용',
    globalSurface: '여러 화면에 공통 적용',
    phase: '해당 단계에서 유용',
    guidance: [
      '이 원칙은 고정된 시각 레시피가 아니라 구체적인 배치 결정을 만들고 검토하는 기준으로 사용하세요.',
      '시각 지침을 적용할 때 의미 구조, 접근성, 반응형 동작, 상태의 정확한 전달을 보존하세요.',
      '구성이 완성되었다고 판단하기 전에 실제 콘텐츠, 경계 사례, 목표 화면 크기에서 배치를 검증하세요.',
    ],
    weakSelectors: (matching, total) => `이 조건은 원칙 ${total}개 중 ${matching}개와 일치해서 카탈로그를 거의 좁히지 못했습니다. 결과는 필터링이 아니라 관련성 순위에 따른 것입니다. 정확한 집합이 필요하면 더 구체적인 concerns를 넣거나 principleIds를 직접 지정하세요.`,
    strictNoMatches: '모든 조건 차원에 동시에 맞는 디자인 원칙이 없습니다. 엄격 일치를 유지한 채 가장 덜 중요한 조건 하나만 빼거나 principleIds를 직접 지정하세요. 순위 합집합을 정확한 일치처럼 조용히 사용하면 안 됩니다.',
  },
  ja: {
    requested: '直接指定',
    concern: '設計上の関心に対応',
    surface: '対象画面に適用',
    globalSurface: '画面横断で適用',
    phase: '対象フェーズで有効',
    guidance: [
      'これらの原則は固定された見た目のレシピではなく、具体的な配置判断を行い検証する基準として使ってください。',
      '視覚的な指針を適用するときも、意味の順序、アクセシビリティ、レスポンシブ動作、正確な状態伝達を保ってください。',
      '構成を完成とする前に、実際のコンテンツ、境界ケース、対象画面サイズで配置を検証してください。',
    ],
    weakSelectors: (matching, total) => `この条件は原則${total}件のうち${matching}件に一致し、カタログをほとんど絞り込めていません。返る集合はフィルタではなく関連度の順位によるものです。厳密な集合が必要なら、より具体的なconcernsを加えるか、principleIdsを直接指定してください。`,
    strictNoMatches: 'すべての条件軸に一致するデザイン原則はありません。厳密一致を保ったまま重要度の最も低い条件だけを外すか、principleIdsを明示してください。順位付き和集合を完全一致として黙って扱わないでください。',
  },
};

interface ScoredDesignPrinciple {
  principle: DesignPrinciple;
  score: number;
  whyRelevant: string[];
  catalogIndex: number;
}

function scoreDesignPrinciple(
  principle: DesignPrinciple,
  input: DesignPrinciplePlanInput,
  locale: Lang,
  catalogIndex: number,
): ScoredDesignPrinciple {
  let score = 0;
  const whyRelevant: string[] = [];
  const label = labels[locale];

  const matchedConcerns = (input.concerns ?? [])
    .filter((concern) => principle.concernTags.includes(concern));
  if (matchedConcerns.length) {
    score += matchedConcerns.length * 4;
    whyRelevant.push(`${label.concern}: ${matchedConcerns.join(', ')}`);
  }

  if (input.surface && principle.surfaceTags.includes(input.surface)) {
    score += 3;
    whyRelevant.push(`${label.surface}: ${input.surface}`);
  } else if (input.surface && principle.surfaceTags.includes('global')) {
    score += 1;
    whyRelevant.push(label.globalSurface);
  }

  if (input.phase && principle.phaseTags.includes(input.phase)) {
    score += 2;
    whyRelevant.push(`${label.phase}: ${input.phase}`);
  }

  return { principle, score, whyRelevant, catalogIndex };
}

function matchesAllSelectors(
  principle: DesignPrinciple,
  input: DesignPrinciplePlanInput,
  concerns: DesignConcern[],
): boolean {
  if (concerns.length && !concerns.some((concern) => principle.concernTags.includes(concern))) {
    return false;
  }
  if (input.surface
    && !principle.surfaceTags.includes(input.surface)
    && !principle.surfaceTags.includes('global')) {
    return false;
  }
  if (input.phase && !principle.phaseTags.includes(input.phase)) return false;
  return true;
}

function materialize(
  scored: ScoredDesignPrinciple,
  locale: Lang,
  repo: CatalogRepository,
): PlannedDesignPrinciple {
  const { principle } = scored;
  const category = repo.data.designPrincipleCategories
    .find((item) => item.id === principle.category);
  return {
    id: principle.id,
    name: text(principle.name, locale),
    categoryId: principle.category,
    category: category ? text(category.label, locale) : principle.category,
    summary: text(principle.summary, locale),
    designQuestion: text(principle.designQuestion, locale),
    score: scored.score,
    whyRelevant: scored.whyRelevant,
    placement: texts(principle.placement, locale),
    apply: texts(principle.apply, locale),
    verify: texts(principle.verify, locale),
    caution: text(principle.caution, locale),
    relatedDesignPrincipleIds: principle.relatedDesignPrincipleIds,
    relatedUxPrincipleIds: principle.relatedUxPrincipleIds,
    references: principle.references,
    resourceUri: `webstylebook://design-principles/${principle.id}`,
  };
}

export function planDesignPrinciples(
  input: DesignPrinciplePlanInput,
  repo: CatalogRepository,
): DesignPrinciplePlan {
  const principleIds = [...new Set(input.principleIds ?? [])];
  const requestedConcerns = new Set(input.concerns ?? []);
  const concerns = DESIGN_CONCERNS.filter((concern) => requestedConcerns.has(concern));
  const locale = input.locale ?? 'en';
  const matchMode = input.matchMode ?? 'ranked-union';

  if (principleIds.length > MAX_LIMIT) {
    throw new DesignPrinciplePlanError(`principleIds supports at most ${MAX_LIMIT} unique ids`);
  }
  if (input.limit !== undefined && (
    !Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT
  )) {
    throw new DesignPrinciplePlanError(`limit must be between 1 and ${MAX_LIMIT}`);
  }
  const limit = Math.min(
    Math.max(input.limit ?? (principleIds.length || DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );

  if (!principleIds.length && !concerns.length && !input.surface && !input.phase) {
    throw new DesignPrinciplePlanError(
      'provide at least one selector: principleIds, concerns, surface, or phase',
    );
  }

  let matching: ScoredDesignPrinciple[];
  if (principleIds.length) {
    matching = principleIds.map((id, requestedIndex) => {
      const principle = repo.getDesignPrinciple(id);
      if (!principle) {
        throw new DesignPrinciplePlanError(
          `unknown design principle '${id}'`,
          'DESIGN_PRINCIPLE_NOT_FOUND',
          id,
        );
      }
      const catalogIndex = repo.data.designPrinciples.findIndex((item) => item.id === id);
      const scored = scoreDesignPrinciple(
        principle,
        { ...input, concerns },
        locale,
        catalogIndex,
      );
      return {
        ...scored,
        whyRelevant: [labels[locale].requested, ...scored.whyRelevant],
        catalogIndex: requestedIndex,
      };
    });
  } else {
    matching = repo.data.designPrinciples
      .map((principle, catalogIndex) => scoreDesignPrinciple(
        principle,
        { ...input, concerns },
        locale,
        catalogIndex,
      ))
      .filter((item) => item.score > 0 && (
        matchMode === 'ranked-union' || matchesAllSelectors(item.principle, input, concerns)
      ))
      .sort((a, b) => b.score - a.score || (
        a.principle.id < b.principle.id ? -1 : a.principle.id > b.principle.id ? 1 : 0
      ));
  }

  const catalogTotal = repo.data.designPrinciples.length;
  const guidance = [...labels[locale].guidance];
  if (!principleIds.length && matching.length >= Math.ceil(catalogTotal * WEAK_SELECTOR_RATIO)) {
    guidance.unshift(labels[locale].weakSelectors(matching.length, catalogTotal));
  }
  if (!principleIds.length && matchMode === 'all-selectors' && matching.length === 0) {
    guidance.unshift(labels[locale].strictNoMatches);
  }

  return {
    query: {
      principleIds,
      concerns,
      surface: input.surface,
      phase: input.phase,
      matchMode,
      limit,
      locale,
    },
    principles: matching.slice(0, limit).map((item) => materialize(item, locale, repo)),
    coverage: {
      selected: Math.min(matching.length, limit),
      matching: matching.length,
      catalogTotal,
    },
    guidance,
  };
}
