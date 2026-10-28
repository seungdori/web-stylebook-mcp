import { L, type DesignFoundation } from './types.js';

export const INTERACTION_FOUNDATIONS: DesignFoundation[] = [
  {
    id: 'action-affordance', category: 'interaction', name: L('Recognizable and operable actions', '알아보고 조작할 수 있는 행동', '認識でき操作できる動作'),
    principle: L('Appearance should suggest the actual action, while keyboard, pointer and assistive behavior support the same outcome.', '외형은 실제 행동을 암시하고 키보드·포인터·보조 기술은 같은 결과를 지원해야 합니다.', '外観は実際の操作を示し、キーボード、ポインター、支援技術が同じ結果を支えます。'),
    concerns: ['accessibility', 'consistency', 'resilience'], surfaces: ['navigation', 'form', 'checkout', 'settings', 'developer-console', 'chat'], relatedPrincipleIds: ['iconography-has-a-job', 'multi-input-operability'], sourceIds: ['keyboard', 'target-size', 'labels'],
    observe: [L('Find clickable-looking static objects, invisible actions, ambiguous icons, tiny targets and missing focus states.', '클릭처럼 보이는 정적 요소·안 보이는 행동·모호한 아이콘·작은 대상·누락 포커스를 찾으세요.', 'クリック風の静的要素、見えない操作、曖昧なアイコン、小さい対象、欠けたフォーカスを探します。')],
    decisions: [
      { when: L('An icon or surface conceals its behavior.', '아이콘이나 표면이 행동을 알아보기 어렵게 합니다.', 'アイコンや面から操作を読み取りにくい状態です。'), change: L('Use a familiar signifier or visible label, native semantics and consistent states.', '익숙한 단서나 보이는 라벨, 기본 의미 구조와 일관된 상태를 쓰세요.', '身近な手掛かりや見えるラベル、ネイティブな意味、一貫した状態を使います。'), instead: L('Do not label every decorative icon or imply clickability for noninteractive content.', '모든 장식 아이콘에 라벨을 달거나 비조작 내용이 클릭된다고 암시하지 마세요.', '全装飾アイコンにラベルを付けたり非操作内容をクリック可能に見せません。') },
      { when: L('Targets are difficult to activate or custom controls lack keyboard behavior.', '대상 조작이 어렵거나 사용자 정의 컨트롤에 키보드 동작이 없습니다.', '対象を操作しにくいか独自操作部にキーボード動作がありません。'), change: L('Expand usable hit areas and implement the appropriate keyboard/focus pattern; check the exact target-size criterion.', '실제 조작 영역을 넓히고 맞는 키보드·포커스 패턴을 구현하며 정확한 대상 크기 기준을 확인하세요.', '実操作領域を広げ、適切なキーとフォーカスのパターンを実装し対象寸法の基準を確認します。'), instead: L('24×24 CSS px is an AA minimum with listed exceptions, not a requirement to make every icon that size or a universal touch-comfort target.', '24×24 CSS 픽셀은 예외가 있는 AA 최소값이며 모든 아이콘 크기나 보편적 터치 편안함의 기준이 아닙니다.', '24×24 CSSピクセルは例外付きAA最低値で、全アイコンの寸法や万能なタッチ快適値ではありません。') },
    ],
    preserve: L('Keep action meaning, shortcuts and selection distinct from keyboard focus.', '행동 의미·단축키를 유지하고 선택과 키보드 포커스를 구별하세요.', '操作の意味とショートカットを保ち、選択とキーボードフォーカスを区別します。'),
    compare: [{ evidence: 'interaction', test: L('Run keyboard and pointer paths including focus, activation, cancel and return; measure hit areas rather than icon artwork.', '포커스·실행·취소·복귀를 포함한 키보드·포인터 경로를 실행하고 아이콘 그림 대신 실제 조작 영역을 측정하세요.', 'フォーカス、実行、取消、復帰を含むキーとポインター経路を実行し、アイコン絵ではなく実操作領域を測定します。') }],
    examples: [
      { surface: 'settings', before: L('A custom toggle works only on click.', '사용자 정의 스위치가 클릭으로만 동작합니다.', '独自スイッチがクリックでしか動きません。'), after: L('A named switch exposes state and supports keyboard activation.', '이름 있는 스위치가 상태와 키보드 실행을 지원합니다.', '名前のあるスイッチが状態とキー操作を支えます。') },
      { surface: 'chat', before: L('A small unlabeled send glyph has a tiny hit area.', '이름 없는 작은 전송 그림의 조작 영역이 작습니다.', '無名の小さな送信記号の操作領域が小さい状態です。'), after: L('Send has an accessible name, usable target and visible focus.', '전송에 접근 가능한 이름·사용 가능한 영역·보이는 포커스를 줍니다.', '送信にアクセシブルな名前、操作領域、見えるフォーカスを付けます。') },
    ],
  },
  {
    id: 'state-continuity', category: 'feedback', name: L('State, feedback and continuity', '상태·피드백·연속성', '状態、応答、連続性'),
    principle: L('The same object should remain understandable through loading, success, emptiness, partial data and failure.', '같은 대상은 로딩·성공·빈 상태·부분 데이터·실패를 거쳐도 이해할 수 있어야 합니다.', '同じ対象は読込、成功、空、部分データ、失敗を通じ理解できる必要があります。'),
    concerns: ['resilience', 'consistency', 'accessibility'], surfaces: ['search', 'data-table', 'chat', 'developer-console', 'form', 'checkout'], relatedPrincipleIds: ['complete-state-model', 'redundant-state-signals'], sourceIds: ['empty-states', 'status-message'],
    observe: [L('Enumerate reachable states and what users see before, during and after each action; distinguish empty results from unavailable data.', '도달 가능한 상태와 행동 전·중·후 표시를 나열하고 빈 결과와 데이터 불가를 구별하세요.', '到達状態と操作前中後の表示を列挙し、空の結果と取得不能を区別します。')],
    decisions: [
      { when: L('Loading erases useful context or looks like finished emptiness.', '로딩이 맥락을 지우거나 완료된 빈 상태처럼 보입니다.', '読込が文脈を消すか完了した空状態に見えます。'), change: L('Keep relevant structure, label waiting or stale data, and use real progress only when measurable.', '관련 구조를 유지하고 대기·오래된 데이터를 표시하며 측정 가능한 경우에만 실제 진행률을 쓰세요.', '関連構造を保ち待機や古いデータを示し、測定可能な時だけ実進捗を使います。'), instead: L('Do not fabricate percentages, silently replace results or erase user input.', '진행률을 꾸미거나 결과를 몰래 바꾸거나 사용자 입력을 지우지 마세요.', '進捗率の捏造、結果の無通知変更、入力の消去をしません。') },
      { when: L('One generic empty message covers several causes.', '여러 원인을 하나의 빈 메시지로 처리합니다.', '複数原因を一つの空メッセージで扱っています。'), change: L('Distinguish first use, no matches, permission issues and errors; offer the next action supported by that state.', '첫 사용·검색 없음·권한 문제·오류를 구별하고 해당 상태가 지원하는 다음 행동을 제공하세요.', '初回、該当なし、権限、エラーを区別し、その状態で可能な次の操作を提供します。'), instead: L('Do not prescribe creating data when the issue is filtering or lack of permission.', '필터나 권한 문제인데 데이터 생성부터 요구하지 마세요.', '絞り込みや権限が原因なのにデータ作成を求めません。') },
    ],
    preserve: L('Keep identity, input, selected context and truthful backend state through transitions.', '전환 중 식별 정보·입력·선택 맥락·실제 백엔드 상태를 보존하세요.', '遷移中も識別、入力、選択文脈、実際のバックエンド状態を保ちます。'),
    compare: [{ evidence: 'interaction', test: L('Exercise delayed, empty, partial and failed responses; check visible feedback and appropriate status announcements without stealing focus.', '지연·빈 응답·부분 응답·실패를 실행하고 보이는 피드백과 포커스를 빼앗지 않는 적절한 상태 알림을 확인하세요.', '遅延、空、部分、失敗を実行し、見える応答とフォーカスを奪わない適切な状態通知を確認します。') }],
    examples: [
      { surface: 'search', before: L('No matches and network failure show the same empty illustration.', '검색 없음과 네트워크 실패가 같은 빈 그림입니다.', '該当なしと通信失敗が同じ空の絵です。'), after: L('Filter reset and retry are offered for the correct causes.', '원인에 맞게 필터 초기화와 재시도를 제공합니다.', '原因に応じ絞り込み解除と再試行を提供します。') },
      { surface: 'developer-console', before: L('Old data looks live during a disconnected state.', '연결이 끊겨도 이전 데이터가 실시간처럼 보입니다.', '切断中も古いデータが最新に見えます。'), after: L('Data freshness and reconnecting state remain explicit.', '데이터 시점과 재연결 상태를 명시합니다.', 'データ時点と再接続状態を明示します。') },
    ],
  },
  {
    id: 'error-recovery', category: 'feedback', name: L('Prevent mistakes and support recovery', '실수 예방과 복구', '誤りの予防と回復'),
    principle: L('Errors should retain useful work, explain the cause and provide a reachable recovery path.', '오류는 유용한 작업을 보존하고 원인을 설명하며 실행 가능한 복구 경로를 제공해야 합니다.', 'エラーでも有用な作業を保ち、原因を説明し到達可能な回復経路を提供します。'),
    concerns: ['resilience', 'accessibility', 'readability'], surfaces: ['form', 'checkout', 'settings', 'chat', 'developer-console'], relatedPrincipleIds: ['recoverable-actions', 'complete-state-model'], sourceIds: ['validation', 'heuristics'],
    observe: [L('Follow invalid input, failed submission, cancel and retry; note whether the original data or consequences become unclear.', '잘못된 입력·제출 실패·취소·재시도를 따라가며 원본 데이터나 결과가 불명확해지는지 보세요.', '無効入力、送信失敗、取消、再試行を追い、元データや結果が不明になるか確認します。')],
    decisions: [
      { when: L('A failed form clears input or leaves errors far from their fields.', '폼 실패가 입력을 지우거나 오류를 필드에서 멀리 둡니다.', 'フォーム失敗で入力を消すか、エラーが欄から離れています。'), change: L('Retain answers, associate field errors, and provide a summary/navigation when needed.', '답을 유지하고 필드 오류를 연결하며 필요할 때 요약·이동 수단을 제공하세요.', '回答を保ち欄エラーを関連付け、必要に応じ概要や移動手段を提供します。'), instead: L('Do not blame invalid input for a service outage, permission failure or unknown submission result.', '서비스 장애·권한 문제·불명확한 제출 결과를 잘못된 입력 탓으로 돌리지 마세요.', '障害、権限、送信結果不明を入力ミスのせいにしません。') },
      { when: L('A costly action is easy to trigger and hard to reverse.', '결과가 큰 행동을 쉽게 실행하고 되돌리기는 어렵습니다.', '重大な操作を簡単に実行でき、戻すのは困難です。'), change: L('Expose consequences and scope; use undo when real, or a proportionate confirmation before commitment.', '결과와 범위를 드러내고 실제 가능한 되돌리기나 실행 전 적절한 확인을 제공하세요.', '結果と範囲を示し、実際に可能な取消か実行前の相応な確認を提供します。'), instead: L('Do not add confirmations to every harmless action or blindly retry an uncertain transaction.', '무해한 모든 행동에 확인을 추가하거나 결과가 불명확한 거래를 무조건 재시도하지 마세요.', '無害な全操作に確認を追加したり、結果不明な取引を盲目的に再試行しません。') },
    ],
    preserve: L('Retain input, user control and honest distinctions between failed, pending and completed work.', '입력·사용자 통제·실패와 대기와 완료의 정확한 구별을 보존하세요.', '入力、利用者の制御、失敗と保留と完了の正確な区別を保ちます。'),
    compare: [{ evidence: 'interaction', test: L('Use controlled failures to verify correction, retry, cancel and recovery without duplicate actions or data loss.', '통제된 실패로 수정·재시도·취소·복구를 검사하고 중복 실행이나 데이터 손실이 없는지 확인하세요.', '制御した失敗で修正、再試行、取消、回復を検査し、重複操作やデータ消失がないか確認します。') }],
    examples: [
      { surface: 'form', before: L('One invalid value clears all completed fields.', '값 하나가 틀리면 완료한 모든 입력이 지워집니다.', '一つの無効値で記入済みの全欄が消えます。'), after: L('Existing answers remain and correction focuses on the invalid field.', '답을 남기고 잘못된 필드 수정에 집중시킵니다.', '回答を残し無効欄の訂正に集中させます。') },
      { surface: 'checkout', before: L('A timeout invites another payment without confirming the first.', '시간 초과 후 첫 결제를 확인하지 않고 다시 결제하게 합니다.', '時間切れ後に初回支払いを確認せず再決済を促します。'), after: L('Pending status is resolved before a safe next action is offered.', '대기 상태를 확인한 뒤 안전한 다음 행동을 제공합니다.', '保留状態を確認してから安全な次の操作を提供します。') },
    ],
  },
  {
    id: 'purposeful-motion', category: 'feedback', name: L('Motion communicates change', '변화를 설명하는 움직임', '変化を伝える動き'),
    principle: L('Motion should clarify cause, continuity or feedback while respecting attention and motion preferences.', '움직임은 주의와 모션 선호를 존중하며 원인·연속성·피드백을 설명해야 합니다.', '動きは注意と動作の好みを尊重し、原因、連続性、応答を説明します。'),
    concerns: ['focus', 'accessibility', 'restraint', 'resilience'], surfaces: ['global'], relatedPrincipleIds: ['motion-and-preference'], sourceIds: ['motion-purpose', 'interaction-motion'],
    observe: [L('Name what each transition explains; look for blocking delays, competing loops and loss of object position.', '각 전환이 설명하는 것을 적고 막는 지연·경쟁하는 반복 움직임·대상 위치 손실을 찾으세요.', '各遷移が説明するものを記し、阻害する遅延、競うループ、対象位置の喪失を探します。')],
    decisions: [
      { when: L('Movement repeats without conveying useful state.', '유용한 상태 전달 없이 움직임이 반복됩니다.', '有用な状態を伝えず動きが反復します。'), change: L('Remove or reduce the loop and keep an explicit static status cue.', '반복을 제거·줄이고 명시적인 정적 상태 단서를 남기세요.', 'ループを除去または削減し、明示的な静的状態手掛かりを残します。'), instead: L('Do not remove essential feedback when reducing motion.', '움직임을 줄이면서 필수 피드백까지 없애지 마세요.', '動きを減らす際に必須の応答まで除きません。') },
      { when: L('Reordering or navigation makes objects appear unrelated.', '재정렬이나 이동으로 대상의 연속성이 끊깁니다.', '並べ替えや移動で対象の連続性が切れます。'), change: L('Use a restrained transition or persistent anchor; provide a reduced-motion equivalent.', '절제된 전환이나 지속되는 기준점을 쓰고 모션 감소 대안을 제공하세요.', '控えめな遷移か持続する基準点を使い、動作軽減の代替を提供します。'), instead: L('Do not impose a universal duration or require animation before input can continue.', '보편적인 지속 시간을 강제하거나 애니메이션 종료 전 입력을 막지 마세요.', '万能な継続時間を強制したりアニメ終了まで入力を止めません。') },
    ],
    preserve: L('Keep state meaning, focus and immediate task control in reduced-motion mode.', '모션 감소 모드에서도 상태 의미·포커스·즉시 조작을 유지하세요.', '動作軽減でも状態の意味、フォーカス、即時の操作を保ちます。'),
    compare: [{ evidence: 'interaction', test: L('Compare the same transition with normal and reduced motion, keyboard interruption and slow rendering; distinguish the AAA interaction-animation criterion from automatic-motion rules.', '일반·모션 감소·키보드 중단·느린 렌더링에서 같은 전환을 비교하고 AAA 상호작용 애니메이션 기준과 자동 움직임 기준을 구별하세요.', '通常、動作軽減、キー中断、低速描画で同じ遷移を比べ、AAA操作起因アニメ基準と自動動作の基準を区別します。') }],
    examples: [
      { surface: 'onboarding', before: L('A decorative reveal delays access to the next step.', '장식 등장 효과가 다음 단계 접근을 늦춥니다.', '装飾的な出現効果が次への操作を遅らせます。'), after: L('Content is operable immediately with an optional subtle transition.', '내용을 즉시 조작하게 하고 선택적 짧은 전환을 둡니다.', '内容をすぐ操作可能にし任意の控えめな遷移を添えます。') },
      { surface: 'data-table', before: L('Live row sorting loses the item being inspected.', '실시간 행 정렬로 보던 항목을 잃습니다.', 'ライブ行並べ替えで見ていた項目を失います。'), after: L('Stable identity and a position cue retain the inspected context.', '안정적인 식별 정보와 위치 단서로 맥락을 유지합니다.', '安定した識別と位置の手掛かりで文脈を保ちます。') },
    ],
  },
  {
    id: 'imagery-purpose', category: 'composition', name: L('Imagery, cropping and content purpose', '이미지의 역할·잘라내기·내용', '画像の役割、切抜き、内容'),
    principle: L('Choose imagery and framing from their informational, functional or expressive role and retain that role across sizes.', '정보·기능·표현 역할에 맞춰 이미지와 프레임을 정하고 크기가 달라져도 그 역할을 보존합니다.', '情報、機能、表現の役割から画像と枠を決め、サイズが変わっても役割を保ちます。'),
    concerns: ['balance', 'responsiveness', 'resilience', 'accessibility'], surfaces: ['landing-page', 'content', 'checkout', 'onboarding'], relatedPrincipleIds: ['resilient-imagery', 'opening-earns-its-frame'], sourceIds: ['image-purpose', 'grid'],
    observe: [L('Identify the focal subject and purpose; test alternate aspect ratios, missing media and nearby text.', '주요 피사체와 목적을 정하고 다른 가로세로비·미디어 누락·주변 글을 확인하세요.', '中心の被写体と目的を定め、別の縦横比、媒体欠落、周囲の文字を確認します。')],
    decisions: [
      { when: L('Cropping removes the meaningful subject or obscures text.', '잘라내기가 의미 있는 피사체를 지우거나 글을 가립니다.', '切抜きが意味ある被写体を消すか文字を隠します。'), change: L('Adjust focal position, aspect ratio or art direction; place important text on a stable readable surface.', '초점 위치·가로세로비·이미지 선택을 조정하고 중요한 글은 안정적으로 읽는 표면에 두세요.', '焦点位置、縦横比、画像選択を調整し重要な文字を安定した読める面へ置きます。'), instead: L('Avoid universal object-fit rules; diagrams and product evidence may need the whole image.', '모든 이미지에 같은 맞춤 규칙을 쓰지 마세요. 도표나 제품 근거는 전체가 필요할 수 있습니다.', '全画像に一律のフィット規則を使いません。図や製品の根拠には全体が必要な場合があります。') },
      { when: L('An image occupies space without a clear role.', '이미지가 뚜렷한 역할 없이 공간을 차지합니다.', '画像が明確な役割なく空間を占めています。'), change: L('Use relevant media, reduce its prominence or remove it; write the alternative according to purpose.', '관련 미디어로 바꾸거나 강조를 줄이거나 제거하고 역할에 맞는 대체 설명을 쓰세요.', '関連媒体へ変更、強調を削減、または除去し、目的に合う代替説明を書きます。'), instead: L('Decorative and atmospheric imagery can be legitimate; do not require every image to be a literal product screenshot.', '장식·분위기 이미지도 타당할 수 있습니다. 모든 이미지를 제품 스크린샷으로 만들지 마세요.', '装飾や雰囲気の画像にも妥当性があり、全画像を製品画面にする必要はありません。') },
    ],
    preserve: L('Keep asset rights, brand intent, subject meaning and accessible alternatives.', '자산 권리·브랜드 의도·피사체 의미·접근 가능한 대안을 보존하세요.', '資産の権利、ブランド意図、被写体の意味、アクセス可能な代替を保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare the same media at narrow/wide sizes and with loading failure; inspect focal content and text contrast, then check alternative semantics.', '같은 미디어를 좁고 넓은 크기·로드 실패에서 비교하고 주요 내용과 글 대비, 대체 의미를 확인하세요.', '同じ媒体を狭い広いサイズと読込失敗で比べ、中心内容、文字対比、代替の意味を確認します。') }],
    examples: [
      { surface: 'checkout', before: L('A product crop hides the distinguishing variant.', '제품 잘라내기가 구별되는 옵션을 숨깁니다.', '製品の切抜きが識別仕様を隠します。'), after: L('The chosen variant remains identifiable at each size.', '모든 크기에서 선택한 옵션을 식별하게 합니다.', '各サイズで選択仕様を識別できるようにします。') },
      { surface: 'content', before: L('A chart uses the same cover crop as a decorative photograph.', '차트를 장식 사진처럼 잘라 채웁니다.', '図表を装飾写真と同様に切り抜きます。'), after: L('The full chart and an accessible explanation remain available.', '전체 차트와 접근 가능한 설명을 유지합니다.', '図表全体とアクセス可能な説明を保ちます。') },
    ],
  },
  {
    id: 'comparative-iteration', category: 'evaluation', name: L('Improve through comparable evidence', '비교 가능한 근거로 개선하기', '比較できる根拠で改善する'),
    principle: L('A visual preference is a hypothesis; improvement needs a stated goal, matched observations and preserved functionality.', '시각적 선호는 가설입니다. 개선에는 명시한 목표·조건을 맞춘 관찰·기능 보존이 필요합니다.', '視覚的な好みは仮説です。改善には明示した目標、条件を揃えた観察、機能の保持が必要です。'),
    concerns: ['resilience', 'consistency'], surfaces: ['global'], relatedPrincipleIds: ['fidelity-follows-certainty'], sourceIds: ['user-testing'],
    observe: [L('Record the task, suspected obstacle, baseline state, data and uncertainty before choosing a change. Name the baseline strengths that must survive and the concrete gain expected from each edit. Include keeping the original as an alternative.', '변경을 고르기 전에 과업·의심 문제·기준 상태·데이터·불확실성을 기록하세요. 유지해야 할 원본의 장점과 각 수정으로 얻을 구체적 이득을 적고 원본 유지도 대안에 포함하세요.', '変更前に課題、疑う障害、基準状態、データ、不確実性を記録します。守るべき原本の長所と各編集の具体的な利点を挙げ、原本維持も選択肢に含めます。')],
    decisions: [
      { when: L('The cause of awkwardness is uncertain.', '어색함의 원인이 불확실합니다.', '違和感の原因が不確かです。'), change: L('Change one coherent relationship and compare a small reversible alternative before widening scope.', '하나의 일관된 관계를 고치고 작은 되돌릴 수 있는 대안을 비교한 뒤 범위를 넓히세요.', '一つの一貫した関係を直し、小さな戻せる代案を比較してから範囲を広げます。'), instead: L('Do not replace the whole visual identity merely to create an obvious difference.', '눈에 띄는 차이를 만들려고 시각 정체성 전체를 바꾸지 마세요.', '目立つ差を作るためだけに視覚的な個性全体を変えません。') },
      { when: L('The revised screenshot looks cleaner but evidence is incomplete.', '수정 스크린샷은 깔끔하지만 근거가 부족합니다.', '修正画像は整っていますが根拠が不十分です。'), change: L('Repeat the real task and edge states; retain, revise or revert based on observed effects.', '실제 과업과 경계 상태를 반복하고 관찰된 효과에 따라 유지·재수정·복구하세요.', '実課題と境界状態を繰り返し、観察結果で維持、再修正、復元を選びます。'), instead: L('Do not claim measured user improvement, a design score or conformance without the corresponding evidence.', '해당 근거 없이 사용자 개선 측정값·디자인 점수·표준 준수를 주장하지 마세요.', '対応する根拠なしに利用改善の測定値、デザイン点数、規格適合を主張しません。') },
    ],
    preserve: L('Keep baseline artifacts, content, actions and a reversible path. Compare gains against losses in grouping, useful visible information, continuity and reading comfort. If a user identifies a regression, reopen the prior improvement claim and correct the report; keep justified gains and revert harmful or unproven edits. Passing tests does not override that feedback, and this does not require asking for approval after every edit.', '기준 산출물·내용·행동·복구 경로를 보존하세요. 이득과 함께 그룹 구분·실제로 보이는 정보·연속성·읽기 편안함의 손실을 비교하세요. 사용자가 퇴행을 지적하면 이전 개선 판정을 다시 열고 보고를 정정하세요. 근거 있는 이득은 남기고 해롭거나 이득이 불분명한 수정은 되돌리세요. 테스트 통과로 피드백을 덮지 말고, 매 수정마다 승인을 묻는 절차로 바꾸지도 마세요.', '基準成果物、内容、操作、復元経路を保ちます。利点と共にグループ識別、見える情報、連続性、読み心地の損失を比較します。退行の指摘があれば以前の改善判定を再検討し報告を訂正し、根拠ある利点を残して有害・効果不明な変更を戻します。テスト成功で意見を上書きせず、毎回の承認手順にも変えません。'),
    compare: [{ evidence: 'user-task', test: L('Repeat the same task with matched conditions; distinguish expert inspection, functional checks and actual participant observations in the report.', '같은 조건에서 같은 과업을 반복하고 보고에서 전문가 관찰·기능 검사·실제 참여자 관찰을 구별하세요.', '同じ条件で同じ課題を繰り返し、報告では専門家観察、機能検査、実参加者観察を区別します。') }],
    examples: [
      { surface: 'form', before: L('A shorter form is judged better after required fields disappear.', '필수 필드가 사라진 짧은 폼을 더 낫다고 판단합니다.', '必須欄を失った短いフォームを良いと判断します。'), after: L('Completion and validation still work before the cleaner layout is accepted.', '깔끔한 배치를 채택하기 전에 완료·검증 동작을 확인합니다.', '整った配置を採用する前に完了と検証の動作を確認します。') },
      { surface: 'landing-page', before: L('Before and after use different copy, viewport and imagery.', '전후의 문구·화면 폭·이미지가 다릅니다.', '前後で文章、画面幅、画像が異なります。'), after: L('A matched comparison isolates the intended change.', '조건을 맞춰 의도한 변경을 비교합니다.', '条件を揃え意図した変更を比較します。') },
    ],
  },
];
