import type { CatalogRepository } from '../catalog/repository.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import { SERVER_VERSION } from '../server-info.js';
import type { AuditApplicability, AuditSeverity, Lang, ProductType } from '../types.js';
import { isRendered } from '../structure/dom/cascade.js';
import { elementChildren, ownText, selectorPath, textContent, type DomElement } from '../structure/dom/html.js';
import { buildPage } from '../structure/dom/page.js';
import type { StructureEvidence, StructureResult } from '../structure/audit.js';
import { PAGE_LIMITS } from '../structure/audit.js';
import { COPY_PATTERNS, locateCopyPatterns, type CopyUnit, type LocatedCopyHit } from './lexicon.js';
import { VOICE_PROFILES, type VoiceProfile } from './voice.js';

/**
 * audit_copy (2026-11-25 design-quality plan, 6.4): page text checked against the copy lexicon (PR #50) and the
 * product voice. Its evidence and results answer the "copy" group of get_design_audit_plan. A template line is an
 * observation, never a defect by itself (#20); an unsourced user count or percentage outcome is FIX_NOW.
 */
export const COPY_AUDIT_SCHEMA = 'webstylebook.copy-audit.v1';
/** The whole tool result (text and structuredContent) stays under this; scripts/benchmark-visual.mjs checks it. */
export const COPY_AUDIT_BUDGET_BYTES = 16 * 1024;
export const COPY_LIMITS = { textChars: 200_000, textItems: 2_000 } as const;
const LOCATIONS = 3;
const EXCERPT = 100;
const VOICE_MIN = 3;
const EVIDENCE_ID_MAX = 160;

export interface AuditCopyInput {
  html?: string;
  css?: string[];
  /** Plain copy instead of a page: one string split into lines, or one entry per text unit. */
  text?: string | string[];
  locale?: Lang;
  productType?: ProductType;
  targetId?: string;
}

export class CopyAuditError extends Error {}

export type CopyCheckClaim = 'observation' | 'unsourced-claim';
export interface CopyCheckDef {
  id: string;
  patternId: string;
  claim: CopyCheckClaim;
  severity: AuditSeverity;
  applicability: AuditApplicability;
  evidenceTypes: Array<'dom' | 'manual'>;
  criterion: string;
  why: string;
  remediation: string;
}

