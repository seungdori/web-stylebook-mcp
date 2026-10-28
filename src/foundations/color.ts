import { L, type DesignFoundation } from './types.js';

export const COLOR_FOUNDATIONS: DesignFoundation[] = [
  {
    id: 'semantic-color', category: 'color', name: L('Color roles and theme relationships', '색의 역할과 테마 관계', '色の役割とテーマの関係'),
    principle: L('Color should communicate consistent roles across surfaces, states and themes, with redundant cues for meaning.', '색은 표면·상태·테마를 넘어 일관된 역할을 전달하고 의미에는 추가 단서를 제공합니다.', '色は面、状態、テーマを通じ一貫した役割を伝え、意味には追加の手掛かりを添えます。'),
    concerns: ['consistency', 'accessibility', 'focus'], surfaces: ['global'], relatedPrincipleIds: ['role-based-color', 'bounded-choice-system', 'redundant-state-signals'], sourceIds: ['color-roles', 'color-not-alone'],
    observe: [L('Map each color to action, selection, status, text or surface; look for conflicting meanings and theme-dependent loss.', '각 색을 행동·선택·상태·글·표면에 대응시키고 의미 충돌과 테마별 손실을 찾으세요.', '色を操作、選択、状態、文字、面に対応させ、意味の衝突とテーマ別の欠落を探します。')],
    decisions: [
      { when: L('Unrelated meanings share one accent or the same role changes color.', '무관한 의미가 같은 강조색을 쓰거나 같은 역할의 색이 바뀝니다.', '無関係な意味が同じ強調色を使うか、同じ役割の色が変わります。'), change: L('Introduce semantic role tokens and reserve emphasis for the intended role.', '의미 역할 토큰을 만들고 의도한 역할에 강조를 배분하세요.', '意味役割のトークンを作り、意図した役割に強調を配分します。'), instead: L('Brand color may overlap a status hue; add clear labels rather than changing identity automatically.', '브랜드색과 상태색이 겹칠 수 있으므로 정체성을 자동 변경하기보다 명확한 라벨을 더하세요.', 'ブランド色と状態色は重なる場合があり、個性の自動変更より明確なラベルを追加します。') },
      { when: L('Selection or error exists only as a color change.', '선택이나 오류를 색 변화로만 알립니다.', '選択やエラーを色変化だけで示しています。'), change: L('Add text, shape or an icon and expose the state programmatically.', '글·형태·아이콘을 더하고 상태를 프로그램적으로도 드러내세요.', '文字、形、アイコンを加え、状態をプログラム上でも示します。'), instead: L('Do not remove useful color merely because it cannot carry meaning alone.', '색만으로 의미를 전할 수 없다는 이유로 유용한 색까지 제거하지 마세요.', '色単独では伝えられないからといって有用な色まで除きません。') },
    ],
    preserve: L('Keep recognized brand/status meanings and established reading-surface tones. A pale reading canvas and a white control surface can have different useful roles; replacing both with a generic surface token is not automatically cleaner or more legible. Compare actual contrast and reading comfort separately, honoring known user feedback.', '인지된 브랜드·상태 의미와 기존 읽기 배경의 명도를 보존하세요. 옅은 본문 배경과 흰 컨트롤 표면은 서로 다른 역할을 할 수 있습니다. 둘을 일반 surface 토큰으로 통일한다고 자동으로 깔끔하거나 잘 읽히지 않습니다. 실제 대비와 읽기 편안함을 따로 비교하고 확인된 사용자 피드백을 반영하세요.', '認識されたブランド・状態の意味と既存の読書面の明度を保ちます。淡い本文背景と白い操作面には別の役割があり、汎用surfaceトークンへの統一で自動的に明瞭にはなりません。実際の対比と読み心地を別々に比べ、既知の利用者意見を反映します。'),
    compare: [{ evidence: 'rendered', test: L('Compare normal, selected, error and disabled states in each theme; check meaning with color removed as a diagnostic, not a complete accessibility test.', '각 테마의 일반·선택·오류·비활성을 비교하고 색 제거를 진단 보조로 쓰되 접근성 전체 검사로 간주하지 마세요.', '各テーマの通常、選択、エラー、無効を比べ、無彩色化は診断補助とし完全なアクセシビリティ検査とはしません。') }],
    examples: [
      { surface: 'form', before: L('Invalid fields are red with no explanation.', '잘못된 필드가 설명 없이 빨갛습니다.', '無効な入力が説明なく赤くなります。'), after: L('Each invalid field has a message and associated error state.', '오류 메시지와 연결된 오류 상태를 제공합니다.', 'メッセージと関連付いたエラー状態を提供します。') },
      { surface: 'settings', before: L('A selected tab resembles an error in dark mode.', '다크 모드에서 선택 탭이 오류처럼 보입니다.', '暗色で選択タブがエラーに見えます。'), after: L('Selection and error retain distinct roles in both themes.', '두 테마에서 선택과 오류의 역할을 구별합니다.', '両テーマで選択とエラーの役割を区別します。') },
    ],
  },
  {
    id: 'contrast-legibility', category: 'color', name: L('Legibility through measured contrast', '측정 가능한 대비와 가독성', '測定できる対比と読みやすさ'),
    principle: L('Judge contrast using actual foreground/background relationships and the element’s role, not a screenshot’s apparent brightness.', '스크린샷의 밝은 인상 대신 실제 전경·배경 관계와 요소의 역할로 대비를 판단합니다.', '画像の明るい印象ではなく実際の前景と背景の関係、要素の役割から対比を判断します。'),
    concerns: ['accessibility', 'readability', 'focus'], surfaces: ['global'], relatedPrincipleIds: ['contrast-before-scale', 'perceptual-color-ramps'], sourceIds: ['text-contrast', 'ui-contrast'],
    observe: [L('Inspect computed colors, opacity and backgrounds for text, focus indicators, controls and meaningful graphics in every state.', '모든 상태에서 글·포커스 표시·컨트롤·의미 그래픽의 계산된 색·투명도·배경을 확인하세요.', '全状態の文字、フォーカス表示、操作部、意味ある図の計算色、透明度、背景を確認します。')],
    decisions: [
      { when: L('Meaningful text is too faint.', '의미 있는 글이 너무 흐립니다.', '意味ある文字が薄すぎます。'), change: L('Adjust the actual color pair to the applicable text-contrast requirement; retain secondary hierarchy using spacing or weight.', '해당 텍스트 대비 기준에 맞게 색 쌍을 조정하고 보조 위계는 간격·굵기로 유지하세요.', '対象の文字対比基準に合う色の組へ調整し、補助階層は間隔や太さで保ちます。'), instead: L('Large-text eligibility and exceptions must be checked; visual enlargement alone does not automatically qualify.', '큰 글자 조건과 예외를 확인하세요. 겉으로 커 보인다고 자동 적용되지 않습니다.', '大きな文字の条件と例外を確認します。見た目の大きさだけでは該当しません。') },
      { when: L('A necessary control or state edge is indistinguishable.', '필수 컨트롤이나 상태 경계가 구별되지 않습니다.', '必要な操作部や状態の縁を区別できません。'), change: L('Repair the meaningful cue against adjacent colors and retest all backgrounds.', '인접 색 대비 의미 단서를 보완하고 모든 배경에서 재검사하세요.', '隣接色に対する意味の手掛かりを直し、全背景で再検査します。'), instead: L('Decorative dividers need not all become dark; inactive and other criterion exceptions require contextual assessment.', '장식 구분선을 모두 진하게 할 필요는 없습니다. 비활성 등 기준의 예외는 맥락에 따라 판단하세요.', '装飾区切りを全て濃くする必要はありません。無効状態などの例外は文脈で判断します。') },
    ],
    preserve: L('Maintain role distinctions and brand relationships while repairing accessibility.', '접근성을 고치면서 역할 차이와 브랜드 관계를 유지하세요.', 'アクセシビリティを直す間も役割の違いとブランドの関係を保ちます。'),
    compare: [{ evidence: 'computed-style', test: L('Record actual color pairs and ratios: 4.5:1 ordinary text, 3:1 qualifying large text and applicable non-text cues. Record exceptions; do not infer a WCAG pass from these checks alone.', '실제 색 쌍과 비율을 기록하세요. 일반 글 4.5:1, 큰 글 조건과 해당 비텍스트 단서 3:1이며 예외를 기록하고 이것만으로 WCAG 전체 통과를 주장하지 마세요.', '実色の組と比率を記録します。通常文字4.5:1、条件を満たす大文字と対象の非文字手掛かり3:1です。例外を記し、これだけでWCAG全体の合格とはしません。') }],
    examples: [
      { surface: 'checkout', before: L('Delivery restrictions use nearly invisible gray text.', '배송 제한이 거의 안 보이는 회색입니다.', '配送制限がほぼ見えない灰色です。'), after: L('Restrictions stay readable without dominating the purchase action.', '구매 행동을 압도하지 않으면서 제한을 읽게 합니다.', '購入操作を圧倒せず制限を読めるようにします。') },
      { surface: 'search', before: L('The focused filter blends into its background.', '포커스 필터가 배경에 섞입니다.', 'フォーカス中のフィルターが背景に溶け込みます。'), after: L('A measurable cue identifies the active keyboard location.', '측정 가능한 단서로 키보드 위치를 드러냅니다.', '測定できる手掛かりでキーボード位置を示します。') },
    ],
  },
  {
    id: 'data-encoding', category: 'color', name: L('Encode data relationships faithfully', '데이터 관계의 충실한 표현', 'データ関係の忠実な表現'),
    principle: L('Visual encoding should match whether values are categories, ordered magnitudes or deviations from a reference.', '시각적 표현은 값이 범주·순서 있는 크기·기준 대비 편차 중 무엇인지에 맞춰야 합니다.', '視覚表現は値がカテゴリ、順序ある大きさ、基準からの偏差のどれかに合わせます。'),
    concerns: ['scanability', 'consistency', 'accessibility'], surfaces: ['data-table', 'developer-console', 'content'], relatedPrincipleIds: ['perceptual-color-ramps', 'redundant-state-signals'], sourceIds: ['data-color', 'color-not-alone', 'data-table'],
    observe: [L('Identify the data type, units, comparison baseline, missing values and meaning of each color.', '데이터 유형·단위·비교 기준·누락값·각 색의 의미를 확인하세요.', 'データ型、単位、比較基準、欠損値、各色の意味を確認します。')],
    decisions: [
      { when: L('Ordered values use unrelated category colors.', '순서 있는 값에 무관한 범주색을 씁니다.', '順序のある値に無関係なカテゴリ色を使っています。'), change: L('Use an ordered scale, or a diverging scale around a meaningful reference; retain labels and units.', '순서 척도나 의미 있는 기준 중심의 발산 척도를 쓰고 라벨·단위를 유지하세요.', '順序尺度か意味ある基準中心の発散尺度を使い、ラベルと単位を保ちます。'), instead: L('Unordered categories do not imply a ranking; do not manufacture one through brightness.', '순서 없는 범주에 밝기 차이로 임의의 순위를 만들지 마세요.', '順序のないカテゴリに明るさで勝手な順位を付けません。') },
      { when: L('Values require excessive cross-reading or color interpretation.', '값을 읽으려 과도한 왕복이나 색 해석이 필요합니다.', '値を読むため過剰な往復や色解釈が必要です。'), change: L('Align comparable values, keep units explicit and add direct labels or accessible data.', '비교 값을 정렬하고 단위를 명시하며 직접 라벨이나 접근 가능한 데이터를 제공하세요.', '比較値を揃え、単位を示し、直接ラベルやアクセス可能なデータを提供します。'), instead: L('Do not silently rescale axes, hide uncertainty or turn missing data into zero for visual neatness.', '정돈하려 축 척도를 몰래 바꾸거나 불확실성을 숨기거나 누락을 0으로 바꾸지 마세요.', '見栄えのため軸尺度を黙って変更し、不確実性を隠し、欠損をゼロにしません。') },
    ],
    preserve: L('Keep numerical meaning, units, ordering, uncertainty and access to precise values.', '수치 의미·단위·순서·불확실성·정확한 값 접근을 보존하세요.', '数値の意味、単位、順序、不確実性、正確な値へのアクセスを保ちます。'),
    compare: [{ evidence: 'user-task', test: L('Use the same dataset before/after and ask the same comparison question; verify that the answer and units remain correct.', '같은 데이터와 같은 비교 질문으로 전후를 확인하고 답과 단위가 정확한지 검증하세요.', '同じデータと比較質問で前後を確認し、答えと単位が正しいか検証します。') }],
    examples: [
      { surface: 'data-table', before: L('Currency values use inconsistent decimal alignment.', '금액의 소수점 정렬이 제각각입니다.', '金額の小数点揃えが不統一です。'), after: L('Comparable values align with consistent units and precision.', '같은 단위·정밀도로 비교 값을 정렬합니다.', '同じ単位と精度で比較値を揃えます。') },
      { surface: 'developer-console', before: L('Latency magnitude is encoded as an arbitrary rainbow.', '지연 크기를 임의의 무지개색으로 표현합니다.', '遅延の大きさを任意の虹色で表します。'), after: L('An ordered scale and explicit legend express magnitude.', '순서 척도와 명시적 범례로 크기를 표현합니다.', '順序尺度と明示的な凡例で大きさを示します。') },
    ],
  },
];
