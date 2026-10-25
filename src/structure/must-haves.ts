import { text } from '../localization.js';
import type { FacetSource } from '../recommendation/types.js';
import type { Lang, LocalizedText, ProductType } from '../types.js';
import type { CriterionDef, StructureJob } from './types.js';

export const MUST_HAVE_SCHEMA = 'webstylebook.must-haves.v1';
export const MUST_HAVE_RESOURCE_URI = 'webstylebook://structure/must-haves';

export const MUST_HAVE_ZONES = ['first-screen', 'page'] as const;
/** Where a must-have has to appear: before the first scroll, or anywhere on the page. */
export type MustHaveZone = (typeof MUST_HAVE_ZONES)[number];

export const MUST_HAVE_IDS = [
  'price', 'variant-choice', 'add-to-cart', 'purchase-assurance',
  'current-status', 'recent-changes', 'time-range',
  'search', 'quickstart', 'topic-index',
  'code-sample', 'docs-link',
  'primary-cta', 'proof',
  'composer', 'ai-limits',
  'author', 'publish-date',
  'work-samples', 'contact', 'privacy-notice',
] as const;
export type MustHaveId = (typeof MUST_HAVE_IDS)[number];

/** Thresholds the first-screen zone and the detectors read; the criteria text quotes the same numbers. */
export const MH = {
  shortSectionMaxWords: 40,
  followingSections: 2,
  fillsViewportVh: 80,
  fillsViewportPx: 720,
  priceMaxWords: 6,
  statusMaxWords: 4,
  metricMaxWords: 3,
  textMaxWords: 40,
  topicLinksMin: 4,
  workItemsMin: 3,
} as const;

export interface MustHaveDef {
  id: MustHaveId;
  /** The structure job it does, so a style's signature move for that job can present it. */
  job: StructureJob;
  /** content: the opening and the content sections only; page: the site header, navigation, and footer count too. */
  searchIn: 'content' | 'page';
  name: LocalizedText;
  build: LocalizedText;
  criteria: CriterionDef[];
}

export interface ProductMustHaveDef {
  productType: Exclude<ProductType, 'other'>;
  /** The page the list is written for. */
  page: LocalizedText;
  items: Array<{ id: MustHaveId; zone: MustHaveZone; why: LocalizedText }>;
}

const t = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

const PERCEIVABLE = 'Rendered (not display:none or hidden), not visually hidden (sr-only clip or moved off-screen), and not inside aria-hidden="true".';

