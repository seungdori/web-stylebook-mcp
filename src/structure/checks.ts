import { text } from '../localization.js';
import type { AuditApplicability, AuditSeverity, Lang } from '../types.js';
import { structureGuide } from './guidance.js';
import { GLOBAL_PATTERNS, styleRuleText } from './patterns.js';
import type { GlobalPatternId, StyleBanDef } from './types.js';

export interface StructureCheckDef {
  id: string;
  patternId: string;
  scope: 'global' | 'style';
  severity: AuditSeverity;
  applicability: AuditApplicability;
  criterion: string;
  why: string;
  remediation: string;
}

const WHEN_PRESENT: ReadonlySet<GlobalPatternId> = new Set(['gradient-blob-hero', 'centered-stack-hero', 'stock-photo-hero', 'closing-cta-banner']);

const wording: Record<Lang, { global: (name: string) => string; style: (name: string) => string }> = {
  en: {
    global: (name) => `Confirm audit_page_structure finds no ${name} in the built page.`,
    style: (name) => `Confirm audit_page_structure finds no style-specific violation: ${name}.`,
  },
  ko: {
    global: (name) => `audit_page_structure가 빌드한 페이지에서 '${name}'을(를) 찾지 않는지 확인`,
    style: (name) => `audit_page_structure가 스타일 전용 금지 항목 '${name}' 위반을 찾지 않는지 확인`,
  },
  ja: {
    global: (name) => `audit_page_structureがビルドしたページで「${name}」を検出しないことを確認`,
    style: (name) => `audit_page_structureがスタイル固有の禁止項目「${name}」の違反を検出しないことを確認`,
  },
};

export function structureCheckId(patternId: string, ban?: StyleBanDef): string {
  return ban ? `structure-style-${ban.rule}` : `structure-${patternId}`;
}

/** Audit-plan checks for the structure group: every global pattern the style does not allow, then its style bans. */
export function structureChecks(styleId: string | undefined, locale: Lang): StructureCheckDef[] {
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
  return checks;
}
