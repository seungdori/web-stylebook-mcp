import { parseCss, parseInlineStyle, type CssDeclaration, type MotionCondition } from './css.js';
import { elementChildren, type DomElement, type ParsedHtml } from './html.js';
import {
  compareSpecificity, parseSelector, selectorKey, SelectorMatcher, type ComplexSelector, type Specificity,
} from './selector.js';
import { tailwindDeclarations } from './tailwind.js';
import { splitTopLevel, type LengthContext } from './values.js';

interface Entry {
  value: string;
  important: boolean;
  inline: boolean;
  specificity: Specificity;
  order: number;
  motion: MotionCondition;
}

type Box = 'element' | 'before' | 'after';
type Store = Map<string, Entry>;

const INHERITED = new Set([
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-align', 'text-transform',
  'letter-spacing', 'visibility', 'line-height', 'pointer-events',
]);
const TAILWIND_ORDER_BASE = 1e9;
const SPECIFICITY_INLINE: Specificity = [0, 0, 0];
/**
 * Compound-selector checks one page may spend. The 48 rendered specimen pages use 60,000-630,000, and a page eight
 * times the largest specimen with its 1.4 MB of CSS stays under it; past it the audit reports not verified.
 */
export const MATCH_BUDGET = 5_000_000;
/** A resolved custom property longer than this is treated as invalid, which stops var() fan-out from exploding. */
const MAX_CUSTOM_VALUE = 10_000;
/** Custom properties referencing custom properties deeper than this resolve as invalid instead of exhausting the stack. */
const MAX_CUSTOM_DEPTH = 64;
const NON_RENDERED = new Set(['script', 'style', 'template', 'head', 'meta', 'link', 'title', 'noscript']);

function outranks(a: Entry, b: Entry): boolean {
  if (a.important !== b.important) return a.important;
  if (a.inline !== b.inline) return a.inline;
  const bySpecificity = compareSpecificity(a.specificity, b.specificity);
  if (bySpecificity !== 0) return bySpecificity > 0;
  return a.order > b.order;
}

interface IndexedRule {
  selector: ComplexSelector;
  declarations: CssDeclaration[];
  order: number;
  motion: MotionCondition;
}

function collectClasses(selector: ComplexSelector, into: Set<string>): void {
  for (const compound of selector.compounds) {
    for (const cls of compound.classes) into.add(cls);
    for (const pseudo of compound.pseudos) for (const item of pseudo.list ?? []) collectClasses(item, into);
  }
}

/** Declared styles of a parsed page: CSS rules, <style> blocks, inline styles and Tailwind utilities. */
export class StyledDocument {
  readonly keyframes: Set<string>;
  readonly unparsedSelectors: number;
  readonly ruleCount: number;
  /** The match budget ran out, so some rules were never applied and the styles are incomplete. */
  readonly exhausted: boolean;
  private readonly boxes = new Map<DomElement, Partial<Record<Box, Store>>>();
  private readonly reduced = new Map<DomElement, Store>();
  private readonly hasHtmlRoot: boolean;
  private readonly customCache = new Map<DomElement, Map<string, string | null>>();
  private readonly resolving = new Set<string>();
  private customDepth = 0;
  private readonly hiddenCache = new Map<DomElement, boolean>();

