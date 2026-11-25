import type { CatalogRepository } from '../catalog/repository.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import { text } from '../localization.js';
import { SERVER_VERSION } from '../server-info.js';
import { PRODUCT_TYPES, type AuditSeverity, type Lang, type ProductType } from '../types.js';
import { structureCheckId, structureChecks, type StructureCheckDef, type StructureClaim } from './checks.js';
import { detectGlobalPatterns, sectionOf, type DetectionStatus, type Observation } from './detect.js';
import { selectorPath } from './dom/html.js';
import { buildPage, type PageModel } from './dom/page.js';
import { parseColor, type Rgba } from './dom/values.js';
import { structureGuide, structureRulesetHash, styleBanId } from './guidance.js';
import { GLOBAL_PATTERNS, styleRuleText } from './patterns.js';
import { detectStyleBan, type RuleContext } from './rules.js';
import { detectMustHaves, type MustHaveDetection, type MustHaveStatus } from './must-have-detect.js';
import {
  ZONE_CRITERIA, ZONE_TEXT, mustHaveCheckId, mustHaveDef, mustHaveExemptions, mustHavePatternId, productMustHaveDef,
  type MustHaveCondition, type MustHaveConditionId, type MustHaveId, type MustHaveZone,
} from './must-haves.js';
import type { GlobalPatternDef, StructureJob, StyleBanDef } from './types.js';
import { assetReports, assetText, type AssetCheckReport } from './assets.js';

export const STRUCTURE_AUDIT_SCHEMA = 'webstylebook.structure-audit.v1';
export const PAGE_LIMITS = {
  htmlChars: 1_500_000,
  cssChars: 1_500_000,
  cssFiles: 20,
  cssTotalChars: 3_000_000,
  maxElements: 40_000,
  viewportMin: 320,
  viewportMax: 3840,
} as const;
const LOCATIONS = 5;
/** The whole tool result (text and structuredContent) stays under this; scripts/benchmark-visual.mjs checks it. */
export const STRUCTURE_AUDIT_BUDGET_BYTES = 48 * 1024;
const VIEWPORT_HEIGHT = 900;
// validate_design_audit_result accepts ids up to 160 characters.
const EVIDENCE_ID_MAX = 160;
const STATUS_COLOR_KEYS = ['positive', 'caution', 'critical', 'info'] as const;

export interface AuditPageStructureInput {
  html: string;
  css?: string[];
  styleId?: string;
  /** Adds the product type's must-have checks: which required elements the page lacks or keeps off the first screen. */
  productType?: ProductType;
  /** Named situations that set some of the product type's must-haves aside, each with the observed reason. */
  mustHaveConditions?: MustHaveCondition[];
  targetId?: string;
  viewportWidth?: number;
  locale?: Lang;
}

export class StructureAuditError extends Error {
  constructor(message: string, readonly kind: 'INVALID_INPUT' | 'STYLE_NOT_FOUND' = 'INVALID_INPUT', readonly unknownId?: string) {
    super(message);
    this.name = 'StructureAuditError';
  }
}

export type StructureCheckStatus = 'found' | 'absent' | 'not-applicable' | 'not-verified' | 'allowed-by-style';

/** A move a finding points to; its purpose and build steps are in StructureAuditResult.replacements.moves, once per move. */
export interface ReplacementMove { id: string; name: string }

export interface StructureFinding {
  patternId: string;
  checkId: string;
  scope: 'global' | 'style' | 'must-have';
  /** What the finding can claim; a shape observation is not a task defect until a task judgment confirms it. */
  claim: StructureClaim;
  name: string;
  /** Severity once the claim is confirmed. */
  severity: AuditSeverity;
  count: number;
  locations: string[];
  criteria: string[];
  observed: Observation;
  why: string;
  replaceWith: {
    instruction: string;
    moves: ReplacementMove[];
    /** The part of the archetype that takes the pattern's place, given once in StructureAuditResult.replacements. */
    archetype?: 'hero' | 'sectionOrder';
  };
  relatedAuditCheckIds: string[];
}

export interface StructureCheckReport {
  patternId: string;
  checkId: string;
  scope: 'global' | 'style';
  claim: StructureClaim;
  status: StructureCheckStatus;
  count: number;
  note?: string;
}

export interface StructureEvidence {
  id: string;
  targetId: string;
  type: 'dom';
  phase: 'static';
  summary: string;
  outcome: 'passed' | 'failed' | 'cant-tell' | 'inapplicable';
  contentHash: string;
  actual?: Record<string, string | number | boolean>;
  location?: { selector: string };
  /** The ruleset is identity.rulesetHash; it is not repeated on each item. */
  producer: { name: string; version: string; configHash?: string };
}

export interface StructureResult {
  checkId: string;
  targetId: string;
  verdict: 'PASS' | 'FIX_NOW' | 'RISK' | 'NOT_APPLICABLE' | 'NOT_VERIFIED';
  evidenceRefs: string[];
  rationale: string;
  remediation?: string;
}

export interface MustHaveAuditItem {
  id: MustHaveId;
  checkId: string;
  name: string;
  zone: MustHaveZone;
  /** not-applicable: absent, and a declared condition sets it aside. */
  status: MustHaveAuditStatus;
  /** The declared condition that sets this must-have aside. */
  condition?: { id: MustHaveConditionId; reason: string };
  /** Matches anywhere on the page; a misplaced must-have has matches but none in its zone. */
  count: number;
  locations: string[];
  note?: string;
}

