import type { LocalizedText, ProductType } from '../types.js';

/**
 * A writing voice for each catalog product type (2026-11-25 design-quality plan, 6.2). In the 2026-11-25 runs the copy
 * was the same with and without the server: the server gave no voice, so every landing page used the same lines.
 * Samples follow the button, empty-state and error rules in guide.ts and must not trigger a pattern in lexicon.ts.
 */
export interface VoiceProfile {
  productType: Exclude<ProductType, 'other'>;
  /** Korean register for the whole screen; Japanese product UI uses です・ます (see the register rule in guide.ts). */
  koRegister: '합니다체' | '해요체';
  /** Who the copy speaks as or to. */
  person: 'we' | 'you' | 'i' | 'none';
  /** Longest sentence: English words, Korean eojeol. */
  maxWords: number;
  tone: LocalizedText;
  /** A primary button in this voice: a verb and its object. */
  cta: LocalizedText;
  avoid: LocalizedText;
  sample: { hero: LocalizedText; empty: LocalizedText; error: LocalizedText };
}

export const VOICE_PROFILES: readonly VoiceProfile[] = [
  {
    productType: 'operational-saas', koRegister: '합니다체', person: 'you', maxWords: 15,
    tone: { en: 'Plain and specific: name the record, the person and the next step.', ko: '담백하고 구체적으로 씁니다. 기록, 담당자, 다음 할 일을 이름으로 부릅니다.', ja: '簡潔かつ具体的に書きます。記録・担当者・次の作業を名前で呼びます。' },
    cta: { en: 'Assign the ticket', ko: '티켓 배정하기', ja: 'チケットを割り当てる' },
    avoid: { en: 'Hype, exclamation marks and vague promises about productivity.', ko: '과장, 느낌표, 생산성에 대한 막연한 약속은 쓰지 않습니다.', ja: '誇張、感嘆符、生産性についての曖昧な約束は使いません。' },
    sample: {
      hero: { en: 'See which orders are late and who is handling each one.', ko: '늦어지는 주문과 각 주문의 담당자를 바로 확인합니다.', ja: '遅れている注文と、それぞれの担当者をすぐに確認できます。' },
      empty: { en: 'No open tickets. Connect the support inbox and new tickets appear here.', ko: '열린 티켓이 없습니다. 지원 메일함을 연결하면 새 티켓이 여기에 표시됩니다.', ja: '対応中のチケットはありません。サポート受信箱を連携すると、新しいチケットがここに表示されます。' },
      error: { en: 'The assignment was not saved because the connection dropped. Your changes are kept; save again.', ko: '연결이 끊겨 배정을 저장하지 못했습니다. 입력한 내용은 그대로 있으니 다시 저장하세요.', ja: '接続が切れたため、割り当てを保存できませんでした。入力内容は残っています。もう一度保存してください。' },
    },
  },
  {
    productType: 'developer-tool', koRegister: '합니다체', person: 'you', maxWords: 20,
    tone: { en: 'Exact and terse: commands, versions and limits, no marketing adjectives.', ko: '정확하고 짧게 씁니다. 명령어, 버전, 제한을 적고 마케팅 형용사는 쓰지 않습니다.', ja: '正確かつ簡潔に書きます。コマンド・バージョン・制限を書き、宣伝用の形容詞は使いません。' },
    cta: { en: 'Copy the install command', ko: '설치 명령 복사', ja: 'インストールコマンドをコピー' },
    avoid: { en: 'Speed claims without a benchmark, and jokes in error messages.', ko: '벤치마크 없는 속도 주장과 오류 메시지 속 농담은 쓰지 않습니다.', ja: 'ベンチマークのない速度の主張や、エラーメッセージでの冗談は使いません。' },
    sample: {
      hero: { en: 'A typed HTTP client for Node 18 and the browser, 6 KB gzipped.', ko: 'Node 18과 브라우저에서 쓰는 타입 안전 HTTP 클라이언트입니다. gzip 기준 6 KB입니다.', ja: 'Node 18 とブラウザで使える型安全な HTTP クライアントです。gzip で 6 KB です。' },
      empty: { en: 'No API keys yet. Create a key to call the API from your server.', ko: 'API 키가 없습니다. 서버에서 API를 호출하려면 키를 만드세요.', ja: 'API キーはまだありません。サーバーから API を呼び出すには、キーを作成してください。' },
      error: { en: 'Build failed: TS2345 in src/client.ts, line 42. Fix the type and run the build again.', ko: 'src/client.ts 42행에서 TS2345 오류로 빌드하지 못했습니다. 타입을 고친 뒤 다시 빌드하세요.', ja: 'src/client.ts の 42 行目の TS2345 でビルドに失敗しました。型を直してから、もう一度ビルドしてください。' },
    },
  },
  {
    productType: 'documentation', koRegister: '합니다체', person: 'you', maxWords: 20,
    tone: { en: 'Instructional: one task per section, steps in order, results stated.', ko: '안내문처럼 씁니다. 절마다 작업 하나, 순서대로 된 단계, 결과를 적습니다.', ja: '手順書として書きます。節ごとに作業ひとつ、順番どおりの手順、結果を書きます。' },
    cta: { en: 'Read the quick start', ko: '빠른 시작 읽기', ja: 'クイックスタートを読む' },
    avoid: { en: 'Marketing claims, and terms not explained where they first appear.', ko: '마케팅 주장과, 처음 나올 때 풀어 쓰지 않은 용어는 쓰지 않습니다.', ja: '宣伝の主張や、初出で説明しない用語は使いません。' },
    sample: {
      hero: { en: 'Install fetchkit, send your first request and handle errors.', ko: 'fetchkit을 설치하고, 첫 요청을 보내고, 오류를 처리합니다.', ja: 'fetchkit をインストールし、最初のリクエストを送り、エラーを処理します。' },
      empty: { en: 'No results for "retry". Check the spelling or search the API reference.', ko: 'retry 검색 결과가 없습니다. 철자를 확인하거나 API 레퍼런스에서 검색하세요.', ja: 'retry の検索結果はありません。綴りを確認するか、API リファレンスで検索してください。' },
      error: { en: 'This page moved to /guides/errors. Update your bookmark.', ko: '이 페이지는 /guides/errors로 옮겼습니다. 북마크를 바꾸세요.', ja: 'このページは /guides/errors に移動しました。ブックマークを更新してください。' },
    },
  },
  {
    productType: 'data-analytics', koRegister: '합니다체', person: 'none', maxWords: 15,
    tone: { en: 'Neutral and precise: units, periods and comparisons stated, no adjectives on numbers.', ko: '중립적이고 정확하게 씁니다. 단위, 기간, 비교 기준을 적고 숫자에 형용사를 붙이지 않습니다.', ja: '中立かつ正確に書きます。単位・期間・比較の基準を書き、数字に形容詞を付けません。' },
    cta: { en: 'Export as CSV', ko: 'CSV로 내보내기', ja: 'CSV で書き出す' },
    avoid: { en: 'Words such as "skyrocketing" or "dramatic", and charts without a period.', ko: '급등, 폭발적 같은 말과 기간이 없는 차트는 쓰지 않습니다.', ja: '急上昇・劇的といった言葉や、期間のないグラフは使いません。' },
    sample: {
      hero: { en: 'Revenue by channel for the last 30 days, compared with the 30 days before.', ko: '지난 30일 채널별 매출을 직전 30일과 비교합니다.', ja: '過去 30 日のチャネル別売上を、その前の 30 日と比較します。' },
      empty: { en: 'No data for this period. Events appear about 15 minutes after they are sent; pick a wider date range.', ko: '이 기간에는 데이터가 없습니다. 이벤트는 보낸 뒤 약 15분 후에 표시되니 기간을 넓혀 보세요.', ja: 'この期間のデータはありません。イベントは送信から約 15 分後に表示されます。期間を広げてください。' },
      error: { en: 'The query did not finish within 30 seconds. Narrow the date range or remove a breakdown, then run it again.', ko: '쿼리가 30초 안에 끝나지 않았습니다. 기간을 줄이거나 분류 하나를 빼고 다시 실행하세요.', ja: 'クエリが 30 秒以内に終わりませんでした。期間を狭めるか内訳をひとつ外して、もう一度実行してください。' },
    },
  },
  {
    productType: 'security-console', koRegister: '합니다체', person: 'none', maxWords: 15,
    tone: { en: 'Calm and exact: severity, affected asset and the action, in that order.', ko: '차분하고 정확하게 씁니다. 심각도, 영향받는 자산, 조치를 이 순서로 적습니다.', ja: '落ち着いて正確に書きます。深刻度・影響を受ける資産・対応をこの順に書きます。' },
    cta: { en: 'Revoke the key', ko: '키 폐기하기', ja: 'キーを無効にする' },
    avoid: { en: 'Alarmist words, fear and blame; never hide the severity.', ko: '불안을 키우는 말, 공포, 비난은 쓰지 않고 심각도를 숨기지 않습니다.', ja: '不安をあおる言葉・恐怖・非難は使わず、深刻度を隠しません。' },
    sample: {
      hero: { en: '3 critical findings on 2 production hosts. Review them before the Friday release.', ko: '운영 호스트 2대에서 심각 등급 결과 3건이 나왔습니다. 금요일 배포 전에 확인하세요.', ja: '本番ホスト 2 台で重大な検出結果が 3 件あります。金曜日のリリース前に確認してください。' },
      empty: { en: 'No open alerts. Alerts from connected sources appear here within a minute.', ko: '열린 경보가 없습니다. 연결된 소스의 경보는 1분 안에 여기에 표시됩니다.', ja: '未対応のアラートはありません。接続済みのソースからのアラートは 1 分以内にここに表示されます。' },
      error: { en: 'The scan stopped at 62% because the agent on db-02 is offline. Restart the agent and the scan resumes where it stopped.', ko: 'db-02의 에이전트가 오프라인이라 검사가 62%에서 멈췄습니다. 에이전트를 다시 시작하면 멈춘 곳부터 이어서 검사합니다.', ja: 'db-02 のエージェントがオフラインのため、スキャンが 62% で止まりました。エージェントを再起動すると、止まった位置から再開します。' },
    },
  },
  {
    productType: 'finance-admin', koRegister: '합니다체', person: 'none', maxWords: 15,
    tone: { en: 'Formal and exact: amounts with currency, dates, and what is final or pending.', ko: '격식 있고 정확하게 씁니다. 금액에는 통화를 붙이고, 날짜와 확정·대기 여부를 적습니다.', ja: '改まった調子で正確に書きます。金額には通貨を付け、日付と確定・保留の別を書きます。' },
    cta: { en: 'Approve 12 invoices', ko: '청구서 12건 승인', ja: '請求書 12 件を承認' },
    avoid: { en: 'Unannounced rounding, a casual tone, and buttons that hide the amount.', ko: '알리지 않은 반올림, 가벼운 말투, 금액을 감추는 버튼은 쓰지 않습니다.', ja: '断りのない四捨五入、くだけた口調、金額を隠すボタンは使いません。' },
    sample: {
      hero: { en: '$36,400 due this week across 12 invoices; 3 need your approval.', ko: '이번 주 지급 예정 금액은 ₩48,200,000입니다. 청구서 12건 중 3건은 승인이 필요합니다.', ja: '今週の支払予定は ¥5,400,000 です。請求書 12 件のうち 3 件は承認が必要です。' },
      empty: { en: 'No invoices are waiting for approval. Invoices you are asked to approve appear here.', ko: '승인을 기다리는 청구서가 없습니다. 승인을 요청받은 청구서가 여기에 표시됩니다.', ja: '承認待ちの請求書はありません。承認を依頼された請求書がここに表示されます。' },
      error: { en: 'The payment was not sent: the account number failed the bank check. Correct it; the other fields are kept.', ko: '계좌번호가 은행 확인을 통과하지 못해 송금하지 못했습니다. 계좌번호를 고치세요. 나머지 입력은 그대로 있습니다.', ja: '口座番号が銀行の確認を通らなかったため、送金できませんでした。口座番号を直してください。ほかの入力内容は残っています。' },
    },
  },
  {
    productType: 'healthcare-portal', koRegister: '합니다체', person: 'you', maxWords: 15,
    tone: { en: 'Plain, warm and direct: short sentences, no jargon, and always the next step.', ko: '쉽고 따뜻하고 분명하게 씁니다. 짧은 문장으로, 전문 용어 없이, 다음 할 일을 늘 적습니다.', ja: 'わかりやすく、温かく、はっきり書きます。短い文で専門用語を使わず、次にすることを必ず書きます。' },
    cta: { en: 'Book an appointment', ko: '진료 예약하기', ja: '診察を予約する' },
    avoid: { en: 'Jokes, exaggeration, fear, and medical terms without an explanation.', ko: '농담, 과장, 두려움을 주는 말, 설명 없는 의학 용어는 쓰지 않습니다.', ja: '冗談・誇張・恐怖をあおる言葉、説明のない医学用語は使いません。' },
    sample: {
      hero: { en: 'See your test results, book a visit and message your care team.', ko: '검사 결과를 보고, 진료를 예약하고, 담당 의료진에게 메시지를 보냅니다.', ja: '検査結果の確認、診察の予約、担当医療チームへのメッセージができます。' },
      empty: { en: 'No upcoming appointments. When you book a visit, its address and time appear here.', ko: '예정된 진료가 없습니다. 진료를 예약하면 주소와 시간이 여기에 표시됩니다.', ja: '予定されている診察はありません。予約すると、住所と時間がここに表示されます。' },
      error: { en: 'This time was just taken, so it was not booked. Your details are kept; choose another time.', ko: '방금 다른 분이 예약해서 이 시간은 예약하지 못했습니다. 입력한 정보는 그대로 있으니 다른 시간을 고르세요.', ja: 'この時間は直前にほかの方が予約したため、予約できませんでした。入力内容は残っています。別の時間を選んでください。' },
    },
  },
  {
    productType: 'commerce', koRegister: '해요체', person: 'you', maxWords: 15,
    tone: { en: 'Concrete and friendly: size, material, price and delivery date before adjectives.', ko: '구체적이고 친근하게 써요. 형용사보다 크기, 소재, 가격, 배송일을 먼저 써요.', ja: '具体的に、親しみやすく書きます。形容詞より先に、サイズ・素材・価格・お届け日を書きます。' },
    cta: { en: 'Add to cart', ko: '장바구니에 담기', ja: 'カートに入れる' },
    avoid: { en: 'Fake urgency such as countdowns that restart, and superlatives without proof.', ko: '다시 시작되는 카운트다운 같은 가짜 긴급함과 근거 없는 최상급 표현은 쓰지 않아요.', ja: 'リセットされるカウントダウンのような偽の緊急性や、根拠のない最上級表現は使いません。' },
    sample: {
      hero: { en: 'A 600 W cordless hand blender that charges over USB-C in 2 hours.', ko: 'USB-C로 2시간 만에 충전되는 600 W 무선 핸드 블렌더예요.', ja: 'USB-C で 2 時間で充電できる、600 W のコードレスハンドブレンダーです。' },
      empty: { en: 'Your cart is empty. Items you add stay here for 30 days.', ko: '장바구니가 비어 있어요. 담은 상품은 30일 동안 여기에 남아 있어요.', ja: 'カートは空です。入れた商品は 30 日間ここに保存されます。' },
      error: { en: 'Your card was declined and nothing was charged. Try another card or pay by bank transfer.', ko: '카드 결제가 거절됐어요. 결제된 금액은 없으니 다른 카드나 계좌이체로 결제해 주세요.', ja: 'カードが承認されませんでした。請求は発生していません。別のカードか銀行振込でお支払いください。' },
    },
  },
  {
    productType: 'ai-chat', koRegister: '해요체', person: 'you', maxWords: 20,
    tone: { en: 'Direct and modest: say what the assistant can and cannot do, and where an answer comes from.', ko: '솔직하고 겸손하게 써요. 할 수 있는 일과 없는 일, 답의 출처를 밝혀요.', ja: '率直に、控えめに書きます。できること・できないこと、回答の出典を示します。' },
    cta: { en: 'Ask about your documents', ko: '내 문서에 대해 질문하기', ja: '自分の文書について質問する' },
    avoid: { en: 'Claims that the assistant understands everything or is always right, and human feelings.', ko: '어시스턴트가 다 이해한다거나 늘 맞다는 주장, 사람 같은 감정 표현은 쓰지 않아요.', ja: 'アシスタントがすべてを理解している、常に正しいといった主張や、人間のような感情表現は使いません。' },
    sample: {
      hero: { en: "Ask about your team's policies and get answers with the page they come from.", ko: '팀 규정에 대해 물으면 근거가 된 문서 페이지와 함께 답해요.', ja: 'チームの規程について質問すると、根拠となる文書のページと一緒に回答します。' },
      empty: { en: 'No conversations yet. Upload a document or type a question to start.', ko: '아직 대화가 없어요. 문서를 올리거나 질문을 입력해 보세요.', ja: 'まだ会話はありません。文書をアップロードするか、質問を入力してください。' },
      error: { en: 'The answer stopped because the connection dropped. Your question is kept; send it again.', ko: '연결이 끊겨 답변이 중간에 멈췄어요. 질문은 그대로 있으니 다시 보내 주세요.', ja: '接続が切れたため、回答が途中で止まりました。質問は残っています。もう一度送信してください。' },
    },
  },
  {
    productType: 'content-editorial', koRegister: '합니다체', person: 'we', maxWords: 25,
    tone: { en: 'Voiced and exact: a point of view, specific detail, and a source for every fact.', ko: '관점을 갖고 정확하게 씁니다. 구체적인 사실을 쓰고, 사실마다 출처를 답니다.', ja: '視点を持ち、正確に書きます。具体的な事実を書き、事実には出典を付けます。' },
    cta: { en: 'Read the full article', ko: '기사 전체 읽기', ja: '記事を最後まで読む' },
    avoid: { en: 'Clickbait headlines, list padding and quotes without a speaker.', ko: '낚시성 제목, 분량을 채우는 목록, 말한 사람이 없는 인용은 쓰지 않습니다.', ja: '釣り見出し、水増しのための箇条書き、発言者のない引用は使いません。' },
    sample: {
      hero: { en: 'Why our order API slowed to 1.4 seconds, and the five index fixes that brought it back to 80 ms.', ko: '주문 API가 1.4초까지 느려진 이유와, 80ms로 되돌린 인덱스 수정 다섯 가지를 정리했습니다.', ja: '注文 API が 1.4 秒まで遅くなった理由と、80 ms に戻した 5 つのインデックス修正をまとめました。' },
      empty: { en: 'No saved articles. Save an article to read it later, also offline.', ko: '저장한 글이 없습니다. 글을 저장하면 나중에 오프라인에서도 읽을 수 있습니다.', ja: '保存した記事はありません。記事を保存すると、あとでオフラインでも読めます。' },
      error: { en: 'This article could not load. Check your connection and reload the page.', ko: '글을 불러오지 못했습니다. 연결을 확인하고 페이지를 새로 고치세요.', ja: '記事を読み込めませんでした。接続を確認して、ページを再読み込みしてください。' },
    },
  },
  {
    productType: 'knowledge-base', koRegister: '합니다체', person: 'you', maxWords: 20,
    tone: { en: 'Helpful and scannable: the answer first, then the steps, then the exceptions.', ko: '도움이 되고 훑어보기 쉽게 씁니다. 답을 먼저, 그다음 단계, 마지막에 예외를 씁니다.', ja: '役に立ち、拾い読みしやすく書きます。答えを先に、次に手順、最後に例外を書きます。' },
    cta: { en: 'Search the help center', ko: '도움말 검색', ja: 'ヘルプセンターを検索' },
    avoid: { en: 'Answers that open with background, and "simply" or "just" before a step.', ko: '배경 설명으로 시작하는 답과, 단계 앞의 간단히·그냥 같은 말은 쓰지 않습니다.', ja: '背景説明から始まる答えや、手順の前の「簡単に」「ただ」は使いません。' },
    sample: {
      hero: { en: 'To change the account owner, open Settings › Members › Transfer ownership.', ko: '계정 소유자를 바꾸려면 설정 › 멤버 › 소유권 이전을 누르세요.', ja: 'アカウントのオーナーを変更するには、設定 › メンバー › オーナー権限の移行を選びます。' },
      empty: { en: 'No articles match "invoice tax". Search for "tax ID" or contact support.', ko: '세금 계산서와 맞는 글이 없습니다. 사업자 번호로 검색하거나 고객 지원에 문의하세요.', ja: '請求書 税 に一致する記事はありません。税番号で検索するか、サポートにお問い合わせください。' },
      error: { en: 'Your feedback was not sent. Your text is kept; try again in a moment.', ko: '의견을 보내지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 보내세요.', ja: 'フィードバックを送信できませんでした。入力内容は残っています。少し待ってから、もう一度送信してください。' },
    },
  },
  {
    productType: 'portfolio', koRegister: '합니다체', person: 'i', maxWords: 20,
    tone: { en: 'First person and specific: the problem, your part in it and the measured result.', ko: '1인칭으로 구체적으로 씁니다. 문제, 내가 맡은 일, 측정한 결과를 씁니다.', ja: '一人称で具体的に書きます。課題、自分の担当、測定した結果を書きます。' },
    cta: { en: 'Read the case study', ko: '사례 읽기', ja: '事例を読む' },
    avoid: { en: 'Titles without your role, and results without how they were measured.', ko: '내 역할이 없는 제목과, 측정 방법이 없는 결과는 쓰지 않습니다.', ja: '自分の役割のないタイトルや、測定方法のない結果は使いません。' },
    sample: {
      hero: { en: 'I design operations tools for logistics teams; most recently the dispatch console at Moa.', ko: '물류팀이 쓰는 운영 도구를 디자인합니다. 최근 작업은 모아의 배차 콘솔입니다.', ja: '物流チーム向けの業務ツールをデザインしています。最近の仕事は Moa の配車コンソールです。' },
      empty: { en: 'No case studies in this category yet. See the other work in All work.', ko: '이 분야의 사례는 아직 없습니다. 전체 작업에서 다른 사례를 보세요.', ja: 'この分野の事例はまだありません。すべての作品からほかの事例をご覧ください。' },
      error: { en: 'The contact form was not sent. Your message is kept; try again or email hello@example.com.', ko: '문의를 보내지 못했습니다. 작성한 메시지는 그대로 있으니 다시 보내거나 hello@example.com으로 메일을 보내세요.', ja: 'お問い合わせを送信できませんでした。メッセージは残っています。もう一度送信するか、hello@example.com にメールしてください。' },
    },
  },
  {
    productType: 'campaign', koRegister: '합니다체', person: 'we', maxWords: 12,
    tone: { en: 'Short and concrete: one promise per section, backed by a detail the reader can check.', ko: '짧고 구체적으로 씁니다. 절마다 약속 하나에, 독자가 확인할 수 있는 근거를 붙입니다.', ja: '短く具体的に書きます。節ごとに約束ひとつ、読者が確かめられる根拠を添えます。' },
    cta: { en: 'Join the waitlist', ko: '대기자 명단에 등록', ja: 'ウェイトリストに登録' },
    avoid: { en: 'Countdown urgency, unsourced numbers and lines that fit any product.', ko: '카운트다운식 긴급함, 출처 없는 숫자, 어느 제품에나 맞는 문장은 쓰지 않습니다.', ja: 'カウントダウン式の緊急性、出典のない数字、どの製品にも当てはまる文は使いません。' },
    sample: {
      hero: { en: 'Meeting notes reach Slack, with owners and dates, two minutes later.', ko: '회의가 끝나고 2분 뒤, 담당자와 마감일이 붙은 회의록이 Slack에 올라옵니다.', ja: '会議の 2 分後、担当者と期限つきの議事録が Slack に届きます。' },
      empty: { en: 'The waitlist opens on 2 December. Leave your email and we write once, on launch day.', ko: '대기자 명단은 12월 2일에 엽니다. 이메일을 남기면 출시일에 한 번만 연락합니다.', ja: 'ウェイトリストは 12 月 2 日に始まります。メールアドレスを登録すると、公開日に一度だけご連絡します。' },
      error: { en: 'You were not added to the waitlist. Check the email address; nothing else was sent.', ko: '대기자 명단에 등록하지 못했습니다. 이메일 주소를 확인하세요. 다른 정보는 보내지 않았습니다.', ja: 'ウェイトリストに登録できませんでした。メールアドレスを確認してください。ほかの情報は送信されていません。' },
    },
  },
  {
    productType: 'consumer-app', koRegister: '해요체', person: 'you', maxWords: 12,
    tone: { en: 'Warm and brief: everyday words, one idea per sentence, no guilt.', ko: '따뜻하고 짧게 써요. 일상 단어로, 한 문장에 생각 하나만, 죄책감은 주지 않아요.', ja: '温かく短く書きます。ふだんの言葉で、一文にひとつの内容、罪悪感を与えません。' },
    cta: { en: 'Add a habit', ko: '습관 추가하기', ja: '習慣を追加' },
    avoid: { en: 'Guilt such as "You broke your streak!", shaming and pushy notifications.', ko: '연속 기록이 끊겼다며 죄책감을 주는 말, 창피 주기, 재촉하는 알림은 쓰지 않아요.', ja: '連続記録が途切れたと罪悪感を与える言い方、恥をかかせる表現、しつこい通知は使いません。' },
    sample: {
      hero: { en: 'Check off a habit in two seconds. See your whole week at once.', ko: '습관은 2초 만에 체크하고, 한 주는 한눈에 봐요.', ja: '習慣は 2 秒でチェックして、1 週間をひと目で確認できます。' },
      empty: { en: 'No habits yet. Start with one small thing you already do most days.', ko: '아직 습관이 없어요. 이미 거의 매일 하는 작은 일 하나로 시작해 보세요.', ja: 'まだ習慣はありません。ほぼ毎日していることをひとつ選んで始めましょう。' },
      error: { en: 'Your check-ins did not sync. They are saved here and sync once you are online.', ko: '체크 기록을 동기화하지 못했어요. 기록은 이 휴대폰에 저장돼 있고, 다시 연결되면 동기화돼요.', ja: 'チェックの記録を同期できませんでした。記録はこの端末に保存されていて、オンラインに戻ると同期されます。' },
    },
  },
];
