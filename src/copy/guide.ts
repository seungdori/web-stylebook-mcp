import type { Lang, LocalizedText } from '../types.js';
import { COPY_PATTERNS } from './lexicon.js';
import { VOICE_PROFILES } from './voice.js';

export const COPY_GUIDE_SCHEMA = 'webstylebook.copy-guide.v1';
export const COPY_PATTERNS_SCHEMA = 'webstylebook.copy-patterns.v1';
export const COPY_GUIDE_URI = 'webstylebook://copy/guide';
export const COPY_PATTERNS_URI = 'webstylebook://copy/patterns';

/** Rules for the text people act on (2026-11-25 design-quality plan, 6.3). */
export const COPY_RULES: Readonly<Record<'button' | 'empty' | 'error' | 'loading' | 'confirm' | 'numbers' | 'register' | 'states', LocalizedText>> = {
  button: {
    en: 'A button is a verb and its object, such as "Export notes". Never a bare "OK", "Submit" or "Get started". For a destructive action, name the object and the result, such as "Delete the Planloop account".',
    ko: '버튼은 동사와 대상으로 씁니다. 예: "회의록 내보내기". "확인", "제출", "시작하기"만 쓰지 않습니다. 되돌릴 수 없는 작업은 대상과 결과를 씁니다. 예: "Planloop 계정 삭제".',
    ja: 'ボタンは対象と動詞で書きます(例:「議事録を書き出す」)。「OK」「送信」「始める」だけにはしません。取り消せない操作は対象と結果を書きます(例:「Planloop アカウントを削除」)。',
  },
  empty: {
    en: 'An empty state says what is empty, why, and offers one action. Never an illustration alone.',
    ko: '빈 상태에는 무엇이 비었는지, 왜 비었는지, 할 수 있는 행동 하나를 씁니다. 일러스트만 두지 않습니다.',
    ja: '空の状態では、何が空か、なぜ空か、できる操作をひとつ書きます。イラストだけにはしません。',
  },
  error: {
    en: 'An error says what happened and what to do, and keeps what the person typed. Never "An error occurred" alone; put an error code after the sentence.',
    ko: '오류에는 무슨 일이 있었는지와 할 일을 쓰고, 입력한 내용은 지우지 않습니다. "오류가 발생했습니다"만 쓰지 않고, 오류 코드는 문장 뒤에 둡니다.',
    ja: 'エラーでは、何が起きたかとすべきことを書き、入力内容は残します。「エラーが発生しました」だけにはせず、エラーコードは文の後に置きます。',
  },
  loading: {
    en: 'For work that takes 3 seconds or more, say what is happening, such as "Transcribing 42 minutes of audio".',
    ko: '3초 이상 걸리는 작업은 무엇을 하는지 씁니다. 예: "42분 분량의 음성을 받아 적는 중".',
    ja: '3 秒以上かかる処理では、何をしているかを書きます(例:「42 分の音声を文字起こししています」)。',
  },
  confirm: {
    en: 'A confirmation dialog names the action in its title and the result in its body, and its confirm button repeats the verb of the title.',
    ko: '확인 대화상자는 제목에 동작을, 본문에 결과를 쓰고, 확인 버튼에 제목과 같은 동사를 씁니다.',
    ja: '確認ダイアログでは、タイトルに操作、本文に結果を書き、確定ボタンにはタイトルと同じ動詞を使います。',
  },
  numbers: {
    en: 'Write numbers as digits with units. A claim about users, customers or outcomes needs its source and date next to it.',
    ko: '숫자는 단위와 함께 아라비아 숫자로 씁니다. 사용자, 고객, 성과에 대한 수치에는 출처와 날짜를 바로 옆에 씁니다.',
    ja: '数字は単位を付けて算用数字で書きます。ユーザー数・顧客数・成果についての数字には、出典と日付をすぐ隣に書きます。',
  },
  register: {
    en: "Use one register per screen. Korean: the product's register from its voice. Japanese: です・ます for product UI; a long article may use だ・である, but not on the same screen as the UI.",
    ko: '한 화면에는 존댓말 체계 하나만 씁니다. 한국어는 제품 보이스의 체계를 따릅니다. 일본어 제품 UI는 です・ます로 씁니다.',
    ja: '1 つの画面では文体をひとつにします。製品 UI は です・ます で書きます。長い記事は だ・である でもかまいませんが、UI と同じ画面には混ぜません。',
  },
  states: {
    en: 'For each UI state from get_ui_state_plan, write every mustShow item as a sentence that follows these rules.',
    ko: 'get_ui_state_plan이 주는 UI 상태마다 mustShow 항목을 이 규칙에 맞는 문장으로 씁니다.',
    ja: 'get_ui_state_plan が返す UI の状態ごとに、mustShow の各項目をこの規則に沿った文にします。',
  },
};

const NOTES = {
  verdicts: 'observation: a shape to judge against the page task and audience, never a defect by itself. fix-now: a stated fact without support, such as a user count or a percentage outcome with no source.',
  matching: 'unit patterns run on each text unit (a heading, sentence, button or label) as a Unicode regular expression; exempt is checked case-insensitively on the same unit. count patterns count occurrences across the page; mix patterns flag two registers on one page.',
};

/** webstylebook://copy/guide/{locale}: the copy rules and the voice of each product type in one language. */
export function copyGuide(locale: Lang) {
  return {
    schema: COPY_GUIDE_SCHEMA,
    locale,
    rules: Object.fromEntries(Object.entries(COPY_RULES).map(([id, text]) => [id, text[locale]])),
    voices: VOICE_PROFILES.map((voice) => ({
      productType: voice.productType,
      ...(locale === 'ko' ? { register: voice.koRegister } : {}),
      person: voice.person,
      maxWords: voice.maxWords,
      tone: voice.tone[locale],
      cta: voice.cta[locale],
      avoid: voice.avoid[locale],
      sample: { hero: voice.sample.hero[locale], empty: voice.sample.empty[locale], error: voice.sample.error[locale] },
    })),
    patternsUri: `${COPY_PATTERNS_URI}/${locale}`,
  };
}

/** webstylebook://copy/patterns/{locale}: the copy patterns that apply to pages in one language. */
export function copyPatterns(locale: Lang) {
  return {
    schema: COPY_PATTERNS_SCHEMA,
    locale,
    notes: NOTES,
    patterns: COPY_PATTERNS.filter((pattern) => pattern.locales.includes(locale)),
  };
}