export type MustHaveAuditStatus = MustHaveStatus | 'not-applicable';

export interface MustHaveAuditReport {
  productType: ProductType;
  /** The page the product type's list is written for; null when the product type has no list. */
  page: string | null;
  missing: MustHaveId[];
  misplaced: MustHaveId[];
  items: MustHaveAuditItem[];
}

export interface StructureAuditResult {
  identity: {
    schema: typeof STRUCTURE_AUDIT_SCHEMA;
    catalogVersion: string;
    catalogContentHash: string;
    rulesetHash: string;
    inputHash: string;
  };
  styleId: string | null;
  target: { id: string; viewportWidth: number };
  summary: {
    clean: boolean;
    findings: number;
    major: number;
    minor: number;
    notVerified: number;
    checked: number;
    /** Findings per claim; shape observations still need a task judgment. */
    claims: Record<StructureClaim, number>;
  };
  findings: StructureFinding[];
  /**
   * The text the findings point to, once each: the build steps of every move they name, and the hero composition or
   * section order when one of them names it. Findings repeat moves, so the steps are not copied into each.
   */
  replacements: { moves: Record<string, { name: string; purpose: string; build: string }>; hero?: string; sectionOrder?: string[] };
  checks: StructureCheckReport[];
  outline: Array<{ index: number; selector: string; patterns: string[] }>;
  /** Present when productType was passed. */
  mustHaves: MustHaveAuditReport | null;
  evidence: StructureEvidence[];
  results: StructureResult[];
  /**
   * The "assets" group: fonts and images. Its evidence and results are kept apart so that a plan with only the
   * structure group still validates the arrays above; submit these too when the plan includes "assets".
   */
  assets: { checks: AssetCheckReport[]; evidence: StructureEvidence[]; results: StructureResult[] };
  limits: string[];
  guidance: string[];
}

