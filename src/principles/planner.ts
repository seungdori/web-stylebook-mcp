import { text, texts } from '../localization.js';
import type { CatalogRepository } from '../catalog/repository.js';
import { UX_OUTCOMES } from '../types.js';
import type {
  Lang, PrincipleMatchMode, UxOutcome, UxPhase, UxPrinciple, UxSurface,
} from '../types.js';

export interface UxPrinciplePlanInput {
  principleIds?: string[];
  outcomes?: UxOutcome[];
  surface?: UxSurface;
  phase?: UxPhase;
  matchMode?: PrincipleMatchMode;
  limit?: number;
  locale?: Lang;
}

export interface PlannedUxPrinciple {
  id: string;
  name: string;
  category: string;
  summary: string;
  designQuestion: string;
  score: number;
  whyRelevant: string[];
  apply: string[];
  verify: string[];
  caution: string;
  evidence: UxPrinciple['evidence'];
  relatedPrincipleIds: string[];
  referenceUrl: string;
  resourceUri: string;
}

export interface UxPrinciplePlan {
  query: {
    principleIds: string[];
    outcomes: UxOutcome[];
    surface?: UxSurface;
    phase?: UxPhase;
    matchMode: PrincipleMatchMode;
    limit: number;
    locale: Lang;
  };
  principles: PlannedUxPrinciple[];
  coverage: {
    selected: number;
    matching: number;
    catalogTotal: number;
  };
  guidance: string[];
  attribution: {
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
    notice: string;
  };
}

export class PrinciplePlanError extends Error {
  constructor(
    message: string,
    readonly kind: 'INVALID_INPUT' | 'UX_PRINCIPLE_NOT_FOUND' = 'INVALID_INPUT',
    readonly unknownId?: string,
  ) {
    super(message);
    this.name = 'PrinciplePlanError';
  }
}

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

// Some tags are nearly universal — `validation`, for instance, is carried by every principle in the
// catalog. A query built only from those matches almost everything, so the ranking (not the filter)
// is doing all the work. Say so, or the caller reads a broad sweep as a targeted selection.
const WEAK_SELECTOR_RATIO = 0.9;

const labels: Record<Lang, {
  requested: string;
  outcomes: string;
  surface: string;
  globalSurface: string;
  phase: string;
  guidance: string[];
  weakSelectors: (matching: number, total: number) => string;
  strictNoMatches: string;
}> = {
  en: {
    requested: 'requested directly',
    outcomes: 'supports outcome',
    surface: 'applies to surface',
    globalSurface: 'applies across surfaces',
    phase: 'useful during phase',
    guidance: [
      'Treat these principles as decision prompts, not universal laws or a substitute for user research.',
      'Accessibility, safety, informed consent, and truthful feedback override persuasive or simplifying heuristics.',
      'Verify each selected principle against the actual task, content, and non-happy-path states.',
    ],
    weakSelectors: (matching, total) => `These selectors matched ${matching} of ${total} principles, so they did not narrow the catalog — the returned set reflects relevance ranking, not a targeted filter. Add more specific outcomes, or pass explicit principleIds, when you need a precise set.`,
    strictNoMatches: 'No UX principle matched every selector dimension. Keep strict matching and remove only the least relevant selector, or pass explicit principleIds; do not silently treat a ranked union as an exact match.',
  },
  ko: {
    requested: '직접 지정됨',
    outcomes: '목표 결과와 연결',
    surface: '해당 화면에 적용',
    globalSurface: '여러 화면에 공통 적용',
    phase: '해당 단계에서 유용',
    guidance: [
      '이 원칙은 보편 법칙이나 사용자 조사의 대체물이 아니라 설계 결정을 점검하는 질문으로 사용하세요.',
      '접근성, 안전, 충분한 동의, 사실에 맞는 피드백은 설득·단순화 휴리스틱보다 우선합니다.',
      '선택한 원칙마다 실제 과업·콘텐츠·비정상 상태에서 효과가 있는지 검증하세요.',
    ],
    weakSelectors: (matching, total) => `이 조건은 원칙 ${total}개 중 ${matching}개와 일치해서 카탈로그를 거의 좁히지 못했습니다. 결과는 필터링이 아니라 관련성 순위에 따른 것입니다. 정확한 집합이 필요하면 더 구체적인 outcomes를 넣거나 principleIds를 직접 지정하세요.`,
    strictNoMatches: '모든 조건 차원에 동시에 맞는 UX 원칙이 없습니다. 엄격 일치를 유지한 채 가장 덜 중요한 조건 하나만 빼거나 principleIds를 직접 지정하세요. 순위 합집합을 정확한 일치처럼 조용히 사용하면 안 됩니다.',
  },
  ja: {
    requested: '直接指定',
    outcomes: '目的の成果に対応',
    surface: '対象画面に適用',
    globalSurface: '画面横断で適用',
    phase: '対象フェーズで有効',
    guidance: [
      'これらは普遍的な法則やユーザー調査の代替ではなく、設計判断を確認する問いとして扱ってください。',
      'アクセシビリティ、安全性、十分な同意、正確なフィードバックは、説得や単純化のヒューリスティックより優先されます。',
      '各原則を実際のタスク、コンテンツ、非正常系の状態で検証してください。',
    ],
    weakSelectors: (matching, total) => `この条件は原則${total}件のうち${matching}件に一致し、カタログをほとんど絞り込めていません。返る集合はフィルタではなく関連度の順位によるものです。厳密な集合が必要なら、より具体的なoutcomesを加えるか、principleIdsを直接指定してください。`,
    strictNoMatches: 'すべての条件軸に一致するUX原則はありません。厳密一致を保ったまま重要度の最も低い条件だけを外すか、principleIdsを明示してください。順位付き和集合を完全一致として黙って扱わないでください。',
  },
};

