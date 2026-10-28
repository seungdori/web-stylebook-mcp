import { text } from '../localization.js';
import { DESIGN_CONCERNS, UX_SURFACES, type Lang, type LocalizedText } from '../types.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import { FOUNDATIONS, FOUNDATION_IDENTITY, IMPROVEMENT_PROTOCOL } from './catalog.js';
import { FOUNDATION_SOURCES } from './sources.js';
import { FOUNDATION_CATEGORIES, L, type DesignFoundation, type FoundationPlanInput } from './types.js';
import { improvementContextSchema } from '../improvement/schema.js';
import { improvementWorkflow } from '../improvement/workflow.js';

export class FoundationPlanError extends Error {
  constructor(message: string, readonly unknownId?: string) { super(message); this.name = 'FoundationPlanError'; }
}

export function localizeFoundation(foundation: DesignFoundation, locale: Lang) {
  const t = (value: LocalizedText) => text(value, locale);
  return {
    id: foundation.id, category: foundation.category,
    name: t(foundation.name), principle: t(foundation.principle),
    concerns: [...foundation.concerns], surfaces: [...foundation.surfaces],
    relatedPrincipleIds: [...foundation.relatedPrincipleIds], sourceIds: [...foundation.sourceIds],
    applicationBasis: 'authored-contextual-guidance' as const,
    observe: foundation.observe.map(t),
    decisions: foundation.decisions.map((rule) => ({ when: t(rule.when), change: t(rule.change), instead: t(rule.instead) })),
    preserve: t(foundation.preserve),
    compare: foundation.compare.map((check) => ({ evidence: check.evidence, test: t(check.test) })),
    examples: foundation.examples.map((example) => ({ surface: example.surface, before: t(example.before), after: t(example.after) })),
    examplesAre: 'illustrative-not-observed-results' as const,
    resourceUri: `webstylebook://foundations/${foundation.id}?locale=${locale}`,
  };
}

export function localizeSources(ids: readonly string[], locale: Lang) {
  return FOUNDATION_SOURCES.filter((source) => ids.includes(source.id))
    .map((source) => ({ ...source, supports: text(source.supports, locale) }));
}

export function localizeProtocol(locale: Lang) {
  return {
    purpose: text(IMPROVEMENT_PROTOCOL.purpose, locale),
    evidenceBoundary: text(IMPROVEMENT_PROTOCOL.evidenceBoundary, locale),
    decisionOrder: IMPROVEMENT_PROTOCOL.decisionOrder.map((value) => text(value, locale)),
    captureBefore: text(IMPROVEMENT_PROTOCOL.captureBefore, locale),
    comparisonConditions: text(IMPROVEMENT_PROTOCOL.comparisonConditions, locale),
    verification: text(IMPROVEMENT_PROTOCOL.verification, locale),
    report: text(IMPROVEMENT_PROTOCOL.report, locale),
  };
}

