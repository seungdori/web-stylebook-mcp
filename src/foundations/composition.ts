import { L, type DesignFoundation } from './types.js';

export const COMPOSITION_FOUNDATIONS: DesignFoundation[] = [
  {
    id: 'grid-alignment', category: 'composition', name: L('Alignment and adaptable grids', '정렬과 적응하는 그리드', '揃えと適応するグリッド'),
    principle: L('Shared reading edges connect related regions; choose column behavior from the task rather than a universal page width.', '공유하는 읽기 기준선은 관련 영역을 연결합니다. 보편적인 페이지 폭 대신 과업에 맞춰 열 동작을 정합니다.', '共通の読み始めの線は関連領域を結びます。万能なページ幅ではなく課題から列の挙動を決めます。'),
    concerns: ['balance', 'grouping', 'responsiveness'], surfaces: ['global'], relatedPrincipleIds: ['task-sized-composition'], sourceIds: ['grid'],
    observe: [L('Trace heading, body, input and table edges; separate accidental misalignment from intentional indentation.', '제목·본문·입력·표의 기준선을 따라가며 우발적 어긋남과 의도적 들여쓰기를 구별하세요.', '見出し、本文、入力、表の端を追い、偶発的なずれと意図的な字下げを区別します。')],
    decisions: [
      { when: L('Related content starts on several arbitrary axes.', '관련 콘텐츠가 여러 임의의 축에서 시작합니다.', '関連内容が複数の任意の軸から始まります。'), change: L('Align the content edges with a shared grid; account for container padding and icon slots.', '컨테이너 패딩과 아이콘 자리를 고려해 콘텐츠 기준선을 공통 그리드에 맞추세요.', '枠の余白とアイコン枠を考慮し、内容の端を共通グリッドに揃えます。'), instead: L('Nested levels and optical correction can justify offsets; do not flatten meaningful indentation.', '계층과 시각적 보정은 어긋남의 이유가 될 수 있으므로 의미 있는 들여쓰기를 없애지 마세요.', '階層や視覚的な補正にはずれの理由があるため、意味ある字下げを消しません。') },
      { when: L('A reading width constrains a comparison workspace, or prose spans the whole monitor.', '읽기용 폭이 비교 작업을 가두거나 본문이 모니터 전체로 늘어집니다.', '読書用の幅が比較作業を狭めるか、本文が画面全体に伸びています。'), change: L('Give reading a bounded measure and comparison its own flexible grid; align their relationship.', '읽기에는 제한된 행 길이, 비교에는 유연한 그리드를 주고 두 영역의 관계를 정렬하세요.', '読書には制限した行長、比較には柔軟なグリッドを与え、両者の関係を揃えます。'), instead: L('Do not fill spare space with invented widgets or stretch text solely to fill the viewport.', '빈 곳을 채우려 위젯을 지어내거나 글을 화면 폭까지 늘리지 마세요.', '余白を埋めるだけのウィジェットや本文の引き伸ばしを避けます。') },
    ],
    preserve: L('Keep meaningful reading order and existing navigation landmarks.', '의미 있는 읽기 순서와 기존 탐색 랜드마크를 유지하세요.', '意味のある読み順と既存のナビゲーションランドマークを保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare shared edges at narrow, usual and wide widths with long real content, not only empty boxes.', '빈 상자뿐 아니라 긴 실제 콘텐츠로 좁은·일반·넓은 폭의 기준선을 비교하세요.', '空の箱だけでなく長い実内容で、狭い、通常、広い幅の共通線を比較します。') }],
    examples: [
      { surface: 'content', before: L('Article text stretches with an ultrawide window.', '초광폭 창에서 기사 본문이 함께 늘어납니다.', '超横長の窓で記事本文も伸びます。'), after: L('Reading width stays bounded while supplementary regions adapt.', '읽기 폭을 유지하고 보조 영역을 적응시킵니다.', '読む幅を保ち補助領域を適応させます。') },
      { surface: 'form', before: L('Headings align to cards while inputs align to a different grid.', '제목은 카드에, 입력은 다른 그리드에 맞습니다.', '見出しはカード、入力は別の軸に揃っています。'), after: L('Heading text and form content share an intentional axis.', '제목 글자와 폼 내용이 의도한 축을 공유합니다.', '見出し文字とフォーム内容で意図した軸を共有します。') },
    ],
  },
  {
    id: 'rhythm-consistency', category: 'composition', name: L('Repetition with meaningful variation', '의미에 따른 반복과 변화', '意味に沿った反復と変化'),
    principle: L('Repeat treatment for repeated roles; use variation to reveal differences that matter.', '같은 역할에는 같은 처리를 반복하고 중요한 차이를 드러낼 때 변화를 줍니다.', '同じ役割には同じ扱いを繰り返し、重要な違いを示すときに変化を付けます。'),
    concerns: ['consistency', 'scanability', 'restraint'], surfaces: ['global'], relatedPrincipleIds: ['bounded-choice-system', 'deliberate-type-scale'], sourceIds: ['spacing', 'heuristics'],
    observe: [L('Compare repeated roles across screens: row height, label position, state styling and spacing, including long values.', '긴 값까지 포함해 화면 간 반복 역할의 행 높이·라벨 위치·상태 표현·간격을 비교하세요.', '長い値も含め、画面間で繰り返す役割の行高、ラベル位置、状態表現、間隔を比較します。')],
    decisions: [
      { when: L('Equivalent roles accumulate incidental style differences.', '동등한 역할에 우발적인 스타일 차이가 쌓입니다.', '同等の役割に偶発的なスタイル差が蓄積しています。'), change: L('Consolidate to role-based tokens or a shared primitive, then check every affected context.', '역할 토큰이나 공통 컴포넌트로 통합하고 영향을 받는 모든 맥락을 확인하세요.', '役割トークンや共通部品に統合し、影響する全ての文脈を確認します。'), instead: L('Do not unify two roles merely because they happen to share today’s numeric value.', '지금 숫자가 같다는 이유만으로 다른 역할을 합치지 마세요.', '現在の数値が同じというだけで異なる役割を統合しません。') },
      { when: L('Everything repeats despite important differences.', '중요한 차이가 있는데도 모든 것이 반복됩니다.', '重要な違いがあるのに全てが反復します。'), change: L('Introduce a deliberate group break or state distinction where meaning changes.', '의미가 바뀌는 곳에 의도적인 그룹 경계나 상태 차이를 주세요.', '意味が変わる場所に意図的なグループ区切りや状態差を付けます。'), instead: L('Keep equivalent comparison items consistent; variety alone is not an improvement.', '동등한 비교 항목은 일관되게 유지하세요. 변화 자체가 개선은 아닙니다.', '同等の比較項目は一貫させます。変化だけでは改善になりません。') },
    ],
    preserve: L('Retain semantic differences between primary, destructive, selected and disabled states.', '주요·파괴적·선택·비활성 상태 사이의 의미 차이를 보존하세요.', '主要、破壊的、選択、無効の意味の違いを保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare several routes and every component state after a token change; a single polished screen is insufficient.', '토큰 변경 뒤 여러 경로와 컴포넌트의 모든 상태를 비교하세요. 한 화면만으로 충분하지 않습니다.', 'トークン変更後は複数の経路と部品の全状態を比較します。一画面だけでは不十分です。') }],
    examples: [
      { surface: 'settings', before: L('Each section uses a different label gap.', '섹션마다 라벨 간격이 다릅니다.', '区画ごとにラベル間隔が異なります。'), after: L('The same field relationship uses one token.', '같은 필드 관계에 같은 토큰을 씁니다.', '同じ入力関係に同じトークンを使います。') },
      { surface: 'data-table', before: L('A critical row looks like every healthy row.', '중요한 문제 행이 정상 행과 같습니다.', '重要な問題行が正常行と同じです。'), after: L('State is distinct while the comparison columns stay aligned.', '상태는 구별하고 비교 열 정렬은 유지합니다.', '状態を区別しつつ比較列の揃えを保ちます。') },
    ],
  },
  {
    id: 'task-density', category: 'composition', name: L('Density and progressive disclosure', '과업 밀도와 점진적 공개', '課題密度と段階的開示'),
    principle: L('Optimize the information needed for a task per screen, not the amount of empty space or number of visible controls alone.', '빈 공간의 양이나 컨트롤 수만이 아니라 한 화면에서 과업에 필요한 정보를 최적화합니다.', '余白量や操作部の数だけでなく、一画面で課題に必要な情報を最適化します。'),
    concerns: ['scanability', 'restraint', 'resilience'], surfaces: ['data-table', 'developer-console', 'settings', 'form', 'checkout', 'onboarding'],
    relatedPrincipleIds: ['task-aware-density', 'core-task-first'], sourceIds: ['disclosure', 'data-table'],
    observe: [L('List what users compare simultaneously, what they rarely change, and which consequences must stay visible.', '동시에 비교하는 것·드물게 바꾸는 것·항상 보여야 할 결과를 나누세요.', '同時比較するもの、まれに変えるもの、常に見せるべき結果を分けます。')],
    decisions: [
      { when: L('Rare configuration crowds the common task.', '드문 설정이 일반 과업을 밀어냅니다.', 'まれな設定が通常の課題を圧迫しています。'), change: L('Move optional complexity behind a named disclosure; retain visible values that affect the result.', '선택적 복잡성은 이름 있는 펼침 뒤로 옮기고 결과에 영향을 주는 값은 보이게 유지하세요.', '任意の複雑さを名前のある開閉部へ移し、結果に影響する値は見えるよう保ちます。'), instead: L('Never hide costs, consent, errors or prerequisites to create apparent simplicity.', '깔끔해 보이려고 비용·동의·오류·선행 조건을 숨기지 마세요.', '簡単に見せるため費用、同意、エラー、前提条件を隠しません。') },
      { when: L('Large padding forces repeated scrolling during comparison.', '큰 패딩 때문에 비교 중 스크롤이 반복됩니다.', '大きな余白で比較中にスクロールを繰り返します。'), change: L('Reduce redundant chrome and tune row spacing before reducing readable type or hit areas.', '읽을 글자나 조작 영역을 줄이기 전에 중복 장식을 걷고 행 간격을 조정하세요.', '読める文字や操作領域を縮める前に重複装飾を除き行間隔を調整します。'), instead: L('Occasional or high-consequence decisions may need more separation and explanation.', '드물거나 결과가 중요한 결정에는 더 넓은 구분과 설명이 필요할 수 있습니다.', 'まれな判断や結果が重大な判断には、広い区切りや説明が必要な場合があります。') },
    ],
    preserve: L('Keep all fields, actions, values and task dependencies reachable after disclosure changes.', '공개 방식 변경 뒤에도 모든 필드·행동·값·과업 의존성에 접근 가능해야 합니다.', '開示変更後も全項目、操作、値、課題の依存関係に到達できるようにします。'),
    compare: [{ evidence: 'interaction', test: L('Repeat the same comparison or form task; count required navigation and verify keyboard access to disclosed content.', '같은 비교·입력 과업을 반복해 필요한 이동을 확인하고 펼친 내용의 키보드 접근을 검증하세요.', '同じ比較や入力課題を繰り返し、必要な移動と開示内容へのキーボードアクセスを確認します。') }],
    examples: [
      { surface: 'developer-console', before: L('Each resource consumes a large decorative card.', '리소스마다 큰 장식 카드를 씁니다.', '資源ごとに大きな装飾カードを使っています。'), after: L('Comparable fields form compact rows with available details.', '비교 필드는 간결한 행으로 두고 상세에 접근하게 합니다.', '比較項目を簡潔な行にし、詳細へ到達できるようにします。') },
      { surface: 'onboarding', before: L('Advanced preferences precede the first useful action.', '고급 설정이 첫 유용한 행동보다 앞섭니다.', '高度な設定が最初の有用な操作より先にあります。'), after: L('Optional settings defer; required setup stays explicit.', '선택 설정은 미루고 필수 준비는 명시합니다.', '任意設定を後に回し、必須の準備は明示します。') },
    ],
  },
  {
    id: 'responsive-composition', category: 'composition', name: L('Reflow preserves relationships', '관계를 보존하는 반응형 구성', '関係を保つ再配置'),
    principle: L('Adapt relationships and task order as space changes; a desktop screen scaled down is not an adaptive composition.', '공간이 바뀌면 관계와 과업 순서를 적응시킵니다. 데스크톱을 축소하는 것만으로는 부족합니다.', '空間が変われば関係と課題順序を適応させます。デスクトップの縮小だけでは不十分です。'),
    concerns: ['responsiveness', 'accessibility', 'resilience'], surfaces: ['global'], relatedPrincipleIds: ['task-sized-composition', 'multi-input-operability'], sourceIds: ['reflow', 'focus-visible-area'],
    observe: [L('Inspect wraps, overflow, sticky regions, virtual keyboards and visual order relative to DOM order.', '줄바꿈·넘침·고정 영역·가상 키보드와 DOM 대비 시각적 순서를 확인하세요.', '折返し、はみ出し、固定領域、仮想キーボード、DOM順に対する視覚順を確認します。')],
    decisions: [
      { when: L('Columns become too narrow for their actual content.', '실제 내용을 담기에는 열이 너무 좁아집니다.', '実内容に対して列が狭くなりすぎます。'), change: L('Stack or transform at content-driven breakpoints; preserve labels, actions and reading sequence.', '콘텐츠가 무너지는 지점에서 쌓거나 변환하고 라벨·행동·읽기 순서를 보존하세요.', '内容が破綻する幅で積み重ねや変換を行い、ラベル、操作、読み順を保ちます。'), instead: L('Necessary two-dimensional tables or maps may retain local scrolling; do not destroy comparison to remove every scrollbar.', '필수 2차원 표·지도는 내부 스크롤이 필요할 수 있습니다. 스크롤바를 없애려고 비교 구조를 파괴하지 마세요.', '必須の二次元表や地図には局所スクロールが必要な場合があります。全スクロールバーを消すため比較構造を壊しません。') },
      { when: L('Sticky content hides focused fields or the next action.', '고정 콘텐츠가 포커스 필드나 다음 행동을 가립니다.', '固定内容がフォーカス欄や次の操作を隠します。'), change: L('Adjust sticky behavior and scrolling offsets; test with the keyboard open and zoom enabled.', '고정 동작과 스크롤 여유를 조정하고 키보드 표시·확대 상태에서 검증하세요.', '固定動作とスクロール余地を調整し、キーボード表示と拡大時に検証します。'), instead: L('Do not remove essential controls merely to fit a small screenshot.', '작은 스크린샷에 맞추려 필수 컨트롤을 제거하지 마세요.', '小さな画像に収めるため必須操作部を取り除きません。') },
    ],
    preserve: L('Maintain data, focus, scroll context and access to every task when changing layout.', '배치 변경 시 데이터·포커스·스크롤 맥락과 모든 과업의 접근성을 유지하세요.', '配置変更時もデータ、フォーカス、スクロール文脈、全課題へのアクセスを保ちます。'),
    compare: [{ evidence: 'interaction', test: L('Test the same task at 320 CSS px for applicable horizontal-writing content, normal width and zoom; document two-dimensional exceptions and obscured focus.', '해당 가로쓰기 콘텐츠를 320 CSS 픽셀·일반 폭·확대 상태에서 같은 과업으로 검사하고 2차원 예외와 가려진 포커스를 기록하세요.', '対象の横書き内容を320 CSSピクセル、通常幅、拡大で同じ課題を検査し、二次元の例外と隠れたフォーカスを記録します。') }],
    examples: [
      { surface: 'checkout', before: L('A sticky total hides the focused address field.', '고정 총액 영역이 포커스 주소 입력을 가립니다.', '固定合計がフォーカス中の住所欄を隠します。'), after: L('Summary and field remain accessible with the keyboard open.', '키보드가 열려도 요약과 필드에 접근할 수 있습니다.', 'キーボード表示中も概要と入力欄へ到達できます。') },
      { surface: 'data-table', before: L('A wide table forces the whole page to scroll horizontally.', '넓은 표 때문에 페이지 전체가 가로 스크롤됩니다.', '広い表でページ全体が横スクロールします。'), after: L('The comparison region scrolls locally while surrounding text reflows.', '비교 영역만 내부 스크롤하고 주변 글은 재배치합니다.', '比較領域だけを局所スクロールさせ周囲の文章を再配置します。') },
    ],
  },
];
