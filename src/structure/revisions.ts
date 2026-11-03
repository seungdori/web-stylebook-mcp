import type { CatalogRepository } from '../catalog/repository.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import { text } from '../localization.js';
import { SERVER_VERSION } from '../server-info.js';
import { PRODUCT_TYPES, type AuditApplicability, type AuditSeverity, type Lang, type ProductType } from '../types.js';
import { PAGE_LIMITS } from './audit.js';
import { detectGlobalPatterns } from './detect.js';
import { MATCH_BUDGET } from './dom/cascade.js';
import { ancestors, descendants, ownText, selectorPath, textContent, type DomElement } from './dom/html.js';
import { ancestorFlag, buildPage, type PageModel } from './dom/page.js';
import { parseSelector, SelectorMatcher, type ComplexSelector } from './dom/selector.js';
import { splitTopLevel } from './dom/values.js';
import { detectMustHaves, perceivableFlag, type MustHaveStatus } from './must-have-detect.js';
import { mustHaveDef, productMustHaveDef, type MustHaveId } from './must-haves.js';

export const REVISION_AUDIT_SCHEMA = 'webstylebook.page-revisions.v1';
export const REVISION_KINDS = ['link', 'field', 'option', 'control', 'handler', 'test-hook', 'script-hook', 'heading', 'figure', 'landmark', 'must-have'] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];
export const REVISION_CHANGES = ['dropped', 'reworded'] as const;
export type RevisionChange = (typeof REVISION_CHANGES)[number];
export const REVISION_LIMITS = {
  wordsMinBefore: 80,
  wordsMinRatio: 0.6,
  reasonMinChars: 12,
  scriptSelectors: 50,
  selectorChars: 500,
  acknowledged: 200,
  keyChars: 2000,
  reasonChars: 1000,
  locations: 5,
} as const;
const VIEWPORT_HEIGHT = 900;
const EVIDENCE_ID_MAX = 160;
const TEST_HOOKS = ['data-testid', 'data-test', 'data-cy'] as const;
const CJK = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-䶿一-鿿가-힯豈-﫿]/gu;
const FIELD_TAGS = new Set(['input', 'select', 'textarea']);
const LANDMARK_ROLES: Readonly<Record<string, string>> = { main: 'main', navigation: 'nav', contentinfo: 'footer' };
const NO_FORM = '(no form)';
/**
 * How fields, their options, and form buttons are identified. Part of the ruleset hash, so results from the earlier
 * page-wide `name` comparison are not mistaken for results of this one.
 */
const FORM_RULES = {
  owner: 'form attribute, else the outermost form ancestor, else no form',
  matching: ['method and action', 'shared fields and buttons', 'position'],
  fields: 'name, else id, else label, per form',
  options: ['radio value', 'checkbox value', 'select option value'],
  controls: ['submit', 'reset', 'button'],
  lostLastSubmit: 'FIX_NOW',
  otherLoss: 'RISK',
} as const;

export type InventoryName = 'links' | 'fields' | 'options' | 'controls' | 'handlers' | 'testHooks' | 'scriptHooks' | 'headings' | 'figures' | 'landmarks' | 'mustHaves';

export interface RevisionCheckDef {
  id: string;
  inventory: InventoryName | 'words';
  kind: RevisionKind | 'words';
  groupId: 'structure' | 'behavior';
  severity: AuditSeverity;
  applicability: AuditApplicability;
  loss: 'FIX_NOW' | 'RISK';
}

export const REVISION_CHECKS: readonly RevisionCheckDef[] = [
  { id: 'redesign-kept-links', inventory: 'links', kind: 'link', groupId: 'structure', severity: 'major', applicability: 'always', loss: 'FIX_NOW' },
  { id: 'redesign-kept-fields', inventory: 'fields', kind: 'field', groupId: 'behavior', severity: 'major', applicability: 'always', loss: 'FIX_NOW' },
  { id: 'redesign-kept-handlers', inventory: 'handlers', kind: 'handler', groupId: 'behavior', severity: 'major', applicability: 'always', loss: 'FIX_NOW' },
  { id: 'redesign-kept-test-hooks', inventory: 'testHooks', kind: 'test-hook', groupId: 'behavior', severity: 'minor', applicability: 'always', loss: 'FIX_NOW' },
  { id: 'redesign-kept-script-hooks', inventory: 'scriptHooks', kind: 'script-hook', groupId: 'behavior', severity: 'major', applicability: 'when-present', loss: 'FIX_NOW' },
  { id: 'redesign-kept-headings', inventory: 'headings', kind: 'heading', groupId: 'structure', severity: 'minor', applicability: 'always', loss: 'RISK' },
  { id: 'redesign-kept-figures', inventory: 'figures', kind: 'figure', groupId: 'structure', severity: 'minor', applicability: 'always', loss: 'RISK' },
  { id: 'redesign-kept-landmarks', inventory: 'landmarks', kind: 'landmark', groupId: 'structure', severity: 'minor', applicability: 'always', loss: 'RISK' },
  { id: 'redesign-kept-words', inventory: 'words', kind: 'words', groupId: 'structure', severity: 'minor', applicability: 'always', loss: 'RISK' },
  { id: 'redesign-kept-must-haves', inventory: 'mustHaves', kind: 'must-have', groupId: 'structure', severity: 'major', applicability: 'always', loss: 'FIX_NOW' },
];

export function revisionChecks(productType?: ProductType): RevisionCheckDef[] {
  return REVISION_CHECKS.filter((check) => check.kind !== 'must-have' || productType !== undefined);
}

let rulesetHashMemo: string | null = null;
export function revisionRulesetHash(): string {
  rulesetHashMemo ??= stableHashOf({ schema: REVISION_AUDIT_SCHEMA, checks: REVISION_CHECKS, limits: REVISION_LIMITS, testHooks: TEST_HOOKS, forms: FORM_RULES });
  return rulesetHashMemo;
}

export interface PageRevision { html: string; css?: string[] }

export interface RevisionAcknowledgement { kind: RevisionKind; key: string; change: RevisionChange; reason: string }

export interface ComparePageRevisionsInput {
  before: PageRevision;
  after: PageRevision;
  scriptSelectors?: string[];
  productType?: ProductType;
  acknowledged?: RevisionAcknowledgement[];
  targetId?: string;
  viewportWidth?: number;
  locale?: Lang;
}

export class RevisionCompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevisionCompareError';
  }
}

export type RevisionVerdict = 'PASS' | 'FIX_NOW' | 'RISK' | 'NOT_APPLICABLE' | 'NOT_VERIFIED';

export interface InventoryCount {
  before: number;
  after: number;
  kept: number;
  acknowledged: number;
  lost: string[];
  reworded: Array<{ key: string; after: string }>;
}

export interface RevisionFinding {
  checkId: string;
  severity: AuditSeverity;
  verdict: 'FIX_NOW' | 'RISK';
  kind: RevisionKind | 'words';
  change: RevisionChange | 'acknowledgement' | 'shrunk';
  keys: string[];
  locations: string[];
  fix: string;
}

export interface RevisionEvidence {
  id: string;
  targetId: string;
  type: 'dom';
  phase: 'before' | 'after';
  summary: string;
  outcome?: 'passed' | 'failed' | 'cant-tell' | 'inapplicable';
  contentHash: string;
  actual: Record<string, string | number | boolean>;
  producer: { name: string; version: string; configHash: string };
}

export interface RevisionResult {
  checkId: string;
  targetId: string;
  verdict: RevisionVerdict;
  evidenceRefs: string[];
  rationale: string;
  remediation?: string;
}

export interface ComparePageRevisionsResult {
  identity: {
    schema: typeof REVISION_AUDIT_SCHEMA;
    catalogVersion: string;
    catalogContentHash: string;
    rulesetHash: string;
    beforeHash: string;
    afterHash: string;
  };
  target: { id: string; viewportWidth: number };
  verdict: 'PASS' | 'FIX_NOW' | 'RISK';
  summary: { findings: number; fixNow: number; risk: number; notVerified: number };
  inventory: Record<InventoryName, InventoryCount>;
  wordCount: { before: number; after: number; ratio: number | null };
  mustHaves: { productType: ProductType; items: Array<{ id: MustHaveId; name: string; before: MustHaveStatus; after: MustHaveStatus }> } | null;
  acknowledgements: { applied: number; rejected: Array<{ kind: RevisionKind; key: string; reason: 'short' | 'unmatched' }> };
  findings: RevisionFinding[];
  evidence: RevisionEvidence[];
  results: RevisionResult[];
  limits: string[];
  guidance: string[];
}

