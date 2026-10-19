import { lengthPx, splitTopLevel, type LengthContext } from './values.js';

export interface CssDeclaration { prop: string; value: string; important: boolean }

/** `any`: unconditional; `no-preference`: only without reduced motion; `reduce`: only with reduced motion. */
export type MotionCondition = 'any' | 'no-preference' | 'reduce';

export interface CssRule {
  selectorText: string;
  declarations: CssDeclaration[];
  order: number;
  motion: MotionCondition;
}

export interface ParsedCss {
  rules: CssRule[];
  keyframes: Set<string>;
}

interface Condition { applies: boolean; motion: MotionCondition }

const ALWAYS: Condition = { applies: true, motion: 'any' };
const BLOCK_AT_RULES = new Set(['media', 'supports', 'layer', 'container', 'scope', 'document', 'starting-style']);

function combine(outer: Condition, inner: Condition): Condition {
  if (!outer.applies || !inner.applies) return { applies: false, motion: 'any' };
  const motion = outer.motion === 'reduce' || inner.motion === 'reduce' ? 'reduce'
    : outer.motion === 'no-preference' || inner.motion === 'no-preference' ? 'no-preference' : 'any';
  return { applies: true, motion };
}

function featureTrue(feature: string, ctx: LengthContext): boolean | 'reduce' | 'no-preference' {
  const body = feature.replace(/^\(|\)$/g, '').trim().toLowerCase();
  const pair = /^([a-z-]+)\s*:\s*(.+)$/.exec(body);
  if (pair) {
    const name = pair[1]!; const value = pair[2]!.trim();
    const px = () => lengthPx(value, ctx);
    switch (name) {
      case 'prefers-reduced-motion': return value === 'reduce' ? 'reduce' : 'no-preference';
      case 'min-width': return (px() ?? Infinity) <= ctx.viewportWidth;
      case 'max-width': return (px() ?? -Infinity) >= ctx.viewportWidth;
      case 'min-height': return (px() ?? Infinity) <= ctx.viewportHeight;
      case 'max-height': return (px() ?? -Infinity) >= ctx.viewportHeight;
      case 'prefers-color-scheme': return value === 'light';
      case 'hover': case 'any-hover': return value === 'hover';
      case 'pointer': case 'any-pointer': return value === 'fine';
      case 'orientation': return value === (ctx.viewportWidth >= ctx.viewportHeight ? 'landscape' : 'portrait');
      case 'prefers-contrast': return value === 'no-preference';
      case 'forced-colors': return value === 'none';
      case 'min-resolution': case '-webkit-min-device-pixel-ratio': case 'min-device-pixel-ratio': return true;
      default: return false;
    }
  }
  const range = /^(?:(-?[\d.]+[a-z]*)\s*(<=|<|>=|>)\s*)?(width|height)(?:\s*(<=|<|>=|>)\s*(-?[\d.]+[a-z]*))?$/.exec(body);
  if (range && (range[1] || range[5])) {
    const size = range[3] === 'width' ? ctx.viewportWidth : ctx.viewportHeight;
    const compare = (left: number, op: string, right: number) => (
      op === '<' ? left < right : op === '<=' ? left <= right : op === '>' ? left > right : left >= right
    );
    const lower = range[1] ? lengthPx(range[1], ctx) : null;
    const upper = range[5] ? lengthPx(range[5], ctx) : null;
    if ((range[1] && lower === null) || (range[5] && upper === null)) return false;
    return (lower === null || compare(lower, range[2]!, size)) && (upper === null || compare(size, range[4]!, upper));
  }
  return body === 'hover' || body === 'color';
}

function evaluateQuery(query: string, ctx: LengthContext): Condition {
  let text = query.trim().toLowerCase();
  let negate = false;
  if (text.startsWith('not ')) { negate = true; text = text.slice(4); }
  text = text.replace(/^only\s+/, '');
  let applies = true;
  let motion: MotionCondition = 'any';
  const parts = text.split(/\s+and\s+/);
  for (const part of parts) {
    const term = part.trim();
    if (!term) continue;
    if (!term.startsWith('(')) {
      if (term === 'print' || term === 'speech') applies = false;
      else if (term !== 'screen' && term !== 'all') applies = false;
      continue;
    }
    const result = featureTrue(term, ctx);
    if (result === 'reduce' || result === 'no-preference') motion = result;
    else if (!result) applies = false;
  }
  if (negate) return { applies: !applies, motion: 'any' };
  return { applies, motion };
}

