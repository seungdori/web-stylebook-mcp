import { descendants, elementChildren, hasText, ownText, type DomElement } from './dom/html.js';
import {
  backdropBlur, backgroundColor, backgroundImage, gridColumns, isCentered, isHeading, isIcon, radius,
  renderedChildren, sizePx, words, type PageModel,
} from './dom/page.js';
import { colorsIn, hasGradient, parseColor, parseShadows, splitTopLevel, toHsl, urlsIn, type Rgba } from './dom/values.js';
import { contentElements, isSectionRoot, isStockSource, type DetectionStatus, type PatternMatch } from './detect.js';
import { T } from './patterns.js';
import type { StyleBanDef, StyleRuleParams } from './types.js';

const BOXES = ['element', 'before', 'after'] as const;
const SURFACE_TAGS = new Set([
  'div', 'section', 'article', 'aside', 'figure', 'header', 'footer', 'li', 'ul', 'ol', 'form', 'table', 'img',
  'picture', 'video', 'button', 'a', 'input', 'select', 'textarea', 'details', 'dialog', 'blockquote', 'pre', 'span',
]);

export interface RuleContext {
  /** The style's own status colours (positive, caution, critical, info); state messages built from them are not accents. */
  statusColors: readonly Rgba[];
}

const NO_CONTEXT: RuleContext = { statusColors: [] };

function result(matches: PatternMatch[]): DetectionStatus {
  return matches.length ? { status: 'found', matches } : { status: 'absent' };
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const BORDER_COLORS = ['border', 'border-color', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'];

/** A width that draws a line in a colour that shows; a border whose only colour is transparent reserves hover space. */
function drawnBorder(value: string): boolean {
  if (!/[1-9]/.test(value) || /\bnone\b|\bhidden\b|^\s*0(?:px)?\s*$/.test(value.trim())) return false;
  const colors = colorsIn(value);
  return !colors.length || colors.some((color) => color.a > 0.01);
}

/** The `border-width` value that applies to one side, from its one to four space-separated values. */
function widthForSide(value: string, side: (typeof SIDES)[number]): string {
  const parts = value.trim().split(/\s+/);
  const [top, right = top, bottom = top, left = right] = parts;
  return { top, right, bottom, left }[side] ?? '';
}

function drawnSides(page: PageModel, element: DomElement): number {
  const all = drawnBorder(page.styles.get(element, 'border') ?? '');
  const widths = page.styles.get(element, 'border-width') ?? '';
  return SIDES.filter((side) => all || drawnBorder(widthForSide(widths, side))
    || drawnBorder(page.styles.get(element, `border-${side}`) ?? '') || drawnBorder(page.styles.get(element, `border-${side}-width`) ?? '')).length;
}

function hasBorder(page: PageModel, element: DomElement): boolean {
  return drawnSides(page, element) > 0;
}

function opaqueFill(page: PageModel, element: DomElement): Rgba | null {
  const color = parseColor(backgroundColor(page, element));
  return color && color.a > 0.02 ? color : null;
}

/**
 * A container with content plus its own border, shadow, or fill: what readers perceive as a card or panel. Page
 * sections are bands, not cards, even when tinted, so a full-bleed band never needs a card's corners.
 */
export function isCardLike(page: PageModel, element: DomElement): boolean {
  if (!SURFACE_TAGS.has(element.tag) || ['img', 'picture', 'video', 'input', 'select', 'textarea', 'a', 'button', 'span'].includes(element.tag)) return false;
  if (isSectionRoot(page, element)) return false;
  if (!(words(element) >= 3 || elementChildren(element).length >= 2)) return false;
  const shadow = parseShadows(page.styles.pick(element, ['box-shadow'])?.value, page.ctx).some((layer) => !layer.inset);
  const fill = opaqueFill(page, element);
  const parentFill = element.parent ? opaqueFill(page, element.parent) : null;
  const ownFill = !!fill && (!parentFill || Math.abs(toHsl(fill).l - toHsl(parentFill).l) > 0.02 || fill.a < 0.98);
  // A rule on one or two sides divides a list; it takes a frame of three or more sides to make a card.
  return drawnSides(page, element) >= 3 || shadow || ownFill || !!backgroundImage(page, element);
}

function shadowLayers(page: PageModel, element: DomElement, box: (typeof BOXES)[number] = 'element') {
  return parseShadows(page.styles.pick(element, ['box-shadow'], box)?.value, page.ctx).filter((layer) => !layer.inset);
}

/** A round box: equal sides (or unknown sides with a 50% radius) fully rounded. A pill has unequal sides. */
function isCircle(page: PageModel, element: DomElement, corners: { px: number; percent: number }): boolean {
  const width = sizePx(page, element, 'width') ?? 0;
  const height = sizePx(page, element, 'height') ?? 0;
  const square = width > 0 && height > 0 && Math.abs(width - height) <= Math.max(width, height) * 0.1;
  if (corners.percent >= 50) return square || width === 0 || height === 0;
  return square && corners.px >= Math.min(width, height) / 2;
}

function cornerRadius(page: PageModel, elements: DomElement[], p: StyleRuleParams['corner-radius']): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const element of elements) {
    if (!SURFACE_TAGS.has(element.tag)) continue;
    const corners = radius(page, element);
    if (p.max !== undefined) {
      const rounded = corners.px > p.max || corners.percent >= 10;
      if (!rounded) continue;
      const circle = isCircle(page, element, corners);
      const size = Math.max(sizePx(page, element, 'width') ?? 0, sizePx(page, element, 'height') ?? 0);
      if (circle && (p.allowCircles || (!hasText(element) && size <= 48))) continue;
      if (element.tag === 'span' && !hasText(element)) continue;
      out.push({ element, observed: { radiusPx: corners.px, radiusPercent: corners.percent } });
    } else if (p.min !== undefined && isCardLike(page, element)) {
      if (corners.px >= p.min || corners.percent >= 10) continue;
      out.push({ element, observed: { radiusPx: corners.px } });
    }
  }
  return out;
}

