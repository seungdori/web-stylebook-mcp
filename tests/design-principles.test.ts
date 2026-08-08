import { describe, expect, it } from 'vitest';
import type { CatalogRepository } from '../src/catalog/repository.js';
import {
  DesignPrinciplePlanError,
  planDesignPrinciples,
} from '../src/design-principles/planner.js';
import type {
  DesignPrinciple,
  DesignPrincipleCategoryDef,
  LocalizedText,
} from '../src/types.js';

const localized = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

const categories: DesignPrincipleCategoryDef[] = [{
  id: 'adaptation-density',
  label: localized('Adaptation & density', '적응형 배치와 밀도', '適応と密度'),
  description: localized('Adapt related content.', '관련 콘텐츠를 적응형으로 배치합니다.', '関連する内容を適応させます。'),
}];

const principles: DesignPrinciple[] = [
  {
    id: 'exact-layout',
    name: localized('Exact layout', '정확한 배치', '正確な配置'),
    aliases: ['exact'],
    category: 'adaptation-density',
    summary: localized('Clarify the primary group.', '주요 그룹을 명확히 합니다.', '主要なグループを明確にします。'),
    designQuestion: localized('What belongs together?', '무엇이 함께 있어야 하나요?', '何を一緒に置くべきですか？'),
    placement: [
      localized('Place the action beside its result.', '동작을 결과 옆에 둡니다.', '操作を結果の近くに置きます。'),
    ],
    apply: [
      localized('Group by task.', '과업별로 묶습니다.', 'タスクごとにまとめます。'),
    ],
    verify: [
      localized('Scan the reading order.', '읽기 순서를 훑어봅니다.', '読み順を確認します。'),
    ],
    caution: localized('Do not reorder semantics.', '의미 순서를 바꾸지 마세요.', '意味上の順序を変えないでください。'),
    concernTags: ['focus', 'grouping'],
    surfaceTags: ['form'],
    phaseTags: ['structure'],
    relatedDesignPrincipleIds: ['global-layout'],
    relatedUxPrincipleIds: ['proximity'],
  },
  {
    id: 'global-layout',
    name: localized('Global layout', '공통 배치', '共通配置'),
    aliases: ['global'],
    category: 'adaptation-density',
    summary: localized('Set a reusable rhythm.', '재사용 가능한 리듬을 만듭니다.', '再利用できるリズムを作ります。'),
    designQuestion: localized('Is the rhythm consistent?', '리듬이 일관적인가요?', 'リズムは一貫していますか？'),
    placement: [
      localized('Repeat aligned anchors.', '정렬 기준을 반복합니다.', '整列の基準を繰り返します。'),
    ],
    apply: [
      localized('Use a bounded spacing scale.', '제한된 간격 척도를 사용합니다.', '限定した間隔尺度を使います。'),
    ],
    verify: [
      localized('Compare sibling screens.', '동급 화면을 비교합니다.', '同階層の画面を比較します。'),
    ],
    caution: localized('Allow task-specific exceptions.', '과업별 예외를 허용하세요.', 'タスク固有の例外を認めてください。'),
    concernTags: ['focus'],
    surfaceTags: ['global'],
    phaseTags: ['structure'],
    relatedDesignPrincipleIds: ['exact-layout'],
    relatedUxPrincipleIds: [],
  },
  {
    id: 'form-only',
    name: localized('Form only', '폼 전용', 'フォーム専用'),
    aliases: [],
    category: 'adaptation-density',
    summary: localized('Keep form actions visible.', '폼 동작을 잘 보이게 합니다.', 'フォーム操作を見つけやすくします。'),
    designQuestion: localized('Can the action be found?', '동작을 찾을 수 있나요?', '操作を見つけられますか？'),
    placement: [
      localized('Keep actions near fields.', '동작을 필드 가까이에 둡니다.', '操作をフィールドの近くに置きます。'),
    ],
    apply: [
      localized('Use one action region.', '하나의 동작 영역을 사용합니다.', '操作領域を一つにします。'),
    ],
    verify: [
      localized('Test at narrow widths.', '좁은 너비에서 검사합니다.', '狭い幅で確認します。'),
    ],
    caution: localized('Do not hide destructive actions.', '파괴적 동작을 숨기지 마세요.', '破壊的な操作を隠さないでください。'),
    concernTags: ['resilience'],
    surfaceTags: ['form'],
    phaseTags: ['validation'],
    relatedDesignPrincipleIds: [],
    relatedUxPrincipleIds: [],
  },
];

const repo = {
  data: {
    designPrinciples: principles,
    designPrincipleCategories: categories,
  },
  getDesignPrinciple: (id: string) => principles.find((principle) => principle.id === id),
} as unknown as CatalogRepository;

describe('design principle planner', () => {
  it('scores concern, exact/global surface, and phase matches with the contract weights', () => {
    const plan = planDesignPrinciples({
      concerns: ['focus', 'grouping'],
      surface: 'form',
      phase: 'structure',
      limit: 3,
    }, repo);

    expect(plan.principles.map((principle) => [principle.id, principle.score])).toEqual([
      ['exact-layout', 13],
      ['global-layout', 7],
      ['form-only', 3],
    ]);
    expect(plan.principles[0]?.categoryId).toBe('adaptation-density');
    expect(plan.principles[0]?.category).toBe('Adaptation & density');
  });

  it('preserves explicit id order and materializes placement and relationships', () => {
    const plan = planDesignPrinciples({
      principleIds: ['form-only', 'exact-layout'],
      concerns: ['focus'],
      surface: 'form',
      locale: 'ko',
    }, repo);

    expect(plan.principles.map((principle) => principle.id))
      .toEqual(['form-only', 'exact-layout']);
    expect(plan.principles[1]?.name).toBe('정확한 배치');
    expect(plan.principles[1]?.placement[0]).toMatch(/[가-힣]/);
    expect(plan.principles[1]?.relatedDesignPrincipleIds).toEqual(['global-layout']);
    expect(plan.principles[1]?.relatedUxPrincipleIds).toEqual(['proximity']);
  });

  it('supports strict intersection matching for audits without changing ranked-union default', () => {
    const input = {
      concerns: ['focus', 'grouping'] as const,
      surface: 'form' as const,
      phase: 'structure' as const,
      limit: 3,
    };
    const rankedUnion = planDesignPrinciples(input, repo);
    const strict = planDesignPrinciples({ ...input, matchMode: 'all-selectors' }, repo);

    expect(rankedUnion.principles.map((principle) => principle.id))
      .toEqual(['exact-layout', 'global-layout', 'form-only']);
    expect(strict.principles.map((principle) => principle.id))
      .toEqual(['exact-layout', 'global-layout']);
    expect(strict.query.matchMode).toBe('all-selectors');
  });

  it('requires a selector and reports invalid limits and unknown ids distinctly', () => {
    expect(() => planDesignPrinciples({}, repo)).toThrow(DesignPrinciplePlanError);
    expect(() => planDesignPrinciples({ concerns: ['focus'], limit: 0 }, repo))
      .toThrow(/limit/);
    expect(() => planDesignPrinciples({ concerns: ['focus'], limit: 13 }, repo))
      .toThrow(/limit/);

    try {
      planDesignPrinciples({ principleIds: ['exact-layot'] }, repo);
      throw new Error('expected an unknown-id failure');
    } catch (error) {
      expect(error).toBeInstanceOf(DesignPrinciplePlanError);
      expect((error as DesignPrinciplePlanError).kind)
        .toBe('DESIGN_PRINCIPLE_NOT_FOUND');
      expect((error as DesignPrinciplePlanError).unknownId).toBe('exact-layot');
    }
  });
});
