import { elementChildren, type DomElement } from './html.js';
import { splitTopLevel } from './values.js';

export type Specificity = readonly [number, number, number];

interface AttrSelector { name: string; op: string | null; value: string; insensitive: boolean }
interface PseudoSelector { name: string; arg: string | null; list: ComplexSelector[] | null }

export interface CompoundSelector {
  tag: string | null;
  ids: string[];
  classes: string[];
  attrs: AttrSelector[];
  pseudos: PseudoSelector[];
}

export type Combinator = ' ' | '>' | '+' | '~';

export interface ComplexSelector {
  /** Rightmost compound last; `combinators[i]` joins `compounds[i]` to `compounds[i + 1]`. */
  compounds: CompoundSelector[];
  combinators: Combinator[];
  pseudoElement: 'before' | 'after' | null;
  specificity: Specificity;
}

const IGNORED_PSEUDO_ELEMENTS = /^(?:placeholder|selection|marker|backdrop|first-line|first-letter|file-selector-button|cue|part|slotted|highlight|spelling-error|grammar-error|view-transition.*|-webkit-.*|-moz-.*|-ms-.*)$/;

function unescapeIdent(value: string): string {
  return value.replace(/\\([0-9a-fA-F]{1,6}\s?|[\s\S])/g, (_, escaped: string) => {
    if (/^[0-9a-fA-F]{1,6}\s?$/.test(escaped)) {
      const code = parseInt(escaped.trim(), 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
    }
    return escaped;
  });
}

const IDENT = String.raw`(?:\\[0-9a-fA-F]{1,6}\s?|\\[\s\S]|[\w -￿-])+`;
const TOKEN = new RegExp(
  String.raw`(#${IDENT})|(\.${IDENT})|(\[[^\]]*\])|(::?${IDENT}(?:\((?:[^()]|\([^()]*\))*\))?)|(\*|${IDENT})|(\s*[>+~]\s*|\s+)`,
  'gy',
);

function emptyCompound(): CompoundSelector {
  return { tag: null, ids: [], classes: [], attrs: [], pseudos: [] };
}

function parseAttr(source: string): AttrSelector | null {
  const match = /^\[\s*([^\s~|^$*=\]]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*([iIsS])?)?\s*\]$/.exec(source);
  if (!match) return null;
  return {
    name: unescapeIdent(match[1]!).toLowerCase(),
    op: match[2] ?? null,
    value: match[3] ?? match[4] ?? (match[5] ? unescapeIdent(match[5]) : ''),
    insensitive: match[6] === 'i' || match[6] === 'I',
  };
}

const cache = new Map<string, ComplexSelector | null>();

/** Parse one complex selector; null when it uses syntax this matcher does not evaluate. */
export function parseSelector(source: string): ComplexSelector | null {
  const key = source.trim();
  if (cache.has(key)) return cache.get(key)!;
  const parsed = parseUncached(key);
  if (cache.size > 20000) cache.clear();
  cache.set(key, parsed);
  return parsed;
}

function parseUncached(source: string): ComplexSelector | null {
  const compounds: CompoundSelector[] = [emptyCompound()];
  const combinators: Combinator[] = [];
  let pseudoElement: ComplexSelector['pseudoElement'] = null;
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < source.length) {
    TOKEN.lastIndex = pos;
    const match = TOKEN.exec(source);
    if (!match || match.index !== pos || match[0].length === 0) return null;
    pos = TOKEN.lastIndex;
    const compound = compounds[compounds.length - 1]!;
    if (pseudoElement && !match[6]) return null;
    if (match[1]) compound.ids.push(unescapeIdent(match[1].slice(1)));
    else if (match[2]) compound.classes.push(unescapeIdent(match[2].slice(1)));
    else if (match[3]) {
      const attr = parseAttr(match[3]);
      if (!attr) return null;
      compound.attrs.push(attr);
    } else if (match[4]) {
      const raw = match[4];
      const isElement = raw.startsWith('::');
      const body = raw.replace(/^::?/, '');
      const paren = body.indexOf('(');
      const name = (paren === -1 ? body : body.slice(0, paren)).toLowerCase();
      const arg = paren === -1 ? null : body.slice(paren + 1, -1).trim();
      if (name === 'before' || name === 'after') {
        pseudoElement = name;
        continue;
      }
      if (isElement || IGNORED_PSEUDO_ELEMENTS.test(name)) return null;
      const takesList = ['not', 'is', 'where', 'matches', 'has', '-webkit-any', '-moz-any'].includes(name);
      let list: ComplexSelector[] | null = null;
      if (takesList) {
        if (arg === null) return null;
        const items = splitTopLevel(arg).map((item) => parseSelector(name === 'has' ? item.replace(/^[>+~]\s*/, '') : item));
        if (items.some((item) => item === null)) return null;
        list = items as ComplexSelector[];
      }
      compound.pseudos.push({ name, arg, list });
    } else if (match[5]) {
      if (compound.tag !== null || compound.ids.length || compound.classes.length || compound.attrs.length || compound.pseudos.length) return null;
      compound.tag = match[5] === '*' ? '*' : unescapeIdent(match[5]).toLowerCase();
    } else if (match[6] !== undefined) {
      const symbol = match[6].trim();
      if (pos >= source.length) break;
      if (pseudoElement) return null;
      combinators.push((symbol || ' ') as Combinator);
      compounds.push(emptyCompound());
    }
  }
  if (compounds.some((compound) => compound.tag === null && !compound.ids.length && !compound.classes.length
    && !compound.attrs.length && !compound.pseudos.length)) return null;
  return { compounds, combinators, pseudoElement, specificity: specificityOf(compounds, pseudoElement) };
}

