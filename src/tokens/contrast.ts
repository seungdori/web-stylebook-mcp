import { parseVisualColor, visualContrastRatio } from '../visual-canonical/contrast.js';

export interface Rgb { r: number; g: number; b: number; }
/** Rgb plus alpha in 0..1, where 1 is opaque. */
export interface Rgba extends Rgb { a: number; }

/**
 * The hex colors `accentOverride` accepts: 3, 6 or 8 digits (the last two of 8 are alpha), `#` optional.
 * The MCP schema and the compilers share this pattern, so both accept and reject the same inputs.
 */
export const HEX_COLOR_INPUT = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * The CSS hex color for an accepted input: a missing `#` is added and nothing else changes
 * (case, length and alpha stay as given), so `000000` becomes `#000000`. null when not accepted.
 */
export function normalizeHexColor(input: string): string | null {
  if (!HEX_COLOR_INPUT.test(input)) return null;
  return input.startsWith('#') ? input : `#${input}`;
}

// The legacy readers also tolerate surrounding space; the visual contract's helpers need the '#' form.
function cssHex(hex: string): string | null {
  return normalizeHexColor(hex.trim());
}

/** Parses 3/6/8-digit hex (`#` optional, surrounding space ignored). An 8-digit alpha is kept, not dropped. */
export function parseHex(hex: string): Rgba | null {
  const css = cssHex(hex);
  // the visual contract's parser, so both token paths read alpha the same way
  return css === null ? null : parseVisualColor(css);
}

// 0.04045 is the sRGB breakpoint the visual contract uses. No 8-bit channel lies between it and
// the older 0.03928 (10/255 < 0.03928 < 0.04045 < 11/255), so opaque colors measure exactly as before.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function over(top: Rgba, bottom: Rgb): Rgba {
  if (top.a === 1) return top;
  return { r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 };
}

/**
 * The opaque color `color` shows when painted (source-over) on an opaque `backdrop`; channels stay
 * fractional. An opaque `color` is returned as parsed. null when either is unparseable or the backdrop is translucent.
 */
export function compositeOver(color: string, backdrop: string): Rgba | null {
  const top = parseHex(color); const bottom = parseHex(backdrop);
  if (!top || !bottom || bottom.a < 1) return null;
  return over(top, bottom);
}

/**
 * WCAG contrast ratio (1..21) of `fg` on `bg`. Returns 0 if either color is unparseable.
 * A translucent `fg` is composited over `bg`. A translucent `bg` is composited over `backdrop` when an
 * opaque one is given; otherwise what shows through it is unknown and the result is null, never a guess
 * (a translucent black is not 21:1 against white text).
 */
export function contrastRatio(fg: string, bg: string, backdrop?: string): number | null {
  const f = cssHex(fg); const b = cssHex(bg);
  if (f === null || b === null) return 0;
  if (backdrop === undefined || parseVisualColor(b)!.a === 1) {
    // the visual contract's rule: a translucent foreground over an opaque background, else undetermined
    return visualContrastRatio(f, b);
  }
  const base = compositeOver(b, backdrop);
  if (!base) return null;
  const la = relativeLuminance(over(parseVisualColor(f)!, base)); const lb = relativeLuminance(base);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Relative luminance of the color's RGB; alpha is ignored, so composite a translucent color first. */
export function luminanceOf(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? relativeLuminance(rgb) : 0;
}

export interface ContrastWarning {
  pair: string;
  /** null when `bg` is translucent and its backdrop is unknown: the pair needs a rendered review. */
  ratio: number | null;
  threshold: number;
  message: string;
}

/** AA: 4.5 for body text, 3.0 for large text / UI / focus. `backdrop` is what a translucent `bg` sits on. */
export function checkContrast(fg: string, bg: string, label: string, threshold = 4.5, backdrop?: string): ContrastWarning | null {
  const exact = contrastRatio(fg, bg, backdrop);
  if (exact === null) {
    return { pair: label, ratio: null, threshold, message: `${label}: the background is translucent and its backdrop is unknown — requires rendered contrast review.` };
  }
  // compare the UNROUNDED ratio (rounding first let 4.4955→4.50 pass and suppressed the warning)
  if (exact >= threshold) return null;
  const ratio = Math.round(exact * 100) / 100;
  return {
    pair: label,
    ratio,
    threshold,
    message: `${label} contrast ${ratio}:1 is below WCAG AA ${threshold}:1 — verify or adjust.`,
  };
}
