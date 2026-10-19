import { StyledDocument, isRendered, visibleChildren } from './cascade.js';
import {
  descendants, elementChildren, hasText, lastOrder, ownText, parseHtml, textContent, textWords, wordCount, type DomElement,
  type ParsedHtml,
} from './html.js';
import { blurPx, hasGradient, lengthPx, radiusOf, urlsIn, type LengthContext } from './values.js';

export interface PageModel {
  html: ParsedHtml;
  styles: StyledDocument;
  ctx: LengthContext;
  /** `<main>` when present, otherwise the element that holds the content sections. */
  root: DomElement;
  sections: DomElement[];
  /** The first screen: the section with the page's non-logo h1, else a site header with one, else an early section with a heading. */
  opening: DomElement | null;
  footer: DomElement | null;
}

const CHROME_ROLES = new Set(['navigation', 'banner', 'contentinfo', 'search']);
const SECTION_TAGS = new Set(['section', 'article', 'header', 'footer', 'aside', 'figure', 'form']);
const MEDIA_CONTENT = new Set(['img', 'svg', 'picture', 'video', 'canvas', 'iframe', 'object', 'embed', 'input', 'textarea', 'select']);
// A block this short with no heading or media beside the real content wrapper is an announcement bar or a note.
const MINOR_WORDS = 30;
const WRAPPER_DEPTH = 8;

/**
 * Read by assistive technology but not drawn: the sr-only pattern (a clipped or 1px box), or a box moved off-screen
 * until it is focused, as skip links are (`top: -40px`, `top: -100%`, `left: -9999px`).
 */
