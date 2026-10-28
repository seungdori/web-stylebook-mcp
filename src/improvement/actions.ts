import type { Lang } from '../types.js';

// Stable codes remain machine-readable; the human's remaining-work list follows the output locale.
const actions = {
  context: ['실제 사용자 과업과 비교 대상 조건을 context에 기록해 개선 계획을 다시 받으세요.', '実際の利用者タスクと対象条件をcontextに記録して改善計画を取得してください。'],
  plan: ['원래 대상 범위를 보존하고 정확한 계획 입력의 workflow.planHash를 사용하세요.', '元の対象範囲を保ち、正確な計画入力のworkflow.planHashを使ってください。'],
  identity: ['대상·캡처·변경·검사 ID와 참조를 확인하고 중복이나 다른 대상의 참조를 바로잡으세요.', '対象・画像・変更・検査のIDと参照を確認し、重複や別対象の参照を修正してください。'],
  knowledge: ['실제 디자인 원론을 조회하고 관찰한 문제와 조건에 맞는 수정법을 연결하세요.', '実際のデザイン知識を取得し、観察した問題と条件に合う修正を結び付けてください。'],
  implement: ['실제 소스를 수정하고 변경 파일과 diff를 저장하세요. 제안이나 가상 이미지는 구현 증거가 아닙니다. 접근할 수 없다면 구체적인 장애를 보고하세요.', '実ソースを修正し、変更ファイルと差分を保存してください。提案や仮画像は実装証拠ではありません。アクセス不可なら具体的障害を報告してください。'],
  outcome: ['이 대상에 영향을 준 모든 변경과 실제 관찰 결과를 보고하세요. 확인하지 못한 항목은 미검증으로 남기세요.', 'この対象に影響する全変更と実際の観察結果を報告し、未確認事項は未検証として残してください。'],
  repair: ['실패하거나 퇴행한 변경을 고치거나 되돌린 뒤 해당 대상을 다시 캡처하고 검증하세요.', '失敗・退行した変更を修復または戻してから、対象を再記録・再検証してください。'],
  capture: ['불변의 수정 전 원본과 실제 수정 후 화면을 각각 확보하세요. 원본이 없다면 버전 관리에서 분리 복구하고, 수정 후 이미지를 원본처럼 꾸미지 마세요.', '変更前の不変原本と実際の変更後画面を別々に保存してください。原本がなければ版管理から分離復元し、変更後画像を原本と偽らないでください。'],
  conditions: ['화면 크기·테마·언어·상태·입력 데이터와 시각·스크롤 기준점·확대율·배율을 기록 조건에 맞추고 다시 캡처하세요.', '画面寸法・テーマ・言語・状態・入力データと時刻・スクロール基準・ズーム・倍率を記録条件に合わせて再撮影してください。'],
  fonts: ['의도한 폰트 로딩이 끝난 뒤 다시 캡처하세요. 대체 폰트와 정상 폰트를 전후 차이로 비교하지 마세요.', '意図したフォントの読込後に再撮影してください。代替フォントと本来のフォントを前後差として比較しないでください。'],
  source: ['원본과 수정된 소스·빌드 식별자를 구분하세요. 커밋하지 않은 수정은 diff나 내용 해시로 기록하세요.', '原本と編集済みソース・ビルドを区別し、未コミット変更は差分や内容ハッシュで記録してください。'],
  checks: ['수정 후 대상에서 필요한 검사를 실제 수행하고 캡처 참조·관찰한 조작 단계·결과 증거를 저장하세요. 근거 없는 통과 판정은 미검증입니다.', '変更後対象で必要な検査を実行し、画像参照・観察した操作手順・結果証拠を保存してください。根拠のない合格は未検証です。'],
  applicable: ['정적 UI에서도 시각 비교·내용 보존·관련 접근성 검사는 수행하세요.', '静的UIでも視覚比較・内容保存・関連アクセシビリティ検査は実行してください。'],
  reassess: ['수정법과 증거를 다시 판단하세요. 개선을 확인하지 못한 불필요한 변경은 고치거나 되돌리고 개선 효과를 꾸며내지 마세요.', '修正方法と証拠を再評価してください。改善を確認できない不要な変更は修復または戻し、効果を捏造しないでください。'],
} as const;

const codeAction: Record<string, keyof typeof actions> = {
  CONTEXT_REQUIRED: 'context', PLAN_MISMATCH: 'plan', DUPLICATE_ID: 'identity', UNKNOWN_TARGET: 'identity',
  UNKNOWN_FOUNDATION: 'knowledge', PROPOSAL_ONLY: 'implement', IMPLEMENTATION_EVIDENCE_MISSING: 'implement',
  OUTCOME_MISSING: 'outcome', CHANGE_TARGET_MISMATCH: 'identity', CHANGE_UNREPORTED: 'outcome',
  IMPROVEMENT_WITHOUT_IMPLEMENTATION: 'implement', REGRESSION: 'repair', OUTCOME_UNVERIFIED: 'checks',
  CAPTURE_MISSING: 'capture', CAPTURE_TARGET_MISMATCH: 'identity', CONDITIONS_MISMATCH: 'conditions',
  FONTS_NOT_READY: 'fonts', REUSED_SCREENSHOT: 'capture', SOURCE_NOT_DISTINGUISHED: 'source',
  CHECK_CAPTURE_MISMATCH: 'identity', CHECK_EVIDENCE_MISSING: 'checks', CHECK_NOT_SKIPPABLE: 'applicable',
  CHECK_FAILED: 'repair', CHECK_UNVERIFIED: 'checks', CHECK_MISSING: 'checks', NO_VERIFIED_IMPROVEMENT: 'reassess',
};

export function localizeImprovementAction(code: string, fallback: string, locale: Lang): string {
  const key = codeAction[code];
  return locale === 'en' || !key ? fallback : actions[key][locale === 'ko' ? 0 : 1];
}