const wording: Record<Lang, {
  pattern: (example: string, id: string) => string;
  register: (register: string) => string;
  length: (max: number) => string;
  registerWhy: string; lengthWhy: string;
  registerFix: (register: string) => string; lengthFix: (max: number) => string;
  found: (count: number, where: string) => string; none: (count: number) => string; unjudged: string;
  guidance: { shapes: string; record: string; text: string };
  limits: string[];
}> = {
  en: {
    pattern: (example, id) => `Page text avoids the ${id} pattern, such as "${example}", or uses it on purpose.`,
    register: (register) => `Korean statements use the product voice's ${register}.`,
    length: (max) => `Prose sentences stay within the product voice's ${max} words.`,
    registerWhy: 'The voice for this product type sets one register; a page in the other reads as a different product.',
    lengthWhy: 'The voice for this product type sets a sentence length; longer sentences slow the reader down.',
    registerFix: (register) => `Rewrite the statements in ${register}.`,
    lengthFix: (max) => `Split each sentence over ${max} words into two, one point each.`,
    found: (count, where) => `Found ${count} time(s), first at ${where}.`,
    none: (count) => `Not found in ${count} text unit(s).`,
    unjudged: 'A shape alone is not a defect: judge it against the page task and audience, then submit that judgment as manual evidence.',
    guidance: {
      shapes: 'Observations are template shapes seen on generated pages. Keep one that says something specific to this product; rewrite the rest with the instead line.',
      record: 'To record the outcome, call get_design_audit_plan with includeGroups containing "copy", the same locale and productType, then submit these evidence and results under the same targetId.',
      text: 'Plain text has no page to validate, so this result has no evidence or results; pass the rendered HTML to get them.',
    },
    limits: [
      'Pattern matching on visible text, not a reading: it finds known template lines and unsourced numbers, and a clean result does not mean the copy is good.',
      'Text that JavaScript adds after the submitted HTML is not seen.',
    ],
  },
  ko: {
    pattern: (example, id) => `페이지 문구에 "${example}" 같은 ${id} 틀이 없거나, 의도해서 썼습니다.`,
    register: (register) => `한국어 서술문이 제품 보이스의 ${register}를 씁니다.`,
    length: (max) => `설명 문장이 제품 보이스의 ${max}어절을 넘지 않습니다.`,
    registerWhy: '이 제품 유형의 보이스는 존댓말 체계 하나를 정합니다. 다른 체계로 쓴 페이지는 다른 제품처럼 읽힙니다.',
    lengthWhy: '이 제품 유형의 보이스는 문장 길이를 정합니다. 더 긴 문장은 읽기를 늦춥니다.',
    registerFix: (register) => `서술문을 ${register}로 다시 쓰세요.`,
    lengthFix: (max) => `${max}어절을 넘는 문장을 요점 하나씩 두 문장으로 나누세요.`,
    found: (count, where) => `${count}회 나왔습니다. 처음 위치: ${where}.`,
    none: (count) => `텍스트 단위 ${count}개에서 찾지 못했습니다.`,
    unjudged: '형태만으로는 결함이 아닙니다. 페이지의 작업과 독자에 비춰 판단하고, 그 판단을 manual evidence로 제출하세요.',
    guidance: {
      shapes: '관찰 항목은 생성된 페이지에서 반복된 틀입니다. 이 제품에만 맞는 내용을 말하면 두고, 나머지는 instead 문장대로 고치세요.',
      record: '결과를 기록하려면 includeGroups에 "copy"를 넣고 같은 locale과 productType으로 get_design_audit_plan을 호출하세요. 그다음 이 evidence와 results를 같은 targetId로 제출하세요.',
      text: '일반 텍스트는 검증할 페이지가 없어서 evidence와 results를 주지 않습니다. 렌더링한 HTML을 넘기면 받을 수 있습니다.',
    },
    limits: [
      '보이는 텍스트에 대한 패턴 검사이지 독해가 아닙니다. 알려진 틀과 출처 없는 숫자를 찾을 뿐이며, 깨끗한 결과가 좋은 문구라는 뜻은 아닙니다.',
      '제출한 HTML 뒤에 JavaScript가 넣는 텍스트는 보지 못합니다.',
    ],
  },
  ja: {
    pattern: (example, id) => `ページの文言に「${example}」のような ${id} の型がないか、意図して使っています。`,
    register: (register) => `韓国語の叙述文が製品の声の ${register} を使っています。`,
    length: (max) => `説明の文が製品の声の ${max} 語を超えません。`,
    registerWhy: 'この製品タイプの声は文体をひとつに決めます。別の文体のページは別の製品のように読めます。',
    lengthWhy: 'この製品タイプの声は文の長さを決めます。長い文は読む速さを落とします。',
    registerFix: (register) => `叙述文を ${register} で書き直してください。`,
    lengthFix: (max) => `${max} 語を超える文を、要点ひとつずつの 2 文に分けてください。`,
    found: (count, where) => `${count} 回見つかりました。最初の位置: ${where}。`,
    none: (count) => `${count} 個のテキスト単位で見つかりませんでした。`,
    unjudged: '型だけでは欠陥ではありません。ページの作業と読者に照らして判断し、その判断を manual evidence として提出してください。',
    guidance: {
      shapes: '観察項目は生成されたページで繰り返された型です。この製品に固有のことを言っていれば残し、それ以外は instead の文に沿って直してください。',
      record: '結果を記録するには、includeGroups に "copy" を含め、同じ locale と productType で get_design_audit_plan を呼び、これらの evidence と results を同じ targetId で提出してください。',
      text: 'プレーンテキストには検証するページがないため、evidence と results は返しません。レンダリングした HTML を渡すと受け取れます。',
    },
    limits: [
      '表示テキストに対するパターン検査であり、読解ではありません。既知の型と出典のない数字を見つけるだけで、問題がないという結果は良い文言を意味しません。',
      '提出した HTML の後に JavaScript が加えるテキストは見ていません。',
    ],
  },
};

const voiceFor = (productType: ProductType | undefined): VoiceProfile | undefined =>
  productType ? VOICE_PROFILES.find((voice) => voice.productType === productType) : undefined;

