import { stableHashOf } from '../catalog/stable-hash.js';
import { DESIGN_CONCERNS, UX_SURFACES } from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import { FOUNDATION_CATEGORIES, L, type DesignFoundation, type FoundationSource } from './types.js';
import { FOUNDATION_SOURCES } from './sources.js';
import { PERCEPTION_FOUNDATIONS } from './perception.js';
import { COMPOSITION_FOUNDATIONS } from './composition.js';
import { TYPOGRAPHY_FOUNDATIONS } from './typography.js';
import { COLOR_FOUNDATIONS } from './color.js';
import { INFORMATION_FOUNDATIONS } from './information.js';
import { INTERACTION_FOUNDATIONS } from './interaction.js';

export const FOUNDATIONS: DesignFoundation[] = [
  ...PERCEPTION_FOUNDATIONS, ...COMPOSITION_FOUNDATIONS, ...TYPOGRAPHY_FOUNDATIONS,
  ...COLOR_FOUNDATIONS, ...INFORMATION_FOUNDATIONS, ...INTERACTION_FOUNDATIONS,
];

export const IMPROVEMENT_PROTOCOL = {
  purpose: L('Use the knowledge to implement justified improvements, compare the result, and report completed changes. A retrieved plan is not an inspection or proof of improvement.', '이 지식으로 근거 있는 개선을 구현하고 결과를 비교한 뒤 완료한 변경을 보고하세요. 조회한 계획은 실제 점검이나 개선의 증거가 아닙니다.', 'この知識で根拠ある改善を実装し、結果を比較して完了した変更を報告します。取得した計画は実検査や改善の証拠ではありません。'),
  evidenceBoundary: L('Sources support the stated concepts. Decision rules and examples are independently authored applications, not experimentally validated universal laws. W3C Understanding pages explain criteria; apply the normative criterion, level and exceptions when claiming conformance.', '출처는 명시한 개념을 뒷받침합니다. 판단 규칙과 예시는 독립 작성한 적용 지침이며 실험 검증된 보편 법칙이 아닙니다. W3C Understanding은 기준 해설이므로 준수를 주장할 때 규범적 기준·등급·예외를 적용하세요.', '出典は記載した概念を支えます。判断規則と例は独自の応用指針で、実験で検証された普遍法則ではありません。W3C Understandingは解説であり、適合主張には規範的基準、レベル、例外を適用します。'),
  decisionOrder: [
    L('Identify the user task, existing intent and observed obstacle before choosing a remedy. Preserve well-working design and product identity.', '수정법을 고르기 전에 사용자 과업·기존 의도·관찰된 문제를 정하고 잘 작동하는 디자인과 제품 정체성을 보존하세요.', '修正前に利用者の課題、既存意図、観察した障害を定め、機能するデザインと製品の個性を保ちます。'),
    L('Check conditions and counterexamples; fix content/interaction/structure before polishing tokens where those are the cause. Address access, task failure and truthful consequences before aesthetic preferences.', '조건과 반례를 확인하고 내용·동작·구조가 원인이면 토큰 미화보다 먼저 고치세요. 접근성·과업 실패·정확한 결과 전달을 미적 취향보다 우선하세요.', '条件と反例を確認し、内容、動作、構造が原因ならトークンの装飾より先に直します。アクセス、課題失敗、正確な結果伝達を美的好みより優先します。'),
    L('Make a coherent reversible change, verify it, then keep, revise or revert. Do not force a catalog style or diagnose an AI origin from appearance.', '일관되고 되돌릴 수 있는 변경을 만들고 검증한 뒤 유지·재수정·복구하세요. 카탈로그 스타일을 강제하거나 외형으로 AI 제작 여부를 판정하지 마세요.', '一貫した戻せる変更を作り検証後に維持、再修正、復元します。カタログ様式を強制したり外観からAI制作を判定しません。'),
  ],
  captureBefore: L('Save actual rendered before screenshots plus HTML/CSS and interaction/content inventory. Record route, viewport, zoom, theme, locale, data, UI state and loaded fonts. Work on authorized surfaces; keep original artifacts separate from illustrative examples.', '실제 수정 전 스크린샷·HTML/CSS·동작 및 콘텐츠 목록을 저장하세요. 경로·화면 크기·확대·테마·언어·데이터·UI 상태·로드된 폰트를 기록하고 허용된 화면에서 작업하세요. 원본 산출물과 설명용 예시를 구별하세요.', '実際の修正前画像、HTML/CSS、動作と内容の一覧を保存します。経路、表示寸法、拡大、テーマ、言語、データ、UI状態、読込フォントを記録し許可範囲で作業します。原本と説明用の例は区別します。'),
  comparisonConditions: L('Capture after artifacts with the same route, viewport, zoom, theme, locale, data, state and font readiness. If conditions differ, disclose the mismatch and do not attribute all differences to the change. Compare the full frame and affected region at the same scale.', '수정 후에도 경로·화면 크기·확대·테마·언어·데이터·상태·폰트 준비를 맞추세요. 조건이 다르면 차이를 알리고 모든 차이를 수정 효과로 돌리지 마세요. 전체 화면과 영향 영역을 같은 축척으로 비교하세요.', '修正後も経路、表示寸法、拡大、テーマ、言語、データ、状態、フォント準備を揃えます。違う条件は明示し全差分を修正効果に帰属させません。全体と影響領域を同じ縮尺で比較します。'),
  verification: L('Run relevant tasks, keyboard paths, responsive/zoom/localization cases, loading/empty/error/recovery states and existing regression checks. Use compare_page_revisions for submitted markup preservation, while verifying live behavior separately. Structural cleanliness or a valid audit contract does not prove better usability.', '관련 과업·키보드 경로·반응형/확대/언어·로딩/빈 상태/오류/복구와 기존 회귀 검사를 실행하세요. 제출 마크업 보존에는 compare_page_revisions를 쓰고 실제 동작은 별도로 확인하세요. 구조가 깨끗하거나 점검 계약이 유효하다고 사용성이 좋아졌다는 뜻은 아닙니다.', '関連課題、キー経路、応答配置/拡大/言語、読込/空/エラー/回復、既存回帰を検査します。提出マークアップの保持にはcompare_page_revisionsを使い、実動作は別途確認します。構造の清潔さや監査契約の有効性は使いやすさ向上の証明ではありません。'),
  report: L('Deliver actual before/after references, implemented changes and their intended effect, observed comparison outcomes (improved/unchanged/regressed/not verified), preserved behavior, tests and unresolved limits. Label expert judgement, functional evidence and participant measurements separately; never invent user testing or a quality score.', '실제 전후 참조·구현한 변경과 의도한 효과·관찰한 비교 결과(개선/동일/퇴행/미검증)·보존 동작·검사·남은 한계를 보고하세요. 전문가 판단·기능 근거·참여자 측정을 구별하고 사용자 시험이나 품질 점수를 지어내지 마세요.', '実前後の参照、実装変更と意図、観察比較結果（改善/同じ/後退/未検証）、保持動作、検査、限界を報告します。専門判断、機能根拠、参加者測定を区別し、利用者試験や品質点を捏造しません。'),
};

