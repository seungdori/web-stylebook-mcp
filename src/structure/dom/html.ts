export interface DomElement {
  kind: 'element';
  tag: string;
  attrs: ReadonlyMap<string, string>;
  id: string | null;
  classes: readonly string[];
  children: DomNode[];
  parent: DomElement | null;
  /** Document order among elements; the synthetic root is -1. */
  order: number;
}

export interface DomText {
  kind: 'text';
  text: string;
  parent: DomElement;
}

export type DomNode = DomElement | DomText;

export interface ParsedHtml {
  root: DomElement;
  elements: DomElement[];
  /** Text of every <style> element, in document order. */
  styleSheets: string[];
  /** The element cap was reached, so later markup was not parsed. */
  truncated: boolean;
}

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
// Content of these never becomes rendered DOM, so it is skipped rather than parsed.
const SKIPPED_CONTENT = new Set(['script', 'noscript', 'template']);
const RAW_TEXT = new Set(['style', 'textarea', 'title', 'xmp']);

const CLOSES_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol',
  'p', 'pre', 'section', 'table', 'ul',
]);
const IMPLIED_CLOSE: Record<string, readonly string[]> = {
  li: ['li'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  tr: ['tr', 'td', 'th'],
  td: ['td', 'th'],
  th: ['td', 'th'],
  option: ['option'],
  thead: ['tbody', 'tfoot', 'tr', 'td', 'th'],
  tbody: ['thead', 'tbody', 'tfoot', 'tr', 'td', 'th'],
  tfoot: ['thead', 'tbody', 'tr', 'td', 'th'],
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™',
  middot: '·', bull: '•', times: '×', rarr: '→', larr: '←', uarr: '↑', darr: '↓', star: '☆', starf: '★',
  check: '✓', deg: '°', euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', para: '¶', zwj: '‍',
  zwnj: '‌', thinsp: ' ', ensp: ' ', emsp: ' ',
};

export function decodeEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  ATTR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR.exec(source)) !== null) {
    const name = match[1]!.toLowerCase();
    if (attrs.has(name)) continue;
    attrs.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return attrs;
}

function makeElement(tag: string, attrs: Map<string, string>, parent: DomElement | null, order: number): DomElement {
  const id = attrs.get('id')?.trim() || null;
  const classes = (attrs.get('class') ?? attrs.get('classname') ?? '').split(/\s+/).filter(Boolean);
  return { kind: 'element', tag, attrs, id, classes, children: [], parent, order };
}

/** Find the end of a start tag, skipping quoted attribute values. */
function tagEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

export function parseHtml(html: string, maxElements: number): ParsedHtml {
  const root = makeElement('#document', new Map(), null, -1);
  const elements: DomElement[] = [];
  const styleSheets: string[] = [];
  const stack: DomElement[] = [root];
  let truncated = false;
  let i = 0;

  const current = (): DomElement => stack[stack.length - 1]!;
  const appendText = (raw: string) => {
    const text = decodeEntities(raw);
    if (!text.trim()) return;
    current().children.push({ kind: 'text', text, parent: current() });
  };
  const closeTo = (tags: readonly string[], stopAt: ReadonlySet<string>) => {
    for (let depth = stack.length - 1; depth > 0; depth--) {
      const tag = stack[depth]!.tag;
      if (tags.includes(tag)) {
        stack.length = depth;
        return;
      }
      if (stopAt.has(tag)) return;
    }
  };

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      appendText(html.slice(i));
      break;
    }
    if (lt > i) appendText(html.slice(i, lt));

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const next = html[lt + 1] ?? '';
    if (next === '!' || next === '?') {
      const end = html.indexOf('>', lt + 2);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (next === '/') {
      const end = html.indexOf('>', lt + 2);
      if (end === -1) break;
      const name = html.slice(lt + 2, end).trim().split(/\s/)[0]?.toLowerCase() ?? '';
      if (name) {
        for (let depth = stack.length - 1; depth > 0; depth--) {
          if (stack[depth]!.tag === name) {
            stack.length = depth;
            break;
          }
        }
      }
      i = end + 1;
      continue;
    }
    if (!/[a-zA-Z]/.test(next)) {
      appendText('<');
      i = lt + 1;
      continue;
    }

    const end = tagEnd(html, lt + 1);
    if (end === -1) break;
    const inner = html.slice(lt + 1, end);
    const nameMatch = /^[a-zA-Z][^\s/>]*/.exec(inner);
    const tag = nameMatch![0].toLowerCase();
    const selfClosing = inner.endsWith('/');
    const attrs = parseAttributes(inner.slice(tag.length, selfClosing ? -1 : undefined));
    i = end + 1;

    if (SKIPPED_CONTENT.has(tag) || RAW_TEXT.has(tag)) {
      const closePattern = new RegExp(`</${tag}`, 'ig');
      closePattern.lastIndex = i;
      const close = closePattern.exec(html)?.index ?? -1;
      const content = html.slice(i, close === -1 ? html.length : close);
      i = close === -1 ? html.length : (html.indexOf('>', close) + 1 || html.length);
      if (SKIPPED_CONTENT.has(tag)) continue;
      if (elements.length >= maxElements) { truncated = true; break; }
      const element = makeElement(tag, attrs, current(), elements.length);
      elements.push(element);
      current().children.push(element);
      if (tag === 'style') styleSheets.push(content);
      else if (content.trim()) element.children.push({ kind: 'text', text: decodeEntities(content), parent: element });
      continue;
    }

    if (current().tag === 'p' && CLOSES_P.has(tag)) stack.length -= 1;
    const implied = IMPLIED_CLOSE[tag];
    if (implied) closeTo(implied, new Set(['ul', 'ol', 'dl', 'table', 'select', 'datalist']));

    if (elements.length >= maxElements) { truncated = true; break; }
    const element = makeElement(tag, attrs, current(), elements.length);
    elements.push(element);
    current().children.push(element);
    if (!selfClosing && !VOID.has(tag)) stack.push(element);
  }

  return { root, elements, styleSheets, truncated };
}