/** Audit-plan checks for the copy group: every pattern of the language, then the product voice checks. */
export function copyChecks(locale: Lang, productType?: ProductType): CopyCheckDef[] {
  const say = wording[locale];
  const checks: CopyCheckDef[] = COPY_PATTERNS.filter((entry) => entry.locales.includes(locale)).map((entry) => {
    const claim: CopyCheckClaim = entry.verdict === 'fix-now' ? 'unsourced-claim' : 'observation';
    return {
      id: `copy-${entry.id}`,
      patternId: entry.id,
      claim,
      severity: claim === 'unsourced-claim' ? 'major' : 'minor',
      applicability: claim === 'unsourced-claim' ? 'always' : 'when-present',
      evidenceTypes: claim === 'unsourced-claim' ? ['dom'] : ['manual'],
      criterion: say.pattern(entry.example.flagged, entry.id),
      why: entry.why,
      remediation: entry.instead,
    };
  });
  const voice = voiceFor(productType);
  if (voice && locale === 'ko') {
    checks.push({ id: 'copy-voice-register', patternId: 'voice-register', claim: 'observation', severity: 'minor', applicability: 'when-present', evidenceTypes: ['manual'], criterion: say.register(voice.koRegister), why: say.registerWhy, remediation: say.registerFix(voice.koRegister) });
  }
  if (voice && locale !== 'ja') {
    checks.push({ id: 'copy-voice-sentence-length', patternId: 'voice-sentence-length', claim: 'observation', severity: 'minor', applicability: 'when-present', evidenceTypes: ['manual'], criterion: say.length(voice.maxWords), why: say.lengthWhy, remediation: say.lengthFix(voice.maxWords) });
  }
  return checks;
}

const UNIT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'button', 'a', 'label', 'td', 'th', 'dt', 'dd', 'figcaption', 'caption', 'summary', 'blockquote', 'legend', 'option']);
const SKIP_TAGS = new Set(['head', 'script', 'style', 'noscript', 'template', 'svg', 'math']);

/**
 * The visible text of a page as units: each text block once, inline tags joined the way a browser joins them. A unit's
 * `where` is its index until a match is reported; a selector path walks the siblings, so only reported ones get one.
 */
function pageUnits(html: string, css: readonly string[]): { units: CopyUnit[]; elements: DomElement[] } {
  const page = buildPage(html, css, { viewportWidth: 1440, viewportHeight: 900 }, PAGE_LIMITS.maxElements);
  const units: CopyUnit[] = [];
  const elements: DomElement[] = [];
  const add = (text: string, element: DomElement) => { units.push({ text, where: String(elements.length) }); elements.push(element); };
  const holdsUnit = (element: DomElement): boolean => elementChildren(element).some((child) => UNIT_TAGS.has(child.tag) || holdsUnit(child));
  const visit = (element: DomElement) => {
    if (SKIP_TAGS.has(element.tag) || (element.tag !== '#document' && !isRendered(page.styles, element))) return;
    if (UNIT_TAGS.has(element.tag) || (ownText(element) && !holdsUnit(element))) {
      const value = textContent(element);
      if (value) add(value, element);
      return;
    }
    const own = ownText(element);
    if (own) add(own, element);
    for (const child of elementChildren(element)) visit(child);
  };
  visit(page.html.root);
  return { units, elements };
}

function textUnits(text: string | string[]): CopyUnit[] {
  const lines = Array.isArray(text) ? text : text.split(/\r?\n/);
  return lines.map((line, index) => ({ text: line, where: `${Array.isArray(text) ? 'item' : 'line'} ${index + 1}` }));
}

