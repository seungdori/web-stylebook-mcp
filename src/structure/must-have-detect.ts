import { isRendered } from './dom/cascade.js';
import {
  bottomUp, descendantCount, descendants, elementChildren, lastOrder, textContent, textWords, type DomElement,
} from './dom/html.js';
import {
  ancestorFlag, inFooter, inNavigation, isCta, isDecoration, isHeading, isIcon, isVisuallyHidden, productVisuals, sizePx,
  type PageModel,
} from './dom/page.js';
import { lengthPx } from './dom/values.js';
import { claims, quoteItems, sectionOf, type DetectionStatus } from './detect.js';
import { MH, mustHaveDef, type MustHaveId, type MustHaveZone } from './must-haves.js';
import type { GlobalPatternId } from './types.js';

export type MustHaveStatus = 'present' | 'misplaced' | 'missing' | 'not-verified';

export interface MustHaveDetection {
  status: MustHaveStatus;
  /** Every match on the page, in document order. */
  matches: DomElement[];
  /** The matches inside the required zone. */
  inZone: DomElement[];
  reason?: 'no-opening' | 'exhausted' | 'truncated';
}

const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const AMOUNT = String.raw`(?:\d{1,3}(?:[,.\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const SYMBOL = '[$€£¥₩₹₽₺₫₱฿₪]';
const ISO = '(?:USD|EUR|GBP|JPY|KRW|CNY|CAD|AUD|NZD|CHF|INR|SEK|NOK|DKK|SGD|HKD|TWD|MXN|BRL)';

const PRICE = new RegExp(String.raw`(?:${SYMBOL}|\b${ISO})\s?${AMOUNT}|${AMOUNT}\s?(?:${SYMBOL}|${ISO}\b|원|円|kr\b|zł|Kč)`);
const BUY = /\b(?:add(?: it)? to (?:my )?(?:cart|bag|basket|trolley)|buy|purchase|order(?: now)?|pre-?order|checkout|reserve)\b|장바구니|카트에\s?담기|구매|주문|결제|カート|購入|注文/i;
const ASSURANCE = /\b(?:shipping|ships?|shipped|delivery|deliver(?:ed|s)?|dispatch(?:ed|es)?|returns?|returnable|refunds?|refundable|exchanges?|money[- ]back|guarantee[ds]?|warrant(?:y|ies)|secure (?:checkout|payment))\b|배송|배달|반품|환불|교환|보증|안전\s?결제|送料|配送|お届け|発送|返品|返金|交換|保証|安全な(?:決済|お支払い)/i;
const STATUS = /\b(?:operational|healthy|unhealthy|degraded|outage|online|offline|running|stopped|paused|failed|failing|passing|passed|succeeded|errors?|warnings?|critical|on track|at risk|off track|blocked|overdue|pending|in progress|queued|resolved|unresolved|open incidents?|available|unavailable|all systems|normal|live)\b|정상|장애|경고|위험|주의|진행\s?중|완료|실패|대기|지연|운영\s?중|중단|오류|正常|障害|警告|危険|注意|進行中|完了|失敗|待機|遅延|稼働中|停止|エラー/i;
const METRIC = /^[\s+−–-]*(?:[$€£¥₩]\s?)?\d[\d,.]*\s?(?:%|[kmb]|ms|s|h|d|x|pts?|원|円|명|건|개|件|人|万|억|만)?\s*$/i;
const DELTA = /(?:^|[\s(])(?:[+−▲▼↑↓]\s?\d|-\d[\d,.]*\s?%)/;
const COMPARE = /\b(?:vs\.?|versus|compared (?:to|with)|since (?:yesterday|last|the last|\d)|from last|than last|(?:day|week|month|quarter|year) over (?:day|week|month|quarter|year)|wow|mom|qoq|yoy|dod)(?:\b|$)|대비|증가|감소|前日比|前週比|前月比|前年比|比べて|増加|減少/i;
const RELATIVE = /\b(?:\d+\s?(?:s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|wks?|weeks?|mo|mos|months?|y|yrs?|years?)\s+ago|just now|yesterday)\b|\d+\s?(?:초|분|시간|일|주|개월|달|년)\s?전|방금|어제|\d+\s?(?:秒|分|時間|日|週間|か月|ヶ月|年)前|たった今|昨日/i;
const CHANGE_HEADING = /\b(?:what(?:'s| has)? changed|what's new|changes?|changelog|recent|recently|activity|activities|latest|updates?|new since|timeline|events?|history|alerts?|incidents?|transactions?)\b|변경|변화|최근|활동|업데이트|새\s?소식|이력|타임라인|이벤트|알림|거래\s?내역|変更|最近|アクティビティ|更新|新着|履歴|タイムライン|イベント|アラート|取引/i;
const RANGE = new RegExp(String.raw`\b(?:(?:last|past|previous|next)\s+(?:\d+\s+)?(?:hours?|days?|weeks?|months?|quarters?|years?)|today|yesterday|this (?:week|month|quarter|year)|(?:year|quarter|month|week) to date|ytd|qtd|mtd|wtd|q[1-4](?:\s?['’]?\d{2,4})?|\d+\s?(?:h|d|w|mo|y)|${MONTH}\.?\s+\d{1,2}(?:,\s*\d{4})?\s*[–—~-]\s*(?:${MONTH}\.?\s+)?\d{1,2})\b|\d{4}-\d{2}-\d{2}\s*[–—~-]\s*\d{4}-\d{2}-\d{2}|(?:최근|지난)\s?\d*\s?(?:시간|일|주|개월|달|분기|년|해)|오늘|어제|이번\s?(?:주|달|분기|해)|올해|過去\s?\d+\s?(?:時間|日|週間|か月|ヶ月|年)|直近\s?\d+|今日|昨日|今週|今月|今四半期|今年`, 'i');
const SEARCH_NAME = /\bsearch\b|\bquery\b|검색|検索/i;
const SEARCH_LABEL = /\bsearch\b|검색|検索/i;
const QUICKSTART = /\b(?:quick[- ]?start|get(?:ting)? started|start here|install(?:ation|ing)?|set ?up|first steps|tutorials?|hello,? world)\b|빠른\s?시작|시작하기|설치|첫\s?걸음|튜토리얼|クイックスタート|はじめに|始め方|インストール|チュートリアル|入門/i;
const DOCS = /\b(?:docs|documentation|api(?: reference)?|reference|guides?|manual)\b|문서|가이드|레퍼런스|매뉴얼|ドキュメント|ガイド|リファレンス|マニュアル/i;
const DOCS_HREF = /^(?:https?:)?\/\/docs\.|(?:^|\/)(?:docs?|documentation|reference|api)(?:[/#?.]|$)/i;
const RATING = /\b\d(?:[.,]\d)?\s?(?:\/\s?5|out of 5|stars?)\b|[★⭐]|평점|별점|\d(?:\.\d)?\s?점\s?만점/i;
const CASE_STUDY = /\b(?:case stud(?:y|ies)|customer stor(?:y|ies)|success stor(?:y|ies)|reviews?|testimonials?)\b|사례|후기|리뷰|導入事例|お客様の声|レビュー|事例/i;
const COMPOSER_HINT = /\b(?:message|ask|question|prompt|chat|type|send|reply)\b|메시지|질문|물어|입력|メッセージ|質問|入力|話しかけ/i;
const AI_LIMITS = /\b(?:can|may|might|could|will sometimes)\s+(?:make mistakes|be (?:wrong|inaccurate|incorrect|out of date)|produce (?:inaccurate|incorrect|wrong)|contain (?:errors|mistakes|inaccuracies)|get things wrong|hallucinate)|\b(?:check|verify|double-check) (?:important|its|the|all|critical) (?:info|information|answers|responses|facts|details|output)|\bnot (?:medical|legal|financial|professional) advice\b|\bai[- ]generated\b|\bgenerated (?:by|with) ai\b|실수(?:를)?\s?할 수 있|부정확할 수 있|틀릴 수 있|오류가 있을 수 있|중요한 (?:정보|내용)[은는을]?\s?(?:꼭\s?)?(?:확인|검토)|AI가 생성|조언이 아닙니다|間違える(?:こと|可能性)|誤りを含む|不正確な|重要な情報は(?:必ず)?確認|AIが生成|AIによって生成|アドバイスではありません/i;
const BY_LINE = /^\s*(?:[Bb]y|[Ww]ritten by|[Ww]ords by|[Ss]tory by|[Tt]ext by)\s+\p{Lu}|^\s*(?:글|글쓴이|작성자|필자|기자)\s*[:·|]?\s*\S|\S+\s?기자\s*$|^\s*(?:文|著|執筆|筆者|記者)\s*[:：・|]\s*\S|\S+\s?記者\s*$/u;
const AUTHOR_NAME = /^(?:byline|author|article-author|post-author|entry-author)$/i;
const DATE = new RegExp(String.raw`\b${MONTH}\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\s+${MONTH}\.?,?\s+\d{4}\b|\b${MONTH}\.?\s+\d{4}\b|\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b|\d{4}\s?년\s?\d{1,2}\s?월|\d{4}年\s?\d{1,2}月`, 'i');
const WORK = /\b(?:work|works|projects?|case stud(?:y|ies)|selected|portfolio|clients?)\b|작업|작품|프로젝트|포트폴리오|사례|作品|実績|プロジェクト|事例|ポートフォリオ/i;
const CONTACT = /\b(?:contact(?: us| me)?|get in touch|email me|hire me|book a (?:call|meeting|consultation)|work with me|say hello|reach (?:me|us|out)|call us|support|help(?: center| centre)?)\b|문의|연락|상담|お問い合わせ|問い合わせ|連絡|相談/i;
const PRIVACY = /\b(?:privacy|hipaa|gdpr|confidential(?:ity)?|encrypt(?:ed|ion)?|data protection|personal (?:data|information)|protected health information|health information)\b|개인\s?정보|프라이버시|암호화|보안|의료\s?정보|プライバシー|個人情報|暗号化|機密|セキュリティ/i;

const CHOICE_ROLES = new Set(['radio', 'radiogroup', 'listbox', 'option', 'spinbutton']);
const LARGE_MEDIA = new Set(['img', 'picture', 'video', 'canvas', 'iframe', 'table', 'object', 'embed']);
const CODE_TAGS = new Set(['pre', 'code', 'samp', 'kbd']);
const TOPIC_CONTAINERS = new Set(['ul', 'ol', 'nav', 'div', 'section', 'dl', 'menu']);
const PROOF_PATTERNS: readonly GlobalPatternId[] = ['logo-strip', 'trusted-by-band', 'testimonial-carousel'];

/** Typographic apostrophes as ASCII, so "what’s new" and "what's new" read alike. */
function plain(value: string): string {
  return value.replace(/[‘’ʼ]/g, "'");
}

interface Scope {
  page: PageModel;
  /** Perceivable elements of the opening and the content sections, outside the footer, in document order. */
  content: DomElement[];
  contentSet: ReadonlySet<DomElement>;
  /** Every perceivable element on the page, in document order. */
  all: DomElement[];
  allSet: ReadonlySet<DomElement>;
  global: ReadonlyMap<GlobalPatternId, DetectionStatus>;
}

/** Drawn and exposed: rendered, not visually hidden, and not inside aria-hidden="true". */
export function perceivableFlag(page: PageModel): (element: DomElement) => boolean {
  const cache = new WeakMap<DomElement, boolean>();
  return (element) => {
    const chain: DomElement[] = [];
    let hidden = false;
    for (let node: DomElement | null = element; node && node.tag !== '#document'; node = node.parent) {
      const known = cache.get(node);
      if (known !== undefined) { hidden = !known; break; }
      chain.push(node);
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      const node = chain[i]!;
      hidden = hidden || node.attrs.get('aria-hidden') === 'true' || isVisuallyHidden(page.styles, node, page.ctx);
      cache.set(node, !hidden);
    }
    return !hidden && isRendered(page.styles, element);
  };
}

function scopeOf(page: PageModel, global: ReadonlyMap<GlobalPatternId, DetectionStatus>): Scope {
  const perceivable = perceivableFlag(page);
  const all = page.html.elements.filter((element) => element.tag !== '#document' && perceivable(element));
  const roots = [...new Set([...(page.opening ? [page.opening] : []), ...page.sections])];
  const seen = new Set<DomElement>();
  const content: DomElement[] = [];
  for (const root of roots) {
    for (const node of [root, ...descendants(root)]) {
      if (seen.has(node) || inFooter(node) || !perceivable(node)) continue;
      seen.add(node);
      content.push(node);
    }
  }
  content.sort((a, b) => a.order - b.order);
  return { page, content, contentSet: seen, all, allSet: new Set(all), global };
}

/** A section short enough that the one after it is likely on the same screen. */
function isShortSection(page: PageModel, section: DomElement): boolean {
  if (textWords(section) > MH.shortSectionMaxWords) return false;
  // At the audit's 900px viewport height, 80vh is the same 720px.
  for (const prop of ['min-height', 'height']) {
    const px = lengthPx(page.styles.get(section, prop), page.ctx);
    if (px !== null && px >= Math.min(MH.fillsViewportPx, (MH.fillsViewportVh / 100) * page.ctx.viewportHeight)) return false;
  }
  return !productVisuals(page, section).some((node) => LARGE_MEDIA.has(node.tag) || node.tag === 'svg');
}

/**
 * The last document position on the first screen: the end of the opening section (else the first section), extended
 * across up to two following sections while every section so far is short. Null when the page has no section.
 */
export function firstScreenEnd(page: PageModel): number | null {
  const { sections, opening } = page;
  let current = opening ?? sections[0] ?? null;
  if (!current) return null;
  const start = current;
  let next = sections.find((section) => section.order > lastOrder(start));
  for (let step = 0; step < MH.followingSections && next && isShortSection(page, current); step++) {
    current = next;
    const after = lastOrder(current);
    next = sections.find((section) => section.order > after);
  }
  return lastOrder(current);
}

/** The deepest elements of ≤ maxWords words whose text passes the test; a match inside a match keeps the inner one. */
function textMatches(elements: readonly DomElement[], test: (value: string) => boolean, maxWords: number, skip?: (element: DomElement) => boolean): DomElement[] {
  const passes = new Set<DomElement>();
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!;
    const words = textWords(element);
    if (!words || words > maxWords || skip?.(element)) continue;
    if (test(plain(textContent(element)))) passes.add(element);
  }
  return elements.filter((element) => passes.has(element) && !elementChildren(element).some((child) => passes.has(child)));
}

// Ancestor flags and subtree facts are memoized per element, so deep or wide pages stay linear.
const insideCode = ancestorFlag((node) => CODE_TAGS.has(node.tag));
const searchInputs = new WeakMap<DomElement, boolean>();
const holdsSearchInput = (element: DomElement) => bottomUp(element, searchInputs, (node) => (node.tag === 'input'
  && node.attrs.get('type')?.toLowerCase() === 'search') || elementChildren(node).some((child) => searchInputs.get(child)));
/** Inside a search landmark or a form that holds a search input. */
const withinSearch = ancestorFlag((node) => node.tag === 'search' || node.attrs.get('role') === 'search'
  || (node.tag === 'form' && holdsSearchInput(node)));

function label(element: DomElement): string {
  return plain(`${textContent(element)} ${element.attrs.get('aria-label') ?? ''} ${element.tag === 'input' ? element.attrs.get('value') ?? '' : ''}`);
}

function attrText(element: DomElement, names: readonly string[]): string {
  return names.map((name) => element.attrs.get(name) ?? '').join(' ');
}

function links(element: DomElement): DomElement[] {
  return [element, ...descendants(element)].filter((node) => node.tag === 'a' && node.attrs.has('href'));
}

function hasLabelNearby(element: DomElement): boolean {
  const own = textWords(element);
  for (let node = element.parent, depth = 0; node && node.tag !== '#document' && depth < 2; node = node.parent, depth++) {
    if (textWords(node) > own && !METRIC.test(textContent(node))) return true;
  }
  return false;
}

type Detector = (scope: Scope) => DomElement[];

const DETECTORS: Record<MustHaveId, Detector> = {
  price: ({ content }) => [
    ...content.filter((node) => node.attrs.get('itemprop') === 'price'),
    ...textMatches(content, (value) => PRICE.test(value), MH.priceMaxWords, insideCode),
  ],
  'variant-choice': ({ content }) => content.filter((node) => {
    const type = node.attrs.get('type')?.toLowerCase();
    const choice = node.tag === 'select' || (node.tag === 'input' && (type === 'radio' || type === 'number'))
      || CHOICE_ROLES.has(node.attrs.get('role') ?? '') || node.attrs.has('aria-pressed') || node.attrs.has('aria-checked');
    return choice && !inNavigation(node) && !withinSearch(node);
  }),
  'add-to-cart': ({ content }) => content.filter((node) => isCta(node) && BUY.test(label(node))),
  'purchase-assurance': ({ content }) => textMatches(content, (value) => ASSURANCE.test(value), MH.textMaxWords),
  'current-status': ({ content }) => {
    const roles = content.filter((node) => {
      const role = node.attrs.get('role') ?? '';
      return node.tag === 'meter' || node.tag === 'progress' || role === 'meter' || role === 'progressbar' || (role === 'status' && textWords(node) > 0);
    });
    const named = textMatches(content, (value) => STATUS.test(value), MH.statusMaxWords, (node) => isCta(node));
    const metrics = textMatches(content, (value) => METRIC.test(value), MH.metricMaxWords, insideCode).filter(hasLabelNearby);
    return [...roles, ...named, ...metrics];
  },
  'recent-changes': ({ content }) => {
    const changes = textMatches(content, (value) => DELTA.test(value) || COMPARE.test(value) || RELATIVE.test(value), 12, insideCode);
    const headings = content.filter((node) => isHeading(node) && textWords(node) <= 8 && CHANGE_HEADING.test(plain(textContent(node))));
    const feed = content.filter((node) => node.tag === 'time' && textWords(node) > 0
      && [node, ...ancestorsUpTo(node, 4)].some((up) => up.tag === 'li' || up.tag === 'tr' || up.tag === 'article'));
    return [...changes, ...headings, ...feed];
  },
  'time-range': ({ content }) => [
    ...content.filter((node) => node.tag === 'input' && ['date', 'month', 'week', 'datetime-local'].includes(node.attrs.get('type')?.toLowerCase() ?? '')),
    ...textMatches(content, (value) => RANGE.test(value), 12, insideCode),
  ],
  search: ({ all }) => all.filter((node) => {
    const role = node.attrs.get('role') ?? '';
    if (node.tag === 'search' || role === 'search' || role === 'searchbox') return true;
    if (node.tag === 'input') {
      const type = node.attrs.get('type')?.toLowerCase() ?? 'text';
      if (type === 'search') return true;
      if (type === 'hidden') return false;
      return SEARCH_NAME.test(attrText(node, ['placeholder', 'aria-label', 'name', 'id', 'title']));
    }
    return (node.tag === 'button' || role === 'button' || (node.tag === 'a' && node.attrs.has('href'))) && textWords(node) <= 8
      && SEARCH_LABEL.test(label(node));
  }),
  quickstart: ({ all }) => all.filter((node) => ((node.tag === 'a' && node.attrs.has('href')) || isHeading(node))
    && textWords(node) <= 10 && QUICKSTART.test(label(node))),
  'topic-index': ({ content, contentSet }) => content.filter((node) => {
    if (!TOPIC_CONTAINERS.has(node.tag)) return false;
    const children = elementChildren(node).filter((child) => contentSet.has(child));
    if (children.length < MH.topicLinksMin) return false;
    const linked = children.filter((child) => descendantCount(child) <= 60 && links(child).some((link) => textWords(link) >= 1 && textWords(link) <= 10));
    return linked.length >= MH.topicLinksMin && linked.length >= children.length * 0.75;
  }),
  'code-sample': ({ content }) => content.filter((node) => (node.tag === 'pre' && textWords(node) > 0)
    || ((node.tag === 'code' || node.tag === 'samp') && textWords(node) >= 2 && node.parent?.tag !== 'pre')),
  'docs-link': ({ all }) => all.filter((node) => node.tag === 'a' && node.attrs.has('href')
    && ((textWords(node) <= 8 && DOCS.test(label(node))) || DOCS_HREF.test(node.attrs.get('href') ?? ''))),
  'primary-cta': ({ content }) => content.filter((node) => isCta(node) && !['', '#'].includes((node.attrs.get('href') ?? 'x').trim())),
  proof: ({ page, content, global }) => {
    const quotes = quoteItems(page);
    const direct = content.filter((node) => quotes.has(node)
      || ['review', 'reviewRating', 'aggregateRating'].includes(node.attrs.get('itemprop') ?? '')
      || ((isHeading(node) || (node.tag === 'a' && node.attrs.has('href'))) && textWords(node) <= 10 && CASE_STUDY.test(label(node))));
    const rated = textMatches(content, (value) => RATING.test(value), 12);
    const claimed = textMatches(content, claims, MH.textMaxWords);
    const banned = PROOF_PATTERNS.flatMap((id) => {
      const status = global.get(id);
      return status?.status === 'found' ? status.matches.map((match) => match.element) : [];
    });
    return [...direct, ...rated, ...claimed, ...banned];
  },
  composer: ({ content }) => content.filter((node) => {
    const role = node.attrs.get('role') ?? '';
    const editable = node.attrs.get('contenteditable');
    const type = node.attrs.get('type')?.toLowerCase() ?? 'text';
    const field = node.tag === 'textarea' || role === 'textbox' || (editable !== undefined && editable !== 'false')
      || (node.tag === 'input' && type === 'text' && COMPOSER_HINT.test(attrText(node, ['placeholder', 'aria-label'])));
    return field && !SEARCH_NAME.test(attrText(node, ['placeholder', 'aria-label', 'name', 'id'])) && !withinSearch(node);
  }),
  'ai-limits': ({ all }) => textMatches(all, (value) => AI_LIMITS.test(value), MH.textMaxWords),
  author: ({ content }) => [
    ...content.filter((node) => /(?:^|\s)author(?:\s|$)/i.test(node.attrs.get('rel') ?? '') || /(?:^|\s)author(?:\s|$)/.test(node.attrs.get('itemprop') ?? '')
      || (textWords(node) > 0 && textWords(node) <= 8 && [...node.classes, node.id ?? ''].some((name) => AUTHOR_NAME.test(name)))),
    ...textMatches(content, (value) => BY_LINE.test(value), 8),
  ],
  'publish-date': ({ content }) => [
    ...content.filter((node) => node.tag === 'time' && textWords(node) > 0),
    ...textMatches(content, (value) => DATE.test(value), 10),
  ],
  'work-samples': ({ page, content }) => {
    const media = content.filter((node) => (node.tag === 'img' || node.tag === 'video') && !isIcon(page, node) && !isDecoration(page, node)
      && (sizePx(page, node, 'width') ?? Infinity) > 64);
    if (media.length >= MH.workItemsMin) return media;
    const listed = new Map<DomElement, boolean>();
    const holdsWork = (section: DomElement) => {
      let known = listed.get(section);
      if (known === undefined) {
        const inner = descendants(section);
        const hrefs = new Set(inner.filter((node) => node.tag === 'a').map((link) => link.attrs.get('href')?.trim() ?? '').filter((href) => href && href !== '#'));
        known = hrefs.size >= MH.workItemsMin || inner.filter((child) => child.tag === 'li' || child.tag === 'article').length >= MH.workItemsMin;
        listed.set(section, known);
      }
      return known;
    };
    return content.filter((node) => isHeading(node) && textWords(node) <= 8 && WORK.test(plain(textContent(node))) && holdsWork(sectionOf(page, node)));
  },
  contact: ({ all }) => all.filter((node) => {
    const href = (node.attrs.get('href') ?? '').trim().toLowerCase();
    if (node.tag === 'a' && (href.startsWith('mailto:') || href.startsWith('tel:'))) return true;
    if (node.tag === 'address' && textWords(node) > 0) return true;
    if (node.tag === 'form') return descendants(node).some((child) => child.tag === 'input' && child.attrs.get('type')?.toLowerCase() === 'email');
    return (node.tag === 'button' || (node.tag === 'a' && node.attrs.has('href'))) && textWords(node) <= 8 && CONTACT.test(label(node));
  }),
  'privacy-notice': ({ all }) => textMatches(all, (value) => PRIVACY.test(value), MH.textMaxWords),
};

function ancestorsUpTo(element: DomElement, depth: number): DomElement[] {
  const out: DomElement[] = [];
  for (let node = element.parent; node && node.tag !== '#document' && out.length < depth; node = node.parent) out.push(node);
  return out;
}

export interface MustHaveRequest {
  id: MustHaveId;
  zone: MustHaveZone;
}

/**
 * Find each requested must-have and judge it against its zone. Every check is not verified when the stylesheet
 * exceeded the selector budget; a must-have that is nowhere on a truncated page is not verified rather than missing.
 */
export function detectMustHaves(
  page: PageModel, requests: readonly MustHaveRequest[], global: ReadonlyMap<GlobalPatternId, DetectionStatus>,
): Map<MustHaveId, MustHaveDetection> {
  const out = new Map<MustHaveId, MustHaveDetection>();
  if (!requests.length) return out;
  const scope = scopeOf(page, global);
  const end = firstScreenEnd(page);
  const onFirstScreen = (element: DomElement) => end !== null && element.order <= end && !inFooter(element);
  for (const { id, zone } of requests) {
    if (page.styles.exhausted) {
      out.set(id, { status: 'not-verified', matches: [], inZone: [], reason: 'exhausted' });
      continue;
    }
    const allowed = mustHaveDef(id).searchIn === 'page' ? scope.allSet : scope.contentSet;
    const matches = [...new Set(DETECTORS[id](scope))].filter((element) => allowed.has(element)).sort((a, b) => a.order - b.order);
    if (!matches.length) {
      out.set(id, page.html.truncated
        ? { status: 'not-verified', matches, inZone: [], reason: 'truncated' }
        : { status: 'missing', matches, inZone: [] });
      continue;
    }
    if (zone === 'page') {
      out.set(id, { status: 'present', matches, inZone: matches });
      continue;
    }
    if (end === null) {
      out.set(id, { status: 'not-verified', matches, inZone: [], reason: 'no-opening' });
      continue;
    }
    const inZone = matches.filter(onFirstScreen);
    out.set(id, { status: inZone.length ? 'present' : 'misplaced', matches, inZone });
  }
  return out;
}