export function elementChildren(element: DomElement): DomElement[] {
  return element.children.filter((child): child is DomElement => child.kind === 'element');
}

const textCache = new WeakMap<DomElement, string>();
const wordCache = new WeakMap<DomElement, number>();

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fill `cache` for `element` and every uncached descendant from their children's values. A parsed document never
 * changes, so each element is computed once; the post-order walk is iterative so deep nesting cannot overflow the
 * stack or turn repeated lookups quadratic.
 */
function bottomUp<T>(element: DomElement, cache: WeakMap<DomElement, T>, combine: (node: DomElement) => T): T {
  const cached = cache.get(element);
  if (cached !== undefined) return cached;
  const stack: Array<{ node: DomElement; visited: boolean }> = [{ node: element, visited: false }];
  while (stack.length) {
    const top = stack[stack.length - 1]!;
    if (!top.visited) {
      top.visited = true;
      for (const child of top.node.children) {
        if (child.kind === 'element' && !cache.has(child)) stack.push({ node: child, visited: false });
      }
      continue;
    }
    stack.pop();
    cache.set(top.node, combine(top.node));
  }
  return cache.get(element)!;
}

const countsText = (child: DomElement) => child.tag !== 'style' && child.tag !== 'svg';

/** Visible text of an element and its descendants, whitespace collapsed. */
export function textContent(element: DomElement): string {
  return bottomUp(element, textCache, (node) => {
    const parts: string[] = [];
    for (const child of node.children) {
      const part = child.kind === 'text' ? collapse(child.text) : countsText(child) ? textCache.get(child) ?? '' : '';
      if (part) parts.push(part);
    }
    return parts.join(' ');
  });
}

/**
 * `wordCount(textContent(element))` without building the text. Children are joined with spaces, so no word spans two
 * children and a subtree's count is the sum of its parts; a deeply nested page never materializes its text per level.
 */
export function textWords(element: DomElement): number {
  return bottomUp(element, wordCache, (node) => {
    let count = 0;
    for (const child of node.children) {
      if (child.kind === 'text') count += wordCount(child.text);
      else if (countsText(child)) count += wordCache.get(child) ?? 0;
    }
    return count;
  });
}

export function hasText(element: DomElement): boolean {
  return textWords(element) > 0;
}

export function ownText(element: DomElement): string {
  return collapse(element.children
    .filter((child): child is DomText => child.kind === 'text')
    .map((child) => child.text)
    .join(' '));
}

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g;

/** Word count that also handles unspaced Japanese/Chinese text (two characters ≈ one word). */
export function wordCount(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const cjk = token.match(CJK)?.length ?? 0;
    count += cjk > 1 ? Math.ceil(cjk / 2) + (token.length - cjk > 2 ? 1 : 0) : 1;
  }
  return count;
}

export function descendants(element: DomElement): DomElement[] {
  const out: DomElement[] = [];
  const stack: DomElement[] = [];
  for (let i = element.children.length - 1; i >= 0; i--) {
    const child = element.children[i]!;
    if (child.kind === 'element') stack.push(child);
  }
  while (stack.length) {
    const node = stack.pop()!;
    out.push(node);
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i]!;
      if (child.kind === 'element') stack.push(child);
    }
  }
  return out;
}

export function ancestors(element: DomElement): DomElement[] {
  const out: DomElement[] = [];
  for (let node = element.parent; node && node.tag !== '#document'; node = node.parent) out.push(node);
  return out;
}

export function contains(ancestor: DomElement, element: DomElement): boolean {
  for (let node: DomElement | null = element; node; node = node.parent) {
    if (node === ancestor) return true;
  }
  return false;
}

/** A short, stable CSS path for evidence, e.g. `main > section:nth-of-type(2) > ul.logos`. */
export function selectorPath(element: DomElement): string {
  const parts: string[] = [];
  for (let node: DomElement | null = element; node && node.tag !== '#document'; node = node.parent) {
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
      parts.unshift(`${node.tag}#${node.id}`);
      break;
    }
    if (node.tag === 'html' || node.tag === 'body') {
      if (node.tag === 'body') parts.unshift('body');
      break;
    }
    const parent = node.parent;
    const sameTag = parent ? elementChildren(parent).filter((child) => child.tag === node!.tag) : [];
    const cls = node.classes.find((name) => /^[A-Za-z_][\w-]*$/.test(name));
    let part = node.tag + (cls ? `.${cls}` : '');
    if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    parts.unshift(part);
  }
  const path = parts.join(' > ');
  return path.length > 900 ? `… ${path.slice(-880)}` : path;
}
