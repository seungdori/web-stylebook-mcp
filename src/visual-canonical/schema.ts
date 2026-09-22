// SPDX-License-Identifier: MIT
import { z } from 'zod';
import { COLOR_ROLES, TYPOGRAPHY_ROLES } from './types.js';
import { visualContentHash } from './hash.js';
import type { ResolvedVisualContract } from './types.js';

export const zVisualColor = z.string().max(100).refine((s) => /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(s) || /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(s) && (s.match(/\d+(?:\.\d+)?/g) ?? []).slice(0,3).every((n) => Number(n) <= 255), 'Use a hex or rgb/rgba color');
export const zVisualColors = z.object(Object.fromEntries(COLOR_ROLES.map((k) => [k, zVisualColor])) as Record<typeof COLOR_ROLES[number], typeof zVisualColor>).strict();
const zFamily = z.string().trim().min(1).max(250).regex(/^[\p{L}\p{N}\s,'"._-]+$/u, 'Use font family names only');
export const zTypographyRole = z.object({
  fontFamily: zFamily, fontWeight: z.number().min(100).max(900), fontStyle: z.enum(['normal', 'italic']),
  sizeMinRem: z.number().min(0.5).max(20), sizeMaxRem: z.number().min(0.5).max(30),
  lineHeight: z.number().min(0.8).max(3), letterSpacingEm: z.number().min(-0.15).max(0.5),
  paragraphSpacingEm: z.number().min(0).max(6), measureCh: z.number().min(8).max(120),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']), wordBreak: z.enum(['normal', 'keep-all']),
  overflowWrap: z.enum(['normal', 'anywhere']), fontVariantNumeric: z.enum(['normal', 'tabular-nums']),
}).strict();
const zRoleNames = z.enum(TYPOGRAPHY_ROLES);
export const zFontMetadata = z.object({
  family: zFamily, source: z.enum(['system', 'external', 'user']),
  stylesheetUrl: z.string().max(2048).url().startsWith('https://').optional(), license: z.string().min(1).max(512),
  licenseUrl: z.string().max(2048).url().startsWith('https://').optional(), weights: z.array(z.number().min(100).max(900)),
  scripts: z.array(z.enum(['latin', 'hangul', 'japanese'])), fallback: zFamily,
  availability: z.enum(['system-dependent', 'requires-load', 'unverified']),
}).strict();
export const zVisualOverrides = z.object({
  colors: zVisualColors.partial().optional(),
  typography: z.partialRecord(zRoleNames, zTypographyRole.partial()).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  spacing: z.object({unit:z.number().min(0).max(32),section:z.number().min(0).max(256),stack:z.number().min(0).max(100),density:z.enum(['comfortable','compact']),row:z.number().min(24).max(100),gutter:z.number().min(0).max(100)}).strict().partial().optional(),
  fonts: z.array(zFontMetadata).max(24).optional(),
}).strict().superRefine((overrides, context) => {
  if (!overrides.density || !overrides.spacing) return;
  const expected = overrides.density === 'compact'
    ? { density: 'compact', row: 32, gutter: 12, stack: 12 }
    : { density: 'comfortable', row: 44, gutter: 24, stack: 20 };
  for (const key of ['density', 'row', 'gutter', 'stack'] as const) {
    if (overrides.spacing[key] !== undefined && overrides.spacing[key] !== expected[key]) {
      context.addIssue({ code: 'custom', path: ['spacing', key], message: `Spacing ${key} conflicts with the explicit ${overrides.density} density preset; provide exact spacing or a density preset.` });
    }
  }
});
export const zVisualRepair = z.object({ id: z.string().min(1).max(200), role: z.enum(COLOR_ROLES), before: zVisualColor, after: zVisualColor, pairId: z.string().min(1).max(200), reason: z.string().min(1).max(512) }).strict();
const zPair = z.object({id: z.string().min(1), foreground: z.enum(COLOR_ROLES), background: z.enum(COLOR_ROLES), kind: z.enum(['text', 'large-text', 'control', 'decorative']), context: z.string().min(1)}).strict();
const zShadow = z.string().max(300).regex(/^(?:none|[-\d\s.,()%#a-fprgbx inset]+)$/i, 'Use a literal shadow without CSS functions or URLs');
const shape = {
  schema: z.literal('webstylebook.visual.v1'), styleId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), revision: z.string().regex(/^fnv1a:[\da-f]{16}$/),
  typography: z.object({roles: z.record(zRoleNames, zTypographyRole), fonts: z.array(zFontMetadata)}).strict(),
  spacing: z.object({unit:z.number().min(0).max(32),section:z.number().min(0).max(256),stack:z.number().min(0).max(100),density:z.enum(['comfortable','compact']),row:z.number().min(24).max(100),gutter:z.number().min(0).max(100)}).strict(),
  borders:z.object({width:z.number().min(0).max(12),style:z.enum(['solid','dashed','double'])}).strict(),
  radii:z.object({sm:z.number().min(0).max(100),md:z.number().min(0).max(100),lg:z.number().min(0).max(100)}).strict(),
  shadows:z.object({sm:zShadow,md:zShadow,lg:zShadow}).strict(),
  motion:z.object({duration:z.number().min(0).max(10000),easing:z.string().regex(/^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([-\d.,\s]+\))$/),reducedMotion:z.literal('none'),continuous:z.boolean()}).strict(),
  components:z.array(zPair),
  usage:z.object({preserve:z.array(z.string()),adapt:z.array(z.string()),verify:z.array(z.string())}).strict(),
  provenance:z.object({source:z.string(),selectors:z.array(z.string()),notes:z.array(z.string()),adaptation:z.string(),authoredPaths:z.array(z.string())}).strict(),
};
const zModeRecipe = z.object({colors:zVisualColors,backdropDependent:z.boolean(),typography:shape.typography.optional(),spacing:shape.spacing.optional(),borders:shape.borders.optional(),radii:shape.radii.optional(),shadows:shape.shadows.optional(),motion:shape.motion.optional(),components:shape.components.optional(),usage:shape.usage.optional()}).strict();
export const zVisualContract = z.object({...shape, defaultMode:z.enum(['light','dark']), modes:z.object({light:zModeRecipe.optional(),dark:zModeRecipe.optional()}).strict()}).strict().refine((v)=>v.modes[v.defaultMode]!==undefined,{message:'The default mode must be authored'});
export const zResolvedVisualContract = z.object({...shape, contentHash:z.string().regex(/^fnv1a:[\da-f]{16}$/),mode:z.enum(['light','dark']),contentLocale:z.enum(['en','ko','ja']),colors:zVisualColors,backdropDependent:z.boolean(),overrides:zVisualOverrides,origins:z.record(z.string(),z.enum(['authored','adaptation','locale','override','repair'])),repairs:z.array(zVisualRepair),warnings:z.array(z.string())}).strict();
export const zVisualResolutionOptions = z.object({mode:z.enum(['light','dark']).optional(),contentLocale:z.enum(['en','ko','ja']).optional(),overrides:zVisualOverrides.optional(),acceptedRepairs:z.array(zVisualRepair).optional()}).strict();
export function validateResolvedVisualContract(input: unknown): ResolvedVisualContract {
  const parsed = zResolvedVisualContract.parse(input);
  const {contentHash, ...data} = parsed;
  if (visualContentHash(data) !== contentHash) throw new Error('The resolved design content hash does not match its values');
  return parsed;
}
export const parseResolvedVisualContract = validateResolvedVisualContract;

export const visualContractSchema = zVisualContract;
export const visualOverridesSchema = zVisualOverrides;