function shadowRule(page: PageModel, elements: DomElement[], test: (layers: ReturnType<typeof shadowLayers>) => Record<string, number> | null): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const element of elements) {
    for (const box of BOXES) {
      if (box !== 'element' && !page.styles.hasPseudo(element, box)) continue;
      const observed = test(shadowLayers(page, element, box));
      if (observed) { out.push({ element, observed: { ...observed, box } }); break; }
    }
  }
  return out;
}

function gradientText(page: PageModel, element: DomElement): boolean {
  const clip = page.styles.pick(element, ['background-clip', '-webkit-background-clip'])?.value ?? '';
  return /\btext\b/.test(clip) && hasGradient(backgroundImage(page, element)) && hasText(element);
}

function gradientFill(page: PageModel, elements: DomElement[], p: StyleRuleParams['gradient-fill']): PatternMatch[] {
  if (p.scope === 'text') return elements.filter((element) => gradientText(page, element)).map((element) => ({ element, observed: { gradientText: true } }));
  if (p.scope === 'cards') {
    const out: PatternMatch[] = [];
    for (const container of elements) {
      const cards = renderedChildren(page, container).filter((child) => isCardLike(page, child) && hasGradient(backgroundImage(page, child)));
      if (cards.length >= T.cardsMin) out.push({ element: container, observed: { gradientCards: cards.length } });
    }
    return out;
  }
  const out: PatternMatch[] = [];
  for (const element of elements) {
    if (['img', 'picture', 'video', 'svg'].includes(element.tag)) continue;
    for (const box of BOXES) {
      if (box !== 'element' && !page.styles.hasPseudo(element, box)) continue;
      const image = backgroundImage(page, element, box);
      if (hasGradient(image)) { out.push({ element, observed: { box, gradient: image.slice(0, 160) } }); break; }
    }
  }
  return out;
}

