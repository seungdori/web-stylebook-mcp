import type { LocalizedText } from '../types.js';
import type {
  CriterionDef, GlobalPatternDef, GlobalPatternId, StyleRuleDef, StyleRuleId, StyleRuleParams,
} from './types.js';

/** Detection thresholds; the criteria text below and the detectors read the same numbers. */
export const T = {
  blobMinBlurPx: 24,
  blobMinRoundPercent: 40,
  blobMinSizePx: 120,
  stackSubMinWords: 6,
  photoMinWidthPx: 480,
  logoMinItems: 4,
  logoMaxWords: 3,
  claimMaxWords: 16,
  bandMaxWords: 45,
  cardsMin: 3,
  cardHeadingMaxWords: 8,
  cardBlurbMinWords: 4,
  cardBlurbMaxWords: 60,
  quotesMin: 2,
  dotsMin: 3,
  bannerHeadingMaxWords: 12,
  bannerParagraphMaxWords: 30,
  skeletonMinSections: 3,
  glowMinBlurPx: 8,
  glowMaxOffsetPx: 2,
  saturatedMinLightness: 0.2,
  saturatedMaxLightness: 0.85,
  iconTileMaxPx: 72,
  illustrationMinPx: 160,
  photoMinPx: 120,
} as const;

const t = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

const CENTERED_HEADING: CriterionDef = {
  id: 'centered-heading',
  text: "The opening's headline (its h1, or the first h2 or h3 when the page has no visible h1; a visually hidden brand h1 does not count) is center-aligned: text-align center (own or inherited), or a centered flex column or grid.",
};

