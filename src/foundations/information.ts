import { L, type DesignFoundation } from './types.js';

export const INFORMATION_FOUNDATIONS: DesignFoundation[] = [
  {
    id: 'scannable-content', category: 'information', name: L('Scanning and reading serve different tasks', '훑어보기와 읽기의 역할', '一覧と精読の役割'),
    principle: L('An overview should expose distinctions needed to choose; detail should retain the information needed to understand.', '개요는 선택에 필요한 차이를 드러내고 상세는 이해에 필요한 정보를 보존해야 합니다.', '概要は選択に必要な違いを示し、詳細は理解に必要な情報を保ちます。'),
    concerns: ['scanability', 'readability', 'focus'], surfaces: ['search', 'data-table', 'content', 'chat', 'developer-console'], relatedPrincipleIds: ['core-task-first', 'attention-budget'], sourceIds: ['information-scent', 'recognition'],
    observe: [L('Identify the attributes that distinguish items; check repeated prefixes, raw prose, ambiguous truncation and remote status labels.', '항목을 구별하는 속성을 정하고 반복 접두어·원문 문장·모호한 말줄임·멀리 있는 상태를 확인하세요.', '項目を区別する属性を定め、反復接頭語、原文の長文、曖昧な省略、離れた状態を確認します。')],
    decisions: [
      { when: L('Rows require reading paragraphs just to identify the item.', '항목 식별만 하려 해도 문단을 읽어야 합니다.', '項目識別だけで段落を読む必要があります。'), change: L('Expose a faithful concise name, discriminating attributes and current state in stable positions.', '충실하고 간결한 이름·구별 속성·현재 상태를 일정한 위치에 드러내세요.', '忠実で簡潔な名前、識別属性、現在の状態を一定位置に示します。'), instead: L('Do not invent summaries or remove the original; some legal or quoted text must remain exact.', '요약을 지어내거나 원문을 제거하지 마세요. 인용 등 정확한 문구 보존이 필요한 내용이 있습니다.', '要約を捏造したり原文を除きません。引用など正確な文言が必要な内容もあります。') },
      { when: L('Clamping hides the only distinguishing words.', '줄 수 제한이 유일한 구별 단어를 숨깁니다.', '行数制限が唯一の識別語を隠します。'), change: L('Preserve the distinctive portion, permit useful wrapping and provide an accessible full-text route.', '구별되는 부분을 보존하고 필요한 줄바꿈과 전체 글 접근 경로를 제공하세요.', '識別部分を保ち、必要な折返しと全文へのアクセスを提供します。'), instead: L('A hover-only tooltip does not solve touch or keyboard access.', '호버 전용 툴팁만으로 터치·키보드 접근이 해결되지 않습니다.', 'ホバー限定のツールチップだけではタッチやキーボードで解決しません。') },
    ],
    preserve: L('Keep exact identity, full content and meaningful differences between similar records.', '정확한 식별 정보·전체 내용·비슷한 기록 사이의 의미 있는 차이를 보존하세요.', '正確な識別情報、全文、類似記録間の意味ある違いを保ちます。'),
    compare: [{ evidence: 'user-task', test: L('Find the same item among similar distractors before/after, including long titles; separately verify full content remains reachable.', '긴 제목을 포함한 비슷한 항목 사이에서 같은 대상을 전후로 찾아보고 전체 내용 접근도 별도로 확인하세요.', '長い題名を含む類似項目の中で同じ対象を前後で探し、全文への到達性も別途確認します。') }],
    examples: [
      { surface: 'search', before: L('Results repeat the same opening words and truncate the product variant.', '검색 결과가 같은 앞말을 반복하고 제품 옵션을 자릅니다.', '検索結果が同じ冒頭を繰り返し製品仕様を省略します。'), after: L('Variant and relevant distinguishing attributes remain visible.', '옵션과 관련 구별 속성을 보이게 유지합니다.', '仕様と関連する識別属性を見えるよう保ちます。') },
      { surface: 'chat', before: L('A conversation list exposes full requests but hides current status.', '대화 목록은 긴 요청을 보여주고 현재 상태를 묻습니다.', '会話一覧は長い依頼を見せ現在の状態を埋もれさせます。'), after: L('Concise identity and status lead; the full conversation remains intact.', '간결한 식별 정보와 상태를 앞세우고 전체 대화는 유지합니다.', '簡潔な識別情報と状態を優先し全文は保ちます。') },
    ],
  },
  {
    id: 'navigation-scent', category: 'information', name: L('Wayfinding and predictable destinations', '현재 위치와 예측 가능한 목적지', '現在地と予測できる移動先'),
    principle: L('Navigation should reveal where the user is, what will change and how to return.', '내비게이션은 현재 위치·바뀌는 범위·돌아오는 방법을 보여줘야 합니다.', 'ナビゲーションは現在地、変化する範囲、戻る方法を示します。'),
    concerns: ['scanability', 'consistency', 'resilience'], surfaces: ['navigation', 'search', 'settings', 'content', 'developer-console'], relatedPrincipleIds: ['navigation-preserves-context'], sourceIds: ['information-scent', 'recognition'],
    observe: [L('Distinguish global destinations, local views, filters and actions; inspect current selection and retained context.', '전역 목적지·지역 보기·필터·행동을 구별하고 현재 선택과 맥락 보존을 확인하세요.', '全体の移動先、局所表示、絞り込み、操作を区別し、現在の選択と文脈保持を確認します。')],
    decisions: [
      { when: L('Similar controls produce different navigation scopes.', '비슷한 컨트롤이 다른 범위의 이동을 만듭니다.', '似た操作部が異なる範囲の移動を起こします。'), change: L('Position and label controls by what they affect; show the current location at its proper level.', '영향 범위에 맞게 컨트롤을 배치·명명하고 해당 단계의 현재 위치를 표시하세요.', '影響範囲に合わせて配置と名前を決め、適切な階層に現在地を示します。'), instead: L('Do not add breadcrumbs or another navigation rail when a simple local label is enough.', '간단한 지역 라벨로 충분한 곳에 경로나 탐색 열을 더하지 마세요.', '簡単な局所ラベルで足りる場所にパンくずや追加ナビを増やしません。') },
      { when: L('Returning loses filters, selection or the previous item.', '돌아오면 필터·선택·이전 항목을 잃습니다.', '戻ると絞り込み、選択、以前の項目を失います。'), change: L('Preserve relevant route/query and view state, including focus and a stable return point.', '관련 경로·쿼리·보기 상태와 포커스·안정적인 복귀 위치를 보존하세요.', '関連経路、クエリ、表示状態、フォーカス、安定した復帰点を保ちます。'), instead: L('Do not restore stale permissions or apply prior destructive actions automatically.', '오래된 권한을 복원하거나 이전의 파괴적 행동을 자동 실행하지 마세요.', '古い権限を復元したり以前の破壊的操作を自動実行しません。') },
    ],
    preserve: L('Keep existing destinations, deep links and browser-history behavior.', '기존 목적지·딥링크·브라우저 기록 동작을 보존하세요.', '既存の移動先、深いリンク、ブラウザー履歴の動作を保ちます。'),
    compare: [{ evidence: 'interaction', test: L('Run open-detail, back, refresh and direct-link paths with the same filters and selection; inspect focus after return.', '같은 필터·선택으로 상세 열기·뒤로·새로고침·직접 링크를 실행하고 복귀 포커스를 확인하세요.', '同じ絞り込みと選択で詳細、戻る、再読込、直接リンクを実行し、復帰フォーカスを確認します。') }],
    examples: [
      { surface: 'search', before: L('Opening a result loses the query on return.', '검색 결과를 열고 돌아오면 검색어를 잃습니다.', '結果を開き戻ると検索語を失います。'), after: L('Query, filters and the return item remain available.', '검색어·필터·복귀 항목을 보존합니다.', '検索語、絞り込み、復帰項目を保ちます。') },
      { surface: 'settings', before: L('A local tab is indistinguishable from a global destination.', '지역 탭이 전역 목적지와 구별되지 않습니다.', '局所タブと全体の移動先が区別できません。'), after: L('View switching sits near the content it changes.', '바뀌는 내용 가까이에 보기 전환을 둡니다.', '変化する内容の近くに表示切替を置きます。') },
    ],
  },
  {
    id: 'labels-instructions', category: 'information', name: L('Labels, instructions and semantic structure', '라벨·안내·의미 구조', 'ラベル、説明、意味構造'),
    principle: L('People should understand the object, required input and action consequence without decoding implementation terms.', '사람이 구현 용어를 해독하지 않고 대상·필요 입력·행동 결과를 이해할 수 있어야 합니다.', '実装用語を解読せず対象、必要入力、操作結果を理解できるようにします。'),
    concerns: ['readability', 'accessibility', 'resilience'], surfaces: ['form', 'checkout', 'settings', 'onboarding', 'search', 'chat'], relatedPrincipleIds: ['explicit-labels-and-semantics'], sourceIds: ['labels', 'heuristics'],
    observe: [L('Read visible labels without component names; check units, optionality, help placement and accessible names.', '컴포넌트 이름을 모르는 상태로 라벨을 읽고 단위·선택 여부·도움말 위치·접근 가능한 이름을 확인하세요.', '部品名を知らずにラベルを読み、単位、任意性、説明位置、アクセシブルな名前を確認します。')],
    decisions: [
      { when: L('A placeholder is the only visible field identification.', '플레이스홀더만 입력란을 식별합니다.', 'プレースホルダーだけで入力欄を識別します。'), change: L('Provide a persistent label and associated instructions near the field.', '지속되는 라벨과 연결된 안내를 필드 가까이에 제공하세요.', '持続するラベルと関連する説明を入力欄の近くに提供します。'), instead: L('A visibly obvious compact search may use an accessible name without another redundant label; verify the context.', '명백한 소형 검색은 중복 라벨 대신 접근 가능한 이름을 쓸 수 있으므로 맥락을 확인하세요.', '明白な小型検索では重複ラベルに代えアクセシブルな名前を使えるため文脈を確認します。') },
      { when: L('An action label conceals what will happen.', '행동 라벨이 실제 결과를 숨깁니다.', '操作名が実際の結果を隠しています。'), change: L('Use a specific action and object; place material consequences before activation.', '구체적인 행동과 대상을 쓰고 중요한 결과를 실행 전에 배치하세요.', '具体的な動作と対象を使い、重要な結果を実行前に示します。'), instead: L('Do not invent promises, certainty or workflow steps unsupported by the product.', '제품이 지원하지 않는 약속·확신·단계를 지어내지 마세요.', '製品が支えない約束、確実さ、手順を捏造しません。') },
    ],
    preserve: L('Keep terminology users rely on, input associations and truthful action semantics. Add visible labels only when they resolve ambiguity: when a two-party conversation already distinguishes the user and groups continuing replies, repeating the agent name adds interruption without identification value. Retain accessible speaker semantics; show identity when participants or origins actually need disambiguation.', '사용자가 의존하는 용어·입력 연결·정확한 행동 의미를 보존하세요. 보이는 라벨은 모호함을 해소할 때 더하세요. 두 참여자의 대화에서 사용자 말과 이어지는 응답이 이미 구별되면 매 응답에 Agent를 반복해도 식별 정보는 늘지 않고 흐름만 끊습니다. 보조 기술의 발화자 의미는 유지하고 참여자나 출처 구분이 실제로 필요할 때 표시하세요.', '利用者が頼る用語、入力の関連、正確な操作意味を保ちます。見えるラベルは曖昧さを解く場合に加えます。二者会話で利用者発言と連続応答が既に区別されるなら、各応答のAgent表示は情報を増やさず流れを切ります。支援技術の話者情報を保ち、参加者や出所の識別が必要な場合に表示します。'),
    compare: [{ evidence: 'interaction', test: L('Use labels to complete the same task with keyboard and assistive semantics; verify entered text does not erase context.', '라벨을 통해 같은 과업을 키보드와 보조 기술 의미로 수행하고 입력 후에도 맥락이 남는지 확인하세요.', 'ラベルを使い同じ課題をキーボードと支援技術の意味で実行し、入力後も文脈が残るか確認します。') }],
    examples: [
      { surface: 'checkout', before: L('Continue actually submits a payment.', '계속 버튼이 실제로 결제를 제출합니다.', '続行ボタンが実際には支払いを送信します。'), after: L('The label states payment and its amount/context is visible.', '결제 행동을 명시하고 금액·맥락을 표시합니다.', '支払操作を明示し金額と文脈を表示します。') },
      { surface: 'form', before: L('Units disappear when the placeholder is replaced.', '입력하면 플레이스홀더의 단위가 사라집니다.', '入力するとプレースホルダーの単位が消えます。'), after: L('Persistent unit and label remain associated with the value.', '지속되는 단위·라벨을 값에 연결합니다.', '持続する単位とラベルを値に関連付けます。') },
    ],
  },
  {
    id: 'truthful-evidence', category: 'information', name: L('Prominence matches meaning and evidence', '의미와 근거에 맞는 강조', '意味と根拠に合う強調'),
    principle: L('Give space to concrete, supported information that helps a decision; do not decorate uncertainty into certainty.', '판단에 도움이 되는 구체적이고 근거 있는 정보에 공간을 주고 불확실성을 장식으로 확신처럼 만들지 않습니다.', '判断に役立つ具体的で根拠ある情報へ空間を与え、不確実性を装飾で確実に見せません。'),
    concerns: ['focus', 'readability', 'restraint'], surfaces: ['landing-page', 'content', 'checkout', 'chat', 'onboarding'], relatedPrincipleIds: ['evidence-near-claim', 'opening-earns-its-frame'], sourceIds: ['heuristics', 'information-scent'],
    observe: [L('For each prominent claim, identify its meaning, source, limitations and relation to the user’s decision.', '눈에 띄는 주장마다 의미·출처·한계·사용자 결정과의 관련성을 확인하세요.', '目立つ主張ごとに意味、出所、限界、利用者の判断との関係を確認します。')],
    decisions: [
      { when: L('A generic slogan occupies space needed for concrete information.', '일반적인 슬로건이 구체 정보에 필요한 공간을 차지합니다.', '一般的な標語が具体情報に必要な空間を占めます。'), change: L('Use verified product facts or an actual demonstration; retain the proposition and necessary explanation.', '확인된 제품 사실이나 실제 시연을 쓰고 제안과 필요한 설명을 유지하세요.', '確認した製品事実や実演を使い、提案と必要な説明を保ちます。'), instead: L('Expressive branding can have a purpose; do not ban heroes, photographs, centered text or cards by appearance alone.', '표현적 브랜딩에도 목적이 있습니다. 외형만으로 히어로·사진·중앙 글·카드를 금지하지 마세요.', '表現的なブランドにも目的があります。外観だけでヒーロー、写真、中央文字、カードを禁止しません。') },
      { when: L('A number or claim appears more certain than its support.', '숫자나 주장이 근거보다 확실해 보입니다.', '数値や主張が根拠以上に確実に見えます。'), change: L('Place relevant qualifications and evidence near it, or remove the unsupported assertion.', '관련 조건과 근거를 곁에 두거나 뒷받침되지 않는 주장을 제거하세요.', '関連条件と根拠を近くに置くか、裏付けのない主張を取り除きます。'), instead: L('Do not fabricate testimonials, measurements or results to complete a layout.', '배치를 채우려 추천사·측정값·결과를 지어내지 마세요.', '配置を埋めるため推薦文、測定値、結果を捏造しません。') },
    ],
    preserve: L('Keep material limitations, price, consent, provenance and the original factual meaning.', '중요한 한계·가격·동의·출처와 원래의 사실 의미를 보존하세요.', '重要な限界、価格、同意、出所、元の事実の意味を保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare visible statements and their prominence against the same evidence inventory; check that shortening has not changed certainty or omitted consequences.', '같은 근거 목록에 비추어 문장과 강조를 전후 비교하고 축약이 확실성을 바꾸거나 결과를 누락하지 않았는지 확인하세요.', '同じ根拠一覧に照らし文と強調を前後比較し、短縮が確実性を変えたり結果を省いたりしていないか確認します。') }],
    examples: [
      { surface: 'landing-page', before: L('Unsupported growth metrics dominate the opening.', '근거 없는 성장 수치가 첫 화면을 지배합니다.', '裏付けのない成長数値が最初の画面を支配します。'), after: L('A verified capability and a usable demonstration take their place.', '확인된 기능과 사용할 수 있는 시연으로 바꿉니다.', '確認済みの機能と使える実演へ置き換えます。') },
      { surface: 'chat', before: L('A partial check is styled as complete success.', '부분 점검을 완전한 성공처럼 표시합니다.', '部分検査を完全な成功に見せています。'), after: L('Confirmed results and unverified areas are distinguishable.', '확인된 결과와 미검증 영역을 구별합니다.', '確認済み結果と未検証領域を区別します。') },
    ],
  },
];