  constructor(readonly doc: ParsedHtml, cssSources: readonly string[], readonly ctx: LengthContext) {
    this.hasHtmlRoot = doc.elements.some((element) => element.tag === 'html');
    const byId = new Map<string, IndexedRule[]>();
    const byClass = new Map<string, IndexedRule[]>();
    const byTag = new Map<string, IndexedRule[]>();
    const universal: IndexedRule[] = [];
    const authorClasses = new Set<string>();
    const keyframes = new Set<string>();
    let unparsed = 0;
    let ruleCount = 0;
    let order = 0;
    for (const source of [...cssSources, ...doc.styleSheets]) {
      const parsed = parseCss(source, ctx, order);
      order += parsed.rules.length + 1;
      for (const name of parsed.keyframes) keyframes.add(name);
      ruleCount += parsed.rules.length;
      for (const rule of parsed.rules) {
        for (const text of splitTopLevel(rule.selectorText)) {
          const selector = parseSelector(text);
          if (!selector) { unparsed++; continue; }
          collectClasses(selector, authorClasses);
          const indexed: IndexedRule = { selector, declarations: rule.declarations, order: rule.order, motion: rule.motion };
          const key = selectorKey(selector);
          const bucket = key.kind === 'id' ? byId : key.kind === 'class' ? byClass : key.kind === 'tag' ? byTag : null;
          if (!bucket) universal.push(indexed);
          else {
            const list = bucket.get(key.value) ?? [];
            list.push(indexed);
            bucket.set(key.value, list);
          }
        }
      }
    }
    this.keyframes = keyframes;
    this.unparsedSelectors = unparsed;
    this.ruleCount = ruleCount;

    const matcher = new SelectorMatcher(MATCH_BUDGET, doc.elements.length);
    for (const element of doc.elements) {
      // Each rule sits in exactly one bucket, so walking the element's buckets visits a rule at most once.
      const buckets = matcher.exhausted ? [] : [
        universal,
        ...(element.id ? [byId.get(element.id) ?? []] : []),
        ...[...new Set(element.classes)].map((cls) => byClass.get(cls) ?? []),
        byTag.get(element.tag) ?? [],
      ];
      for (const bucket of buckets) {
        for (const rule of bucket) {
          if (!this.matches(matcher, element, rule.selector)) continue;
          const box: Box = rule.selector.pseudoElement ?? 'element';
          for (const declaration of rule.declarations) {
            this.put(element, box, rule.motion, declaration.prop, {
              value: declaration.value, important: declaration.important, inline: false,
              specificity: rule.selector.specificity, order: rule.order, motion: rule.motion,
            });
          }
        }
      }
      for (const cls of element.classes) {
        // A class the submitted CSS defines is the author's own, even when its name looks like a Tailwind utility.
        if (authorClasses.has(cls)) continue;
        const utility = tailwindDeclarations(cls, ctx);
        if (!utility) continue;
        for (const declaration of utility.declarations) {
          this.put(element, utility.target, utility.motion, declaration.prop, {
            value: declaration.value, important: declaration.important, inline: false,
            specificity: [0, 1, 0], order: TAILWIND_ORDER_BASE + utility.weight, motion: utility.motion,
          });
        }
        if (utility.target !== 'element') {
          this.put(element, utility.target, utility.motion, 'content', {
            value: '""', important: false, inline: false, specificity: [0, 0, 0], order: -1, motion: utility.motion,
          });
        }
      }
      const inline = element.attrs.get('style');
      if (inline) {
        for (const declaration of parseInlineStyle(inline)) {
          this.put(element, 'element', 'any', declaration.prop, {
            value: declaration.value, important: declaration.important, inline: true,
            specificity: SPECIFICITY_INLINE, order: Number.MAX_SAFE_INTEGER, motion: 'any',
          });
        }
      }
    }
    this.exhausted = matcher.exhausted;
  }

  private matches(matcher: SelectorMatcher, element: DomElement, selector: ComplexSelector): boolean {
    if (matcher.matches(element, selector)) return true;
    // A fragment without <html> still carries `:root` tokens; its top-level elements stand in for the root.
    if (this.hasHtmlRoot || element.parent?.tag !== '#document') return false;
    const last = selector.compounds[selector.compounds.length - 1]!;
    return selector.compounds.length === 1 && last.pseudos.length === 1 && last.pseudos[0]!.name === 'root'
      && !last.classes.length && !last.ids.length && !last.attrs.length;
  }

  private put(element: DomElement, box: Box, motion: MotionCondition, prop: string, entry: Entry): void {
    let store: Store;
    if (motion === 'reduce') {
      store = this.reduced.get(element) ?? new Map();
      this.reduced.set(element, store);
    } else {
      const boxes = this.boxes.get(element) ?? {};
      store = boxes[box] ?? new Map();
      boxes[box] = store;
      this.boxes.set(element, boxes);
    }
    const existing = store.get(prop);
    if (!existing || outranks(entry, existing)) store.set(prop, entry);
  }

  private store(element: DomElement, box: Box): Store | undefined {
    return this.boxes.get(element)?.[box];
  }

  /** Winning raw declaration among a property and its shorthands. */
  private winner(element: DomElement, box: Box, props: readonly string[]): { prop: string; entry: Entry } | null {
    const store = this.store(element, box);
    if (!store) return null;
    let best: { prop: string; entry: Entry } | null = null;
    for (const prop of props) {
      const entry = store.get(prop);
      if (entry && (!best || outranks(entry, best.entry))) best = { prop, entry };
    }
    return best;
  }

  /** Resolved value of one property (with inheritance for inherited properties), or undefined. */
  get(element: DomElement, prop: string, box: Box = 'element'): string | undefined {
    if (prop.startsWith('--')) return this.customProperty(element, prop);
    const own = this.store(element, box)?.get(prop);
    if (own) {
      if (own.value.trim().toLowerCase() !== 'inherit') return this.resolve(element, own.value);
      // `inherit` takes the parent's value; walking up instead of recursing keeps a deep page off the call stack.
      for (let node = element.parent; node && node.tag !== '#document'; node = node.parent) {
        const entry = this.store(node, 'element')?.get(prop);
        if (entry && entry.value.trim().toLowerCase() !== 'inherit') return this.resolve(node, entry.value);
        if (!entry && !INHERITED.has(prop)) return undefined;
      }
      return undefined;
    }
    if (INHERITED.has(prop) && box === 'element') {
      for (let node = element.parent; node && node.tag !== '#document'; node = node.parent) {
        const entry = this.store(node, 'element')?.get(prop);
        if (entry) return this.resolve(node, entry.value);
      }
    }
    return undefined;
  }

