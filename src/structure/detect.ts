import { isRendered } from './dom/cascade.js';
import { descendants, elementChildren, hasText, ownText, textContent, type DomElement } from './dom/html.js';
import {
  backgroundColor, backgroundImage, containsCta, ctasIn, filterBlur, firstIcon, inFooter, inNavigation, isCentered, isCta,
  isHeading, isIcon, isPositionedOut, isRowLayout, productVisuals, radius, renderedChildren, sizePx, words, zIndex,
  type PageModel,
} from './dom/page.js';
import { colorsIn, hasGradient, lengthPx, toHsl, urlsIn } from './dom/values.js';
import { T } from './patterns.js';
import type { GlobalPatternId } from './types.js';

export type Observation = Record<string, string | number | boolean>;

export interface PatternMatch {
  element: DomElement;
  observed: Observation;
}

export type DetectionStatus =
  | { status: 'found'; matches: PatternMatch[] }
  | { status: 'absent' }
  | { status: 'not-applicable'; reason: string }
  | { status: 'not-verified'; reason: string };

const NO_OPENING = 'the page has no opening section with a heading';

/** The opening's headline: its h1, or the first h2-h3 when the page skips the h1. */
export function openingHeading(page: PageModel): DomElement | null {
  const opening = page.opening;
  if (!opening) return null;
  const nodes = [opening, ...descendants(opening)];
  return nodes.find((node) => node.tag === 'h1') ?? nodes.find((node) => node.tag === 'h2' || node.tag === 'h3') ?? null;
}

const contentCache = new WeakMap<PageModel, DomElement[]>();

/** Every rendered element of the content sections and the opening, in document order; computed once per page. */
export function contentElements(page: PageModel): DomElement[] {
  const cached = contentCache.get(page);
  if (cached) return cached;
  const roots = [...new Set([...(page.opening ? [page.opening] : []), ...page.sections])];
  const seen = new Set<DomElement>();
  const out: DomElement[] = [];
  for (const root of roots) {
    for (const node of [root, ...descendants(root)]) {
      if (seen.has(node) || !isRendered(page.styles, node) || inNavigation(node)) continue;
      seen.add(node);
      out.push(node);
    }
  }
  out.sort((a, b) => a.order - b.order);
  contentCache.set(page, out);
  return out;
}

function found(matches: PatternMatch[]): DetectionStatus {
  return matches.length ? { status: 'found', matches } : { status: 'absent' };
}

function isSaturated(value: string): boolean {
  return colorsIn(value).some((color) => {
    const hsl = toHsl(color);
    return color.a >= 0.2 && hsl.s >= 0.35 && hsl.l >= 0.15 && hsl.l <= 0.9;
  });
}

function contains(ancestor: DomElement, element: DomElement): boolean {
  for (let node: DomElement | null = element; node; node = node.parent) if (node === ancestor) return true;
  return false;
}

/** What an element inherits from the wrappers between it and the opening: decoration flags and the strongest blur. */
interface Layer { hidden: boolean; positioned: boolean; behind: boolean; fixed: boolean; blur: number }

function layersWithin(page: PageModel, opening: DomElement): Map<DomElement, Layer> {
  const out = new Map<DomElement, Layer>();
  const stack: Array<{ node: DomElement; parent: Layer }> = elementChildren(opening)
    .map((node) => ({ node, parent: { hidden: false, positioned: false, behind: false, fixed: false, blur: 0 } }));
  while (stack.length) {
    const { node, parent } = stack.pop()!;
    const position = page.styles.pick(node, ['position'])?.value.trim();
    const layer: Layer = {
      hidden: parent.hidden || node.attrs.get('aria-hidden') === 'true' || ['presentation', 'none'].includes(node.attrs.get('role') ?? ''),
      positioned: parent.positioned || position === 'absolute',
      behind: parent.behind || (zIndex(page, node) ?? 0) < 0,
      fixed: parent.fixed || position === 'fixed',
      blur: Math.max(parent.blur, filterBlur(page, node)),
    };
    out.set(node, layer);
    for (const child of elementChildren(node)) stack.push({ node: child, parent: layer });
  }
  return out;
}