export const MUST_HAVES: readonly MustHaveDef[] = [
  {
    id: 'price',
    job: 'action',
    searchIn: 'content',
    name: t('Price', '가격', '価格'),
    build: t(
      'Show the price with its currency next to the product name; when sizes differ in price, show the price of the selected size.',
      '상품명 옆에 통화와 함께 가격을 보여 주세요. 용량마다 가격이 다르면 고른 용량의 가격을 보여 주세요.',
      '商品名の横に通貨付きで価格を表示します。サイズで価格が変わる場合は、選択中のサイズの価格を表示します。',
    ),
    criteria: [{ id: 'currency-amount', text: `An element of ≤ ${MH.priceMaxWords} words, outside pre and code, whose text is a currency amount ($48, €39,90, 48,000원, ¥4,800, 4,800円, USD 48, 48 kr), or an element with itemprop="price". ${PERCEIVABLE}` }],
  },
  {
    id: 'variant-choice',
    job: 'action',
    searchIn: 'content',
    name: t('Variant choice', '옵션 선택', 'バリエーションの選択'),
    build: t(
      'Let shoppers pick size, shade, or quantity with a native select, a radio group, or a number input, or with the matching ARIA roles.',
      '용량·색상·수량을 기본 select, 라디오 그룹, 숫자 입력란이나 같은 역할의 ARIA role로 고르게 하세요.',
      'サイズ・色・数量を、ネイティブのselect、ラジオグループ、数値入力、または対応するARIAロールで選べるようにします。',
    ),
    criteria: [{ id: 'choice-control', text: `A select, a radio or number input, an element with role radio, radiogroup, listbox, option, or spinbutton, or a control with aria-pressed or aria-checked, outside navigation and search. Links styled as swatches do not count. ${PERCEIVABLE}` }],
  },
  {
    id: 'add-to-cart',
    job: 'action',
    searchIn: 'content',
    name: t('Add to cart', '장바구니 담기', 'カートに追加'),
    build: t(
      'Put an add-to-cart or buy button, labelled with that action, beside the price and options.',
      '가격과 옵션 옆에 "장바구니 담기"나 "구매하기"처럼 동작을 적은 버튼을 두세요.',
      '価格とオプションの横に、「カートに入れる」「購入する」など動作を書いたボタンを置きます。',
    ),
    criteria: [{ id: 'buy-action', text: `A button, a link with href, or a submit input of 1-8 words outside navigation whose text, aria-label, or value says add to cart/bag/basket, buy, purchase, order, pre-order, checkout, or reserve (장바구니, 구매, 주문, 결제; カート, 購入, 注文). ${PERCEIVABLE}` }],
  },
  {
    id: 'purchase-assurance',
    job: 'proof',
    searchIn: 'content',
    name: t('Delivery and guarantee details', '배송·보증 안내', '配送と保証の案内'),
    build: t(
      'State delivery time or cost, returns, and any guarantee in plain text next to the buy button.',
      '배송 시간이나 비용, 반품, 보증 내용을 구매 버튼 옆에 글로 적으세요.',
      'お届け日数や送料、返品、保証の内容を、購入ボタンの横に文章で書きます。',
    ),
    criteria: [{ id: 'assurance-text', text: `An element of ≤ ${MH.textMaxWords} words in the content (not the site header or footer) that mentions shipping, delivery, dispatch, returns, refunds, exchanges, a guarantee or warranty, or secure checkout (배송, 반품, 환불, 교환, 보증; 送料, 配送, お届け, 返品, 返金, 保証). ${PERCEIVABLE}` }],
  },
  {
    id: 'current-status',
    job: 'opening',
    searchIn: 'content',
    name: t('Current status', '현재 상태', '現在の状態'),
    build: t(
      'Lead with the state right now: status labels, health indicators, or key metric values with their labels.',
      '지금의 상태를 먼저 보여 주세요. 상태 라벨, 건강 지표, 라벨이 붙은 핵심 지표 값이 해당합니다.',
      'いまの状態を最初に示します。状態ラベル、ヘルス指標、ラベル付きの主要指標の値が該当します。',
    ),
    criteria: [{ id: 'status-signal', text: `In the content: role status (with text), meter, or progressbar; a meter or progress element; an element of ≤ ${MH.statusMaxWords} words that names a state (operational, healthy, degraded, outage, online, offline, running, paused, failed, passing, error, warning, critical, on track, at risk, blocked, overdue, pending, in progress, resolved; 정상, 장애, 경고, 진행 중, 완료, 실패, 지연; 正常, 障害, 警告, 進行中, 完了, 失敗, 遅延); or a metric value of ≤ ${MH.metricMaxWords} words (a number with an optional sign, currency, or unit) whose parent or grandparent also holds a label. ${PERCEIVABLE}` }],
  },
  {
    id: 'recent-changes',
    job: 'orientation',
    searchIn: 'content',
    name: t('What changed', '변경 사항', '変更点'),
    build: t(
      'Show what changed: deltas against a stated comparison period, recent events with relative times, or an activity list.',
      '무엇이 바뀌었는지 보여 주세요. 비교 기간 대비 증감, 상대 시간이 붙은 최근 이벤트, 활동 목록이 해당합니다.',
      '何が変わったかを示します。比較期間に対する増減、相対時刻付きの最近のイベント、アクティビティ一覧が該当します。',
    ),
    criteria: [{ id: 'change-signal', text: `In the content: a signed change (+12%, −3, ▲ 4, ↓ 2.1%); a comparison (vs, compared to, since last, week over week, YoY; 대비, 증가, 감소; 前日比, 前月比, 増加, 減少); a relative time (5 min ago, just now, yesterday; 5분 전, 방금, 어제; 5分前, たった今, 昨日); a heading that names changes, activity, updates, history, events, or alerts; or a time element inside a list item, table row, or article. ${PERCEIVABLE}` }],
  },
  {
    id: 'time-range',
    job: 'orientation',
    searchIn: 'content',
    name: t('Time range', '기간', '期間'),
    build: t(
      'State the period the figures cover, such as "Last 7 days", and let people change it.',
      '"최근 7일"처럼 수치가 다루는 기간을 적고, 바꿀 수 있게 하세요.',
      '「過去7日間」のように数値の対象期間を示し、変更できるようにします。',
    ),
    criteria: [{ id: 'period', text: `In the content: a date, month, week, or datetime-local input, or an element of ≤ 12 words naming a period (last 7 days, past month, today, this quarter, year to date, YTD, Q3, 30d, Jan 1 – Jan 31, 2026-01-01 – 2026-01-31; 최근 7일, 지난달, 이번 주, 올해; 過去7日間, 今月, 今年). ${PERCEIVABLE}` }],
  },
  {
    id: 'search',
    job: 'orientation',
    searchIn: 'page',
    name: t('Search', '검색', '検索'),
    build: t(
      'Put a search field (input type=search, or a search landmark) or a labelled search button in the header or the opening.',
      '헤더나 첫 섹션에 검색 입력란(input type=search 또는 search 랜드마크)이나 라벨이 붙은 검색 버튼을 두세요.',
      'ヘッダーか冒頭に、検索欄(input type=search または search ランドマーク)かラベル付きの検索ボタンを置きます。',
    ),
    criteria: [{ id: 'search-control', text: `Anywhere on the page: an input of type search; a search element or role search or searchbox; an input whose placeholder, aria-label, name, or id says search or query (검색, 検索); or a button or link whose text or aria-label says search. ${PERCEIVABLE}` }],
  },
  {
    id: 'quickstart',
    job: 'action',
    searchIn: 'page',
    name: t('Quickstart', '빠른 시작', 'クイックスタート'),
    build: t(
      'Link to a quickstart, getting-started, or installation guide from the first screen.',
      '첫 화면에서 빠른 시작, 시작하기, 설치 안내로 가는 링크를 두세요.',
      'ファーストビューから、クイックスタート、はじめに、インストール手順へのリンクを置きます。',
    ),
    criteria: [{ id: 'quickstart-entry', text: `Anywhere on the page: a link with href or a heading whose text says quickstart, get started, getting started, start here, install, installation, set up, first steps, tutorial, or hello world (빠른 시작, 시작하기, 설치, 튜토리얼; クイックスタート, はじめに, インストール, チュートリアル, 入門). ${PERCEIVABLE}` }],
  },
  {
    id: 'topic-index',
    job: 'orientation',
    searchIn: 'content',
    name: t('Topic index', '주제별 목록', 'トピック一覧'),
    build: t(
      `List the main topics or categories as at least ${MH.topicLinksMin} links so people can browse without searching.`,
      `주요 주제나 분류를 링크 ${MH.topicLinksMin}개 이상으로 나열해 검색하지 않고도 둘러보게 하세요.`,
      `主なトピックやカテゴリを${MH.topicLinksMin}件以上のリンクで並べ、検索せずに見て回れるようにします。`,
    ),
    criteria: [{ id: 'topic-links', text: `In the content: one container whose rendered children include ≥ ${MH.topicLinksMin} items that are or hold a link with href of ≤ 10 words, and links make up at least three quarters of those children. ${PERCEIVABLE}` }],
  },
  {
    id: 'code-sample',
    job: 'opening',
    searchIn: 'content',
    name: t('Code sample', '코드 예시', 'コード例'),
    build: t(
      'Show a real code snippet or install command in a pre or code element.',
      '실제 코드 조각이나 설치 명령을 pre나 code 요소에 보여 주세요.',
      '実際のコード片かインストールコマンドを、preかcode要素で表示します。',
    ),
    criteria: [{ id: 'code-element', text: `In the content: a pre element with text, or a code or samp element of ≥ 2 words. ${PERCEIVABLE}` }],
  },
  {
    id: 'docs-link',
    job: 'orientation',
    searchIn: 'page',
    name: t('Documentation link', '문서 링크', 'ドキュメントへのリンク'),
    build: t(
      'Link to the documentation or API reference from the header or the opening.',
      '헤더나 첫 섹션에서 문서나 API 레퍼런스로 가는 링크를 두세요.',
      'ヘッダーか冒頭から、ドキュメントかAPIリファレンスへのリンクを置きます。',
    ),
    criteria: [{ id: 'docs-href', text: `Anywhere on the page: a link with href whose text or aria-label says docs, documentation, API, reference, guide, or manual (문서, 가이드, 레퍼런스; ドキュメント, ガイド, リファレンス), or whose href path starts a docs, documentation, reference, or api segment or whose host starts with docs. ${PERCEIVABLE}` }],
  },
  {
    id: 'primary-cta',
    job: 'action',
    searchIn: 'content',
    name: t('Primary action', '주요 행동', '主要なアクション'),
    build: t(
      'Give the one action the page exists for a button or link in the opening.',
      '페이지가 존재하는 이유인 행동 하나를 첫 섹션의 버튼이나 링크로 두세요.',
      'ページの目的であるアクションを一つ、冒頭のボタンかリンクにします。',
    ),
    criteria: [{ id: 'call-to-action', text: `In the content: a button, a link with an href other than "" or "#", or a submit input, of 1-8 words and outside navigation. ${PERCEIVABLE}` }],
  },
  {
    id: 'proof',
    job: 'proof',
    searchIn: 'content',
    name: t('Proof', '근거', '根拠'),
    build: t(
      'Back the main claim with evidence a visitor can check: a quoted review, a rating, a named result, or a case study.',
      '방문자가 확인할 수 있는 근거로 핵심 주장을 받치세요. 인용한 후기, 평점, 이름이 붙은 성과, 사례가 해당합니다.',
      '訪問者が確かめられる根拠で主張を裏付けます。引用したレビュー、評価、名前の付いた成果、導入事例が該当します。',
    ),
    criteria: [{ id: 'evidence', text: `In the content: a blockquote or q of ≥ 4 words, a quoted figure with a figcaption, an element with itemprop review, reviewRating, or aggregateRating, a rating (4.8/5, 4.8 out of 5, 5 stars, ★★★★★; 평점, 별점; 評価), a heading or link naming a case study or customer story (사례, 후기; 導入事例, お客様の声), a popularity claim, or a logo strip, "trusted by" band, or testimonial carousel. The last three still count as banned patterns; replace them with the style's proof move. ${PERCEIVABLE}` }],
  },
  {
    id: 'composer',
    job: 'action',
    searchIn: 'content',
    name: t('Message input', '메시지 입력창', 'メッセージ入力欄'),
    build: t(
      'Show the message input (a textarea or role=textbox) with its send action, ready to type in.',
      '보내기 동작이 붙은 메시지 입력창(textarea 또는 role=textbox)을 바로 쓸 수 있게 보여 주세요.',
      '送信操作付きのメッセージ入力欄(textarea または role=textbox)を、すぐ入力できる状態で表示します。',
    ),
    criteria: [{ id: 'message-field', text: `In the content and outside search: a textarea, a contenteditable element, an element with role textbox, or a text input whose placeholder or aria-label asks for a message, question, or prompt (메시지, 질문, 입력; メッセージ, 質問, 入力). ${PERCEIVABLE}` }],
  },
  {
    id: 'ai-limits',
    job: 'orientation',
    searchIn: 'page',
    name: t('AI limits note', 'AI 한계 안내', 'AIの限界の案内'),
    build: t(
      'Tell people in plain text that answers can be wrong and what they should verify.',
      '답이 틀릴 수 있다는 점과 무엇을 확인해야 하는지 글로 알려 주세요.',
      '回答が間違う可能性と、何を確かめるべきかを文章で伝えます。',
    ),
    criteria: [{ id: 'limits-text', text: `Anywhere on the page: an element of ≤ ${MH.textMaxWords} words saying answers can or may make mistakes or be wrong, inaccurate, or incorrect, asking to check or verify important information, saying it is not medical, legal, or financial advice, or labelling content as AI-generated (실수할 수 있, 부정확할 수 있, 확인하세요; 間違える, 不正確, 確認してください). ${PERCEIVABLE}` }],
  },
  {
    id: 'author',
    job: 'proof',
    searchIn: 'content',
    name: t('Author', '작성자', '著者'),
    build: t(
      'Name the author near the headline, with rel=author, itemprop=author, or a "By …" line.',
      '제목 가까이에 작성자를 적으세요. rel=author, itemprop=author, "글 …" 같은 줄이 해당합니다.',
      '見出しの近くに著者を書きます。rel=author、itemprop=author、「文:…」のような行が該当します。',
    ),
    criteria: [{ id: 'byline', text: `In the content: a link with rel author, an element with itemprop author, an element of ≤ 8 words that starts with "By" or "Written by" followed by a capitalized name (글, 작성자, 기자; 文, 著, 執筆, 記者), or an element of ≤ 8 words named byline or author. ${PERCEIVABLE}` }],
  },
  {
    id: 'publish-date',
    job: 'orientation',
    searchIn: 'content',
    name: t('Publication date', '발행일', '公開日'),
    build: t(
      'Show the publication or update date near the headline, ideally in a time element.',
      '제목 가까이에 발행일이나 수정일을 보여 주세요. time 요소를 쓰면 좋습니다.',
      '見出しの近くに公開日か更新日を表示します。time要素を使うのが望ましいです。',
    ),
    criteria: [{ id: 'date', text: `In the content: a time element with text, or an element of ≤ 10 words holding a date (March 4, 2026; 4 March 2026; March 2026; 2026-03-04; 2026년 3월 4일; 2026年3月4日). ${PERCEIVABLE}` }],
  },
  {
    id: 'work-samples',
    job: 'proof',
    searchIn: 'content',
    name: t('Work samples', '작업 예시', '作品例'),
    build: t(
      `Show at least ${MH.workItemsMin} pieces of work, as images or as a headed list of linked projects.`,
      `작업물을 ${MH.workItemsMin}개 이상 보여 주세요. 이미지나 제목이 붙은 프로젝트 링크 목록이 해당합니다.`,
      `作品を${MH.workItemsMin}点以上、画像か見出し付きのプロジェクトリンク一覧で示します。`,
    ),
    criteria: [{ id: 'work-items', text: `In the content: ≥ ${MH.workItemsMin} images, pictures, or videos that are not icons or decoration, or a heading that names work, projects, case studies, or portfolio (작업, 작품, 프로젝트; 作品, 実績, プロジェクト) whose section holds ≥ ${MH.workItemsMin} links with distinct hrefs or ≥ ${MH.workItemsMin} list items or articles. ${PERCEIVABLE}` }],
  },
  {
    id: 'contact',
    job: 'action',
    searchIn: 'page',
    name: t('Contact', '연락 방법', '連絡先'),
    build: t(
      'Give a direct way to reach a person: an email or phone link, a contact form, or a link to the contact page.',
      '사람에게 바로 닿는 방법을 주세요. 이메일이나 전화 링크, 문의 양식, 연락처 페이지 링크가 해당합니다.',
      '人に直接届く方法を示します。メールか電話のリンク、問い合わせフォーム、連絡先ページへのリンクが該当します。',
    ),
    criteria: [{ id: 'contact-route', text: `Anywhere on the page, footer included: a mailto: or tel: link, an address element, a form with an email input, or a button or link whose text says contact, get in touch, email me, hire me, book a call, say hello, call us, support, or help (문의, 연락, 상담; お問い合わせ, 連絡, 相談). ${PERCEIVABLE}` }],
  },
  {
    id: 'privacy-notice',
    job: 'proof',
    searchIn: 'page',
    name: t('Privacy notice', '개인정보 안내', 'プライバシーの案内'),
    build: t(
      'Say how personal data is protected, or link to the privacy policy.',
      '개인정보를 어떻게 보호하는지 적거나 개인정보 처리방침으로 링크하세요.',
      '個人情報をどう守るかを書くか、プライバシーポリシーへリンクします。',
    ),
    criteria: [{ id: 'privacy-text', text: `Anywhere on the page, footer included: an element of ≤ ${MH.textMaxWords} words mentioning privacy, HIPAA, GDPR, confidentiality, encryption, data protection, or personal or health information (개인정보, 암호화, 보안; プライバシー, 個人情報, 暗号化). ${PERCEIVABLE}` }],
  },
];