export const GLOBAL_PATTERNS: readonly GlobalPatternDef[] = [
  {
    id: 'gradient-blob-hero',
    job: 'opening',
    severity: 'major',
    scope: 'opening',
    name: t('Centered hero over a gradient blob', '그라디언트 얼룩 위의 가운데 정렬 히어로', 'グラデーションの塊に重ねた中央揃えヒーロー'),
    description: t(
      'The opening centers its headline over a blurred, decorative gradient shape that says nothing about the product.',
      '첫 화면이 제품과 상관없는 흐린 장식용 그라디언트 도형 위에 제목을 가운데 정렬합니다.',
      '冒頭で、製品と無関係なぼかした装飾グラデーションの上に見出しを中央揃えで置いています。',
    ),
    replace: t(
      "Rebuild the opening around the product's own object with this style's hero composition, and delete the blob instead of recoloring it.",
      '이 스타일의 히어로 구성으로 첫 화면을 제품 자체의 대상 중심으로 다시 짜세요. 얼룩은 색만 바꾸지 말고 지우세요.',
      'このスタイルのヒーロー構成で、冒頭を製品そのものの対象を中心に組み直してください。塊は色を変えるのではなく削除してください。',
    ),
    antiPatternIds: ['formulaic-opening', 'generic-saas'],
    auditCheckIds: ['avoid-formulaic-opening', 'opening-demonstrates-product', 'avoid-generic-saas'],
    criteria: [
      CENTERED_HEADING,
      {
        id: 'decorative-gradient-shape',
        text: `Inside the opening, an element with no text, or a ::before/::after (the opening's own included), has a gradient or saturated fill blurred ≥ ${T.blobMinBlurPx}px by its own filter or a wrapper's (an inline SVG counts when its shapes are filled with url(#…) pointing at a linear or radial gradient, or with a saturated colour), or a radial gradient on a shape ≥ ${T.blobMinSizePx}px that is rounded ≥ ${T.blobMinRoundPercent}% or clipped to a polygon, circle, or ellipse, or is an image marked as decoration (empty alt or aria-hidden) and named as a blob, gradient, glow, aurora, orb, mesh, or bokeh that is blurred ≥ ${T.blobMinBlurPx}px or ≥ ${T.blobMinSizePx}px. It or a wrapper between it and the opening is absolutely positioned, aria-hidden, role presentation, pointer-events none, or behind content (z-index < 0); a fixed full-page field does not count.`,
      },
    ],
  },
  {
    id: 'centered-stack-hero',
    job: 'opening',
    severity: 'major',
    scope: 'opening',
    name: t('All-text centered stack', '텍스트만 가운데로 쌓은 첫 화면', 'テキストだけを中央に積んだ冒頭'),
    description: t(
      'The opening is an eyebrow, headline, subline, and button stack centered on the page with no product visual: the default AI opening.',
      '첫 화면이 제품 시각 자료 없이 작은 머리글·제목·부제·버튼을 가운데에 쌓은 형태입니다. AI가 기본으로 만드는 첫 화면입니다.',
      '冒頭が、製品のビジュアルなしにアイブロウ・見出し・サブコピー・ボタンを中央に積んだ形です。AIが既定で作る冒頭です。',
    ),
    replace: t(
      "Replace the stack with this style's hero composition: lead with the product's object or first action, and keep the copy to a headline, one short line, and one action.",
      '이 스타일의 히어로 구성으로 바꾸세요. 제품의 대상이나 첫 동작을 앞세우고, 문구는 제목 1개·짧은 문장 1줄·동작 1개로 줄이세요.',
      'このスタイルのヒーロー構成に置き換えてください。製品の対象か最初の操作を先頭に置き、文言は見出し1つ・短い1行・操作1つに絞ってください。',
    ),
    antiPatternIds: ['formulaic-opening'],
    auditCheckIds: ['avoid-formulaic-opening', 'opening-demonstrates-product'],
    supersededBy: ['gradient-blob-hero'],
    criteria: [
      CENTERED_HEADING,
      {
        id: 'copy-stack',
        text: `The opening holds the headline, a paragraph of ≥ ${T.stackSubMinWords} words, and at least one call to action, plus an eyebrow (short text before the headline) or a second call to action.`,
      },
      {
        id: 'no-product-visual',
        text: 'The opening contains no image, picture, video, canvas, iframe, form control, table, code block, or SVG larger than an icon, and no hand-built mock: a block apart from the copy with ≥ 10 elements, or a figure, role="img", or aria-labelled block with ≥ 3. Decoration does not count as either: something aria-hidden or presentational that is also laid out of flow or behind content, or an empty-alt image behind content, unclickable, or blurred. An aria-hidden demo in the flow beside the copy still counts.',
      },
    ],
  },
  {
    id: 'stock-photo-hero',
    job: 'opening',
    severity: 'major',
    scope: 'opening',
    name: t('Stock-photo hero', '스톡 사진 히어로', 'ストック写真のヒーロー'),
    description: t(
      "The opening's main visual is a stock or placeholder photograph instead of the product's own artifact.",
      '첫 화면의 주요 시각 자료가 제품 자체의 결과물이 아니라 스톡 사진이나 자리표시 이미지입니다.',
      '冒頭の主要ビジュアルが、製品自身の成果物ではなくストック写真やプレースホルダー画像です。',
    ),
    replace: t(
      "Show the product's real artifact (its interface, output, or subject) in this style's hero composition; with no real image, use a type- or data-led opening.",
      '이 스타일의 히어로 구성 안에 제품의 실제 결과물(화면·출력물·대상)을 보여 주세요. 실제 이미지가 없으면 글자나 데이터로 첫 화면을 여세요.',
      'このスタイルのヒーロー構成の中で、製品の実際の成果物(画面・出力・対象)を見せてください。実画像がなければ、文字やデータで冒頭を始めてください。',
    ),
    antiPatternIds: ['formulaic-opening', 'proof-free-polish'],
    auditCheckIds: ['opening-demonstrates-product', 'avoid-formulaic-opening'],
    criteria: [
      {
        id: 'stock-source',
        text: 'An img, picture, or source src/srcset, or a CSS background url, in the opening is served by a stock or placeholder host (Unsplash, Pexels, Pixabay, Shutterstock, iStock, Getty Images, Adobe Stock, Freepik, Depositphotos, Dreamstime, 123RF, picsum.photos, placehold.co, placeholder.com, randomuser.me, and similar), directly or through an image optimizer or CDN (a url=, src=, image=, or u= parameter, as in Next.js /_next/image, or an absolute URL inside the path), or its file name or alt text names a stock source.',
      },
      {
        id: 'dominant-media',
        text: `That image is the opening's dominant visual: declared width ≥ ${T.photoMinWidthPx}px or ≥ 50%, object-fit cover, absolutely filling the section, or the section's own background image.`,
      },
    ],
  },
  {
    id: 'logo-strip',
    job: 'proof',
    severity: 'major',
    scope: 'section',
    name: t('Logo strip', '로고 띠', 'ロゴの帯'),
    description: t(
      'A row of customer or partner logos used as borrowed credibility.',
      '고객사나 파트너 로고를 한 줄로 늘어놓아 신뢰를 빌려 오는 띠입니다.',
      '顧客やパートナーのロゴを一列に並べ、信頼を借りる帯です。',
    ),
    replace: t(
      "Remove it unless you have permission and a reason to name real customers; show proof a visitor can inspect instead (a real result, artifact, or named case) with this style's proof move.",
      '실제 고객을 밝힐 권한과 이유가 없다면 지우세요. 대신 방문자가 직접 확인할 수 있는 근거(실제 결과·결과물·이름이 있는 사례)를 이 스타일의 근거 무브로 보여 주세요.',
      '実際の顧客名を出す許可と理由がなければ削除してください。代わりに、訪問者が確かめられる根拠(実際の結果・成果物・名前のある事例)をこのスタイルの根拠ムーブで見せてください。',
    ),
    antiPatternIds: ['fake-content', 'proof-free-polish', 'generic-saas'],
    auditCheckIds: ['avoid-fake-content', 'avoid-proof-free-polish', 'avoid-generic-saas'],
    criteria: [
      {
        id: 'logo-row',
        text: `A container holds ≥ ${T.logoMinItems} sibling items that are each one image, SVG, or picture (optionally wrapped in a link, list item, figure, or div) with ≤ ${T.logoMaxWords} words of text, laid out as one row (a flex row, or a grid with ≥ ${T.logoMinItems} or auto-fit columns) or as a looping marquee track.`,
      },
      {
        id: 'logo-cue',
        text: "At least one cue says the items are logos: 'logo' in alt, src, class, or aria-label; grayscale or opacity ≤ 0.8 on the items or the row; a looping animation; social-proof wording in the same band; or a heading that names organizations (customers, clients, partners, sponsors, backers, investors).",
      },
      {
        id: 'not-functional',
        text: 'The row is not inside navigation, is not footer social links, is not payment or app-store badges, and is not labelled as integrations.',
      },
    ],
  },
  {
    id: 'trusted-by-band',
    job: 'proof',
    severity: 'major',
    scope: 'section',
    name: t('Generic “trusted by” band', '막연한 “○○가 신뢰하는” 띠', '漠然とした「○○に信頼されています」帯'),
    description: t(
      'A short band that claims popularity (“Trusted by 10,000+ teams”) without anything a visitor can check.',
      '확인할 수 있는 근거 없이 인기를 주장하는 짧은 띠입니다(예: “1만 개 팀이 신뢰”).',
      '確かめられる根拠なしに人気を主張する短い帯です(例:「1万チームが信頼」)。',
    ),
    replace: t(
      'Delete the claim; if real, attributable evidence exists, state it specifically next to the decision it supports.',
      '주장을 지우세요. 출처를 밝힐 수 있는 실제 근거가 있으면, 그 근거가 뒷받침하는 결정 옆에 구체적으로 쓰세요.',
      '主張を削除してください。出典を示せる実際の根拠があれば、それが支える判断の横に具体的に書いてください。',
    ),
    antiPatternIds: ['fake-content', 'unsupported-claim-as-established'],
    auditCheckIds: ['avoid-fake-content', 'avoid-unsupported-claim-as-established'],
    criteria: [
      {
        id: 'claim-text',
        text: `A text of ≤ ${T.claimMaxWords} words matches a generic social-proof claim: “trusted/used/loved/chosen/backed by” followed by a crowd (100 or more, a k or M unit, or N+), “thousands/millions”, or a generic group (teams, companies, brands, “the world’s …”), “as seen in/on”, “join N+ teams/companies/users”, “N+ teams use/trust …”, or the Korean and Japanese equivalents. A seat limit such as “used by 5 people” is not a claim; typographic quotes and apostrophes match their ASCII forms.`,
      },
      {
        id: 'band',
        text: `The claim sits in a short band (≤ ${T.bandMaxWords} words in its section, with no quotes or calls to action) or beside proof media: ≥ 3 images or SVGs not hidden with aria-hidden (logos, avatars; check-mark icons do not count), or a star or N/5 rating.`,
      },
    ],
  },
  {
    id: 'icon-feature-grid',
    job: 'capabilities',
    severity: 'major',
    scope: 'section',
    name: t('Icon feature cards', '아이콘 기능 카드', 'アイコン付き機能カード'),
    description: t(
      'Three or more look-alike cards, each an icon, a short title, and a blurb: the 3-up feature grid of the SaaS template.',
      '아이콘·짧은 제목·설명문으로 된 비슷한 카드 3개 이상입니다. SaaS 템플릿의 3열 기능 그리드입니다.',
      'アイコン・短いタイトル・説明文でできた似たカードが3枚以上並びます。SaaSテンプレートの3列機能グリッドです。',
    ),
    replace: t(
      "Show how the product works instead (a sequence, a comparison, or the real interface) with this style's capability move; keep an icon only where it speeds recognition.",
      '대신 제품이 어떻게 동작하는지 보여 주세요(순서·비교·실제 화면). 이 스타일의 기능 무브를 쓰고, 아이콘은 알아보는 속도를 높일 때만 남기세요.',
      '代わりに製品の動き方(手順・比較・実際の画面)を、このスタイルの機能ムーブで見せてください。アイコンは認識を速める場合だけ残してください。',
    ),
    antiPatternIds: ['generic-saas', 'decorative-iconography'],
    auditCheckIds: ['avoid-generic-saas', 'avoid-decorative-iconography'],
    criteria: [
      { id: 'card-row', text: `A container has ≥ ${T.cardsMin} sibling cards with the same structure, laid out as a row or a grid.` },
      {
        id: 'icon-title-blurb',
        text: `Each card starts with an icon (an SVG ≤ 64px, an icon-font glyph, an icon image, or a lone emoji) before or at the start of a heading or term of ≤ ${T.cardHeadingMaxWords} words (as in \`<dt><svg/>Title</dt>\`), followed by a blurb of ${T.cardBlurbMinWords}–${T.cardBlurbMaxWords} words.`,
      },
      { id: 'not-media-or-steps', text: 'The cards are not led by a photo, a screenshot, or a round named portrait, and their headings are not step numbers.' },
    ],
  },
  {
    id: 'testimonial-carousel',
    job: 'proof',
    severity: 'major',
    scope: 'section',
    name: t('Testimonial carousel', '후기 캐러셀', 'お客様の声カルーセル'),
    description: t(
      'Rotating customer quotes, usually unverifiable and auto-advancing.',
      '고객 후기가 돌아가며 바뀌는 슬라이더입니다. 대개 확인할 수 없고 자동으로 넘어갑니다.',
      '顧客の声が切り替わるスライダーです。多くは確かめられず、自動で進みます。',
    ),
    replace: t(
      'Show one or two real, attributed quotes statically beside the claim they support, or remove the section; never invent testimonials.',
      '실제 출처가 있는 후기 1~2개를 그 후기가 뒷받침하는 주장 옆에 고정해서 보여 주세요. 없으면 섹션을 지우세요. 후기를 지어내지 마세요.',
      '出典のある実際の声を1〜2件、それが支える主張の横に固定して見せるか、セクションを削除してください。声を捏造しないでください。',
    ),
    antiPatternIds: ['fake-content', 'generic-saas'],
    auditCheckIds: ['avoid-fake-content', 'avoid-generic-saas'],
    criteria: [
      {
        id: 'quotes',
        text: `The section holds ≥ ${T.quotesMin} rendered quote items: blockquote or q, a figure with a figcaption and quoted text, or an element whose class or id has the word testimonial, review, or quote and holds no other quote item (so a section named "testimonials" counts its quotes, and "template-preview" is not a review).`,
      },
      {
        id: 'carousel',
        text: `It has rendered carousel mechanics: a carousel, slider, swiper, splide, slick, glide, embla, keen, flickity, owl, or marquee class, id, or data attribute; aria-roledescription carousel or slide; a horizontal scroll-snap track; two previous/next controls (a lone ‹ › arrow, an icon button labelled prev, previous, or next, or a short label that also names a slide, testimonial, quote, or review); ≥ ${T.dotsMin} slide dots (empty buttons, or buttons labelled as a slide); or a looping animation on the track. Controls labelled as pages, or inside a pagination container (labelled as pages, or named pagination or pager), page through a list and are not carousel controls.`,
      },
    ],
  },
  {
    id: 'closing-cta-banner',
    job: 'action',
    severity: 'minor',
    scope: 'section',
    name: t('Generic closing CTA banner', '막연한 마무리 CTA 배너', '漠然とした締めのCTAバナー'),
    description: t(
      'The page ends with a bare “Ready to get started?” banner instead of the product’s next step.',
      '페이지가 제품의 다음 단계 대신 “시작할 준비가 되셨나요?” 같은 빈 배너로 끝납니다.',
      'ページが製品の次の一歩ではなく、「始める準備はできましたか?」のような中身のないバナーで終わります。',
    ),
    replace: t(
      "End with the specific next action in the product's own terms (what happens after the click), placed in the page flow rather than a slogan banner.",
      '제품의 말로 구체적인 다음 동작(누르면 무슨 일이 일어나는지)을 쓰고, 구호 배너가 아니라 페이지 흐름 안에 두세요.',
      '製品自身の言葉で具体的な次の操作(押すと何が起きるか)を書き、スローガンのバナーではなくページの流れの中に置いてください。',
    ),
    antiPatternIds: ['generic-saas', 'abstract-consultancy-copy'],
    auditCheckIds: ['avoid-generic-saas', 'avoid-abstract-consultancy-copy'],
    criteria: [
      { id: 'last-section', text: 'It is the last content section before the footer.' },
      {
        id: 'bare-banner',
        text: `It holds only a heading of ≤ ${T.bannerHeadingMaxWords} words, at most one paragraph of ≤ ${T.bannerParagraphMaxWords} words, and 1–2 calls to action: no form fields, list, table, media, or code.`,
      },
      {
        id: 'stock-conversion-copy',
        text: 'Its heading or a call to action uses stock conversion copy (“Ready to get started?”, “Start your free trial”, “Join thousands of teams”, or the Korean and Japanese equivalents).',
      },
      { id: 'staged', text: 'It is staged as a banner: its heading is centered, or the section has its own background fill or image.' },
    ],
  },
  {
    id: 'generic-saas-skeleton',
    job: 'page',
    severity: 'major',
    scope: 'page',
    name: t('Generic SaaS page skeleton', '일반 SaaS 페이지 골격', '汎用SaaSページの骨格'),
    description: t(
      'The page follows the template order (generic opening, proof band, icon features, testimonials, closing banner), so the chosen style only recolors it.',
      '페이지가 템플릿 순서(일반 첫 화면 → 근거 띠 → 아이콘 기능 → 후기 → 마무리 배너)를 따릅니다. 고른 스타일은 색만 바꿉니다.',
      'ページがテンプレートの順序(汎用の冒頭→根拠の帯→アイコン機能→お客様の声→締めのバナー)に従っています。選んだスタイルは色を変えるだけです。',
    ),
    replace: t(
      "Reorder the page around this style's section order and the product's own content, and drop template sections that have no product-specific content.",
      '이 스타일의 섹션 순서와 제품 자체의 내용으로 페이지 순서를 다시 짜세요. 제품 고유의 내용이 없는 템플릿 섹션은 빼세요.',
      'このスタイルのセクション順と製品自身の内容でページを組み直し、製品固有の内容がないテンプレートのセクションは外してください。',
    ),
    antiPatternIds: ['generic-saas'],
    auditCheckIds: ['avoid-generic-saas', 'style-direction-is-visible'],
    criteria: [
      {
        id: 'template-sections',
        text: `At least ${T.skeletonMinSections} template sections are present: a generic opening (gradient-blob-hero, centered-stack-hero, or stock-photo-hero), a proof band (logo-strip or trusted-by-band), icon feature cards, a testimonial block (a carousel or a static set of ≥ ${T.quotesMin} quotes), and a closing CTA banner.`,
      },
      { id: 'template-order', text: 'They appear in template order: the opening first, proof and features before testimonials, and the banner last.' },
    ],
  },
];

