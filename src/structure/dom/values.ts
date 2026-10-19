export interface Rgba { r: number; g: number; b: number; a: number }

export interface LengthContext {
  viewportWidth: number;
  viewportHeight: number;
}

const ROOT_FONT_PX = 16;

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', gray: '#808080', grey: '#808080', silver: '#c0c0c0',
  navy: '#000080', teal: '#008080', aqua: '#00ffff', cyan: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff',
  lime: '#00ff00', maroon: '#800000', olive: '#808000', gold: '#ffd700', indigo: '#4b0082', violet: '#ee82ee',
  coral: '#ff7f50', crimson: '#dc143c', tomato: '#ff6347', salmon: '#fa8072', turquoise: '#40e0d0',
  ivory: '#fffff0', beige: '#f5f5dc', khaki: '#f0e68c', lavender: '#e6e6fa', tan: '#d2b48c',
  whitesmoke: '#f5f5f5', snow: '#fffafa', linen: '#faf0e6', ghostwhite: '#f8f8ff', aliceblue: '#f0f8ff',
  dodgerblue: '#1e90ff', royalblue: '#4169e1', deepskyblue: '#00bfff', hotpink: '#ff69b4', deeppink: '#ff1493',
  orangered: '#ff4500', chartreuse: '#7fff00', springgreen: '#00ff7f', limegreen: '#32cd32',
  forestgreen: '#228b22', darkgreen: '#006400', darkblue: '#00008b', darkred: '#8b0000',
  slategray: '#708090', dimgray: '#696969', lightgray: '#d3d3d3', darkgray: '#a9a9a9', gainsboro: '#dcdcdc',
};

