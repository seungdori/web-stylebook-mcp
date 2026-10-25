import type { CatalogRepository } from '../catalog/repository.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import { text } from '../localization.js';
import { SERVER_VERSION } from '../server-info.js';
import { PRODUCT_TYPES, type AuditSeverity, type Lang, type ProductType } from '../types.js';
import { structureCheckId, structureChecks, type StructureCheckDef } from './checks.js';
import { detectGlobalPatterns, sectionOf, type DetectionStatus, type Observation } from './detect.js';
import { selectorPath } from './dom/html.js';
import { buildPage, type PageModel } from './dom/page.js';
import { parseColor, type Rgba } from './dom/values.js';
import { structureGuide, structureRulesetHash, styleBanId } from './guidance.js';
import { GLOBAL_PATTERNS, styleRuleText } from './patterns.js';
import { detectStyleBan, type RuleContext } from './rules.js';
import { detectMustHaves, type MustHaveDetection, type MustHaveStatus } from './must-have-detect.js';
import {
  ZONE_CRITERIA, ZONE_TEXT, mustHaveCheckId, mustHaveDef, mustHavePatternId, productMustHaveDef,
  type MustHaveId, type MustHaveZone,
} from './must-haves.js';
import type { GlobalPatternDef, StructureJob, StyleBanDef } from './types.js';

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

export interface ReplacementMove { id: string; name: string; build: string; purpose: string }

export interface StructureFinding {
  patternId: string;
  checkId: string;
  scope: 'global' | 'style' | 'must-have';
  name: string;
  severity: AuditSeverity;
  count: number;
  locations: string[];
  criteria: string[];
  observed: Observation;
  why: string;
  replaceWith: {
    instruction: string;
    moves: ReplacementMove[];
    archetype?: { hero?: string; sectionOrder?: string[] };
  };
  relatedAuditCheckIds: string[];
}

export interface StructureCheckReport {
  patternId: string;
  checkId: string;
  scope: 'global' | 'style';
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
  actual: Record<string, string | number | boolean>;
  location?: { selector: string };
  producer: { name: string; version: string; configHash: string };
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
  status: MustHaveStatus;
  /** Matches anywhere on the page; a misplaced must-have has matches but none in its zone. */
  count: number;
  locations: string[];
  note?: string;
}

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
  summary: { clean: boolean; findings: number; major: number; minor: number; notVerified: number; checked: number };
  findings: StructureFinding[];
  checks: StructureCheckReport[];
  outline: Array<{ index: number; selector: string; patterns: string[] }>;
  /** Present when productType was passed. */
  mustHaves: MustHaveAuditReport | null;
  evidence: StructureEvidence[];
  results: StructureResult[];
  limits: string[];
  guidance: string[];
}