function isGlow(layer: { x: number; y: number; blur: number; color: Rgba | null }): boolean {
  if (!layer.color || layer.color.a < 0.2) return false;
  const hsl = toHsl(layer.color);
  return layer.blur >= T.glowMinBlurPx && Math.abs(layer.x) <= T.glowMaxOffsetPx && Math.abs(layer.y) <= T.glowMaxOffsetPx
    && hsl.s >= 0.45 && hsl.l >= 0.2 && hsl.l <= 0.85;
}

function glow(page: PageModel, elements: DomElement[], p: StyleRuleParams['glow']): PatternMatch[] {
  const glowing: PatternMatch[] = [];
  for (const element of elements) {
    const text = parseShadows(page.styles.pick(element, ['text-shadow'])?.value, page.ctx).some(isGlow) && hasText(element);
    // Inset and pseudo-element glows light the element just the same, so they count toward the budget.
    const box = p.target === 'any' && BOXES.some((part) => (part === 'element' || page.styles.hasPseudo(element, part))
      && parseShadows(page.styles.pick(element, ['box-shadow'], part)?.value, page.ctx).some(isGlow));
    if (text || box) glowing.push({ element, observed: { textGlow: text, boxGlow: box } });
  }
  return glowing.length > p.maxElements ? glowing : [];
}

const TEXT_BLOCKS = new Set(['p', 'li', 'blockquote', 'dd', 'figcaption', 'td']);

function textBlocks(elements: DomElement[], minWords: number): DomElement[] {
  return elements.filter((element) => TEXT_BLOCKS.has(element.tag) && words(element) >= minWords);
}

function animationOf(page: PageModel, element: DomElement): string {
  const shorthand = page.styles.pick(element, ['animation', 'animation-name']);
  if (!shorthand || /^\s*none\s*$/i.test(shorthand.value)) return '';
  const count = page.styles.pick(element, ['animation-iteration-count'])?.value ?? '';
  return `${shorthand.value} ${count}`.trim();
}

function stoppedByReduce(page: PageModel, element: DomElement): boolean {
  const reduced = page.styles.reducedValue(element, ['animation', 'animation-name', 'animation-play-state', 'animation-duration', 'animation-iteration-count']);
  if (reduced === undefined) return false;
  if (/\bnone\b|\bpaused\b/i.test(reduced)) return true;
  const durations = durationsMs(reduced);
  if (durations.length && Math.max(...durations) <= 10) return true;
  return /(?:^|\s)1(?:\s|$)/.test(reduced) && !/\binfinite\b/i.test(reduced);
}

function unguardedMotion(page: PageModel, elements: DomElement[], p: StyleRuleParams['unguarded-motion']): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const element of [...elements, ...pageLevel(page)]) {
    const animation = animationOf(page, element);
    if (!animation) continue;
    if (!p.includeFinite && !/\binfinite\b/i.test(animation)) continue;
    if (page.styles.motionOf(element, ['animation', 'animation-name']) === 'no-preference' || stoppedByReduce(page, element)) continue;
    out.push({ element, observed: { animation: animation.slice(0, 120) } });
  }
  return out;
}

function durationsMs(value: string | undefined): number[] {
  if (!value) return [];
  return [...value.matchAll(/(-?\d*\.?\d+)(ms|s)\b/g)].map((match) => parseFloat(match[1]!) * (match[2] === 's' ? 1000 : 1));
}

/** Longest transition duration; in the shorthand only the first time of each transition is its duration. */
function transitionMs(page: PageModel, element: DomElement): number {
  const transition = page.styles.pick(element, ['transition', 'transition-duration']);
  if (!transition) return 0;
  const parts = transition.prop === 'transition'
    ? transition.value.split(',').map((part) => part.trim().split(/\s+/).find((token) => /\d(?:ms|s)$/.test(token)) ?? '')
    : [transition.value];
  return Math.max(0, ...durationsMs(parts.join(' ')));
}