const DASHBOARD_PAGE = t('main dashboard', '메인 대시보드', 'メインダッシュボード');

export const PRODUCT_MUST_HAVES: readonly ProductMustHaveDef[] = [
  {
    productType: 'operational-saas',
    page: DASHBOARD_PAGE,
    items: [
      { id: 'current-status', zone: 'first-screen', why: t('People open a daily tool to learn whether things are fine; the state has to be the first thing they read.', '매일 쓰는 도구를 여는 이유는 문제가 없는지 알기 위해서입니다. 상태를 가장 먼저 읽을 수 있어야 합니다.', '毎日使うツールを開くのは問題がないか知るためです。状態を最初に読めなければなりません。') },
      { id: 'recent-changes', zone: 'first-screen', why: t('What changed since the last visit tells people where to act; without it every visit starts with a hunt.', '지난 방문 뒤 무엇이 바뀌었는지가 어디서 행동할지 알려 줍니다. 없으면 매번 찾는 일부터 시작합니다.', '前回から何が変わったかで、どこに手を打つかが分かります。ないと毎回探すところから始まります。') },
    ],
  },
  {
    productType: 'developer-tool',
    page: t('product landing page', '제품 랜딩 페이지', '製品のランディングページ'),
    items: [
      { id: 'code-sample', zone: 'first-screen', why: t('Developers judge a tool by its code; a real snippet or install command shows how it works faster than any claim.', '개발자는 코드로 도구를 판단합니다. 실제 코드나 설치 명령이 어떤 설명보다 빨리 작동 방식을 보여 줍니다.', '開発者はコードでツールを判断します。実際のコードやインストールコマンドは、どんな説明より早く仕組みを示します。') },
      { id: 'docs-link', zone: 'first-screen', why: t('Evaluators go straight to the documentation, so the link has to be visible without scrolling.', '평가하는 사람은 바로 문서로 갑니다. 링크가 스크롤 없이 보여야 합니다.', '評価する人はまずドキュメントを見ます。リンクはスクロールせずに見える必要があります。') },
    ],
  },
  {
    productType: 'documentation',
    page: t('docs home', '문서 홈', 'ドキュメントのトップ'),
    items: [
      { id: 'search', zone: 'first-screen', why: t('Most docs visits start with a specific question, and search is the shortest path to the answer.', '문서 방문은 대부분 구체적인 질문으로 시작합니다. 검색이 답으로 가는 가장 짧은 길입니다.', 'ドキュメントの訪問の多くは具体的な質問から始まります。検索が答えへの最短の道です。') },
      { id: 'quickstart', zone: 'first-screen', why: t('New users need one obvious path from nothing to a working result.', '처음 온 사용자에게는 아무것도 없는 상태에서 동작하는 결과까지 가는 분명한 길 하나가 필요합니다.', '初めての人には、何もない状態から動く結果まで進む分かりやすい道が一つ必要です。') },
    ],
  },
  {
    productType: 'data-analytics',
    page: t('analytics dashboard', '분석 대시보드', '分析ダッシュボード'),
    items: [
      { id: 'current-status', zone: 'first-screen', why: t('The headline metrics answer the question the dashboard exists for.', '핵심 지표가 대시보드가 존재하는 이유인 질문에 답합니다.', '主要指標が、このダッシュボードの目的である問いに答えます。') },
      { id: 'recent-changes', zone: 'first-screen', why: t('A number means little without its change against a comparison period.', '숫자는 비교 기간 대비 변화가 없으면 의미가 적습니다.', '数値は比較期間に対する変化がなければ意味が薄くなります。') },
      { id: 'time-range', zone: 'first-screen', why: t('Every figure depends on its period; readers have to see and change it before they can trust the numbers.', '모든 수치는 기간에 따라 달라집니다. 수치를 믿으려면 기간을 보고 바꿀 수 있어야 합니다.', 'すべての数値は期間に左右されます。数値を信頼するには期間を見て変えられる必要があります。') },
    ],
  },
  {
    productType: 'security-console',
    page: t('security overview', '보안 개요 화면', 'セキュリティの概要画面'),
    items: [
      { id: 'current-status', zone: 'first-screen', why: t('Analysts need the current posture and open alerts before anything else.', '분석가는 무엇보다 먼저 현재 보안 상태와 열린 경보를 알아야 합니다.', 'アナリストは何よりも先に、現在の状態と未対応のアラートを知る必要があります。') },
      { id: 'recent-changes', zone: 'first-screen', why: t('New alerts and changes since the last check decide what to triage first.', '지난 확인 뒤 새로 생긴 경보와 변경이 무엇부터 분류할지 정합니다.', '前回の確認以降の新しいアラートと変更が、何から対応するかを決めます。') },
    ],
  },
  {
    productType: 'finance-admin',
    page: t('finance overview', '재무 개요 화면', '財務の概要画面'),
    items: [
      { id: 'current-status', zone: 'first-screen', why: t('Balances, totals, and the state of pending items are what finance users check first.', '재무 사용자는 잔액, 합계, 대기 항목의 상태를 가장 먼저 확인합니다.', '財務の担当者は、残高、合計、保留中の項目の状態を最初に確認します。') },
      { id: 'recent-changes', zone: 'first-screen', why: t('Recent transactions and changes let people catch errors and fraud early.', '최근 거래와 변경을 보면 오류와 부정을 일찍 잡을 수 있습니다.', '最近の取引と変更を見れば、誤りや不正に早く気づけます。') },
    ],
  },
  {
    productType: 'healthcare-portal',
    page: t('portal home', '포털 홈', 'ポータルのトップ'),
    items: [
      { id: 'primary-cta', zone: 'first-screen', why: t('Patients come for one task, such as booking, signing in, or seeing results, and have to find it at once.', '환자는 예약, 로그인, 결과 확인 같은 일 하나를 하러 옵니다. 그 일을 바로 찾을 수 있어야 합니다.', '患者は予約、ログイン、結果の確認など一つの用事で来ます。それをすぐ見つけられる必要があります。') },
      { id: 'contact', zone: 'page', why: t('People need a way to reach a person when the portal cannot answer.', '포털이 답하지 못할 때 사람에게 닿는 방법이 필요합니다.', 'ポータルで答えが出ないとき、人に連絡する方法が必要です。') },
      { id: 'privacy-notice', zone: 'page', why: t('Health data is sensitive; people need to see how it is protected before they share it.', '건강 정보는 민감합니다. 정보를 내기 전에 어떻게 보호하는지 볼 수 있어야 합니다.', '健康情報は機微な情報です。提供する前に、どう守られるかを確認できる必要があります。') },
    ],
  },
  {
    productType: 'commerce',
    page: t('product detail page', '상품 상세 페이지', '商品詳細ページ'),
    items: [
      { id: 'price', zone: 'first-screen', why: t('Shoppers decide on price before they scroll; a price that is not visible reads as expensive or evasive.', '구매자는 스크롤하기 전에 가격으로 판단합니다. 가격이 보이지 않으면 비싸거나 숨긴다고 받아들입니다.', '購入者はスクロールする前に価格で判断します。価格が見えないと、高いか隠していると受け取られます。') },
      { id: 'variant-choice', zone: 'first-screen', why: t('Size, shade, or quantity changes the price and the fit, so shoppers have to choose it beside the buy button.', '용량·색상·수량은 가격과 맞음새를 바꿉니다. 구매 버튼 옆에서 고를 수 있어야 합니다.', 'サイズ・色・数量は価格と合うかどうかを変えます。購入ボタンの横で選べる必要があります。') },
      { id: 'add-to-cart', zone: 'first-screen', why: t('Buying is the job of this page, so the action has to be reachable without scrolling.', '이 페이지의 일은 구매입니다. 구매 동작은 스크롤 없이 닿아야 합니다.', 'このページの役割は購入です。購入の操作はスクロールせずに届く必要があります。') },
      { id: 'purchase-assurance', zone: 'first-screen', why: t('Delivery, returns, and guarantee details remove the last doubts at the moment of purchase.', '배송·반품·보증 안내가 구매하는 순간의 마지막 망설임을 없앱니다.', '配送・返品・保証の案内が、購入の瞬間の最後の迷いを取り除きます。') },
    ],
  },
  {
    productType: 'ai-chat',
    page: t('chat screen', '대화 화면', 'チャット画面'),
    items: [
      { id: 'composer', zone: 'first-screen', why: t('The input is the product; it has to be visible and ready on the first screen.', '입력창이 곧 제품입니다. 첫 화면에서 보이고 바로 쓸 수 있어야 합니다.', '入力欄こそが製品です。ファーストビューで見えて、すぐ使える必要があります。') },
      { id: 'ai-limits', zone: 'page', why: t('People need to know answers can be wrong so they verify what matters.', '답이 틀릴 수 있다는 것을 알아야 중요한 것을 확인합니다.', '回答が間違う可能性を知ってこそ、大事なことを確かめます。') },
    ],
  },
  {
    productType: 'content-editorial',
    page: t('article page', '기사 페이지', '記事ページ'),
    items: [
      { id: 'author', zone: 'first-screen', why: t('Readers judge credibility by who wrote the piece.', '독자는 누가 썼는지로 신뢰도를 판단합니다.', '読者は誰が書いたかで信頼性を判断します。') },
      { id: 'publish-date', zone: 'first-screen', why: t('The date tells readers whether the piece is still current.', '날짜를 보고 독자는 글이 아직 유효한지 판단합니다.', '日付を見て、読者は記事がまだ有効かを判断します。') },
    ],
  },
  {
    productType: 'knowledge-base',
    page: t('help center home', '도움말 센터 홈', 'ヘルプセンターのトップ'),
    items: [
      { id: 'search', zone: 'first-screen', why: t('People arrive with a problem in their own words; search has to be the first control they meet.', '사람들은 자기 말로 된 문제를 들고 옵니다. 검색이 처음 만나는 컨트롤이어야 합니다.', '人は自分の言葉で問題を抱えて来ます。検索が最初に出会う操作でなければなりません。') },
      { id: 'topic-index', zone: 'page', why: t('Browsing by topic helps people who do not know the words to search for.', '어떤 말로 검색할지 모르는 사람은 주제별 목록으로 찾습니다.', '検索する言葉が分からない人は、トピック一覧から探します。') },
    ],
  },
  {
    productType: 'portfolio',
    page: t('portfolio home', '포트폴리오 홈', 'ポートフォリオのトップ'),
    items: [
      { id: 'work-samples', zone: 'page', why: t('Visitors come to see the work; a portfolio without visible samples asks them to trust a claim.', '방문자는 작업을 보러 옵니다. 작업이 보이지 않는 포트폴리오는 주장만 믿으라고 하는 것입니다.', '訪問者は作品を見に来ます。作品が見えないポートフォリオは、主張だけを信じてくれと言っているのと同じです。') },
      { id: 'contact', zone: 'page', why: t('A portfolio exists to start a conversation, so visitors need a direct way to reach the owner.', '포트폴리오는 대화를 시작하려고 있습니다. 방문자가 주인에게 바로 연락할 방법이 필요합니다.', 'ポートフォリオは会話を始めるためにあります。訪問者が本人に直接連絡できる方法が必要です。') },
    ],
  },
  {
    productType: 'campaign',
    page: t('landing page', '랜딩 페이지', 'ランディングページ'),
    items: [
      { id: 'primary-cta', zone: 'first-screen', why: t('A campaign page exists to drive one action, so that action has to be visible before the first scroll.', '캠페인 페이지는 행동 하나를 이끌려고 있습니다. 그 행동은 첫 스크롤 전에 보여야 합니다.', 'キャンペーンページは一つの行動を促すためにあります。その行動は最初のスクロールの前に見える必要があります。') },
      { id: 'proof', zone: 'page', why: t('Visitors need evidence, such as results, reviews, or named customers, before they act on a claim.', '방문자는 주장에 따라 행동하기 전에 성과, 후기, 실명 고객 같은 근거가 필요합니다.', '訪問者は主張に従って行動する前に、成果、レビュー、実名の顧客などの根拠を必要とします。') },
    ],
  },
  {
    productType: 'consumer-app',
    page: t('app landing page', '앱 랜딩 페이지', 'アプリのランディングページ'),
    items: [
      { id: 'primary-cta', zone: 'first-screen', why: t('Visitors should be able to download the app or sign up from the first screen.', '방문자는 첫 화면에서 앱을 내려받거나 가입할 수 있어야 합니다.', '訪問者はファーストビューからアプリを入手するか登録できる必要があります。') },
      { id: 'proof', zone: 'page', why: t('Ratings, reviews, or user numbers show the app is worth installing.', '평점, 후기, 사용자 수가 앱을 설치할 가치가 있다는 것을 보여 줍니다.', '評価、レビュー、利用者数が、アプリを入れる価値があることを示します。') },
    ],
  },
];

