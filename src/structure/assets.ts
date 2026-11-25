import type { CatalogRepository } from '../catalog/repository.js';
import type { AuditSeverity, Lang } from '../types.js';
import { CDN_FONT_STYLESHEETS, FONT_LICENSES, FONT_SCRIPT_COVERAGE } from '../visual-canonical/fontSources.js';
import { TYPE_PAIRINGS } from '../typography/pairings.js';
import { firstFamily } from '../typography/loading.js';
import { descendants, selectorPath, textContent, type DomElement } from './dom/html.js';
import type { PageModel } from './dom/page.js';
import { urlsIn } from './dom/values.js';
import { creditsStockSource } from './detect.js';

/**
 * The "assets" group of audit_page_structure (2026-11-25 design-quality plan, 4.4 and 5.3): fonts the page declares
 * are loaded and match the style's fonts or its pairings, and images come from a known source, carry a credit, have
 * alt text and a reserved size, and are not placeholders. Unsplash and Pexels terms were read on 2026-11-25 (see
 * src/start/photos.ts): their licences do not require a credit for photos picked on the website and their APIs do, so
 * a missing credit is RISK, not FIX_NOW.
 */
export const ASSET_CHECK_IDS = [
  'assets-font-loading', 'assets-font-display', 'assets-font-choice',
  'assets-image-placeholder', 'assets-image-source', 'assets-image-credit', 'assets-image-alt', 'assets-image-dimensions',
] as const;
export type AssetCheckId = (typeof ASSET_CHECK_IDS)[number];

export interface AssetCheckDef {
  id: AssetCheckId;
  severity: AuditSeverity;
  applicability: 'when-present';
  evidenceTypes: ['dom'];
  criterion: string;
  why: string;
  remediation: string;
}

type Verdict = 'PASS' | 'FIX_NOW' | 'RISK' | 'NOT_APPLICABLE' | 'NOT_VERIFIED';
export interface AssetCheckReport { checkId: AssetCheckId; verdict: Verdict; count: number; items: string[]; note?: string }