const labels: Record<Lang, {
  status: Record<StructureCheckStatus, string>;
  foundAt: (name: string, where: string, count: number) => string;
  absent: (name: string) => string;
  noStyle: string;
  limits: { heuristics: string; notAPass: string; truncated: (n: number) => string; unparsed: (n: number) => string; exhausted: string };
  guidance: string[];
  supersededBy: (id: string) => string;
  mustHave: {
    status: Record<MustHaveStatus, string>;
    missing: (build: string, placement: string) => string;
    misplaced: (build: string) => string;
    misplacedAt: (name: string, where: string) => string;
    reasons: Record<NonNullable<MustHaveDetection['reason']>, string>;
    limit: string;
    guidance: string;
    plan: string;
  };
}> = {
  en: {
    status: { found: 'found', absent: 'absent', 'not-applicable': 'not applicable', 'not-verified': 'not verified', 'allowed-by-style': 'allowed by the style' },
    foundAt: (name, where, count) => `${name} found at ${where}${count > 1 ? ` and ${count - 1} more location(s)` : ''}.`,
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
    supersededBy: (id) => `reported under ${id}`,
    mustHave: {
      status: { present: 'present', misplaced: 'not on the first screen', missing: 'missing', 'not-verified': 'not verified' },
      missing: (build, placement) => `${build} Where: ${placement}`,
      misplaced: (build) => `Move it onto the first screen; the audit found it only further down the page. ${build}`,
      misplacedAt: (name, where) => `${name} was found at ${where}, but not on the first screen.`,
      reasons: {
        'no-opening': 'the page has no section, so the first screen could not be placed',
        exhausted: 'the stylesheets exceeded the selector budget, so visibility could not be resolved',
        truncated: 'parsing stopped before the end of the page, so it may be further down',
      },
      limit: 'Must-haves are recognized from markup, roles, and visible text in English, Korean, and Japanese. The first screen is estimated from document order and section size, not measured in a browser.',
      guidance: 'Add every missing must-have and move every misplaced one onto the first screen in the style\'s own treatment, then rerun audit_page_structure with the same productType.',
      plan: 'Pass the same productType to get_design_audit_plan as well, so the plan holds the must-have checks these results answer.',
    },
  },
  ko: {
    status: { found: '발견', absent: '없음', 'not-applicable': '해당 없음', 'not-verified': '확인 못 함', 'allowed-by-style': '스타일이 허용' },
    foundAt: (name, where, count) => `${where}에서 '${name}'을(를) 찾았습니다${count > 1 ? `. 다른 위치 ${count - 1}곳에도 있습니다` : ''}.`,
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
    supersededBy: (id) => `${id} 항목으로 보고함`,
    mustHave: {
      status: { present: '있음', misplaced: '첫 화면 밖', missing: '없음', 'not-verified': '확인 못 함' },
      missing: (build, placement) => `${build} 위치: ${placement}`,
      misplaced: (build) => `첫 화면으로 옮기세요. 검사에서는 페이지 더 아래에서만 찾았습니다. ${build}`,
      misplacedAt: (name, where) => `${where}에서 '${name}'을(를) 찾았지만 첫 화면에는 없습니다.`,
      reasons: {
        'no-opening': '페이지에 섹션이 없어 첫 화면의 범위를 정하지 못했습니다',
        exhausted: '스타일시트가 선택자 한도를 넘어 보이는지 판단하지 못했습니다',
        truncated: '페이지 끝까지 분석하지 못해 더 아래에 있을 수 있습니다',
      },
      limit: '필수 요소는 마크업, role, 영어·한국어·일본어로 된 보이는 텍스트로 판단합니다. 첫 화면은 브라우저로 잰 것이 아니라 문서 순서와 섹션 크기로 추정합니다.',
      guidance: '빠진 필수 요소는 모두 추가하고, 첫 화면 밖에 있는 요소는 스타일에 맞는 모양으로 첫 화면에 옮기세요. 그다음 같은 productType으로 audit_page_structure를 다시 실행하세요.',
      plan: 'get_design_audit_plan에도 같은 productType을 넘기세요. 그래야 계획에 이 결과가 답하는 필수 요소 검사가 들어갑니다.',
    },
  },
  ja: {
    status: { found: '検出', absent: 'なし', 'not-applicable': '該当なし', 'not-verified': '未確認', 'allowed-by-style': 'スタイルが許可' },
    foundAt: (name, where, count) => `${where}で「${name}」を検出しました${count > 1 ? `。ほかに${count - 1}か所あります` : ''}。`,
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
    supersededBy: (id) => `${id}として報告`,
    mustHave: {
      status: { present: 'あり', misplaced: 'ファーストビューの外', missing: 'なし', 'not-verified': '未確認' },
      missing: (build, placement) => `${build} 位置: ${placement}`,
      misplaced: (build) => `ファーストビューに移してください。検査ではページのもっと下でしか見つかりませんでした。${build}`,
      misplacedAt: (name, where) => `${where}で「${name}」を検出しましたが、ファーストビューにはありません。`,
      reasons: {
        'no-opening': 'ページにセクションがないため、ファーストビューの範囲を決められませんでした',
        exhausted: 'スタイルシートがセレクターの上限を超え、表示されるか判断できませんでした',
        truncated: 'ページの最後まで解析できなかったため、もっと下にある可能性があります',
      },
      limit: '必須要素は、マークアップ、role、英語・韓国語・日本語の表示テキストで判断します。ファーストビューはブラウザで測ったものではなく、文書の順序とセクションの大きさから推定します。',
      guidance: '欠けている必須要素はすべて追加し、ファーストビューの外にある要素はスタイルに合った見た目でファーストビューに移してください。その後、同じproductTypeでaudit_page_structureを再実行してください。',
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
    .map(({ id, name, build, purpose }) => ({ id, name, build, purpose }));
}

/** The archetype step that takes the pattern's place; the section order stands in when no move does the same job. */
function archetypeFor(pattern: GlobalPatternDef, styleId: string | undefined, moves: readonly ReplacementMove[]): StructureFinding['replaceWith']['archetype'] {
  if (!styleId) return undefined;
  const guide = structureGuide(styleId);
  if (pattern.job === 'opening') return { hero: guide.hero };
  if (pattern.job === 'page' || !moves.length) return { sectionOrder: [...guide.sectionOrder] };
  return undefined;
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
  const checkDefs = new Map(structureChecks(styleId, locale, productType).map((check) => [check.id, check]));
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
      reports.push({ patternId: pattern.id, checkId, scope: 'global', status: 'allowed-by-style', count: status.status === 'found' ? status.matches.length : 0, note: allowReason });
      continue;
    }
    const { report, count, note } = describe(status);
    const superseding = pattern.supersededBy?.find((id) => global.get(id)?.status === 'found' && !allowed[id]);
    reports.push({ patternId: pattern.id, checkId, scope: 'global', status: report, count, ...(note ? { note } : superseding && report === 'found' ? { note: label.supersededBy(superseding) } : {}) });
    statuses.set(checkId, { status, check: checkDefs.get(checkId), name: text(pattern.name, locale) });
    if (status.status !== 'found' || report !== 'found' || superseding) continue;
    const locations = status.matches.slice(0, LOCATIONS).map((match) => selectorPath(match.element));
    const moves = movesFor(pattern.job, styleId);
    const archetype = archetypeFor(pattern, styleId, moves);
    findings.push({
      patternId: pattern.id,
      checkId,
      scope: 'global',
      name: text(pattern.name, locale),
      severity: pattern.severity,
      count: status.matches.length,
      locations,
      criteria: pattern.criteria.map((criterion) => criterion.id),
      observed: status.matches[0]!.observed,
      why: text(pattern.description, locale),
      replaceWith: {
        instruction: text(pattern.replace, locale) + (styleId ? '' : ` ${label.noStyle}`),
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
    reports.push({ patternId, checkId, scope: 'style', status: report, count, ...(note ? { note } : {}) });
    const check = checkDefs.get(checkId);
    statuses.set(checkId, { status, check, name });
    if (status.status !== 'found' || report !== 'found') continue;
    findings.push(styleFinding(patternId, checkId, ban, status, name, text(wording.fix, locale), check?.severity ?? 'minor'));
  }

  const mustHaveEntry = productType ? productMustHaveDef(productType) : null;
  const detections = detectMustHaves(page, mustHaveEntry?.items ?? [], global);
  const mustHaveItems: MustHaveAuditItem[] = [];
  for (const item of mustHaveEntry?.items ?? []) {
    const detection = detections.get(item.id)!;
    const def = mustHaveDef(item.id);
    const name = text(def.name, locale);
    const shown = detection.status === 'present' ? detection.inZone : detection.matches;
    mustHaveItems.push({
      id: item.id,
      checkId: mustHaveCheckId(item.id),
      name,
      zone: item.zone,
      status: detection.status,
      count: detection.matches.length,
      locations: shown.slice(0, LOCATIONS).map(selectorPath),
      ...(detection.reason ? { note: label.mustHave.reasons[detection.reason] } : {}),
    });
    if (detection.status !== 'missing' && detection.status !== 'misplaced') continue;
    const moves = movesFor(def.job, styleId);
    const build = text(def.build, locale);
    findings.push({
      patternId: mustHavePatternId(item.id),
      checkId: mustHaveCheckId(item.id),
      scope: 'must-have',
      name,
      severity: 'major',
      count: detection.matches.length,
      locations: detection.matches.slice(0, LOCATIONS).map(selectorPath),
      criteria: [...def.criteria.map((criterion) => criterion.id), ZONE_CRITERIA[item.zone].id],
      observed: { status: detection.status, zone: item.zone, found: detection.matches.length, inZone: detection.inZone.length },
      why: text(item.why, locale),
      replaceWith: {
        instruction: (detection.status === 'missing' ? label.mustHave.missing(build, text(ZONE_TEXT[item.zone], locale)) : label.mustHave.misplaced(build))
          + (styleId ? '' : ` ${label.noStyle}`),
        moves,
        ...(styleId && item.zone === 'first-screen' ? { archetype: { hero: structureGuide(styleId).hero } } : {}),
      },
      relatedAuditCheckIds: [],
    });
  }

  const evidence: StructureEvidence[] = [];
  const results: StructureResult[] = [];
  const producer = { name: 'web-stylebook-mcp audit_page_structure', version: SERVER_VERSION, configHash: rulesetHash };
  for (const report of reports) {
    const entry = statuses.get(report.checkId);
    const first = report.status === 'found' && entry?.status.status === 'found' ? entry.status.matches[0] : undefined;
    const evidenceId = evidenceIdFor(targetId, report.patternId);
    const outcome: StructureEvidence['outcome'] = report.status === 'found' ? 'failed' : report.status === 'absent' ? 'passed'
      : report.status === 'not-verified' ? 'cant-tell' : 'inapplicable';
    const name = entry?.name ?? report.patternId;
    evidence.push({
      id: evidenceId,
      targetId,
      type: 'dom',
      phase: 'static',
      summary: `${name}: ${label.status[report.status]}${report.count ? ` (${report.count})` : ''}${report.note ? ` — ${report.note}` : ''}`.slice(0, 1990),
      outcome,
      contentHash: inputHash,
      actual: { status: report.status, count: report.count, ...(first ? { selector: selectorPath(first.element) } : {}) },
      ...(first ? { location: { selector: selectorPath(first.element) } } : {}),
      producer,
    });
    if (!entry?.check) continue;
    const verdict = verdictFor(report.status, entry.check);
    const where = first ? selectorPath(first.element) : '';
    results.push({
      checkId: report.checkId,
      targetId,
      verdict,
      evidenceRefs: [evidenceId],
      rationale: report.status === 'found' ? label.foundAt(name, where, report.count)
        : report.status === 'absent' ? label.absent(name) : `${name}: ${report.note ?? label.status[report.status]}`,
      ...(verdict === 'FIX_NOW' || verdict === 'RISK' ? { remediation: entry.check.remediation } : {}),
    });
  }

  for (const item of mustHaveItems) {
    const detection = detections.get(item.id)!;
    const evidenceId = evidenceIdFor(targetId, mustHavePatternId(item.id));
    const first = item.locations[0];
    const outcome: StructureEvidence['outcome'] = item.status === 'present' ? 'passed' : item.status === 'not-verified' ? 'cant-tell' : 'failed';
    evidence.push({
      id: evidenceId,
      targetId,
      type: 'dom',
      phase: 'static',
      summary: `${item.name}: ${label.mustHave.status[item.status]}${item.count ? ` (${item.count})` : ''}${item.note ? ` — ${item.note}` : ''}`.slice(0, 1990),
      outcome,
      contentHash: inputHash,
      actual: { status: item.status, zone: item.zone, count: item.count, inZone: detection.inZone.length, ...(first ? { selector: first } : {}) },
      ...(first ? { location: { selector: first } } : {}),
      producer,
    });
    const check = checkDefs.get(item.checkId);
    if (!check) continue;
    const verdict: StructureResult['verdict'] = item.status === 'present' ? 'PASS' : item.status === 'not-verified' ? 'NOT_VERIFIED' : 'FIX_NOW';
    results.push({
      checkId: item.checkId,
      targetId,
      verdict,
      evidenceRefs: [evidenceId],
      rationale: item.status === 'present' ? label.foundAt(item.name, first ?? '', detection.inZone.length)
        : item.status === 'missing' ? label.absent(item.name)
          : item.status === 'misplaced' ? label.mustHave.misplacedAt(item.name, first ?? '')
            : `${item.name}: ${item.note ?? label.mustHave.status[item.status]}`,
      ...(verdict === 'FIX_NOW' ? { remediation: check.remediation } : {}),
    });
  }

  const limits = [label.limits.heuristics, label.limits.notAPass];
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
    },
    findings,
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
    limits,
    guidance: [
      ...(mustHaveItems.some((item) => item.status === 'missing' || item.status === 'misplaced') ? [label.mustHave.guidance] : []),
      ...label.guidance,
      ...(mustHaveItems.length ? [label.mustHave.plan] : []),
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
