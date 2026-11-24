import { text } from '../localization.js';
import type { AuditApplicability, AuditEvidenceType, AuditSeverity, Lang, ProductType } from '../types.js';
import { structureGuide } from './guidance.js';
import { ZONE_TEXT, mustHaveCheckId, mustHaveDef, mustHaveExemptions, mustHavePatternId, productMustHaveDef, type MustHaveCondition } from './must-haves.js';
import { GLOBAL_PATTERNS, styleRuleText } from './patterns.js';
import type { GlobalPatternId, StyleBanDef } from './types.js';

/**
 * What a structure result can claim. A shape observation only says a generic shape is on the page; whether it gets in
 * the way of the page's task needs a judgment the static audit cannot make. Style fidelity measures the page against a
 * direction the caller chose. A required element is product information or a function the page needs.
 */
export type StructureClaim = 'shape-observation' | 'style-fidelity' | 'required-element';

export interface StructureCheckDef {
  id: string;
  patternId: string;
  scope: 'global' | 'style' | 'must-have';
  claim: StructureClaim;
  /** Severity once the claim is confirmed; a shape observation is confirmed by a task judgment, not by the shape. */
  severity: AuditSeverity;
  applicability: AuditApplicability;
  evidenceTypes: AuditEvidenceType[];
  criterion: string;
  why: string;
  remediation: string;
}

const WHEN_PRESENT: ReadonlySet<GlobalPatternId> = new Set(['gradient-blob-hero', 'centered-stack-hero', 'stock-photo-hero', 'closing-cta-banner']);

const wording: Record<Lang, {
  global: (name: string) => string;
  shape: (name: string) => string;
  shapeFix: (fix: string) => string;
  style: (name: string) => string;
  mustHave: (name: string, placement: string) => string;
  exempt: (when: string, reason: string) => string;
}> = {
  en: {
    global: (name) => `Confirm audit_page_structure finds no ${name} in the built page.`,
    shape: (name) => `Where audit_page_structure finds ${name}, judge against the page's task whether it gets in the way, and cite that judgment as manual evidence. The shape alone is not a defect.`,
    shapeFix: (fix) => `Only if it gets in the way of the task: ${fix} Keep it when it serves the task, for example cards that lead to different tasks.`,
    style: (name) => `Confirm audit_page_structure finds no style-specific violation: ${name}.`,
    mustHave: (name, placement) => `Confirm audit_page_structure finds the must-have ${name} in the built page. ${placement}`,
    exempt: (when, reason) => `Not applicable when absent, because the caller declared: ${when} Reason: ${reason}`,
  },
  ko: {
    global: (name) => `audit_page_structure가 빌드한 페이지에서 '${name}'을(를) 찾지 않는지 확인`,
    shape: (name) => `audit_page_structure가 '${name}'을(를) 찾은 곳에서 그 형태가 페이지의 과업을 방해하는지 판단하고, 판단을 manual 증거로 제출. 형태만으로는 결함이 아님`,
    shapeFix: (fix) => `과업을 방해할 때만 바꾸세요. ${fix} 서로 다른 업무로 이동하는 카드처럼 과업에 맞는 형태는 유지하세요.`,
    style: (name) => `audit_page_structure가 스타일 전용 금지 항목 '${name}' 위반을 찾지 않는지 확인`,
    mustHave: (name, placement) => `audit_page_structure가 빌드한 페이지에서 필수 요소 '${name}'을(를) 찾는지 확인. ${placement}`,
    exempt: (when, reason) => `호출자가 다음 조건을 밝혔으므로 없으면 해당 없음: ${when} 이유: ${reason}`,
  },
  ja: {
    global: (name) => `audit_page_structureがビルドしたページで「${name}」を検出しないことを確認`,
    shape: (name) => `audit_page_structureが「${name}」を検出した箇所で、その形がページのタスクを妨げるかを判断し、判断をmanual証拠として提出。形だけでは欠陥ではない`,
    shapeFix: (fix) => `タスクを妨げる場合だけ変えてください。${fix} 別々の業務へ進むカードのように、タスクに合う形は残してください。`,
    style: (name) => `audit_page_structureがスタイル固有の禁止項目「${name}」の違反を検出しないことを確認`,
    mustHave: (name, placement) => `audit_page_structureがビルドしたページで必須要素「${name}」を検出することを確認。${placement}`,
    exempt: (when, reason) => `呼び出し側が次の条件を示したため、なければ該当なし: ${when} 理由: ${reason}`,
  },
};

