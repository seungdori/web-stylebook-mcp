import { text, texts } from '../localization.js';
import type { CatalogRepository } from '../catalog/repository.js';
import { planUiStates } from '../state-atlas/planner.js';
import type {
  AuditApplicability,
  AuditAutomationLevel,
  AuditCheckDefinition,
  AuditEvidenceType,
  AuditSeverity,
  DesignPrinciple,
  Lang,
  UxPrinciple,
  UxSurface,
} from '../types.js';

export const AUDIT_GROUP_IDS = [
  'build', 'layout', 'fidelity', 'behavior', 'principles', 'docs', 'anti-patterns',
] as const;
export type AuditGroupId = (typeof AUDIT_GROUP_IDS)[number];

export const AUDIT_VERDICTS = [
  'PASS', 'FIX_NOW', 'RISK', 'NOT_APPLICABLE', 'NOT_VERIFIED',
] as const;
export type AuditVerdict = (typeof AUDIT_VERDICTS)[number];

export interface DesignAuditPlanInput {
  styleId?: string;
  surfaces?: UxSurface[];
  designPrincipleIds?: string[];
  uxPrincipleIds?: string[];
  stateSurfaceIds?: string[];
  domainSignals?: string[];
  includeGroups?: AuditGroupId[];
  includeDocumentation?: boolean;
  locale?: Lang;
}

export interface ResolvedAuditCheck {
  id: string;
  groupId: AuditGroupId;
  criterion: string;
  why?: string;
  remediation?: string;
  severity: AuditSeverity;
  evidenceTypes: AuditEvidenceType[];
  automation: AuditAutomationLevel;
  applicability: AuditApplicability;
  surfaceTags: UxSurface[];
  source: AuditCheckDefinition['source'];
}

interface PrincipleAuditContract {
  id: string;
  name: string;
  verify: string[];
  caution: string;
  resourceUri: string;
}

interface UxPrincipleAuditContract extends PrincipleAuditContract {
  evidenceConfidence: UxPrinciple['evidence']['confidence'];
}

interface CompactState {
  id: string;
  name: string;
  resourceUri: string;
}

export interface DesignAuditPlan {
  query: {
    styleId?: string;
    surfaces: UxSurface[];
    designPrincipleIds: string[];
    uxPrincipleIds: string[];
    stateSurfaceIds: string[];
    includeGroups: AuditGroupId[];
    includeDocumentation: boolean;
    locale: Lang;
  };
  verdicts: Array<{ id: AuditVerdict; meaning: string }>;
  evidenceRule: string;
  evidenceLegend: Record<AuditEvidenceType, string>;
  applicabilityLegend: Record<AuditApplicability, string>;
  verificationDefaults: { why: string; remediation: string };
  checks: ResolvedAuditCheck[];
  principles: {
    design: PrincipleAuditContract[];
    ux: UxPrincipleAuditContract[];
  };
  stateCoverage: Array<{
    surfaceId: string;
    required: CompactState[];
    recommended: CompactState[];
    domainSpecific: CompactState[];
    resourceUri: string;
  }>;
  stateAtlasUnmappedSurfaces: UxSurface[];
  coverage: {
    catalogChecks: number;
    includedChecks: number;
    excludedChecks: number;
  };
  resourceUris: string[];
  guidance: string[];
}

export class AuditPlanError extends Error {
  constructor(
    message: string,
    readonly kind: 'INVALID_INPUT' | 'STYLE_NOT_FOUND' | 'DESIGN_PRINCIPLE_NOT_FOUND'
      | 'UX_PRINCIPLE_NOT_FOUND' | 'STATE_SURFACE_NOT_FOUND' = 'INVALID_INPUT',
    readonly unknownId?: string,
  ) {
    super(message);
    this.name = 'AuditPlanError';
  }
}

