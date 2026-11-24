import type { AuditAutomationLevel, AuditEvidenceType, Lang } from '../types.js';

/**
 * Who observed the evidence and how. The method decides what the evidence can support: static inspection shows that a
 * label, attribute, or structure exists; a browser run shows what a rendered page does; an agent or expert review
 * supports a reasoned concern or hypothesis; only participants or analytics data show what people did.
 */
export const AUDIT_EVIDENCE_METHODS = ['static', 'browser', 'agent-review', 'participant', 'analytics'] as const;
export type AuditEvidenceMethod = (typeof AUDIT_EVIDENCE_METHODS)[number];

/**
 * How one principle verify sentence is answered.
 * - static: code, DOM, computed-style, or token inspection
 * - browser: a rendered page at the target viewport and state, looked at (visual) or operated (interaction)
 * - review: a contextual judgment that names what was looked at
 * - participant: what people do or remember; an agent's own run does not stand in for it
 */
export type VerifyMethodClass = 'static' | 'browser-visual' | 'browser-interaction' | 'review' | 'participant';

interface VerifyMethodDef {
  evidenceTypes: AuditEvidenceType[];
  methods: AuditEvidenceMethod[];
  automation: AuditAutomationLevel;
  note: Record<Lang, string>;
}

export const VERIFY_METHODS: Record<VerifyMethodClass, VerifyMethodDef> = {
  static: {
    evidenceTypes: ['computed-style'],
    methods: ['static', 'browser'],
    automation: 'assisted',
    note: {
      en: 'Evidence: static inspection of code, DOM, computed styles, or tokens (a browser run also answers it).',
      ko: '증거: 코드, DOM, 계산된 스타일, 토큰을 정적으로 검사한 결과(브라우저 실행 결과도 됩니다).',
      ja: '証拠: コード、DOM、計算済みスタイル、トークンの静的検査(ブラウザでの実行結果も可)。',
    },
  },
  'browser-visual': {
    evidenceTypes: ['screenshot'],
    methods: ['browser'],
    automation: 'assisted',
    note: {
      en: 'Evidence: a browser capture at the named viewport, zoom, theme, or mode; static markup does not answer it.',
      ko: '증거: 지정한 뷰포트, 확대, 테마, 모드에서 찍은 브라우저 캡처. 정적 마크업으로는 답할 수 없습니다.',
      ja: '証拠: 指定したビューポート、拡大率、テーマ、モードでのブラウザのキャプチャ。静的なマークアップでは答えられません。',
    },
  },
  'browser-interaction': {
    evidenceTypes: ['interaction'],
    methods: ['browser'],
    automation: 'assisted',
    note: {
      en: 'Evidence: operating the rendered page in a browser and recording what happened; static markup does not answer it.',
      ko: '증거: 렌더링된 페이지를 브라우저에서 조작하고 결과를 기록한 것. 정적 마크업으로는 답할 수 없습니다.',
      ja: '証拠: 描画されたページをブラウザで操作し、結果を記録したもの。静的なマークアップでは答えられません。',
    },
  },
  review: {
    evidenceTypes: ['manual'],
    methods: ['agent-review', 'participant'],
    automation: 'manual',
    note: {
      en: 'Evidence: a contextual review (agent or expert) that names what was looked at. It supports a concern or an improvement hypothesis, not a measured user outcome.',
      ko: '증거: 무엇을 보았는지 밝힌 맥락 검토(에이전트나 전문가). 근거 있는 우려나 개선 가설을 뒷받침할 뿐, 측정한 사용자 성과는 아닙니다.',
      ja: '証拠: 何を見たかを示した文脈的なレビュー(エージェントか専門家)。根拠のある懸念や改善仮説を支えるだけで、測定した利用者の成果ではありません。',
    },
  },
  participant: {
    evidenceTypes: ['manual'],
    methods: ['participant', 'analytics'],
    automation: 'manual',
    note: {
      en: 'Evidence: participant observation or analytics under stated conditions. An agent\'s own timing, clicks, or judgment does not answer it; without such data, leave it NOT_VERIFIED.',
      ko: '증거: 조건을 밝힌 참여자 관찰이나 분석 데이터. 에이전트가 직접 잰 시간, 클릭, 판단으로는 답할 수 없습니다. 그런 자료가 없으면 NOT_VERIFIED로 두세요.',
      ja: '証拠: 条件を示した参加者の観察か分析データ。エージェント自身の計測時間、クリック、判断では答えられません。そうした資料がなければNOT_VERIFIEDのままにしてください。',
    },
  },
};