function specificityOf(compounds: CompoundSelector[], pseudoElement: string | null): Specificity {
  let a = 0; let b = 0; let c = pseudoElement ? 1 : 0;
  for (const compound of compounds) {
    a += compound.ids.length;
    b += compound.classes.length + compound.attrs.length;
    if (compound.tag && compound.tag !== '*') c++;
    for (const pseudo of compound.pseudos) {
      if (pseudo.name === 'where') continue;
      if (pseudo.list) {
        const max = pseudo.list.reduce<Specificity>((best, item) => compareSpecificity(item.specificity, best) > 0 ? item.specificity : best, [0, 0, 0]);
        a += max[0]; b += max[1]; c += max[2];
      } else {
        b++;
      }
    }
  }
  return [a, b, c];
}

export function compareSpecificity(x: Specificity, y: Specificity): number {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

function attrMatches(element: DomElement, attr: AttrSelector): boolean {
  const actual = element.attrs.get(attr.name);
  if (actual === undefined) return false;
  if (attr.op === null) return true;
  const left = attr.insensitive ? actual.toLowerCase() : actual;
  const right = attr.insensitive ? attr.value.toLowerCase() : attr.value;
  switch (attr.op) {
    case '=': return left === right;
    case '~=': return left.split(/\s+/).includes(right);
    case '|=': return left === right || left.startsWith(`${right}-`);
    case '^=': return right !== '' && left.startsWith(right);
    case '$=': return right !== '' && left.endsWith(right);
    case '*=': return right !== '' && left.includes(right);
    default: return false;
  }
}

function nthMatches(arg: string, index: number): boolean {
  const text = arg.trim().toLowerCase().split(/\s+of\s+/)[0]!.replace(/\s+/g, '');
  if (text === 'odd') return index % 2 === 1;
  if (text === 'even') return index % 2 === 0;
  const match = /^([+-]?\d*)?n([+-]\d+)?$/.exec(text);
  if (!match) return /^[+-]?\d+$/.test(text) && index === parseInt(text, 10);
  const aText = match[1] ?? '';
  const a = aText === '' || aText === '+' ? 1 : aText === '-' ? -1 : parseInt(aText, 10);
  const b = match[2] ? parseInt(match[2], 10) : 0;
  if (a === 0) return index === b;
  const n = (index - b) / a;
  return Number.isInteger(n) && n >= 0;
}

interface Position { all: DomElement[]; index: number; ofType: number; typeCount: number }

const positions = new WeakMap<DomElement, Position>();

/** Sibling list and positions, computed once per parent so nth-* and sibling combinators do not rescan siblings. */
function position(element: DomElement): Position {
  const cached = positions.get(element);
  if (cached) return cached;
  const all = element.parent ? elementChildren(element.parent) : [element];
  const typeCounts = new Map<string, number>();
  for (const sibling of all) typeCounts.set(sibling.tag, (typeCounts.get(sibling.tag) ?? 0) + 1);
  const seen = new Map<string, number>();
  all.forEach((sibling, index) => {
    const ofType = (seen.get(sibling.tag) ?? 0) + 1;
    seen.set(sibling.tag, ofType);
    positions.set(sibling, { all, index, ofType, typeCount: typeCounts.get(sibling.tag)! });
  });
  return positions.get(element)!;
}


function compoundMatches(element: DomElement, compound: CompoundSelector, matcher: SelectorMatcher): boolean {
  if (compound.tag && compound.tag !== '*' && compound.tag !== element.tag) return false;
  for (const id of compound.ids) if (element.id !== id) return false;
  for (const cls of compound.classes) if (!element.classes.includes(cls)) return false;
  for (const attr of compound.attrs) if (!attrMatches(element, attr)) return false;
  for (const pseudo of compound.pseudos) if (!pseudoMatches(element, pseudo, matcher)) return false;
  return true;
}

function pseudoMatches(element: DomElement, pseudo: PseudoSelector, matcher: SelectorMatcher): boolean {
  const { name, arg, list } = pseudo;
  switch (name) {
    case 'root': return element.tag === 'html';
    case 'scope': return element.tag === 'html';
    case 'empty': return element.children.length === 0;
    case 'first-child': return position(element).index === 0;
    case 'last-child': { const at = position(element); return at.index === at.all.length - 1; }
    case 'only-child': return position(element).all.length === 1;
    case 'first-of-type': return position(element).ofType === 1;
    case 'last-of-type': { const at = position(element); return at.ofType === at.typeCount; }
    case 'only-of-type': return position(element).typeCount === 1;
    case 'nth-child': return arg !== null && nthMatches(arg, position(element).index + 1);
    case 'nth-last-child': { const at = position(element); return arg !== null && nthMatches(arg, at.all.length - at.index); }
    case 'nth-of-type': return arg !== null && nthMatches(arg, position(element).ofType);
    case 'nth-last-of-type': { const at = position(element); return arg !== null && nthMatches(arg, at.typeCount - at.ofType + 1); }
    case 'not': return !list!.some((item) => matcher.matches(element, item));
    case 'is': case 'where': case 'matches': case '-webkit-any': case '-moz-any':
      return list!.some((item) => matcher.matches(element, item));
    case 'has': return list!.some((item) => matcher.hasDescendant(element, item));
    case 'link': case 'any-link': return (element.tag === 'a' || element.tag === 'area') && element.attrs.has('href');
    case 'checked': return element.attrs.has('checked') || element.attrs.has('selected');
    case 'disabled': return element.attrs.has('disabled');
    // Interaction and form states never hold in a static audit; unknown pseudo-classes are treated the same way.
    default: return false;
  }
}

// Two bits per compound (known, matched) in one number per element; deeper compounds are recomputed.
const MEMO_COMPOUNDS = 15;

/**
 * Matches selectors against one document. Results for (selector, element, compound) are memoized, so descendant
 * combinators do not backtrack exponentially, and a budget of compound checks bounds hostile stylesheets. The
 * rightmost compound is asked once per element by the cascade, so it is only remembered for :has(), which asks again
 * from every ancestor.
 */
export class SelectorMatcher {
  attempts = 0;
  exhausted = false;
  private readonly memo = new Map<ComplexSelector, Map<DomElement, number>>();

  constructor(private readonly budget = Number.POSITIVE_INFINITY) {}

  matches(element: DomElement, selector: ComplexSelector, remember = false): boolean {
    return this.matchFrom(element, selector, selector.compounds.length - 1, remember);
  }

  hasDescendant(element: DomElement, selector: ComplexSelector): boolean {
    const stack = [...elementChildren(element)];
    while (stack.length && !this.exhausted) {
      const node = stack.pop()!;
      if (this.matches(node, selector, true)) return true;
      stack.push(...elementChildren(node));
    }
    return false;
  }

  private matchFrom(element: DomElement, selector: ComplexSelector, index: number, remember = true): boolean {
    if (this.exhausted) return false;
    const memoized = index < MEMO_COMPOUNDS && (remember || index < selector.compounds.length - 1);
    const known = 1 << (2 * index);
    const matched = 2 << (2 * index);
    let bySelector: Map<DomElement, number> | undefined;
    if (memoized) {
      bySelector = this.memo.get(selector);
      if (!bySelector) { bySelector = new Map(); this.memo.set(selector, bySelector); }
      const bits = bySelector.get(element) ?? 0;
      if (bits & known) return (bits & matched) !== 0;
    }
    if (++this.attempts > this.budget) {
      this.exhausted = true;
      return false;
    }
    const result = this.compute(element, selector, index);
    if (bySelector) bySelector.set(element, (bySelector.get(element) ?? 0) | known | (result ? matched : 0));
    return result;
  }

  private compute(element: DomElement, selector: ComplexSelector, index: number): boolean {
    if (!compoundMatches(element, selector.compounds[index]!, this)) return false;
    if (index === 0) return true;
    const combinator = selector.combinators[index - 1]!;
    if (combinator === '>') return !!element.parent && element.parent.tag !== '#document' && this.matchFrom(element.parent, selector, index - 1);
    if (combinator === ' ') {
      for (let node = element.parent; node && node.tag !== '#document'; node = node.parent) {
        if (this.matchFrom(node, selector, index - 1)) return true;
      }
      return false;
    }
    const { all, index: at } = position(element);
    if (combinator === '+') return at > 0 && this.matchFrom(all[at - 1]!, selector, index - 1);
    for (let i = at - 1; i >= 0; i--) if (this.matchFrom(all[i]!, selector, index - 1)) return true;
    return false;
  }
}

export function matchesComplex(element: DomElement, selector: ComplexSelector): boolean {
  return new SelectorMatcher().matches(element, selector);
}

/** Index key of the rightmost compound, used to skip rules that cannot match an element. */
export function selectorKey(selector: ComplexSelector): { kind: 'id' | 'class' | 'tag' | 'any'; value: string } {
  const last = selector.compounds[selector.compounds.length - 1]!;
  if (last.ids[0]) return { kind: 'id', value: last.ids[0] };
  if (last.classes[0]) return { kind: 'class', value: last.classes[0] };
  if (last.tag && last.tag !== '*') return { kind: 'tag', value: last.tag };
  return { kind: 'any', value: '' };
}