  /**
   * A custom property's value is resolved where it is declared and inherited already resolved, as in CSS. A
   * reference cycle makes the property invalid, so var() falls back instead of recursing forever.
   */
  private customProperty(element: DomElement, name: string): string | undefined {
    let owner: DomElement | null = null;
    let raw = '';
    for (let node: DomElement | null = element; node && node.tag !== '#document'; node = node.parent) {
      const entry = this.store(node, 'element')?.get(name);
      if (entry) { owner = node; raw = entry.value; break; }
    }
    if (!owner) return undefined;
    let cache = this.customCache.get(owner);
    if (!cache) { cache = new Map(); this.customCache.set(owner, cache); }
    if (cache.has(name)) return cache.get(name) ?? undefined;
    const key = `${owner.order}:${name}`;
    if (this.resolving.has(key) || this.customDepth >= MAX_CUSTOM_DEPTH) return undefined;
    this.resolving.add(key);
    this.customDepth++;
    let resolved: string;
    try {
      resolved = this.resolve(owner, raw);
    } finally {
      this.customDepth--;
      this.resolving.delete(key);
    }
    const value = resolved.length > MAX_CUSTOM_VALUE ? null : resolved;
    // Every value is cached, including one cut off by the depth limit: resolving it again per reference would make
    // fan-out above a deep chain exponential. Lookups run in a fixed order, so the result stays deterministic.
    cache.set(name, value);
    return value ?? undefined;
  }

  /** Resolved value of the highest-ranked declaration among `props` (a longhand and its shorthands). */
  pick(element: DomElement, props: readonly string[], box: Box = 'element'): { prop: string; value: string } | null {
    const found = this.winner(element, box, props);
    return found ? { prop: found.prop, value: this.resolve(element, found.entry.value) } : null;
  }

  motionOf(element: DomElement, props: readonly string[]): MotionCondition | null {
    return this.winner(element, 'element', props)?.entry.motion ?? null;
  }

  /** Value of `prop` declared only under `prefers-reduced-motion: reduce`, if any. */
  reducedValue(element: DomElement, props: readonly string[]): string | undefined {
    const store = this.reduced.get(element);
    if (!store) return undefined;
    let best: Entry | undefined;
    for (const prop of props) {
      const entry = store.get(prop);
      if (entry && (!best || outranks(entry, best))) best = entry;
    }
    return best ? this.resolve(element, best.value) : undefined;
  }

  hasPseudo(element: DomElement, box: 'before' | 'after'): boolean {
    const content = this.store(element, box)?.get('content')?.value.trim().toLowerCase();
    return content !== undefined && content !== 'none' && content !== 'normal';
  }

  /** Not rendered because the element or one of its ancestors is display:none, hidden, or a non-rendered tag. */
  hidden(element: DomElement): boolean {
    const chain: DomElement[] = [];
    let inherited = false;
    for (let node: DomElement | null = element; node && node.tag !== '#document'; node = node.parent) {
      const known = this.hiddenCache.get(node);
      if (known !== undefined) { inherited = known; break; }
      chain.push(node);
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      const node = chain[i]!;
      inherited = inherited || NON_RENDERED.has(node.tag) || node.attrs.has('hidden')
        || this.store(node, 'element')?.has('display') === true && this.get(node, 'display')?.trim() === 'none';
      this.hiddenCache.set(node, inherited);
    }
    return this.hiddenCache.get(element) ?? inherited;
  }

  private resolve(element: DomElement, value: string, depth = 0): string {
    if (!value.includes('var(') || depth > 8) return value;
    let out = '';
    let i = 0;
    while (i < value.length) {
      const start = value.indexOf('var(', i);
      if (start === -1) { out += value.slice(i); break; }
      out += value.slice(i, start);
      let depthParen = 0; let end = start + 3;
      for (; end < value.length; end++) {
        if (value[end] === '(') depthParen++;
        else if (value[end] === ')') { depthParen--; if (depthParen === 0) break; }
      }
      const inner = value.slice(start + 4, end);
      const name = splitTopLevel(inner)[0]?.trim() ?? '';
      const fallback = inner.includes(',') ? inner.slice(inner.indexOf(',') + 1).trim() : '';
      const resolved = name.startsWith('--') ? this.customProperty(element, name) : undefined;
      out += resolved ?? this.resolve(element, fallback, depth + 1);
      if (out.length > MAX_CUSTOM_VALUE) return out.slice(0, MAX_CUSTOM_VALUE);
      i = end + 1;
    }
    return out;
  }
}

export function visibleChildren(doc: StyledDocument, element: DomElement): DomElement[] {
  return elementChildren(element).filter((child) => isRendered(doc, child));
}

export function isRendered(doc: StyledDocument, element: DomElement): boolean {
  return !doc.hidden(element);
}
