// Token compiler — compose_design_tokens (01 §8.7, 02 §13, 08 §8).
// Pipeline: style palette/accent -> family defaults -> secondary overlay -> accent
// override -> density override -> color-mode resolution -> contrast warnings -> format.

import type { DesignTokens, DesignTokenColor, Lang } from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import { parseHex, luminanceOf, contrastRatio, checkContrast, type Rgb } from './contrast.js';

export interface ComposeDesignTokensInput {
  primaryStyleId: string;
  secondaryStyleId?: string;
  accentOverride?: string;
  format: 'json' | 'css-variables' | 'tailwind' | 'typescript';
  density?: 'comfortable' | 'compact';
  colorMode?: 'light' | 'dark' | 'both';
  locale?: Lang;
}

export interface ComposeDesignTokensResult {
  primaryStyleId: string;
  secondaryStyleId?: string;
  format: string;
  colorMode: 'light' | 'dark' | 'both';
  tokens: DesignTokens | { light: DesignTokens; dark: DesignTokens };
  rendered: string;
  warnings: string[];
  notes: string[];
}

export class TokenError extends Error {}

function toHex(rgb: Rgb): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}
function blend(a: string, b: string, t: number): string {
  const ra = parseHex(a); const rb = parseHex(b);
  if (!ra || !rb) return a;
  return toHex({ r: ra.r + (rb.r - ra.r) * t, g: ra.g + (rb.g - ra.g) * t, b: ra.b + (rb.b - ra.b) * t });
}
function bestTextOn(bg: string): string {
  // true black/white maximize contrast; #111 silently lost ~0.4 ratio and pushed
  // mid-tone accents (e.g. #ab6b49) below AA on the primary-action label.
  return contrastRatio('#ffffff', bg) >= contrastRatio('#000000', bg) ? '#ffffff' : '#000000';
}

const STATUS = {
  light: { positive: '#1a7f37', caution: '#9a6700', critical: '#cf222e', info: '#0969da' },
  dark: { positive: '#3fb950', caution: '#d29922', critical: '#f85149', info: '#58a6ff' },
};

function chromaOf(hex: string): number {
  const c = parseHex(hex);
  if (!c) return 0;
  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
}

const NEUTRAL_CHROMA = 28; // <= this counts as "neutral enough" to be a page background

// A usable canvas anchor must be low-chroma AND actually light (light mode) or dark
// (dark mode) — the lightest *available* neutral can still be near-black. If none
// qualifies, return null so the caller synthesizes a proper tinted-neutral.
function pickNeutralAnchor(palette: string[], want: 'light' | 'dark'): string | null {
  const neutrals = palette.filter((p) => parseHex(p) && chromaOf(p) <= NEUTRAL_CHROMA);
  if (want === 'light') {
    const light = neutrals.filter((p) => luminanceOf(p) >= 0.45).sort((a, b) => luminanceOf(b) - luminanceOf(a));
    return light[0] ?? null;
  }
  const dark = neutrals.filter((p) => luminanceOf(p) <= 0.18).sort((a, b) => luminanceOf(a) - luminanceOf(b));
  return dark[0] ?? null;
}

function mostSaturated(palette: string[]): string {
  const valid = palette.filter((p) => parseHex(p));
  return valid.slice().sort((a, b) => chromaOf(b) - chromaOf(a))[0] ?? '#808080';
}

/** Shift accent toward black/white until it clears 3:1 on canvas; fall back to ink. */
function repairFocus(accent: string, canvas: string, ink: string, mode: 'light' | 'dark'): string {
  const target = mode === 'light' ? '#000000' : '#ffffff';
  for (let t = 0.15; t <= 0.85; t += 0.15) {
    const shifted = blend(accent, target, t);
    if (contrastRatio(shifted, canvas) >= 3) return shifted;
  }
  return ink;
}