/**
 * One compared element. `key` is the identity two pages are compared by; `shown` is what the result reports and what an
 * acknowledgement names. `aliases` are other names an acknowledgement may use for the same item, `pair` groups the items
 * a lost one may be paired with as reworded, and `severe` marks a loss reported as FIX_NOW where its kind is otherwise RISK.
 */
interface Item { key: string; shown: string; label: string; element: DomElement | null; level?: number; aliases?: string[]; pair?: string; severe?: boolean }
type Inventory = Map<string, Item[]>;
type LostItem = Pick<Item, 'key' | 'shown' | 'element' | 'aliases' | 'severe'>;

interface Labels {
  inventory: Record<InventoryName, string>;
  counts: (name: string, count: InventoryCount) => string;
  words: (before: number, after: number, ratio: number | null) => string;
  shrunk: (ratio: number) => string;
  mustHaves: (lost: number, present: number) => string;
  noSelectors: string;
  unmatched: (list: string) => string;
  sharedForms: (list: string) => string;
  unkeyed: (count: number) => string;
  repeated: (count: number) => string;
  fixes: Record<RevisionKind | 'words' | 'reworded' | 'short' | 'submit', string>;
  notVerified: { truncated: (side: string) => string; exhausted: (side: string) => string; selectors: (list: string) => string; budget: string };
  side: { before: string; after: string };
  summary: (name: string, count: number) => string;
  limits: { heuristics: string; visibility: string; forms: string };
  guidance: string[];
}

