import type { LocalizedText, ProductType } from '../types.js';
import type { PageRole } from '../recommendation/page-roles.js';

/**
 * When a page uses photos and what to shoot or search for (2026-11-25 design-quality plan, 5.1 and 5.3). The server is
 * offline and searches nothing; it returns a plan the host agent carries out.
 *
 * Terms read on 2026-11-25:
 * - unsplash.com/license: commercial use allowed; attribution "appreciated", not required; no selling without
 *   significant modification; no compiling photos into a similar or competing service.
 * - Unsplash API Guidelines (help.unsplash.com, article dated 2026-07-27): API apps must credit the photographer and
 *   Unsplash with links, use the hotlinked photo.urls, call photo.links.download_location on download, and keep to
 *   "non-automated, high-quality, and authentic experiences".
 * - pexels.com/license: free; attribution not required; do not sell unaltered copies, imply endorsement by people or
 *   brands shown, or use a photo as a trademark; identifiable people may not appear in a bad light.
 * - Pexels API documentation, guidelines: show a prominent link to Pexels and credit photographers when possible.
 */
export type PhotoSlotId = 'context' | 'scene' | 'hero' | 'detail' | 'scale' | 'dishes' | 'room' | 'work' | 'portrait';

export interface PhotoSlot {
  slot: PhotoSlotId;
  subject: LocalizedText;
  avoid: LocalizedText;
  orientation: 'landscape' | 'portrait' | 'square';
  minWidth: number;
  /** Search words in English; replace the {placeholder} with the product's own subject. Absent for own photos. */
  query?: { unsplash: string; pexels: string };
  crop: string;
  alt: LocalizedText;
  /** The business's own photo belongs here; a stock photo only stands in until it exists and must not pose as theirs. */
  own: boolean;
}

export interface PhotoPlan { use: boolean; reason: LocalizedText; slots: readonly PhotoSlot[] }

const NO_PEOPLE_AT_LAPTOPS: LocalizedText = {
  en: 'People smiling at laptops, handshakes, and abstract gradients standing in for a scene.',
  ko: '노트북 앞에서 웃는 사람, 악수, 장면 대신 쓴 추상 그라디언트.',
  ja: 'ノートパソコンの前で笑う人、握手、場面の代わりの抽象的なグラデーション。',
};

const SKIP = (en: string, ko: string, ja: string): PhotoPlan => ({ use: false, reason: { en, ko, ja }, slots: [] });

