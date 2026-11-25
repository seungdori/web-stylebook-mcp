import type { LocalizedText, ProductType } from '../types.js';
import type { PageRole } from '../recommendation/page-roles.js';

/**
 * Alternative type pairings for the 48 styles (2026-11-25 design-quality plan, 4.2). A style's authored fonts in its
 * visual contract stay the default; these are two or more other pairings per style, each with Korean and Japanese
 * faces. Only families that a visual contract already loads are used, at weights a contract already loads, so every
 * family has a verified licence in FONT_LICENSES and a stylesheet the website already serves. Sources, licences,
 * scripts and stylesheet URLs are derived from src/visual-canonical/fontSources.ts, not stored here.
 */
export const PAIRING_AXES = ['serif-sans', 'serif-mono', 'mono-sans', 'width', 'weight', 'bitmap-outline', 'single-family'] as const;
export type PairingAxis = (typeof PAIRING_AXES)[number];

export interface FontRef {
  family: string;
  /** Only the weights the pairing uses, ascending. */
  weights: readonly number[];
}
/** Faces that set Korean or Japanese text; without display, headings use the body face. */
export interface LocaleFonts {
  display?: FontRef;
  body: FontRef;
}
export interface TypePairing {
  id: string;
  /** What contrasts between the faces. */
  axis: PairingAxis;
  display: FontRef;
  body: FontRef;
  mono?: FontRef;
  locales: { ko: LocaleFonts; ja: LocaleFonts };
  styleIds: readonly string[];
  pageRoles: readonly PageRole[];
  productTypes: readonly ProductType[];
  why: LocalizedText;
  avoid: LocalizedText;
}

const f = (family: string, ...weights: number[]): FontRef => ({ family, weights });

const KO_SANS: LocaleFonts = { body: f('Pretendard Variable', 400, 700) };
const JA_SANS: LocaleFonts = { body: f('Noto Sans JP', 400, 500, 700) };
const KO_SERIF_HEAD: LocaleFonts = { display: f('Noto Serif KR', 600), body: f('Pretendard Variable', 400, 700) };
const JA_SERIF_HEAD: LocaleFonts = { display: f('Noto Serif JP', 600), body: f('Noto Sans JP', 400, 500) };
const KO_HEAVY_HEAD: LocaleFonts = { display: f('Black Han Sans', 400), body: f('Pretendard Variable', 400, 700) };
const JA_HEAVY_HEAD: LocaleFonts = { display: f('Dela Gothic One', 400), body: f('Noto Sans JP', 400, 500) };
const KO_MONO_TEXT: LocaleFonts = { body: f('Noto Sans KR', 400, 500) };
const JA_MONO_TEXT: LocaleFonts = { body: f('Noto Sans JP', 400, 500) };