const LABELS: Record<Lang, Labels> = {
  en: {
    inventory: { links: 'Links', fields: 'Form fields', options: 'Field options', controls: 'Form buttons', handlers: 'Handlers', testHooks: 'Test hooks', scriptHooks: 'Script hooks', headings: 'Headings', figures: 'Figures', landmarks: 'Landmarks', mustHaves: 'Must-haves' },
    counts: (name, c) => `${name}: ${c.kept} of ${c.before} kept, ${c.lost.length} lost, ${c.acknowledged} acknowledged${c.reworded.length ? `, ${c.reworded.length} reworded` : ''}.`,
    words: (before, after, ratio) => `Visible words: ${before} before, ${after} after${ratio === null ? '' : ` (${Math.round(ratio * 100)}%)`}.`,
    shrunk: (ratio) => `The redesign keeps ${Math.round(ratio * 100)}% of the original visible words.`,
    mustHaves: (lost, present) => `${lost} of the ${present} must-haves present before are missing or off the first screen after.`,
    noSelectors: 'No scriptSelectors were passed.',
    unmatched: (list) => `Not matched on the original page, so not compared: ${list}.`,
    sharedForms: (list) => `More than one form has the same method and action (${list}); those forms were matched by their fields, buttons, and position.`,
    unkeyed: (count) => `${count} ${count === 1 ? 'field has' : 'fields have'} no name, id, or label and ${count === 1 ? 'was' : 'were'} not compared.`,
    repeated: (count) => `${count} field ${count === 1 ? 'name is' : 'names are'} shared by several inputs of one form; each was compared as one field.`,
    fixes: {
      link: 'Restore the link, or add it to acknowledged with the reason it was removed.',
      field: 'Restore the field in the same form with the same name or id and its label, or acknowledge why it is gone.',
      option: 'Offer the option value again in the same field, or acknowledge it with kind "option" if the choice was removed on purpose.',
      control: 'Restore the button in the same form with the same role, or acknowledge it with kind "control" if it was removed on purpose.',
      submit: 'The form no longer has an explicit submit button. Enter in a field or a script may still submit it, which this comparison cannot confirm: restore a submit button inside the form (or linked to it with form="…"), or acknowledge the change with kind "control".',
      handler: 'Restore the form action and method or the inline handler, or acknowledge the change.',
      'test-hook': 'Restore the test attribute so the tests still find the element, or acknowledge it.',
      'script-hook': 'Make the selector match the new markup, or update the script and acknowledge the change.',
      heading: 'Restore the heading, or acknowledge why its section was removed.',
      figure: 'Restore the image or figure with its alt text or caption, or acknowledge it.',
      landmark: 'Restore the landmark element (main, nav, footer) or its ARIA role.',
      'must-have': 'Put the must-have back in its zone; audit_page_structure with the same productType shows where.',
      words: 'Check whether the redesign dropped content the original page had, and restore what users still need.',
      reworded: 'Confirm that the new wording keeps the meaning, or acknowledge it with change "reworded".',
      short: 'Write a reason of at least 12 characters; a shorter one does not acknowledge the change.',
    },
    notVerified: {
      truncated: (side) => `Parsing stopped early on the ${side} page, so later markup was not compared.`,
      exhausted: (side) => `The ${side} page's stylesheets exceeded the selector budget, so visibility was not resolved.`,
      selectors: (list) => `These script selectors use syntax this comparison does not evaluate: ${list}.`,
      budget: 'The script selectors exceeded the matching budget.',
    },
    side: { before: 'original', after: 'redesigned' },
    summary: (name, count) => `${name}: ${count}`,
    limits: {
      heuristics: 'A static comparison of the submitted HTML and CSS, not a browser: content that JavaScript adds later and stylesheets that were not submitted are not seen.',
      visibility: 'Links, headings, figures, landmarks, word counts, and must-haves count visible elements only. Fields, options, form buttons, handlers, test hooks, and script hooks count every element, hidden or not, because forms, scripts, and tests still use hidden ones.',
      forms: 'Fields, options, and buttons are compared per form: forms are matched by method and action, then by the fields and buttons they share, then by position. Buttons outside a form are compared only through their handlers, test hooks, and script selectors. Whether a form still submits without a submit button (Enter in a field, a script) and what a script does on click are not verified.',
    },
    guidance: [
      'Keep the original page\'s rendered HTML and CSS before a redesign, and pass both here when the redesign is built.',
      'Restore each lost item, or add it to acknowledged with a reason of at least 12 characters, then run compare_page_revisions again.',
      'To record the outcome, call get_design_audit_plan with revisionPreservation: true (and the same productType), then submit these evidence and results to validate_design_audit_result under the same targetId.',
    ],
  },
  ko: {
    inventory: { links: '링크', fields: '폼 필드', options: '선택지', controls: '폼 버튼', handlers: '핸들러', testHooks: '테스트 훅', scriptHooks: '스크립트 훅', headings: '제목', figures: '그림', landmarks: '랜드마크', mustHaves: '필수 요소' },
    counts: (name, c) => `${name}: ${c.before}개 중 ${c.kept}개 유지, ${c.lost.length}개 손실, ${c.acknowledged}개 인정${c.reworded.length ? `, ${c.reworded.length}개 문구 변경` : ''}.`,
    words: (before, after, ratio) => `보이는 단어: 이전 ${before}, 이후 ${after}${ratio === null ? '' : ` (${Math.round(ratio * 100)}%)`}.`,
    shrunk: (ratio) => `리디자인이 원래 보이던 단어의 ${Math.round(ratio * 100)}%만 남겼습니다.`,
    mustHaves: (lost, present) => `이전에 있던 필수 요소 ${present}개 중 ${lost}개가 이후 페이지에 없거나 첫 화면 밖에 있습니다.`,
    noSelectors: 'scriptSelectors를 넘기지 않았습니다.',
    unmatched: (list) => `원래 페이지에서 맞는 요소가 없어 비교하지 않았습니다: ${list}.`,
    sharedForms: (list) => `method와 action이 같은 폼이 여러 개 있어(${list}) 필드, 버튼, 위치로 서로 짝을 지었습니다.`,
    unkeyed: (count) => `name, id, 라벨이 모두 없는 필드 ${count}개는 비교하지 않았습니다.`,
    repeated: (count) => `한 폼 안에서 여러 입력이 함께 쓰는 필드 이름 ${count}개는 각각 하나의 필드로 비교했습니다.`,
    fixes: {
      link: '링크를 되살리거나, 뺀 이유를 acknowledged에 적으세요.',
      field: '같은 폼 안에 같은 name 또는 id와 라벨로 필드를 되살리거나, 없앤 이유를 acknowledged에 적으세요.',
      option: '같은 필드에 그 선택값을 다시 제공하거나, 일부러 뺀 선택지라면 kind "option"으로 acknowledged에 적으세요.',
      control: '같은 폼에 같은 역할의 버튼을 되살리거나, 일부러 뺐다면 kind "control"로 acknowledged에 적으세요.',
      submit: '이 폼에 명시적인 제출 버튼이 더 이상 없습니다. 필드에서 Enter를 누르거나 스크립트로 제출될 수는 있지만 이 비교로는 확인할 수 없습니다. 폼 안에(또는 form="…"으로 연결해) 제출 버튼을 되살리거나, kind "control"로 acknowledged에 적으세요.',
      handler: '폼 action과 method 또는 인라인 핸들러를 되살리거나, 바꾼 이유를 acknowledged에 적으세요.',
      'test-hook': '테스트가 요소를 계속 찾도록 테스트 속성을 되살리거나, acknowledged에 적으세요.',
      'script-hook': '새 마크업에서도 선택자가 맞도록 고치거나, 스크립트를 고친 뒤 acknowledged에 적으세요.',
      heading: '제목을 되살리거나, 그 섹션을 뺀 이유를 acknowledged에 적으세요.',
      figure: '대체 텍스트나 캡션과 함께 이미지 또는 그림을 되살리거나, acknowledged에 적으세요.',
      landmark: '랜드마크 요소(main, nav, footer)나 그 ARIA role을 되살리세요.',
      'must-have': '필수 요소를 정해진 위치에 다시 넣으세요. 같은 productType으로 audit_page_structure를 실행하면 위치를 알려 줍니다.',
      words: '원래 페이지의 내용이 리디자인에서 빠지지 않았는지 확인하고, 사용자에게 아직 필요한 내용은 되살리세요.',
      reworded: '새 문구가 뜻을 그대로 전하는지 확인하거나, change "reworded"로 acknowledged에 적으세요.',
      short: '이유를 12자 이상으로 적으세요. 더 짧은 이유로는 변경을 인정하지 않습니다.',
    },
    notVerified: {
      truncated: (side) => `${side} 페이지 분석이 중간에 멈춰 뒤쪽 마크업은 비교하지 않았습니다.`,
      exhausted: (side) => `${side} 페이지의 스타일시트가 선택자 한도를 넘어 보이는지 판단하지 못했습니다.`,
      selectors: (list) => `이 스크립트 선택자는 이 비교가 평가하지 않는 문법을 씁니다: ${list}.`,
      budget: '스크립트 선택자가 매칭 한도를 넘었습니다.',
    },
    side: { before: '원래', after: '리디자인한' },
    summary: (name, count) => `${name}: ${count}`,
    limits: {
      heuristics: '브라우저가 아니라 제출한 HTML과 CSS를 정적으로 비교합니다. 나중에 JavaScript가 추가하는 내용과 제출하지 않은 스타일시트는 보지 못합니다.',
      visibility: '링크, 제목, 그림, 랜드마크, 단어 수, 필수 요소는 보이는 요소만 셉니다. 폼 필드, 선택지, 폼 버튼, 핸들러, 테스트 훅, 스크립트 훅은 숨긴 요소도 셉니다. 폼, 스크립트, 테스트는 숨긴 요소도 쓰기 때문입니다.',
      forms: '폼 필드, 선택지, 버튼은 폼별로 비교합니다. 폼은 method와 action, 그다음 함께 가진 필드와 버튼, 그다음 위치로 짝을 짓습니다. 폼 밖의 버튼은 핸들러, 테스트 훅, 스크립트 선택자로만 비교합니다. 제출 버튼 없이도 폼이 제출되는지(필드에서 Enter, 스크립트)와 클릭했을 때 스크립트가 하는 일은 확인하지 않습니다.',
    },
    guidance: [
      '리디자인 전에 원래 페이지의 렌더링된 HTML과 CSS를 보관하세요. 리디자인을 빌드한 뒤 두 쪽을 함께 넘기세요.',
      '손실 항목은 되살리거나, 12자 이상의 이유와 함께 acknowledged에 넣으세요. 그다음 compare_page_revisions를 다시 실행하세요.',
      '결과를 기록하려면 revisionPreservation: true(와 같은 productType)로 get_design_audit_plan을 호출하세요. 그다음 이 evidence와 results를 같은 targetId로 validate_design_audit_result에 제출하세요.',
    ],
  },
  ja: {
    inventory: { links: 'リンク', fields: 'フォームフィールド', options: '選択肢', controls: 'フォームボタン', handlers: 'ハンドラー', testHooks: 'テストフック', scriptHooks: 'スクリプトフック', headings: '見出し', figures: '図版', landmarks: 'ランドマーク', mustHaves: '必須要素' },
    counts: (name, c) => `${name}: ${c.before}件中${c.kept}件を維持、${c.lost.length}件を損失、${c.acknowledged}件を承認${c.reworded.length ? `、${c.reworded.length}件の文言変更` : ''}。`,
    words: (before, after, ratio) => `表示される単語: 変更前${before}、変更後${after}${ratio === null ? '' : `(${Math.round(ratio * 100)}%)`}。`,
    shrunk: (ratio) => `リデザインは元の表示単語の${Math.round(ratio * 100)}%しか残していません。`,
    mustHaves: (lost, present) => `変更前にあった必須要素${present}件のうち${lost}件が、変更後のページにないかファーストビューの外にあります。`,
    noSelectors: 'scriptSelectorsが渡されていません。',
    unmatched: (list) => `元のページで一致する要素がないため、比較していません: ${list}。`,
    sharedForms: (list) => `methodとactionが同じフォームが複数あるため(${list})、フィールド、ボタン、位置で対応付けました。`,
    unkeyed: (count) => `name、id、ラベルのいずれもないフィールド${count}件は比較していません。`,
    repeated: (count) => `1つのフォーム内で複数の入力が共有するフィールド名${count}件は、それぞれ1つのフィールドとして比較しました。`,
    fixes: {
      link: 'リンクを戻すか、削除した理由をacknowledgedに記入してください。',
      field: '同じフォームの中に同じnameまたはidとラベルでフィールドを戻すか、なくした理由をacknowledgedに記入してください。',
      option: '同じフィールドにその選択値を再び用意するか、意図して削除した選択肢ならkind "option"でacknowledgedに記入してください。',
      control: '同じフォームに同じ役割のボタンを戻すか、意図して削除したならkind "control"でacknowledgedに記入してください。',
      submit: 'このフォームには明示的な送信ボタンがなくなりました。フィールドでのEnterやスクリプトで送信できる可能性はありますが、この比較では確認できません。フォームの中に(またはform="…"で関連付けて)送信ボタンを戻すか、kind "control"でacknowledgedに記入してください。',
      handler: 'フォームのactionとmethod、またはインラインハンドラーを戻すか、変更理由をacknowledgedに記入してください。',
      'test-hook': 'テストが要素を見つけられるようにテスト属性を戻すか、acknowledgedに記入してください。',
      'script-hook': '新しいマークアップでもセレクターが一致するよう直すか、スクリプトを直してacknowledgedに記入してください。',
      heading: '見出しを戻すか、そのセクションを削除した理由をacknowledgedに記入してください。',
      figure: '代替テキストやキャプションとともに画像または図版を戻すか、acknowledgedに記入してください。',
      landmark: 'ランドマーク要素(main、nav、footer)またはARIA roleを戻してください。',
      'must-have': '必須要素を決められた位置に戻してください。同じproductTypeでaudit_page_structureを実行すると位置がわかります。',
      words: '元のページの内容がリデザインで抜けていないか確認し、利用者にまだ必要な内容を戻してください。',
      reworded: '新しい文言が意味を保っているか確認するか、change "reworded"でacknowledgedに記入してください。',
      short: '理由を12文字以上で記入してください。短い理由では変更を承認しません。',
    },
    notVerified: {
      truncated: (side) => `${side}ページの解析が途中で止まったため、後半のマークアップは比較していません。`,
      exhausted: (side) => `${side}ページのスタイルシートがセレクターの上限を超え、表示されるか判断できませんでした。`,
      selectors: (list) => `次のスクリプトセレクターは、この比較が評価しない構文を使っています: ${list}。`,
      budget: 'スクリプトセレクターが照合の上限を超えました。',
    },
    side: { before: '元の', after: 'リデザイン後の' },
    summary: (name, count) => `${name}: ${count}`,
    limits: {
      heuristics: 'ブラウザではなく、提出したHTMLとCSSを静的に比較します。後からJavaScriptが追加する内容や、提出していないスタイルシートは見えません。',
      visibility: 'リンク、見出し、図版、ランドマーク、単語数、必須要素は表示される要素だけを数えます。フォームフィールド、選択肢、フォームボタン、ハンドラー、テストフック、スクリプトフックは非表示の要素も数えます。フォーム、スクリプト、テストは非表示の要素も使うためです。',
      forms: 'フォームフィールド、選択肢、ボタンはフォームごとに比較します。フォームはmethodとaction、次に共通するフィールドとボタン、次に位置で対応付けます。フォーム外のボタンはハンドラー、テストフック、スクリプトセレクターでのみ比較します。送信ボタンなしでフォームが送信されるか(フィールドでのEnter、スクリプト)と、クリック時にスクリプトが行うことは確認しません。',
    },
    guidance: [
      'リデザインの前に元のページの描画済みHTMLとCSSを保存し、リデザインをビルドしたら両方をここに渡してください。',
      '失われた項目を戻すか、12文字以上の理由とともにacknowledgedに入れてから、compare_page_revisionsを再実行してください。',
      '結果を記録するには、revisionPreservation: true(と同じproductType)でget_design_audit_planを呼び、これらのevidenceとresultsを同じtargetIdでvalidate_design_audit_resultに提出してください。',
    ],
  },
};

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function validateSide(name: string, side: PageRevision): void {
  if (!side.html.trim()) throw new RevisionCompareError(`${name}.html must contain the page markup`);
  if (side.html.length > PAGE_LIMITS.htmlChars) throw new RevisionCompareError(`${name}.html exceeds ${PAGE_LIMITS.htmlChars} characters`);
  const css = side.css ?? [];
  if (css.length > PAGE_LIMITS.cssFiles) throw new RevisionCompareError(`${name}.css accepts at most ${PAGE_LIMITS.cssFiles} stylesheets`);
  if (css.some((sheet) => sheet.length > PAGE_LIMITS.cssChars)) throw new RevisionCompareError(`${name}.css has a stylesheet over ${PAGE_LIMITS.cssChars} characters`);
  if (css.reduce((sum, sheet) => sum + sheet.length, 0) > PAGE_LIMITS.cssTotalChars) throw new RevisionCompareError(`${name}.css exceeds ${PAGE_LIMITS.cssTotalChars} characters in total`);
}