const labels: Record<Lang, {
  verdicts: Record<AuditVerdict, string>;
  evidenceRule: string;
  evidence: Record<AuditEvidenceType, string>;
  applicability: Record<AuditApplicability, string>;
  verificationWhy: string;
  verificationFix: string;
  antiPatternCriterion: (pattern: string) => string;
  guidance: string[];
}> = {
  en: {
    verdicts: {
      PASS: 'Observed evidence satisfies the criterion.',
      FIX_NOW: 'A release-blocking or material defect was observed; fix it before completion.',
      RISK: 'The implementation may ship, but a specific residual concern remains.',
      NOT_APPLICABLE: 'The check does not apply; record the concrete reason.',
      NOT_VERIFIED: 'Required evidence was not collected. Never treat this as PASS.',
    },
    evidenceRule: 'Every PASS must cite observed evidence. Missing evidence is NOT_VERIFIED, never an inferred PASS.',
    evidence: {
      command: 'command and exit status', dom: 'DOM measurement or accessibility tree',
      'computed-style': 'computed-style or contrast measurement', screenshot: 'target-viewport screenshot',
      interaction: 'observed interaction result', document: 'source or design-document reference',
      manual: 'explicit visual or product judgment with rationale',
    },
    applicability: {
      always: 'Run for every matching surface.',
      'when-present': 'Run only when the referenced element or behavior exists; otherwise mark NOT_APPLICABLE with a reason.',
      'workflow-only': 'Run when auditing the full design workflow and its documentation.',
    },
    verificationWhy: 'This is a canonical Web Stylebook verification criterion.',
    verificationFix: 'Change the implementation until the criterion is demonstrably satisfied, then collect fresh evidence.',
    antiPatternCriterion: (pattern) => `Confirm this anti-pattern is absent: ${pattern}`,
    guidance: [
      'Inspect the actual rendered implementation, source, interactions, and commands; the plan itself does not inspect a project.',
      'Report one verdict per check with evidence, exact location, and the smallest concrete fix for every FIX_NOW.',
      'Do not collapse subjective design judgment into a single numeric score.',
    ],
  },
  ko: {
    verdicts: {
      PASS: '관찰한 증거가 기준을 충족합니다.',
      FIX_NOW: '배포를 막거나 결과를 크게 훼손하는 결함이 확인되어 완료 전에 수정해야 합니다.',
      RISK: '배포는 가능하지만 구체적인 잔여 우려가 남아 있습니다.',
      NOT_APPLICABLE: '이 검사는 적용되지 않으며 구체적인 이유를 기록해야 합니다.',
      NOT_VERIFIED: '필요한 증거를 수집하지 못했습니다. PASS로 간주하면 안 됩니다.',
    },
    evidenceRule: '모든 PASS에는 관찰한 증거가 있어야 합니다. 증거가 없으면 추정 PASS가 아니라 NOT_VERIFIED입니다.',
    evidence: {
      command: '명령과 종료 상태', dom: 'DOM 측정 또는 접근성 트리',
      'computed-style': '계산된 스타일 또는 대비 측정', screenshot: '목표 뷰포트 스크린샷',
      interaction: '직접 관찰한 상호작용 결과', document: '소스 또는 디자인 문서 위치',
      manual: '근거를 적은 명시적인 시각·제품 판단',
    },
    applicability: {
      always: '일치하는 모든 화면에서 검사합니다.',
      'when-present': '해당 요소나 동작이 있을 때만 검사하고, 없으면 이유와 함께 NOT_APPLICABLE로 기록합니다.',
      'workflow-only': '전체 디자인 작업 흐름과 문서를 감사할 때 검사합니다.',
    },
    verificationWhy: 'Web Stylebook 정본 검증 기준입니다.',
    verificationFix: '기준을 실제로 충족하도록 구현을 바꾼 뒤 새 증거를 수집하세요.',
    antiPatternCriterion: (pattern) => `다음 안티패턴이 없는지 확인: ${pattern}`,
    guidance: [
      '실제 렌더링, 소스, 상호작용, 실행 명령을 확인하세요. 이 계획 자체는 프로젝트를 열람하지 않습니다.',
      '검사마다 증거와 정확한 위치를 붙이고, 모든 FIX_NOW에는 가장 작은 구체적 수정안을 적으세요.',
      '주관적 디자인 판단을 하나의 숫자 점수로 뭉개지 마세요.',
    ],
  },
  ja: {
    verdicts: {
      PASS: '観察した証拠が基準を満たしています。',
      FIX_NOW: 'リリースを妨げる、または結果を大きく損なう欠陥があり、完了前に修正が必要です。',
      RISK: '出荷は可能ですが、具体的な残存懸念があります。',
      NOT_APPLICABLE: 'この検査は適用されません。具体的な理由を記録します。',
      NOT_VERIFIED: '必要な証拠を収集できていません。PASSとして扱ってはいけません。',
    },
    evidenceRule: 'すべてのPASSには観察した証拠が必要です。証拠がなければ推測のPASSではなくNOT_VERIFIEDです。',
    evidence: {
      command: 'コマンドと終了状態', dom: 'DOM測定またはアクセシビリティツリー',
      'computed-style': '計算済みスタイルまたはコントラスト測定', screenshot: '対象ビューポートのスクリーンショット',
      interaction: '観察した操作結果', document: 'ソースまたは設計文書の参照',
      manual: '根拠を伴う明示的な視覚・製品判断',
    },
    applicability: {
      always: '一致するすべての画面で実行します。',
      'when-present': '対象要素や動作がある場合のみ実行し、なければ理由付きでNOT_APPLICABLEにします。',
      'workflow-only': '設計ワークフロー全体と文書を監査するときに実行します。',
    },
    verificationWhy: 'Web Stylebook正本の検証基準です。',
    verificationFix: '基準を明確に満たすよう実装を変更し、新しい証拠を収集してください。',
    antiPatternCriterion: (pattern) => `次のアンチパターンがないことを確認: ${pattern}`,
    guidance: [
      '実際のレンダリング、ソース、操作、実行コマンドを確認してください。この計画自体はプロジェクトを閲覧しません。',
      '各検査に証拠と正確な場所を添え、すべてのFIX_NOWに最小の具体的修正を記録してください。',
      '主観的なデザイン判断を単一の数値スコアにまとめないでください。',
    ],
  },
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function groupOf(check: AuditCheckDefinition): AuditGroupId {
  return check.source.kind === 'anti-pattern'
    ? 'anti-patterns'
    : check.source.groupId as AuditGroupId;
}

function resolveCheck(
  check: AuditCheckDefinition,
  locale: Lang,
  repo: CatalogRepository,
): ResolvedAuditCheck {
  const label = labels[locale];
  if (check.source.kind === 'verification') {
    const source = check.source;
    const group = repo.policies.verification.find((item) => item.id === source.groupId);
    const criterion = group?.items[source.itemIndex];
    if (!criterion) throw new AuditPlanError(`audit check '${check.id}' has an invalid verification source`);
    return {
      ...check,
      groupId: groupOf(check),
      criterion: text(criterion, locale),
    };
  }
  const source = check.source;
  const antiPattern = repo.policies.antiPatterns
    .find((item) => item.id === source.antiPatternId);
  if (!antiPattern) throw new AuditPlanError(`audit check '${check.id}' has an invalid anti-pattern source`);
  return {
    ...check,
    groupId: 'anti-patterns',
    criterion: label.antiPatternCriterion(text(antiPattern.pattern, locale)),
    why: text(antiPattern.why, locale),
    remediation: text(antiPattern.fix, locale),
  };
}

function designPrincipleContract(principle: DesignPrinciple, locale: Lang): PrincipleAuditContract {
  return {
    id: principle.id,
    name: text(principle.name, locale),
    verify: texts(principle.verify, locale),
    caution: text(principle.caution, locale),
    resourceUri: `webstylebook://design-principles/${principle.id}`,
  };
}

function uxPrincipleContract(principle: UxPrinciple, locale: Lang): UxPrincipleAuditContract {
  return {
    id: principle.id,
    name: text(principle.name, locale),
    verify: texts(principle.verify, locale),
    caution: text(principle.caution, locale),
    evidenceConfidence: principle.evidence.confidence,
    resourceUri: `webstylebook://principles/${principle.id}`,
  };
}

export function planDesignAudit(
  input: DesignAuditPlanInput,
  repo: CatalogRepository,
): DesignAuditPlan {
  const locale = input.locale ?? 'en';
  const surfaces: UxSurface[] = unique(
    input.surfaces?.length ? input.surfaces : ['global' as UxSurface],
  );
  const includeGroups = unique(input.includeGroups?.length ? input.includeGroups : [...AUDIT_GROUP_IDS]);
  const includeDocumentation = input.includeDocumentation ?? true;
  const designPrincipleIds = unique(input.designPrincipleIds ?? []);
  const uxPrincipleIds = unique(input.uxPrincipleIds ?? []);

  if (input.styleId && !repo.getStyle(input.styleId)) {
    throw new AuditPlanError(`unknown style '${input.styleId}'`, 'STYLE_NOT_FOUND', input.styleId);
  }

  const designPrinciples = designPrincipleIds.map((id) => {
    const principle = repo.getDesignPrinciple(id);
    if (!principle) {
      throw new AuditPlanError(`unknown design principle '${id}'`, 'DESIGN_PRINCIPLE_NOT_FOUND', id);
    }
    return designPrincipleContract(principle, locale);
  });
  const uxPrinciples = uxPrincipleIds.map((id) => {
    const principle = repo.getPrinciple(id);
    if (!principle) {
      throw new AuditPlanError(`unknown UX principle '${id}'`, 'UX_PRINCIPLE_NOT_FOUND', id);
    }
    return uxPrincipleContract(principle, locale);
  });

  const requestedStateSurfaceIds = unique(input.stateSurfaceIds
    ?? surfaces.filter((surface) => repo.getSurface(surface)));
  const stateCoverage = requestedStateSurfaceIds.map((surfaceId) => {
    if (!repo.getSurface(surfaceId)) {
      throw new AuditPlanError(`unknown state surface '${surfaceId}'`, 'STATE_SURFACE_NOT_FOUND', surfaceId);
    }
    const plan = planUiStates({
      surfaceId,
      domainSignals: input.domainSignals,
      styleId: input.styleId,
      locale,
    }, repo);
    const compact = (state: { id: string; name: string; resourceUri: string }): CompactState => ({
      id: state.id, name: state.name, resourceUri: state.resourceUri,
    });
    return {
      surfaceId,
      required: plan.required.map(compact),
      recommended: plan.recommended.map(compact),
      domainSpecific: plan.domainSpecific.map(compact),
      resourceUri: `webstylebook://states/${surfaceId}`,
    };
  });

  const checks = repo.policies.auditChecks
    .filter((check) => includeGroups.includes(groupOf(check)))
    .filter((check) => includeDocumentation || check.applicability !== 'workflow-only')
    .filter((check) => check.surfaceTags.includes('global')
      || check.surfaceTags.some((surface) => surfaces.includes(surface)))
    .map((check) => resolveCheck(check, locale, repo));

  const stateAtlasUnmappedSurfaces: UxSurface[] = surfaces
    .filter((surface) => surface !== 'global' && !repo.getSurface(surface));
  const resourceUris = unique([
    ...(input.styleId ? [`webstylebook://styles/${input.styleId}`] : []),
    ...designPrinciples.map((principle) => principle.resourceUri),
    ...uxPrinciples.map((principle) => principle.resourceUri),
    ...stateCoverage.map((surface) => surface.resourceUri),
  ]);
  const label = labels[locale];

  return {
    query: {
      styleId: input.styleId,
      surfaces,
      designPrincipleIds,
      uxPrincipleIds,
      stateSurfaceIds: requestedStateSurfaceIds,
      includeGroups,
      includeDocumentation,
      locale,
    },
    verdicts: AUDIT_VERDICTS.map((id) => ({ id, meaning: label.verdicts[id] })),
    evidenceRule: label.evidenceRule,
    evidenceLegend: label.evidence,
    applicabilityLegend: label.applicability,
    verificationDefaults: {
      why: label.verificationWhy,
      remediation: label.verificationFix,
    },
    checks,
    principles: { design: designPrinciples, ux: uxPrinciples },
    stateCoverage,
    stateAtlasUnmappedSurfaces,
    coverage: {
      catalogChecks: repo.policies.auditChecks.length,
      includedChecks: checks.length,
      excludedChecks: repo.policies.auditChecks.length - checks.length,
    },
    resourceUris,
    guidance: label.guidance,
  };
}