export const ZONE_TEXT: Record<MustHaveZone, LocalizedText> = {
  'first-screen': t(
    'On the first screen: in the opening section or above it, before the first scroll.',
    '첫 화면: 첫 섹션 안이나 그 위, 첫 스크롤 전.',
    'ファーストビュー: 冒頭セクションの中かその上、最初のスクロールの前。',
  ),
  page: t('Anywhere on the page.', '페이지 어디든.', 'ページ内のどこでも。'),
};

export const ZONE_CRITERIA: Record<MustHaveZone, CriterionDef> = {
  'first-screen': {
    id: 'first-screen',
    text: `The first screen is everything in document order up to the end of the opening section (the section holding the page's h1, else the first section), outside the footer. It also takes up to ${MH.followingSections} following sections while each section so far is short: ≤ ${MH.shortSectionMaxWords} words, no image, picture, video, canvas, iframe, table, or SVG larger than an icon, and no declared height or min-height of ≥ ${MH.fillsViewportVh}vh or ≥ ${MH.fillsViewportPx}px. The site header, announcement bars, and a sidebar before the opening are on the first screen.`,
  },
  page: { id: 'page', text: 'Anywhere the must-have is searched for: the content sections, plus the site header, navigation, and footer when its searchIn is "page".' },
};

const defById = new Map(MUST_HAVES.map((def) => [def.id, def]));
const productById = new Map(PRODUCT_MUST_HAVES.map((entry) => [entry.productType, entry]));