export function globalPattern(id: GlobalPatternId): GlobalPatternDef {
  const found = GLOBAL_PATTERNS.find((pattern) => pattern.id === id);
  if (!found) throw new Error(`unknown global structure pattern '${id}'`);
  return found;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const list = (items: readonly string[]) => items.join('/');

const FACE: Record<'monospace' | 'serif' | 'sans', LocalizedText> = {
  monospace: t('monospace', '고정폭', '等幅'),
  serif: t('serif', '세리프', 'セリフ'),
  sans: t('sans', '산세리프', 'サンセリフ'),
};
const IMAGERY: Record<'illustration' | 'photo' | 'emoji', LocalizedText> = {
  illustration: t('illustration', '일러스트', 'イラスト'),
  photo: t('photo', '사진', '写真'),
  emoji: t('emoji', '이모지', '絵文字'),
};

/** Banned generic faces in the reader's language; named families stay as written. */
function bannedFaces(p: StyleRuleParams['typeface']): LocalizedText {
  const faces = p.forbid ?? [];
  const families = p.forbidFamilies ?? [];
  const join = (lang: 'en' | 'ko' | 'ja') => list([...faces.map((face) => FACE[face][lang]), ...families]);
  return t(join('en'), join('ko'), join('ja'));
}

function rule<R extends StyleRuleId>(def: StyleRuleDef<R>): StyleRuleDef<R> {
  return def;
}

export const STYLE_RULES: { [R in StyleRuleId]: StyleRuleDef<R> } = {
  'corner-radius': rule({
    id: 'corner-radius',
    name: (p) => (p.max !== undefined
      ? t(`Rounded corners above ${p.max}px`, `${p.max}px보다 둥근 모서리`, `${p.max}pxを超える角丸`)
      : t(`Corners sharper than ${p.min}px`, `${p.min}px보다 각진 모서리`, `${p.min}px未満の角`)),
    fix: (p) => (p.max !== undefined
      ? t(
        `Keep the corner radius of cards, panels, buttons, inputs, and images at ${p.max}px or less.`,
        `카드·패널·버튼·입력란·이미지의 모서리 반경을 ${p.max}px 이하로 두세요.`,
        `カード・パネル・ボタン・入力欄・画像の角丸を${p.max}px以下にしてください。`,
      )
      : t(
        `Give cards, panels, and controls a corner radius of at least ${p.min}px.`,
        `카드·패널·조작 요소의 모서리 반경을 ${p.min}px 이상으로 두세요.`,
        `カード・パネル・操作要素の角丸を${p.min}px以上にしてください。`,
      )),
    criteria: (p) => [p.max !== undefined
      ? { id: 'radius-above-max', text: `A card, panel, button, input, image, or section has border-radius > ${p.max}px (a percentage ≥ 10% counts as rounded); ${p.allowCircles ? 'circles (equal sides, fully rounded) are exempt, so a round stamp or seal stays' : 'circles of 48px or less without text, such as avatars and status dots, are exempt'}.` }
      : { id: 'radius-below-min', text: `A card or panel (a container with text plus a border on three or more sides, a shadow, or its own fill; a one-sided divider rule does not make a card, and page sections are bands, not cards) has border-radius < ${p.min}px.` }],
  }),
  'shadow-blur': rule({
    id: 'shadow-blur',
    name: (p) => t(`Blurred drop shadows (blur > ${p.maxBlurPx}px)`, `흐린 그림자(blur ${p.maxBlurPx}px 초과)`, `ぼかした影(blur ${p.maxBlurPx}px超)`),
    fix: () => t(
      'Remove soft elevation; separate surfaces with rules, borders, or flat fills, as this style does.',
      '부드러운 그림자를 빼세요. 이 스타일처럼 선·테두리·단색 면으로 표면을 나누세요.',
      '柔らかい影を外し、このスタイルのように罫線・枠線・単色の面で面を分けてください。',
    ),
    criteria: (p) => [{ id: 'blurred-shadow', text: `An element has a non-inset box-shadow layer with a blur radius > ${p.maxBlurPx}px.` }],
  }),
  'hard-shadow': rule({
    id: 'hard-shadow',
    name: () => t('Hard offset shadows', '딱딱한 오프셋 그림자', '硬いオフセット影'),
    fix: () => t(
      'Drop the sticker-style offset shadow; this style builds depth another way.',
      '스티커처럼 어긋난 그림자를 빼세요. 이 스타일은 다른 방식으로 깊이를 만듭니다.',
      'ステッカーのようにずらした影を外してください。このスタイルは別の方法で奥行きを作ります。',
    ),
    criteria: (p) => [{ id: 'offset-shadow', text: `An element has a non-inset box-shadow layer with blur 0 and an x or y offset ≥ ${p.minOffsetPx}px.` }],
  }),
  'shadow-layers': rule({
    id: 'shadow-layers',
    name: (p) => t(`More than ${p.maxLayers} shadow layers`, `그림자 층 ${p.maxLayers}개 초과`, `影のレイヤーが${p.maxLayers}を超える`),
    fix: (p) => t(
      `Use at most ${p.maxLayers} outset shadow layers per surface.`,
      `표면 하나에 바깥 그림자 층을 ${p.maxLayers}개까지만 쓰세요.`,
      `一つの面に外側の影レイヤーは${p.maxLayers}つまでにしてください。`,
    ),
    criteria: (p) => [{ id: 'too-many-layers', text: `An element's box-shadow has more than ${p.maxLayers} non-inset layers.` }],
  }),
  'gradient-fill': rule({
    id: 'gradient-fill',
    name: (p) => (p.scope === 'cards'
      ? t('A gradient behind every card', '카드마다 깔린 그라디언트', 'カードごとのグラデーション')
      : p.scope === 'text'
        ? t('Gradient-filled text', '그라디언트로 채운 글자', 'グラデーションで塗った文字')
        : t('Decorative gradient fills', '장식용 그라디언트 채우기', '装飾的なグラデーション塗り')),
    fix: (p) => (p.scope === 'cards'
      ? t(
        'Keep repeated cards on solid surfaces; let at most one field carry the gradient.',
        '반복되는 카드는 단색 면에 두세요. 그라디언트는 한 영역에만 쓰세요.',
        '繰り返すカードは単色の面に置き、グラデーションは一つの領域だけにしてください。',
      )
      : p.scope === 'text'
        ? t('Set text in a solid color.', '글자는 단색으로 쓰세요.', '文字は単色にしてください。')
        : t(
          'Use flat fills; keep gradients out of sections, cards, buttons, and decorative shapes.',
          '단색 면을 쓰세요. 섹션·카드·버튼·장식 도형에 그라디언트를 쓰지 마세요.',
          '単色の面を使い、セクション・カード・ボタン・装飾図形にグラデーションを使わないでください。',
        )),
    criteria: (p) => [p.scope === 'cards'
      ? { id: 'gradient-cards', text: `≥ ${T.cardsMin} sibling cards each have their own gradient background.` }
      : p.scope === 'text'
        ? { id: 'gradient-text', text: 'Text is filled with a gradient: background-clip text over a gradient background.' }
        : { id: 'gradient-surface', text: 'A section, card, button, or decorative shape (not an image) has a linear, radial, or conic gradient in background or background-image, or text is filled with a gradient.' }],
  }),
  'backdrop-blur': rule({
    id: 'backdrop-blur',
    name: (p) => (p.maxBlurPx === 0
      ? t('Frosted-glass panels', '젖빛 유리 패널', 'すりガラスのパネル')
      : t(`Glass blur above ${p.maxBlurPx}px`, `${p.maxBlurPx}px를 넘는 유리 흐림`, `${p.maxBlurPx}pxを超えるガラスのぼかし`)),
    fix: (p) => (p.maxBlurPx === 0
      ? t('Use opaque surfaces; this style does not use glass blur.', '불투명한 면을 쓰세요. 이 스타일은 유리 흐림을 쓰지 않습니다.', '不透明な面を使ってください。このスタイルはガラスのぼかしを使いません。')
      : t(
        `Keep backdrop blur at ${p.maxBlurPx}px or less.`,
        `배경 흐림을 ${p.maxBlurPx}px 이하로 두세요.`,
        `背景のぼかしを${p.maxBlurPx}px以下にしてください。`,
      )),
    criteria: (p) => [{ id: 'backdrop-blur', text: `An element has backdrop-filter blur > ${p.maxBlurPx}px.` }],
  }),
  glow: rule({
    id: 'glow',
    name: (p) => (p.target === 'text'
      ? t('Glowing text', '빛나는 글자', '光る文字')
      : t(`Glow on more than ${p.maxElements} element(s)`, `빛 효과가 있는 요소 ${p.maxElements}개 초과`, `光彩のある要素が${p.maxElements}個を超える`)),
    fix: (p) => (p.target === 'text'
      ? t('Remove the glow from text; keep copy crisp.', '글자에서 빛 효과를 빼고 선명하게 두세요.', '文字から光彩を外し、くっきりさせてください。')
      : t(
        `Limit glow to ${p.maxElements} signal element(s), and never put it on body copy.`,
        `빛 효과는 신호 요소 ${p.maxElements}개에만 쓰고, 본문에는 쓰지 마세요.`,
        `光彩は信号要素${p.maxElements}個までにし、本文には使わないでください。`,
      )),
    criteria: (p) => [{
      id: 'glow',
      text: `Glow is a text-shadow layer, or a box-shadow layer (inset or outset, on the element or its ::before/::after), with blur ≥ ${T.glowMinBlurPx}px, offsets ≤ ${T.glowMaxOffsetPx}px, and a saturated color. Flagged when ${p.target === 'text' ? 'any text-bearing element glows' : `more than ${p.maxElements} element(s) glow`}.`,
    }],
  }),
  'centered-copy': rule({
    id: 'centered-copy',
    name: () => t('Centered paragraphs', '가운데 정렬 문단', '中央揃えの段落'),
    fix: () => t(
      'Left-align running text and hold the grid alignment.',
      '본문은 왼쪽 정렬하고 그리드 정렬을 지키세요.',
      '本文は左揃えにし、グリッドの揃えを守ってください。',
    ),
    criteria: (p) => [{ id: 'centered-paragraph', text: `A paragraph of ≥ ${p.minWords} words is center-aligned.` }],
  }),
  'unguarded-motion': rule({
    id: 'unguarded-motion',
    name: () => t('Motion without a reduced-motion fallback', '동작 줄이기 대안이 없는 움직임', '動きを減らす設定への代替がない動き'),
    fix: () => t(
      'Declare the animation inside @media (prefers-reduced-motion: no-preference), or stop it under prefers-reduced-motion: reduce.',
      '애니메이션을 @media (prefers-reduced-motion: no-preference) 안에 선언하거나, prefers-reduced-motion: reduce에서 멈추세요.',
      'アニメーションを@media (prefers-reduced-motion: no-preference)の中で宣言するか、prefers-reduced-motion: reduceで止めてください。',
    ),
    criteria: (p) => [{
      id: 'unguarded-animation',
      text: `An element runs ${p.includeFinite ? 'an animation' : 'an infinite animation'}, no rule stops it under prefers-reduced-motion: reduce, and it is not declared only for no-preference (for example Tailwind motion-safe:).`,
    }],
  }),
  'eased-motion': rule({
    id: 'eased-motion',
    name: () => t('Smooth eased transitions', '부드럽게 이어지는 전환', 'なめらかなトランジション'),
    fix: () => t(
      'Make state changes instant or stepped with steps(), as this style snaps.',
      '상태 변화를 즉시 바꾸거나 steps()로 끊어서 바꾸세요. 이 스타일은 딱딱 끊어집니다.',
      '状態の変化は即時にするか、steps()で段階的にしてください。このスタイルはパッと切り替わります。',
    ),
    criteria: (p) => [{ id: 'eased-transition', text: `An element has a transition longer than ${p.maxDurationMs}ms that is not timed with steps(), step-start, or step-end, or an animation timed with a curve other than those.` }],
  }),
  'accent-hues': rule({
    id: 'accent-hues',
    name: (p) => (p.min !== undefined
      ? t(`Fewer than ${p.min} accent hues`, `강조 색조 ${p.min}개 미만`, `アクセントの色相が${p.min}未満`)
      : p.max === 0
        ? t('Any accent hue', '강조 색조 사용', 'アクセント色相の使用')
        : t(`More than ${p.max} accent hue(s)`, `강조 색조 ${p.max}개 초과`, `アクセントの色相が${p.max}を超える`)),
    fix: (p) => (p.min !== undefined
      ? t(
        `Use at least ${p.min} saturated hues as color blocks; this style is not monochrome.`,
        `채도 높은 색조를 색 면으로 ${p.min}개 이상 쓰세요. 이 스타일은 단색이 아닙니다.`,
        `彩度の高い色相を色面として${p.min}つ以上使ってください。このスタイルは単色ではありません。`,
      )
      : p.max === 0
        ? t(
          'Stay in neutrals; carry emphasis with weight, size, and space.',
          '무채색만 쓰세요. 강조는 굵기·크기·여백으로 하세요.',
          '無彩色だけを使い、強調は太さ・大きさ・余白で行ってください。',
        )
        : t(
          `Use at most ${p.max} accent hue(s) and keep everything else neutral.`,
          `강조 색조는 ${p.max}개까지만 쓰고 나머지는 무채색으로 두세요.`,
          `アクセントの色相は${p.max}つまでにし、ほかは無彩色にしてください。`,
        )),
    criteria: (p) => [{
      id: 'hue-families',
      text: `Saturated colors (saturation ≥ ${p.minSaturation}, lightness ${T.saturatedMinLightness}–${T.saturatedMaxLightness}) in text, background, border, gradient, and shadow declarations are grouped into 30° hue families; flagged when there are ${p.min !== undefined ? `fewer than ${p.min}` : `more than ${p.max}`} families.${p.min !== undefined ? '' : ' Colors within a small distance of the style’s own status colors (positive, caution, critical, info) are not counted.'}`,
    }],
  }),
  canvas: rule({
    id: 'canvas',
    name: (p) => ({
      'pure-white': t('Pure white canvas', '순백색 바탕', '純白の地'),
      light: t('Light canvas', '밝은 바탕', '明るい地'),
      dark: t('Dark canvas or sections', '어두운 바탕이나 섹션', '暗い地やセクション'),
      tinted: t('Tinted canvas', '색이 섞인 바탕', '色味のある地'),
    })[p.forbid],
    fix: (p) => ({
      'pure-white': t('Use the style’s warm paper tone instead of #ffffff.', '#ffffff 대신 이 스타일의 따뜻한 종이색을 쓰세요.', '#ffffffではなく、このスタイルの温かい紙の色を使ってください。'),
      light: t('Keep the canvas dark, as the style is authored.', '이 스타일대로 바탕을 어둡게 두세요.', 'スタイルの設計どおり、地を暗くしてください。'),
      dark: t('Keep the canvas and sections light; dark bands break this style.', '바탕과 섹션을 밝게 두세요. 어두운 띠는 이 스타일을 깨뜨립니다.', '地とセクションを明るくしてください。暗い帯はこのスタイルを壊します。'),
      tinted: t('Use pure white (#ffffff) as the canvas.', '바탕은 순백색(#ffffff)을 쓰세요.', '地には純白(#ffffff)を使ってください。'),
    })[p.forbid],
    criteria: (p) => [{
      id: 'canvas-tone',
      text: `The canvas is the nearest background fill from the content root (main, or the wrapper that holds the sections) up to html, or the browser's white when nothing is painted${p.forbid === 'dark' || p.forbid === 'light' ? ', plus any section with its own fill' : ''}. Flagged when it is ${({ 'pure-white': 'pure white (#fff)', light: 'light (lightness ≥ 0.6)', dark: 'dark (lightness ≤ 0.35)', tinted: 'anything but pure white' })[p.forbid]}.`,
    }],
  }),
  'text-on-effect': rule({
    id: 'text-on-effect',
    name: (p) => (p.surface === 'glass'
      ? t('Body copy on glass', '유리 위의 본문', 'ガラスの上の本文')
      : t('Body copy on a gradient', '그라디언트 위의 본문', 'グラデーションの上の本文')),
    fix: (p) => (p.surface === 'glass'
      ? t('Move long text onto an opaque surface and keep glass for chrome.', '긴 글은 불투명한 면으로 옮기고, 유리는 화면 틀에만 쓰세요.', '長い文章は不透明な面に移し、ガラスは画面の枠だけに使ってください。')
      : t('Put running text on a solid island; keep the gradient behind it, not under the words.', '본문은 단색 섬 위에 두세요. 그라디언트는 글자 밑이 아니라 그 뒤에 두세요.', '本文は単色の島の上に置き、グラデーションは文字の下ではなく背後に置いてください。')),
    criteria: (p) => [{
      id: p.surface === 'glass' ? 'text-on-glass' : 'text-on-gradient',
      text: `A text block of ≥ ${p.minWords} words whose nearest ancestor that paints a background (itself included) ${p.surface === 'glass' ? 'has a backdrop-filter blur with a translucent fill' : 'has a gradient or image background'}, with no solid fill in between.`,
    }],
  }),
  'nested-surfaces': rule({
    id: 'nested-surfaces',
    name: (p) => (p.kind === 'glass'
      ? t('Glass inside glass', '유리 안의 유리', 'ガラスの中のガラス')
      : t('Cards inside cards', '카드 안의 카드', 'カードの中のカード')),
    fix: (p) => (p.kind === 'glass'
      ? t('Keep one frosted layer and set inner content on solid fills.', '젖빛 층은 하나만 두고, 안쪽 내용은 단색 면에 두세요.', 'すりガラスの層は一つにし、内側の内容は単色の面に置いてください。')
      : t('Use one surface level per section; group with spacing or rules.', '섹션마다 표면은 한 단계만 쓰고, 묶음은 여백이나 선으로 나누세요.', 'セクションごとに面は一段階にし、まとまりは余白や罫線で分けてください。')),
    criteria: (p) => [p.kind === 'glass'
      ? { id: 'nested-glass', text: 'An element with backdrop-filter blur contains another element with backdrop-filter blur.' }
      : { id: 'nested-card', text: 'A card (a container with text plus a border on three or more sides, a shadow, or a fill different from its parent, and corner radius ≥ 4px; page sections are not cards) contains another card.' }],
  }),
  'icon-tiles': rule({
    id: 'icon-tiles',
    name: () => t('Icon tiles', '아이콘 타일', 'アイコンタイル'),
    fix: () => t(
      'Remove decorative icon tiles; let type, numerals, or rules carry the hierarchy.',
      '장식용 아이콘 타일을 빼세요. 위계는 글자·숫자·선으로 만드세요.',
      '装飾的なアイコンタイルを外し、階層は文字・数字・罫線で作ってください。',
    ),
    criteria: (p) => [{
      id: 'icon-tile',
      text: `More than ${p.maxTiles} icon tile(s): an icon inside a box of ${T.iconTileMaxPx}px or less with its own fill or border.`,
    }],
  }),
  'faint-borders': rule({
    id: 'faint-borders',
    name: (p) => t(`Borders fainter than ${percent(p.minAlpha)}`, `${percent(p.minAlpha)}보다 흐린 테두리`, `${percent(p.minAlpha)}より薄い枠線`),
    fix: (p) => t(
      `Raise border opacity to at least ${percent(p.minAlpha)} so the structure stays visible.`,
      `구조가 보이도록 테두리 불투명도를 ${percent(p.minAlpha)} 이상으로 올리세요.`,
      `構造が見えるよう、枠線の不透明度を${percent(p.minAlpha)}以上にしてください。`,
    ),
    criteria: (p) => [{ id: 'faint-border', text: `A visible border on any side has a color alpha below ${p.minAlpha} (rgba, hsla, #rrggbbaa, or a Tailwind /opacity modifier); a fully transparent border reserved for a state change is not visible and does not count. A color-mix() is read by the colour it mixes, so Tailwind v4's \`border-white/10\` is a 10% border.` }],
  }),
  typeface: rule({
    id: 'typeface',
    name: (p) => {
      const role = p.role === 'display' ? t('display', '제목', '見出し') : t('body', '본문', '本文');
      if (p.require) {
        const face = FACE[p.require];
        return t(`${role.en === 'display' ? 'Display' : 'Body'} face that is not ${face.en}`, `${face.ko}가 아닌 ${role.ko} 글꼴`, `${face.ja}ではない${role.ja}書体`);
      }
      const banned = bannedFaces(p);
      return t(`${banned.en} ${role.en} face`, `${banned.ko} ${role.ko} 글꼴`, `${banned.ja}の${role.ja}書体`);
    },
    fix: (p) => {
      const role = p.role === 'display' ? 'display' : 'body';
      if (p.require) {
        const face = FACE[p.require];
        return t(`Set the ${role} role in a ${face.en} face.`, `${p.role === 'display' ? '제목' : '본문'}에는 ${face.ko} 글꼴을 쓰세요.`, `${p.role === 'display' ? '見出し' : '本文'}には${face.ja}書体を使ってください。`);
      }
      const banned = bannedFaces(p);
      return t(`Replace the ${banned.en} ${role} face with the style's authored family.`, `${p.role === 'display' ? '제목' : '본문'}의 ${banned.ko} 글꼴을 이 스타일이 정한 글꼴로 바꾸세요.`, `${p.role === 'display' ? '見出し' : '本文'}の${banned.ja}書体を、このスタイルが定めた書体に替えてください。`);
    },
    criteria: (p) => [{
      id: 'typeface',
      text: `The ${p.role === 'display' ? 'h1 and h2' : 'p and li'} text resolves to a font-family stack classified as ${p.require ? `something other than ${p.require}` : list([...(p.forbid ?? []), ...(p.forbidFamilies ?? [])])}: the first family in the stack that is a known family or a generic keyword decides, so an unknown web font falls back to the stack's generic family.`,
    }],
  }),
  imagery: rule({
    id: 'imagery',
    name: (p) => t(
      `Pictorial ornament: ${list(p.forbid)}`,
      `그림 장식: ${list(p.forbid.map((kind) => IMAGERY[kind].ko))}`,
      `絵の装飾: ${list(p.forbid.map((kind) => IMAGERY[kind].ja))}`,
    ),
    fix: () => t(
      'Remove pictorial ornament; this style is carried by type and structure.',
      '그림 장식을 빼세요. 이 스타일은 글자와 구조로 표현합니다.',
      '絵の装飾を外してください。このスタイルは文字と構造で表現します。',
    ),
    criteria: (p) => p.forbid.map((kind) => ({
      illustration: { id: 'illustration', text: `A decorative inline SVG of ≥ ${T.illustrationMinPx}px or with ≥ 12 shapes, or a decorative image named illustration, art, blob, or hero-art.` },
      photo: { id: 'photo', text: `An img or picture larger than ${T.photoMinPx}px whose source is a raster photo (.jpg, .jpeg, .webp, .avif) or a stock host.` },
      emoji: { id: 'emoji', text: 'An emoji used as a heading or card ornament.' },
    })[kind]),
  }),
  'crowded-grid': rule({
    id: 'crowded-grid',
    name: (p) => t(`Grids with more than ${p.maxColumns} columns`, `${p.maxColumns}열을 넘는 그리드`, `${p.maxColumns}列を超えるグリッド`),
    fix: (p) => t(
      `Keep sections to ${p.maxColumns} column(s) with generous space between items.`,
      `섹션은 ${p.maxColumns}열 이하로 두고 항목 사이 여백을 넉넉히 두세요.`,
      `セクションは${p.maxColumns}列以下にし、項目の間に十分な余白を取ってください。`,
    ),
    criteria: (p) => [{ id: 'crowded-grid', text: `A grid container declares more than ${p.maxColumns} columns and places more than ${p.maxColumns} items side by side in one row, counting each item's column span.` }],
  }),
};

export function styleRuleText<R extends StyleRuleId>(id: R, params: StyleRuleParams[R]) {
  const def = STYLE_RULES[id] as StyleRuleDef<R>;
  return { name: def.name(params), fix: def.fix(params), criteria: def.criteria(params) };
}