// Build role-based colors that are USABLE, not just warned about (eval issue #1):
// synthesize a tinted-neutral canvas when the palette has no neutral anchor, guarantee
// AA body text, and repair the focus ring — returning the repaired values + a repair log.
function buildColor(palette: string[], accent: string, mode: 'light' | 'dark', secondaryAccent?: string): { color: DesignTokenColor; repairs: string[] } {
  const repairs: string[] = [];
  const valid = palette.filter((p) => parseHex(p));
  const tintSource = mostSaturated(valid.length ? valid : [accent]);

  // canvas: prefer a neutral palette anchor; else synthesize a barely-tinted near-white/near-black
  let canvas = pickNeutralAnchor(valid, mode);
  if (!canvas) {
    canvas = mode === 'light' ? blend('#ffffff', tintSource, 0.04) : blend('#0b0b0c', tintSource, 0.06);
    repairs.push(`canvas synthesized as a tinted-neutral — palette had no low-chroma ${mode} anchor`);
  }

  // ink/text: prefer a neutral anchor at the opposite end; force a neutral if it fails AA on canvas
  let ink = pickNeutralAnchor(valid, mode === 'light' ? 'dark' : 'light');
  if (!ink || contrastRatio(ink, canvas) < 4.5) {
    if (ink && contrastRatio(ink, canvas) < 4.5) repairs.push('text replaced with a neutral — palette text candidate failed AA on canvas');
    ink = mode === 'light' ? '#0a0a0b' : '#fafafa';
  }

  // focus: accent if it reads on canvas; else repair (shifted accent, then ink) and RETURN the fixed value
  let focus = accent;
  if (contrastRatio(accent, canvas) < 3) {
    focus = repairFocus(accent, canvas, ink, mode);
    repairs.push(`focus derived from ${focus === ink ? 'text ink' : 'a darkened/lightened accent'} — raw accent was <3:1 on canvas`);
  }

  const status = STATUS[mode];
  return {
    color: {
      canvas,
      surface: blend(canvas, ink, 0.03),
      surfaceRaised: blend(canvas, ink, mode === 'light' ? 0.05 : 0.1),
      surfaceMuted: blend(canvas, ink, 0.08),
      text: ink,
      textMuted: blend(ink, canvas, 0.32),
      textInverse: canvas,
      border: blend(canvas, ink, 0.22),       // >=22% — borders must be visibly visible
      borderStrong: blend(canvas, ink, 0.4),
      accent,
      accentText: bestTextOn(accent),
      ...(secondaryAccent ? { accentSecondary: secondaryAccent, accentSecondaryText: bestTextOn(secondaryAccent) } : {}),
      positive: status.positive,
      caution: status.caution,
      critical: status.critical,
      info: status.info,
      focus,
    },
    repairs,
  };
}

function buildTokens(
  repo: CatalogRepository, primaryId: string, mode: 'light' | 'dark', accent: string, density: 'comfortable' | 'compact',
  secondaryAccent?: string,
): { tokens: DesignTokens; repairs: string[] } {
  const style = repo.getStyle(primaryId);
  if (!style) throw new TokenError(`unknown style '${primaryId}'`);
  const family = style.styleFamilyId ? repo.getFamily(style.styleFamilyId) : undefined;
  const td = family?.tokenDefaults;

  const compact = density === 'compact';
  const { color, repairs } = buildColor(style.palette, accent, mode, secondaryAccent);
  const tokens: DesignTokens = {
    color,
    typography: {
      displayFamily: td?.typography.displayFamily ?? 'system-ui, sans-serif',
      bodyFamily: td?.typography.bodyFamily ?? 'system-ui, sans-serif',
      monoFamily: td?.typography.monoFamily ?? 'ui-monospace, monospace',
      scale: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.5rem', '2xl': '2rem', '3xl': '3rem' },
      lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 },
    },
    spacing: compact
      ? { '1': '4px', '2': '8px', '3': '12px', '4': '16px', '6': '20px', '8': '28px' }
      : { '1': '4px', '2': '8px', '3': '12px', '4': '16px', '6': '24px', '8': '32px' },
    radius: td?.radius ?? { sm: '4px', md: '8px', lg: '16px' },
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.06)',
      md: '0 4px 12px rgba(0,0,0,0.10)',
      lg: '0 12px 32px rgba(0,0,0,0.16)',
    },
    motion: td?.motion ?? { duration: '200ms', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    density: td?.density ?? (compact ? { row: '32px', gutter: '12px' } : { row: '40px', gutter: '20px' }),
  };
  return { tokens, repairs };
}