export function mustHaveDef(id: MustHaveId): MustHaveDef {
  const def = defById.get(id);
  if (!def) throw new Error(`unknown must-have '${id}'`);
  return def;
}

export function productMustHaveDef(productType: ProductType): ProductMustHaveDef | null {
  return productType === 'other' ? null : productById.get(productType) ?? null;
}

export function mustHaveCheckId(id: MustHaveId): string {
  return `structure-must-have-${id}`;
}

export function mustHavePatternId(id: MustHaveId): string {
  return `must-have/${id}`;
}

export interface MustHaveView {
  id: MustHaveId;
  name: string;
  zone: MustHaveZone;
  placement: string;
  why: string;
  build: string;
  job: StructureJob;
}

/** The must-haves a recommendation returns once, for the resolved product type. */
export interface ProductMustHaves {
  schema: typeof MUST_HAVE_SCHEMA;
  productType: ProductType;
  source: FacetSource;
  /** The page the list is written for; null when no list exists for the product type. */
  page: string | null;
  items: MustHaveView[];
  rule: string;
  resourceUri: typeof MUST_HAVE_RESOURCE_URI;
}

/** How one candidate's archetype places a must-have: its zone and the style's signature moves that do the same job. */
export interface CandidateMustHave {
  id: MustHaveId;
  zone: MustHaveZone;
  moves: string[];
}