const labels: Record<Lang, {
  status: Record<StructureCheckStatus, string>;
  /** The location is the evidence's; the rationale names the pattern and the count. */
  foundAt: (name: string, count: number) => string;
  absent: (name: string) => string;
  noStyle: string;
  limits: { heuristics: string; notAPass: string; truncated: (n: number) => string; unparsed: (n: number) => string; exhausted: string };
  guidance: string[];
  shape: { unjudged: string; guidance: string };
  supersededBy: (id: string) => string;
  mustHave: {
    status: Record<MustHaveAuditStatus, string>;
    exempt: (when: string, reason: string) => string;
    missing: (build: string, placement: string) => string;
    misplaced: (build: string) => string;
    beforeAction: (action: string, build: string) => string;
    misplacedAt: (name: string, where: string) => string;
    reasons: Record<NonNullable<MustHaveDetection['reason']>, string>;
    limit: string;
    guidance: string;
    plan: string;
  };
}> = {
  en: {
    status: { found: 'found', absent: 'absent', 'not-applicable': 'not applicable', 'not-verified': 'not verified', 'allowed-by-style': 'allowed by the style' },
    foundAt: (name, count) => `${name} found${count > 1 ? ` at ${count} locations` : ''}.`,
    absent: (name) => `${name} was not found in the submitted HTML and CSS.`,
    noStyle: 'Pass styleId to get the chosen style’s replacement moves and its style-specific bans.',
    limits: {
      heuristics: 'These are declared-style heuristics, not a browser: rendered layout, content that JavaScript adds after the submitted HTML, and stylesheets that were not submitted are not seen.',
      notAPass: 'A clean result means none of these patterns was detected; it is not a design pass.',
      truncated: (n) => `Parsing stopped at ${n} elements, so later markup was not checked.`,
      unparsed: (n) => `${n} selector(s) use syntax this audit does not evaluate; their declarations were ignored.`,
      exhausted: 'The stylesheets need more selector matching than this audit allows, so some rules were not applied; every check is reported as not verified.',
    },
    guidance: [
      'Replace each finding with the listed signature move or archetype step, rebuild, and run audit_page_structure again on the new HTML and CSS.',
      'To record the outcome, call get_design_audit_plan with includeGroups containing "structure" and the same styleId, then submit these evidence and results entries to validate_design_audit_result under the same targetId.',
    ],
    shape: {
      unjudged: 'This is a shape observation: whether it gets in the way of the page\'s task was not checked.',
      guidance: 'Without a styleId, global findings are shape observations, not defects. Judge each against the page\'s task (who uses it, for what, and what the shape hides or delays), keep shapes that serve the task, and submit that judgment as manual evidence with PASS, RISK, or FIX_NOW. Pass styleId to check fidelity to a chosen direction instead.',
    },
    supersededBy: (id) => `reported under ${id}`,
    mustHave: {
      status: { present: 'present', misplaced: 'not on the first screen', missing: 'missing', 'not-verified': 'not verified', 'not-applicable': 'not applicable' },
      exempt: (when, reason) => `Set aside by a declared condition: ${when} Reason: ${reason}`,
      missing: (build, placement) => `${build} Where: ${placement}`,
      beforeAction: (action, build) => `Move it onto the first screen; the audit found it only further down the page, while ${action} is on the first screen, so people can act before they see it. ${build}`,
      misplaced: (build) => `Consider moving it onto the first screen; the audit found it only further down the page. The first screen is estimated from document order, not measured: if a browser at this viewport shows it before the first scroll, cite that capture instead. ${build}`,
      misplacedAt: (name, where) => `${name} was found at ${where}, but not on the first screen.`,
      reasons: {
        'no-opening': 'the page has no section, so the first screen could not be placed',
        exhausted: 'the stylesheets exceeded the selector budget, so visibility could not be resolved',
        truncated: 'parsing stopped before the end of the page, so it may be further down',
      },
      limit: 'Must-haves are recognized from markup, roles, and visible text in English, Korean, and Japanese. The first screen is estimated from document order and section size, not measured in a browser.',
      guidance: 'Add every missing must-have in the style\'s own treatment, consider moving each one found off the first screen onto it, then rerun audit_page_structure with the same productType and mustHaveConditions.',
      plan: 'Pass the same productType to get_design_audit_plan as well, so the plan holds the must-have checks these results answer.',
    },
  },
  ko: {
    status: { found: '발견', absent: '없음', 'not-applicable': '해당 없음', 'not-verified': '확인 못 함', 'allowed-by-style': '스타일이 허용' },
    foundAt: (name, count) => `'${name}'을(를) 찾았습니다${count > 1 ? `(${count}곳)` : ''}.`,
    absent: (name) => `제출한 HTML과 CSS에서 '${name}'을(를) 찾지 못했습니다.`,
    noStyle: 'styleId를 넘기면 고른 스타일의 대체 무브와 스타일 전용 금지 항목을 받을 수 있습니다.',
    limits: {
      heuristics: '이 검사는 브라우저가 아니라 선언된 스타일로 판단합니다. 렌더링된 레이아웃, 제출한 HTML 이후 JavaScript가 추가한 내용, 제출하지 않은 스타일시트는 보지 못합니다.',
      notAPass: '결과가 깨끗하다는 것은 이 패턴들을 찾지 못했다는 뜻일 뿐, 디자인 통과가 아닙니다.',
      truncated: (n) => `요소 ${n}개에서 분석을 멈췄습니다. 그 뒤의 마크업은 검사하지 않았습니다.`,
      unparsed: (n) => `선택자 ${n}개는 이 검사가 평가하지 않는 문법을 써서 선언을 무시했습니다.`,
      exhausted: '스타일시트의 선택자 매칭이 이 검사의 한도를 넘어 일부 규칙을 적용하지 못했습니다. 모든 검사를 확인 못 함으로 보고합니다.',
    },
    guidance: [
      '발견 항목마다 제시한 시그니처 무브나 아키타입 단계로 바꾸고, 다시 빌드한 뒤 새 HTML과 CSS로 audit_page_structure를 다시 실행하세요.',
      '결과를 기록하려면 includeGroups에 "structure"를 넣고 같은 styleId로 get_design_audit_plan을 호출하세요. 그다음 이 evidence와 results를 같은 targetId로 validate_design_audit_result에 제출하세요.',
    ],
    shape: {
      unjudged: '형태를 관찰한 결과입니다. 이 형태가 페이지의 과업을 방해하는지는 확인하지 않았습니다.',
      guidance: 'styleId가 없으면 전역 발견 항목은 결함이 아니라 형태 관찰입니다. 항목마다 페이지의 과업(누가, 무엇을 하려고 쓰는지, 이 형태가 무엇을 가리거나 늦추는지)에 비추어 판단하세요. 과업에 맞는 형태는 유지하세요. 판단은 manual 증거로 PASS, RISK, FIX_NOW와 함께 제출하세요. 고른 방향에 대한 충실도를 보려면 styleId를 넘기세요.',
    },
    supersededBy: (id) => `${id} 항목으로 보고함`,
    mustHave: {
      status: { present: '있음', misplaced: '첫 화면 밖', missing: '없음', 'not-verified': '확인 못 함', 'not-applicable': '해당 없음' },
      exempt: (when, reason) => `밝힌 조건으로 제외: ${when} 이유: ${reason}`,
      missing: (build, placement) => `${build} 위치: ${placement}`,
      beforeAction: (action, build) => `첫 화면으로 옮기세요. 검사에서는 페이지 더 아래에서만 찾았는데 '${action}'은(는) 첫 화면에 있어서, 이 정보를 보기 전에 행동할 수 있습니다. ${build}`,
      misplaced: (build) => `첫 화면으로 옮기는 것을 검토하세요. 검사에서는 페이지 더 아래에서만 찾았습니다. 첫 화면은 잰 값이 아니라 문서 순서로 추정한 범위입니다. 이 뷰포트의 브라우저에서 첫 스크롤 전에 보인다면 그 캡처를 증거로 내세요. ${build}`,
      misplacedAt: (name, where) => `${where}에서 '${name}'을(를) 찾았지만 첫 화면에는 없습니다.`,
      reasons: {
        'no-opening': '페이지에 섹션이 없어 첫 화면의 범위를 정하지 못했습니다',
        exhausted: '스타일시트가 선택자 한도를 넘어 보이는지 판단하지 못했습니다',
        truncated: '페이지 끝까지 분석하지 못해 더 아래에 있을 수 있습니다',
      },
      limit: '필수 요소는 마크업, role, 영어·한국어·일본어로 된 보이는 텍스트로 판단합니다. 첫 화면은 브라우저로 잰 것이 아니라 문서 순서와 섹션 크기로 추정합니다.',
      guidance: '빠진 필수 요소는 스타일에 맞는 모양으로 모두 추가하세요. 첫 화면 밖에 있는 요소는 첫 화면으로 옮길지 검토하세요. 그다음 같은 productType과 mustHaveConditions로 audit_page_structure를 다시 실행하세요.',
      plan: 'get_design_audit_plan에도 같은 productType을 넘기세요. 그래야 계획에 이 결과가 답하는 필수 요소 검사가 들어갑니다.',
    },
  },
  ja: {
    status: { found: '検出', absent: 'なし', 'not-applicable': '該当なし', 'not-verified': '未確認', 'allowed-by-style': 'スタイルが許可' },
    foundAt: (name, count) => `「${name}」を検出しました${count > 1 ? `（${count}か所）` : ''}。`,
    absent: (name) => `提出されたHTMLとCSSに「${name}」は見つかりませんでした。`,
    noStyle: 'styleIdを渡すと、選んだスタイルの置き換えムーブとスタイル固有の禁止項目が返ります。',
    limits: {
      heuristics: 'この検査はブラウザではなく宣言されたスタイルで判断します。描画後のレイアウト、提出したHTMLの後でJavaScriptが追加した内容、提出していないスタイルシートは見えません。',
      notAPass: '結果がクリーンでも、これらのパターンが検出されなかっただけで、デザインの合格ではありません。',
      truncated: (n) => `要素${n}個で解析を止めたため、それ以降のマークアップは検査していません。`,
      unparsed: (n) => `${n}個のセレクターはこの検査が評価しない構文のため、宣言を無視しました。`,
      exhausted: 'スタイルシートのセレクター照合がこの検査の上限を超え、一部のルールを適用できませんでした。すべての検査を未確認として報告します。',
    },
    guidance: [
      '検出項目ごとに示したシグネチャームーブかアーキタイプの手順で置き換え、再ビルドして、新しいHTMLとCSSでaudit_page_structureを再実行してください。',
      '結果を記録するには、includeGroupsに"structure"を含め同じstyleIdでget_design_audit_planを呼び、これらのevidenceとresultsを同じtargetIdでvalidate_design_audit_resultに提出してください。',
    ],
    shape: {
      unjudged: '形を観察した結果です。この形がページのタスクを妨げるかは確認していません。',
      guidance: 'styleIdがない場合、グローバルの検出項目は欠陥ではなく形の観察です。項目ごとに、ページのタスク(誰が何のために使うか、この形が何を隠したり遅らせたりするか)に照らして判断してください。タスクに合う形は残してください。判断はmanual証拠としてPASS、RISK、FIX_NOWと一緒に提出してください。選んだ方向への忠実度を確かめるにはstyleIdを渡してください。',
    },
    supersededBy: (id) => `${id}として報告`,
    mustHave: {
      status: { present: 'あり', misplaced: 'ファーストビューの外', missing: 'なし', 'not-verified': '未確認', 'not-applicable': '該当なし' },
      exempt: (when, reason) => `示された条件で除外: ${when} 理由: ${reason}`,
      missing: (build, placement) => `${build} 位置: ${placement}`,
      beforeAction: (action, build) => `ファーストビューに移してください。検査ではページのもっと下でしか見つかりませんでしたが、「${action}」はファーストビューにあるため、この情報を見る前に行動できてしまいます。${build}`,
      misplaced: (build) => `ファーストビューへの移動を検討してください。検査ではページのもっと下でしか見つかりませんでした。ファーストビューは測定値ではなく文書の順序から推定した範囲です。このビューポートのブラウザで最初のスクロール前に見えるなら、そのキャプチャを証拠にしてください。${build}`,
      misplacedAt: (name, where) => `${where}で「${name}」を検出しましたが、ファーストビューにはありません。`,
      reasons: {
        'no-opening': 'ページにセクションがないため、ファーストビューの範囲を決められませんでした',
        exhausted: 'スタイルシートがセレクターの上限を超え、表示されるか判断できませんでした',
        truncated: 'ページの最後まで解析できなかったため、もっと下にある可能性があります',
      },
      limit: '必須要素は、マークアップ、role、英語・韓国語・日本語の表示テキストで判断します。ファーストビューはブラウザで測ったものではなく、文書の順序とセクションの大きさから推定します。',
      guidance: '欠けている必須要素はスタイルに合った見た目ですべて追加してください。ファーストビューの外にある要素は、ファーストビューへ移すかを検討してください。その後、同じproductTypeとmustHaveConditionsでaudit_page_structureを再実行してください。',
      plan: 'get_design_audit_planにも同じproductTypeを渡してください。そうすると、計画にこの結果が答える必須要素の検査が入ります。',
    },
  },
};