const SENTENCE = /(?<=[.!?。！？])\s*/u;
const PROSE_END = /[.!?。！？]$/u;
const KO_HAPNIDA = /니다[.!]?$/u;
const KO_HAEYO = /(?:(?<![세필중주나까]|아니)요|죠)[.!]?$/u;
const QUOTED = /^[“"「]/u;

/** The product voice checks the lexicon cannot express: the register it sets (Korean) and its sentence length. */
function voiceHits(units: readonly CopyUnit[], voice: VoiceProfile | undefined, locale: Lang): LocatedCopyHit[] {
  if (!voice) return [];
  const sentences = units.filter((unit) => !QUOTED.test(unit.text))
    .flatMap((unit) => unit.text.split(SENTENCE).filter(Boolean).map((text) => ({ where: unit.where, text, match: text })));
  const hits: LocatedCopyHit[] = [];
  if (locale === 'ko') {
    const hapnida = sentences.filter((sentence) => KO_HAPNIDA.test(sentence.text));
    const haeyo = sentences.filter((sentence) => KO_HAEYO.test(sentence.text));
    const [dominant, register] = hapnida.length >= haeyo.length ? [hapnida, '합니다체'] : [haeyo, '해요체'];
    if (register !== voice.koRegister && dominant.length >= VOICE_MIN) {
      hits.push({ patternId: 'voice-register', verdict: 'observation', kind: 'mix', count: dominant.length, matches: dominant });
    }
  }
  if (locale !== 'ja') {
    const long = sentences.filter((sentence) => PROSE_END.test(sentence.text) && sentence.text.split(/\s+/).length > voice.maxWords);
    if (long.length >= VOICE_MIN) hits.push({ patternId: 'voice-sentence-length', verdict: 'observation', kind: 'count', count: long.length, matches: long });
  }
  return hits;
}

/** The match with up to EXCERPT characters of the unit around it. */
function excerpt(text: string, match: string): string {
  if (text.length <= EXCERPT) return text;
  const at = Math.max(0, text.indexOf(match));
  const start = Math.max(0, Math.min(at - 20, text.length - EXCERPT));
  return `${start > 0 ? '…' : ''}${text.slice(start, start + EXCERPT)}${start + EXCERPT < text.length ? '…' : ''}`;
}

function validate(input: AuditCopyInput): void {
  if ((input.html === undefined) === (input.text === undefined)) throw new CopyAuditError('pass exactly one of html or text');
  if (input.html !== undefined) {
    if (!input.html.trim()) throw new CopyAuditError('html must contain the page markup');
    if (input.html.length > PAGE_LIMITS.htmlChars) throw new CopyAuditError(`html exceeds ${PAGE_LIMITS.htmlChars} characters`);
    const css = input.css ?? [];
    if (css.length > PAGE_LIMITS.cssFiles) throw new CopyAuditError(`css accepts at most ${PAGE_LIMITS.cssFiles} stylesheets`);
    if (css.reduce((sum, sheet) => sum + sheet.length, 0) > PAGE_LIMITS.cssTotalChars) throw new CopyAuditError(`css exceeds ${PAGE_LIMITS.cssTotalChars} characters in total`);
  } else {
    const items = Array.isArray(input.text) ? input.text : [input.text!];
    if (!items.join('').trim()) throw new CopyAuditError('text must contain the copy to check');
    if (items.length > COPY_LIMITS.textItems) throw new CopyAuditError(`text accepts at most ${COPY_LIMITS.textItems} entries`);
    if (items.reduce((sum, item) => sum + item.length, 0) > COPY_LIMITS.textChars) throw new CopyAuditError(`text exceeds ${COPY_LIMITS.textChars} characters`);
  }
}

export function copyRulesetHash(): string {
  return stableHashOf({ patterns: COPY_PATTERNS, voices: VOICE_PROFILES.map(({ productType, koRegister, maxWords }) => ({ productType, koRegister, maxWords })) });
}

export function auditCopy(input: AuditCopyInput, repo: CatalogRepository) {
  validate(input);
  const locale = input.locale ?? 'en';
  const say = wording[locale];
  const targetId = input.targetId?.trim() || 'page';
  const fromPage = input.html !== undefined;
  const parsed = fromPage ? pageUnits(input.html!, input.css ?? []) : { units: textUnits(input.text!), elements: [] };
  const units = parsed.units;
  const voice = voiceFor(input.productType);
  const paths = new Map<string, string>();
  const place = (where: string) => {
    if (!fromPage) return where;
    if (!paths.has(where)) paths.set(where, selectorPath(parsed.elements[Number(where)]!));
    return paths.get(where)!;
  };
  // Only the reported matches get a location: the first LOCATIONS of each pattern.
  const hits = [...locateCopyPatterns(units, locale), ...voiceHits(units, voice, locale)].map((hit) => ({
    ...hit, matches: hit.matches.map((found, index) => (index < LOCATIONS ? { ...found, where: place(found.where) } : found)),
  }));
  const byPattern = new Map(hits.map((hit) => [hit.patternId, hit]));
  const checks = copyChecks(locale, input.productType);
  const rulesetHash = copyRulesetHash();
  const inputHash = stableHashOf(fromPage ? { html: input.html, css: input.css ?? [] } : { text: input.text });

  const findings = checks.flatMap((check) => {
    const hit = byPattern.get(check.patternId);
    if (!hit) return [];
    return [{
      patternId: check.patternId,
      checkId: check.id,
      claim: check.claim,
      count: hit.count,
      locations: hit.matches.slice(0, LOCATIONS).map((found) => {
        const text = excerpt(found.text, found.match);
        const match = found.match.slice(0, EXCERPT);
        return text === match ? { where: found.where, match } : { where: found.where, text, match };
      }),
      instead: check.remediation,
    }];
  });

  const producer = { name: 'web-stylebook-mcp audit_copy', version: SERVER_VERSION, configHash: rulesetHash };
  const evidenceId = (name: string) => {
    const id = `copy:${targetId}:${name}`;
    return id.length <= EVIDENCE_ID_MAX ? id : `copy:${stableHashOf(targetId).slice(7, 23)}:${name}`;
  };
  const evidence: StructureEvidence[] = [];
  const results: StructureResult[] = [];
  if (fromPage) {
    // One scan observed everything, so one item per outcome records it: claims found (failed), shapes found (a task
    // judgment is still needed), and the patterns not found, passed for claims and inapplicable for shapes.
    const groups = [
      { name: 'claims-found', outcome: 'failed' as const, checks: checks.filter((check) => check.claim === 'unsourced-claim' && byPattern.has(check.patternId)) },
      { name: 'shapes-found', outcome: 'cant-tell' as const, checks: checks.filter((check) => check.claim === 'observation' && byPattern.has(check.patternId)) },
      { name: 'no-claims', outcome: 'passed' as const, checks: checks.filter((check) => check.claim === 'unsourced-claim' && !byPattern.has(check.patternId)) },
      { name: 'no-shapes', outcome: 'inapplicable' as const, checks: checks.filter((check) => check.claim === 'observation' && !byPattern.has(check.patternId)) },
    ];
    for (const group of groups) {
      if (!group.checks.length) continue;
      const found = group.name.endsWith('found');
      const listed = group.checks.map((check) => {
        const hit = byPattern.get(check.patternId);
        return hit ? `${check.patternId} ×${hit.count} @ ${hit.matches[0]!.where}` : check.patternId;
      }).join('; ');
      const first = found ? byPattern.get(group.checks[0]!.patternId)!.matches[0]!.where : undefined;
      evidence.push({
        id: evidenceId(group.name), targetId, type: 'dom', phase: 'static',
        summary: `${found ? '' : `${say.none(units.length)} `}${listed}`.slice(0, 1990),
        outcome: group.outcome, contentHash: inputHash,
        actual: { units: units.length, patterns: group.checks.length },
        ...(first ? { location: { selector: first } } : {}),
        producer,
      });
      for (const check of group.checks) {
        const hit = byPattern.get(check.patternId);
        const verdict: StructureResult['verdict'] = group.name === 'claims-found' ? 'FIX_NOW' : group.name === 'shapes-found' ? 'NOT_VERIFIED'
          : group.name === 'no-claims' ? 'PASS' : 'NOT_APPLICABLE';
        results.push({
          checkId: check.id, targetId, verdict, evidenceRefs: [evidenceId(group.name)],
          rationale: hit ? say.found(hit.count, hit.matches[0]!.where) : say.none(units.length),
          ...(verdict === 'FIX_NOW' ? { remediation: check.remediation } : {}),
        });
      }
    }
    results.sort((a, b) => checks.findIndex((check) => check.id === a.checkId) - checks.findIndex((check) => check.id === b.checkId));
  }

  return {
    identity: { schema: COPY_AUDIT_SCHEMA, catalogVersion: repo.catalogVersion, rulesetHash, inputHash },
    locale,
    target: { id: targetId, source: fromPage ? 'html' as const : 'text' as const },
    ...(voice ? { voice: { productType: voice.productType, ...(locale === 'ko' ? { register: voice.koRegister } : {}), maxWords: voice.maxWords } } : {}),
    summary: {
      units: units.length,
      checked: checks.length,
      findings: findings.length,
      fixNow: findings.filter((finding) => finding.claim === 'unsourced-claim').length,
      observations: findings.filter((finding) => finding.claim === 'observation').length,
    },
    findings,
    evidence,
    results,
    limits: say.limits,
    guidance: [
      ...(findings.some((finding) => finding.claim === 'observation') ? [say.guidance.shapes, ...(fromPage ? [say.unjudged] : [])] : []),
      fromPage ? say.guidance.record : say.guidance.text,
    ],
    patternsUri: `webstylebook://copy/patterns/${locale}`,
  };
}

export type CopyAuditResult = ReturnType<typeof auditCopy>;

/** The text fallback: the summary and every finding with its first location and fix. */
export function renderCopyAudit(result: CopyAuditResult): string {
  const lines = [
    `# Copy audit (${result.locale})${result.voice ? ` — voice ${result.voice.productType}` : ''}`,
    `Units ${result.summary.units} · checks ${result.summary.checked} · FIX_NOW ${result.summary.fixNow} · observations ${result.summary.observations} · inputHash ${result.identity.inputHash}`,
  ];
  for (const finding of result.findings) {
    const first = finding.locations[0];
    const claim = finding.claim === 'unsourced-claim';
    // The fix of an observation is in structuredContent.findings; only a FIX_NOW carries it here too.
    lines.push(`- [${claim ? 'FIX_NOW' : 'observation'}] ${finding.patternId} ×${finding.count}${first ? ` @ ${first.where}: "${first.match}"` : ''}${claim ? ` → ${finding.instead}` : ''}`);
  }
  lines.push(...result.guidance, `Patterns: ${result.patternsUri}`);
  return lines.join('\n');
}