function validate(input: ComparePageRevisionsInput): void {
  validateSide('before', input.before);
  validateSide('after', input.after);
  const width = input.viewportWidth;
  if (width !== undefined && (!Number.isInteger(width) || width < PAGE_LIMITS.viewportMin || width > PAGE_LIMITS.viewportMax)) {
    throw new RevisionCompareError(`viewportWidth must be an integer from ${PAGE_LIMITS.viewportMin} to ${PAGE_LIMITS.viewportMax}`);
  }
  if (input.productType !== undefined && !(PRODUCT_TYPES as readonly string[]).includes(input.productType)) {
    throw new RevisionCompareError(`productType must be one of: ${PRODUCT_TYPES.join(', ')}`);
  }
  const selectors = input.scriptSelectors ?? [];
  if (selectors.length > REVISION_LIMITS.scriptSelectors) throw new RevisionCompareError(`scriptSelectors accepts at most ${REVISION_LIMITS.scriptSelectors} selectors`);
  if (selectors.some((selector) => !selector.trim() || selector.length > REVISION_LIMITS.selectorChars)) {
    throw new RevisionCompareError(`every script selector must be 1-${REVISION_LIMITS.selectorChars} characters`);
  }
  const acknowledged = input.acknowledged ?? [];
  if (acknowledged.length > REVISION_LIMITS.acknowledged) throw new RevisionCompareError(`acknowledged accepts at most ${REVISION_LIMITS.acknowledged} entries`);
  for (const entry of acknowledged) {
    if (!(REVISION_KINDS as readonly string[]).includes(entry.kind)) throw new RevisionCompareError(`acknowledged kind must be one of: ${REVISION_KINDS.join(', ')}`);
    if (!(REVISION_CHANGES as readonly string[]).includes(entry.change)) throw new RevisionCompareError(`acknowledged change must be one of: ${REVISION_CHANGES.join(', ')}`);
    if (!entry.key.trim() || entry.key.length > REVISION_LIMITS.keyChars) throw new RevisionCompareError(`acknowledged key must be 1-${REVISION_LIMITS.keyChars} characters`);
    if (entry.reason.length > REVISION_LIMITS.reasonChars) throw new RevisionCompareError(`acknowledged reason exceeds ${REVISION_LIMITS.reasonChars} characters`);
  }
}