function validate(input: AuditPageStructureInput, repo: CatalogRepository): void {
  if (input.styleId && !repo.getStyle(input.styleId)) {
    throw new StructureAuditError(`unknown style '${input.styleId}'`, 'STYLE_NOT_FOUND', input.styleId);
  }
  if (input.productType !== undefined && !(PRODUCT_TYPES as readonly string[]).includes(input.productType)) {
    throw new StructureAuditError(`productType must be one of: ${PRODUCT_TYPES.join(', ')}`);
  }
  try {
    mustHaveExemptions(input.productType, input.mustHaveConditions);
  } catch (error) {
    throw new StructureAuditError((error as Error).message);
  }
  if (!input.html.trim()) throw new StructureAuditError('html must contain the built page markup');
  if (input.html.length > PAGE_LIMITS.htmlChars) throw new StructureAuditError(`html exceeds ${PAGE_LIMITS.htmlChars} characters`);
  const css = input.css ?? [];
  if (css.length > PAGE_LIMITS.cssFiles) throw new StructureAuditError(`css accepts at most ${PAGE_LIMITS.cssFiles} stylesheets`);
  const total = css.reduce((sum, sheet) => sum + sheet.length, 0);
  if (total > PAGE_LIMITS.cssTotalChars) throw new StructureAuditError(`css exceeds ${PAGE_LIMITS.cssTotalChars} characters in total`);
  const width = input.viewportWidth;
  if (width !== undefined && (!Number.isInteger(width) || width < PAGE_LIMITS.viewportMin || width > PAGE_LIMITS.viewportMax)) {
    throw new StructureAuditError(`viewportWidth must be an integer from ${PAGE_LIMITS.viewportMin} to ${PAGE_LIMITS.viewportMax}`);
  }
}