export const FOUNDATION_IDENTITY = {
  schema: 'webstylebook.design-foundations.v1',
  version: '1.0.0',
  contentHash: stableHashOf({ foundations: FOUNDATIONS, sources: FOUNDATION_SOURCES, protocol: IMPROVEMENT_PROTOCOL }),
};

export function foundationManifest() {
  return {
    ...FOUNDATION_IDENTITY,
    foundations: FOUNDATIONS.length,
    sources: FOUNDATION_SOURCES.length,
    languages: ['en', 'ko', 'ja'],
    categories: FOUNDATION_CATEGORIES,
    resourceUri: 'webstylebook://foundations',
    sourcesResourceUri: 'webstylebook://foundations/sources',
    tool: 'get_design_improvement_plan',
    authorship: 'Independently authored MIT content. External publications retain their rights; citations do not license their text, images or brand assets.',
  };
}

/** Structural/source integrity, not an automated assessment of pedagogical or visual quality. */
export function validateFoundations(
  repo: CatalogRepository, foundations: DesignFoundation[] = FOUNDATIONS,
  sources: FoundationSource[] = FOUNDATION_SOURCES,
): string[] {
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  const ids = new Set<string>();
  const usedSources = new Set<string>();
  const requireLocalized = (value: unknown, path: string): void => {
    const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    for (const lang of ['en', 'ko', 'ja']) {
      if (typeof object[lang] !== 'string' || !(object[lang] as string).trim()) errors.push(`${path}.${lang} missing translation`);
    }
  };
  const checkLocalized = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (['en', 'ko', 'ja'].some((lang) => lang in object)) {
      for (const lang of ['en', 'ko', 'ja']) {
        if (typeof object[lang] !== 'string' || !(object[lang] as string).trim()) errors.push(`${path}.${lang} missing translation`);
      }
    } else {
      for (const [key, child] of Object.entries(object)) checkLocalized(child, `${path}.${key}`);
    }
  };
  for (const source of sources) {
    if (sourceIds.has(source.id)) errors.push(`duplicate source ${source.id}`);
    sourceIds.add(source.id);
    if (!/^https:\/\//.test(source.url)) errors.push(`source ${source.id} needs an HTTPS URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.reviewedAt)) errors.push(`source ${source.id} missing review date`);
    if (source.kind === 'standard-explanation' && !source.standard) errors.push(`source ${source.id} missing criterion/level`);
    requireLocalized(source.supports, `source.${source.id}.supports`);
    checkLocalized(source, `source.${source.id}`);
  }
  for (const foundation of foundations) {
    if (ids.has(foundation.id)) errors.push(`duplicate foundation ${foundation.id}`);
    ids.add(foundation.id);
    if (!(FOUNDATION_CATEGORIES as readonly string[]).includes(foundation.category)) errors.push(`${foundation.id} unknown category`);
    if (!foundation.concerns.length || foundation.concerns.some((c) => !DESIGN_CONCERNS.includes(c))) errors.push(`${foundation.id} invalid concerns`);
    if (!foundation.surfaces.length || foundation.surfaces.some((s) => !UX_SURFACES.includes(s))) errors.push(`${foundation.id} invalid surfaces`);
    if (!foundation.sourceIds.length) errors.push(`${foundation.id} missing sources`);
    for (const id of foundation.sourceIds) {
      usedSources.add(id);
      if (!sourceIds.has(id)) errors.push(`${foundation.id} unknown source ${id}`);
    }
    for (const id of foundation.relatedPrincipleIds) {
      if (!repo.getDesignPrinciple(id)) errors.push(`${foundation.id} unknown principle ${id}`);
    }
    if (!foundation.observe.length || !foundation.compare.length || foundation.decisions.length < 2) errors.push(`${foundation.id} incomplete decision/comparison guidance`);
    for (const key of ['name', 'principle', 'preserve'] as const) requireLocalized(foundation[key], `${foundation.id}.${key}`);
    foundation.observe.forEach((value, index) => requireLocalized(value, `${foundation.id}.observe.${index}`));
    foundation.decisions.forEach((rule, index) => {
      for (const key of ['when', 'change', 'instead'] as const) requireLocalized(rule[key], `${foundation.id}.decisions.${index}.${key}`);
    });
    foundation.compare.forEach((check, index) => requireLocalized(check.test, `${foundation.id}.compare.${index}`));
    if (new Set(foundation.examples.map((example) => example.surface)).size < 2) errors.push(`${foundation.id} needs examples across UI surfaces`);
    for (const example of foundation.examples) {
      if (!UX_SURFACES.includes(example.surface)) errors.push(`${foundation.id} invalid example surface`);
      requireLocalized(example.before, `${foundation.id}.example.before`);
      requireLocalized(example.after, `${foundation.id}.example.after`);
    }
    checkLocalized(foundation, `foundation.${foundation.id}`);
  }
  for (const id of sourceIds) if (!usedSources.has(id)) errors.push(`unused research source ${id}`);
  checkLocalized(IMPROVEMENT_PROTOCOL, 'protocol');
  return errors;
}
