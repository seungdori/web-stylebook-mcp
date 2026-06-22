// WCAG contrast math (08 token compiler §8.4). No dependencies.

export interface Rgb { r: number; g: number; b: number; }

export function parseHex(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio (1..21). Returns 0 if either color is unparseable. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a); const rb = parseHex(b);
  if (!ra || !rb) return 0;
  const la = relativeLuminance(ra); const lb = relativeLuminance(rb);
  const hi = Math.max(la, lb); const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export function luminanceOf(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? relativeLuminance(rgb) : 0;
}

export interface ContrastWarning {
  pair: string;
  ratio: number;
  threshold: number;
  message: string;
}

/** AA: 4.5 for body text, 3.0 for large text / UI / focus. */
export function checkContrast(fg: string, bg: string, label: string, threshold = 4.5): ContrastWarning | null {
  const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
  if (ratio >= threshold) return null;
  return {
    pair: label,
    ratio,
    threshold,
    message: `${label} contrast ${ratio}:1 is below WCAG AA ${threshold}:1 — verify or adjust.`,
  };
}