function evaluateMedia(prelude: string, ctx: LengthContext): Condition {
  const queries = splitTopLevel(prelude);
  if (!queries.length) return ALWAYS;
  const results = queries.map((query) => evaluateQuery(query, ctx)).filter((result) => result.applies);
  const normal = results.find((result) => result.motion !== 'reduce');
  if (normal) return normal;
  return results[0] ?? { applies: false, motion: 'any' };
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Index of the brace closing the one at `open`, honoring strings and nesting. */
function matchingBrace(css: string, open: number): number {
  let depth = 0; let quote: string | null = null;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length;
}

/** Next `{`, `;` or `}` at paren depth 0. */
function nextDelimiter(css: string, from: number): number {
  let paren = 0; let quote: string | null = null; let bracket = 0;
  for (let i = from; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (paren === 0 && bracket === 0 && (ch === '{' || ch === ';' || ch === '}')) return i;
  }
  return css.length;
}

function parseDeclaration(text: string): CssDeclaration | null {
  const colon = text.indexOf(':');
  if (colon <= 0) return null;
  const prop = text.slice(0, colon).trim().toLowerCase();
  if (!/^(--[\w-]+|-?[a-z][a-z-]*)$/.test(prop)) return null;
  let value = text.slice(colon + 1).trim();
  const important = /!\s*important\s*$/i.test(value);
  if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
  return { prop: prop.startsWith('--') ? text.slice(0, colon).trim() : prop, value, important };
}

function nestSelector(parents: string[], child: string): string {
  const children = splitTopLevel(child);
  const out: string[] = [];
  for (const parent of parents) {
    for (const item of children) {
      out.push(item.includes('&') ? item.replace(/&/g, parent) : `${parent} ${item}`);
    }
  }
  return out.join(', ');
}

export function parseCss(source: string, ctx: LengthContext, startOrder = 0): ParsedCss {
  const css = stripComments(source);
  const rules: CssRule[] = [];
  const keyframes = new Set<string>();
  let order = startOrder;

  const parseRuleBody = (selectors: string[], body: string, condition: Condition) => {
    const declarations: CssDeclaration[] = [];
    const ownOrder = order++;
    let i = 0;
    while (i < body.length) {
      const delimiter = nextDelimiter(body, i);
      const chunk = body.slice(i, delimiter).trim();
      if (body[delimiter] === '{') {
        const close = matchingBrace(body, delimiter);
        const inner = body.slice(delimiter + 1, close);
        if (chunk.startsWith('@')) {
          const at = /^@([\w-]+)\s*(.*)$/s.exec(chunk);
          const name = at?.[1]?.toLowerCase() ?? '';
          if (name === 'media') parseRuleBody(selectors, inner, combine(condition, evaluateMedia(at?.[2] ?? '', ctx)));
          else if (BLOCK_AT_RULES.has(name)) parseRuleBody(selectors, inner, condition);
        } else if (chunk) {
          parseRuleBody(splitTopLevel(nestSelector(selectors, chunk)), inner, condition);
        }
        i = close + 1;
        continue;
      }
      if (chunk) {
        const declaration = parseDeclaration(chunk);
        if (declaration) declarations.push(declaration);
      }
      i = delimiter + 1;
    }
    if (declarations.length && condition.applies) {
      rules.push({ selectorText: selectors.join(', '), declarations, order: ownOrder, motion: condition.motion });
    }
  };

  const parseBlock = (text: string, condition: Condition) => {
    let i = 0;
    while (i < text.length) {
      const delimiter = nextDelimiter(text, i);
      const prelude = text.slice(i, delimiter).trim();
      if (delimiter >= text.length) break;
      if (text[delimiter] !== '{') {
        i = delimiter + 1;
        continue;
      }
      const close = matchingBrace(text, delimiter);
      const inner = text.slice(delimiter + 1, close);
      i = close + 1;
      if (prelude.startsWith('@')) {
        const at = /^@([\w-]+)\s*(.*)$/s.exec(prelude);
        const name = at?.[1]?.toLowerCase() ?? '';
        if (name === 'media') parseBlock(inner, combine(condition, evaluateMedia(at?.[2] ?? '', ctx)));
        else if (BLOCK_AT_RULES.has(name)) parseBlock(inner, condition);
        else if (name.endsWith('keyframes')) {
          const keyframeName = (at?.[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
          if (keyframeName) keyframes.add(keyframeName);
        }
        continue;
      }
      if (prelude) parseRuleBody(splitTopLevel(prelude), inner, condition);
    }
  };

  parseBlock(css, ALWAYS);
  return { rules, keyframes };
}

export function parseInlineStyle(style: string): CssDeclaration[] {
  return splitTopLevel(style, ';')
    .map((chunk) => parseDeclaration(chunk))
    .filter((declaration): declaration is CssDeclaration => declaration !== null);
}
