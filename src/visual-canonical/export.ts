// SPDX-License-Identifier: MIT
// Portable projections of a resolved contract. No DOM, React, network, or font loading.
import { TYPOGRAPHY_ROLES, type ResolvedVisualContract, type TypographyRole } from './types.js';

/** Fluid type uses the same 320–1280 px viewport range in preview and exported CSS. */
export function typographyRoleStyle(role: TypographyRole, basis: 'viewport' | 'container' = 'viewport') {
  const min = role.sizeMinRem;
  const max = role.sizeMaxRem;
  const slope = (max - min) / 60;
  const rounded = (n: number) => Number(n.toFixed(6));
  const fluidUnit = basis === 'container' ? 'cqi' : 'vw';
  return {
    fontFamily: role.fontFamily,
    fontWeight: role.fontWeight,
    fontStyle: role.fontStyle,
    fontSize: min === max ? `${min}rem` : `clamp(${min}rem, ${rounded(min - slope * 20)}rem + ${rounded(slope * 100)}${fluidUnit}, ${max}rem)`,
    lineHeight: role.lineHeight,
    letterSpacing: `${role.letterSpacingEm}em`,
    marginBlockEnd: `${role.paragraphSpacingEm}em`,
    maxWidth: `${role.measureCh}ch`,
    textTransform: role.textTransform,
    wordBreak: role.wordBreak,
    overflowWrap: role.overflowWrap,
    fontVariantNumeric: role.fontVariantNumeric,
  };
}