const ITEMS = 5;
const STOCK_ALLOWED = ['images.unsplash.com', 'plus.unsplash.com', 'unsplash.com', 'images.pexels.com', 'pexels.com'];
const PLACEHOLDER_HOSTS = [
  'picsum.photos', 'placehold.co', 'placehold.it', 'placeholder.com', 'placekitten.com', 'loremflickr.com', 'dummyimage.com',
  'fakeimg.pl', 'lorempixel.com', 'source.unsplash.com', 'randomuser.me', 'pravatar.cc',
];
const PLACEHOLDER_FILE = /(?:^|[\W_])(?:placeholder|dummy|lorem|no-image|noimage|sample-image)(?:[\W_]|$)/i;
const BROKEN_SRC = /^(?:#|about:blank|undefined|null|javascript:.*)?$/i;
const FILENAME_ALT = /^(?:.*\.(?:jpe?g|png|webp|gif|avif|svg)|image|img|photo|picture|사진|이미지|画像|写真)\s*\d*$/iu;
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong', 'inherit', 'initial', 'unset', 'revert']);
const PRETENDARD = /pretendard/i;

const say: Record<Lang, Record<AssetCheckId, { criterion: string; why: string; fix: string }> & { found: (n: number) => string; clean: string; none: string; unknownSheet: string; limit: string; record: string }> = {
  en: {
    'assets-font-loading': { criterion: 'Every web font the page declares is loaded by a <link>, an @import or an @font-face.', why: 'A declared web font that is never loaded falls back to a system face, so the page loses its type.', fix: 'Add the stylesheet or @font-face for each family listed; start_ui_design gives the <link> tags.' },
    'assets-font-display': { criterion: 'Web font stylesheets and @font-face rules set font-display: swap.', why: 'Without swap, text stays invisible until the font file arrives.', fix: 'Add &display=swap to the Google Fonts URL and font-display: swap to each @font-face.' },
    'assets-font-choice': { criterion: "The page's web fonts are the style's authored fonts or one of its pairings.", why: 'Other faces drop the voice the style was chosen for.', fix: "Use the style's fonts from compose_design_tokens or a pairing from webstylebook://typography/pairings/{id}." },
    'assets-image-placeholder': { criterion: 'No image is a placeholder service, a placeholder file or an empty source.', why: 'Placeholder and broken images ship as gray boxes or broken icons.', fix: 'Replace each with a real image, or remove the slot and use the product screen or type.' },
    'assets-image-source': { criterion: 'External images come from Unsplash or Pexels, or from the product itself.', why: 'An image from another host has no licence this server can check.', fix: 'Use the product’s own images or a photo picked on Unsplash or Pexels, or confirm the licence of each listed host.' },
    'assets-image-credit': { criterion: 'Stock photos from Unsplash or Pexels are credited on the page.', why: 'The licences ask for no credit on website picks but their APIs require it, and the photographer gets it either way.', fix: 'Add "Photo by {name} on {Source}" with links in a figcaption or the footer credits.' },
    'assets-image-alt': { criterion: 'Every <img> has an alt that says what it shows, or alt="" when it is decorative.', why: 'An image without alt is announced by its file name or skipped.', fix: 'Write alt text for each listed image, or alt="" with aria-hidden="true" for a decorative one.' },
    'assets-image-dimensions': { criterion: 'Every <img> reserves its size with width and height or an aspect-ratio.', why: 'An image without a reserved size moves the page when it loads.', fix: 'Add width and height attributes, or an aspect-ratio in CSS, to each listed image.' },
    found: (n) => `${n} found; see assets.checks for the list.`,
    clean: 'Nothing found.',
    none: 'Nothing on the page to check.',
    unknownSheet: 'A font stylesheet from an unrecognised host may load these families.',
    limit: 'Asset checks read the submitted markup and CSS only: files they point to are not fetched, so a missing or broken local file is not seen.',
    record: 'To record the font and image checks, include "assets" in the get_design_audit_plan includeGroups and submit assets.evidence and assets.results as well.',
  },
  ko: {
    'assets-font-loading': { criterion: '페이지가 지정한 웹폰트가 모두 <link>, @import, @font-face로 로드됩니다.', why: '지정만 하고 로드하지 않은 웹폰트는 시스템 글꼴로 대체되어 페이지의 글꼴이 사라집니다.', fix: '목록의 각 family에 스타일시트나 @font-face를 추가하세요. start_ui_design이 <link> 태그를 줍니다.' },
    'assets-font-display': { criterion: '웹폰트 스타일시트와 @font-face가 font-display: swap을 씁니다.', why: 'swap이 없으면 글꼴 파일이 올 때까지 글자가 보이지 않습니다.', fix: 'Google Fonts URL에 &display=swap을, 각 @font-face에 font-display: swap을 넣으세요.' },
    'assets-font-choice': { criterion: '페이지의 웹폰트가 스타일의 저작 글꼴이거나 그 글꼴 짝 중 하나입니다.', why: '다른 글꼴은 이 스타일을 고른 이유인 목소리를 잃습니다.', fix: 'compose_design_tokens의 스타일 글꼴이나 webstylebook://typography/pairings/{id}의 짝을 쓰세요.' },
    'assets-image-placeholder': { criterion: '플레이스홀더 서비스, 플레이스홀더 파일, 빈 소스인 이미지가 없습니다.', why: '플레이스홀더와 깨진 이미지는 회색 상자나 깨진 아이콘으로 배포됩니다.', fix: '실제 이미지로 바꾸거나, 그 자리를 빼고 제품 화면이나 글자로 채우세요.' },
    'assets-image-source': { criterion: '외부 이미지는 Unsplash, Pexels, 또는 제품 자체에서 옵니다.', why: '다른 호스트의 이미지는 이 서버가 라이선스를 확인할 수 없습니다.', fix: '제품 자체 이미지나 Unsplash·Pexels에서 고른 사진을 쓰거나, 목록의 각 호스트의 라이선스를 확인하세요.' },
    'assets-image-credit': { criterion: 'Unsplash·Pexels 스톡 사진의 출처를 페이지에 표기합니다.', why: '웹사이트에서 고른 사진은 라이선스상 표기가 필수가 아니지만 API는 요구하고, 어느 쪽이든 작가에게 공을 돌립니다.', fix: 'figcaption이나 푸터 크레딧에 "Photo by {name} on {Source}"와 링크를 넣으세요.' },
    'assets-image-alt': { criterion: '모든 <img>에 무엇을 보여 주는지 말하는 alt가 있거나, 장식이면 alt=""가 있습니다.', why: 'alt가 없는 이미지는 파일 이름으로 읽히거나 건너뜁니다.', fix: '목록의 이미지마다 alt를 쓰거나, 장식 이미지는 alt=""와 aria-hidden="true"를 주세요.' },
    'assets-image-dimensions': { criterion: '모든 <img>가 width·height나 aspect-ratio로 크기를 잡아 둡니다.', why: '크기를 잡지 않은 이미지는 로드될 때 페이지를 밀어냅니다.', fix: '목록의 이미지마다 width·height 속성이나 CSS aspect-ratio를 넣으세요.' },
    found: (n) => `${n}개를 찾았습니다. 목록은 assets.checks에 있습니다.`,
    clean: '찾은 문제가 없습니다.',
    none: '페이지에 검사할 대상이 없습니다.',
    unknownSheet: '알 수 없는 호스트의 글꼴 스타일시트가 이 family를 로드할 수도 있습니다.',
    limit: '에셋 검사는 제출한 마크업과 CSS만 읽습니다. 가리키는 파일을 내려받지 않으므로 없거나 깨진 로컬 파일은 보지 못합니다.',
    record: '글꼴과 이미지 검사를 기록하려면 get_design_audit_plan의 includeGroups에 "assets"를 넣고, assets.evidence와 assets.results도 함께 제출하세요.',
  },
  ja: {
    'assets-font-loading': { criterion: 'ページが指定したウェブフォントはすべて <link>・@import・@font-face で読み込まれます。', why: '指定だけで読み込まないウェブフォントはシステムフォントに置き換わり、ページの書体が失われます。', fix: '一覧の各 family にスタイルシートか @font-face を追加してください。start_ui_design が <link> タグを返します。' },
    'assets-font-display': { criterion: 'ウェブフォントのスタイルシートと @font-face が font-display: swap を使います。', why: 'swap がないと、フォントファイルが届くまで文字が表示されません。', fix: 'Google Fonts の URL に &display=swap を、各 @font-face に font-display: swap を加えてください。' },
    'assets-font-choice': { criterion: 'ページのウェブフォントがスタイルの既定のフォントか、その組み合わせのひとつです。', why: 'ほかの書体では、このスタイルを選んだ理由である声が失われます。', fix: 'compose_design_tokens のスタイルのフォントか、webstylebook://typography/pairings/{id} の組み合わせを使ってください。' },
    'assets-image-placeholder': { criterion: 'プレースホルダーのサービス・ファイル・空のソースの画像がありません。', why: 'プレースホルダーや壊れた画像は灰色の箱や壊れたアイコンのまま公開されます。', fix: '実際の画像に置き換えるか、その枠を外して製品の画面か文字で埋めてください。' },
    'assets-image-source': { criterion: '外部の画像は Unsplash、Pexels、または製品自身から来ています。', why: 'ほかのホストの画像は、このサーバーではライセンスを確認できません。', fix: '製品自身の画像か Unsplash・Pexels で選んだ写真を使うか、一覧の各ホストのライセンスを確認してください。' },
    'assets-image-credit': { criterion: 'Unsplash・Pexels のストック写真の出典をページに表記しています。', why: 'ウェブサイトで選んだ写真はライセンス上表記が必須ではありませんが API では必要で、どちらでも撮影者の功績を示せます。', fix: 'figcaption かフッターのクレジットに "Photo by {name} on {Source}" とリンクを入れてください。' },
    'assets-image-alt': { criterion: 'すべての <img> に何を示すかを書いた alt があるか、装飾なら alt="" があります。', why: 'alt のない画像はファイル名で読み上げられるか、飛ばされます。', fix: '一覧の画像ごとに alt を書くか、装飾画像には alt="" と aria-hidden="true" を付けてください。' },
    'assets-image-dimensions': { criterion: 'すべての <img> が width・height か aspect-ratio で大きさを確保しています。', why: '大きさを確保していない画像は、読み込み時にページを動かします。', fix: '一覧の画像ごとに width・height 属性か CSS の aspect-ratio を加えてください。' },
    found: (n) => `${n} 件見つかりました。一覧は assets.checks にあります。`,
    clean: '問題は見つかりませんでした。',
    none: 'ページに確認する対象がありません。',
    unknownSheet: '不明なホストのフォントスタイルシートがこれらの family を読み込んでいる可能性があります。',
    limit: 'アセット検査は提出したマークアップと CSS だけを読みます。参照先のファイルは取得しないため、欠けている・壊れたローカルファイルは見えません。',
    record: 'フォントと画像の検査を記録するには、get_design_audit_plan の includeGroups に "assets" を含め、assets.evidence と assets.results も提出してください。',
  },
};

const SEVERITY: Record<AssetCheckId, AuditSeverity> = {
  'assets-font-loading': 'major', 'assets-font-display': 'minor', 'assets-font-choice': 'minor', 'assets-image-placeholder': 'major',
  'assets-image-source': 'minor', 'assets-image-credit': 'minor', 'assets-image-alt': 'major', 'assets-image-dimensions': 'minor',
};

/** Audit-plan checks for the assets group; the font-choice check needs a styleId. */
export function assetChecks(styleId: string | undefined, locale: Lang): AssetCheckDef[] {
  return ASSET_CHECK_IDS.filter((id) => styleId || id !== 'assets-font-choice').map((id) => ({
    id, severity: SEVERITY[id], applicability: 'when-present', evidenceTypes: ['dom'],
    criterion: say[locale][id].criterion, why: say[locale][id].why, remediation: say[locale][id].fix,
  }));
}

const lower = (value: string) => value.toLowerCase();
const hostOf = (url: string) => /^(?:https?:)?\/\/([^/?#]+)/i.exec(url.trim())?.[1]?.toLowerCase().replace(/:\d+$/, '');
const hostIn = (host: string | undefined, list: readonly string[]) => !!host && list.some((entry) => host === entry || host.endsWith(`.${entry}`));
const fileOf = (url: string) => url.split(/[?#]/)[0]!.split('/').pop() ?? '';

/** Every CSS source on the page: submitted stylesheets, <style> elements and style attributes. */
function cssTexts(page: PageModel, css: readonly string[]): string[] {
  const inline = page.html.elements.map((element) => element.attrs.get('style')).filter((value): value is string => !!value).map((value) => `x{${value}}`);
  return [...css, ...page.html.styleSheets, ...inline];
}

/** The font stacks the CSS declares: font-family, the font shorthand and --font-* custom properties. */
function declaredStacks(sources: readonly string[]): string[] {
  const stacks: string[] = [];
  for (const source of sources) {
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*{[^}]*}/gi, '');
    for (const match of body.matchAll(/(?:^|[;{\s])(font-family|--font[\w-]*|font)\s*:\s*([^;}]+)/gi)) {
      let value = match[2]!.trim().replace(/\s*!important$/i, '');
      if (match[1]!.toLowerCase() === 'font') {
        const shorthand = /\d[\w.%]*(?:\s*\/\s*[\w.%]+)?\s+(.+)$/.exec(value);
        if (!shorthand) continue;
        value = shorthand[1]!;
      }
      if (!value || /^var\(/i.test(value) || /^\d/.test(value)) continue;
      stacks.push(value);
    }
  }
  return stacks;
}

/** Families a Google Fonts (or compatible) CSS URL loads. */
function googleFamilies(url: string): string[] | null {
  if (!/fonts\.(?:googleapis|bunny)\.net\/css|fonts\.googleapis\.com\/css/i.test(url)) return null;
  const query = url.split('?')[1] ?? '';
  const out: string[] = [];
  for (const part of query.split('&')) {
    const [key, raw] = part.split('=');
    if (key !== 'family' || !raw) continue;
    for (const family of decodeURIComponent(raw.replace(/\+/g, ' ')).split('|')) out.push(family.split(':')[0]!.trim());
  }
  return out;
}

function loadedFonts(page: PageModel, sources: readonly string[]) {
  const urls: string[] = [];
  for (const element of page.html.elements) {
    const rel = (element.attrs.get('rel') ?? '').toLowerCase();
    if (element.tag === 'link' && rel.split(/\s+/).includes('stylesheet') && element.attrs.get('href')) urls.push(element.attrs.get('href')!);
  }
  for (const source of sources) {
    for (const match of source.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)/gi)) urls.push(match[1]!);
  }
  const families = new Set<string>();
  const google: string[] = [];
  let unknownSheet = false;
  for (const url of urls) {
    const fromGoogle = googleFamilies(url);
    if (fromGoogle) { google.push(url); for (const family of fromGoogle) families.add(lower(family)); continue; }
    const cdn = Object.entries(CDN_FONT_STYLESHEETS).find(([family, sheet]) => url === sheet || (PRETENDARD.test(family) && PRETENDARD.test(url)) || (/wanted/i.test(family) && /wanted-?sans/i.test(url)));
    if (cdn) { families.add(lower(cdn[0])); if (PRETENDARD.test(cdn[0])) families.add('pretendard'); continue; }
    if (/font|typekit|type\.|typography/i.test(url)) unknownSheet = true;
  }
  const faces: Array<{ family: string; display: boolean }> = [];
  for (const source of sources) {
    for (const match of source.matchAll(/@font-face\s*{([^}]*)}/gi)) {
      const family = /font-family\s*:\s*([^;]+)/i.exec(match[1]!)?.[1];
      if (!family) continue;
      faces.push({ family: firstFamily(family), display: /font-display\s*:\s*swap/i.test(match[1]!) });
      families.add(lower(firstFamily(family)));
    }
  }
  return { families, google, faces, unknownSheet };
}

const knownWebFont = (family: string) => FONT_LICENSES[family] !== undefined || PRETENDARD.test(family);
const canonical = (family: string) => Object.keys(FONT_LICENSES).find((name) => lower(name) === lower(family)) ?? family;

function imageUrls(element: DomElement): string[] {
  const out: string[] = [];
  for (const attr of ['src', 'data-src', 'srcset', 'data-srcset']) {
    const value = element.attrs.get(attr);
    if (!value) continue;
    if (attr.includes('srcset')) out.push(...value.split(/,\s+/).map((part) => part.trim().split(/\s+/)[0] ?? '').filter(Boolean));
    else out.push(value.trim());
  }
  return out;
}

/** The style's authored families and the families of its pairings, lower-cased. */
function styleFamilies(repo: CatalogRepository, styleId: string): Set<string> {
  const typography = repo.visualContracts.authored(styleId).typography;
  const out = new Set<string>(typography.fonts.map((font) => lower(font.family)));
  for (const role of Object.values(typography.roles)) out.add(lower(firstFamily(role.fontFamily)));
  for (const pairing of TYPE_PAIRINGS.filter((entry) => entry.styleIds.includes(styleId))) {
    for (const font of [pairing.display, pairing.body, pairing.mono, pairing.locales.ko.display, pairing.locales.ko.body, pairing.locales.ja.display, pairing.locales.ja.body]) {
      if (font) out.add(lower(font.family));
    }
  }
  if ([...out].some((family) => PRETENDARD.test(family))) out.add('pretendard');
  return out;
}

const report = (checkId: AssetCheckId, verdict: Verdict, items: readonly string[] = [], note?: string, count = items.length): AssetCheckReport =>
  ({ checkId, verdict, count, items: items.slice(0, ITEMS).map((item) => item.slice(0, 200)), ...(note ? { note } : {}) });
/** Selector paths of the first ITEMS elements only: a path costs a walk over siblings, and the rest are only counted. */
const paths = (elements: readonly DomElement[]) => elements.slice(0, ITEMS).map(selectorPath);

/** Run the asset checks on a parsed page. */
export function assetReports(page: PageModel, css: readonly string[], styleId: string | undefined, locale: Lang, repo: CatalogRepository): AssetCheckReport[] {
  const sources = cssTexts(page, css);
  const stacks = declaredStacks(sources);
  const loaded = loadedFonts(page, sources);
  const script = locale === 'ko' ? 'hangul' : locale === 'ja' ? 'japanese' : undefined;
  const needed = new Set<string>();
  const used = new Set<string>();
  for (const stack of stacks) {
    const families = stack.split(',').map((entry) => firstFamily(entry)).filter((family) => family && !GENERIC_FAMILIES.has(lower(family)));
    const first = families[0];
    if (first && (knownWebFont(first) || loaded.families.has(lower(first)))) used.add(canonical(first));
    if (first && knownWebFont(first)) needed.add(canonical(first));
    const local = script ? families.find((family) => FONT_SCRIPT_COVERAGE[canonical(family)]?.includes(script)) : undefined;
    if (local && knownWebFont(local)) needed.add(canonical(local));
  }
  const missing = [...needed].filter((family) => !loaded.families.has(lower(family)) && !(PRETENDARD.test(family) && loaded.families.has('pretendard'))).sort();
  const reports: AssetCheckReport[] = [];
  reports.push(!needed.size ? report('assets-font-loading', 'NOT_APPLICABLE')
    : !missing.length ? report('assets-font-loading', 'PASS')
      : loaded.unknownSheet ? report('assets-font-loading', 'NOT_VERIFIED', missing, say[locale].unknownSheet)
        : report('assets-font-loading', 'FIX_NOW', missing));
  const noSwap = [...loaded.google.filter((url) => !/[?&]display=swap\b/i.test(url)), ...loaded.faces.filter((face) => !face.display).map((face) => `@font-face ${face.family}`)];
  reports.push(!loaded.google.length && !loaded.faces.length ? report('assets-font-display', 'NOT_APPLICABLE')
    : report('assets-font-display', noSwap.length ? 'RISK' : 'PASS', noSwap));
  if (styleId) {
    const allowed = styleFamilies(repo, styleId);
    const off = [...used].filter((family) => !allowed.has(lower(family)) && !(PRETENDARD.test(family) && allowed.has('pretendard'))).sort();
    reports.push(!used.size ? report('assets-font-choice', 'NOT_APPLICABLE') : report('assets-font-choice', off.length ? 'RISK' : 'PASS', off));
  }

  const images = page.html.elements.filter((element) => element.tag === 'img');
  const sourcesOf = page.html.elements.filter((element) => element.tag === 'source' && element.parent?.tag === 'picture').flatMap(imageUrls);
  const backgrounds = sources.flatMap((source) => [...source.matchAll(/background(?:-image)?\s*:\s*([^;}]+)/gi)].flatMap((match) => urlsIn(match[1])));
  const urls = [...images.flatMap(imageUrls), ...sourcesOf, ...backgrounds].filter((url) => !/^data:/i.test(url));
  const anyImage = images.length > 0 || urls.length > 0;
  const broken = images.filter((image) => !imageUrls(image).length || (BROKEN_SRC.test((image.attrs.get('src') ?? '').trim()) && !image.attrs.get('srcset') && !image.attrs.get('data-src')));
  const placeholderUrls = [...new Set(urls.filter((url) => hostIn(hostOf(url), PLACEHOLDER_HOSTS) || PLACEHOLDER_FILE.test(fileOf(url))))];
  const placeholderCount = broken.length + placeholderUrls.length;
  reports.push(!anyImage ? report('assets-image-placeholder', 'NOT_APPLICABLE')
    : report('assets-image-placeholder', placeholderCount ? 'FIX_NOW' : 'PASS', [...paths(broken), ...placeholderUrls], undefined, placeholderCount));
  const external = urls.filter((url) => hostOf(url) && !hostIn(hostOf(url), PLACEHOLDER_HOSTS));
  const unknown = [...new Set(external.filter((url) => !hostIn(hostOf(url), STOCK_ALLOWED)).map((url) => hostOf(url)!))].sort();
  reports.push(!external.length ? report('assets-image-source', 'NOT_APPLICABLE') : report('assets-image-source', unknown.length ? 'RISK' : 'PASS', unknown));
  // The same rule audit_page_structure applies to a stock-photo hero: the page names each photo's stock site.
  const stock = external.filter((url) => hostIn(hostOf(url), STOCK_ALLOWED));
  const uncredited = [...new Set(stock.filter((url) => !creditsStockSource(page, url)))];
  reports.push(!stock.length ? report('assets-image-credit', 'NOT_APPLICABLE') : report('assets-image-credit', uncredited.length ? 'RISK' : 'PASS', uncredited));
  const noAlt = images.filter((image) => !image.attrs.has('alt'));
  const fileAlt = images.filter((image) => FILENAME_ALT.test((image.attrs.get('alt') ?? '').trim()));
  const fileAltItems = fileAlt.slice(0, ITEMS).map((image) => `${selectorPath(image)} alt="${image.attrs.get('alt')}"`);
  reports.push(!images.length ? report('assets-image-alt', 'NOT_APPLICABLE')
    : noAlt.length ? report('assets-image-alt', 'FIX_NOW', [...paths(noAlt), ...fileAltItems], undefined, noAlt.length + fileAlt.length)
      : report('assets-image-alt', fileAlt.length ? 'RISK' : 'PASS', fileAltItems, undefined, fileAlt.length));
  const sized = (image: DomElement) => (image.attrs.has('width') && image.attrs.has('height'))
    || !!page.styles.get(image, 'aspect-ratio')
    || [page.styles.get(image, 'width'), page.styles.get(image, 'height')].every((value) => !!value && value.trim() !== 'auto');
  const unsized = images.filter((image) => !sized(image));
  reports.push(!images.length ? report('assets-image-dimensions', 'NOT_APPLICABLE') : report('assets-image-dimensions', unsized.length ? 'RISK' : 'PASS', paths(unsized), undefined, unsized.length));
  return reports;
}

export function assetText(locale: Lang) {
  return say[locale];
}