function movesFor(job: StructureJob | 'page', styleId: string | undefined): ReplacementMove[] {
  if (!styleId || job === 'page') return [];
  return structureGuide(styleId).moves
    .filter((move) => move.jobs.includes(job))
    .map(({ id, name }) => ({ id, name }));
}

/** The archetype step that takes the pattern's place; the section order stands in when no move does the same job. */
function archetypeFor(pattern: GlobalPatternDef, styleId: string | undefined, moves: readonly ReplacementMove[]): StructureFinding['replaceWith']['archetype'] {
  if (!styleId) return undefined;
  if (pattern.job === 'opening') return 'hero';
  if (pattern.job === 'page' || !moves.length) return 'sectionOrder';
  return undefined;
}

/** The build steps and archetype text the findings point to, each once. */
function replacementsFor(findings: readonly StructureFinding[], styleId: string | undefined): StructureAuditResult['replacements'] {
  if (!styleId) return { moves: {} };
  const guide = structureGuide(styleId);
  const named = new Set(findings.flatMap((finding) => finding.replaceWith.moves.map((move) => move.id)));
  const archetypes = new Set(findings.map((finding) => finding.replaceWith.archetype));
  return {
    moves: Object.fromEntries(guide.moves.filter((move) => named.has(move.id)).map((move) => [move.id, { name: move.name, purpose: move.purpose, build: move.build }])),
    ...(archetypes.has('hero') ? { hero: guide.hero } : {}),
    ...(archetypes.has('sectionOrder') ? { sectionOrder: [...guide.sectionOrder] } : {}),
  };
}

function evidenceIdFor(targetId: string, patternId: string): string {
  const id = `structure:${targetId}:${patternId}`;
  return id.length <= EVIDENCE_ID_MAX ? id : `structure:${stableHashOf(targetId).slice(7, 23)}:${patternId}`;
}

function ruleContext(repo: CatalogRepository, styleId: string | undefined): RuleContext {
  const modes = styleId ? Object.values(repo.getStyle(styleId)?.visualContract?.modes ?? {}) : [];
  const statusColors = modes.flatMap((mode) => STATUS_COLOR_KEYS.map((key) => (mode?.colors[key] ? parseColor(mode.colors[key]) : null)))
    .filter((color): color is Rgba => !!color);
  return { statusColors };
}

function verdictFor(status: StructureCheckStatus, check: StructureCheckDef): StructureResult['verdict'] {
  // A shape alone cannot settle whether it hurts the task, so a found shape waits for the host's task judgment.
  if (check.claim === 'shape-observation') return status === 'absent' || status === 'not-applicable' ? 'NOT_APPLICABLE' : 'NOT_VERIFIED';
  if (status === 'found') return check.severity === 'minor' ? 'RISK' : 'FIX_NOW';
  if (status === 'absent') return 'PASS';
  if (status === 'not-applicable') return check.applicability === 'always' ? 'NOT_VERIFIED' : 'NOT_APPLICABLE';
  return 'NOT_VERIFIED';
}