export function structureCheckId(patternId: string, ban?: StyleBanDef): string {
  return ban ? `structure-style-${ban.rule}` : `structure-${patternId}`;
}

/**
 * Audit-plan checks for the structure group: every global pattern the style does not allow, then its style bans, then
 * the product type's must-haves. Without a styleId, a global pattern is a shape observation: it applies where the
 * shape is found and needs a task judgment (manual evidence) before it can pass or need a fix. With a styleId, the
 * chosen direction bans the pattern, so finding it is a style-fidelity result.
 */
export function structureChecks(
  styleId: string | undefined, locale: Lang, productType?: ProductType, conditions?: readonly MustHaveCondition[],
): StructureCheckDef[] {
  const guide = styleId ? structureGuide(styleId) : null;
  const allowed = new Set(Object.keys(guide?.allow ?? {}));
  const checks: StructureCheckDef[] = GLOBAL_PATTERNS.filter((pattern) => !allowed.has(pattern.id)).map((pattern) => {
    const name = text(pattern.name, locale);
    const replace = text(pattern.replace, locale);
    return guide ? {
      id: structureCheckId(pattern.id),
      patternId: pattern.id,
      scope: 'global',
      claim: 'style-fidelity',
      severity: pattern.severity,
      applicability: WHEN_PRESENT.has(pattern.id) ? 'when-present' : 'always',
      evidenceTypes: ['dom'],
      criterion: wording[locale].global(name),
      why: text(pattern.description, locale),
      remediation: replace,
    } : {
      id: structureCheckId(pattern.id),
      patternId: pattern.id,
      scope: 'global',
      claim: 'shape-observation',
      severity: pattern.severity,
      applicability: 'when-present',
      evidenceTypes: ['manual'],
      criterion: wording[locale].shape(name),
      why: text(pattern.description, locale),
      remediation: wording[locale].shapeFix(replace),
    };
  });
  for (const ban of guide?.bans ?? []) {
    const rule = styleRuleText(ban.rule, ban.params as never);
    checks.push({
      id: structureCheckId(`${styleId}/${ban.rule}`, ban),
      patternId: `${styleId}/${ban.rule}`,
      scope: 'style',
      claim: 'style-fidelity',
      severity: ban.source.kind === 'constraint' ? 'major' : 'minor',
      applicability: 'always',
      evidenceTypes: ['dom'],
      criterion: wording[locale].style(text(rule.name, locale)),
      why: ban.why,
      remediation: text(rule.fix, locale),
    });
  }
  const exemptions = mustHaveExemptions(productType, conditions);
  for (const item of (productType ? productMustHaveDef(productType)?.items : undefined) ?? []) {
    const def = mustHaveDef(item.id);
    const placement = text(ZONE_TEXT[item.zone], locale);
    const exemption = exemptions.get(item.id);
    checks.push({
      id: mustHaveCheckId(item.id),
      patternId: mustHavePatternId(item.id),
      scope: 'must-have',
      claim: 'required-element',
      severity: 'major',
      // A declared condition makes the must-have optional: present is still checked, absent is not a defect.
      applicability: exemption ? 'when-present' : 'always',
      evidenceTypes: ['dom'],
      criterion: wording[locale].mustHave(text(def.name, locale), placement)
        + (exemption ? ` ${wording[locale].exempt(text(exemption.condition.when, locale), exemption.reason)}` : ''),
      why: text(item.why, locale),
      remediation: `${text(def.build, locale)} ${placement}`,
    });
  }
  return checks;
}
