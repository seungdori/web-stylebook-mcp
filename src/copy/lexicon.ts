import type { Lang } from '../types.js';

/**
 * Copy patterns to check page text against (2026-11-25 design-quality plan, 6.1). The patterns come from the catalog
 * anti-patterns and from the 72 pages of the 2026-11-25 MCP on/off runs, where every landing page, with or without the
 * server, used the same setup-in-minutes line, team-size pricing line and stop-doing-it closing CTA.
 *
 * A shape alone is never a defect (#20): an observation is something to judge against the page's task and audience.
 * Only a stated fact without support, such as a user count or a percentage outcome with no source, is fix-now.
 */
export type CopyVerdict = 'observation' | 'fix-now';

export type CopyMatch =
  /** A regular expression tested against each text unit (a heading, sentence, button or label). */
  | { kind: 'unit'; pattern: string; flags?: 'i'; exempt?: string }
  /** Occurrences across all text units of the page, flagged above maxPerPage. */
  | { kind: 'count'; pattern: string; maxPerPage: number }
  /**
   * Two forms that should not share a page: flagged when the less used one appears at least minEach times and makes up
   * at least minShare of the sentences in either form. Units matching skip, such as quoted speech, are ignored.
   */
  | { kind: 'mix'; first: string; second: string; minEach: number; minShare: number; skip?: string };

export interface CopyPattern {
  id: string;
  locales: readonly Lang[];
  match: CopyMatch;
  verdict: CopyVerdict;
  /** Catalog anti-patterns this is an instance of. */
  antiPatternIds: readonly string[];
  why: string;
  instead: string;
  /** A flagged line and a rewrite, in the pattern's language. */
  example: { flagged: string; better: string };
}

const KO_SOURCE = '출처|기준|조사|자료:|※|\\*|†';
const EN_SOURCE = '\\bsource\\b|according to|\\bsurvey|\\bas of\\b|\\*|†';
const JA_SOURCE = '出典|調べ|調査|時点|※|\\*|†';