function warningsFor(t: DesignTokens, mode: string, accentOverridden: boolean): { warnings: string[]; notes: string[] } {
  const warnings: string[] = [];
  const notes: string[] = [];
  const body = checkContrast(t.color.text, t.color.canvas, `body text (${mode})`, 4.5);
  if (body) warnings.push(body.message);
  const acc = checkContrast(t.color.accentText, t.color.accent, `accent text (${mode})`, 4.5);
  if (acc) warnings.push(acc.message);
  if (t.color.accentSecondary && t.color.accentSecondaryText) {
    const sec = checkContrast(t.color.accentSecondaryText, t.color.accentSecondary, `accent-secondary text (${mode})`, 4.5);
    if (sec) warnings.push(sec.message);
  }
  const focus = checkContrast(t.color.focus, t.color.canvas, `focus ring (${mode})`, 3);
  if (focus) warnings.push(focus.message);
  // accent as a fill / icon / link on canvas needs >=3:1 for non-text UI; >=4.5 if used as text.
  const accentOnCanvas = checkContrast(t.color.accent, t.color.canvas, `accent on canvas (${mode})`, 3);
  if (accentOnCanvas) warnings.push(accentOnCanvas.message);
  else notes.push(`Accent on canvas passes for large fills/icons/borders (>=3:1); if you use the accent as TEXT, verify >=4.5:1 first.`);
  if (accentOverridden) notes.push(`Accent was overridden — verify accent/status color distinction and contrast in context.`);
  notes.push(`Status colors are accessible defaults, not brand-derived — confirm they fit the product.`);
  return { warnings, notes };
}

export function composeDesignTokens(input: ComposeDesignTokensInput, repo: CatalogRepository): ComposeDesignTokensResult {
  const style = repo.getStyle(input.primaryStyleId);
  if (!style) throw new TokenError(`unknown style '${input.primaryStyleId}'`);
  if (input.secondaryStyleId && !repo.getStyle(input.secondaryStyleId)) {
    throw new TokenError(`unknown secondary style '${input.secondaryStyleId}'`);
  }
  // presence, not truthiness: '' must be rejected, not silently fall through to style.accent
  let accent: string;
  if (input.accentOverride !== undefined) {
    if (!parseHex(input.accentOverride)) {
      throw new TokenError(`accentOverride '${input.accentOverride}' is not a valid hex color`);
    }
    accent = input.accentOverride;
  } else {
    accent = style.accent;
  }
  const density = input.density ?? 'comfortable';
  const colorMode = input.colorMode ?? 'light';

  // secondary overlay: the secondary style's accent becomes accentSecondary for secondary surfaces
  const secondaryStyle = input.secondaryStyleId ? repo.getStyle(input.secondaryStyleId) : undefined;
  const secondaryAccent = secondaryStyle?.accent;

  const allWarnings: string[] = [];
  const allNotes = new Set<string>();
  let tokens: ComposeDesignTokensResult['tokens'];
  if (secondaryStyle) allNotes.add(`Secondary overlay: accentSecondary = ${secondaryStyle.id}'s accent — apply it to secondary/role surfaces (forms, nav), not the primary action.`);
  // connect the facet-layer 'dark-only' assertion to the token output (round 5)
  if (colorMode !== 'dark' && style.recommendationFacets.risks.some((r) => r.toLowerCase().includes('dark-only'))) {
    allNotes.add(`${style.id} is a dark-only style; ${colorMode === 'both' ? 'the light' : 'these light'} tokens are a mechanical inversion and may not match the intended aesthetic — prefer the dark set or reconsider the style for a light surface.`);
  }

  if (colorMode === 'both') {
    const light = buildTokens(repo, input.primaryStyleId, 'light', accent, density, secondaryAccent);
    const dark = buildTokens(repo, input.primaryStyleId, 'dark', accent, density, secondaryAccent);
    tokens = { light: light.tokens, dark: dark.tokens };
    for (const [m, built] of [['light', light], ['dark', dark]] as const) {
      const w = warningsFor(built.tokens, m, !!input.accentOverride);
      allWarnings.push(...w.warnings); w.notes.forEach((n) => allNotes.add(n));
      built.repairs.forEach((r) => allNotes.add(`Auto-repaired (${m}): ${r}`));
    }
  } else {
    const single = buildTokens(repo, input.primaryStyleId, colorMode, accent, density, secondaryAccent);
    tokens = single.tokens;
    const w = warningsFor(single.tokens, colorMode, !!input.accentOverride);
    allWarnings.push(...w.warnings); w.notes.forEach((n) => allNotes.add(n));
    single.repairs.forEach((r) => allNotes.add(`Auto-repaired: ${r}`));
  }

  // flag when the family-derived font stack contradicts the style's documented typography
  // intent (round 6): the fonts are family DEFAULTS, not derived from style.typography.
  const sampleTokens = ('light' in tokens ? tokens.light : tokens) as DesignTokens;
  const fontStack = `${sampleTokens.typography.displayFamily} ${sampleTokens.typography.bodyFamily}`.toLowerCase();
  const typoIntent = style.typography.toLowerCase();
  // 'serif' as a positive type indicator: not 'sans-serif', not negated even with an
  // intervening adjective ('no classical serif', 'without any serif', 'anti-serif').
  const wantsSerif = /\bserif\b/.test(typoIntent)
    && !/sans-?\s?serif/.test(typoIntent)
    && !/\b(?:no|without|not|anti|never)\b[\w\s-]{0,24}?\bserif\b/.test(typoIntent);
  // strip the CSS generic 'sans-serif' before checking the stack for a real serif face
  const fontsNoSans = fontStack.replace(/sans-serif/g, ' ');
  const hasSerif = /\bserif\b|fraunces|georgia|sectra|tiempos|source serif|playfair|lora/.test(fontsNoSans);
  if (wantsSerif && !hasSerif) {
    allNotes.add(`Typography: ${style.id}'s intended type ("${style.typography}") suggests a serif face, but these are sans family-defaults — override display/body font to match the style.`);
  } else {
    allNotes.add(`Typography fonts are ${style.styleFamilyId ?? 'default'}-family starting points, not derived from the style's own typography ("${style.typography}") — reconcile if needed.`);
  }

  const rendered = render(input.format, tokens, colorMode);
  return {
    primaryStyleId: input.primaryStyleId,
    ...(input.secondaryStyleId ? { secondaryStyleId: input.secondaryStyleId } : {}),
    format: input.format,
    colorMode,
    tokens,
    rendered,
    warnings: allWarnings,
    notes: [...allNotes],
  };
}