/**
 * The method each catalog verify sentence needs, in catalog order. This is a reviewed mapping, not a parse of the
 * sentence: a test fails when the catalog's verify list and this table differ in length, so a canonical catalog change
 * has to update it on purpose.
 */
export const UX_VERIFY_METHODS: Record<string, readonly VerifyMethodClass[]> = {
  'aesthetic-usability-effect': ['participant', 'participant'],
  'law-of-common-region': ['review', 'browser-visual'],
  'law-of-proximity': ['browser-visual', 'browser-interaction'],
  'law-of-similarity': ['review', 'browser-visual'],
  'law-of-uniform-connectedness': ['review', 'browser-visual'],
  'selective-attention': ['participant', 'browser-visual'],
  'von-restorff-effect': ['review', 'browser-visual'],
  chunking: ['review', 'review'],
  'cognitive-load': ['participant', 'review'],
  'mental-model': ['participant', 'participant'],
  'teslers-law': ['review', 'browser-interaction'],
  'working-memory': ['browser-interaction', 'browser-interaction'],
  'choice-overload': ['participant', 'browser-interaction'],
  'hicks-law': ['participant', 'review'],
  'doherty-threshold': ['browser-interaction', 'browser-interaction'],
  'fitts-law': ['browser-visual', 'browser-interaction'],
  'jakobs-law': ['participant', 'browser-interaction'],
  'paradox-of-the-active-user': ['participant', 'browser-interaction'],
  'postels-law': ['browser-interaction', 'browser-interaction'],
  'goal-gradient-effect': ['review', 'participant'],
  'zeigarnik-effect': ['browser-interaction', 'participant'],
  'peak-end-rule': ['browser-interaction', 'participant'],
  'serial-position-effect': ['participant', 'browser-visual'],
};

export const DESIGN_VERIFY_METHODS: Record<string, readonly VerifyMethodClass[]> = {
  'core-task-first': ['participant'],
  'opening-earns-its-frame': ['review'],
  'evidence-near-claim': ['review'],
  'fidelity-follows-certainty': ['browser-visual'],
  'bounded-choice-system': ['static'],
  'attention-budget': ['review'],
  'contrast-before-scale': ['browser-visual'],
  'explicit-labels-and-semantics': ['browser-interaction'],
  'navigation-preserves-context': ['browser-interaction'],
  'iconography-has-a-job': ['review'],
  'task-aware-density': ['browser-interaction'],
  'relational-spacing': ['review'],
  'task-sized-composition': ['browser-visual'],
  'deliberate-type-scale': ['static'],
  'measure-and-leading': ['browser-visual'],
  'align-for-reading': ['browser-visual'],
  'role-based-color': ['review'],
  'perceptual-color-ramps': ['static'],
  'redundant-state-signals': ['browser-interaction'],
  'multi-input-operability': ['browser-interaction'],
  'depth-explains-structure': ['browser-interaction'],
  'resilient-imagery': ['browser-visual'],
  'complete-state-model': ['browser-interaction'],
  'recoverable-actions': ['browser-interaction'],
  'motion-and-preference': ['browser-interaction'],
};

export function principleVerifyCheckId(kind: 'design' | 'ux', principleId: string, index: number): string {
  return `principle-${kind}-${principleId}-verify-${index + 1}`;
}