const ruleText: Record<Lang, { rule: (page: string, type: string) => string; none: (type: string) => string; inferred: string }> = {
  en: {
    rule: (page, type) => `These are required on the ${page}. The chosen style may restyle them but must not remove them, fold them into decoration, or move them out of their zone, and they come before the archetype's limits on the opening (one action, one short line): every first-screen item goes in the hero. Each candidate's structure.mustHaves names the style's moves that can present them. After building, run audit_page_structure with productType "${type}" to list any that are missing or misplaced.`,
    none: (type) => `No must-haves are defined for productType "${type}". Pass a specific productType to get the elements that product type requires and where each one goes.`,
    inferred: 'The product type was inferred from the brief; pass productType explicitly if it is wrong.',
  },
  ko: {
    rule: (page, type) => `${page}에 꼭 있어야 하는 요소입니다. 고른 스타일은 이 요소의 모양을 바꿀 수 있지만, 빼거나 장식에 묻거나 정해진 위치 밖으로 옮기면 안 됩니다. 이 요소는 첫 화면에 대한 아키타입의 제한(행동 하나, 짧은 문장 하나)보다 우선합니다. 첫 화면 항목은 모두 히어로에 넣으세요. 후보마다 structure.mustHaves가 이 요소를 보여 줄 스타일 무브를 알려 줍니다. 빌드한 뒤 productType "${type}"으로 audit_page_structure를 실행해 빠졌거나 위치가 틀린 요소를 확인하세요.`,
    none: (type) => `productType "${type}"에는 정의된 필수 요소가 없습니다. 구체적인 productType을 넘기면 그 제품 유형에 필요한 요소와 각 요소의 위치를 받을 수 있습니다.`,
    inferred: '제품 유형은 설명에서 추론했습니다. 틀렸다면 productType을 직접 넘기세요.',
  },
  ja: {
    rule: (page, type) => `${page}に必ず必要な要素です。選んだスタイルは見た目を変えてかまいませんが、削除したり、装飾に埋めたり、決められた位置の外へ移したりしてはいけません。これらの要素は、冒頭に関するアーキタイプの制限(アクション一つ、短い一文)より優先します。ファーストビューの項目はすべてヒーローに入れてください。各候補のstructure.mustHavesが、これらを見せるスタイルのムーブを示します。ビルド後、productType "${type}"でaudit_page_structureを実行し、欠けている要素や位置が違う要素を確認してください。`,
    none: (type) => `productType "${type}"には必須要素が定義されていません。具体的なproductTypeを渡すと、その製品タイプに必要な要素と各要素の位置が返ります。`,
    inferred: '製品タイプは説明から推定しました。違う場合はproductTypeを明示してください。',
  },
};