export function auditPageStructure(input: AuditPageStructureInput, repo: CatalogRepository): StructureAuditResult {
  validate(input, repo);
  const locale = input.locale ?? 'en';
  const label = labels[locale];
  const viewportWidth = input.viewportWidth ?? 1440;
  const targetId = input.targetId?.trim() || 'page';
  const css = input.css ?? [];
  const page: PageModel = buildPage(input.html, css, { viewportWidth, viewportHeight: VIEWPORT_HEIGHT }, PAGE_LIMITS.maxElements);
  const inputHash = stableHashOf({ html: input.html, css, viewportWidth });
  const rulesetHash = structureRulesetHash();
  const styleId = input.styleId;
  const guide = styleId ? structureGuide(styleId) : null;
  const allowed = guide?.allow ?? {};
  const productType = input.productType;
  const checkDefs = new Map(structureChecks(styleId, locale, productType, input.mustHaveConditions).map((check) => [check.id, check]));
  const exemptions = mustHaveExemptions(productType, input.mustHaveConditions);
  const incomplete = page.styles.exhausted;

  const global = detectGlobalPatterns(page);
  const reports: StructureCheckReport[] = [];
  const findings: StructureFinding[] = [];
  const statuses = new Map<string, { status: DetectionStatus; check?: StructureCheckDef; name: string }>();

  const describe = (status: DetectionStatus): { report: StructureCheckStatus; count: number; note?: string } => {
    // Rules the matcher never applied could hide a pattern, reveal a hidden one, or hide the opening itself, so no
    // outcome is evidence.
    if (incomplete) return { report: 'not-verified', count: 0, note: label.limits.exhausted };
    if (status.status === 'found') return { report: 'found', count: status.matches.length };
    if (status.status === 'absent') return { report: 'absent', count: 0 };
    return { report: status.status, count: 0, note: status.reason };
  };

  for (const pattern of GLOBAL_PATTERNS) {
    const status = global.get(pattern.id)!;
    const checkId = structureCheckId(pattern.id);
    const allowReason = allowed[pattern.id];
    if (allowReason) {
      reports.push({ patternId: pattern.id, checkId, scope: 'global', claim: 'style-fidelity', status: 'allowed-by-style', count: status.status === 'found' ? status.matches.length : 0, note: allowReason });
      continue;
    }
    const { report, count, note } = describe(status);
    const superseding = pattern.supersededBy?.find((id) => global.get(id)?.status === 'found' && !allowed[id]);
    const check = checkDefs.get(checkId)!;
    reports.push({ patternId: pattern.id, checkId, scope: 'global', claim: check.claim, status: report, count, ...(note ? { note } : superseding && report === 'found' ? { note: label.supersededBy(superseding) } : {}) });
    statuses.set(checkId, { status, check, name: text(pattern.name, locale) });
    if (status.status !== 'found' || report !== 'found' || superseding) continue;
    const locations = status.matches.slice(0, LOCATIONS).map((match) => selectorPath(match.element));
    const moves = movesFor(pattern.job, styleId);
    const archetype = archetypeFor(pattern, styleId, moves);
    findings.push({
      patternId: pattern.id,
      checkId,
      scope: 'global',
      claim: check.claim,
      name: text(pattern.name, locale),
      severity: pattern.severity,
      count: status.matches.length,
      locations,
      criteria: pattern.criteria.map((criterion) => criterion.id),
      observed: status.matches[0]!.observed,
      why: text(pattern.description, locale),
      replaceWith: {
        instruction: check.remediation + (styleId ? '' : ` ${label.noStyle}`),
        moves,
        ...(archetype ? { archetype } : {}),
      },
      relatedAuditCheckIds: [...pattern.auditCheckIds],
    });
  }

  const context = ruleContext(repo, styleId);
  for (const ban of guide?.bans ?? []) {
    const patternId = styleBanId(styleId!, ban);
    const checkId = structureCheckId(patternId, ban);
    const status = detectStyleBan(page, ban, context);
    const { report, count, note } = describe(status);
    const wording = styleRuleText(ban.rule, ban.params as never);
    const name = text(wording.name, locale);
    reports.push({ patternId, checkId, scope: 'style', claim: 'style-fidelity', status: report, count, ...(note ? { note } : {}) });
    const check = checkDefs.get(checkId);
    statuses.set(checkId, { status, check, name });
    if (status.status !== 'found' || report !== 'found') continue;
    findings.push(styleFinding(patternId, checkId, ban, status, name, text(wording.fix, locale), check?.severity ?? 'minor'));
  }

  const mustHaveEntry = productType ? productMustHaveDef(productType) : null;
  const detections = detectMustHaves(page, mustHaveEntry?.items ?? [], global);
  const mustHaveItems: MustHaveAuditItem[] = [];
  // Information shown below an action that is on the first screen can be skipped before acting: a defect, not advice.
  const actsFirst = (item: { beforeAction?: MustHaveId }) => !!item.beforeAction && detections.get(item.beforeAction)?.status === 'present';
  const actionName = (item: { beforeAction?: MustHaveId }) => text(mustHaveDef(item.beforeAction!).name, locale);
  for (const item of mustHaveEntry?.items ?? []) {
    const detection = detections.get(item.id)!;
    const def = mustHaveDef(item.id);
    const name = text(def.name, locale);
    const shown = detection.status === 'present' ? detection.inZone : detection.matches;
    const exemption = exemptions.get(item.id);
    // A declared condition sets the must-have aside only where the page lacks it in its zone; one that is there passes.
    const setAside = exemption && (detection.status === 'missing' || detection.status === 'misplaced');
    mustHaveItems.push({
      id: item.id,
      checkId: mustHaveCheckId(item.id),
      name,
      zone: item.zone,
      status: setAside ? 'not-applicable' : detection.status,
      ...(exemption ? { condition: { id: exemption.condition.id, reason: exemption.reason } } : {}),
      count: detection.matches.length,
      locations: shown.slice(0, LOCATIONS).map(selectorPath),
      ...(setAside ? { note: label.mustHave.exempt(text(exemption.condition.when, locale), exemption.reason) }
        : detection.reason ? { note: label.mustHave.reasons[detection.reason] } : {}),
    });
    if (setAside || (detection.status !== 'missing' && detection.status !== 'misplaced')) continue;
    const moves = movesFor(def.job, styleId);
    const build = text(def.build, locale);
    findings.push({
      patternId: mustHavePatternId(item.id),
      checkId: mustHaveCheckId(item.id),
      scope: 'must-have',
      claim: 'required-element',
      name,
      // Missing information or a missing function is a defect; a first screen estimated from markup is a placement risk.
      severity: detection.status === 'missing' || actsFirst(item) ? 'major' : 'minor',
      count: detection.matches.length,
      locations: detection.matches.slice(0, LOCATIONS).map(selectorPath),
      criteria: [...def.criteria.map((criterion) => criterion.id), ZONE_CRITERIA[item.zone].id],
      observed: { status: detection.status, zone: item.zone, found: detection.matches.length, inZone: detection.inZone.length },
      why: text(item.why, locale),
      replaceWith: {
        instruction: (detection.status === 'missing' ? label.mustHave.missing(build, text(ZONE_TEXT[item.zone], locale))
          : actsFirst(item) ? label.mustHave.beforeAction(actionName(item), build) : label.mustHave.misplaced(build))
          + (styleId ? '' : ` ${label.noStyle}`),
        moves,
        ...(styleId && item.zone === 'first-screen' ? { archetype: 'hero' as const } : {}),
      },
      relatedAuditCheckIds: [],
    });
  }

  const evidence: StructureEvidence[] = [];
  const results: StructureResult[] = [];
  const producer = { name: 'web-stylebook-mcp audit_page_structure', version: SERVER_VERSION };
  for (const report of reports) {
    const entry = statuses.get(report.checkId);
    const first = report.status === 'found' && entry?.status.status === 'found' ? entry.status.matches[0] : undefined;
    const evidenceId = evidenceIdFor(targetId, report.patternId);
    const shape = report.claim === 'shape-observation';
    // For a shape observation the DOM shows only where the shape is: no shape means the check does not apply, and a
    // found shape cannot tell whether the task suffers.
    const outcome: StructureEvidence['outcome'] = report.status === 'found' ? (shape ? 'cant-tell' : 'failed')
      : report.status === 'absent' ? (shape ? 'inapplicable' : 'passed')
        : report.status === 'not-verified' ? 'cant-tell' : 'inapplicable';
    const name = entry?.name ?? report.patternId;
    evidence.push({
      id: evidenceId,
      targetId,
      type: 'dom',
      phase: 'static',
      // The status, count and note are in checks and the result rationale; the evidence keeps the observation.
      summary: `${report.patternId}: ${label.status[report.status]}${report.count ? ` (${report.count})` : ''}`,
      outcome,
      contentHash: inputHash,
      ...(first ? { location: { selector: selectorPath(first.element) } } : {}),
      producer,
    });
    if (!entry?.check) continue;
    const verdict = verdictFor(report.status, entry.check);
    results.push({
      checkId: report.checkId,
      targetId,
      verdict,
      evidenceRefs: [evidenceId],
      rationale: report.status === 'found' ? label.foundAt(name, report.count) + (shape ? ` ${label.shape.unjudged}` : '')
        : report.status === 'absent' ? label.absent(name) : `${name}: ${report.note ?? label.status[report.status]}`,
      ...(verdict === 'FIX_NOW' || verdict === 'RISK' || (shape && report.status === 'found') ? { remediation: entry.check.remediation } : {}),
    });
  }

  for (const item of mustHaveItems) {
    const detection = detections.get(item.id)!;
    const entry = mustHaveEntry!.items.find((candidate) => candidate.id === item.id)!;
    const evidenceId = evidenceIdFor(targetId, mustHavePatternId(item.id));
    const first = item.locations[0];
    const outcome: StructureEvidence['outcome'] = item.status === 'present' ? 'passed' : item.status === 'not-verified' ? 'cant-tell'
      : item.status === 'not-applicable' ? 'inapplicable' : 'failed';
    evidence.push({
      id: evidenceId,
      targetId,
      type: 'dom',
      phase: 'static',
      summary: `${mustHavePatternId(item.id)}: ${label.mustHave.status[item.status]}${item.count ? ` (${item.count})` : ''}`,
      outcome,
      contentHash: inputHash,
      ...(first ? { location: { selector: first } } : {}),
      producer,
    });
    const check = checkDefs.get(item.checkId);
    if (!check) continue;
    const verdict: StructureResult['verdict'] = item.status === 'present' ? 'PASS' : item.status === 'not-verified' ? 'NOT_VERIFIED'
      : item.status === 'not-applicable' ? 'NOT_APPLICABLE' : item.status === 'misplaced' && !actsFirst(entry) ? 'RISK' : 'FIX_NOW';
    results.push({
      checkId: item.checkId,
      targetId,
      verdict,
      evidenceRefs: [evidenceId],
      rationale: item.status === 'present' ? label.foundAt(item.name, detection.inZone.length)
        : item.status === 'missing' ? label.absent(item.name)
          : item.status === 'misplaced' ? label.mustHave.misplacedAt(item.name, first ?? '')
            : `${item.name}: ${item.note ?? label.mustHave.status[item.status]}`,
      ...(verdict === 'FIX_NOW' ? { remediation: check.remediation }
        : verdict === 'RISK' ? { remediation: label.mustHave.misplaced(text(mustHaveDef(item.id).build, locale)) } : {}),
    });
  }

  const assetSay = assetText(locale);
  const assetChecks = assetReports(page, css, styleId, locale, repo);
  const assets: StructureAuditResult['assets'] = { checks: assetChecks, evidence: [], results: [] };
  // One scan observed every check, so one evidence item per outcome records it; the items are listed in assets.checks.
  const outcomeOf = (verdict: AssetCheckReport['verdict']): StructureEvidence['outcome'] => (verdict === 'PASS' ? 'passed'
    : verdict === 'NOT_APPLICABLE' ? 'inapplicable' : verdict === 'NOT_VERIFIED' ? 'cant-tell' : 'failed');
  for (const outcome of ['failed', 'cant-tell', 'passed', 'inapplicable'] as const) {
    const group = assetChecks.filter((check) => outcomeOf(check.verdict) === outcome);
    if (!group.length) continue;
    assets.evidence.push({
      id: evidenceIdFor(targetId, `assets-${outcome}`).replace(/^structure:/, 'assets:'), targetId, type: 'dom', phase: 'static',
      summary: group.map((check) => `${check.checkId}: ${check.verdict}${check.count ? ` (${check.count})` : ''}`).join('; '),
      outcome, contentHash: inputHash, producer,
    });
  }
  for (const check of assetChecks) {
    const summary = check.verdict === 'NOT_APPLICABLE' ? assetSay.none
      : check.count ? assetSay.found(check.count) : assetSay.clean;
    assets.results.push({
      checkId: check.checkId, targetId, verdict: check.verdict,
      evidenceRefs: [evidenceIdFor(targetId, `assets-${outcomeOf(check.verdict)}`).replace(/^structure:/, 'assets:')],
      rationale: `${summary}${check.note ? ` ${check.note}` : ''}`,
      ...(check.verdict === 'FIX_NOW' || check.verdict === 'RISK' ? { remediation: assetSay[check.checkId].fix } : {}),
    });
  }

  const limits = [label.limits.heuristics, label.limits.notAPass, assetSay.limit];
  if (mustHaveEntry) limits.push(label.mustHave.limit);
  if (page.html.truncated) limits.push(label.limits.truncated(PAGE_LIMITS.maxElements));
  if (page.styles.unparsedSelectors) limits.push(label.limits.unparsed(page.styles.unparsedSelectors));
  if (incomplete) limits.push(label.limits.exhausted);

  const patternsBySection = new Map<unknown, string[]>();
  for (const [id, status] of global) {
    if (id === 'generic-saas-skeleton' || status.status !== 'found') continue;
    for (const section of new Set(status.matches.map((match) => sectionOf(page, match.element)))) {
      patternsBySection.set(section, [...(patternsBySection.get(section) ?? []), id]);
    }
  }
  const outline = page.sections.map((section, index) => ({
    index,
    selector: selectorPath(section),
    patterns: patternsBySection.get(section) ?? [],
  }));

  const major = findings.filter((finding) => finding.severity === 'major').length;
  const claims: Record<StructureClaim, number> = { 'shape-observation': 0, 'style-fidelity': 0, 'required-element': 0 };
  for (const finding of findings) claims[finding.claim] += 1;
  const notVerified = reports.filter((report) => report.status === 'not-verified').length
    + mustHaveItems.filter((item) => item.status === 'not-verified').length;
  return {
    identity: {
      schema: STRUCTURE_AUDIT_SCHEMA,
      catalogVersion: repo.catalogVersion,
      catalogContentHash: repo.contentHash,
      rulesetHash,
      inputHash,
    },
    styleId: styleId ?? null,
    target: { id: targetId, viewportWidth },
    summary: {
      // An unverified check could hide a pattern, so only a fully checked page without findings is clean.
      clean: findings.length === 0 && notVerified === 0,
      findings: findings.length,
      major,
      minor: findings.length - major,
      notVerified,
      checked: reports.length + mustHaveItems.length,
      claims,
    },
    findings,
    replacements: replacementsFor(findings, styleId),
    checks: reports,
    outline,
    mustHaves: productType ? {
      productType,
      page: mustHaveEntry ? text(mustHaveEntry.page, locale) : null,
      missing: mustHaveItems.filter((item) => item.status === 'missing').map((item) => item.id),
      misplaced: mustHaveItems.filter((item) => item.status === 'misplaced').map((item) => item.id),
      items: mustHaveItems,
    } : null,
    evidence,
    results,
    assets,
    limits,
    guidance: [
      ...(claims['shape-observation'] ? [label.shape.guidance] : []),
      ...(mustHaveItems.some((item) => item.status === 'missing' || item.status === 'misplaced') ? [label.mustHave.guidance] : []),
      ...label.guidance,
      ...(mustHaveItems.length ? [label.mustHave.plan] : []),
      assetSay.record,
    ],
  };
}

function styleFinding(
  patternId: string, checkId: string, ban: StyleBanDef, status: Extract<DetectionStatus, { status: 'found' }>,
  name: string, fix: string, severity: AuditSeverity,
): StructureFinding {
  return {
    patternId,
    checkId,
    scope: 'style',
    claim: 'style-fidelity',
    name,
    severity,
    count: status.matches.length,
    locations: status.matches.slice(0, LOCATIONS).map((match) => selectorPath(match.element)),
    criteria: styleRuleText(ban.rule, ban.params as never).criteria.map((criterion) => criterion.id),
    observed: status.matches[0]!.observed,
    why: ban.why,
    replaceWith: { instruction: fix, moves: [] },
    relatedAuditCheckIds: ['style-direction-is-visible'],
  };
}