const STEPPED = /steps\(|step-start|step-end/i;

/** Every listed transition or animation advances in discrete frames, which is how a snapping style moves. */
function stepped(value: string | undefined): boolean {
  const parts = value ? splitTopLevel(value, ',').filter((part) => part.trim()) : [];
  return parts.length > 0 && parts.every((part) => STEPPED.test(part));
}

function easedMotion(page: PageModel, elements: DomElement[], p: StyleRuleParams['eased-motion']): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const element of elements) {
    const timing = page.styles.pick(element, ['transition-timing-function'])?.value ?? page.styles.pick(element, ['transition'])?.value;
    const duration = stepped(timing) ? 0 : transitionMs(page, element);
    const animation = animationOf(page, element);
    const timedAnimation = page.styles.pick(element, ['animation-timing-function'])?.value ?? animation;
    const easedAnimation = !!animation && !stepped(timedAnimation);
    if (duration > p.maxDurationMs || easedAnimation) out.push({ element, observed: { transitionMs: duration, easedAnimation } });
  }
  return out;
}

function pageLevel(page: PageModel): DomElement[] {
  return page.html.elements.filter((element) => element.tag === 'html' || element.tag === 'body' || element.tag === 'main');
}

const HUE_PROPS = [
  'color', 'background', 'background-color', 'background-image', 'border', 'border-color', 'border-top', 'border-bottom',
  'border-left', 'border-right', 'border-top-color', 'border-bottom-color', 'outline-color', 'box-shadow', 'text-shadow',
  'fill', 'stroke', 'text-decoration-color', '--tw-gradient-from', '--tw-gradient-via', '--tw-gradient-to',
];

function nearColor(a: Rgba, b: Rgba): boolean {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b) <= 24;
}

function hueFamilies(page: PageModel, elements: DomElement[], minSaturation: number, exempt: readonly Rgba[]): Map<number, string> {
  const families = new Map<number, string>();
  const add = (value: string | undefined, where: string) => {
    if (!value) return;
    for (const color of colorsIn(value)) {
      if (color.a < 0.25 || exempt.some((status) => nearColor(color, status))) continue;
      const hsl = toHsl(color);
      if (hsl.s < minSaturation || hsl.l < T.saturatedMinLightness || hsl.l > T.saturatedMaxLightness) continue;
      const family = Math.floor((((hsl.h + 15) % 360) + 360) % 360 / 30);
      if (!families.has(family)) families.set(family, where);
    }
  };
  for (const element of [...pageLevel(page), ...elements]) {
    for (const prop of HUE_PROPS) {
      const found = page.styles.pick(element, [prop]);
      if (found) add(found.value, element.tag);
    }
    for (const attr of ['fill', 'stroke', 'stop-color', 'color']) add(element.attrs.get(attr), element.tag);
  }
  return families;
}

function accentHues(page: PageModel, elements: DomElement[], p: StyleRuleParams['accent-hues'], context: RuleContext): PatternMatch[] {
  // A floor on accent hues counts every hue the page shows; only a cap leaves the status colours out.
  const families = hueFamilies(page, elements, p.minSaturation, p.min !== undefined ? [] : context.statusColors);
  const count = families.size;
  const flagged = p.min !== undefined ? count < p.min : count > (p.max ?? 0);
  return flagged ? [{ element: page.root, observed: { hueFamilies: count, hues: [...families.keys()].sort((a, b) => a - b).map((family) => family * 30).join(',') } }] : [];
}

/** The fill behind the content: the nearest painted box from the content root up, which app shells put on a wrapper. */
function canvasFill(page: PageModel): { element: DomElement; color: Rgba } | null {
  for (let node: DomElement | null = page.root; node && node.tag !== '#document'; node = node.parent) {
    const color = opaqueFill(page, node);
    if (color) return { element: node, color };
  }
  return null;
}