/* ----------------------------- renderers ----------------------------- */

function flatten(t: DesignTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.color)) out[`color-${k}`] = String(v);
  out['font-display'] = t.typography.displayFamily;
  out['font-body'] = t.typography.bodyFamily;
  out['font-mono'] = t.typography.monoFamily;
  for (const [k, v] of Object.entries(t.typography.scale)) out[`text-${k}`] = v;
  for (const [k, v] of Object.entries(t.spacing)) out[`space-${k}`] = v;
  for (const [k, v] of Object.entries(t.radius)) out[`radius-${k}`] = v;
  for (const [k, v] of Object.entries(t.shadow)) out[`shadow-${k}`] = v;
  for (const [k, v] of Object.entries(t.motion)) out[`motion-${k}`] = v;
  for (const [k, v] of Object.entries(t.density)) out[`density-${k}`] = v;
  return out;
}

function cssBlock(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n');
  return `${selector} {\n${lines}\n}`;
}

function render(format: ComposeDesignTokensInput['format'], tokens: ComposeDesignTokensResult['tokens'], mode: string): string {
  const isBoth = 'light' in tokens && 'dark' in tokens;
  if (format === 'json') return JSON.stringify(tokens, null, 2);

  if (format === 'css-variables') {
    if (isBoth) {
      const { light, dark } = tokens as { light: DesignTokens; dark: DesignTokens };
      return [
        cssBlock(':root', flatten(light)),
        cssBlock('[data-theme="dark"]', flatten(dark)),
        `@media (prefers-color-scheme: dark) {\n${cssBlock('  :root:not([data-theme="light"])', flatten(dark))}\n}`,
      ].join('\n\n');
    }
    return cssBlock(':root', flatten(tokens as DesignTokens));
  }

  if (format === 'typescript') {
    return `// Web Stylebook tokens (${mode})\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const;\n`;
  }

  // tailwind: pure theme object (framework-version agnostic)
  const themeOf = (t: DesignTokens) => ({
    colors: t.color,
    fontFamily: { display: [t.typography.displayFamily], body: [t.typography.bodyFamily], mono: [t.typography.monoFamily] },
    fontSize: t.typography.scale,
    spacing: t.spacing,
    borderRadius: t.radius,
    boxShadow: t.shadow,
  });
  if (isBoth) {
    const { light, dark } = tokens as { light: DesignTokens; dark: DesignTokens };
    // both modes preserved — colors split by theme; shared scales hoisted (round 3 #: tailwind+both dropped dark)
    const both = { ...themeOf(light), colors: { light: light.color, dark: dark.color } };
    return `// Tailwind theme.extend — colors.light / colors.dark for both modes\nexport const theme = ${JSON.stringify(both, null, 2)};\n`;
  }
  return `// Tailwind theme.extend (framework-version agnostic)\nexport const theme = ${JSON.stringify(themeOf(tokens as DesignTokens), null, 2)};\n`;
}
