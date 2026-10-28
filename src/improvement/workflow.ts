import { stableHashOf } from '../catalog/stable-hash.js';
import { text } from '../localization.js';
import { L } from '../foundations/types.js';
import type { Lang } from '../types.js';
import { IMPROVEMENT_CHECKS, type ImprovementContext } from './schema.js';

export const IMPROVEMENT_WORKFLOW_SCHEMA = 'webstylebook.improvement-workflow.v1';
export const IMPROVEMENT_WORKFLOW_URI = 'webstylebook://workflows/improve-ui';

const stages = [
  {
    id: 'capture-before',
    instruction: L(
      'Inspect the actual UI and primary user task. Preserve an immutable before screenshot, rendered HTML/CSS or native structure inventory, source identity and interaction inventory. Record route, viewport, resolved theme, locale, state, input data/clock, semantic scroll anchor, zoom, device scale and loaded fonts. Infer bounded targets from the authorized task; ask only for a missing fact that prevents execution. If the UI has already changed, recover the baseline from version control in isolation; never recreate a supposed before image by restyling the after image.',
      '실제 UI와 주된 사용자 과업을 확인합니다. 수정 전 스크린샷, 렌더 HTML/CSS 또는 네이티브 구조 목록, 소스 식별자와 상호작용 목록을 보존합니다. 경로·화면 크기·해석된 테마·언어·상태·입력 데이터와 시각·스크롤 기준점·확대율·배율·폰트 로딩을 기록합니다. 승인된 작업에서 필요한 대상을 정하고 실행을 막는 정보만 묻습니다. 이미 수정했다면 버전 관리에서 원본을 분리 복구하며, 수정 후 화면을 꾸며 수정 전으로 제시하지 않습니다.',
      '実UIと主な利用者タスクを確認し、変更前の画像、描画HTML/CSSまたはネイティブ構造、ソース識別子、操作一覧を保存します。経路、画面寸法、解決済みテーマ、言語、状態、入力データと時刻、スクロール基準、ズーム、倍率、フォント読込を記録します。許可された範囲から対象を定め、実行を妨げる不足情報だけ確認します。変更済みなら版管理から原本を別環境に復元し、変更後画像の装飾を変更前と偽りません。'),
    tools: ['get_design_improvement_plan'],
  },
  {
    id: 'decide',
    instruction: L(
      'Use the selected foundations to connect an observed task obstacle to a conditional remedy and an observable success check. Record baseline strengths in context.constraints and compare each gain against losses in group membership, useful visible information, continuity and reading comfort. Keep the original as a valid alternative. Consider counterexamples, working behavior and product identity. Prioritize task completion, information hierarchy and legibility before decoration. Do not force a new style, wider spacing, fewer cards or a font change without evidence. Retrieve omitted relevant foundations as needed.',
      '선택된 디자인 지식으로 관찰한 과업 장애, 조건에 맞는 수정, 확인할 성공 기준을 연결합니다. 원본의 장점을 context.constraints에 기록하고 이득과 그룹 구분·실제로 보이는 정보·연속성·읽기 편안함의 손실을 비교합니다. 원본 유지도 대안에 포함합니다. 반례·정상 동작·제품 정체성을 고려하고 장식보다 과업 완수·정보 위계·읽기를 우선합니다. 근거 없이 새 스타일·넓은 여백·카드 제거·폰트 교체를 강요하지 않습니다. 누락된 관련 지식은 추가 조회합니다.',
      '選んだ知識から観察した障害、条件に合う修正、確認可能な成功条件を結びます。原本の長所をcontext.constraintsに記録し、利点と所属、見える情報、連続性、読み心地の損失を比較します。原本維持も選択肢とします。反例、正常動作、製品らしさを考慮し、装飾よりタスク完了、情報階層、可読性を優先します。根拠なく新スタイル、余白拡大、カード削除、書体変更を強いません。必要な未取得知識を追加取得します。'),
    tools: ['get_design_improvement_plan', 'get_design_principle_plan', 'get_ux_principle_plan', 'get_ui_state_plan'],
  },
  {
    id: 'implement',
    instruction: L(
      'The host agent edits the real UI source using its available editor tools, preserves unrelated work and records changed files plus a diff. A diagnosis, proposed CSS, mock image or report is not implementation. Continue without another approval of already authorized fixes. Explicit review-only requests remain read-only; commit, push, release and deployment require their own authorization. Missing source or execution access is a concrete blocker, not a completed improvement.',
      '호스트 AI가 편집 도구로 실제 UI 소스를 수정하고, 관련 없는 작업을 보존하며 변경 파일과 diff를 기록합니다. 진단·CSS 제안·가상 이미지·보고서는 실제 수정이 아닙니다. 이미 승인된 수정은 재승인을 기다리지 않고 진행합니다. 명시적 검토 전용 요청은 읽기만 하며 커밋·푸시·릴리스·배포에는 각각 권한이 필요합니다. 소스나 실행 환경에 접근할 수 없다면 구체적인 미완료 사유로 보고합니다.',
      'ホストAIが編集ツールで実UIソースを変更し、無関係な作業を保護し、変更ファイルと差分を記録します。診断、CSS提案、仮画像、報告だけでは実装ではありません。許可済み修正の再承認を待ちません。明示的レビュー専用は読み取りのみとし、コミット、プッシュ、リリース、デプロイには各権限が必要です。ソースや実行環境へのアクセス不足は未完了の具体的理由として報告します。'),
    tools: [],
  },
  {
    id: 'verify',
    instruction: L(
      'Render the edited UI under the recorded conditions and capture fresh after evidence. Visually compare both versions; exercise affected behavior, keyboard/focus, accessibility, recovery and relevant narrow/error states. Run appropriate build/tests. For DOM-based UIs, run compare_page_revisions and validate its preservation results with a separate revisionPreservation audit plan; for other UIs, compare the saved semantic/interaction inventory. Static preservation and contract validity are not visual or behavioral proof. Repair or revert regressions, then recapture and recheck the affected targets. User feedback that identifies a regression reopens prior improvement claims; correct superseded reports and keep only supported gains. Passing tests cannot override that feedback.',
      '기록한 조건에서 수정된 UI를 렌더링하고 새 수정 후 증거를 확보합니다. 두 화면을 직접 비교하고 영향받는 동작·키보드와 포커스·접근성·복구·좁은 화면과 오류 상태를 검사합니다. 적절한 빌드와 테스트를 실행합니다. DOM UI는 compare_page_revisions와 별도의 revisionPreservation 감사 계획으로 보존 결과를 검증하고, 그 외 UI는 저장한 의미 구조와 상호작용 목록을 비교합니다. 정적 보존이나 계약 유효성이 시각·동작 개선의 증명은 아닙니다. 퇴행을 고치거나 되돌린 후 해당 대상을 다시 캡처·검증합니다. 사용자가 퇴행을 지적하면 이전 개선 판정을 다시 열고 보고를 정정하며 근거 있는 이득만 남깁니다. 테스트 통과로 피드백을 덮지 않습니다.',
      '記録条件で変更後UIを描画し、新しい証拠を保存します。両画面を目視比較し、影響する操作、キーボードとフォーカス、アクセシビリティ、復旧、狭い画面とエラー状態を確認します。必要なビルドとテストを実行します。DOM UIはcompare_page_revisionsと別のrevisionPreservation監査計画で保存結果を検証し、それ以外は意味構造と操作一覧を比較します。静的保存や契約の有効性は視覚・動作改善の証明ではありません。退行を修復または戻した後、対象を再記録・再検証します。退行の指摘があれば以前の改善判定を再検討し報告を訂正し、根拠ある利点だけを残します。テスト成功で意見を上書きしません。'),
    tools: ['compare_page_revisions', 'get_design_audit_plan', 'validate_design_audit_result'],
  },
  {
    id: 'report',
    instruction: L(
      'Call validate_design_improvement_result with this plan query and workflow.planHash, actual captures, implemented changes, observed checks, per-target outcomes and limitations. Follow nextActions until in-scope work is done or a concrete blocker remains. Deliver the before/after artifact links, what changed and why, measured or expert-observed differences, verification, tradeoffs and remaining unverified work. A side-by-side or toggle viewer helps when many screenshots are involved. Never invent scores, time savings or user-study results. complete describes submitted evidence coverage, not an independent quality certification; no-change must never be marketed as an improvement.',
      '이 계획 입력과 workflow.planHash, 실제 캡처·구현된 변경·관찰한 검사·대상별 결과·한계를 validate_design_improvement_result에 제출합니다. 범위 안의 작업을 끝내거나 구체적인 장애가 남을 때까지 nextActions를 수행합니다. 전후 이미지 링크, 무엇을 왜 고쳤는지, 측정 또는 전문가 관찰 차이, 검증·상충점·미검증 항목을 보고합니다. 이미지가 많으면 나란히 보기나 전환형 보고서가 유용합니다. 점수·시간 절감·사용자 조사 결과를 꾸며내지 않습니다. complete는 제출 증거의 충족 상태이며 독립적 품질 인증이 아닙니다. no-change를 개선했다고 표현하지 않습니다.',
      'この計画入力とworkflow.planHash、実画像、実装変更、観察した検査、対象別結果、制約をvalidate_design_improvement_resultへ提出します。範囲内作業を完了するか具体的障害が残るまでnextActionsを実行します。前後画像、何をなぜ変更したか、測定または専門家観察による差、検証、トレードオフ、未検証事項を報告します。画像が多ければ並列・切替表示が便利です。点数、時間短縮、利用者調査を捏造しません。completeは提出証拠の充足であり独立品質認証ではなく、no-changeを改善と呼びません。'),
    tools: ['validate_design_improvement_result'],
  },
];