export function isVisuallyHidden(styles: StyledDocument, element: DomElement, ctx: LengthContext): boolean {
  const position = styles.pick(element, ['position'])?.value.trim();
  if (position !== 'absolute' && position !== 'fixed') return false;
  const clip = styles.pick(element, ['clip'])?.value ?? '';
  const clipPath = styles.pick(element, ['clip-path'])?.value ?? '';
  if (/rect\(\s*0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?[\s,]+0(?:px)?\s*\)/i.test(clip) || /inset\(\s*50%/i.test(clipPath)) return true;
  const width = lengthPx(styles.pick(element, ['width'])?.value, ctx);
  const height = lengthPx(styles.pick(element, ['height'])?.value, ctx);
  if (width !== null && height !== null && width <= 1 && height <= 1) return true;
  const offset = (side: string) => styles.pick(element, [side])?.value.trim() ?? '';
  return ['left', 'right'].some((side) => (lengthPx(offset(side), ctx) ?? 0) <= -999)
    || ['top', 'bottom'].some((side) => (/^-\d*\.?\d+%$/.test(offset(side)) ? parseFloat(offset(side)) <= -100
      // A short text box pulled above the page is a skip link waiting for focus; a large or pictured one is layout.
      : (lengthPx(offset(side), ctx) ?? 0) < 0 && textWords(element) <= 6 && !hasMediaContent(element)));
}

const MEDIA_CONTENT_TAGS = new Set(['img', 'svg', 'picture', 'video', 'canvas', 'iframe']);

function hasMediaContent(element: DomElement): boolean {
  return MEDIA_CONTENT_TAGS.has(element.tag) || descendants(element).some((node) => MEDIA_CONTENT_TAGS.has(node.tag));
}

const SKIP_LINK = /\bskip\b|\bjump to\b|본문\s*바로\s*가기|건너뛰기|スキップ|本文へ/i;

/**
 * Not page content: a skip link, a dialog, or a fixed overlay such as a cookie banner or chat widget. These sit beside
 * the content wrapper on real pages and must not stop the descent into it or become sections.
 */
function isOverlay(styles: StyledDocument, element: DomElement): boolean {
  if (element.tag === 'a' && (element.attrs.get('href') ?? '').startsWith('#') && SKIP_LINK.test(textContent(element))) return true;
  const role = element.attrs.get('role') ?? '';
  if (element.tag === 'dialog' || role === 'dialog' || role === 'alertdialog' || element.attrs.get('aria-modal') === 'true') return true;
  return styles.pick(element, ['position'])?.value.trim() === 'fixed';
}

export function buildPage(html: string, css: readonly string[], ctx: LengthContext, maxElements: number): PageModel {
  const parsed = parseHtml(html, maxElements);
  const styles = new StyledDocument(parsed, css, ctx);
  const main = parsed.elements.find((element) => element.tag === 'main' || element.attrs.get('role') === 'main');
  const body = parsed.elements.find((element) => element.tag === 'body');
  const unseen = ancestorFlag((node) => isVisuallyHidden(styles, node, ctx));
  const visibleH1 = (node: DomElement) => node.tag === 'h1' && !isLogoHeading(node) && !unseen(node);
  const holdsH1 = (element: DomElement) => visibleH1(element) || descendants(element).some(visibleH1);
  const chrome = (element: DomElement) => isChrome(element, holdsH1);
  // Overlays are dropped unless nothing else is left, as in an app whose whole shell is a fixed layer.
  const blocksOf = (element: DomElement) => {
    const blocks = visibleChildren(styles, element).filter((child) => !chrome(child) && !unseen(child));
    const inPage = blocks.filter((child) => !isOverlay(styles, child));
    return inPage.length ? inPage : blocks;
  };
  const hasMedia = (element: DomElement) => MEDIA_CONTENT.has(element.tag) || descendants(element).some((node) => MEDIA_CONTENT.has(node.tag));
  const significant = (element: DomElement) => hasText(element) || hasMedia(element);
  const holdsHeading = (element: DomElement) => isHeading(element) || descendants(element).some(isHeading);
  const minor = (element: DomElement) => !holdsHeading(element) && textWords(element) <= MINOR_WORDS && !hasMedia(element);
  const headedBlocks = (element: DomElement) => blocksOf(element).filter(significant).filter(holdsHeading).length;
  // One section's own content rather than a list of sections: a bare h1 or h2 beside its paragraphs, or one headed
  // block beside a visual (a hero's copy and its decoration or screenshot).
  const oneSection = (element: DomElement) => {
    const inner = blocksOf(element).filter(significant);
    if (inner.some((block) => block.tag === 'h1' || block.tag === 'h2')) return true;
    return inner.filter(holdsHeading).length <= 1 && inner.some((block) => !holdsHeading(block) && !minor(block));
  };

  // Layout wrappers (React roots, max-width containers, an app shell beside a portal or toast region) hold the
  // sections further down. Follow the wrapper that carries the content until the next level is one section, then
  // keep the level with the most headed blocks, the deeper one on a tie.
  const chain = [main ?? body ?? parsed.root];
  for (let depth = 0; depth < WRAPPER_DEPTH; depth++) {
    const level = chain[chain.length - 1]!;
    if (ownText(level)) break;
    const blocks = blocksOf(level).filter(significant);
    const headed = blocks.filter(holdsHeading);
    const next = blocks.length === 1 ? blocks[0]
      : headed.length === 1 && blocks.every((block) => block === headed[0] || minor(block)) ? headed[0] : undefined;
    if (!next || SECTION_TAGS.has(next.tag) || isHeading(next) || oneSection(next)) break;
    chain.push(next);
  }
  let container = chain[0]!;
  let most = headedBlocks(container);
  for (const level of chain.slice(1)) {
    const count = headedBlocks(level);
    if (count >= most) { most = count; container = level; }
  }
  const sections = blocksOf(container).filter((child) => hasText(child) || child.children.some((node) => node.kind === 'element'));
  const footers = parsed.elements.filter((element) => (element.tag === 'footer' || element.attrs.get('role') === 'contentinfo')
    && !(main && isInside(element, main)));
  const footer = footers[footers.length - 1] ?? null;
  const siteHeader = parsed.elements.find((element) => (element.tag === 'header' || element.attrs.get('role') === 'banner')
    && !(main && isInside(element, main)));
  let opening: DomElement | null = sections.find(holdsH1) ?? null;
  if (!opening && siteHeader && holdsH1(siteHeader)) opening = siteHeader;
  opening ??= sections.slice(0, 2).find(holdsHeading) ?? null;
  return { html: parsed, styles, ctx, root: container, sections, opening, footer };
}

/** A site-header h1 that is only the brand: a home link, a logo image, or a couple of words. */
function isLogoHeading(heading: DomElement): boolean {
  const inner = descendants(heading);
  const linkedHome = [heading, ...inner].some((node) => node.tag === 'a' && ['/', '#', './', '#top'].includes((node.attrs.get('href') ?? '').trim()));
  const logoImage = inner.some((node) => node.tag === 'img' || node.tag === 'svg');
  return !!heading.parent && (heading.parent.tag === 'a' || linkedHome || logoImage) && textWords(heading) <= 3;
}

function isInside(element: DomElement, ancestor: DomElement): boolean {
  for (let node: DomElement | null = element; node; node = node.parent) if (node === ancestor) return true;
  return false;
}

/** Navigation, footer, and site-header chrome; a header holding the page's visible h1 is content. */
function isChrome(element: DomElement, holdsH1: (element: DomElement) => boolean): boolean {
  const role = element.attrs.get('role') ?? '';
  if (CHROME_ROLES.has(role) || element.tag === 'nav' || element.tag === 'footer') return true;
  return element.tag === 'header' && !holdsH1(element);
}

/**
 * "This element or an ancestor passes `test`", memoized per element. Each query fills the chain up to the nearest
 * known ancestor, so asking for every element of a deeply nested page stays linear.
 */
function ancestorFlag(test: (element: DomElement) => boolean): (element: DomElement) => boolean {
  const cache = new WeakMap<DomElement, boolean>();
  return (element) => {
    const chain: DomElement[] = [];
    let inherited = false;
    for (let node: DomElement | null = element; node && node.tag !== '#document'; node = node.parent) {
      const known = cache.get(node);
      if (known !== undefined) { inherited = known; break; }
      chain.push(node);
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      inherited = inherited || test(chain[i]!);
      cache.set(chain[i]!, inherited);
    }
    return cache.get(element) ?? inherited;
  };
}

const withinNavigation = ancestorFlag((node) => node.tag === 'nav' || node.attrs.get('role') === 'navigation');
const hiddenFromAssistiveTech = ancestorFlag((node) => node.attrs.get('aria-hidden') === 'true'
  || ['presentation', 'none'].includes(node.attrs.get('role') ?? ''));
const withinFooter = ancestorFlag((node) => node.tag === 'footer' || node.attrs.get('role') === 'contentinfo');

export function inNavigation(element: DomElement): boolean {
  return !!element.parent && element.parent.tag !== '#document' && withinNavigation(element.parent);
}

export function inFooter(element: DomElement): boolean {
  return withinFooter(element);
}

export function words(element: DomElement): number {
  return textWords(element);
}

export function isHeading(element: DomElement): boolean {
  return /^h[1-6]$/.test(element.tag) || element.attrs.get('role') === 'heading';
}

export function isCta(element: DomElement): boolean {
  const role = element.attrs.get('role');
  const type = element.attrs.get('type')?.toLowerCase();
  const actionable = (element.tag === 'a' && element.attrs.has('href')) || element.tag === 'button' || role === 'button'
    || (element.tag === 'input' && (type === 'submit' || type === 'button'));
  if (!actionable || inNavigation(element)) return false;
  const count = element.tag === 'input' ? wordCount(element.attrs.get('value') ?? '') : textWords(element) || wordCount(element.attrs.get('aria-label') ?? '');
  return count >= 1 && count <= 8;
}

const ctaHolders = new WeakMap<ParsedHtml, Set<DomElement>>();

/** Whether the element is or contains a call to action, from one pass over the page instead of a walk per element. */
export function containsCta(page: PageModel, element: DomElement): boolean {
  let holders = ctaHolders.get(page.html);
  if (!holders) {
    holders = new Set();
    for (const candidate of page.html.elements) {
      if (!isCta(candidate)) continue;
      for (let node: DomElement | null = candidate; node && node.tag !== '#document' && !holders.has(node); node = node.parent) holders.add(node);
    }
    ctaHolders.set(page.html, holders);
  }
  return holders.has(element);
}

/** Outermost CTAs, so a button inside a link is counted once. */
export function ctasIn(element: DomElement): DomElement[] {
  const out: DomElement[] = [];
  let insideUntil = -Infinity;
  for (const node of descendants(element)) {
    if (node.order <= insideUntil || !isCta(node)) continue;
    out.push(node);
    insideUntil = lastOrder(node);
  }
  return out;
}

export function fontSizePx(page: PageModel, element: DomElement): number {
  const declared = lengthPx(page.styles.get(element, 'font-size'), page.ctx);
  if (declared !== null) return declared;
  const defaults: Record<string, number> = { h1: 32, h2: 24, h3: 18.72, h4: 16, h5: 13.28, h6: 10.72 };
  return defaults[element.tag] ?? 16;
}

export function isCentered(page: PageModel, element: DomElement): boolean {
  const align = page.styles.get(element, 'text-align')?.trim();
  if (align === 'center') return true;
  if (align && align !== 'start' && align !== 'inherit') return false;
  let node = element.parent;
  for (let depth = 0; node && node.tag !== '#document' && depth < 3; depth++, node = node.parent) {
    const display = page.styles.get(node, 'display') ?? '';
    const alignItems = page.styles.pick(node, ['place-items', 'align-items'])?.value ?? '';
    const direction = page.styles.pick(node, ['flex-flow', 'flex-direction'])?.value ?? '';
    if (display.includes('flex') && direction.includes('column') && /\bcenter\b/.test(alignItems)) return true;
    const justifyItems = page.styles.pick(node, ['place-items', 'justify-items'])?.value ?? '';
    if (display.includes('grid') && /\bcenter\b/.test(justifyItems)) return true;
  }
  return false;
}

export function backgroundImage(page: PageModel, element: DomElement, box: 'element' | 'before' | 'after' = 'element'): string {
  const found = page.styles.pick(element, ['background', 'background-image'], box);
  if (!found) return '';
  return hasGradient(found.value) || urlsIn(found.value).length ? found.value : '';
}

export function backgroundColor(page: PageModel, element: DomElement): string {
  const found = page.styles.pick(element, ['background', 'background-color']);
  if (!found) return '';
  if (found.prop === 'background') {
    const stripped = found.value.replace(/(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)|url\([^)]*\)/gi, ' ');
    const color = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\([^()]*\)|\b(?:white|black|transparent)\b/i.exec(stripped);
    return color ? color[0] : '';
  }
  return found.value;
}