export const COPY_PATTERNS: readonly CopyPattern[] = [
  // Every language
  {
    id: 'em-dash-density', locales: ['en', 'ko', 'ja'],
    match: { kind: 'count', pattern: '(?<=[^\\d\\s]\\s?)—(?=\\s?\\S)|(?<=\\S\\s?)—(?=\\s?[^\\d\\s])', maxPerPage: 4 },
    verdict: 'observation', antiPatternIds: ['ai-headline-cadence'],
    why: 'Generated pages lean on em dashes to bolt a second clause or a reveal onto a sentence. In the 2026-11-25 runs 38 of 72 pages used one, and 8 used five or more.',
    instead: 'Use a full stop or a colon, or make the second clause its own sentence. Keep em dashes for real interruptions.',
    example: { flagged: 'Notes write themselves — your team just ships.', better: 'Minutely writes the notes. Your team gets the action items by 5 pm.' },
  },
  {
    id: 'new-eyebrow', locales: ['en', 'ko', 'ja'],
    match: { kind: 'unit', pattern: '^NEW\\b' },
    verdict: 'observation', antiPatternIds: ['formulaic-opening'],
    why: 'A "NEW" pill above the headline is template furniture; it appeared on 6 of the 12 Korean landing and app-promo pages without saying what changed or when.',
    instead: 'Name the change and its date in the sentence, or leave it to the changelog.',
    example: { flagged: 'NEW 회의 중에 할 일을 실시간으로 추천해 드려요', better: '11월 18일부터 회의 중에 할 일을 추천합니다' },
  },

  // Korean
  {
    id: 'ko-parallel-subject-headline', locales: ['ko'],
    match: { kind: 'unit', pattern: '^\\S+\\s?(?:은|는)\\s*\\S+(?:이|가),\\s*\\S+\\s?(?:은|는)\\s*\\S+(?:이|가)\\.?$' },
    verdict: 'observation', antiPatternIds: ['ai-headline-cadence'],
    why: 'The two-beat "A는 X가, B는 Y가" headline is a cadence, not a claim: it reads the same for any product.',
    instead: 'Say what the product does for whom, with one concrete outcome.',
    example: { flagged: '회의록은 AI가, 실행은 팀이.', better: '회의가 끝나면 담당자와 마감일이 붙은 할 일이 Slack에 올라옵니다.' },
  },
  {
    id: 'ko-buzzwords', locales: ['ko'],
    match: { kind: 'unit', pattern: '혁신적(?:인|으로)|혁신(?:하세요|합니다|하는|하고|하며|할|해\\s*보세요|해\\s*드립니다|하십시오|시키|시켜)|가속화(?:하세요|합니다|해\\s*보세요|하십시오|시키|시켜)|(?:성장|비즈니스|업무|매출|혁신|전환|도입|생산성)(?:을|를|의)?\\s*가속화|획기적(?:인|으로)|차원이\\s*다른|새로운\\s*(?:경험|차원|기준|패러다임)|쉽고\\s*빠르게|올인원|스마트(?:한|하게)|최적의\\s*(?:경험|솔루션|선택|방법|환경)|한\\s*단계\\s*(?:더\\s*)?(?:끌어올|높여|높이|업그레이드|도약)|(?:맞춤형|통합|토털|차세대)\\s*솔루션|솔루션으로|압도적(?:인|으로)|극대화|패러다임|게임\\s*체인저|놀라운\\s*(?:경험|변화|성과|결과)|완벽한\\s*(?:솔루션|경험|파트너|선택)' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'Words such as 혁신적인, 혁신하세요, 가속화하세요, 솔루션으로 and 한 단계 끌어올리세요 promise a feeling instead of a result and fit any product. Plain uses (솔루션 엔지니어, 한 단계 작은 목표, 스마트폰, 혁신 사례, 하드웨어 가속) do not match.',
    instead: 'Say what the user can do now that they could not, with one concrete outcome.',
    example: { flagged: '혁신적인 솔루션으로 비즈니스를 한 단계 끌어올리세요', better: '화요일 오후 3시 미팅이 끝나면, 할 일과 담당자가 붙은 요약을 슬랙으로 보냅니다.' },
  },
  {
    id: 'ko-setup-minutes', locales: ['ko'],
    match: { kind: 'unit', pattern: '(?:설정|세팅|연결)(?:은|는|하는\\s*데)?\\s*\\d+\\s*분|(?:설정|세팅|연결|설치|가입)[^.]{0,20}\\d+\\s*분이면|\\d+\\s*분이면\\s*(?:설정|연결|설치)\\s*(?:이\\s*)?(?:끝|완료)' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'A setup-in-N-minutes line was on all six Korean landing pages, with and without the server. It promises speed without saying what the setup is.',
    instead: 'Name the steps and what they need, for example which account to connect and what permission it asks for.',
    example: { flagged: '설정은 5분, 그다음은 자동입니다', better: 'Google 캘린더를 연결하면 초대된 회의에 Minutely가 자동으로 참석합니다.' },
  },
  {
    id: 'ko-stop-doing-closer', locales: ['ko'],
    match: { kind: 'unit', pattern: '^다음\\s*\\S+\\s*부터(?:는)?,?\\s+.{1,30}(?:세요|않아도\\s*됩니다|그만)\\.?$|\\S+기는\\s*그만(?:\\.|$)|\\S+는\\s*일은\\s*끝\\.?$' },
    verdict: 'observation', antiPatternIds: ['formulaic-opening'],
    why: 'A closing CTA that tells the reader to stop doing the chore from next time ("다음 회의부터는 받아 적지 마세요") was on 5 of the 6 Korean landing pages in the runs.',
    instead: 'End with the next concrete step and what happens after it.',
    example: { flagged: '다음 회의부터는 받아 적지 마세요.', better: '캘린더를 연결하면 다음 회의의 요약을 회의 종료 2분 뒤에 받습니다.' },
  },
  {
    id: 'ko-team-size-pricing', locales: ['ko'],
    match: { kind: 'unit', pattern: '(?:팀|회사|조직|비즈니스)\\s*규모에\\s*맞(?:게|춰)' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: '"팀 규모에 맞게" headed the pricing section of all six Korean landing pages; it fits any product.',
    instead: 'Say what separates the plans, for example the seat count or the feature that only the paid plan has.',
    example: { flagged: '팀 규모에 맞게 시작하세요', better: '5명까지는 무료, 그 이상은 1인당 월 9,000원입니다.' },
  },
  {
    id: 'ko-one-place', locales: ['ko'],
    match: { kind: 'unit', pattern: '한\\s?곳에서|(?:모든\\s*것을|모두)\\s*하나로|하나로\\s*(?:모아|관리)' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: '"한곳에서 관리하세요" fits every settings page and dashboard, so it says nothing about this one.',
    instead: 'Name the one or two things people come here to change.',
    example: { flagged: '프로필, 알림, 보안과 결제 정보를 한곳에서 관리하세요.', better: '알림 시간과 결제 카드를 바꿀 수 있습니다.' },
  },
  {
    id: 'ko-generic-cta', locales: ['ko'],
    match: { kind: 'unit', pattern: '^(?:지금\\s*)?(?:무료로\\s*)?(?:시작하기|시작하세요|시작)\\s*[→›]?$|^(?:더\\s*알아보기|자세히\\s*보기|확인|제출)\\s*[→›]?$' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'A button that says only "시작하기" or "확인" does not say what happens. "무료로 시작" was on 21 of the 72 pages.',
    instead: 'Use a verb and its object: what the click does to what.',
    example: { flagged: '무료로 시작하기', better: '캘린더 연결하고 무료로 쓰기' },
  },
  {
    id: 'ko-social-proof-count', locales: ['ko'],
    match: { kind: 'unit', pattern: '(?:\\d{1,3}(?:,\\d{3})+|\\d{3,})\\s*(?:여\\s*)?(?:개\\s*)?(?:이상의?\\s*)?(?:팀|기업|회사|고객사?|곳)(?:이|가|에서)\\s|(?:\\d{1,3}(?:,\\d{3})+|\\d{3,})\\s*명의\\s*\\S+(?:이|가)\\s*(?:구독|사용|이용|선택)|\\d[\\d,]*\\s*\\+\\s*(?:\\S+\\s*){0,2}?(?:팀|기업|회사|고객|명|개)', exempt: KO_SOURCE },
    verdict: 'fix-now', antiPatternIds: ['fake-content', 'unsupported-claim-as-established'],
    why: 'A user or customer count with no source is invented social proof on a generated page. All six Korean landing pages in the runs claimed one, such as "2,400개 팀이 매주".',
    instead: 'Use a count you can cite, with its date and source, or leave it out.',
    example: { flagged: '3,200+ 사용 중인 팀', better: '2026년 10월 기준 유료 팀 312곳 (내부 집계)' },
  },
  {
    id: 'ko-percent-outcome', locales: ['ko'],
    match: { kind: 'unit', pattern: '[−–-]\\s*\\d+(?:\\.\\d+)?\\s*%p?\\s*(?:\\S+\\s*){0,3}?(?:시간|비용|작업|문의|오류|이탈|감소)|\\d+(?:\\.\\d+)?\\s*%\\s*(?:\\S+\\s*){0,4}?(?:감소|단축|절약|줄었|줄입|향상|개선)', exempt: KO_SOURCE },
    verdict: 'fix-now', antiPatternIds: ['fake-content', 'unsupported-claim-as-established'],
    why: 'A percentage outcome with no source, such as "−87% 회의록 정리 시간", states a result nobody measured.',
    instead: 'Give the measured figure with what, when and how it was measured, or describe the change without a number.',
    example: { flagged: '−87% 회의록 정리 시간', better: '베타 팀 12곳에서 회의록 정리 시간이 평균 38분에서 5분으로 줄었습니다 (2026년 9월).' },
  },
  {
    id: 'ko-mixed-register', locales: ['ko'],
    match: { kind: 'mix', first: '니다[.!?]?$', second: '(?:(?<![세필중주나까]|아니)요|죠)[.!]?$', minEach: 3, minShare: 0.2, skip: '^[“"「]' },
    verdict: 'observation', antiPatternIds: [],
    why: 'One screen should use one register. Statements in 합니다체 next to statements in 해요체 read as two writers. Quoted speech, questions and "-세요" requests are not counted, because they fit either register.',
    instead: "Pick the register from the product's voice and rewrite the other sentences in it.",
    example: { flagged: '요약을 Slack으로 보내 드립니다. 회의록 쓰는 사람은 이제 필요 없어요.', better: '요약을 Slack으로 보내 드립니다. 회의록을 따로 쓰지 않아도 됩니다.' },
  },

  // English
  {
    id: 'en-buzzwords', locales: ['en'],
    match: { kind: 'unit', pattern: '\\b(?:supercharge[sd]?|seamless(?:ly)?|unlock(?:s|ed)?|all-in-one|effortless(?:ly)?|revolutioni[sz]e[sd]?|game[- ]chang(?:er|ing))\\b|\\bbuilt for (\\w+(?: \\w+)?), by \\1\\b', flags: 'i' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'These words promise a feeling instead of a result and fit any product.',
    instead: 'Say what the user can do now that they could not, in their words.',
    example: { flagged: 'Supercharge your meetings with seamless AI notes.', better: 'Get the decisions and owners from every meeting in Slack, two minutes after it ends.' },
  },
  {
    id: 'en-setup-minutes', locales: ['en'],
    match: { kind: 'unit', pattern: '\\b(?:set ?up|get started|up and running|live)\\s+in\\s+(?:\\d+|a few|under \\d+)\\s*(?:minutes?|mins?)\\b', flags: 'i' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'Setup-in-minutes promises speed without saying what the setup is.',
    instead: 'Name the steps and what they need.',
    example: { flagged: 'Set up in 5 minutes. Then it runs itself.', better: 'Connect Google Calendar and Minutely joins the meetings you are invited to.' },
  },
  {
    id: 'en-one-place', locales: ['en'],
    match: { kind: 'unit', pattern: '\\b(?:all )?in one place\\b|\\beverything you need\\b|\\bone platform\\b', flags: 'i' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: '"Everything in one place" fits every product page.',
    instead: 'Name the one or two jobs this page or product does.',
    example: { flagged: 'Manage everything in one place.', better: 'Change your notification hours and payment card.' },
  },
  {
    id: 'en-generic-cta', locales: ['en'],
    match: { kind: 'unit', pattern: '^(?:get started|start(?: for)? free|start now|learn more|try (?:it )?(?:for )?free|sign up|submit|ok|confirm)\\s*[→›]?$', flags: 'i' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'A button that says only "Get started" or "Submit" does not say what happens.',
    instead: 'Use a verb and its object.',
    example: { flagged: 'Get started', better: 'Connect your calendar' },
  },
  {
    id: 'en-social-proof-count', locales: ['en'],
    match: { kind: 'unit', pattern: '\\b(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?[km]|\\d{3,})\\+?\\s+(?:teams|companies|customers|users|businesses|developers)\\b|\\b\\d+\\+\\s+(?:teams|companies|customers|users|businesses|developers)\\b', flags: 'i', exempt: EN_SOURCE },
    verdict: 'fix-now', antiPatternIds: ['fake-content', 'unsupported-claim-as-established'],
    why: 'A user or customer count with no source is invented social proof on a generated page.',
    instead: 'Use a count you can cite, with its date and source, or leave it out.',
    example: { flagged: 'Trusted by 10,000+ teams', better: '312 paying teams as of October 2026 (internal count)' },
  },
  {
    id: 'en-percent-outcome', locales: ['en'],
    match: { kind: 'unit', pattern: '[−–-]\\d+(?:\\.\\d+)?%|\\b\\d+(?:\\.\\d+)?%\\s+(?:\\w+\\s+){0,3}?(?:faster|less|fewer|saved|reduction|increase|decrease|more productive)\\b|\\b(?:save|cut|reduce|boost)\\w*\\s+(?:\\w+\\s+){0,3}?(?:by\\s+)?\\d+(?:\\.\\d+)?%', flags: 'i', exempt: EN_SOURCE },
    verdict: 'fix-now', antiPatternIds: ['fake-content', 'unsupported-claim-as-established'],
    why: 'A percentage outcome with no source states a result nobody measured.',
    instead: 'Give the measured figure with what, when and how it was measured, or describe the change without a number.',
    example: { flagged: 'Save 40% of your meeting time.', better: 'Beta teams spent 5 minutes on notes instead of 38 (September 2026, 12 teams).' },
  },

  // Japanese
  {
    id: 'ja-buzzwords', locales: ['ja'],
    match: { kind: 'unit', pattern: 'もっと\\s*スマートに|スマートに(?:しよう|します|変える)' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: '「〜をもっとスマートに」 promises a feeling instead of a result and fits any product.',
    instead: 'Say what the user can do now, with one concrete outcome.',
    example: { flagged: '会議をもっとスマートに。', better: '会議が終わると、担当者と期限つきのタスクが Slack に届きます。' },
  },
  {
    id: 'ja-one-place', locales: ['ja'],
    match: { kind: 'unit', pattern: 'すべて(?:を|が)\\s*(?:一つ|ひとつ)に|オールインワン|一[か箇ヶ]所で|ひとつの場所で' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: '「すべてを一つに」 fits every product page.',
    instead: 'Name the one or two jobs this page or product does.',
    example: { flagged: 'プロフィールも通知も、すべてを一つに。', better: '通知の時間と支払いカードを変更できます。' },
  },
  {
    id: 'ja-setup-minutes', locales: ['ja'],
    match: { kind: 'unit', pattern: '\\d+\\s*分で(?:設定|導入|完了|始め)|設定は\\s*\\d+\\s*分' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'Setup-in-minutes promises speed without saying what the setup is.',
    instead: 'Name the steps and what they need.',
    example: { flagged: '5分で設定完了。あとは自動です。', better: 'Google カレンダーを連携すると、招待された会議に Minutely が参加します。' },
  },
  {
    id: 'ja-generic-cta', locales: ['ja'],
    match: { kind: 'unit', pattern: '^(?:今すぐ)?(?:無料で)?(?:始める|はじめる|始めましょう|スタート)\\s*[→›]?$|^(?:詳しく見る|もっと見る|詳細はこちら|送信|確認|OK)\\s*[→›]?$' },
    verdict: 'observation', antiPatternIds: ['abstract-consultancy-copy'],
    why: 'A button that says only 「始める」 or 「送信」 does not say what happens.',
    instead: 'Use an object and a verb: what the click does to what.',
    example: { flagged: '無料で始める', better: 'カレンダーを連携して無料で使う' },
  },
  {
    id: 'ja-social-proof-count', locales: ['ja'],
    match: { kind: 'unit', pattern: '(?:\\d{1,3}(?:,\\d{3})+|\\d{3,}|\\d+(?:\\.\\d+)?万)\\s*\\+?\\s*(?:社|チーム|人|名|ユーザー)|\\d+\\s*\\+\\s*(?:社|チーム|人|名)', exempt: JA_SOURCE },
    verdict: 'fix-now', antiPatternIds: ['fake-content', 'unsupported-claim-as-established'],
    why: 'A user or customer count with no source is invented social proof on a generated page.',
    instead: 'Use a count you can cite, with its date and source, or leave it out.',
    example: { flagged: '3,000社以上が導入', better: '2026年10月時点で有料プラン 312 社(社内集計)' },
  },
  {
    id: 'ja-percent-outcome', locales: ['ja'],
    match: { kind: 'unit', pattern: '[−–-]\\s*\\d+(?:\\.\\d+)?\\s*%|\\d+(?:\\.\\d+)?\\s*%\\s*(?:の)?\\S{0,8}?(?:削減|短縮|向上|改善|アップ|減)', exempt: JA_SOURCE },
    verdict: 'fix-now', antiPatternIds: ['fake-content', 'unsupported-claim-as-established'],
    why: 'A percentage outcome with no source states a result nobody measured.',
    instead: 'Give the measured figure with what, when and how it was measured, or describe the change without a number.',
    example: { flagged: '議事録作成時間を87%削減', better: 'ベータ版の12チームで、議事録の作成時間が平均38分から5分になりました(2026年9月)。' },
  },
  {
    id: 'ja-mixed-register', locales: ['ja'],
    match: { kind: 'mix', first: '(?:です|ます|でした|ました|ません)[。！？!?]?$', second: '(?:だ|である|だった|ない|する)[。！？!?]?$', minEach: 3, minShare: 0.2, skip: '^[「『“"]' },
    verdict: 'observation', antiPatternIds: [],
    why: 'One screen should use one register. です・ます sentences next to だ・である sentences read as two writers. Quoted speech is skipped.',
    instead: "Pick the register from the product's voice and rewrite the other sentences in it.",
    example: { flagged: '要約を Slack に送ります。議事録を書く人はもういらない。', better: '要約を Slack に送ります。議事録を別に書く必要はありません。' },
  },
];

export interface CopyHit {
  patternId: string;
  verdict: CopyVerdict;
  /** The text unit that matched; for count and mix patterns, the units that carry the occurrences. */
  units: string[];
  count?: number;
}

/** A text unit and where it sits: a selector path for page markup, a line number for plain text. */
export interface CopyUnit { text: string; where: string }

export interface LocatedCopyHit {
  patternId: string;
  verdict: CopyVerdict;
  kind: CopyMatch['kind'];
  /** Matching units for a unit pattern; occurrences for a count pattern; sentences in either register for a mix. */
  count: number;
  matches: Array<{ where: string; text: string; match: string }>;
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const SENTENCE = /(?<=[.!?。！？])\s*/u;

/** Every pattern of one language that the units show, with where each match is, in pattern order. */
export function locateCopyPatterns(units: readonly CopyUnit[], locale: Lang): LocatedCopyHit[] {
  const texts = units.map((unit) => ({ ...unit, text: normalize(unit.text) })).filter((unit) => unit.text);
  const hits: LocatedCopyHit[] = [];
  for (const entry of COPY_PATTERNS) {
    if (!entry.locales.includes(locale)) continue;
    const { match } = entry;
    const base = { patternId: entry.id, verdict: entry.verdict, kind: match.kind };
    if (match.kind === 'unit') {
      const re = new RegExp(match.pattern, `u${match.flags ?? ''}`);
      const exempt = match.exempt ? new RegExp(match.exempt, 'iu') : undefined;
      const matches = texts.flatMap((unit) => {
        const found = re.exec(unit.text);
        return found && !exempt?.test(unit.text) ? [{ where: unit.where, text: unit.text, match: found[0] }] : [];
      });
      if (matches.length) hits.push({ ...base, count: matches.length, matches });
    } else if (match.kind === 'count') {
      const re = new RegExp(match.pattern, 'gu');
      const matches = texts.flatMap((unit) => [...unit.text.matchAll(re)].map((found) => ({ where: unit.where, text: unit.text, match: found[0] })));
      if (matches.length > match.maxPerPage) hits.push({ ...base, count: matches.length, matches });
    } else {
      const skip = match.skip ? new RegExp(match.skip, 'u') : undefined;
      const sentences = texts.flatMap((unit) => (skip?.test(unit.text) ? [] : unit.text.split(SENTENCE).filter(Boolean).map((text) => ({ where: unit.where, text }))));
      const first = sentences.filter((sentence) => new RegExp(match.first, 'u').test(sentence.text));
      const second = sentences.filter((sentence) => new RegExp(match.second, 'u').test(sentence.text));
      const minority = Math.min(first.length, second.length);
      if (minority >= match.minEach && minority / (first.length + second.length) >= match.minShare) {
        // The less used register is what to rewrite, so its sentences come first.
        const [few, many] = first.length <= second.length ? [first, second] : [second, first];
        hits.push({ ...base, count: first.length + second.length, matches: [...few, ...many].map((sentence) => ({ ...sentence, match: sentence.text })) });
      }
    }
  }
  return hits;
}

/** Check page text, split into units (headings, sentences, buttons, labels), against the patterns for one language. */
export function findCopyPatterns(units: readonly string[], locale: Lang): CopyHit[] {
  return locateCopyPatterns(units.map((text, index) => ({ text, where: String(index) })), locale).flatMap((hit) => (hit.kind === 'unit'
    ? hit.matches.map((found) => ({ patternId: hit.patternId, verdict: hit.verdict, units: [found.text] }))
    : [{ patternId: hit.patternId, verdict: hit.verdict, units: [...new Set(hit.matches.map((found) => found.text))], count: hit.count }]));
}
