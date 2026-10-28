import { L, type DesignFoundation } from './types.js';

export const PERCEPTION_FOUNDATIONS: DesignFoundation[] = [
  {
    id: 'priority-hierarchy', category: 'perception',
    name: L('Attention follows task priority', '과업의 중요도와 시선 순서', '課題の重要度と視線の順序'),
    principle: L('Allocate visual emphasis to the next meaningful decision, then to supporting context.', '다음 중요한 판단에 시각적 강조를 배분하고 그 뒤에 보조 맥락을 둡니다.', '次の重要な判断に視覚的な強調を配分し、その後に補助的な文脈を置きます。'),
    concerns: ['focus', 'scanability', 'restraint'], surfaces: ['global'],
    relatedPrincipleIds: ['attention-budget', 'contrast-before-scale', 'core-task-first'], sourceIds: ['visual-hierarchy', 'heuristics'],
    observe: [L('Identify what the user needs next; compare its prominence with logos, metrics, navigation and secondary actions.', '사용자에게 다음으로 필요한 것을 정하고 로고·수치·내비게이션·보조 행동과 강조 정도를 비교하세요.', '次に必要なものを特定し、ロゴ、数値、ナビゲーション、補助操作との強調度を比べます。')],
    decisions: [
      { when: L('Several unrelated elements compete equally.', '무관한 여러 요소가 비슷하게 강합니다.', '無関係な複数の要素が同じ強さで競います。'), change: L('Choose the task anchor; lower competing fill, weight or ornament before enlarging everything.', '과업의 중심을 정하고 경쟁 요소의 채움·굵기·장식을 낮춘 뒤 필요한 크기 차이를 만드세요.', '課題の中心を決め、競う塗り、太さ、装飾を弱めてから必要なサイズ差を付けます。'), instead: L('Parallel comparison may need equal emphasis; do not invent a single winner.', '병렬 비교에는 동등한 강조가 필요할 수 있으므로 임의의 1순위를 만들지 마세요.', '並列比較には同等の強調が必要な場合があり、勝手に一つを優先しません。') },
      { when: L('Urgency or consequences are visually subordinate.', '긴급성이나 행동의 결과가 시각적으로 묻힙니다.', '緊急性や操作の結果が埋もれています。'), change: L('Move the state and consequence near its object and action, with a distinct readable treatment.', '상태와 결과를 해당 대상·행동 가까이 옮기고 읽기 쉬운 구별을 주세요.', '状態と結果を対象や操作の近くへ移し、読みやすく区別します。'), instead: L('Use actual severity; do not manufacture alerts to attract attention.', '실제 심각도를 쓰고 주목을 끌려고 경고를 만들지 마세요.', '実際の深刻度を使い、注意を引くための警告を作りません。') },
    ],
    preserve: L('Keep secondary information legible and all meaningful choices reachable.', '보조 정보의 가독성과 의미 있는 모든 선택의 접근성을 유지하세요.', '補助情報の読みやすさと意味ある選択への到達性を保ちます。'),
    compare: [{ evidence: 'rendered', test: L('At identical content and size, compare which elements dominate before reading their words; record the intended order.', '같은 내용·크기에서 글을 읽기 전 눈에 띄는 요소를 전후 비교하고 의도한 순서를 기록하세요.', '同じ内容とサイズで、文字を読む前に目立つ要素を前後比較し、意図した順序を記録します。') }, { evidence: 'user-task', test: L('Observe whether a person identifies the next task; an agent’s salience judgement alone does not prove faster use.', '사람이 다음 과업을 알아보는지 관찰하세요. AI의 강조 판단만으로 사용 속도 향상을 확정하지 마세요.', '人が次の課題を見つけるか観察します。AIの目立ち方の判断だけで速度向上を断定しません。') }],
    examples: [
      { surface: 'checkout', before: L('Coupon promotion dominates the total.', '쿠폰 홍보가 총액보다 강합니다.', 'クーポン宣伝が合計より目立ちます。'), after: L('Total and payment consequence lead; the coupon stays available.', '총액과 결제 결과를 우선하고 쿠폰 사용은 유지합니다.', '合計と支払いの結果を優先し、クーポンは利用可能に保ちます。') },
      { surface: 'developer-console', before: L('Healthy summaries outweigh a blocked job.', '정상 요약들이 막힌 작업보다 강합니다.', '正常な概要が停止中の作業より強調されています。'), after: L('The blocked job and recovery action become the anchor.', '막힌 작업과 복구 행동을 중심으로 둡니다.', '停止中の作業と回復操作を中心に置きます。') },
    ],
  },
  {
    id: 'relational-grouping', category: 'perception', name: L('Space expresses relationships', '관계를 표현하는 간격', '関係を示す間隔'),
    principle: L('Spacing differentiates belonging, separation and sequence; equal margins do not necessarily create clarity.', '간격은 소속·분리·순서를 구별합니다. 모든 여백이 같다고 관계가 명확해지지는 않습니다.', '間隔は所属、分離、順序を区別します。同じ余白だけでは関係は明確になりません。'),
    concerns: ['grouping', 'readability', 'consistency'], surfaces: ['global'], relatedPrincipleIds: ['relational-spacing'], sourceIds: ['proximity', 'spacing'],
    observe: [L('Compare label-to-value, item-to-item and group-to-group gaps; look for a label nearer the wrong object.', '라벨과 값·항목과 항목·그룹과 그룹의 간격을 비교하고 라벨이 엉뚱한 대상에 가까운지 보세요.', 'ラベルと値、項目同士、グループ同士の間隔を比較し、ラベルが別の対象に近くないか確認します。')],
    decisions: [
      { when: L('Within-group and between-group gaps look alike.', '그룹 내부와 그룹 사이 간격이 비슷합니다.', 'グループ内とグループ間の間隔が似ています。'), change: L('Tighten the related pair or separate groups; name spacing tokens by relationship.', '관련 쌍을 가깝게 하거나 그룹을 더 분리하고 관계별 간격 토큰을 정하세요.', '関連する組を近づけるかグループを離し、関係ごとに間隔トークンを定めます。'), instead: L('Do not shrink hit areas or force all relationships onto one numerical ratio.', '조작 영역을 줄이거나 모든 관계에 하나의 숫자 비율을 강제하지 마세요.', '操作領域を縮めたり、すべての関係に一つの数値比率を強制しません。') },
      { when: L('Metadata appears to float between two items.', '부가 정보가 두 항목 사이에 떠 보입니다.', '補足情報が二つの項目の間に浮いて見えます。'), change: L('Attach it spatially and semantically to its owner; give item boundaries a separate rhythm.', '소유 항목에 공간적·의미적으로 붙이고 항목 경계에는 별도의 간격을 주세요.', '所属項目に空間的、意味的に結び付け、項目の境界には別の間隔を設けます。'), instead: L('A shared group heading belongs to the group, not arbitrarily to its first child.', '공통 그룹 제목을 임의로 첫 자식의 정보처럼 만들지 마세요.', '共通見出しを勝手に最初の子項目の情報にしません。') },
    ],
    preserve: L('Retain semantic labels and grouping in markup as well as the visible relationship.', '보이는 관계와 함께 마크업의 라벨·그룹 의미도 유지하세요.', '見える関係とともにマークアップのラベルやグループの意味も保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Mask the words mentally and compare whether the intended groups remain visible at narrow and wide widths.', '글자를 가린다고 생각하고 좁고 넓은 화면에서 의도한 그룹이 전후에 드러나는지 비교하세요.', '文字を隠したつもりで、狭い幅と広い幅で意図したグループが前後とも分かるか比較します。') }],
    examples: [
      { surface: 'form', before: L('Help text is nearer the next input.', '도움말이 다음 입력란에 더 가깝습니다.', '説明が次の入力欄に近くなっています。'), after: L('Label, input and help form one group.', '라벨·입력·도움말을 한 그룹으로 묶습니다.', 'ラベル、入力、説明を一つにまとめます。') },
      { surface: 'chat', before: L('A timestamp is equally distant from adjacent messages.', '시간이 앞뒤 메시지와 똑같이 떨어져 있습니다.', '時刻が前後のメッセージから等距離です。'), after: L('Time stays with its message; turns have larger separation.', '시간은 해당 메시지에 붙이고 턴 사이를 더 분리합니다.', '時刻を該当メッセージに付け、発言同士は広く区切ります。') },
    ],
  },
  {
    id: 'surface-hierarchy', category: 'perception', name: L('Boundaries and figure–ground', '경계와 전경·배경', '境界と図・地'),
    principle: L('A surface should explain containment, interaction or layering; repeated frames can obscure those distinctions.', '표면은 포함 관계·상호작용·층위를 설명해야 하며 반복된 틀은 그 차이를 흐릴 수 있습니다.', '面は包含、操作、重なりを説明し、繰り返す枠がその区別を曖昧にする場合があります。'),
    concerns: ['grouping', 'restraint', 'focus'], surfaces: ['global'], relatedPrincipleIds: ['depth-explains-structure'], sourceIds: ['common-region', 'color-roles'],
    observe: [L('Inventory each background, border and shadow and name the relationship it contributes.', '배경·테두리·그림자를 하나씩 나열하고 각각이 전달하는 관계를 적으세요.', '背景、境界線、影を一つずつ挙げ、それが伝える関係を記します。')],
    decisions: [
      { when: L('Several nested frames repeat the same grouping.', '여러 겹의 틀이 같은 그룹 관계를 반복합니다.', '入れ子の枠が同じグループ関係を繰り返します。'), change: L('Remove one redundant boundary and use spacing or a heading to retain membership.', '중복 경계 하나를 제거하고 간격이나 제목으로 소속을 유지하세요.', '重複した境界を一つ外し、間隔や見出しで所属を保ちます。'), instead: L('Retain a boundary needed to distinguish selectable objects or scrolling layers.', '선택 가능한 대상이나 스크롤 레이어 구분에 필요한 경계는 유지하세요.', '選択対象やスクロール層の区別に必要な境界は残します。') },
      { when: L('A popover or sticky region merges into its backdrop.', '팝오버나 고정 영역이 뒤 배경과 섞입니다.', 'ポップオーバーや固定領域が背景に溶け込みます。'), change: L('Add a meaningful surface or edge and correct stacking, clipping and focus behavior.', '의미 있는 표면이나 경계를 주고 쌓임·잘림·포커스 동작을 바로잡으세요.', '意味のある面や縁を付け、重なり、切れ、フォーカスを直します。'), instead: L('Do not apply floating-card elevation to every persistent section.', '모든 상시 섹션에 떠 있는 카드 높이를 적용하지 마세요.', '常設の全区画を浮いたカードにしません。') },
    ],
    preserve: L('Keep useful header fills and enclosing borders when they identify group membership. Removing a frame is not a gain if the group becomes harder to see. Keep selection, keyboard focus and active state distinguishable.', '그룹 소속을 알려주는 헤더 배경과 외곽선은 보존하세요. 틀을 없애 그룹 구분이 어려워졌다면 개선이 아닙니다. 선택·키보드 포커스·활성 상태도 구별 가능하게 유지하세요.', '所属を示す見出し背景と外枠を保ちます。枠を外してグループが見分けにくくなれば改善ではありません。選択、キーボードフォーカス、アクティブ状態も区別できるよう保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare item membership and active-layer visibility after each removed boundary, in both themes.', '경계를 제거한 뒤 항목의 소속과 활성 레이어가 두 테마에서 여전히 분명한지 비교하세요.', '境界を外した後も、両テーマで項目の所属とアクティブ層が明確か比較します。') }],
    examples: [
      { surface: 'settings', before: L('A fieldset sits inside three similarly outlined cards.', '필드 그룹이 비슷한 테두리 카드 세 겹 안에 있습니다.', '入力グループが似た枠のカード三重に囲まれています。'), after: L('One meaningful group boundary and a clear heading remain.', '의미 있는 그룹 경계 하나와 명확한 제목을 남깁니다.', '意味のある囲み一つと明確な見出しを残します。') },
      { surface: 'navigation', before: L('A menu blends with content scrolling beneath it.', '메뉴가 그 아래 스크롤 콘텐츠와 섞입니다.', 'メニューが背後のスクロール内容と混ざります。'), after: L('A distinct menu plane preserves its separate interaction context.', '메뉴 표면을 구별해 별도 조작 영역을 유지합니다.', 'メニューの面を区別し独立した操作領域を保ちます。') },
    ],
  },
  {
    id: 'visual-balance', category: 'perception', name: L('Balance and visual weight', '균형과 시각적 무게', 'バランスと視覚的な重さ'),
    principle: L('Size, darkness, detail and isolation contribute to visual weight; balanced composition need not be symmetrical.', '크기·명도·세부 묘사·고립된 배치가 시각적 무게를 만들며 균형에 반드시 대칭이 필요한 것은 아닙니다.', '大きさ、明暗、細部、孤立が視覚的な重さを作り、均衡には必ずしも対称性を要しません。'),
    concerns: ['balance', 'focus', 'restraint'], surfaces: ['global'], relatedPrincipleIds: ['attention-budget', 'contrast-before-scale', 'opening-earns-its-frame'], sourceIds: ['visual-hierarchy'],
    observe: [L('Compare the mass of text, imagery and controls, not just their bounding-box dimensions.', '텍스트·이미지·컨트롤의 경계 상자 크기뿐 아니라 시각적 덩어리의 무게를 비교하세요.', '文字、画像、操作部の外枠寸法だけでなく、視覚的な塊の重さを比較します。')],
    decisions: [
      { when: L('One incidental region overwhelms the task area.', '부수적인 영역 하나가 작업 영역을 압도합니다.', '付随的な一領域が作業領域を圧倒します。'), change: L('Reduce its area, contrast or detail, or reposition the task anchor to establish a deliberate balance.', '면적·대비·세부 묘사를 낮추거나 과업 중심 위치를 조정해 의도적인 균형을 만드세요.', '面積、対比、細部を弱めるか、課題の中心を移して意図的な均衡を作ります。'), instead: L('A deliberately dominant image or alert may be justified by the task.', '과업에 따라 지배적인 이미지나 경고가 타당할 수 있습니다.', '課題によって支配的な画像や警告が適切な場合もあります。') },
      { when: L('Symmetry forces unequal content into identical boxes.', '대칭 때문에 다른 내용이 같은 상자에 끼워집니다.', '対称性のため異なる内容が同じ箱に押し込まれます。'), change: L('Allocate space by content role and test a purposeful asymmetry.', '콘텐츠 역할에 따라 공간을 배분하고 목적 있는 비대칭을 검토하세요.', '内容の役割で空間を配分し、目的のある非対称を検討します。'), instead: L('Retain symmetry where it supports fair side-by-side comparison.', '나란히 공정하게 비교할 때 도움이 되는 대칭은 유지하세요.', '公平な横並び比較を助ける対称性は保ちます。') },
    ],
    preserve: L('Keep product identity and useful information capacity. Before shrinking navigation, compare readable title distinctions and truncation; unused main-area space is not a reason to take width from an information-dense sidebar. Keep a comfortable prose measure instead of filling every available pixel.', '제품 정체성과 유용한 정보 수용량을 보존하세요. 탐색 영역을 줄이기 전에 제목의 구별 가능성과 말줄임을 비교하세요. 본문에 공간이 남는다는 이유로 정보가 많은 사이드바의 폭을 빼앗지 마세요. 남은 공간을 채우기보다 편안한 본문 폭을 유지하세요.', '製品の個性と有用な情報量を保ちます。ナビを狭める前に題名の識別と省略を比較し、本文の空きだけを理由に情報の多いサイドバーから幅を奪いません。全幅を埋めるより読みやすい本文幅を保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare the whole frame at the same scale, then inspect text at actual size; a thumbnail judgement does not establish legibility.', '같은 축척에서 전체 구도를 비교한 뒤 실제 크기로 글자를 확인하세요. 축소 화면 판단만으로 가독성을 확정하지 마세요.', '同じ縮尺で全体を比べてから実寸で文字を確認します。縮小画像だけで読みやすさを断定しません。') }],
    examples: [
      { surface: 'landing-page', before: L('A decorative illustration outweighs the service explanation.', '장식 삽화가 서비스 설명을 압도합니다.', '装飾イラストがサービス説明を圧倒します。'), after: L('The illustration supports the offer without hiding the next action.', '삽화가 제안을 돕되 다음 행동을 가리지 않게 합니다.', 'イラストが提案を支え、次の操作を隠さないようにします。') },
      { surface: 'data-table', before: L('Large identical metric cards compete with the comparison table.', '커다란 동일 지표 카드들이 비교 표와 경쟁합니다.', '大きな同型の指標カードが比較表と競います。'), after: L('Summaries become compact; comparison receives sufficient space.', '요약을 간결하게 하고 비교에 충분한 공간을 줍니다.', '概要をコンパクトにし、比較に十分な空間を与えます。') },
    ],
  },
];