export const PHOTO_PLANS: Readonly<Record<PageRole, PhotoPlan>> = {
  'marketing-landing': {
    use: true,
    reason: {
      en: 'One photo of the real scene the product works in can give context; the opening still shows the product itself.',
      ko: '제품이 쓰이는 실제 장면 사진 한 장은 맥락을 줍니다. 첫 화면은 그래도 제품 자체를 보여 줍니다.',
      ja: '製品が使われる実際の場面の写真 1 枚は文脈を伝えます。最初の画面には製品そのものを見せます。',
    },
    slots: [{
      slot: 'context', orientation: 'landscape', minWidth: 1600, own: false,
      subject: { en: 'The place or material the product deals with, mid-task: a meeting room during a discussion, a site, a workbench.', ko: '제품이 다루는 장소나 재료가 일하는 중인 모습: 논의 중인 회의실, 현장, 작업대.', ja: '製品が扱う場所や素材の作業中の様子: 議論中の会議室、現場、作業台。' },
      avoid: NO_PEOPLE_AT_LAPTOPS,
      query: { unsplash: '{place or material} in use, natural light', pexels: '{place or material} at work' },
      crop: 'object-fit: cover; object-position: 50% 50%',
      alt: { en: '<who or what> <doing what> <where>', ko: '<누가 또는 무엇이> <어디에서> <무엇을 하는지>', ja: '<誰が・何が> <どこで> <何をしているか>' },
    }],
  },
  'app-promo': {
    use: true,
    reason: {
      en: 'A photo of the moment the app is used shows when it fits into a day; the screens themselves show what it does.',
      ko: '앱을 쓰는 순간의 사진은 하루 중 언제 쓰는지 보여 줍니다. 무엇을 하는지는 앱 화면이 보여 줍니다.',
      ja: 'アプリを使う瞬間の写真は、一日のどこで使うかを伝えます。何をするかはアプリの画面が伝えます。',
    },
    slots: [{
      slot: 'scene', orientation: 'portrait', minWidth: 1200, own: false,
      subject: { en: 'Hands and a phone in the real setting where the app is used: a kitchen counter, a commute, a gym bench.', ko: '앱을 쓰는 실제 장소의 손과 휴대폰: 부엌 조리대, 출퇴근길, 운동 벤치.', ja: 'アプリを使う実際の場所での手とスマートフォン: キッチンのカウンター、通勤中、ジムのベンチ。' },
      avoid: { en: 'A phone mockup with an invented screen, and posed lifestyle shots unrelated to the task.', ko: '지어낸 화면을 띄운 휴대폰 목업, 작업과 관계없는 연출 사진.', ja: '架空の画面を表示したスマートフォンのモックアップ、作業と関係のない演出写真。' },
      query: { unsplash: 'hands holding phone {setting}', pexels: 'phone in hand {setting}' },
      crop: 'object-fit: cover; object-position: 50% 40%',
      alt: { en: '<who> using the app <where>', ko: '<누가> <어디에서> 앱을 쓰는 모습', ja: '<誰が> <どこで> アプリを使う様子' },
    }],
  },
  'product-detail': {
    use: true,
    reason: {
      en: 'People decide on a physical product from its photos: the product in use, its material, and its size.',
      ko: '실물 제품은 사진을 보고 고릅니다. 쓰는 모습, 소재, 크기가 필요합니다.',
      ja: '実物の製品は写真を見て選ばれます。使っている様子、素材、大きさが必要です。',
    },
    slots: [
      {
        slot: 'hero', orientation: 'landscape', minWidth: 1600, own: true,
        subject: { en: 'The product in use in its real setting, in daylight.', ko: '실제 쓰는 장소에서 쓰는 중인 제품, 자연광.', ja: '実際の場所で使われている製品、自然光。' },
        avoid: { en: 'A white-background cutout as the only image, and renders presented as photos.', ko: '흰 배경 누끼 한 장만 두는 것, 렌더링을 사진처럼 보이게 하는 것.', ja: '白背景の切り抜き 1 枚だけにすること、レンダリングを写真のように見せること。' },
        query: { unsplash: '{product} in use {room}', pexels: '{product} {room}' },
        crop: 'object-fit: cover; object-position: 50% 55%',
        alt: { en: '<product> <doing what> <where>', ko: '<제품>이 <어디에서> <무엇을 하는지>', ja: '<製品>が<どこで><何をしているか>' },
      },
      {
        slot: 'detail', orientation: 'square', minWidth: 1000, own: true,
        subject: { en: 'A close-up of the material, joint or control people ask about.', ko: '사람들이 묻는 소재, 이음새, 조작부의 근접 사진.', ja: 'よく質問される素材・継ぎ目・操作部の接写。' },
        avoid: { en: 'Close-ups so tight that the part cannot be recognised.', ko: '어느 부분인지 알아볼 수 없을 만큼 가까운 사진.', ja: 'どの部分かわからないほど寄った写真。' },
        query: { unsplash: '{material} texture close up', pexels: '{material} close up' },
        crop: 'object-fit: cover; object-position: 50% 50%',
        alt: { en: 'Close-up of the <part> in <material>', ko: '<소재>로 된 <부분>의 근접 사진', ja: '<素材>の<部分>の接写' },
      },
      {
        slot: 'scale', orientation: 'square', minWidth: 1000, own: true,
        subject: { en: 'The product in a hand or beside an everyday object, so its size reads at once.', ko: '손에 들었거나 익숙한 물건 옆에 둔 제품. 크기를 바로 알 수 있습니다.', ja: '手に持つか身近な物の横に置いた製品。大きさがすぐにわかります。' },
        avoid: { en: 'Scale shown only as a number with no visual reference.', ko: '시각적 기준 없이 숫자로만 크기를 보여 주는 것.', ja: '目で見る基準がなく、数字だけで大きさを示すこと。' },
        query: { unsplash: '{product} in hand', pexels: 'holding {product}' },
        crop: 'object-fit: cover; object-position: 50% 50%',
        alt: { en: '<product> in a hand, about <size>', ko: '손에 든 <제품>, 약 <크기>', ja: '手に持った<製品>、約<大きさ>' },
      },
    ],
  },
  pricing: SKIP(
    'Plans, prices and limits carry the page; a photo adds weight without information.',
    '요금제, 가격, 한도가 페이지를 이끕니다. 사진은 정보 없이 무게만 더합니다.',
    'プラン・価格・上限がページの中心です。写真は情報なしに重さだけを足します。'),
  signup: SKIP(
    'A form needs focus; put the product or one sentence of value beside it instead of a photo.',
    '폼에는 집중이 필요합니다. 사진 대신 제품 화면이나 가치를 말하는 문장 하나를 옆에 두세요.',
    'フォームには集中が必要です。写真の代わりに、製品の画面か価値を伝える一文を横に置いてください。'),
  dashboard: SKIP(
    'People come to read and act on data; photos push it down.',
    '사람들은 데이터를 읽고 조치하러 옵니다. 사진은 데이터를 아래로 밀어냅니다.',
    '人はデータを読んで対応するために来ます。写真はデータを下に押し下げます。'),
  'data-table': SKIP(
    'Rows and filters are the content; a photo has no place in a table view.',
    '행과 필터가 내용입니다. 표 화면에는 사진이 들어갈 자리가 없습니다.',
    '行とフィルターが内容です。表の画面に写真の居場所はありません。'),
  settings: SKIP(
    'Settings are read field by field; photos only slow people down.',
    '설정은 항목별로 읽습니다. 사진은 속도만 늦춥니다.',
    '設定は項目ごとに読まれます。写真は手を遅くするだけです。'),
  docs: SKIP(
    'Use screenshots and diagrams of the actual product, not photos.',
    '사진 대신 실제 제품의 스크린숏과 도식을 쓰세요.',
    '写真ではなく、実際の製品のスクリーンショットと図を使ってください。'),
  'blog-article': SKIP(
    'Add a figure only when it shows what the article discusses: a diagram, a screenshot or the place itself.',
    '글이 다루는 것을 보여 줄 때만 그림을 넣으세요: 도식, 스크린숏, 그 장소.',
    '記事が扱う内容を見せるときだけ図を入れてください: 図解、スクリーンショット、その場所。'),
  portfolio: {
    use: true,
    reason: {
      en: 'The work is the evidence: show your own project images and, if you want one, a real portrait. Stock photos do not belong here.',
      ko: '작업물이 근거입니다. 자신의 프로젝트 이미지와, 원하면 실제 인물 사진을 쓰세요. 스톡 사진은 맞지 않습니다.',
      ja: '作品が根拠です。自分のプロジェクトの画像と、必要なら本人の写真を使ってください。ストック写真は合いません。',
    },
    slots: [
      {
        slot: 'work', orientation: 'landscape', minWidth: 1600, own: true,
        subject: { en: 'Your own screens, prototypes or photos of the shipped work, cropped to the part you changed.', ko: '직접 만든 화면, 프로토타입, 출시한 결과물 사진을 바꾼 부분이 보이게 자른 것.', ja: '自分で作った画面、プロトタイプ、公開した成果物の写真を、変えた部分が見えるように切り抜いたもの。' },
        avoid: { en: 'Device mockups with invented screens, and stock photos of offices.', ko: '지어낸 화면을 띄운 기기 목업, 사무실 스톡 사진.', ja: '架空の画面を表示した端末モックアップ、オフィスのストック写真。' },
        crop: 'object-fit: cover; object-position: 50% 0%',
        alt: { en: '<project>: <what the image shows>', ko: '<프로젝트>: <이미지가 보여 주는 것>', ja: '<プロジェクト>: <画像が示すもの>' },
      },
      {
        slot: 'portrait', orientation: 'portrait', minWidth: 800, own: true,
        subject: { en: 'A real portrait of you, if you want one on the page.', ko: '페이지에 넣고 싶다면, 본인의 실제 인물 사진.', ja: 'ページに載せたい場合は、本人の実際の写真。' },
        avoid: { en: 'Stock portraits or generated faces.', ko: '스톡 인물 사진이나 생성한 얼굴.', ja: 'ストックの人物写真や生成した顔。' },
        crop: 'object-fit: cover; object-position: 50% 30%',
        alt: { en: '<name>, <role>', ko: '<이름>, <역할>', ja: '<名前>、<役割>' },
      },
    ],
  },
  'restaurant-local': {
    use: true,
    reason: {
      en: 'Food and the room are what people decide on; show the place as it is.',
      ko: '사람들은 음식과 공간을 보고 정합니다. 가게를 있는 그대로 보여 주세요.',
      ja: '人は料理と空間を見て決めます。お店をありのままに見せてください。',
    },
    slots: [
      {
        slot: 'dishes', orientation: 'landscape', minWidth: 1600, own: true,
        subject: { en: 'The dishes on the menu, on the tables of the room, in its real light.', ko: '메뉴에 있는 음식을 가게 테이블 위에, 실제 조명 아래에서 찍은 사진.', ja: 'メニューにある料理を、お店のテーブルの上で、実際の照明の下で撮った写真。' },
        avoid: { en: 'White-background cutouts and dishes the place does not serve.', ko: '흰 배경 누끼, 가게에서 팔지 않는 음식.', ja: '白背景の切り抜き、お店で出していない料理。' },
        query: { unsplash: '{cuisine} dinner table warm light', pexels: '{cuisine} food table' },
        crop: 'object-fit: cover; object-position: 50% 60%',
        alt: { en: '<dish> on <table>, <light>', ko: '<음식>, <테이블> 위, <조명>', ja: '<料理>、<テーブル>の上、<照明>' },
      },
      {
        slot: 'room', orientation: 'landscape', minWidth: 1600, own: true,
        subject: { en: 'The room with its seats and counter, so people know what to expect.', ko: '좌석과 카운터가 보이는 가게 안. 무엇을 기대할지 알 수 있습니다.', ja: '席とカウンターが見える店内。何が待っているかわかります。' },
        avoid: { en: 'Close-up faces of guests, and rooms from other restaurants.', ko: '손님 얼굴 근접 사진, 다른 가게의 공간.', ja: '客の顔の接写、ほかのお店の空間。' },
        query: { unsplash: '{cuisine} restaurant interior', pexels: 'small restaurant interior' },
        crop: 'object-fit: cover; object-position: 50% 50%',
        alt: { en: 'Inside <name>: <seats>, <counter>', ko: '<가게 이름> 안: <좌석>, <카운터>', ja: '<店名>の店内: <席>、<カウンター>' },
      },
    ],
  },
};

/** Product types whose product is software: a product page shows the product screen, not a photo. */
export const SOFTWARE_PRODUCT_TYPES: ReadonlySet<ProductType> = new Set([
  'operational-saas', 'developer-tool', 'documentation', 'data-analytics', 'security-console', 'finance-admin',
  'healthcare-portal', 'ai-chat', 'knowledge-base',
]);

export const PHOTO_RULES = {
  termsChecked: '2026-11-25',
  licenses: { unsplash: 'https://unsplash.com/license', pexels: 'https://www.pexels.com/license/' },
  pick: 'Pick photos on unsplash.com or pexels.com and download them; their APIs add attribution, hotlink and tracking duties.',
  credit: 'Credit each stock photo as "Photo by {name} on {Source}", linking the photographer and the photo, in a figcaption or the footer credits. The licences do not require it for photos picked on the websites; the APIs do.',
  dont: 'Do not imply that people or brands shown endorse the product, use a photo as a logo, or show identifiable people in a bad light.',
  markup: 'Give every <img> a width and height and an alt that says what it shows; a decorative image gets alt="".',
  fallback: 'No fitting photo: leave the slot out and use the product screen or type, never a gray box.',
};
