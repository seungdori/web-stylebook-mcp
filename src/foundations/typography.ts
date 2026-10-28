import { L, type DesignFoundation } from './types.js';

export const TYPOGRAPHY_FOUNDATIONS: DesignFoundation[] = [
  {
    id: 'type-roles', category: 'typography', name: L('Typographic roles and hierarchy', '글자의 역할과 위계', '文字の役割と階層'),
    principle: L('Type communicates structure through a coordinated set of size, weight, spacing and semantics.', '글자는 크기·굵기·간격·의미 구조의 조합으로 구조를 전달합니다.', '文字は大きさ、太さ、間隔、意味構造の組合せで構造を伝えます。'),
    concerns: ['readability', 'scanability', 'consistency'], surfaces: ['global'], relatedPrincipleIds: ['deliberate-type-scale', 'contrast-before-scale'], sourceIds: ['typesetting', 'visual-hierarchy'],
    observe: [L('Map visible text to title, section, body, label and metadata roles; compare actual glyph size after fonts load.', '보이는 글을 제목·섹션·본문·라벨·부가 정보에 대응시키고 폰트 로드 뒤 실제 글자 크기를 비교하세요.', '文字を題、節、本文、ラベル、補足に対応させ、フォント読込後の実際の字面を比べます。')],
    decisions: [
      { when: L('Every role has nearly the same visual treatment.', '모든 역할의 글자가 거의 같습니다.', '全ての役割の文字がほぼ同じです。'), change: L('Define a small role scale; distinguish key roles through weight and spacing as well as size.', '작은 역할 척도를 만들고 크기뿐 아니라 굵기와 간격으로 주요 역할을 구별하세요.', '小さな役割尺度を定め、サイズだけでなく太さと間隔でも主要な役割を区別します。'), instead: L('Dense interfaces need subtle distinctions; giant headings are not obligatory.', '고밀도 UI에는 미묘한 구별이 맞을 수 있으며 큰 제목이 필수는 아닙니다.', '高密度UIには繊細な区別が適し、大見出しは必須ではありません。') },
      { when: L('Incidental size variations make repeated roles inconsistent.', '우발적 크기 차이로 반복 역할이 흔들립니다.', '偶発的なサイズ差で反復する役割が不揃いです。'), change: L('Map repeated text to shared role tokens and retain semantic heading levels independently of appearance.', '반복 글을 공통 역할 토큰에 연결하고 의미상 제목 단계는 외형과 독립적으로 유지하세요.', '反復文字を共通役割トークンに結び、意味上の見出し階層を外観と独立して保ちます。'), instead: L('Do not make metadata unreadable just to exaggerate the hierarchy.', '위계를 과장하려 부가 정보를 읽기 어렵게 줄이지 마세요.', '階層を誇張するため補足文字を読めなくしません。') },
    ],
    preserve: L('Keep existing font identity when usable, semantic headings, and readable metadata.', '사용 가능한 기존 폰트 정체성·의미상 제목·부가 정보 가독성을 보존하세요.', '利用可能な既存フォントの個性、意味上の見出し、補足の読みやすさを保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare repeated roles across at least two surfaces with real fonts, long headings and zoom; inspect outlines in the DOM separately.', '실제 폰트·긴 제목·확대 상태로 두 종류 이상 화면의 반복 역할을 비교하고 DOM 제목 구조는 별도로 확인하세요.', '実フォント、長い見出し、拡大で二種類以上の画面を比較し、DOMの見出し構造も別途確認します。') }],
    examples: [
      { surface: 'content', before: L('Headings and paragraphs form one undifferentiated block.', '제목과 문단이 하나의 덩어리로 보입니다.', '見出しと段落が一つの塊に見えます。'), after: L('Section hierarchy is clear without changing the article’s meaning.', '기사 의미를 바꾸지 않고 섹션 위계를 드러냅니다.', '記事の意味を変えず節の階層を示します。') },
      { surface: 'settings', before: L('Each field invents a different label style.', '필드마다 라벨 스타일이 다릅니다.', '項目ごとにラベル様式が異なります。'), after: L('Labels share one role, with help and errors distinctly related.', '라벨 역할을 통일하고 도움말·오류의 관계를 구별합니다.', 'ラベル役割を統一し、説明やエラーとの関係を区別します。') },
    ],
  },
  {
    id: 'reading-measure', category: 'typography', name: L('Line length, leading and paragraph rhythm', '행 길이·행간·문단 리듬', '行長、行間、段落のリズム'),
    principle: L('Line length, font metrics and line spacing must work together; paragraphs need their own rhythm.', '행 길이·글자 형태·행간을 함께 조율하고 문단에는 별도 리듬을 줍니다.', '行長、字形、行間を連動させ、段落には別のリズムを設けます。'),
    concerns: ['readability', 'grouping', 'accessibility'], surfaces: ['content', 'chat', 'landing-page', 'onboarding'], relatedPrincipleIds: ['measure-and-leading'], sourceIds: ['typesetting', 'text-spacing'],
    observe: [L('Read several real lines: note lost line starts, cramped ascenders, separated lines and weak paragraph boundaries.', '실제 여러 줄을 읽으며 줄 시작을 놓침·글자 높이 충돌·떨어져 보이는 줄·약한 문단 경계를 보세요.', '実際の数行を読み、行頭を見失う、字高が詰まる、行が離れる、段落境界が弱い箇所を見ます。')],
    decisions: [
      { when: L('Long lines make the next line difficult to locate.', '긴 줄 때문에 다음 줄 시작을 찾기 어렵습니다.', '長い行で次の行頭を見つけにくくなっています。'), change: L('Bound prose width and retune leading using the actual language and font.', '실제 언어와 폰트에 맞춰 본문 폭을 제한하고 행간을 조정하세요.', '実際の言語とフォントに合わせ本文幅を制限し行間を調整します。'), instead: L('Do not apply Latin character counts to CJK or force code and tables into a prose column.', '라틴 문자 수를 한중일에 그대로 적용하거나 코드·표를 본문 폭에 강제로 넣지 마세요.', 'ラテン文字数をCJKに直用したりコードや表を本文幅へ強制しません。') },
      { when: L('Lines or paragraphs merge, or separate so much that continuity is lost.', '줄·문단이 붙거나 너무 떨어져 연속성이 끊깁니다.', '行や段落が密着、または離れすぎて連続性を失っています。'), change: L('Tune line-height and paragraph gaps separately and allow text containers to grow.', '행간과 문단 간격을 별도로 조정하고 텍스트 영역이 늘어날 수 있게 하세요.', '行間と段落間隔を別々に調整し、文字領域が伸びられるようにします。'), instead: L('WCAG text-spacing override values are not mandatory default line-height or tracking.', 'WCAG 사용자 간격 재정의 값은 기본 행간·자간의 강제값이 아닙니다.', 'WCAGの間隔変更値は既定の行間や字間の強制値ではありません。') },
    ],
    preserve: L('Retain full text, links and keyboard access when wrapping or clamping changes.', '줄바꿈·줄 수 제한을 바꿀 때 전체 글·링크·키보드 접근을 보존하세요.', '折返しや行数制限を変えても全文、リンク、キーボードアクセスを保ちます。'),
    compare: [{ evidence: 'computed-style', test: L('Test simultaneous user overrides: line-height 1.5, paragraph spacing 2em, letter spacing .12em and word spacing .16em, applying script exceptions; check content and functionality.', '문자 체계 예외를 적용해 행간 1.5·문단 간격 2em·자간 .12em·단어 간격 .16em을 동시에 재정의하고 내용·기능 보존을 확인하세요.', '文字体系の例外を適用し、行間1.5、段落間隔2em、字間.12em、単語間隔.16emを同時変更して内容と機能を確認します。') }],
    examples: [
      { surface: 'chat', before: L('Message text spans a wide monitor.', '메시지 글이 넓은 모니터를 가로지릅니다.', 'メッセージが広い画面を横断します。'), after: L('Readable prose measure coexists with wider code blocks.', '읽기 좋은 본문 폭과 더 넓은 코드 영역을 함께 둡니다.', '読みやすい本文幅と広いコード領域を両立します。') },
      { surface: 'content', before: L('User spacing makes a fixed-height excerpt hide its link.', '사용자 간격 변경으로 고정 높이 요약의 링크가 숨습니다.', '間隔変更で固定高の概要のリンクが隠れます。'), after: L('The excerpt expands without losing the destination.', '요약이 늘어나도 목적지 접근을 유지합니다.', '概要が伸びても移動先へのアクセスを保ちます。') },
    ],
  },
  {
    id: 'language-resilience', category: 'typography', name: L('Typography across languages and content extremes', '언어와 콘텐츠 길이에 견디는 글자 설계', '言語と内容の極端さに耐える組版'),
    principle: L('Translated text and different scripts change width, height and direction; size the layout around those realities.', '번역과 문자 체계는 폭·높이·방향을 바꾸므로 이를 감안해 배치를 만듭니다.', '翻訳と文字体系は幅、高さ、方向を変えるため、その現実に合わせて配置します。'),
    concerns: ['readability', 'responsiveness', 'resilience'], surfaces: ['global'], relatedPrincipleIds: ['align-for-reading', 'task-sized-composition'], sourceIds: ['translation'],
    observe: [L('Use long translations, CJK, mixed-script names, numbers, missing fonts and bidirectional content where supported.', '지원 범위에서 긴 번역·한중일·혼합 문자 이름·숫자·폰트 누락·양방향 내용을 확인하세요.', '対応範囲で長い翻訳、CJK、混在名、数字、フォント欠落、双方向内容を確認します。')],
    decisions: [
      { when: L('A label fits only in the original language.', '라벨이 원래 언어에서만 맞습니다.', 'ラベルが元の言語でしか収まりません。'), change: L('Allow wrapping or flexible width; revise concise wording without losing distinctions.', '줄바꿈이나 유연한 폭을 허용하고 구별되는 의미를 유지하며 간결하게 다듬으세요.', '折返しや可変幅を許し、意味の区別を保ちながら簡潔に直します。'), instead: L('Do not shrink translations or abbreviate unfamiliar terms merely to preserve geometry.', '모양을 유지하려 번역 글자를 줄이거나 낯선 용어를 약어로 만들지 마세요.', '形を守るだけの縮字や不慣れな略語化を避けます。') },
      { when: L('Alignment or clipping changes with script or font fallback.', '문자 체계나 대체 폰트에 따라 정렬·잘림이 달라집니다.', '文字体系や代替フォントで揃えや切れが変わります。'), change: L('Use logical start/end layout, script-appropriate line breaking and flexible block height.', '논리적 시작·끝 배치, 문자 체계에 맞는 줄바꿈, 유연한 높이를 쓰세요.', '論理的な開始と終了、文字体系に合う改行、柔軟な高さを使います。'), instead: L('Do not mirror logos, media or directional data without checking their meaning.', '로고·미디어·방향성 데이터는 의미를 확인하지 않고 뒤집지 마세요.', 'ロゴ、メディア、方向性のあるデータを意味確認なしに反転しません。') },
    ],
    preserve: L('Keep names, amounts, units and meaningful title differences intact.', '이름·금액·단위·제목의 의미 있는 차이를 보존하세요.', '名前、金額、単位、題名の意味ある違いを保ちます。'),
    compare: [{ evidence: 'rendered', test: L('Compare identical fixtures in supported locales and font fallbacks; check clipping and action reachability, not only text presence.', '지원 언어와 대체 폰트에서 같은 데이터로 비교하고 글의 존재뿐 아니라 잘림과 행동 접근을 확인하세요.', '対応言語と代替フォントで同じデータを比べ、文字の存在だけでなく切れと操作到達性を確認します。') }],
    examples: [
      { surface: 'navigation', before: L('Translated tabs overlap.', '번역된 탭이 겹칩니다.', '翻訳したタブが重なります。'), after: L('Tabs adapt without losing names or navigation.', '이름과 탐색을 잃지 않고 탭을 적응시킵니다.', '名前や移動を失わずタブを適応させます。') },
      { surface: 'form', before: L('Korean fallback glyphs clip inside fixed controls.', '고정 컨트롤에서 한글 대체 글자가 잘립니다.', '固定操作部で韓国語の代替字形が切れます。'), after: L('Line boxes accommodate the supported script.', '지원 문자 체계를 담는 줄 높이를 확보합니다.', '対応文字体系を収める行の高さを確保します。') },
    ],
  },
];