function canvas(page: PageModel, elements: DomElement[], p: StyleRuleParams['canvas']): DetectionStatus {
  const roots = pageLevel(page);
  const declared = canvasFill(page);
  const anyStyles = page.styles.ruleCount > 0
    || page.html.elements.some((element) => element.attrs.has('style') || element.classes.length > 0);
  if (!declared && !(roots.length && anyStyles)) return { status: 'not-verified', reason: 'no canvas background is declared and the input carries no page-level styles' };
  // Nothing painted at all: the browser's white canvas shows through.
  const color = declared?.color ?? { r: 255, g: 255, b: 255, a: 1 };
  const anchor = declared?.element ?? roots[0] ?? page.root;
  const lightness = toHsl(color).l;
  const white = color.r >= 254 && color.g >= 254 && color.b >= 254;
  const sections = (p.forbid === 'dark' || p.forbid === 'light')
    ? elements.filter((element) => page.sections.includes(element) || element === page.opening)
      .map((element) => ({ element, color: opaqueFill(page, element) }))
      .filter((entry): entry is { element: DomElement; color: Rgba } => !!entry.color && entry.color.a > 0.9)
    : [];
  const matches: PatternMatch[] = [];
  const observed = { canvas: `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`, declared: !!declared };
  if (p.forbid === 'pure-white' && white) matches.push({ element: anchor, observed });
  if (p.forbid === 'tinted' && !white) matches.push({ element: anchor, observed });
  if (p.forbid === 'light') {
    if (lightness >= 0.6) matches.push({ element: anchor, observed });
    for (const section of sections) if (toHsl(section.color).l >= 0.6) matches.push({ element: section.element, observed: { sectionLightness: Number(toHsl(section.color).l.toFixed(2)) } });
  }
  if (p.forbid === 'dark') {
    if (lightness <= 0.35) matches.push({ element: anchor, observed });
    for (const section of sections) if (toHsl(section.color).l <= 0.35) matches.push({ element: section.element, observed: { sectionLightness: Number(toHsl(section.color).l.toFixed(2)) } });
  }
  return result(matches);
}

function textOnEffect(page: PageModel, elements: DomElement[], p: StyleRuleParams['text-on-effect']): PatternMatch[] {
  // The surface a box's text sits on, memoized so every text block of a deep page shares one walk up.
  const surfaceOf = new Map<DomElement, DomElement | null>();
  const own = (node: DomElement): DomElement | null | undefined => {
    const fill = opaqueFill(page, node);
    if (p.surface === 'gradient') {
      const image = backgroundImage(page, node);
      if (hasGradient(image) || urlsIn(image).length) return node;
    } else if (backdropBlur(page, node) > 0 && (!fill || fill.a < 0.9)) {
      return node;
    }
    return fill && fill.a >= 0.9 ? null : undefined;
  };
  const surface = (start: DomElement): DomElement | null => {
    const chain: DomElement[] = [];
    let found: DomElement | null = null;
    for (let node: DomElement | null = start; node && node.tag !== '#document'; node = node.parent) {
      if (surfaceOf.has(node)) { found = surfaceOf.get(node)!; break; }
      chain.push(node);
      const decided = own(node);
      if (decided !== undefined) { found = decided; break; }
    }
    for (const node of chain) surfaceOf.set(node, found);
    return found;
  };
  const out: PatternMatch[] = [];
  for (const block of textBlocks(elements, p.minWords)) {
    const node = surface(block);
    if (node) out.push({ element: block, observed: { surface: node.tag, words: words(block) } });
  }
  return out;
}

function nestedSurfaces(page: PageModel, elements: DomElement[], p: StyleRuleParams['nested-surfaces']): PatternMatch[] {
  const test = p.kind === 'glass' ? (element: DomElement) => backdropBlur(page, element) > 0 : (element: DomElement) => isCardLike(page, element) && radius(page, element).px >= 4;
  const surfaces = new Set(elements.filter(test));
  // Deepest first, so each element learns which surface it holds from its children in one pass.
  const innerOf = new Map<DomElement, DomElement>();
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!;
    const inner = surfaces.has(element) ? element : innerOf.get(element);
    if (inner && element.parent) innerOf.set(element.parent, inner);
  }
  const out: PatternMatch[] = [];
  const covered = new Set<DomElement>();
  for (const element of elements) {
    if (element.parent && covered.has(element.parent)) { covered.add(element); continue; }
    const inner = innerOf.get(element);
    if (!surfaces.has(element) || !inner) continue;
    covered.add(element);
    out.push({ element, observed: { nested: inner.tag } });
  }
  return out;
}