interface ScoredPrinciple {
  principle: UxPrinciple;
  score: number;
  whyRelevant: string[];
  catalogIndex: number;
}

function scorePrinciple(
  principle: UxPrinciple,
  input: UxPrinciplePlanInput,
  locale: Lang,
  catalogIndex: number,
): ScoredPrinciple {
  let score = 0;
  const whyRelevant: string[] = [];
  const label = labels[locale];

  const matchedOutcomes = (input.outcomes ?? []).filter((outcome) => principle.outcomeTags.includes(outcome));
  if (matchedOutcomes.length) {
    score += matchedOutcomes.length * 4;
    whyRelevant.push(`${label.outcomes}: ${matchedOutcomes.join(', ')}`);
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
  principle: UxPrinciple,
  input: UxPrinciplePlanInput,
  outcomes: UxOutcome[],
): boolean {
  if (outcomes.length && !outcomes.some((outcome) => principle.outcomeTags.includes(outcome))) {
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
  scored: ScoredPrinciple,
  locale: Lang,
  repo: CatalogRepository,
): PlannedUxPrinciple {
  const { principle } = scored;
  const category = repo.data.uxPrincipleCategories.find((item) => item.id === principle.category);
  return {
    id: principle.id,
    name: text(principle.name, locale),
    category: category ? text(category.label, locale) : principle.category,
    summary: text(principle.summary, locale),
    designQuestion: text(principle.designQuestion, locale),
    score: scored.score,
    whyRelevant: scored.whyRelevant,
    apply: texts(principle.apply, locale),
    verify: texts(principle.verify, locale),
    caution: text(principle.caution, locale),
    evidence: principle.evidence,
    relatedPrincipleIds: principle.relatedPrincipleIds,
    referenceUrl: principle.referenceUrl,
    resourceUri: `webstylebook://principles/${principle.id}`,
  };
}

export function planUxPrinciples(
  input: UxPrinciplePlanInput,
  repo: CatalogRepository,
): UxPrinciplePlan {
  const principleIds = [...new Set(input.principleIds ?? [])];
  const requestedOutcomes = new Set(input.outcomes ?? []);
  const outcomes = UX_OUTCOMES.filter((outcome) => requestedOutcomes.has(outcome));
  const locale = input.locale ?? 'en';
  const matchMode = input.matchMode ?? 'ranked-union';
  if (principleIds.length > MAX_LIMIT) {
    throw new PrinciplePlanError(`principleIds supports at most ${MAX_LIMIT} unique ids`);
  }
  if (input.limit !== undefined && (
    !Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT
  )) {
    throw new PrinciplePlanError(`limit must be between 1 and ${MAX_LIMIT}`);
  }
  const limit = Math.min(
    Math.max(input.limit ?? (principleIds.length || DEFAULT_LIMIT), 1),
    MAX_LIMIT,
  );

  if (!principleIds.length && !outcomes.length && !input.surface && !input.phase) {
    throw new PrinciplePlanError(
      'provide at least one selector: principleIds, outcomes, surface, or phase',
    );
  }

  let matching: ScoredPrinciple[];
  if (principleIds.length) {
    matching = principleIds.map((id, requestedIndex) => {
      const principle = repo.getPrinciple(id);
      if (!principle) {
        throw new PrinciplePlanError(`unknown UX principle '${id}'`, 'UX_PRINCIPLE_NOT_FOUND', id);
      }
      const catalogIndex = repo.data.uxPrinciples.findIndex((item) => item.id === id);
      const scored = scorePrinciple(principle, { ...input, outcomes }, locale, catalogIndex);
      return {
        ...scored,
        whyRelevant: [labels[locale].requested, ...scored.whyRelevant],
        catalogIndex: requestedIndex,
      };
    });
  } else {
    matching = repo.data.uxPrinciples
      .map((principle, catalogIndex) => scorePrinciple(
        principle,
        { ...input, outcomes },
        locale,
        catalogIndex,
      ))
      .filter((item) => item.score > 0 && (
        matchMode === 'ranked-union' || matchesAllSelectors(item.principle, input, outcomes)
      ))
      .sort((a, b) => b.score - a.score || (
        a.principle.id < b.principle.id ? -1 : a.principle.id > b.principle.id ? 1 : 0
      ));
  }

  const attribution = repo.uxPrincipleAttribution;
  const catalogTotal = repo.data.uxPrinciples.length;
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
      outcomes,
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
    attribution: {
      sourceName: attribution.sourceName,
      creator: attribution.creator,
      sourceUrl: attribution.sourceUrl,
      sourceLicense: attribution.sourceLicense,
      authoredContentLicense: attribution.authoredContentLicense,
      notice: text(attribution.notice, locale),
    },
  };
}