export function mustHaveView(id: MustHaveId, zone: MustHaveZone, why: LocalizedText, locale: Lang): MustHaveView {
  const def = mustHaveDef(id);
  return {
    id,
    name: text(def.name, locale),
    zone,
    placement: text(ZONE_TEXT[zone], locale),
    why: text(why, locale),
    build: text(def.build, locale),
    job: def.job,
  };
}

export function productMustHaves(productType: ProductType, source: FacetSource, locale: Lang = 'en'): ProductMustHaves {
  const entry = productMustHaveDef(productType);
  const wording = ruleText[locale];
  const page = entry ? text(entry.page, locale) : null;
  return {
    schema: MUST_HAVE_SCHEMA,
    productType,
    source,
    page,
    items: entry ? entry.items.map((item) => mustHaveView(item.id, item.zone, item.why, locale)) : [],
    rule: entry
      ? `${wording.rule(page!, productType)}${source === 'inferred' ? ` ${wording.inferred}` : ''}`
      : wording.none(productType),
    resourceUri: MUST_HAVE_RESOURCE_URI,
  };
}

/** The style's moves whose jobs include the must-have's job, in guide order. */
export function placingMoves(moves: ReadonlyArray<{ id: string; jobs: readonly StructureJob[] }>, id: MustHaveId): string[] {
  const job = mustHaveDef(id).job;
  return moves.filter((move) => move.jobs.includes(job)).map((move) => move.id);
}

export function candidateMustHaves(
  productType: ProductType, moves: ReadonlyArray<{ id: string; jobs: readonly StructureJob[] }>,
): CandidateMustHave[] {
  return (productMustHaveDef(productType)?.items ?? []).map((item) => ({ id: item.id, zone: item.zone, moves: placingMoves(moves, item.id) }));
}

export interface MustHaveCatalog {
  schema: typeof MUST_HAVE_SCHEMA;
  thresholds: typeof MH;
  zones: Record<MustHaveZone, { text: LocalizedText; criterion: CriterionDef }>;
  mustHaves: typeof MUST_HAVES;
  productTypes: typeof PRODUCT_MUST_HAVES;
}

export function mustHaveCatalog(): MustHaveCatalog {
  return {
    schema: MUST_HAVE_SCHEMA,
    thresholds: MH,
    zones: {
      'first-screen': { text: ZONE_TEXT['first-screen'], criterion: ZONE_CRITERIA['first-screen'] },
      page: { text: ZONE_TEXT.page, criterion: ZONE_CRITERIA.page },
    },
    mustHaves: MUST_HAVES,
    productTypes: PRODUCT_MUST_HAVES,
  };
}