function iconTiles(page: PageModel, elements: DomElement[], p: StyleRuleParams['icon-tiles']): PatternMatch[] {
  const tiles: PatternMatch[] = [];
  for (const element of elements) {
    if (hasText(element) && !ownText(element).match(/^\p{Extended_Pictographic}+$/u)) continue;
    const kids = elementChildren(element);
    const icon = kids.length === 1 && isIcon(page, kids[0]!) ? kids[0] : kids.length === 0 && isIcon(page, element) ? element : null;
    if (!icon) continue;
    const size = Math.max(sizePx(page, element, 'width') ?? 0, sizePx(page, element, 'height') ?? 0);
    if (size === 0 || size > T.iconTileMaxPx) continue;
    if (!opaqueFill(page, element) && !hasBorder(page, element) && !backgroundImage(page, element)) continue;
    tiles.push({ element, observed: { tilePx: size } });
  }
  return tiles.length > p.maxTiles ? tiles : [];
}

function faintBorders(page: PageModel, elements: DomElement[], p: StyleRuleParams['faint-borders']): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const element of elements) {
    if (!hasBorder(page, element)) continue;
    // A fully transparent border reserves space for a state change; it is not a faint line.
    const colors = BORDER_COLORS.flatMap((prop) => colorsIn(page.styles.get(element, prop) ?? '')).filter((color) => color.a > 0.01);
    const faintest = colors.reduce<Rgba | null>((low, color) => (!low || color.a < low.a ? color : low), null);
    if (faintest && faintest.a < p.minAlpha) out.push({ element, observed: { borderAlpha: Number(faintest.a.toFixed(2)) } });
  }
  return out;
}

const MONO = /mono|\bcode\b|courier|consol|menlo|monaco|typewriter|vt323|pixel|press start|silkscreen|share tech|ocr-?a/i;
const SERIF = /serif|garamond|georgia|times|playfair|cormorant|baskerville|bodoni|didot|caslon|merriweather|lora\b|fraunces|crimson|spectral|newsreader|literata|gloock|abril|libre caslon|young serif|dm serif|instrument serif|noto serif|source serif|pt serif|ibm plex serif|myeongjo|mincho|batang|vollkorn|alegreya|cardo|cormorant|domine|eb garamond|gelasio|libre baskerville|lusitana|marcellus|noto serif|old standard|petrona|prata|roboto serif|rokkitt|sorts mill|zilla slab|roboto slab|bitter|arvo|tinos|charter|iowan|palatino|hoefler|minion|sabon|tiempos|canela|editorial new|gt sectra|freight/i;
const SANS = /\binter\b|arial|helvetica|roboto(?! (?:serif|slab|mono))|segoe|system-ui|-apple-system|blinkmacsystemfont|geist(?! mono)|manrope|grotesk|grotesque|poppins|montserrat|\blato\b|nunito|rubik|mulish|raleway|oswald|bebas|\banton\b|\bsyne\b|unbounded|\bsora\b|lexend|urbanist|onest|outfit|figtree|satoshi|archivo|barlow|karla|pretendard|spoqa|\bsuit\b|gothic|meiryo|hiragino|avenir|futura|verdana|tahoma|trebuchet|neue|akzidenz|univers\b|frutiger|\bdin\b|eurostile|chivo|epilogue|\bjost\b|questrial|quicksand|varela|josefin|fredoka|baloo|comfortaa|space grotesk|ibm plex sans|work sans/i;

/** The face a stack renders in: the first family this knows, falling back to the stack's generic family. */
export function faceClass(family: string): 'monospace' | 'serif' | 'sans' {
  for (const raw of family.split(',')) {
    const name = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!name) continue;
    if (/^(?:ui-)?monospace$/i.test(name) || MONO.test(name)) return 'monospace';
    if (/sans/i.test(name) || SANS.test(name)) return 'sans';
    if (/^(?:ui-)?serif$/i.test(name) || SERIF.test(name)) return 'serif';
  }
  return 'sans';
}