export function normalizeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || href === '#' || /^javascript:/i.test(href)) return null;
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const beforeHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = beforeHash.indexOf('?');
  let path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const query = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '';
  const origin = /^([a-z][a-z0-9+.-]*:)(\/\/[^/?#]*)?/i.exec(path);
  const prefix = origin ? origin[1]!.toLowerCase() + (origin[2] ?? '').toLowerCase() : '';
  const rest = origin ? path.slice(origin[0].length) : path;
  path = prefix + (rest.length > 1 ? rest.replace(/\/+$/, '') || '/' : rest || (origin?.[2] ? '/' : ''));
  const params = query ? query.split('&').filter(Boolean).sort() : [];
  return `${path}${params.length ? `?${params.join('&')}` : ''}${hash}`;
}

function ariaName(page: PageModel, element: DomElement): string {
  const labelledBy = element.attrs.get('aria-labelledby');
  if (labelledBy) {
    const byId = labelledBy.split(/\s+/).map((id) => page.html.elements.find((node) => node.id === id)).filter((node): node is DomElement => !!node);
    const joined = collapse(byId.map(textContent).join(' '));
    if (joined) return joined;
  }
  return collapse(element.attrs.get('aria-label') ?? '');
}

function accessibleName(page: PageModel, element: DomElement): string {
  const aria = ariaName(page, element);
  if (aria) return aria;
  const own = collapse(textContent(element));
  if (own) return own;
  const img = descendants(element).find((node) => node.tag === 'img' && node.attrs.get('alt')?.trim());
  return collapse(img?.attrs.get('alt') ?? element.attrs.get('title') ?? '');
}

function fieldLabel(page: PageModel, field: DomElement): string {
  const named = collapse(field.attrs.get('aria-label') ?? '');
  if (named) return named;
  const labelledBy = field.attrs.get('aria-labelledby');
  if (labelledBy) {
    const joined = collapse(labelledBy.split(/\s+/).map((id) => page.html.elements.find((node) => node.id === id)).filter((node): node is DomElement => !!node).map(textContent).join(' '));
    if (joined) return joined;
  }
  if (field.id) {
    const forLabel = page.html.elements.find((node) => node.tag === 'label' && node.attrs.get('for') === field.id);
    if (forLabel && collapse(textContent(forLabel))) return collapse(textContent(forLabel));
  }
  for (let node = field.parent; node && node.tag !== '#document'; node = node.parent) {
    if (node.tag === 'label') return collapse(textContent(node));
  }
  return collapse(field.attrs.get('title') ?? '');
}

function add(inventory: Inventory, entry: Omit<Item, 'shown'> & { shown?: string }): void {
  const item: Item = { ...entry, shown: entry.shown ?? entry.key };
  const list = inventory.get(item.key);
  if (list) list.push(item);
  else inventory.set(item.key, [item]);
}

interface Side {
  page: PageModel;
  hash: string;
  elements: DomElement[];
  visible: DomElement[];
  words: number;
}

function sideOf(revision: PageRevision, viewportWidth: number): Side {
  const css = revision.css ?? [];
  const page = buildPage(revision.html, css, { viewportWidth, viewportHeight: VIEWPORT_HEIGHT }, PAGE_LIMITS.maxElements);
  const perceivable = perceivableFlag(page);
  const elements = page.html.elements.filter((element) => element.tag !== '#document');
  const visible = elements.filter(perceivable);
  const inSvg = ancestorFlag((node) => node.tag === 'svg');
  let words = 0;
  for (const element of visible) {
    if (inSvg(element)) continue;
    for (const child of element.children) {
      if (child.kind !== 'text') continue;
      const cjk = child.text.match(CJK)?.length ?? 0;
      words += cjk + (child.text.replace(CJK, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0);
    }
  }
  return { page, hash: stableHashOf({ html: revision.html, css, viewportWidth }), elements, visible, words };
}

type PageInventory = Exclude<InventoryName, 'fields' | 'options' | 'controls' | 'scriptHooks' | 'mustHaves'>;

/** The handler key of a form, which also names the form its fields, options, and buttons belong to. */
function formBase(form: DomElement): string {
  const action = normalizeHref(form.attrs.get('action') ?? '') ?? '';
  const method = (form.attrs.get('method') ?? 'get').trim().toLowerCase() || 'get';
  return `form ${method.toUpperCase()} ${action || '(current page)'}`;
}

function inventories(side: Side): Record<PageInventory, Inventory> {
  const out = { links: new Map(), handlers: new Map(), testHooks: new Map(), headings: new Map(), figures: new Map(), landmarks: new Map() } as Record<PageInventory, Inventory>;
  const { page } = side;
  for (const element of side.visible) {
    if ((element.tag === 'a' || element.tag === 'area') && element.attrs.has('href')) {
      const key = normalizeHref(element.attrs.get('href')!);
      if (key) add(out.links, { key, label: accessibleName(page, element), element });
    }
    const role = element.attrs.get('role') ?? '';
    const level = /^h[1-3]$/.test(element.tag) ? Number(element.tag[1]) : role === 'heading' ? Number(element.attrs.get('aria-level') ?? 2) : 0;
    if (level >= 1 && level <= 3) {
      const label = collapse(textContent(element));
      if (label) add(out.headings, { key: label.toLowerCase(), shown: label, label, element, level });
    }
    if (element.tag === 'img' && element.attrs.get('alt')?.trim()) {
      const alt = collapse(element.attrs.get('alt')!);
      add(out.figures, { key: `img: ${alt}`, label: alt, element });
    } else if (role === 'img' && element.attrs.get('aria-label')?.trim()) {
      const name = collapse(element.attrs.get('aria-label')!);
      add(out.figures, { key: `img: ${name}`, label: name, element });
    }
    if (element.tag === 'figure') {
      const caption = descendants(element).find((node) => node.tag === 'figcaption');
      const label = caption ? collapse(textContent(caption)) : '';
      if (label) add(out.figures, { key: `figure: ${label}`, label, element });
    }
    const landmark = ['main', 'nav', 'footer'].includes(element.tag) ? element.tag : LANDMARK_ROLES[role];
    if (landmark) {
      const name = collapse(element.attrs.get('aria-label') ?? '');
      add(out.landmarks, { key: name ? `${landmark} "${name}"` : landmark, label: name, element });
    }
  }
  for (const element of side.elements) {
    if (element.tag === 'form') add(out.handlers, { key: formBase(element), label: '', element });
    for (const [name, value] of element.attrs) {
      if (/^on[a-z]+$/.test(name) && value.trim()) add(out.handlers, { key: `${name}: ${collapse(value)}`, label: '', element });
      if (name === 'formaction' && value.trim()) add(out.handlers, { key: `formaction ${normalizeHref(value) ?? value.trim()}`, label: '', element });
    }
    for (const hook of TEST_HOOKS) {
      const value = element.attrs.get(hook)?.trim();
      if (value) add(out.testHooks, { key: `${hook}=${value}`, label: '', element });
    }
  }
  return out;
}

type ControlRole = 'submit' | 'reset' | 'button';

/** The fields and buttons one form owns, or those no form owns (`form` null). */
interface FormScope {
  form: DomElement | null;
  base: string;
  /** Position among the page's forms. */
  index: number;
  /** 1-based position among the page's forms with the same base. */
  rank: number;
  /** Another form on the page has the same base. */
  shared: boolean;
  fields: Map<string, Array<{ element: DomElement; label: string }>>;
  controls: Array<{ role: ControlRole; label: string; element: DomElement }>;
  /** Field and button keys, for matching the form across the two pages. */
  signature: Set<string>;
}

interface ScopeScan { scopes: FormScope[]; unkeyed: number; repeated: number }

function controlRole(element: DomElement): ControlRole | null {
  const type = (element.attrs.get('type') ?? '').trim().toLowerCase();
  if (element.tag === 'button') return type === 'reset' || type === 'button' ? type : 'submit';
  if (element.tag !== 'input') return null;
  if (type === 'submit' || type === 'image') return 'submit';
  return type === 'reset' || type === 'button' ? type : null;
}

function controlLabel(page: PageModel, element: DomElement): string {
  if (element.tag === 'button') return accessibleName(page, element);
  return ariaName(page, element) || collapse(element.attrs.get('value') ?? '') || collapse(element.attrs.get('alt') ?? '') || collapse(element.attrs.get('title') ?? '');
}

const controlKey = (role: ControlRole, label: string) => (label ? `${role} "${label}"` : role);

function quoteValue(value: string): string {
  return value && !/[\s"]/.test(value) ? value : JSON.stringify(value);
}

/** The values a field offers: the value of each radio or checkbox in a named group, or each option of a select. */
function fieldOptions(page: PageModel, element: DomElement, key: string): Array<{ value: string; label: string; element: DomElement }> {
  if (element.tag === 'select') {
    return descendants(element).filter((node) => node.tag === 'option').map((option) => {
      const text = ownText(option) || textContent(option);
      return { value: option.attrs.get('value') ?? text, label: collapse(option.attrs.get('label') ?? '') || text, element: option };
    });
  }
  const type = (element.attrs.get('type') ?? '').trim().toLowerCase();
  if (element.tag !== 'input' || (type !== 'radio' && type !== 'checkbox') || !key.startsWith('name=')) return [];
  return [{ value: element.attrs.get('value') ?? 'on', label: fieldLabel(page, element), element }];
}

/** Groups the fields and buttons of a page by their form owner, as a browser resolves it. */
function formScopes(side: Side): ScopeScan {
  const { page } = side;
  // Browsers drop a form nested in another form, so its fields belong to the outer one.
  const forms = side.elements.filter((element) => element.tag === 'form' && !ancestors(element).some((node) => node.tag === 'form'));
  const formSet = new Set(forms);
  const byId = new Map<string, DomElement>();
  for (const element of side.elements) if (element.id && !byId.has(element.id)) byId.set(element.id, element);
  const scopes = new Map<DomElement | null, FormScope>();
  const ranks = new Map<string, number>();
  const scope = (form: DomElement | null, base: string, index: number, rank: number): FormScope => ({
    form, base, index, rank, shared: false, fields: new Map(), controls: [], signature: new Set(),
  });
  forms.forEach((form, index) => {
    const base = formBase(form);
    const rank = (ranks.get(base) ?? 0) + 1;
    ranks.set(base, rank);
    scopes.set(form, scope(form, base, index, rank));
  });
  for (const entry of scopes.values()) entry.shared = ranks.get(entry.base)! > 1;
  scopes.set(null, scope(null, NO_FORM, -1, 0));
  const ownerOf = (element: DomElement): DomElement | null => {
    const ref = element.attrs.get('form');
    if (ref !== undefined) {
      const target = byId.get(ref.trim());
      return target && formSet.has(target) ? target : null;
    }
    let owner: DomElement | null = null;
    for (let node = element.parent; node && node.tag !== '#document'; node = node.parent) if (node.tag === 'form') owner = node;
    return owner;
  };
  let unkeyed = 0;
  for (const element of side.elements) {
    const role = controlRole(element);
    if (role) {
      // A button no form owns submits nothing natively; what it does is up to a script.
      const owner = ownerOf(element);
      if (!owner) continue;
      const label = controlLabel(page, element);
      const entry = scopes.get(owner)!;
      entry.controls.push({ role, label, element });
      entry.signature.add(controlKey(role, label));
      continue;
    }
    if (!FIELD_TAGS.has(element.tag)) continue;
    const label = fieldLabel(page, element);
    const name = element.attrs.get('name')?.trim();
    const key = name ? `name=${name}` : element.id ? `#${element.id}` : label ? `label=${label}` : null;
    if (!key) { unkeyed += 1; continue; }
    const entry = scopes.get(ownerOf(element))!;
    const list = entry.fields.get(key);
    if (list) list.push({ element, label });
    else entry.fields.set(key, [{ element, label }]);
    entry.signature.add(key);
  }
  const kept = [...scopes.values()].filter((entry) => entry.fields.size || entry.controls.length);
  // A radio or checkbox group shares one name by design, and a hidden input often backs a checkbox; other inputs
  // that repeat a name in one form are compared as one field, which the result says instead of merging silently.
  const single = (element: DomElement) => !(element.tag === 'input' && ['radio', 'checkbox', 'hidden'].includes((element.attrs.get('type') ?? '').trim().toLowerCase()));
  const repeated = kept.reduce((sum, entry) => sum + [...entry.fields.values()].filter((list) => list.filter(({ element }) => single(element)).length > 1).length, 0);
  return { scopes: kept, unkeyed, repeated };
}

/**
 * Pairs each redesigned form with the original form it continues, best match first: a form keeps its identity through a
 * changed action when it keeps its fields, and several forms with one action are told apart by their fields and position.
 * Returns redesigned form → original form.
 */
function matchForms(was: readonly FormScope[], now: readonly FormScope[]): Map<FormScope, FormScope> {
  const candidates: Array<{ before: FormScope; after: FormScope; score: number; distance: number }> = [];
  for (const before of was) {
    if (!before.form) continue;
    for (const after of now) {
      if (!after.form) continue;
      let shared = 0;
      for (const key of before.signature) if (after.signature.has(key)) shared += 1;
      const union = before.signature.size + after.signature.size - shared;
      const similarity = union ? shared / union : 0;
      const same = before.base === after.base;
      if (same || similarity > 0) candidates.push({ before, after, score: similarity + (same ? 0.5 : 0), distance: Math.abs(before.index - after.index) });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.distance - b.distance || a.before.index - b.before.index || a.after.index - b.after.index);
  const twins = new Map<FormScope, FormScope>();
  const taken = new Set<FormScope>();
  for (const { before, after } of candidates) {
    if (taken.has(before) || twins.has(after)) continue;
    twins.set(after, before);
    taken.add(before);
  }
  return twins;
}

interface FormInventories {
  fields: [Inventory, Inventory];
  options: [Inventory, Inventory];
  controls: [Inventory, Inventory];
  /** Bases that more than one form on a page shares, so those forms were told apart by their content and position. */
  shared: string[];
  /** Original fields with no name, id, or label, which cannot be compared. */
  unkeyed: number;
  /** Original field keys that more than one non-choice input of one form shares, each compared as one field. */
  repeated: number;
}

function formInventories(before: Side, after: Side): FormInventories {
  const was = formScopes(before);
  const now = formScopes(after);
  const twins = matchForms(was.scopes, now.scopes);
  // A key names its form only when a page has fields or buttons in more than one form (or also outside any form),
  // so a page with one form keeps the keys and acknowledgements it always had.
  const qualify = was.scopes.length > 1 || now.scopes.length > 1;
  const nameOf = (scope: FormScope) => (scope.form ? (scope.shared ? `${scope.base} [${scope.rank}]` : scope.base) : NO_FORM);
  const ids = new Map<FormScope, { id: string; name: string }>();
  was.scopes.forEach((scope, i) => ids.set(scope, { id: scope.form ? `b${i}` : NO_FORM, name: nameOf(scope) }));
  now.scopes.forEach((scope, i) => {
    const twin = twins.get(scope);
    ids.set(scope, twin ? ids.get(twin)! : { id: scope.form ? `a${i}` : NO_FORM, name: nameOf(scope) });
  });
  const afterOf = new Map([...twins].map(([next, previous]) => [previous, next] as const));
  const hasSubmit = (scope: FormScope | undefined) => !!scope?.controls.some((control) => control.role === 'submit');

  const fieldOf = new Map<string, string>();
  const build = (scan: ScopeScan, page: PageModel, original: boolean) => {
    const out = { fields: new Map() as Inventory, options: new Map() as Inventory, controls: new Map() as Inventory };
    const names = new Map<Item, { bare: string[]; qualified: string[] }>();
    for (const scope of scan.scopes) {
      const { id, name } = ids.get(scope)!;
      const push = (inventory: Inventory, key: string, bare: string[], rest: Omit<Item, 'key' | 'shown'>) => {
        const qualified = bare.map((entry) => `${name} > ${entry}`);
        const item: Item = { key: `${id}\u0000${key}`, shown: qualify ? qualified[0]! : bare[0]!, ...rest };
        names.set(item, { bare, qualified });
        const list = inventory.get(item.key);
        if (list) list.push(item);
        else inventory.set(item.key, [item]);
      };
      for (const [key, list] of scope.fields) {
        for (const { element, label } of list) {
          push(out.fields, key, [key], { label, element });
          for (const option of fieldOptions(page, element, key)) {
            const plain = `${key} value=${quoteValue(option.value)}`;
            const bare = option.label && option.label.toLowerCase() !== option.value.toLowerCase() ? [`${plain} "${option.label}"`, plain] : [plain];
            fieldOf.set(`${id}\u0000${key}\u0000${option.value}`, `${id}\u0000${key}`);
            push(out.options, `${key}\u0000${option.value}`, bare, { label: option.label, element: option.element });
          }
        }
      }
      // The original form's last submit button is gone when the form it continues has none (or no form continues it).
      const orphaned = original && hasSubmit(scope) && !hasSubmit(afterOf.get(scope));
      for (const control of scope.controls) {
        const key = controlKey(control.role, control.label);
        push(out.controls, key, [key], { label: control.label, element: control.element, pair: `${id}\u0000${control.role}`, ...(orphaned && control.role === 'submit' ? { severe: true } : {}) });
      }
    }
    if (original) {
      // An acknowledgement may name an item with or without its form; without it only when no other item has that name.
      for (const inventory of Object.values(out)) {
        const owners = new Map<string, Set<string>>();
        for (const [key, items] of inventory) {
          for (const item of items) {
            for (const entry of names.get(item)!.bare) {
              const set = owners.get(entry) ?? new Set<string>();
              set.add(key);
              owners.set(entry, set);
            }
          }
        }
        for (const items of inventory.values()) {
          for (const item of items) {
            const { bare, qualified } = names.get(item)!;
            const aliases = [...new Set([...qualified, ...bare.filter((entry) => owners.get(entry)!.size === 1)])].filter((entry) => entry !== item.shown);
            if (aliases.length) item.aliases = aliases;
          }
        }
      }
    }
    return out;
  };
  const b = build(was, before.page, true);
  const a = build(now, after.page, false);
  // Options are compared for the fields both pages have; a lost field already reports what it offered.
  for (const [mine, theirs] of [[b, a], [a, b]] as const) {
    for (const key of [...mine.options.keys()]) if (!theirs.fields.has(fieldOf.get(key)!)) mine.options.delete(key);
  }
  const shared = new Set<string>();
  for (const scan of [was, now]) {
    const seen = new Set<string>();
    for (const scope of scan.scopes) {
      if (!scope.form) continue;
      if (seen.has(scope.base)) shared.add(scope.base);
      seen.add(scope.base);
    }
  }
  return { fields: [b.fields, a.fields], options: [b.options, a.options], controls: [b.controls, a.controls], shared: [...shared], unkeyed: was.unkeyed, repeated: was.repeated };
}

interface ScriptHookScan { matched: Inventory; unsupported: string[]; exhausted: boolean }

function scanScriptHooks(side: Side, selectors: readonly string[]): ScriptHookScan {
  const matched: Inventory = new Map();
  const unsupported: string[] = [];
  const matcher = new SelectorMatcher(MATCH_BUDGET, side.elements.length);
  for (const source of selectors) {
    const parts = splitTopLevel(source).map((part) => parseSelector(part));
    if (parts.some((part) => part === null)) { unsupported.push(source); continue; }
    const first = side.elements.find((element) => (parts as ComplexSelector[]).some((part) => matcher.matches(element, part)));
    if (first) add(matched, { key: source, label: '', element: first });
    if (matcher.exhausted) break;
  }
  return { matched, unsupported, exhausted: matcher.exhausted };
}

function shortReason(reason: string): boolean {
  return [...reason.trim()].length < REVISION_LIMITS.reasonMinChars;
}

function evidenceIdFor(targetId: string, checkId: string, phase: 'before' | 'after'): string {
  const id = `revision:${targetId}:${checkId}:${phase}`;
  return id.length <= EVIDENCE_ID_MAX ? id : `revision:${stableHashOf(targetId).slice(7, 23)}:${checkId}:${phase}`;
}

/** Pairs lost and added items of the same group (a heading level, or a button role in one form) in document order. */
function pairReworded(lost: Item[], added: Item[]): Array<[Item, Item]> {
  const pairs: Array<[Item, Item]> = [];
  const groupOf = (item: Item) => item.pair ?? `h${item.level}`;
  for (const group of new Set(lost.map(groupOf))) {
    const from = lost.filter((item) => groupOf(item) === group);
    const to = added.filter((item) => groupOf(item) === group);
    for (let i = 0; i < Math.min(from.length, to.length); i++) pairs.push([from[i]!, to[i]!]);
  }
  return pairs;
}

const namesOf = (item: LostItem): string[] => [item.shown, ...(item.aliases ?? []), item.key];

export function comparePageRevisions(input: ComparePageRevisionsInput, repo: CatalogRepository): ComparePageRevisionsResult {
  validate(input);
  const locale = input.locale ?? 'en';
  const label = LABELS[locale];
  const viewportWidth = input.viewportWidth ?? 1440;
  const targetId = input.targetId?.trim() || 'page';
  const before = sideOf(input.before, viewportWidth);
  const after = sideOf(input.after, viewportWidth);
  const was = inventories(before);
  const now = inventories(after);
  const forms = formInventories(before, after);
  const selectors = [...new Set((input.scriptSelectors ?? []).map((selector) => selector.trim()))];
  const hooksBefore = scanScriptHooks(before, selectors);
  const hooksAfter = scanScriptHooks(after, selectors);
  const productType = input.productType;
  const mustHaveItems = productType ? productMustHaveDef(productType)?.items ?? [] : [];
  const detectedBefore = detectMustHaves(before.page, mustHaveItems, detectGlobalPatterns(before.page));
  const detectedAfter = detectMustHaves(after.page, mustHaveItems, detectGlobalPatterns(after.page));

  const acknowledged = input.acknowledged ?? [];
  const used = new Set<RevisionAcknowledgement>();
  const shortOnes: RevisionAcknowledgement[] = [];
  const acknowledge = (kind: RevisionKind, keys: readonly string[], change: RevisionChange): boolean => {
    const entry = acknowledged.find((candidate) => candidate.kind === kind && keys.includes(candidate.key.trim()) && candidate.change === change);
    if (!entry) return false;
    used.add(entry);
    if (shortReason(entry.reason)) { if (!shortOnes.includes(entry)) shortOnes.push(entry); return false; }
    return true;
  };

  const inventory = {} as Record<InventoryName, InventoryCount>;
  const findings: RevisionFinding[] = [];
  const lostLocations = new Map<string, string[]>();
  const droppedItems = new Map<InventoryName, LostItem[]>();
  const tally = (name: InventoryName, kind: RevisionKind, from: Inventory, to: Inventory, extraLost: LostItem[] = []) => {
    const count: InventoryCount = { before: from.size, after: to.size, kept: 0, acknowledged: 0, lost: [], reworded: [] };
    const locations: string[] = [];
    const dropped: LostItem[] = [];
    const drop = (item: LostItem) => {
      if (acknowledge(kind, namesOf(item), 'dropped')) { count.acknowledged += 1; return; }
      count.lost.push(item.shown);
      dropped.push(item);
      if (item.element && locations.length < REVISION_LIMITS.locations) locations.push(selectorPath(item.element));
    };
    const lostItems: Item[] = [];
    for (const [key, items] of from) {
      if (to.has(key)) count.kept += 1;
      else lostItems.push(items[0]!);
    }
    const addedItems = [...to].filter(([key]) => !from.has(key)).map(([, items]) => items[0]!);
    const pairs = kind === 'heading' || kind === 'control' ? pairReworded(lostItems, addedItems) : [];
    if (kind === 'landmark') {
      const typeOf = (item: Item) => item.key.split(' ')[0];
      for (const item of [...lostItems]) {
        const renamed = addedItems.findIndex((candidate) => typeOf(candidate) === typeOf(item));
        if (renamed < 0) continue;
        addedItems.splice(renamed, 1);
        lostItems.splice(lostItems.indexOf(item), 1);
        count.kept += 1;
      }
    }
    for (const item of lostItems) {
      const pair = pairs.find(([from]) => from === item);
      if (pair) {
        if (acknowledge(kind, namesOf(item), 'reworded') || acknowledge(kind, namesOf(item), 'dropped')) count.acknowledged += 1;
        else count.reworded.push({ key: item.shown, after: pair[1].shown });
        continue;
      }
      drop(item);
    }
    // A link that kept its target, or an option that kept its value, but lost every wording it had.
    if (kind === 'link' || kind === 'option') {
      for (const [key, items] of from) {
        const next = to.get(key);
        if (!next) continue;
        const was = new Set(items.map((item) => item.label.toLowerCase()).filter(Boolean));
        const is = new Set(next.map((item) => item.label.toLowerCase()).filter(Boolean));
        if (!was.size || [...was].some((value) => is.has(value))) continue;
        if (acknowledge(kind, namesOf(items[0]!), 'reworded')) continue;
        count.reworded.push({ key: items[0]!.shown, after: next.find((item) => item.label)?.label ?? '' });
      }
    }
    for (const extra of extraLost) drop(extra);
    inventory[name] = count;
    lostLocations.set(name, locations);
    droppedItems.set(name, dropped);
  };

  tally('links', 'link', was.links, now.links);
  const [fieldsBefore, fieldsAfter] = forms.fields;
  const labelLost = [...fieldsBefore].filter(([key, items]) => fieldsAfter.has(key) && items.some((item) => item.label) && !fieldsAfter.get(key)!.some((item) => item.label))
    .map(([key, items]) => ({
      key: `${key} (label)`, shown: `${items[0]!.shown} (label)`, element: items[0]!.element,
      ...(items[0]!.aliases ? { aliases: items[0]!.aliases.map((alias) => `${alias} (label)`) } : {}),
    }));
  tally('fields', 'field', fieldsBefore, fieldsAfter, labelLost);
  tally('options', 'option', ...forms.options);
  tally('controls', 'control', ...forms.controls);
  tally('handlers', 'handler', was.handlers, now.handlers);
  tally('testHooks', 'test-hook', was.testHooks, now.testHooks);
  tally('scriptHooks', 'script-hook', hooksBefore.matched, hooksAfter.matched);
  tally('headings', 'heading', was.headings, now.headings);
  tally('figures', 'figure', was.figures, now.figures);
  tally('landmarks', 'landmark', was.landmarks, now.landmarks);

  const presentBefore = mustHaveItems.filter((item) => detectedBefore.get(item.id)?.status === 'present');
  const mustBefore: Inventory = new Map(presentBefore.map((item) => [item.id, [{ key: item.id, shown: item.id, label: '', element: detectedBefore.get(item.id)!.inZone[0] ?? null }]]));
  const mustAfter: Inventory = new Map(presentBefore.filter((item) => detectedAfter.get(item.id)?.status === 'present' || detectedAfter.get(item.id)?.status === 'not-verified')
    .map((item) => [item.id, [{ key: item.id, shown: item.id, label: '', element: null }]]));
  tally('mustHaves', 'must-have', mustBefore, mustAfter);

  const ratio = before.words ? Math.round((after.words / before.words) * 100) / 100 : null;
  const shrunk = before.words > REVISION_LIMITS.wordsMinBefore && ratio !== null && after.words / before.words < REVISION_LIMITS.wordsMinRatio;

  const truncated = before.page.html.truncated || after.page.html.truncated;
  const exhausted = before.page.styles.exhausted || after.page.styles.exhausted;
  const sideNotes = (test: (side: Side) => boolean, note: (side: string) => string) => [
    ...(test(before) ? [note(label.side.before)] : []), ...(test(after) ? [note(label.side.after)] : []),
  ];
  const truncatedNotes = sideNotes((side) => side.page.html.truncated, label.notVerified.truncated);
  const exhaustedNotes = sideNotes((side) => side.page.styles.exhausted, label.notVerified.exhausted);
  const unsupported = [...new Set([...hooksBefore.unsupported, ...hooksAfter.unsupported])];

  const evidence: RevisionEvidence[] = [];
  const results: RevisionResult[] = [];
  const producer = { name: 'web-stylebook-mcp compare_page_revisions', version: SERVER_VERSION, configHash: revisionRulesetHash() };
  for (const check of revisionChecks(productType)) {
    const checkFindings: RevisionFinding[] = [];
    const finding = (verdict: 'FIX_NOW' | 'RISK', change: RevisionFinding['change'], keys: string[], fix: string, locations: string[] = [], kind: RevisionFinding['kind'] = check.kind) => {
      if (!keys.length) return;
      checkFindings.push({ checkId: check.id, severity: check.severity, verdict, kind, change, keys, locations, fix });
    };
    let notVerified: string[] = [];
    let notApplicable: string | null = null;
    let rationale: string;
    const visibility = check.inventory === 'links' || check.inventory === 'headings' || check.inventory === 'figures'
      || check.inventory === 'landmarks' || check.inventory === 'words' || check.inventory === 'mustHaves';
    if (truncated) notVerified.push(...truncatedNotes);
    if (exhausted && visibility) notVerified.push(...exhaustedNotes);
    // An item missing from a page that was not fully read may still be there, so its loss is a risk, not a defect.
    const uncertain = after.page.html.truncated || (exhausted && visibility) || (check.inventory === 'scriptHooks' && hooksAfter.exhausted);
    const loss = uncertain ? 'RISK' : check.loss;
    if (check.inventory === 'words') {
      if (shrunk) finding(loss, 'shrunk', [label.shrunk(ratio!)], label.fixes.words);
      rationale = label.words(before.words, after.words, ratio);
    } else {
      const count = inventory[check.inventory];
      const kind = check.kind as RevisionKind;
      finding(loss, 'dropped', count.lost, label.fixes[kind], lostLocations.get(check.inventory));
      finding('RISK', 'reworded', count.reworded.map((entry) => entry.key), label.fixes.reworded);
      finding('RISK', 'acknowledgement', shortOnes.filter((entry) => entry.kind === kind).map((entry) => entry.key), label.fixes.short);
      rationale = check.inventory === 'mustHaves' ? label.mustHaves(count.lost.length, count.before) : label.counts(label.inventory[check.inventory], count);
      if (check.inventory === 'fields') {
        // The fields check also answers for the options each field offers and the buttons each form has.
        const where = (items: LostItem[]) => items.flatMap((item) => (item.element ? [selectorPath(item.element)] : [])).slice(0, REVISION_LIMITS.locations);
        const controls = droppedItems.get('controls')!;
        const lastSubmit = controls.filter((item) => item.severe);
        const otherControls = controls.filter((item) => !item.severe);
        finding(loss, 'dropped', lastSubmit.map((item) => item.shown), label.fixes.submit, where(lastSubmit), 'control');
        finding('RISK', 'dropped', otherControls.map((item) => item.shown), label.fixes.control, where(otherControls), 'control');
        finding('RISK', 'reworded', inventory.controls.reworded.map((entry) => entry.key), label.fixes.reworded, [], 'control');
        finding('RISK', 'dropped', inventory.options.lost, label.fixes.option, where(droppedItems.get('options')!), 'option');
        finding('RISK', 'reworded', inventory.options.reworded.map((entry) => entry.key), label.fixes.reworded, [], 'option');
        for (const extra of ['option', 'control'] as const) {
          finding('RISK', 'acknowledgement', shortOnes.filter((entry) => entry.kind === extra).map((entry) => entry.key), label.fixes.short, [], extra);
        }
        for (const extra of ['options', 'controls'] as const) {
          if (inventory[extra].before || inventory[extra].after) rationale += ` ${label.counts(label.inventory[extra], inventory[extra])}`;
        }
        if (forms.shared.length) rationale += ` ${label.sharedForms(forms.shared.join(', '))}`;
        if (forms.unkeyed) rationale += ` ${label.unkeyed(forms.unkeyed)}`;
        if (forms.repeated) rationale += ` ${label.repeated(forms.repeated)}`;
      }
      if (check.inventory === 'scriptHooks') {
        const unmatched = selectors.filter((selector) => !hooksBefore.matched.has(selector) && !unsupported.includes(selector));
        if (unmatched.length) rationale += ` ${label.unmatched(unmatched.join(', '))}`;
        if (!selectors.length) notApplicable = label.noSelectors;
        if (unsupported.length) notVerified.push(label.notVerified.selectors(unsupported.join(', ')));
        if (hooksBefore.exhausted || hooksAfter.exhausted) notVerified.push(label.notVerified.budget);
      }
      if (check.inventory === 'mustHaves' && mustHaveItems.some((item) => detectedAfter.get(item.id)?.status === 'not-verified' && detectedBefore.get(item.id)?.status === 'present')) {
        notVerified.push(...exhaustedNotes);
      }
    }
    notVerified = [...new Set(notVerified)];
    findings.push(...checkFindings);
    const verdict: RevisionVerdict = notApplicable ? 'NOT_APPLICABLE'
      : checkFindings.some((entry) => entry.verdict === 'FIX_NOW') ? 'FIX_NOW'
        : notVerified.length ? 'NOT_VERIFIED'
          : checkFindings.length ? 'RISK' : 'PASS';
    const beforeId = evidenceIdFor(targetId, check.id, 'before');
    const afterId = evidenceIdFor(targetId, check.id, 'after');
    const counts = check.inventory === 'words'
      ? { before: { words: before.words }, after: { words: after.words, ratio: ratio ?? 0 } }
      : (() => {
        const count = inventory[check.inventory];
        const counted = { before: { count: count.before }, after: { count: count.after, kept: count.kept, lost: count.lost.length, acknowledged: count.acknowledged, reworded: count.reworded.length } };
        if (check.inventory !== 'fields') return counted;
        const { options, controls } = inventory;
        return {
          before: { ...counted.before, options: options.before, controls: controls.before },
          after: { ...counted.after, options: options.after, optionsLost: options.lost.length, controls: controls.after, controlsLost: controls.lost.length },
        };
      })();
    const name = check.inventory === 'words' ? 'words' : label.inventory[check.inventory];
    evidence.push({
      id: beforeId, targetId, type: 'dom', phase: 'before',
      summary: label.summary(name, check.inventory === 'words' ? before.words : inventory[check.inventory].before),
      contentHash: before.hash, actual: counts.before, producer,
    }, {
      id: afterId, targetId, type: 'dom', phase: 'after',
      summary: `${rationale}${notVerified.length ? ` ${notVerified.join(' ')}` : ''}${notApplicable ? ` ${notApplicable}` : ''}`.slice(0, 1990),
      outcome: verdict === 'PASS' ? 'passed' : verdict === 'NOT_VERIFIED' ? 'cant-tell' : verdict === 'NOT_APPLICABLE' ? 'inapplicable' : 'failed',
      contentHash: after.hash, actual: counts.after, producer,
    });
    const remediation = [...new Set(checkFindings.map((entry) => entry.fix))].join(' ');
    results.push({
      checkId: check.id,
      targetId,
      verdict,
      evidenceRefs: [beforeId, afterId],
      rationale: (notApplicable ?? [rationale, ...notVerified].join(' ')).slice(0, 2990),
      ...(verdict === 'FIX_NOW' || verdict === 'RISK' ? { remediation: remediation.slice(0, 2990) } : {}),
    });
  }

  const fixNow = findings.filter((entry) => entry.verdict === 'FIX_NOW').length;
  const notVerifiedCount = results.filter((result) => result.verdict === 'NOT_VERIFIED').length;
  const limits = [label.limits.heuristics, label.limits.visibility, label.limits.forms, ...truncatedNotes, ...exhaustedNotes,
    ...(unsupported.length ? [label.notVerified.selectors(unsupported.join(', '))] : [])];
  return {
    identity: {
      schema: REVISION_AUDIT_SCHEMA,
      catalogVersion: repo.catalogVersion,
      catalogContentHash: repo.contentHash,
      rulesetHash: revisionRulesetHash(),
      beforeHash: before.hash,
      afterHash: after.hash,
    },
    target: { id: targetId, viewportWidth },
    verdict: fixNow ? 'FIX_NOW' : findings.length || notVerifiedCount ? 'RISK' : 'PASS',
    summary: { findings: findings.length, fixNow, risk: findings.length - fixNow, notVerified: notVerifiedCount },
    inventory,
    wordCount: { before: before.words, after: after.words, ratio },
    mustHaves: productType ? {
      productType,
      items: mustHaveItems.map((item) => ({
        id: item.id,
        name: text(mustHaveDef(item.id).name, locale),
        before: detectedBefore.get(item.id)!.status,
        after: detectedAfter.get(item.id)!.status,
      })),
    } : null,
    acknowledgements: {
      applied: acknowledged.filter((entry) => used.has(entry) && !shortOnes.includes(entry)).length,
      rejected: [
        ...shortOnes.map((entry) => ({ kind: entry.kind, key: entry.key, reason: 'short' as const })),
        ...acknowledged.filter((entry) => !used.has(entry)).map((entry) => ({ kind: entry.kind, key: entry.key, reason: 'unmatched' as const })),
      ],
    },
    findings,
    evidence,
    results,
    limits,
    guidance: label.guidance,
  };
}