export const TYPE_PAIRINGS: readonly TypePairing[] = [
  {
    id: 'reading-serif-grotesk', axis: 'serif-sans',
    display: f('Newsreader', 500, 600), body: f('Instrument Sans', 400, 500, 600),
    locales: { ko: KO_SERIF_HEAD, ja: JA_SERIF_HEAD },
    styleIds: ['aurora-gradient', 'editorial-silence', 'earth-atelier', 'midnight-noir', 'fusion-bento-noir', 'fusion-pure-noir'],
    pageRoles: ['blog-article', 'marketing-landing', 'portfolio', 'product-detail'],
    productTypes: ['content-editorial', 'portfolio', 'commerce', 'campaign'],
    why: {
      en: 'A text serif sets the headlines and a neutral grotesk sets everything else: serif against sans, so headlines read as editorial while forms, prices and captions stay plain.',
      ko: '제목은 본문용 세리프로, 나머지는 중립적인 그로테스크로 씁니다. 세리프와 산세리프의 대비라서 제목은 잡지처럼 읽히고, 폼·가격·캡션은 담백하게 보입니다.',
      ja: '見出しは本文用のセリフ、それ以外は中立的なグロテスクで組みます。セリフとサンセリフの対比で、見出しは雑誌のように読め、フォーム・価格・キャプションは簡素に見えます。',
    },
    avoid: {
      en: 'Dense tables and dashboards, where serif headlines compete with the numbers.',
      ko: '밀도 높은 표와 대시보드에는 쓰지 마세요. 세리프 제목이 숫자와 시선을 다툽니다.',
      ja: '密度の高い表やダッシュボードには使わないでください。セリフの見出しが数字と競合します。',
    },
  },
  {
    id: 'soft-serif-geometric', axis: 'serif-sans',
    display: f('Fraunces', 400, 600), body: f('Manrope', 400, 500, 600),
    locales: { ko: KO_SERIF_HEAD, ja: JA_SERIF_HEAD },
    styleIds: ['soft-pastel', 'paper-cut', 'bento-bloom', 'aurora-gradient', 'earth-atelier', 'fusion-clay-aurora'],
    pageRoles: ['marketing-landing', 'app-promo', 'blog-article', 'restaurant-local', 'signup'],
    productTypes: ['consumer-app', 'campaign', 'content-editorial', 'commerce'],
    why: {
      en: 'A soft serif display over a geometric sans: the warmth sits in the headlines, and the body stays even and quiet.',
      ko: '부드러운 세리프 제목 글꼴과 기하학적 산세리프 본문의 조합입니다. 따뜻함은 제목에 두고, 본문은 고르고 조용하게 둡니다.',
      ja: '柔らかなセリフの見出しと幾何学的なサンセリフの本文の組み合わせです。温かみは見出しに置き、本文は均一で静かに保ちます。',
    },
    avoid: {
      en: 'Technical, financial or security products, where the soft serif reads as casual.',
      ko: '기술·금융·보안 제품에는 쓰지 마세요. 부드러운 세리프가 가볍게 읽힙니다.',
      ja: '技術・金融・セキュリティの製品には使わないでください。柔らかなセリフが軽く見えます。',
    },
  },
  {
    id: 'didone-grotesk', axis: 'serif-sans',
    display: f('Bodoni Moda', 500, 600), body: f('Hanken Grotesk', 400, 500),
    locales: { ko: { display: f('Noto Serif KR', 600, 700), body: f('Pretendard Variable', 400, 700) }, ja: { display: f('Shippori Mincho', 600, 700), body: f('Noto Sans JP', 400, 500) } },
    styleIds: ['fusion-bento-noir', 'editorial-silence', 'liquid-metal', 'fusion-noir-metal', 'holographic-fluid', 'fusion-pure-noir'],
    pageRoles: ['product-detail', 'marketing-landing', 'portfolio', 'pricing'],
    productTypes: ['commerce', 'portfolio', 'campaign'],
    why: {
      en: 'A high-contrast Didone for headlines and prices over a plain grotesk: hairline strokes signal luxury, and the grotesk keeps details and checkout legible.',
      ko: '제목과 가격은 대비가 큰 디돈 세리프로, 나머지는 평범한 그로테스크로 씁니다. 가는 획이 고급스러움을 알리고, 그로테스크가 상세 정보와 결제 화면을 읽기 쉽게 합니다.',
      ja: '見出しと価格はコントラストの強いディドーン体、それ以外は素直なグロテスクで組みます。細いヘアラインが高級感を示し、グロテスクが詳細情報と決済画面を読みやすく保ちます。',
    },
    avoid: {
      en: 'Small sizes and busy or low-contrast backgrounds, where the hairlines break up; keep the Didone at 32px and above.',
      ko: '작은 크기, 복잡하거나 대비가 낮은 배경에는 쓰지 마세요. 가는 획이 끊겨 보입니다. 디돈은 32px 이상에만 쓰세요.',
      ja: '小さなサイズや、込み入った背景・コントラストの低い背景には使わないでください。ヘアラインが途切れて見えます。ディドーン体は32px以上で使ってください。',
    },
  },
  {
    id: 'mincho-display-grotesk', axis: 'serif-sans',
    display: f('Shippori Mincho', 600, 700), body: f('Inter', 400, 500),
    locales: { ko: KO_SERIF_HEAD, ja: { body: f('Noto Sans JP', 400, 500) } },
    styleIds: ['midnight-noir', 'editorial-silence', 'holographic-fluid', 'earth-atelier'],
    pageRoles: ['portfolio', 'product-detail', 'blog-article', 'marketing-landing', 'restaurant-local'],
    productTypes: ['portfolio', 'commerce', 'content-editorial'],
    why: {
      en: 'A Mincho with Latin glyphs sets the headlines over Inter: brush-shaped serifs give a quiet, crafted voice, and Japanese headlines need no second display face.',
      ko: '라틴 글자도 있는 명조체로 제목을 쓰고, 본문은 Inter로 씁니다. 붓으로 쓴 듯한 세리프가 조용하고 공들인 인상을 주고, 일본어 제목에는 다른 제목 글꼴이 필요 없습니다.',
      ja: 'ラテン文字も備えた明朝体で見出しを組み、本文は Inter で組みます。筆で書いたようなセリフが静かで丁寧な印象を与え、日本語の見出しに別の見出し書体は要りません。',
    },
    avoid: {
      en: 'Data-dense app screens and technical products, where Mincho headlines read as literary.',
      ko: '데이터가 많은 앱 화면과 기술 제품에는 쓰지 마세요. 명조 제목이 문학적으로 읽힙니다.',
      ja: 'データの多いアプリ画面や技術系の製品には使わないでください。明朝の見出しが文学的に見えます。',
    },
  },
  {
    id: 'literary-single-serif', axis: 'single-family',
    display: f('Literata', 600), body: f('Literata', 400, 500), mono: f('IBM Plex Mono', 400, 500),
    locales: { ko: { display: f('Noto Serif KR', 600), body: f('Noto Serif KR', 400) }, ja: { display: f('Noto Serif JP', 600), body: f('Noto Serif JP', 400) } },
    styleIds: ['fusion-editorial-terminal', 'risograph-print', 'fusion-grain-mono', 'editorial-silence'],
    pageRoles: ['blog-article', 'docs'],
    productTypes: ['content-editorial', 'documentation', 'knowledge-base'],
    why: {
      en: 'One book serif for headlines and long reading, with a mono for code and data: the article has one voice, and the mono marks what is machine text.',
      ko: '제목과 긴 글을 책용 세리프 하나로 쓰고, 코드와 데이터는 고정폭 글꼴로 씁니다. 글 전체가 한 목소리를 내고, 고정폭 글꼴이 기계가 만든 글을 구분합니다.',
      ja: '見出しと長文を書籍用セリフひとつで組み、コードとデータは等幅書体で組みます。記事全体がひとつの声になり、等幅書体が機械の出力を区別します。',
    },
    avoid: {
      en: 'Landing pages and app screens, where a serif body slows the scanning of short labels.',
      ko: '랜딩 페이지와 앱 화면에는 쓰지 마세요. 세리프 본문은 짧은 라벨을 훑어보기 어렵게 합니다.',
      ja: 'ランディングページやアプリ画面には使わないでください。セリフの本文は短いラベルを拾い読みしにくくします。',
    },
  },
  {
    id: 'serif-typewriter', axis: 'serif-mono',
    display: f('Fraunces', 600, 700), body: f('Courier Prime', 400, 700),
    locales: { ko: { display: f('Noto Serif KR', 600, 700), body: f('Noto Sans KR', 400, 500) }, ja: { display: f('Noto Serif JP', 600, 700), body: f('Noto Sans JP', 400, 500) } },
    styleIds: ['risograph-print', 'fusion-grain-mono', 'fusion-editorial-terminal'],
    pageRoles: ['portfolio', 'blog-article', 'restaurant-local', 'marketing-landing'],
    productTypes: ['portfolio', 'content-editorial', 'campaign'],
    why: {
      en: 'A heavy soft serif over a typewriter mono: the page reads like printed matter, and the mono gives every caption and figure a typed texture.',
      ko: '굵고 부드러운 세리프와 타자기 고정폭 글꼴의 조합입니다. 페이지가 인쇄물처럼 읽히고, 고정폭 글꼴이 캡션과 숫자에 타자로 친 질감을 줍니다.',
      ja: '太く柔らかなセリフとタイプライター風の等幅書体の組み合わせです。ページが印刷物のように読め、等幅書体がキャプションと数字にタイプした質感を与えます。',
    },
    avoid: {
      en: 'Forms and long body text on screen; the typewriter mono tires the eye after a few paragraphs.',
      ko: '폼과 화면의 긴 본문에는 쓰지 마세요. 타자기 글꼴은 몇 문단만 읽어도 눈이 피로합니다.',
      ja: 'フォームや画面上の長い本文には使わないでください。タイプライター書体は数段落で目が疲れます。',
    },
  },
  {
    id: 'neutral-grotesk-mono', axis: 'single-family',
    display: f('Inter', 600, 700), body: f('Inter', 400, 500), mono: f('JetBrains Mono', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['runtime-signal', 'platform-core', 'console-launch', 'neumorphism', 'macos-liquid-glass', 'notion-style', 'fusion-product-swiss'],
    pageRoles: ['dashboard', 'data-table', 'settings', 'docs', 'signup', 'pricing'],
    productTypes: ['operational-saas', 'data-analytics', 'developer-tool', 'finance-admin', 'security-console'],
    why: {
      en: 'One neutral grotesk at several weights with a code mono: hierarchy comes from size and weight, and tabular figures line up in tables.',
      ko: '중립적인 그로테스크 하나를 여러 굵기로 쓰고, 코드에는 고정폭 글꼴을 씁니다. 위계는 크기와 굵기로 만들고, 표의 숫자는 tabular figures로 자리를 맞춥니다.',
      ja: '中立的なグロテスクひとつを複数のウェイトで使い、コードには等幅書体を使います。階層はサイズとウェイトでつくり、表の数字は tabular figures で桁を揃えます。',
    },
    avoid: {
      en: 'Brand and campaign pages that need a voice; Inter alone reads as a default.',
      ko: '개성이 필요한 브랜드·캠페인 페이지에는 쓰지 마세요. Inter만 쓰면 기본값처럼 보입니다.',
      ja: '個性が必要なブランドやキャンペーンのページには使わないでください。Inter だけではデフォルトに見えます。',
    },
  },
  {
    id: 'geist-system', axis: 'single-family',
    display: f('Geist', 500, 600), body: f('Geist', 400, 500), mono: f('Geist Mono', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['quiet-utility', 'platform-core', 'notion-style', 'macos-liquid-glass', 'console-launch', 'neumorphism', 'fusion-pure-noir'],
    pageRoles: ['dashboard', 'data-table', 'settings', 'docs', 'pricing', 'signup'],
    productTypes: ['developer-tool', 'operational-saas', 'ai-chat', 'documentation'],
    why: {
      en: 'A tight geometric grotesk with its own mono: product UI and code come from one design, so labels, figures and snippets share one rhythm.',
      ko: '촘촘한 기하학적 그로테스크와 같은 계열의 고정폭 글꼴입니다. 제품 UI와 코드가 한 디자인에서 나와서, 라벨·숫자·코드 조각이 같은 리듬을 가집니다.',
      ja: '詰まった幾何学的グロテスクと、同じファミリーの等幅書体です。製品UIとコードがひとつのデザインから来るので、ラベル・数字・コード片が同じリズムになります。',
    },
    avoid: {
      en: 'Editorial and lifestyle pages, where its engineered tone feels cold.',
      ko: '에디토리얼·라이프스타일 페이지에는 쓰지 마세요. 공학적인 인상이 차갑게 느껴집니다.',
      ja: 'エディトリアルやライフスタイルのページには使わないでください。工学的な印象が冷たく感じられます。',
    },
  },
  {
    id: 'friendly-geometric-ui', axis: 'single-family',
    display: f('Figtree', 600, 700), body: f('Figtree', 400, 500), mono: f('Roboto Mono', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['quiet-utility', 'runtime-signal', 'notion-style', 'macos-liquid-glass', 'bento-bloom'],
    pageRoles: ['settings', 'signup', 'dashboard', 'app-promo', 'docs'],
    productTypes: ['consumer-app', 'operational-saas', 'healthcare-portal', 'knowledge-base'],
    why: {
      en: 'A friendly geometric sans with open shapes at every size: one face keeps an app approachable, and the mono handles codes and IDs.',
      ko: '열린 형태의 친근한 기하학적 산세리프 하나를 모든 크기에 씁니다. 글꼴 하나로 앱을 편하게 보이게 하고, 코드와 ID는 고정폭 글꼴이 맡습니다.',
      ja: '開いた形の親しみやすい幾何学的サンセリフを、すべてのサイズに使います。書体ひとつでアプリを親しみやすく保ち、コードとIDは等幅書体が受け持ちます。',
    },
    avoid: {
      en: 'Premium or editorial brands that need contrast between headlines and text.',
      ko: '제목과 본문의 대비가 필요한 고급·에디토리얼 브랜드에는 쓰지 마세요.',
      ja: '見出しと本文の対比が必要な高級・エディトリアルのブランドには使わないでください。',
    },
  },
  {
    id: 'grotesk-display-text', axis: 'weight',
    display: f('Space Grotesk', 600, 700), body: f('Inter', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['swiss-poster', 'fusion-neon-swiss', 'runtime-signal', 'platform-core', 'fusion-kinetic-brutal', 'framer-motion', 'mesh-gradient'],
    pageRoles: ['marketing-landing', 'app-promo', 'pricing', 'docs', 'portfolio'],
    productTypes: ['developer-tool', 'campaign', 'ai-chat', 'operational-saas'],
    why: {
      en: 'A grotesk with quirky details for headlines over a neutral text face: the headlines get character, and the body stays out of the way.',
      ko: '독특한 디테일이 있는 그로테스크로 제목을 쓰고, 본문은 중립적인 글꼴로 씁니다. 제목에는 개성이 생기고, 본문은 눈에 띄지 않습니다.',
      ja: '癖のあるディテールを持つグロテスクで見出しを組み、本文は中立的な書体で組みます。見出しに個性が出て、本文は目立ちません。',
    },
    avoid: {
      en: 'Editorial and luxury pages, where the pairing reads as tech.',
      ko: '에디토리얼·고급 브랜드 페이지에는 쓰지 마세요. 기술 제품처럼 읽힙니다.',
      ja: 'エディトリアルや高級ブランドのページには使わないでください。テック製品のように見えます。',
    },
  },
  {
    id: 'single-grotesk-poster', axis: 'single-family',
    display: f('Work Sans', 600, 700), body: f('Work Sans', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['swiss-poster', 'fusion-neon-swiss', 'mono-type'],
    pageRoles: ['marketing-landing', 'portfolio', 'docs', 'blog-article', 'pricing'],
    productTypes: ['content-editorial', 'campaign', 'portfolio', 'documentation'],
    why: {
      en: 'One grotesk from text to poster sizes, with hierarchy by size and weight alone, which keeps a grid-led page strict.',
      ko: '본문부터 포스터 크기까지 그로테스크 하나로 쓰고, 위계는 크기와 굵기로만 만듭니다. 그리드가 이끄는 페이지를 엄격하게 유지합니다.',
      ja: '本文からポスターサイズまでグロテスクひとつで組み、階層はサイズとウェイトだけでつくります。グリッド主導のページを厳格に保ちます。',
    },
    avoid: {
      en: 'Pages without a clear grid or scale steps; with one face there is then no hierarchy.',
      ko: '그리드나 크기 단계가 뚜렷하지 않은 페이지에는 쓰지 마세요. 글꼴이 하나라서 위계가 생기지 않습니다.',
      ja: 'グリッドやサイズの段階がはっきりしないページには使わないでください。書体がひとつなので階層が生まれません。',
    },
  },
  {
    id: 'wide-display-geometric', axis: 'width',
    display: f('Unbounded', 600, 700), body: f('Manrope', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['glass-orbit', 'liquid-metal', 'fusion-product-swiss', 'fusion-clay-aurora', 'mesh-gradient', 'claymorphism'],
    pageRoles: ['marketing-landing', 'app-promo', 'portfolio', 'product-detail'],
    productTypes: ['campaign', 'consumer-app', 'ai-chat', 'commerce'],
    why: {
      en: 'An extended display face over a plain geometric sans: the width contrast makes short headlines feel large without a heavy weight.',
      ko: '옆으로 넓은 제목 글꼴과 평범한 기하학적 산세리프의 조합입니다. 폭의 대비 덕분에 짧은 제목이 굵지 않아도 크게 느껴집니다.',
      ja: '横に広い見出し書体と、素直な幾何学的サンセリフの組み合わせです。幅の対比で、短い見出しは太くしなくても大きく感じられます。',
    },
    avoid: {
      en: 'Long headlines and narrow mobile columns; an extended face fits few characters per line.',
      ko: '긴 제목과 좁은 모바일 단에는 쓰지 마세요. 넓은 글꼴은 한 줄에 글자가 적게 들어갑니다.',
      ja: '長い見出しや狭いモバイルの段には使わないでください。幅の広い書体は1行に入る文字が少なくなります。',
    },
  },
  {
    id: 'squared-extended-text', axis: 'width',
    display: f('Michroma', 400), body: f('Golos Text', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['glass-orbit', 'framer-motion', 'neon-drift', 'fusion-holo-glass'],
    pageRoles: ['marketing-landing', 'product-detail', 'app-promo', 'portfolio'],
    productTypes: ['commerce', 'campaign', 'consumer-app'],
    why: {
      en: 'A squared, extended face for names and measured values over a plain sans: it reads as engineered and fast, and only headlines carry it.',
      ko: '각지고 넓은 글꼴로 이름과 측정값을 쓰고, 나머지는 평범한 산세리프로 씁니다. 정밀하고 빠른 인상을 주며, 이 글꼴은 제목에만 씁니다.',
      ja: '角ばった幅広の書体で名前と計測値を組み、それ以外は素直なサンセリフで組みます。精密で速い印象になり、この書体は見出しだけに使います。',
    },
    avoid: {
      en: 'Body text and small labels; Michroma has one weight and wide letters.',
      ko: '본문과 작은 라벨에는 쓰지 마세요. Michroma는 굵기가 하나뿐이고 글자가 넓습니다.',
      ja: '本文や小さなラベルには使わないでください。Michroma はウェイトがひとつで、字幅が広い書体です。',
    },
  },
  {
    id: 'condensed-poster-sans', axis: 'width',
    display: f('Big Shoulders Display', 800, 900), body: f('Work Sans', 400, 500),
    locales: { ko: KO_HEAVY_HEAD, ja: JA_HEAVY_HEAD },
    styleIds: ['brutalist-grid', 'kinetic-pop', 'fusion-holo-glass', 'fusion-strict-console', 'fusion-kinetic-brutal'],
    pageRoles: ['marketing-landing', 'app-promo', 'restaurant-local', 'portfolio'],
    productTypes: ['campaign', 'commerce', 'consumer-app'],
    why: {
      en: 'Tall condensed capitals for headlines, dates and figures over a plain sans: the width contrast fits big numbers into narrow columns.',
      ko: '높고 좁은 대문자로 제목·날짜·숫자를 쓰고, 나머지는 평범한 산세리프로 씁니다. 폭의 대비 덕분에 큰 숫자가 좁은 단에도 들어갑니다.',
      ja: '背が高く幅の狭い大文字で見出し・日付・数字を組み、それ以外は素直なサンセリフで組みます。幅の対比で、大きな数字も狭い段に収まります。',
    },
    avoid: {
      en: 'Calm, trust-led products such as healthcare or finance; condensed capitals shout.',
      ko: '의료·금융처럼 차분하고 신뢰가 중요한 제품에는 쓰지 마세요. 좁은 대문자는 소리치듯 보입니다.',
      ja: '医療や金融のように落ち着きと信頼が大切な製品には使わないでください。幅の狭い大文字は叫んでいるように見えます。',
    },
  },
  {
    id: 'condensed-caps-text', axis: 'width',
    display: f('Anton', 400), body: f('Golos Text', 400, 500),
    locales: { ko: KO_HEAVY_HEAD, ja: JA_HEAVY_HEAD },
    styleIds: ['duotone-bold', 'kinetic-pop', 'fusion-strict-console', 'fusion-kinetic-brutal', 'fusion-holo-glass'],
    pageRoles: ['marketing-landing', 'app-promo', 'restaurant-local', 'portfolio'],
    productTypes: ['campaign', 'commerce', 'consumer-app', 'content-editorial'],
    why: {
      en: 'A one-weight condensed display at poster sizes over a plain sans: the display face carries all the weight, so the text face can stay at 400.',
      ko: '굵기가 하나인 좁은 제목 글꼴을 포스터 크기로 쓰고, 본문은 평범한 산세리프로 씁니다. 무게는 제목 글꼴이 모두 맡으므로 본문은 400으로 둡니다.',
      ja: 'ウェイトがひとつの幅の狭い見出し書体をポスターサイズで使い、本文は素直なサンセリフで組みます。重さは見出し書体がすべて担うので、本文は400のままにします。',
    },
    avoid: {
      en: 'Headlines under 32px and long mixed-case sentences; Anton is built for short capitals.',
      ko: '32px보다 작은 제목과 대소문자가 섞인 긴 문장에는 쓰지 마세요. Anton은 짧은 대문자용입니다.',
      ja: '32pxより小さい見出しや、大文字と小文字が混ざった長い文には使わないでください。Anton は短い大文字向けの書体です。',
    },
  },
  {
    id: 'heavy-poster-grotesk', axis: 'weight',
    display: f('Archivo Black', 400), body: f('Hanken Grotesk', 400, 500),
    locales: { ko: KO_HEAVY_HEAD, ja: JA_HEAVY_HEAD },
    styleIds: ['kinetic-pop', 'duotone-bold', 'mesh-gradient'],
    pageRoles: ['marketing-landing', 'app-promo', 'pricing', 'restaurant-local'],
    productTypes: ['campaign', 'consumer-app', 'commerce'],
    why: {
      en: 'A black-weight grotesk for headlines over a plain grotesk: the weight contrast is at its maximum, so one headline carries the page.',
      ko: '가장 굵은 그로테스크로 제목을 쓰고, 본문은 평범한 그로테스크로 씁니다. 굵기 대비가 가장 커서 제목 하나가 페이지를 이끕니다.',
      ja: '最も太いグロテスクで見出しを組み、本文は素直なグロテスクで組みます。ウェイトの対比が最大なので、見出しひとつがページを引っ張ります。',
    },
    avoid: {
      en: 'Screens with several equal headlines; the weight loses its point when everything is black.',
      ko: '비슷한 제목이 여러 개인 화면에는 쓰지 마세요. 모든 것이 굵으면 굵기의 의미가 없어집니다.',
      ja: '同格の見出しがいくつも並ぶ画面には使わないでください。すべてが太いとウェイトの意味がなくなります。',
    },
  },
  {
    id: 'rounded-display-text', axis: 'weight',
    display: f('Fredoka', 500, 600), body: f('Lexend', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['claymorphism', 'bento-bloom', 'fusion-soft-inflate', 'soft-pastel', 'fusion-clay-aurora', 'paper-cut'],
    pageRoles: ['app-promo', 'signup', 'marketing-landing', 'restaurant-local'],
    productTypes: ['consumer-app', 'campaign'],
    why: {
      en: 'A rounded display over a text face built for legibility: soft terminals make headlines friendly, and Lexend keeps instructions easy to read.',
      ko: '둥근 제목 글꼴과 읽기 쉽게 만든 본문 글꼴의 조합입니다. 둥근 끝이 제목을 친근하게 만들고, Lexend가 안내문을 읽기 쉽게 합니다.',
      ja: '丸い見出し書体と、読みやすさを重視した本文書体の組み合わせです。丸い端が見出しを親しみやすくし、Lexend が案内文を読みやすく保ちます。',
    },
    avoid: {
      en: 'Finance, security and other trust-heavy products, where rounded type reads as a toy.',
      ko: '금융·보안처럼 신뢰가 중요한 제품에는 쓰지 마세요. 둥근 글꼴이 장난감처럼 보입니다.',
      ja: '金融やセキュリティなど信頼が重要な製品には使わないでください。丸い書体がおもちゃのように見えます。',
    },
  },
  {
    id: 'rounded-heavy-grotesque', axis: 'weight',
    display: f('Baloo 2', 700, 800), body: f('Karla', 400, 500),
    locales: { ko: KO_SANS, ja: JA_SANS },
    styleIds: ['fusion-clay-aurora', 'fusion-soft-inflate', 'bento-bloom'],
    pageRoles: ['app-promo', 'marketing-landing', 'signup'],
    productTypes: ['consumer-app', 'campaign'],
    why: {
      en: 'A heavy rounded display over a grotesque with quirky details: the headlines are playful, and the body keeps some character at reading sizes.',
      ko: '굵고 둥근 제목 글꼴과 독특한 디테일이 있는 그로테스크 본문의 조합입니다. 제목은 경쾌하고, 본문도 읽는 크기에서 개성이 조금 보입니다.',
      ja: '太く丸い見出し書体と、癖のあるグロテスクの本文の組み合わせです。見出しは軽快で、本文も読むサイズで少し個性が見えます。',
    },
    avoid: {
      en: 'Data-dense screens; heavy rounded letters take a lot of space.',
      ko: '데이터가 많은 화면에는 쓰지 마세요. 굵고 둥근 글자는 자리를 많이 차지합니다.',
      ja: 'データの多い画面には使わないでください。太く丸い文字は場所を多く取ります。',
    },
  },
  {
    id: 'single-mono-plex', axis: 'single-family',
    display: f('IBM Plex Mono', 500, 700), body: f('IBM Plex Mono', 400),
    locales: { ko: KO_MONO_TEXT, ja: JA_MONO_TEXT },
    styleIds: ['fusion-quiet-manifesto', 'zen-minimalism', 'fusion-cyber-console', 'fusion-grain-mono', 'mono-type', 'terminal-core'],
    pageRoles: ['portfolio', 'docs', 'blog-article'],
    productTypes: ['developer-tool', 'documentation', 'portfolio', 'content-editorial'],
    why: {
      en: 'One engineered mono for everything: every line has the same rhythm, and hierarchy comes from weight and space, like a drafting sheet.',
      ko: '공학적으로 다듬은 고정폭 글꼴 하나로 모두 씁니다. 모든 줄이 같은 리듬을 가지고, 위계는 도면처럼 굵기와 여백으로 만듭니다.',
      ja: '工学的に整えた等幅書体ひとつですべてを組みます。どの行も同じリズムになり、階層は図面のようにウェイトと余白でつくります。',
    },
    avoid: {
      en: 'Products that need warmth; when every line is mono, the page reads as a technical document.',
      ko: '따뜻함이 필요한 제품에는 쓰지 마세요. 모든 줄이 고정폭이면 기술 문서처럼 읽힙니다.',
      ja: '温かみが必要な製品には使わないでください。すべての行が等幅だと技術文書のように見えます。',
    },
  },
  {
    id: 'single-mono-code', axis: 'single-family',
    display: f('JetBrains Mono', 500, 700), body: f('JetBrains Mono', 400),
    locales: { ko: KO_MONO_TEXT, ja: JA_MONO_TEXT },
    styleIds: ['zen-minimalism', 'fusion-cyber-console', 'fusion-grain-mono', 'terminal-core', 'mono-type'],
    pageRoles: ['docs', 'portfolio', 'blog-article'],
    productTypes: ['developer-tool', 'documentation', 'portfolio'],
    why: {
      en: 'One code mono with a tall x-height for the whole page: it stays legible at small sizes and makes the page read like a terminal session.',
      ko: 'x-height가 높은 코드용 고정폭 글꼴 하나로 페이지 전체를 씁니다. 작은 크기에서도 잘 읽히고, 페이지가 터미널 세션처럼 읽힙니다.',
      ja: 'x-height の高いコード用等幅書体ひとつでページ全体を組みます。小さなサイズでも読みやすく、ページがターミナルのセッションのように読めます。',
    },
    avoid: {
      en: 'Brand and commerce pages; a code face turns every headline into a command.',
      ko: '브랜드·커머스 페이지에는 쓰지 마세요. 코드 글꼴은 모든 제목을 명령어처럼 보이게 합니다.',
      ja: 'ブランドやコマースのページには使わないでください。コード用書体はすべての見出しをコマンドのように見せます。',
    },
  },
  {
    id: 'single-mono-typewriter', axis: 'single-family',
    display: f('Sometype Mono', 600, 700), body: f('Sometype Mono', 400),
    locales: { ko: KO_MONO_TEXT, ja: JA_MONO_TEXT },
    styleIds: ['fusion-quiet-manifesto', 'fusion-grain-mono', 'terminal-core', 'mono-type', 'fusion-cyber-console'],
    pageRoles: ['portfolio', 'blog-article', 'docs'],
    productTypes: ['portfolio', 'content-editorial', 'documentation'],
    why: {
      en: 'One calm, typewriter-like mono for the whole page, with hierarchy by weight alone: quieter than a code face, so it suits writing and portfolios.',
      ko: '차분한 타자기풍 고정폭 글꼴 하나로 페이지 전체를 쓰고, 위계는 굵기로만 만듭니다. 코드 글꼴보다 조용해서 글과 포트폴리오에 맞습니다.',
      ja: '落ち着いたタイプライター風の等幅書体ひとつでページ全体を組み、階層はウェイトだけでつくります。コード用書体より静かなので、文章やポートフォリオに向きます。',
    },
    avoid: {
      en: 'Dense app screens; when every label is the same mono, controls and content look alike.',
      ko: '밀도 높은 앱 화면에는 쓰지 마세요. 모든 라벨이 같은 고정폭이면 컨트롤과 내용이 구분되지 않습니다.',
      ja: '密度の高いアプリ画面には使わないでください。すべてのラベルが同じ等幅だと、操作部品と内容の区別がつきません。',
    },
  },
  {
    id: 'condensed-caps-mono', axis: 'mono-sans',
    display: f('Oswald', 700), body: f('IBM Plex Mono', 400, 500),
    locales: { ko: { display: f('Black Han Sans', 400), body: f('Noto Sans KR', 400, 500) }, ja: { display: f('Dela Gothic One', 400), body: f('Noto Sans JP', 400, 500) } },
    styleIds: ['brutalist-grid', 'cyberpunk-glitch', 'terminal-core'],
    pageRoles: ['portfolio', 'marketing-landing', 'docs'],
    productTypes: ['developer-tool', 'campaign', 'portfolio', 'content-editorial'],
    why: {
      en: 'Condensed capitals for headings over a mono for every field: the page reads like a printed form or a spec sheet.',
      ko: '제목은 좁은 대문자로, 모든 항목은 고정폭 글꼴로 씁니다. 페이지가 인쇄된 양식이나 사양서처럼 읽힙니다.',
      ja: '見出しは幅の狭い大文字、すべての項目は等幅書体で組みます。ページが印刷された書式や仕様書のように読めます。',
    },
    avoid: {
      en: 'Consumer and lifestyle products, where the pairing reads as stern.',
      ko: '소비자 앱과 라이프스타일 제품에는 쓰지 마세요. 딱딱하게 읽힙니다.',
      ja: '一般消費者向けアプリやライフスタイル製品には使わないでください。堅苦しく見えます。',
    },
  },
  {
    id: 'squared-tech-mono', axis: 'mono-sans',
    display: f('Chakra Petch', 600, 700), body: f('Red Hat Mono', 400, 500),
    locales: { ko: KO_MONO_TEXT, ja: JA_MONO_TEXT },
    styleIds: ['cyberpunk-glitch', 'neon-drift', 'console-launch', 'fusion-cyber-console', 'liquid-metal', 'fusion-noir-metal'],
    pageRoles: ['app-promo', 'marketing-landing', 'dashboard'],
    productTypes: ['consumer-app', 'developer-tool', 'campaign'],
    why: {
      en: 'A squared, cut-corner sans for headings over a plain mono: the shapes read as hardware and motorsport, and the mono carries the readouts.',
      ko: '모서리를 깎은 각진 산세리프로 제목을 쓰고, 나머지는 평범한 고정폭 글꼴로 씁니다. 형태가 하드웨어와 모터스포츠를 떠올리게 하고, 계기 값은 고정폭 글꼴이 맡습니다.',
      ja: '角を落とした角ばったサンセリフで見出しを組み、それ以外は素直な等幅書体で組みます。形がハードウェアやモータースポーツを思わせ、計器の値は等幅書体が受け持ちます。',
    },
    avoid: {
      en: 'Healthcare, finance and other products that need to feel calm.',
      ko: '의료·금융처럼 차분해야 하는 제품에는 쓰지 마세요.',
      ja: '医療や金融など落ち着きが必要な製品には使わないでください。',
    },
  },
  {
    id: 'bitmap-display-sans', axis: 'bitmap-outline',
    display: f('Silkscreen', 400, 700), body: f('Work Sans', 400, 500),
    locales: { ko: KO_SANS, ja: { display: f('DotGothic16', 400), body: f('Noto Sans JP', 400, 500) } },
    styleIds: ['retro-pixel', 'fusion-studio-pixel', 'y2k-retro', 'fusion-floppy-exe'],
    pageRoles: ['app-promo', 'marketing-landing', 'portfolio'],
    productTypes: ['consumer-app', 'campaign', 'portfolio'],
    why: {
      en: 'A bitmap face for headlines and numbers over a plain sans: the pixels set the era, and reading stays effortless.',
      ko: '비트맵 글꼴로 제목과 숫자를 쓰고, 본문은 평범한 산세리프로 씁니다. 픽셀이 시대감을 만들고, 본문은 편하게 읽힙니다.',
      ja: 'ビットマップ書体で見出しと数字を組み、本文は素直なサンセリフで組みます。ピクセルが時代の雰囲気をつくり、本文は楽に読めます。',
    },
    avoid: {
      en: 'Body text, small sizes and anything users must read carefully; a bitmap face blurs off its pixel grid.',
      ko: '본문, 작은 크기, 꼼꼼히 읽어야 하는 내용에는 쓰지 마세요. 비트맵 글꼴은 픽셀 격자에서 벗어나면 흐려집니다.',
      ja: '本文や小さなサイズ、注意して読む必要がある内容には使わないでください。ビットマップ書体はピクセルの格子から外れるとにじみます。',
    },
  },
  {
    id: 'terminal-bitmap-mono', axis: 'bitmap-outline',
    display: f('VT323', 400), body: f('Space Mono', 400, 700),
    locales: { ko: KO_MONO_TEXT, ja: { display: f('DotGothic16', 400), body: f('Noto Sans JP', 400, 500) } },
    styleIds: ['retro-pixel', 'terminal-core', 'y2k-retro', 'fusion-floppy-exe', 'fusion-studio-pixel', 'cyberpunk-glitch'],
    pageRoles: ['portfolio', 'app-promo', 'docs'],
    productTypes: ['developer-tool', 'consumer-app', 'portfolio'],
    why: {
      en: 'A CRT terminal face for what the machine prints over a geometric mono for prose: it reads like a 1980s screen without making paragraphs hard.',
      ko: '기계가 출력하는 글은 CRT 터미널 글꼴로, 설명 글은 기하학적 고정폭 글꼴로 씁니다. 1980년대 화면처럼 보이면서 문단은 읽기 어렵지 않습니다.',
      ja: '機械が出力する文字は CRT 端末風の書体、説明文は幾何学的な等幅書体で組みます。1980年代の画面のように見えながら、段落は読みにくくなりません。',
    },
    avoid: {
      en: 'More than a few lines in VT323; keep it for headings, prompts and figures.',
      ko: 'VT323으로 몇 줄 넘게 쓰지 마세요. 제목, 프롬프트, 숫자에만 씁니다.',
      ja: 'VT323 で数行を超える文章を組まないでください。見出し・プロンプト・数字だけに使います。',
    },
  },
];