function typeface(page: PageModel, elements: DomElement[], p: StyleRuleParams['typeface']): DetectionStatus {
  const targets = elements.filter((element) => (p.role === 'display' ? element.tag === 'h1' || element.tag === 'h2' : (element.tag === 'p' || element.tag === 'li') && words(element) >= 3));
  const declared = targets.map((element) => ({ element, family: page.styles.get(element, 'font-family') })).filter((entry) => entry.family);
  if (targets.length && !declared.length) return { status: 'not-verified', reason: `no font-family is declared for the ${p.role} text` };
  const forbidFamilies = (p.forbidFamilies ?? []).map((family) => family.toLowerCase());
  const matches = declared.filter(({ family }) => {
    const face = faceClass(family!);
    const first = family!.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
    return (p.require !== undefined && face !== p.require) || (p.forbid ?? []).includes(face) || forbidFamilies.includes(first);
  }).map(({ element, family }) => ({ element, observed: { family: family!.slice(0, 120), face: faceClass(family!) } }));
  return result(matches);
}

const ILLUSTRATION_NAME = /illustration|illo|artwork|hero-art|blob|doodle|undraw|storyset|drawkit|isometric/i;
const SHAPES = new Set(['path', 'circle', 'rect', 'polygon', 'ellipse', 'line', 'polyline']);
const EMOJI_START = /^\s*(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u;

function imagery(page: PageModel, elements: DomElement[], p: StyleRuleParams['imagery']): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const element of elements) {
    const decorative = element.attrs.get('aria-hidden') === 'true' || element.attrs.get('alt') === ''
      || ['presentation', 'none'].includes(element.attrs.get('role') ?? '');
    if (p.forbid.includes('illustration')) {
      if (element.tag === 'svg' && !isIcon(page, element)) {
        const size = Math.max(sizePx(page, element, 'width') ?? 0, sizePx(page, element, 'height') ?? 0);
        const shapes = descendants(element).filter((node) => SHAPES.has(node.tag)).length;
        if ((size >= T.illustrationMinPx || shapes >= 12) && (decorative || !element.attrs.has('aria-label'))) {
          out.push({ element, observed: { kind: 'illustration', sizePx: size, shapes } });
          continue;
        }
      }
      if (element.tag === 'img' && ILLUSTRATION_NAME.test(`${element.attrs.get('src') ?? ''} ${element.classes.join(' ')} ${element.attrs.get('alt') ?? ''}`)) {
        out.push({ element, observed: { kind: 'illustration' } });
        continue;
      }
    }
    if (p.forbid.includes('photo') && (element.tag === 'img' || element.tag === 'source')) {
      const src = element.attrs.get('src') ?? element.attrs.get('srcset') ?? '';
      const size = Math.max(sizePx(page, element, 'width') ?? 0, sizePx(page, element, 'height') ?? 0);
      if ((/\.(?:jpe?g|webp|avif)(?:[?#\s]|$)/i.test(src) || isStockSource(src)) && (size === 0 || size > T.photoMinPx) && !isIcon(page, element)) {
        out.push({ element, observed: { kind: 'photo', src: src.slice(0, 160) } });
        continue;
      }
    }
    if (p.forbid.includes('emoji') && (isHeading(element) || element.tag === 'span' || element.tag === 'div') && EMOJI_START.test(ownText(element))) {
      out.push({ element, observed: { kind: 'emoji' } });
    }
  }
  return out;
}

/** Tracks a grid item spans: `span n`, or a line range such as `1 / 8` or `1 / -1`. */
function spanOf(page: PageModel, item: DomElement, columns: number): number {
  const value = page.styles.pick(item, ['grid-column', 'grid-area'])?.value ?? '';
  const span = /span\s+(\d+)/.exec(value);
  if (span) return Math.min(columns, Math.max(1, parseInt(span[1]!, 10)));
  const range = /^\s*(-?\d+)\s*\/\s*(-?\d+)\s*$/.exec(value);
  if (!range) return 1;
  const line = (n: number) => (n < 0 ? columns + 2 + n : n);
  return Math.min(columns, Math.max(1, line(parseInt(range[2]!, 10)) - line(parseInt(range[1]!, 10))));
}

/** The most items that sit side by side in one row, packing spans in source order the way the grid auto-places them. */
function itemsPerRow(page: PageModel, grid: DomElement, columns: number): number {
  let most = 0; let count = 0; let used = 0;
  for (const item of renderedChildren(page, grid)) {
    const span = spanOf(page, item, columns);
    if (used + span > columns) { most = Math.max(most, count); count = 0; used = 0; }
    count += 1; used += span;
  }
  return Math.max(most, count);
}

function crowdedGrid(page: PageModel, elements: DomElement[], p: StyleRuleParams['crowded-grid']): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const element of elements) {
    if (!(page.styles.get(element, 'display') ?? '').includes('grid')) continue;
    const columns = gridColumns(page, element);
    if (columns <= p.maxColumns) continue;
    const perRow = itemsPerRow(page, element, columns);
    if (perRow > p.maxColumns) out.push({ element, observed: { columns, itemsPerRow: perRow } });
  }
  return out;
}