export function improvementWorkflow(locale: Lang, context: ImprovementContext | undefined, foundationPlanHash: string) {
  return {
    schema: IMPROVEMENT_WORKFLOW_SCHEMA,
    resourceUri: IMPROVEMENT_WORKFLOW_URI,
    planHash: stableHashOf({ schema: IMPROVEMENT_WORKFLOW_SCHEMA, stages, requiredChecks: IMPROVEMENT_CHECKS, foundationPlanHash, context: context ?? null }),
    defaultIntent: 'implement-verify-report' as const,
    executor: 'host-agent' as const,
    context: context ?? null,
    nextStage: 'capture-before' as const,
    stages: stages.map((stage) => ({ ...stage, instruction: text(stage.instruction, locale) })),
    requiredChecksPerTarget: [...IMPROVEMENT_CHECKS],
    completionTool: 'validate_design_improvement_result' as const,
    completionRequiresContext: true,
    acceptance: text(L(
      'Every planned target needs a matched, font-ready before/after pair; actual implemented diffs for claimed improvements; visual, behavior, preservation and affected-accessibility checks; explicit outcomes and a before/after report. Proposals, missing evidence or regressions cannot complete an improvement. Honest unchanged targets may accompany improved ones. With no implemented or proposed changes, fully verified unchanged targets produce no-change.',
      '계획한 모든 대상에 조건이 일치하고 폰트가 로딩된 전후 캡처, 개선을 주장하는 실제 구현 diff, 시각·동작·보존·관련 접근성 검사, 명시적 결과와 전후 보고가 필요합니다. 제안·증거 누락·퇴행은 개선 완료가 아닙니다. 개선된 대상과 변화 없는 대상을 함께 보고할 수 있습니다. 구현·제안 변경이 없고 모든 대상이 검증된 변화 없음이라면 no-change입니다.',
      '全計画対象に条件一致・フォント読込済みの前後画像、改善を主張する実装差分、視覚・操作・保存・関連アクセシビリティ検査、明示的結果と前後報告が必要です。提案、証拠不足、退行では改善完了になりません。改善対象と変更なしを併記できます。実装・提案変更がなく全対象で変更なしを検証した場合はno-changeです。'), locale),
  };
}
