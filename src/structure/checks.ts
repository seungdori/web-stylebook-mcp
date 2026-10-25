import { text } from '../localization.js';
import type { AuditApplicability, AuditSeverity, Lang, ProductType } from '../types.js';
import { structureGuide } from './guidance.js';
import { ZONE_TEXT, mustHaveCheckId, mustHaveDef, mustHavePatternId, productMustHaveDef } from './must-haves.js';
import { GLOBAL_PATTERNS, styleRuleText } from './patterns.js';
import type { GlobalPatternId, StyleBanDef } from './types.js';

export interface StructureCheckDef {
  id: string;
  patternId: string;
  scope: 'global' | 'style' | 'must-have';
  severity: AuditSeverity;
  applicability: AuditApplicability;
  criterion: string;
  why: string;
  remediation: string;
}

const WHEN_PRESENT: ReadonlySet<GlobalPatternId> = new Set(['gradient-blob-hero', 'centered-stack-hero', 'stock-photo-hero', 'closing-cta-banner']);

const wording: Record<Lang, { global: (name: string) => string; style: (name: string) => string; mustHave: (name: string, placement: string) => string }> = {
  en: {
    global: (name) => `Confirm audit_page_structure finds no ${name} in the built page.`,
    style: (name) => `Confirm audit_page_structure finds no style-specific violation: ${name}.`,
    mustHave: (name, placement) => `Confirm audit_page_structure finds the must-have ${name} in the built page. ${placement}`,
  },
  ko: {
    global: (name) => `audit_page_structure가 빌드한 페이지에서 '${name}'을(를) 찾지 않는지 확인`,
    style: (name) => `audit_page_structure가 스타일 전용 금지 항목 '${name}' 위반을 찾지 않는지 확인`,
    mustHave: (name, placement) => `audit_page_structure가 빌드한 페이지에서 필수 요소 '${name}'을(를) 찾는지 확인. ${placement}`,
  },
  ja: {
    global: (name) => `audit_page_structureがビルドしたページで「${name}」を検出しないことを確認`,
    style: (name) => `audit_page_structureがスタイル固有の禁止項目「${name}」の違反を検出しないことを確認`,
    mustHave: (name, placement) => `audit_page_structureがビルドしたページで必須要素「${name}」を検出することを確認。${placement}`,
  },
};

export function structureCheckId(patternId: string, ban?: StyleBanDef): string {
  return ban ? `structure-style-${ban.rule}` : `structure-${patternId}`;
}

/**
 * Audit-plan checks for the structure group: every global pattern the style does not allow, then its style bans, then
 * the product type's must-haves.
 */
export function structureChecks(styleId: string | undefined, locale: Lang, productType?: ProductType): StructureCheckDef[] {
  const guide = styleId ? structureGuide(styleId) : null;
  const allowed = new Set(Object.keys(guide?.allow ?? {}));
  const checks: StructureCheckDef[] = GLOBAL_PATTERNS.filter((pattern) => !allowed.has(pattern.id)).map((pattern) => ({
    id: structureCheckId(pattern.id),
    patternId: pattern.id,
    scope: 'global',
    severity: pattern.severity,
    applicability: WHEN_PRESENT.has(pattern.id) ? 'when-present' : 'always',
    criterion: wording[locale].global(text(pattern.name, locale)),
    why: text(pattern.description, locale),
    remediation: text(pattern.replace, locale),
  }));
  for (const ban of guide?.bans ?? []) {
    const rule = styleRuleText(ban.rule, ban.params as never);
    checks.push({
      id: structureCheckId(`${styleId}/${ban.rule}`, ban),
      patternId: `${styleId}/${ban.rule}`,
      scope: 'style',
      severity: ban.source.kind === 'constraint' ? 'major' : 'minor',
      applicability: 'always',
      criterion: wording[locale].style(text(rule.name, locale)),
      why: ban.why,
      remediation: text(rule.fix, locale),
    });
  }
  for (const item of (productType ? productMustHaveDef(productType)?.items : undefined) ?? []) {
    const def = mustHaveDef(item.id);
    const placement = text(ZONE_TEXT[item.zone], locale);
    checks.push({
      id: mustHaveCheckId(item.id),
      patternId: mustHavePatternId(item.id),
      scope: 'must-have',
      severity: 'major',
      applicability: 'always',
      criterion: wording[locale].mustHave(text(def.name, locale), placement),
      why: text(item.why, locale),
      remediation: `${text(def.build, locale)} ${placement}`,
    });
  }
  return checks;
}