function centeredCopy(page: PageModel, elements: DomElement[], p: StyleRuleParams['centered-copy']): PatternMatch[] {
  return textBlocks(elements, p.minWords).filter((element) => element.tag === 'p' && isCentered(page, element))
    .map((element) => ({ element, observed: { words: words(element) } }));
}

export function detectStyleBan(page: PageModel, ban: StyleBanDef, context: RuleContext = NO_CONTEXT): DetectionStatus {
  const elements = contentElements(page);
  const cap = (matches: PatternMatch[]) => result(matches.slice(0, 50));
  switch (ban.rule) {
    case 'corner-radius': return cap(cornerRadius(page, elements, ban.params));
    case 'shadow-blur': return cap(shadowRule(page, elements, (layers) => {
      const blur = Math.max(0, ...layers.map((layer) => layer.blur));
      return blur > ban.params.maxBlurPx ? { blurPx: blur } : null;
    }));
    case 'hard-shadow': return cap(shadowRule(page, elements, (layers) => {
      const hard = layers.find((layer) => layer.blur === 0 && Math.max(Math.abs(layer.x), Math.abs(layer.y)) >= ban.params.minOffsetPx);
      return hard ? { offsetX: hard.x, offsetY: hard.y } : null;
    }));
    case 'shadow-layers': return cap(shadowRule(page, elements, (layers) => (layers.length > ban.params.maxLayers ? { layers: layers.length } : null)));
    case 'gradient-fill': return cap(gradientFill(page, elements, ban.params));
    case 'backdrop-blur': return cap(elements.filter((element) => backdropBlur(page, element) > ban.params.maxBlurPx)
      .map((element) => ({ element, observed: { backdropBlurPx: backdropBlur(page, element) } })));
    case 'glow': return cap(glow(page, elements, ban.params));
    case 'centered-copy': return cap(centeredCopy(page, elements, ban.params));
    case 'unguarded-motion': return cap(unguardedMotion(page, elements, ban.params));
    case 'eased-motion': return cap(easedMotion(page, elements, ban.params));
    case 'accent-hues': return cap(accentHues(page, elements, ban.params, context));
    case 'canvas': return canvas(page, elements, ban.params);
    case 'text-on-effect': return cap(textOnEffect(page, elements, ban.params));
    case 'nested-surfaces': return cap(nestedSurfaces(page, elements, ban.params));
    case 'icon-tiles': return cap(iconTiles(page, elements, ban.params));
    case 'faint-borders': return cap(faintBorders(page, elements, ban.params));
    case 'typeface': return typeface(page, elements, ban.params);
    case 'imagery': return cap(imagery(page, elements, ban.params));
    case 'crowded-grid': return cap(crowdedGrid(page, elements, ban.params));
  }
}