function kebab(value: string): string { return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`); }
function cssValue(value: string | number): string {
  const scalar = String(value);
  if ([...scalar].some((character) => character.charCodeAt(0) < 32) || /[;{}<>\\]|\/\*|\*\/|url\s*\(|expression\s*\(/i.test(scalar)) throw new Error('Unsafe visual contract CSS value');
  return scalar;
}

/** Every scalar has a variable; generated role classes apply the full type hierarchy. */
export function visualContractToCss(resolved: ResolvedVisualContract, selector = ':root'): string {
  if (!/^(?::root|\[data-theme="(?:light|dark)"\]|:root:not\(\[data-theme="light"\]\))$/.test(selector)) throw new Error('Unsupported visual contract CSS selector');
  const variables: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(resolved.colors)) variables[`color-${kebab(key)}`] = value;
  // Existing ColorSystem and MCP variable names remain as explicit aliases.
  variables['color-bg'] = resolved.colors.canvas;
  variables['color-primary'] = resolved.colors.accent;
  variables['color-secondary'] = resolved.colors.accentSecondary;
  for (const [key, value] of Object.entries(resolved.colors)) if (key !== kebab(key)) variables[`color-${key}`] = value;
  variables['font-display'] = resolved.typography.roles.display.fontFamily;
  variables['font-body'] = resolved.typography.roles.body.fontFamily;
  variables['font-mono'] = resolved.typography.roles.data.fontFamily;
  variables['line-height-tight'] = resolved.typography.roles.display.lineHeight;
  variables['line-height-normal'] = resolved.typography.roles.body.lineHeight;
  variables['line-height-relaxed'] = resolved.typography.roles.small.lineHeight;
  variables['density-row'] = `${resolved.spacing.row}px`;
  variables['density-gutter'] = `${resolved.spacing.gutter}px`;
  for (const [key, value] of Object.entries(resolved.spacing)) variables[`spacing-${kebab(key)}`] = typeof value === 'number' ? `${value}px` : value;
  for (const [key, value] of Object.entries(resolved.radii)) variables[`radius-${key}`] = `${value}px`;
  for (const [key, value] of Object.entries(resolved.shadows)) variables[`shadow-${key}`] = value;
  variables['border-width'] = `${resolved.borders.width}px`;
  variables['border-style'] = resolved.borders.style;
  variables['motion-duration'] = `${resolved.motion.duration}ms`;
  variables['motion-easing'] = resolved.motion.easing;
  variables['motion-reduced'] = resolved.motion.reducedMotion;
  variables['motion-continuous'] = String(resolved.motion.continuous);
  for (const name of TYPOGRAPHY_ROLES) {
    const role = resolved.typography.roles[name];
    for (const [key, value] of Object.entries(role)) variables[`type-${name}-${kebab(key)}`] = value;
    for (const [key, value] of Object.entries(typographyRoleStyle(role))) variables[`type-${name}-${kebab(key)}`] = value;
  }
  const block = `${selector} {\n${Object.entries(variables).map(([key, value]) => `  --${key}: ${cssValue(value)};`).join('\n')}\n}`;
  const classes = TYPOGRAPHY_ROLES.map((name) => `.ws-type-${name} {\n${Object.keys(typographyRoleStyle(resolved.typography.roles[name])).map((property) => `  ${kebab(property)}: var(--type-${name}-${kebab(property)});`).join('\n')}\n}`).join('\n\n');
  return `/* Web Stylebook visual contract ${resolved.styleId}; ${resolved.contentLocale}; ${resolved.mode}.\n * Components, font loading/licensing, usage, provenance and repairs remain in the JSON companion.\n * No font assets are bundled. Fluid type: 320–1280 px viewport, 16 px root baseline. */\n${block}\n\n${classes}\n\n@media (prefers-reduced-motion: reduce) {\n  ${selector} { --motion-duration: 0ms; --motion-continuous: false; }\n}\n`;
}

/** Theme mapping plus full metadata: unsupported properties never silently disappear. */
export function visualContractToTheme(resolved: ResolvedVisualContract) {
  const roleStyles = Object.fromEntries(TYPOGRAPHY_ROLES.map((name) => [name, typographyRoleStyle(resolved.typography.roles[name])]));
  return {
    extend: {
      colors: resolved.colors,
      fontFamily: Object.fromEntries(TYPOGRAPHY_ROLES.map((name) => [name, [resolved.typography.roles[name].fontFamily]])),
      fontSize: Object.fromEntries(TYPOGRAPHY_ROLES.map((name) => {
        const style = typographyRoleStyle(resolved.typography.roles[name]);
        return [name, [style.fontSize, { lineHeight: String(style.lineHeight), letterSpacing: style.letterSpacing, fontWeight: String(style.fontWeight) }]];
      })),
      spacing: Object.fromEntries(Object.entries(resolved.spacing).filter((entry) => typeof entry[1] === 'number').map(([name, value]) => [name, `${value}px`])),
      borderRadius: Object.fromEntries(Object.entries(resolved.radii).map(([name, value]) => [name, `${value}px`])),
      borderWidth: { DEFAULT: `${resolved.borders.width}px` },
      boxShadow: resolved.shadows,
      transitionDuration: { DEFAULT: `${resolved.motion.duration}ms` },
      transitionTimingFunction: { DEFAULT: resolved.motion.easing },
    },
    roleStyles,
    metadata: resolved,
  };
}

/** JSON strings are safe in external modules and when embedded in an HTML script tag. */
export function serializeVisualJson(value: unknown, indentation = 2): string {
  return JSON.stringify(value, null, indentation).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export type VisualExportFormat = 'json' | 'css-variables' | 'tailwind' | 'typescript';
/** The JSON companion is required when delivering CSS or a framework theme. */
export function exportVisualContract(resolved: ResolvedVisualContract, format: VisualExportFormat) {
  const metadata = resolved;
  if (format === 'css-variables') return { rendered: visualContractToCss(resolved), metadata };
  if (format === 'tailwind') return { rendered: `export const theme = ${serializeVisualJson(visualContractToTheme(resolved))};\n`, metadata };
  if (format === 'typescript') return { rendered: `export const visualContract = ${serializeVisualJson(resolved)} as const;\n`, metadata };
  return { rendered: serializeVisualJson(resolved), metadata };
}