export function filterBlur(page: PageModel, element: DomElement, box: 'element' | 'before' | 'after' = 'element'): number {
  return blurPx(page.styles.pick(element, ['filter'], box)?.value, page.ctx);
}

export function backdropBlur(page: PageModel, element: DomElement): number {
  return blurPx(page.styles.pick(element, ['backdrop-filter', '-webkit-backdrop-filter'])?.value, page.ctx);
}

export function radius(page: PageModel, element: DomElement, box: 'element' | 'before' | 'after' = 'element') {
  return radiusOf(page.styles.pick(element, ['border-radius'], box)?.value, page.ctx);
}

/** Declared box size in px from attributes or styles; null when unknown. */
export function sizePx(page: PageModel, element: DomElement, axis: 'width' | 'height', box: 'element' | 'before' | 'after' = 'element'): number | null {
  if (box === 'element') {
    const attr = element.attrs.get(axis);
    if (attr && /^\d+(?:\.\d+)?(?:px)?$/.test(attr.trim())) return parseFloat(attr);
  }
  const value = page.styles.pick(element, [axis, axis === 'width' ? 'inline-size' : 'block-size', 'size'], box)?.value;
  const px = lengthPx(value, page.ctx);
  if (px !== null) return px;
  const min = lengthPx(page.styles.pick(element, [axis === 'width' ? 'min-width' : 'min-height'], box)?.value, page.ctx);
  return min;
}