export function planDesignImprovement(input: FoundationPlanInput) {
  const locale = input.locale ?? 'en';
  if (!['en', 'ko', 'ja'].includes(locale)) throw new FoundationPlanError('locale must be en, ko or ja');
  const contextResult = improvementContextSchema.optional().safeParse(input.context);
  if (!contextResult.success) throw new FoundationPlanError(contextResult.error.message);
  const context = contextResult.data;
  if (context && new Set(context.targets.map((target) => target.id)).size !== context.targets.length) {
    throw new FoundationPlanError('context target ids must be unique');
  }
  const foundationIds = [...new Set(input.foundationIds ?? [])];
  if (foundationIds.length > 12) throw new FoundationPlanError('foundationIds supports at most 12 unique ids');
  if ((input.concerns ?? []).some((value) => !DESIGN_CONCERNS.includes(value))) throw new FoundationPlanError('unknown design concern');
  if (input.surface && !UX_SURFACES.includes(input.surface)) throw new FoundationPlanError('unknown surface');
  if (input.category && !FOUNDATION_CATEGORIES.includes(input.category)) throw new FoundationPlanError('unknown foundation category');
  const concerns = DESIGN_CONCERNS.filter((value) => input.concerns?.includes(value));
  const limit = input.limit ?? (foundationIds.length || 6);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new FoundationPlanError('limit must be between 1 and 12');
  if (!foundationIds.length && !concerns.length && !input.surface && !input.category) {
    throw new FoundationPlanError('provide foundationIds, concerns, surface or category; use webstylebook://foundations to browse');
  }
  for (const id of foundationIds) {
    if (!FOUNDATIONS.some((foundation) => foundation.id === id)) throw new FoundationPlanError(`unknown design foundation '${id}'`, id);
  }
  // OR within concerns; AND across selector dimensions. Explicit ids do not bypass filters.
  const matching = FOUNDATIONS.filter((foundation) => (
    (!foundationIds.length || foundationIds.includes(foundation.id))
    && (!concerns.length || concerns.some((value) => foundation.concerns.includes(value)))
    && (!input.surface || foundation.surfaces.includes(input.surface) || foundation.surfaces.includes('global'))
    && (!input.category || foundation.category === input.category)
  )).map((foundation, catalogOrder) => ({
    foundation, catalogOrder,
    matchedConcerns: concerns.filter((value) => foundation.concerns.includes(value)),
    exactSurface: Boolean(input.surface && foundation.surfaces.includes(input.surface)),
  })).sort((a, b) => foundationIds.length
    ? foundationIds.indexOf(a.foundation.id) - foundationIds.indexOf(b.foundation.id)
    : b.matchedConcerns.length - a.matchedConcerns.length || Number(b.exactSurface) - Number(a.exactSurface) || a.catalogOrder - b.catalogOrder);
  const selected = matching.slice(0, limit);
  const query = { foundationIds, concerns, ...(input.surface ? { surface: input.surface } : {}), ...(input.category ? { category: input.category } : {}), ...(context ? { context } : {}), limit, locale };
  const identity = { ...FOUNDATION_IDENTITY, planHash: stableHashOf({ library: FOUNDATION_IDENTITY.contentHash, query }) };
  const sourceIds = [...new Set(selected.flatMap(({ foundation }) => foundation.sourceIds))];
  return {
    identity,
    query,
    workflow: improvementWorkflow(locale, context, identity.planHash),
    selection: {
      mode: 'all-selector-dimensions' as const,
      explanation: text(L('OR within concerns, AND across filters; cross-surface entries also apply. Explicit ids retain their order. Otherwise matched concerns, exact surface, then catalog order determine selection; this is not a design quality score.', '관심사 내부는 OR, 필터 사이는 AND이며 공통 화면 항목도 적용됩니다. 명시 ID는 순서를 유지하고 그 외에는 일치 관심사 수·정확한 화면·목록 순서로 선택합니다. 디자인 품질 점수가 아닙니다.', '関心事内はOR、フィルター間はANDで、共通画面項目も適用します。明示IDは順序を維持し、それ以外は関心事一致数、画面一致、一覧順で選びます。品質点ではありません。'), locale),
    },
    coverage: { catalogTotal: FOUNDATIONS.length, matching: matching.length, selected: selected.length, omittedIds: matching.slice(limit).map(({ foundation }) => foundation.id), filteredRequestedIds: foundationIds.filter((id) => !matching.some(({ foundation }) => foundation.id === id)) },
    protocol: localizeProtocol(locale),
    foundations: selected.map(({ foundation, matchedConcerns, exactSurface }) => ({ ...localizeFoundation(foundation, locale), match: { concerns: matchedConcerns, exactSurface } })),
    sources: localizeSources(sourceIds, locale),
    relatedPrincipleIds: [...new Set(selected.flatMap(({ foundation }) => foundation.relatedPrincipleIds))],
    notice: text(selected.length ? L('Inspect the actual UI and apply only rules whose conditions hold. The host performs edits, captures and verification; this offline tool retrieves knowledge only.', '실제 UI를 관찰하고 조건이 맞는 규칙만 적용하세요. 수정·캡처·검증은 호스트가 수행하며 이 오프라인 도구는 지식만 조회합니다.', '実UIを観察し条件に合う規則だけを適用します。編集、記録、検証はホストが行い、このオフラインツールは知識のみ取得します。') : L('No entry matches all filters. Relax an explicit filter or inspect the index; no fallback selection was invented.', '모든 필터에 맞는 항목이 없습니다. 필터를 명시적으로 완화하거나 목록을 확인하세요. 임의의 대체 항목을 고르지 않았습니다.', '全フィルターに合う項目がありません。明示的に条件を緩めるか一覧を確認します。任意の代替選択は行っていません。'), locale),
  };
}

/** Preserve the full executable guidance for clients that only render text content. */
export function renderImprovementPlan(plan: ReturnType<typeof planDesignImprovement>): string {
  return JSON.stringify(plan, null, 2);
}