function detectGradientBlob(page: PageModel): DetectionStatus {
  const opening = page.opening;
  const heading = openingHeading(page);
  if (!opening || !heading) return { status: 'not-applicable', reason: NO_OPENING };
  if (!isCentered(page, heading)) return { status: 'absent' };
  const layers = layersWithin(page, opening);
  const bare: Layer = { hidden: false, positioned: false, behind: false, fixed: false, blur: 0 };
  const matches: PatternMatch[] = [];
  for (const node of [opening, ...descendants(opening)]) {
    if (!isRendered(page.styles, node)) continue;
    const layer = layers.get(node) ?? bare;
    // A blob is an empty box; a pseudo-element blob can hang off the copy's own container.
    const boxes = (['element', 'before', 'after'] as const).filter((box) => (box === 'element'
      ? node !== opening && !hasText(node) : page.styles.hasPseudo(node, box)));
    for (const box of boxes) {
      const own = box === 'element' ? null : page.styles.pick(node, ['position'], box)?.value.trim();
      if (layer.fixed || own === 'fixed') continue;
      const decorative = box !== 'element' || layer.hidden || layer.positioned || layer.behind
        || page.styles.get(node, 'pointer-events')?.trim() === 'none';
      if (!decorative) continue;
      const image = backgroundImage(page, node, box);
      const fill = box === 'element' ? backgroundColor(page, node) : page.styles.pick(node, ['background', 'background-color'], box)?.value ?? '';
      const blur = Math.max(layer.blur, filterBlur(page, node, box));
      const corners = radius(page, node, box);
      const width = sizePx(page, node, 'width', box) ?? 0;
      const height = sizePx(page, node, 'height', box) ?? 0;
      const clipped = /\b(?:polygon|circle|ellipse)\(/i.test(page.styles.pick(node, ['clip-path', '-webkit-clip-path'], box)?.value ?? '');
      const rounded = clipped || corners.percent >= T.blobMinRoundPercent || corners.px >= 999
        || (width > 0 && height > 0 && corners.px >= Math.min(width, height) * (T.blobMinRoundPercent / 100));
      const blurred = blur >= T.blobMinBlurPx && (hasGradient(image) || isSaturated(fill));
      const radialShape = /radial-gradient/i.test(image) && rounded && Math.max(width, height) >= T.blobMinSizePx;
      if (blurred || radialShape) {
        matches.push({ element: node, observed: { box, blurPx: blur, gradient: hasGradient(image), rounded, widthPx: width, heightPx: height } });
        break;
      }
    }
    if (matches.length) break;
  }
  return found(matches);
}

function isHomeLink(node: DomElement): boolean {
  return node.tag === 'a' && ['/', '#', '#top', '/#', './'].includes((node.attrs.get('href') ?? '').trim());
}

function eyebrowBefore(page: PageModel, heading: DomElement): DomElement | null {
  const opening = page.opening!;
  return descendants(opening).find((node) => node.order < heading.order && !contains(node, heading)
    && !inNavigation(node) && !/logo|brand/i.test(node.classes.join(' ')) && !isHomeLink(node) && !mediaOf(node).length
    && ownText(node).length > 0 && words(node) >= 1 && words(node) <= 8 && !isHeading(node)) ?? null;
}

/** A product demonstration built from markup: a labelled block or a block of ten or more elements beside the copy. */
function handBuiltMock(page: PageModel, opening: DomElement, keep: readonly DomElement[]): DomElement | null {
  for (const node of descendants(opening)) {
    if (!isRendered(page.styles, node) || keep.some((item) => contains(node, item) || contains(item, node))) continue;
    const size = descendants(node).length;
    const labelled = node.tag === 'figure' || node.attrs.get('role') === 'img' || (node.attrs.has('aria-label') && !isCta(node));
    if (size >= 10 || (labelled && size >= 3)) return node;
  }
  return null;
}

function detectCenteredStack(page: PageModel): DetectionStatus {
  const opening = page.opening;
  const heading = openingHeading(page);
  if (!opening || !heading) return { status: 'not-applicable', reason: NO_OPENING };
  if (!isCentered(page, heading)) return { status: 'absent' };
  const after = descendants(opening).filter((node) => node.order > heading.order && !contains(heading, node));
  const subline = after.find((node) => (node.tag === 'p' || ownText(node).length > 0) && words(node) >= T.stackSubMinWords
    && !isHeading(node) && node.tag !== 'a' && node.tag !== 'button' && !containsCta(page, node));
  const ctas = ctasIn(opening).filter((cta) => cta.order > heading.order);
  const eyebrow = eyebrowBefore(page, heading);
  if (!subline || !ctas.length || (!eyebrow && ctas.length < 2)) return { status: 'absent' };
  if (productVisuals(page, opening).length || handBuiltMock(page, opening, [heading, subline, ...ctas])) return { status: 'absent' };
  return found([{ element: opening, observed: { eyebrow: !!eyebrow, sublineWords: words(subline), ctas: ctas.length, productVisuals: 0 } }]);
}

const STOCK_HOSTS = [
  'unsplash.com', 'pexels.com', 'pixabay.com', 'shutterstock.com', 'istockphoto.com', 'gettyimages.com', 'gettyimages.co.uk',
  'stock.adobe.com', 'ftcdn.net', 'freepik.com', 'depositphotos.com', 'dreamstime.com', '123rf.com', 'stocksnap.io',
  'burst.shopify.com', 'picsum.photos', 'placehold.co', 'placeholder.com', 'placekitten.com', 'loremflickr.com',
  'dummyimage.com', 'randomuser.me', 'pravatar.cc', 'fakeimg.pl', 'lorempixel.com',
];
const STOCK_MARKER = /(?:^|[\W_])(?:stock|shutterstock|istock|getty|unsplash|pexels|adobestock|depositphotos|dreamstime|pixabay|freepik|placeholder)(?:[\W_]|$)/i;

function decoded(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** The URL itself plus any image URL it proxies: next/image `url=`, CDN `src=` params, or an absolute URL in the path. */
function proxiedUrls(url: string): string[] {
  const out = [url.trim()];
  for (const match of url.matchAll(/[?&](?:url|src|image|u)=([^&#]+)/gi)) out.push(decoded(match[1]!));
  for (const match of decoded(url).slice(1).matchAll(/https?:\/\/[^\s"'<>,]+/gi)) out.push(match[0]);
  return out;
}

export function isStockSource(url: string): boolean {
  return proxiedUrls(url).some((candidate) => {
    const host = /^(?:https?:)?\/\/([^/?#]+)/i.exec(candidate)?.[1]?.toLowerCase().replace(/:\d+$/, '');
    if (host && STOCK_HOSTS.some((stock) => host === stock || host.endsWith(`.${stock}`))) return true;
    const file = candidate.split(/[?#]/)[0]!.split('/').pop() ?? '';
    return STOCK_MARKER.test(file);
  });
}

function imageSources(element: DomElement): string[] {
  const out: string[] = [];
  for (const attr of ['src', 'data-src', 'srcset', 'data-srcset']) {
    const value = element.attrs.get(attr);
    if (!value) continue;
    if (attr.includes('srcset')) out.push(...value.split(/,\s+/).map((part) => part.trim().split(/\s+/)[0] ?? '').filter(Boolean));
    else out.push(value.trim());
  }
  return out;
}

function detectStockPhoto(page: PageModel): DetectionStatus {
  const opening = page.opening;
  if (!opening || !openingHeading(page)) return { status: 'not-applicable', reason: NO_OPENING };
  const matches: PatternMatch[] = [];
  for (const node of [opening, ...descendants(opening)]) {
    if (!isRendered(page.styles, node)) continue;
    const background = backgroundImage(page, node);
    const sources = node.tag === 'img' || node.tag === 'source' ? imageSources(node) : urlsIn(background);
    if (!sources.length) continue;
    const alt = node.attrs.get('alt') ?? '';
    const stock = sources.find(isStockSource) ?? (STOCK_MARKER.test(alt) ? sources[0] : undefined);
    if (!stock) continue;
    const media = node.tag === 'source' && node.parent?.tag === 'picture' ? node.parent : node;
    const widthRaw = page.styles.pick(media, ['width'])?.value ?? media.attrs.get('width') ?? '';
    const widthPx = sizePx(page, media, 'width') ?? 0;
    const percent = widthRaw.trim().endsWith('%') ? parseFloat(widthRaw) : media.classes.some((cls) => /^w-(?:full|screen)$/.test(cls)) ? 100 : 0;
    const cover = page.styles.pick(media, ['object-fit'])?.value.trim() === 'cover';
    const fills = isPositionedOut(page, media) && ['top', 'left'].every((side) => (lengthPx(page.styles.pick(media, [side, 'inset'])?.value?.split(/\s+/)[0], page.ctx) ?? 1) === 0);
    const dominant = node === opening || widthPx >= T.photoMinWidthPx || percent >= 50 || cover || fills
      || (node.tag !== 'img' && node.tag !== 'source' && (sizePx(page, node, 'height') ?? 0) >= 320);
    if (dominant) matches.push({ element: media, observed: { source: stock.slice(0, 200), widthPx, cover, sectionBackground: node === opening } });
  }
  return found(matches.slice(0, 1));
}

const SOCIAL = /twitter|x\.com|github|linkedin|instagram|facebook|youtube|tiktok|discord|mastodon|threads|dribbble|behance|medium|reddit|telegram|whatsapp|kakao|naver|line\.me/i;
const PAYMENT = /visa|mastercard|master-card|amex|american express|paypal|apple ?pay|google ?pay|discover|jcb|unionpay|klarna|afterpay|alipay|wechat ?pay|kakaopay|naverpay|toss|app ?store|google play|play store/i;
const INTEGRATION = /integrat|works with|connects? (?:to|with)|plug-?ins?|compatible|supported (?:apps|tools|platforms)|apps you|연동|통합|対応|連携/i;
const LOGO_NAMES = /logo|brand|client|customer|partner|sponsor|marquee|trusted|backer|investor/i;
const LOOPING = /\binfinite\b/i;

function mediaOf(element: DomElement): DomElement[] {
  const all = [element, ...descendants(element)].filter((node) => node.tag === 'img' || node.tag === 'svg' || node.tag === 'picture');
  return all.filter((node) => !all.some((other) => other !== node && descendants(other).includes(node)));
}

function isLogoItem(item: DomElement): boolean {
  if (item.tag === 'button') return false;
  const media = mediaOf(item);
  return media.length === 1 && words(item) <= T.logoMaxWords;
}

function cueText(element: DomElement): string {
  return [element.classes.join(' '), element.id ?? '', element.attrs.get('alt') ?? '', element.attrs.get('src') ?? '',
    element.attrs.get('aria-label') ?? '', element.attrs.get('title') ?? ''].join(' ');
}

function isMuted(page: PageModel, element: DomElement): boolean {
  const filter = page.styles.pick(element, ['filter'])?.value ?? '';
  const opacity = parseFloat(page.styles.get(element, 'opacity') ?? '1');
  return /grayscale\(\s*(?:[1-9]\d*%?|1|0?\.\d+)\s*\)/i.test(filter) || (Number.isFinite(opacity) && opacity <= 0.8);
}

function animated(page: PageModel, element: DomElement): boolean {
  return LOOPING.test(page.styles.pick(element, ['animation', 'animation-iteration-count'])?.value ?? '');
}

const sectionRoots = new WeakMap<PageModel, Set<DomElement>>();

function rootsOf(page: PageModel): Set<DomElement> {
  let roots = sectionRoots.get(page);
  if (!roots) {
    roots = new Set([...page.sections, ...(page.opening ? [page.opening] : [])]);
    sectionRoots.set(page, roots);
  }
  return roots;
}

/** A page band: a content section, the opening, the footer, or a page-level box. */
export function isSectionRoot(page: PageModel, element: DomElement): boolean {
  return rootsOf(page).has(element) || element === page.footer || element === page.root
    || ['html', 'body', 'main'].includes(element.tag);
}

/** The content section (or the opening) that holds an element. */
export function sectionOf(page: PageModel, element: DomElement): DomElement {
  const roots = rootsOf(page);
  for (let node: DomElement | null = element; node; node = node.parent) if (roots.has(node)) return node;
  return element;
}

const LABEL_MAX_WORDS = 40;

/** The heading and the caption just before a row: what a reader takes as the row's label. */
function sectionLabel(page: PageModel, element: DomElement): string {
  const section = sectionOf(page, element);
  const heading = descendants(section).find((node) => isHeading(node) && node.order < element.order);
  const previous = element.parent ? elementChildren(element.parent).filter((child) => child.order < element.order).pop() : undefined;
  const short = (node: DomElement | undefined) => (node && words(node) <= LABEL_MAX_WORDS ? textContent(node) : '');
  return [short(heading), short(previous), element.attrs.get('aria-label') ?? ''].join(' ');
}

function detectLogoStrip(page: PageModel): DetectionStatus {
  const matches: PatternMatch[] = [];
  for (const container of contentElements(page)) {
    const items = renderedChildren(page, container);
    if (items.length < T.logoMinItems) continue;
    const logos = items.filter(isLogoItem);
    if (logos.length < T.logoMinItems || logos.length < items.length * 0.8) continue;
    const track = container.parent ?? container;
    const marquee = animated(page, container) || animated(page, track);
    const row = isRowLayout(page, container, T.logoMinItems) || marquee || LOGO_NAMES.test(cueText(container));
    if (!row) continue;
    const label = sectionLabel(page, container);
    const media = logos.flatMap(mediaOf);
    const cue = media.some((node) => /logo/i.test(cueText(node))) || [container, ...logos].some((node) => LOGO_NAMES.test(cueText(node)))
      || [container, ...logos, ...media].some((node) => isMuted(page, node)) || marquee || claims(label);
    if (!cue) continue;
    const linked = logos.map((item) => [item, ...descendants(item)].find((node) => node.tag === 'a')?.attrs.get('href') ?? '').join(' ');
    const social = inFooter(container) && (SOCIAL.test(linked) || logos.every((item) => SOCIAL.test(cueText(item) + cueText(mediaOf(item)[0]!))));
    const payment = media.filter((node) => PAYMENT.test(cueText(node))).length >= media.length / 2;
    if (inNavigation(container) || social || payment || INTEGRATION.test(label)) continue;
    if (matches.some((match) => contains(match.element, container) || contains(container, match.element))) continue;
    matches.push({ element: container, observed: { logos: logos.length, marquee, muted: [container, ...logos, ...media].some((node) => isMuted(page, node)) } });
  }
  return found(matches);
}

/** Typographic apostrophes and quotes as ASCII, so claim patterns match however the copy was typeset. */
function plain(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

// A popularity claim needs a crowd: 100 or more, a k/M or 만/千 unit, or a trailing "+". "Used by 5 people" is a limit.
const CROWD = String.raw`(?:\d{1,3}(?:[,.]\d{3})+|\d{3,}|\d+(?:\.\d+)?\s*[km]\b|\d+\s*\+)\s*\+?`;
const CROWD_KO = String.raw`(?:\d{1,3}(?:,\d{3})+|\d{3,}|\d+(?:\.\d+)?\s*(?:만|천|백)|\d+\s*\+)`;
const CROWD_JA = String.raw`(?:\d{1,3}(?:,\d{3})+|\d{3,}|\d+(?:\.\d+)?\s*(?:万|千))`;

const CLAIM: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:trusted|used|loved|chosen|relied (?:up)?on|backed|preferred|adopted)\s+by\s+(?:over\s+|more than\s+|the\s+)?(?:${CROWD}|thousands|millions|hundreds|leading|top|world's|teams|companies|businesses|brands|startups|enterprises|developers|creators|customers|industry|fortune)`, 'i'),
  /\bas (?:seen|featured) (?:in|on)\b/i,
  new RegExp(String.raw`\bjoin(?:ed)?\s+(?:over\s+|more than\s+)?(?:${CROWD}|thousands|millions|hundreds)\s+(?:of\s+)?(?:other\s+)?(?:teams|companies|customers|users|developers|businesses|creators|people|brands|marketers|designers|engineers)`, 'i'),
  new RegExp(String.raw`(?:^|\s)${CROWD}\s+(?:teams|companies|customers|users|businesses|developers|brands)\s+(?:trust|use|love|rely|choose)`, 'i'),
  /\b(?:the world's|industry)\s+(?:best|leading|top|most innovative)\s+(?:teams|companies|brands)\s+(?:use|trust|choose|build)/i,
  new RegExp(String.raw`${CROWD_KO}\s*(?:개|곳|명)?\s*(?:이상의?\s*)?(?:기업|팀|회사|고객사?|브랜드|사용자|파트너)(?:이|가|들이)?\s*(?:신뢰|선택|사용|이용|도입)`),
  /신뢰(?:하는|받는)\s*(?:기업|팀|브랜드|고객사)|(?:기업|팀|브랜드|고객사)(?:이|가|들이)\s*(?:신뢰|선택|사랑)하는|함께하는\s*(?:기업|파트너|고객사)|도입\s*기업/,
  new RegExp(String.raw`${CROWD_JA}\s*(?:社|人|チーム)(?:以上)?の?(?:企業|お客様|ユーザー|チーム)?(?:が|に)?\s*(?:導入|信頼|利用|選ばれ)|導入企業|導入実績|(?:企業|チーム|お客様|ユーザー|開発者|ブランド)(?:に|から)(?:信頼|選ばれ|愛用)`),
];

function claims(text: string): boolean {
  const normalized = plain(text);
  return CLAIM.some((pattern) => pattern.test(normalized));
}

/** Logos or avatars beside a claim: images, or SVGs that are not hidden as decoration (check marks are). */
function proofMedia(page: PageModel, element: DomElement): number {
  return [element, ...descendants(element)].filter((node) => isRendered(page.styles, node)
    && (node.tag === 'img' || (node.tag === 'svg' && node.attrs.get('aria-hidden') !== 'true'))).length;
}

function detectTrustedBy(page: PageModel): DetectionStatus {
  const matches: PatternMatch[] = [];
  const bands = new Set<DomElement>();
  for (const element of contentElements(page)) {
    if ((!ownText(element) && !isHeading(element)) || words(element) > T.claimMaxWords) continue;
    const text = textContent(element);
    if (!text || !claims(text)) continue;
    const section = sectionOf(page, element);
    if (bands.has(section)) continue;
    const container = element.parent ?? section;
    const siblings = container !== section && container.parent ? elementChildren(container.parent).filter((node) => node !== container) : [];
    const proofNearby = [container, ...siblings].some((node) => proofMedia(page, node) >= 3)
      || (words(container) <= LABEL_MAX_WORDS && /★|⭐|\b\d(?:\.\d)?\s*\/\s*5\b/.test(textContent(container)));
    const shortBand = words(section) <= T.bandMaxWords && !quoteItemsIn(page, section).length && !containsCta(page, section);
    if (!shortBand && !proofNearby) continue;
    bands.add(section);
    matches.push({ element, observed: { claim: text.slice(0, 160), sectionWords: words(section), proofNearby } });
  }
  return found(matches);
}

const STEP_HEADING = /^\s*(?:step\s*)?(?:\d+|[ivx]+)[.):]?\s*$/i;

function iconCard(page: PageModel, card: DomElement): { heading: DomElement; blurb: DomElement } | null {
  const icon = firstIcon(page, card);
  if (!icon) return null;
  const inner = descendants(card);
  const leadingMedia = inner.find((node) => (node.tag === 'img' || node.tag === 'picture' || node.tag === 'video') && !isIcon(page, node));
  if (leadingMedia && leadingMedia.order < icon.order) return null;
  const heading = inner.find((node) => node.order > icon.order && (isHeading(node) || node.tag === 'strong' || node.tag === 'b' || node.tag === 'dt'));
  if (!heading || words(heading) === 0 || words(heading) > T.cardHeadingMaxWords || STEP_HEADING.test(textContent(heading))) return null;
  const blurb = inner.find((node) => node.order > heading.order && !contains(heading, node)
    && (node.tag === 'p' || node.tag === 'dd' || (ownText(node) && !isHeading(node)))
    && words(node) >= T.cardBlurbMinWords && words(node) <= T.cardBlurbMaxWords);
  return blurb ? { heading, blurb } : null;
}

function shapeOf(page: PageModel, card: DomElement): string {
  return descendants(card).filter((node) => isHeading(node) || node.tag === 'p' || isIcon(page, node))
    .map((node) => (isIcon(page, node) ? 'icon' : isHeading(node) ? 'h' : 'p')).join('');
}

function detectIconFeatureGrid(page: PageModel): DetectionStatus {
  const matches: PatternMatch[] = [];
  for (const container of contentElements(page)) {
    const kids = renderedChildren(page, container);
    if (kids.length < T.cardsMin) continue;
    const filled = kids.filter(hasText);
    if (filled.length < T.cardsMin) continue;
    const cards = filled.filter((kid) => iconCard(page, kid) !== null);
    if (cards.length < T.cardsMin || cards.length < filled.length * 0.75) continue;
    const shapes = cards.map((card) => shapeOf(page, card));
    const common = shapes.filter((shape) => shape === shapes[0]).length;
    if (common < Math.ceil(cards.length * 0.66)) continue;
    if (matches.some((match) => contains(match.element, container))) continue;
    matches.push({ element: container, observed: { cards: cards.length, row: isRowLayout(page, container, 2) } });
  }
  return found(matches);
}

const CAROUSEL = /carousel|slider|swiper|splide|slick|glide|embla|keen-slider|flickity|owl-|marquee|slideshow/i;
const QUOTE_TOKEN = /^(?:testimonials?|reviews?|quotes?|quotation)$/i;
const QUOTE_NAME_CJK = /후기|추천사|お客様の声/;
const PREV_NEXT = /\b(?:prev|previous|next)\b|이전|다음|前へ|次へ/i;
const DOT = /\bslide\s*\d|\bgo to slide|\bdot\b|\bpage\s*\d|슬라이드|スライド/i;

/** Class and id names split into words (kebab, snake, camel case, CSS-modules hashes), so "template-preview" is not "review". */
function nameTokens(element: DomElement): string[] {
  return [...element.classes, element.id ?? ''].flatMap((name) => name.split(/[-_\s]+|(?=[A-Z][a-z])/)).filter(Boolean);
}

function quoteNamed(element: DomElement): boolean {
  return nameTokens(element).some((token) => QUOTE_TOKEN.test(token))
    || QUOTE_NAME_CJK.test(`${element.classes.join(' ')} ${element.id ?? ''}`);
}

function intrinsicQuote(element: DomElement): boolean {
  if (element.tag === 'blockquote' || element.tag === 'q') return words(element) >= 4;
  return element.tag === 'figure' && words(element) <= 400 && elementChildren(element).some((child) => child.tag === 'figcaption')
    && /[“"「『]/.test(textContent(element));
}

const quoteCache = new WeakMap<PageModel, Set<DomElement>>();

/**
 * Rendered quote items: blockquotes, quoted figures, and testimonial-named elements that hold no such item
 * themselves. Computed bottom-up once per page, so a section named "testimonials" never swallows its quotes.
 */
function quoteItems(page: PageModel): Set<DomElement> {
  const cached = quoteCache.get(page);
  if (cached) return cached;
  const items = new Set<DomElement>();
  const holders = new Set<DomElement>();
  const stack: Array<{ node: DomElement; visited: boolean }> = [{ node: page.html.root, visited: false }];
  while (stack.length) {
    const top = stack[stack.length - 1]!;
    if (!top.visited) {
      top.visited = true;
      for (const child of elementChildren(top.node)) stack.push({ node: child, visited: false });
      continue;
    }
    stack.pop();
    const node = top.node;
    if (node.tag === '#document' || !isRendered(page.styles, node)) continue;
    const holdsItem = elementChildren(node).some((child) => items.has(child) || holders.has(child));
    const item = intrinsicQuote(node) || (!holdsItem && quoteNamed(node) && words(node) >= 6);
    if (item) items.add(node);
    if (item || holdsItem) holders.add(node);
  }
  quoteCache.set(page, items);
  return items;
}

/** Outermost quote items inside `scope`. */
function quoteItemsIn(page: PageModel, scope: DomElement): DomElement[] {
  const items = quoteItems(page);
  return [scope, ...descendants(scope)].filter((node) => {
    if (!items.has(node)) return false;
    for (let up = node.parent; up && up !== scope.parent; up = up.parent) if (items.has(up)) return false;
    return true;
  });
}

function carouselMechanics(page: PageModel, scope: DomElement): DomElement | null {
  const nodes = [scope, ...descendants(scope)].filter((node) => isRendered(page.styles, node));
  const named = nodes.find((node) => CAROUSEL.test(node.classes.join(' ')) || CAROUSEL.test(node.id ?? '')
    || [...node.attrs].some(([name, value]) => name.startsWith('data-') && (CAROUSEL.test(name) || CAROUSEL.test(value))));
  if (named) return named;
  const role = nodes.find((node) => /carousel|slide/i.test(node.attrs.get('aria-roledescription') ?? ''));
  if (role) return role;
  const snap = nodes.find((node) => /auto|scroll/.test(page.styles.pick(node, ['overflow-x', 'overflow'])?.value ?? '')
    && /\bx\b|inline|both/.test(page.styles.get(node, 'scroll-snap-type') ?? ''));
  if (snap) return snap;
  const buttons = nodes.filter((node) => node.tag === 'button' || node.attrs.get('role') === 'button');
  const arrows = buttons.filter((node) => {
    if (words(node) > 3) return false;
    const text = textContent(node);
    return PREV_NEXT.test(node.attrs.get('aria-label') || text) || /^[‹›<>←→❮❯]$/.test(text);
  });
  if (arrows.length >= 2) return arrows[0]!;
  const dots = buttons.filter((node) => DOT.test(node.attrs.get('aria-label') ?? '')
    || (!hasText(node) && !elementChildren(node).length && !node.attrs.has('aria-label')));
  if (dots.length >= T.dotsMin) return dots[0]!;
  return nodes.find((node) => animated(page, node) && quoteItemsIn(page, node).length >= T.quotesMin) ?? null;
}

function detectTestimonialCarousel(page: PageModel): DetectionStatus {
  const matches: PatternMatch[] = [];
  for (const section of page.sections) {
    const quotes = quoteItemsIn(page, section);
    if (!quotes.length) continue;
    const mechanics = carouselMechanics(page, section);
    if (!mechanics || (quotes.length < T.quotesMin && !/carousel|slider|swiper/i.test(mechanics.classes.join(' ')))) continue;
    matches.push({ element: mechanics, observed: { quotes: quotes.length, mechanics: mechanics.tag } });
  }
  return found(matches);
}

const CTA_HEADING: readonly RegExp[] = [
  /^(?:are you )?ready\b|^get started\b|^start (?:your|building|creating|growing|today|now|for free)|^try \S+ (?:for )?free|^join (?:us|thousands|millions|today|the)\b|to the next level|^supercharge|^level up|^transform (?:your|the way)|^unlock\b|what are you waiting for|^let's (?:build|get started|talk)|^don't miss|^see \S+ in action/i,
  /지금\s*(?:바로\s*)?시작|무료로\s*시작|시작할\s*준비|준비되셨나요|함께\s*시작/,
  /今すぐ始め|無料で始め|始める準備|さあ、?始め|一緒に始め/,
];
const CTA_BUTTON: readonly RegExp[] = [
  /^(?:get started(?: for free| free| now| today)?|start (?:for free|free|now|today|your free trial|free trial|building)|try (?:it )?(?:for )?free|sign up(?: for free| free| now)?|book a demo|request a demo|get a demo|schedule a demo|contact sales|talk to sales|join (?:now|today|free|the waitlist))\s*[→›>]?$/i,
  /^(?:무료로\s*시작(?:하기)?|지금\s*시작(?:하기)?|시작하기|무료\s*체험(?:하기)?|데모\s*(?:신청|요청|예약)(?:하기)?|도입\s*문의|상담\s*신청)\s*[→›>]?$/,
  /^(?:無料で(?:始める|試す|はじめる)|今すぐ(?:始める|はじめる)|無料トライアル|デモを(?:予約|申し込む|依頼)|お問い合わせ|資料請求)\s*[→›>]?$/,
];

function detectClosingBanner(page: PageModel): DetectionStatus {
  const last = page.sections[page.sections.length - 1];
  if (!last || last === page.opening || page.sections.length < 2) return { status: 'not-applicable', reason: 'the page has no closing section after the opening' };
  const inner = descendants(last).filter((node) => isRendered(page.styles, node));
  const heading = inner.find(isHeading);
  if (!heading || words(heading) > T.bannerHeadingMaxWords) return { status: 'absent' };
  const ctas = ctasIn(last).filter((cta) => isRendered(page.styles, cta));
  if (ctas.length < 1 || ctas.length > 2) return { status: 'absent' };
  const paragraphs = inner.filter((node) => node.tag === 'p' && words(node) > 0 && !ctas.some((cta) => contains(cta, node)));
  if (paragraphs.length > 1 || paragraphs.some((node) => words(node) > T.bannerParagraphMaxWords)) return { status: 'absent' };
  if (inner.some((node) => ['input', 'select', 'textarea', 'ul', 'ol', 'table', 'pre', 'code', 'video', 'iframe', 'canvas'].includes(node.tag)
    || (node.tag === 'img' && !isIcon(page, node)))) return { status: 'absent' };
  const headingText = plain(textContent(heading));
  const stock = CTA_HEADING.some((pattern) => pattern.test(headingText)) || ctas.some((cta) => CTA_BUTTON.some((pattern) => pattern.test(plain(textContent(cta)))));
  // A banner is staged: centered, or set on its own fill. An in-app panel with the same words is neither.
  const staged = isCentered(page, heading) || !!backgroundImage(page, last) || !!backgroundColor(page, last).replace(/transparent/i, '');
  if (!stock || !staged) return { status: 'absent' };
  return found([{ element: last, observed: { heading: headingText.slice(0, 120), ctas: ctas.length } }]);
}

const OPENING_PATTERNS: readonly GlobalPatternId[] = ['gradient-blob-hero', 'centered-stack-hero', 'stock-photo-hero'];
const PROOF_PATTERNS: readonly GlobalPatternId[] = ['logo-strip', 'trusted-by-band'];

function detectSkeleton(page: PageModel, results: ReadonlyMap<GlobalPatternId, DetectionStatus>): DetectionStatus {
  const roleAt = new Map<number, string>();
  const sectionIndex = (element: DomElement) => {
    const section = sectionOf(page, element);
    const index = page.sections.indexOf(section);
    return index === -1 && section === page.opening ? -1 : index;
  };
  const mark = (ids: readonly GlobalPatternId[], role: string) => {
    for (const id of ids) {
      const result = results.get(id);
      if (result?.status !== 'found') continue;
      for (const match of result.matches) {
        const index = sectionIndex(match.element);
        if (!roleAt.has(index)) roleAt.set(index, role);
      }
    }
  };
  mark(OPENING_PATTERNS, 'opening');
  mark(['closing-cta-banner'], 'cta');
  mark(['testimonial-carousel'], 'testimonials');
  page.sections.forEach((section, index) => {
    if (!roleAt.has(index) && quoteItemsIn(page, section).length >= T.quotesMin) roleAt.set(index, 'testimonials');
  });
  mark(['icon-feature-grid'], 'features');
  mark(PROOF_PATTERNS, 'proof');
  const ordered = [...roleAt.entries()].sort((a, b) => a[0] - b[0]);
  const roles = ordered.map(([, role]) => role);
  const distinct = new Set(roles);
  if (distinct.size < T.skeletonMinSections) return { status: 'absent' };
  const first = (role: string) => roles.indexOf(role);
  const inOrder = (!distinct.has('opening') || first('opening') === 0)
    && (!distinct.has('cta') || roles.lastIndexOf('cta') === roles.length - 1)
    && (!distinct.has('features') || !distinct.has('testimonials') || first('features') < first('testimonials'));
  if (!inOrder) return { status: 'absent' };
  return found([{ element: page.root, observed: { sections: roles.join(' → '), templateSections: distinct.size } }]);
}

/** Run every global detector; the skeleton is derived from the others. */
export function detectGlobalPatterns(page: PageModel): Map<GlobalPatternId, DetectionStatus> {
  const results = new Map<GlobalPatternId, DetectionStatus>([
    ['gradient-blob-hero', detectGradientBlob(page)],
    ['centered-stack-hero', detectCenteredStack(page)],
    ['stock-photo-hero', detectStockPhoto(page)],
    ['logo-strip', detectLogoStrip(page)],
    ['trusted-by-band', detectTrustedBy(page)],
    ['icon-feature-grid', detectIconFeatureGrid(page)],
    ['testimonial-carousel', detectTestimonialCarousel(page)],
    ['closing-cta-banner', detectClosingBanner(page)],
  ]);
  results.set('generic-saas-skeleton', detectSkeleton(page, results));
  return results;
}