export function isPositionedOut(page: PageModel, element: DomElement, box: 'element' | 'before' | 'after' = 'element'): boolean {
  const position = page.styles.pick(element, ['position'], box)?.value.trim();
  return position === 'absolute' || position === 'fixed';
}

export function zIndex(page: PageModel, element: DomElement, box: 'element' | 'before' | 'after' = 'element'): number | null {
  const value = page.styles.pick(element, ['z-index'], box)?.value;
  const parsed = value === undefined ? NaN : parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const ICON_CLASS = /(?:^|[\s_-])(?:icon|icons|fa|fas|far|fab|fa-[\w-]+|bi|bi-[\w-]+|lucide|lucide-[\w-]+|material-icons|material-symbols[\w-]*|ph|ph-[\w-]+|ri-[\w-]+|ti|ti-[\w-]+|heroicon[\w-]*|feather|octicon[\w-]*|iconify)(?:$|[\s_-])/i;
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️|\s)+$/u;

/** An icon: a small inline SVG, an icon font glyph, a small icon image, or a lone emoji. */
export function isIcon(page: PageModel, element: DomElement): boolean {
  if (element.tag === 'svg') {
    const size = Math.max(sizePx(page, element, 'width') ?? 0, sizePx(page, element, 'height') ?? 0);
    if (size > 0) return size <= 64;
    return element.classes.some((cls) => ICON_CLASS.test(cls) || /^(?:w|h|size)-(?:[3-9]|1[0-6])$/.test(cls)) || !isLargeSvg(element);
  }
  if ((element.tag === 'i' || element.tag === 'span') && element.classes.some((cls) => ICON_CLASS.test(cls))) return true;
  if (element.tag === 'img') {
    const size = Math.max(sizePx(page, element, 'width') ?? 0, sizePx(page, element, 'height') ?? 0);
    const src = element.attrs.get('src') ?? '';
    const alt = element.attrs.get('alt')?.trim() ?? '';
    const label = `${src} ${alt} ${element.classes.join(' ')}`;
    if (/\bicons?\b/i.test(label)) return true;
    // Small photos (avatars, product thumbnails) are content, not icons, and so is a round named portrait drawn as SVG.
    const portrait = !!alt && (radius(page, element).percent >= 50 || radius(page, element).px >= 999);
    const vector = /\.svgz?(?:[?#]|$)/i.test(src) || /^data:image\/svg/i.test(src);
    return !portrait && ((vector && (size === 0 || size <= 64)) || (size > 0 && size <= 24));
  }
  const text = ownText(element);
  return !!text && text.length <= 4 && EMOJI.test(text) && elementChildren(element).length === 0;
}

function isLargeSvg(element: DomElement): boolean {
  const viewBox = element.attrs.get('viewbox')?.split(/[\s,]+/).map(Number);
  return !!viewBox && viewBox.length === 4 && (viewBox[2]! > 64 || viewBox[3]! > 64);
}

/** An icon set before the title text inside a heading or term, as in `<dt><svg/>Push to deploy</dt>`. */
function leadingIcon(page: PageModel, title: DomElement): DomElement | null {
  for (const child of title.children) {
    if (child.kind === 'text') {
      if (child.text.trim()) return null;
      continue;
    }
    if (isIcon(page, child)) return child;
    if (hasText(child)) return null;
    const inner = descendants(child).find((node) => isIcon(page, node));
    if (inner) return inner;
  }
  return null;
}

export function firstIcon(page: PageModel, element: DomElement): DomElement | null {
  for (const node of descendants(element)) {
    if (isIcon(page, node)) return node;
    if (isHeading(node) || node.tag === 'dt') return leadingIcon(page, node);
    if (node.tag === 'p' && words(node) > 0) return null;
  }
  return null;
}

const MEDIA_TAGS = new Set(['img', 'picture', 'video', 'canvas', 'iframe', 'object', 'embed']);

const layerFlags = new WeakMap<PageModel, { aside: (element: DomElement) => boolean; behind: (element: DomElement) => boolean }>();

/** Ancestor-or-self flags: laid aside (out of flow, or behind), and behind (under the content, unclickable, or blurred). */
function layerOf(page: PageModel) {
  let flags = layerFlags.get(page);
  if (!flags) {
    const behind = (node: DomElement) => (zIndex(page, node) ?? 0) < 0 || page.styles.get(node, 'pointer-events')?.trim() === 'none'
      || blurPx(page.styles.pick(node, ['filter'])?.value, page.ctx) > 0;
    flags = { aside: ancestorFlag((node) => isPositionedOut(page, node) || behind(node)), behind: ancestorFlag(behind) };
    layerFlags.set(page, flags);
  }
  return flags;
}

/**
 * Decoration: hidden from assistive technology and laid out of flow or behind, or an empty-alt image under the content
 * or blurred. An aria-hidden demo in the flow, or an empty-alt screenshot merely positioned, is still a product visual.
 */
export function isDecoration(page: PageModel, element: DomElement): boolean {
  const layer = layerOf(page);
  if (hiddenFromAssistiveTech(element) && layer.aside(element)) return true;
  return element.tag === 'img' && element.attrs.get('alt') === '' && layer.behind(element);
}

/** Visual elements that could carry a product demonstration: media, large SVG, forms, tables, code. */
export function productVisuals(page: PageModel, element: DomElement): DomElement[] {
  return descendants(element).filter((node) => {
    if (!isRendered(page.styles, node)) return false;
    if (MEDIA_TAGS.has(node.tag) || node.tag === 'svg') {
      return !(node.tag === 'img' || node.tag === 'svg' ? isIcon(page, node) : false) && !isDecoration(page, node);
    }
    if (['table', 'form', 'pre', 'code', 'input', 'textarea', 'select', 'dl'].includes(node.tag)) return true;
    return !!backgroundImage(page, node) && urlsIn(backgroundImage(page, node)).length > 0;
  });
}

export function renderedChildren(page: PageModel, element: DomElement): DomElement[] {
  return visibleChildren(page.styles, element);
}

export function displayOf(page: PageModel, element: DomElement): string {
  return page.styles.get(element, 'display')?.trim() ?? '';
}

/** Grid column count when declared as repeat(n, …) or an explicit track list; 0 when unknown. */
export function gridColumns(page: PageModel, element: DomElement): number {
  const value = page.styles.pick(element, ['grid-template-columns', 'grid-template', 'grid'])?.value ?? '';
  const repeat = /repeat\(\s*(\d+)\s*,/.exec(value);
  if (repeat) return parseInt(repeat[1]!, 10);
  if (/auto-(?:fit|fill)/.test(value)) return -1;
  const tracks = value.split('/')[0]!.trim().split(/\s+(?![^(]*\))/).filter(Boolean);
  return tracks.length > 1 ? tracks.length : 0;
}

/** Laid out as one row: a flex row, or a grid with at least `minColumns` (or auto-fit) columns. */
export function isRowLayout(page: PageModel, element: DomElement, minColumns: number): boolean {
  const display = displayOf(page, element);
  if (display.includes('flex')) {
    const direction = page.styles.pick(element, ['flex-flow', 'flex-direction'])?.value ?? 'row';
    return !direction.includes('column');
  }
  if (display.includes('grid')) {
    const columns = gridColumns(page, element);
    return columns === -1 || columns >= minColumns;
  }
  return false;
}