export function parseHex(hex: string): Rgba | null {
  const body = hex.replace(/^#/, '');
  if (!/^[0-9a-f]{3,8}$/i.test(body) || body.length === 5 || body.length === 7) return null;
  const full = body.length <= 4 ? [...body].map((ch) => ch + ch).join('') : body;
  const n = (index: number) => parseInt(full.slice(index, index + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
}

function channel(token: string | undefined, scale: number): number | null {
  if (token === undefined || token === 'none') return token === 'none' ? 0 : null;
  const value = parseFloat(token);
  if (!Number.isFinite(value)) return null;
  return token.endsWith('%') ? (value / 100) * scale : value;
}

function alphaOf(token: string | undefined): number {
  if (token === undefined) return 1;
  const value = parseFloat(token);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, token.endsWith('%') ? value / 100 : value));
}

function fnArgs(body: string): { parts: string[]; alpha?: string } {
  const [main, alpha] = body.includes('/') ? body.split('/') : [body, undefined];
  const parts = main!.split(/[\s,]+/).filter(Boolean);
  if (alpha === undefined && parts.length === 4) return { parts: parts.slice(0, 3), alpha: parts[3] };
  return { parts, alpha: alpha?.trim() };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function oklabToRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = (v: number) => {
    const c = Math.max(0, Math.min(1, v));
    return (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
  };
  return {
    r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function parseColor(token: string): Rgba | null {
  const value = token.trim().toLowerCase();
  if (value.startsWith('#')) return parseHex(value);
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const named = NAMED_COLORS[value];
  if (named) return parseHex(named);
  const fn = /^([a-z]+)\((.*)\)$/.exec(value);
  if (!fn) return null;
  const { parts, alpha } = fnArgs(fn[2]!);
  const name = fn[1]!;
  if (name === 'rgb' || name === 'rgba') {
    const [r, g, b] = [channel(parts[0], 255), channel(parts[1], 255), channel(parts[2], 255)];
    if (r === null || g === null || b === null) return null;
    return { r, g, b, a: alphaOf(alpha) };
  }
  if (name === 'hsl' || name === 'hsla') {
    const h = parseFloat(parts[0] ?? '');
    const s = channel(parts[1], 1); const l = channel(parts[2], 1);
    if (!Number.isFinite(h) || s === null || l === null) return null;
    const sat = parts[1]?.endsWith('%') ? s : s / 100;
    const lig = parts[2]?.endsWith('%') ? l : l / 100;
    return { ...hslToRgb(h, sat, lig), a: alphaOf(alpha) };
  }
  if (name === 'oklch' || name === 'oklab') {
    const L = parts[0]?.endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0] ?? '');
    if (!Number.isFinite(L)) return null;
    if (name === 'oklch') {
      const C = parts[1]?.endsWith('%') ? (parseFloat(parts[1]) / 100) * 0.4 : parseFloat(parts[1] ?? '');
      const H = parseFloat(parts[2] ?? '0') || 0;
      if (!Number.isFinite(C)) return null;
      const rad = (H * Math.PI) / 180;
      return { ...oklabToRgb(L, C * Math.cos(rad), C * Math.sin(rad)), a: alphaOf(alpha) };
    }
    const A = parseFloat(parts[1] ?? ''); const B = parseFloat(parts[2] ?? '');
    if (!Number.isFinite(A) || !Number.isFinite(B)) return null;
    return { ...oklabToRgb(L, A, B), a: alphaOf(alpha) };
  }
  return null;
}

const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\([^()]*\)|(?<![\w-])[a-z]{3,20}(?![\w(-])/gi;

/** Every color literal in a resolved value (gradients, shadows, borders). */
export function colorsIn(value: string): Rgba[] {
  const out: Rgba[] = [];
  for (const match of value.matchAll(COLOR_TOKEN)) {
    const color = parseColor(match[0]);
    if (color) out.push(color);
  }
  return out;
}

export function toHsl(color: Rgba): { h: number; s: number; l: number } {
  const r = color.r / 255; const g = color.g / 255; const b = color.b / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** Split a value on top-level commas (not inside parentheses or quotes). */
export function splitTopLevel(value: string, separator = ','): string[] {
  const out: string[] = [];
  let depth = 0; let quote: string | null = null; let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && ch === separator) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out.map((part) => part.trim()).filter(Boolean);
}

function unitPx(value: number, unit: string, ctx: LengthContext): number | null {
  switch (unit) {
    case '': return value === 0 ? 0 : null;
    case 'px': return value;
    case 'rem': case 'em': return value * ROOT_FONT_PX;
    case 'ch': return value * ROOT_FONT_PX * 0.5;
    case 'vw': case 'svw': case 'lvw': case 'dvw': return (value / 100) * ctx.viewportWidth;
    case 'vh': case 'svh': case 'lvh': case 'dvh': return (value / 100) * ctx.viewportHeight;
    case 'vmin': return (value / 100) * Math.min(ctx.viewportWidth, ctx.viewportHeight);
    case 'vmax': return (value / 100) * Math.max(ctx.viewportWidth, ctx.viewportHeight);
    case 'pt': return value * (96 / 72);
    default: return null;
  }
}

/** Evaluate a length (including calc/clamp/min/max) in px; percentages and unknown units yield null. */
export function lengthPx(raw: string | undefined, ctx: LengthContext): number | null {
  if (raw === undefined) return null;
  const value = raw.trim().toLowerCase();
  const plain = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)([a-z]*)$/.exec(value);
  if (plain) return unitPx(parseFloat(plain[1]!), plain[2]!, ctx);
  const fn = /^(calc|clamp|min|max)\((.*)\)$/.exec(value);
  if (!fn) return null;
  const name = fn[1]!; const body = fn[2]!;
  if (name === 'calc') return evalCalc(body, ctx);
  const args = splitTopLevel(body).map((arg) => evalCalc(arg, ctx));
  if (args.some((arg) => arg === null)) return null;
  const nums = args as number[];
  if (name === 'min') return Math.min(...nums);
  if (name === 'max') return Math.max(...nums);
  if (nums.length !== 3) return null;
  return Math.min(Math.max(nums[1]!, nums[0]!), nums[2]!);
}

function evalCalc(expression: string, ctx: LengthContext): number | null {
  const tokens = expression.match(/-?\d*\.?\d+[a-z%]*|[()+\-*/]|[a-z]+\([^()]*\)/gi) ?? [];
  let pos = 0;
  const factor = (): number | null => {
    const token = tokens[pos++];
    if (token === undefined) return null;
    if (token === '(') {
      const inner = sum();
      pos++;
      return inner;
    }
    if (/^[a-z]+\(/i.test(token)) return lengthPx(token, ctx);
    const unitless = /^-?\d*\.?\d+$/.test(token);
    return unitless ? parseFloat(token) : lengthPx(token, ctx);
  };
  const product = (): number | null => {
    let left = factor();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const right = factor();
      if (left === null || right === null) return null;
      left = op === '*' ? left * right : right === 0 ? null : left / right;
    }
    return left;
  };
  const sum = (): number | null => {
    let left = product();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const right = product();
      if (left === null || right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };
  const result = sum();
  return result === null || !Number.isFinite(result) ? null : result;
}

export interface ShadowLayer { inset: boolean; x: number; y: number; blur: number; spread: number; color: Rgba | null }

export function parseShadows(value: string | undefined, ctx: LengthContext): ShadowLayer[] {
  if (!value || /^\s*none\s*$/i.test(value)) return [];
  return splitTopLevel(value).map((layer) => {
    const colors = colorsIn(layer);
    const withoutColors = layer.replace(COLOR_TOKEN, ' ');
    const lengths = (withoutColors.match(/-?\d*\.?\d+[a-z]*|calc\([^)]*\)/gi) ?? [])
      .map((token) => lengthPx(token, ctx) ?? 0);
    return {
      inset: /\binset\b/i.test(layer),
      x: lengths[0] ?? 0,
      y: lengths[1] ?? 0,
      blur: Math.max(0, lengths[2] ?? 0),
      spread: lengths[3] ?? 0,
      color: colors[0] ?? null,
    };
  });
}

/** Largest blur() radius in a filter or backdrop-filter value, in px. */
export function blurPx(value: string | undefined, ctx: LengthContext): number {
  if (!value) return 0;
  let max = 0;
  for (const match of value.matchAll(/blur\(\s*([^)]*)\)/gi)) {
    max = Math.max(max, lengthPx(match[1] || '0px', ctx) ?? 0);
  }
  return max;
}

const GRADIENT = /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i;

export function hasGradient(value: string | undefined): boolean {
  return !!value && GRADIENT.test(value);
}

export function urlsIn(value: string | undefined): string[] {
  if (!value) return [];
  return [...value.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map((match) => match[2]!.trim());
}

/** Largest corner radius: px when absolute, or a percentage of the box. */
export function radiusOf(value: string | undefined, ctx: LengthContext): { px: number; percent: number } {
  const out = { px: 0, percent: 0 };
  if (!value) return out;
  const horizontal = value.split('/')[0] ?? '';
  for (const token of horizontal.trim().split(/\s+(?![^(]*\))/)) {
    if (token.endsWith('%')) out.percent = Math.max(out.percent, parseFloat(token) || 0);
    else out.px = Math.max(out.px, lengthPx(token, ctx) ?? 0);
  }
  return out;
}
