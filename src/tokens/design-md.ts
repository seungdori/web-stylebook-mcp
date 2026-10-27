import type { CatalogRepository } from '../catalog/repository.js';
import { stableHashOf } from '../catalog/stable-hash.js';
import { text } from '../localization.js';
import { hasStructureGuide, styleStructure } from '../structure/guidance.js';
import { productMustHaves } from '../structure/must-haves.js';
import { globalPattern } from '../structure/patterns.js';
import type { CatalogStyle, DesignTokens, Lang, ProductType } from '../types.js';
import { TYPOGRAPHY_ROLES, type ColorRole, type ResolvedVisualContract } from '../visual-canonical/types.js';
import type { ComposeDesignTokensInput, TokenSetResult } from './compile.js';
import { toYaml, type YamlMap, type YamlNode } from './yaml.js';

export const DESIGN_MD_SCHEMA = 'webstylebook.design-md.v1';
export const DESIGN_MD_SPEC_VERSION = 'alpha';
export const DESIGN_MD_FILE_NAME = 'DESIGN.md';
export const DESIGN_MD_PLACEMENTS = ['front-matter', 'interleaved'] as const;
export const DESIGN_MD_SECTIONS = [
  'Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts",
] as const;
export type DesignMdSection = (typeof DESIGN_MD_SECTIONS)[number];

export interface DesignMdOptions {
  tokenPlacement?: (typeof DESIGN_MD_PLACEMENTS)[number];
  includeProse?: boolean;
  includeDoDont?: boolean;
  includeStructure?: boolean;
  productType?: ProductType;
}

export interface DesignMd {
  format: 'design-md';
  fileName: typeof DESIGN_MD_FILE_NAME;
  content: string;
  specVersion: typeof DESIGN_MD_SPEC_VERSION;
  sections: DesignMdSection[];
  omitted: Array<{ section: DesignMdSection; reason: string }>;
  lossy: string[];
  sourceHash: string;
}

/** DESIGN.md token names, in file order, for the compose_design_tokens color roles. */
const COLOR_NAMES: ReadonlyArray<readonly [string, ColorRole]> = [
  ['primary', 'text'], ['on-primary', 'textInverse'], ['secondary', 'textMuted'],
  ['surface', 'canvas'], ['surface-container', 'surface'], ['surface-container-high', 'surfaceRaised'], ['surface-variant', 'surfaceMuted'],
  ['outline', 'borderStrong'], ['outline-variant', 'border'],
  ['accent', 'accent'], ['on-accent', 'accentText'], ['accent-secondary', 'accentSecondary'], ['on-accent-secondary', 'accentSecondaryText'],
  ['action-primary', 'actionPrimary'], ['on-action-primary', 'actionPrimaryText'],
  ['action-secondary', 'actionSecondary'], ['on-action-secondary', 'actionSecondaryText'],
  ['link', 'link'], ['focus', 'focus'],
];
const STATUS_ROLES: ReadonlySet<ColorRole> = new Set(['positive', 'caution', 'critical', 'info']);
const COMPONENT_NAMES: Readonly<Record<string, string>> = { 'primary-action': 'button-primary', 'secondary-action': 'button-secondary' };
const LEGACY_LEVELS = [
  ['display', 'displayFamily', '3xl', 'tight'], ['heading', 'displayFamily', '2xl', 'tight'], ['subheading', 'displayFamily', 'lg', 'normal'],
  ['body', 'bodyFamily', 'base', 'normal'], ['small', 'bodyFamily', 'sm', 'normal'], ['caption', 'bodyFamily', 'xs', 'normal'],
  ['data', 'monoFamily', 'sm', 'normal'],
] as const;
const DIMENSION = /^-?\d*\.?\d+(?:px|em|rem)$/;
const SCALE_ORDER = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'];

interface Labels {
  list: string;
  source: (style: string, secondary: string | undefined, revision: string | undefined, mode: string) => string;
  bothModes: string;
  profile: (headline: string, surface: string, rhythm: string) => string;
  colorsIntro: string;
  roles: Partial<Record<ColorRole, string>>;
  statusNote: string;
  intent: (typography: string) => string;
  legacyType: string;
  type: {
    weight: (value: number) => string; fluid: (min: number, max: number) => string; lineHeight: (value: number) => string;
    letterSpacing: (value: number) => string; transform: (value: string) => string; italic: string; measure: (value: number) => string;
    paragraph: (value: number) => string; tabular: string; keepAll: string;
  };
  spacing: (list: string) => string;
  density: (value: string) => string;
  structure: { title: string; hero: string; grid: string; order: string; density: string; typeScale: string; moves: string };
  mustHaves: (page: string) => string;
  mustHaveRule: string;
  noMustHaves: (type: string) => string;
  elevation: string;
  radius: (list: string) => string;
  square: string;
  borders: (width: number, style: string) => string;
  componentsIntro: string;
  on: (fg: string, bg: string) => string;
  accentFill: string;
  focusRing: string;
  otherPairs: string;
  styleRule: (rule: string) => string;
  pattern: (id: string) => string;
  allowed: (name: string, reason: string) => string;
  omitted: { noShadows: string; proseOff: string; doDontOff: string };
  lossy: {
    dark: string; status: string; motion: (duration: string, easing: string) => string; shadows: string;
    typography: (props: string, kept: boolean) => string; typeProps: Record<'fluid' | 'measure' | 'paragraph' | 'transform' | 'italic' | 'wordBreak' | 'overflowWrap', string>;
    borders: (kept: boolean) => string; pairs: (kept: boolean) => string; fonts: string; units: (values: string) => string;
  };
}

const LABELS: Record<Lang, Labels> = {
  en: {
    list: ', ',
    source: (style, secondary, revision, mode) => `Generated by web-stylebook-mcp from the ${style} style${secondary ? `, with ${secondary}'s accent as the secondary overlay` : ''}. ${revision ? `Values come from the pinned visual contract (revision ${revision}).` : 'Values are the starting tokens compose_design_tokens returns without a visual contract.'} This file describes the ${mode} theme.`,
    bothModes: 'The dark theme is not in this file; request colorMode "dark" for a second file.',
    profile: (headline, surface, rhythm) => `Visual profile: ${headline}, ${surface}, ${rhythm}.`,
    colorsIntro: 'Token names follow DESIGN.md conventions; the name in parentheses is the compose_design_tokens role.',
    roles: {
      text: 'Body text and headings.', textInverse: 'Text on a primary (ink) fill.', textMuted: 'Secondary text: captions, metadata, helper text.',
      canvas: 'Page background.', surface: 'Panels and cards.', surfaceRaised: 'Raised surfaces such as inputs, menus, and popovers.',
      surfaceMuted: 'Muted fills such as hover rows, wells, and disabled areas.', borderStrong: 'Control boundaries that must stay visible.',
      border: 'Dividers and decorative rules.', accent: "The style's identity accent.", accentText: 'Text on the accent.',
      accentSecondary: 'Secondary accent for selection and secondary surfaces, not the primary action.', accentSecondaryText: 'Text on the secondary accent.',
      actionPrimary: 'Primary button fill.', actionPrimaryText: 'Primary button label.', actionSecondary: 'Secondary button fill.',
      actionSecondaryText: 'Secondary button label.', link: 'Link text.', focus: 'Focus indicator.',
    },
    statusNote: 'Status colors (positive, caution, critical, info) are not in this file; take them from compose_design_tokens.',
    intent: (typography) => `Intended type: ${typography}.`,
    legacyType: 'These levels are starting points; confirm the faces against the intended type before use.',
    type: {
      weight: (value) => `weight ${value}`, fluid: (min, max) => `fluid ${min}–${max}rem, the token holds the maximum`,
      lineHeight: (value) => `line height ${value}`, letterSpacing: (value) => `letter spacing ${value}em`,
      transform: (value) => `text-transform ${value}`, italic: 'italic', measure: (value) => `measure ${value}ch`,
      paragraph: (value) => `paragraph spacing ${value}em`, tabular: 'tabular numerals', keepAll: 'word-break keep-all',
    },
    spacing: (list) => `Spacing tokens: ${list}.`,
    density: (value) => `Density: ${value}.`,
    structure: { title: 'Page structure', hero: 'Opening', grid: 'Grid', order: 'Section order', density: 'Density', typeScale: 'Type scale', moves: 'Signature moves' },
    mustHaves: (page) => `Must-haves on the ${page}`,
    mustHaveRule: 'The style restyles these but never removes them; every first-screen item goes in the opening.',
    noMustHaves: (type) => `No must-haves are defined for productType "${type}".`,
    elevation: 'Shadows, as CSS box-shadow values:',
    radius: (list) => `Corner radius: ${list}.`,
    square: 'Every corner is square.',
    borders: (width, style) => `Borders: ${width}px ${style}.`,
    componentsIntro: 'Each component names its text color and the background it sits on.',
    on: (fg, bg) => `${fg} on ${bg}`,
    accentFill: 'Text on an accent fill.',
    focusRing: 'Focus ring color.',
    otherPairs: 'Non-text pairs, which need 3:1 against their background:',
    styleRule: (rule) => `(style rule ${rule})`,
    pattern: (id) => `(pattern ${id})`,
    allowed: (name, reason) => `Keep the ${name.toLowerCase()} this style is built on: ${reason}`,
    omitted: {
      noShadows: 'The style uses no shadows; surfaces separate by borders and fills.',
      proseOff: 'includeProse is false and the tokens are in the front matter.',
      doDontOff: 'includeDoDont is false.',
    },
    lossy: {
      dark: 'Dark theme: DESIGN.md holds one theme, so the dark set is not in this file. Request colorMode "dark" for it.',
      status: 'Status colors (positive, caution, critical, info): not in this file.',
      motion: (duration, easing) => `Motion (${duration}, ${easing}): DESIGN.md has no motion key; not in this file.`,
      shadows: 'Shadows: DESIGN.md has no shadow key; listed under Elevation & Depth.',
      typography: (props, kept) => `Typography ${props}: DESIGN.md has no key; ${kept ? 'described under Typography' : 'not in this file'}.`,
      typeProps: { fluid: 'fluid size minimums', measure: 'measure', paragraph: 'paragraph spacing', transform: 'text-transform', italic: 'font-style', wordBreak: 'word-break', overflowWrap: 'overflow-wrap' },
      borders: (kept) => `Border width and style: DESIGN.md has no key; ${kept ? 'described under Shapes' : 'not in this file'}.`,
      pairs: (kept) => `Non-text color pairs (focus, control boundaries, separators): ${kept ? 'described under Components' : 'not in this file'}.`,
      fonts: 'Font stylesheet sources and licenses: not in this file; read visualContract.typography.fonts from compose_design_tokens.',
      units: (values) => `Values with no px, em, or rem form: ${values}.`,
    },
  },
  ko: {
    list: ', ',
    source: (style, secondary, revision, mode) => `web-stylebook-mcp가 ${style} 스타일로 만든 파일입니다${secondary ? `. ${secondary}의 강조색을 보조 오버레이로 씁니다` : ''}. ${revision ? `값은 고정한 시각 계약(revision ${revision})에서 가져왔습니다.` : '값은 시각 계약 없이 compose_design_tokens가 돌려주는 시작 토큰입니다.'} 이 파일은 ${mode === 'dark' ? '다크' : '라이트'} 테마를 담습니다.`,
    bothModes: '다크 테마는 이 파일에 없습니다. 두 번째 파일이 필요하면 colorMode "dark"로 다시 요청하세요.',
    profile: (headline, surface, rhythm) => `시각 프로필: ${headline}, ${surface}, ${rhythm}.`,
    colorsIntro: '토큰 이름은 DESIGN.md 관례를 따릅니다. 괄호 안은 compose_design_tokens의 역할 이름입니다.',
    roles: {
      text: '본문과 제목.', textInverse: '잉크색(primary) 면 위의 글자.', textMuted: '보조 글자: 캡션, 메타데이터, 도움말.',
      canvas: '페이지 배경.', surface: '패널과 카드.', surfaceRaised: '입력란, 메뉴, 팝오버처럼 떠 있는 면.',
      surfaceMuted: '호버 행, 움푹한 영역, 비활성 영역 같은 옅은 면.', borderStrong: '항상 보여야 하는 조작 요소 경계.',
      border: '구분선과 장식 선.', accent: '스타일의 정체성 강조색.', accentText: '강조색 위의 글자.',
      accentSecondary: '선택 상태와 보조 면에 쓰는 보조 강조색. 주 행동에는 쓰지 않습니다.', accentSecondaryText: '보조 강조색 위의 글자.',
      actionPrimary: '주 버튼 배경.', actionPrimaryText: '주 버튼 라벨.', actionSecondary: '보조 버튼 배경.',
      actionSecondaryText: '보조 버튼 라벨.', link: '링크 글자.', focus: '포커스 표시.',
    },
    statusNote: '상태 색(positive, caution, critical, info)은 이 파일에 없습니다. compose_design_tokens에서 가져오세요.',
    intent: (typography) => `의도한 서체: ${typography}.`,
    legacyType: '이 단계들은 시작점입니다. 쓰기 전에 의도한 서체와 맞는지 확인하세요.',
    type: {
      weight: (value) => `굵기 ${value}`, fluid: (min, max) => `유동 크기 ${min}–${max}rem, 토큰은 최댓값`,
      lineHeight: (value) => `줄 간격 ${value}`, letterSpacing: (value) => `자간 ${value}em`,
      transform: (value) => `text-transform ${value}`, italic: '기울임', measure: (value) => `행 길이 ${value}ch`,
      paragraph: (value) => `문단 간격 ${value}em`, tabular: '고정폭 숫자', keepAll: 'word-break keep-all',
    },
    spacing: (list) => `간격 토큰: ${list}.`,
    density: (value) => `밀도: ${value}.`,
    structure: { title: '페이지 구조', hero: '첫 화면', grid: '그리드', order: '섹션 순서', density: '밀도', typeScale: '타입 스케일', moves: '시그니처 무브' },
    mustHaves: (page) => `${page}의 필수 요소`,
    mustHaveRule: '스타일은 이 요소의 모양을 바꿀 수 있지만 빼면 안 됩니다. 첫 화면 항목은 모두 첫 화면에 넣으세요.',
    noMustHaves: (type) => `productType "${type}"에는 정의된 필수 요소가 없습니다.`,
    elevation: '그림자(CSS box-shadow 값):',
    radius: (list) => `모서리 반경: ${list}.`,
    square: '모든 모서리가 직각입니다.',
    borders: (width, style) => `테두리: ${width}px ${style}.`,
    componentsIntro: '컴포넌트마다 글자색과 그 글자가 놓이는 배경을 적었습니다.',
    on: (fg, bg) => `${bg} 위의 ${fg}`,
    accentFill: '강조색 면 위의 글자.',
    focusRing: '포커스 링 색.',
    otherPairs: '글자가 아닌 쌍입니다. 배경과 3:1 대비가 필요합니다:',
    styleRule: (rule) => `(스타일 규칙 ${rule})`,
    pattern: (id) => `(패턴 ${id})`,
    allowed: (name, reason) => `이 스타일의 바탕인 '${name}'은(는) 유지하세요: ${reason}`,
    omitted: {
      noShadows: '이 스타일은 그림자를 쓰지 않습니다. 면은 테두리와 채움색으로 나눕니다.',
      proseOff: 'includeProse가 false이고 토큰은 front matter에 있습니다.',
      doDontOff: 'includeDoDont가 false입니다.',
    },
    lossy: {
      dark: '다크 테마: DESIGN.md는 테마를 하나만 담으므로 다크 세트는 이 파일에 없습니다. 필요하면 colorMode "dark"로 요청하세요.',
      status: '상태 색(positive, caution, critical, info): 이 파일에 없습니다.',
      motion: (duration, easing) => `모션(${duration}, ${easing}): DESIGN.md에 모션 키가 없어 이 파일에 없습니다.`,
      shadows: '그림자: DESIGN.md에 그림자 키가 없어 Elevation & Depth에 목록으로 적었습니다.',
      typography: (props, kept) => `타이포그래피 ${props}: DESIGN.md에 키가 없습니다. ${kept ? 'Typography에 설명했습니다' : '이 파일에 없습니다'}.`,
      typeProps: { fluid: '유동 크기 최솟값', measure: '행 길이', paragraph: '문단 간격', transform: 'text-transform', italic: 'font-style', wordBreak: 'word-break', overflowWrap: 'overflow-wrap' },
      borders: (kept) => `테두리 두께와 스타일: DESIGN.md에 키가 없습니다. ${kept ? 'Shapes에 설명했습니다' : '이 파일에 없습니다'}.`,
      pairs: (kept) => `글자가 아닌 색 쌍(포커스, 조작 요소 경계, 구분선): ${kept ? 'Components에 설명했습니다' : '이 파일에 없습니다'}.`,
      fonts: '폰트 스타일시트 출처와 라이선스: 이 파일에 없습니다. compose_design_tokens의 visualContract.typography.fonts를 보세요.',
      units: (values) => `px, em, rem으로 바꿀 수 없는 값: ${values}.`,
    },
  },
  ja: {
    list: '、',
    source: (style, secondary, revision, mode) => `web-stylebook-mcpが${style}スタイルから生成したファイルです${secondary ? `。${secondary}のアクセントを補助オーバーレイとして使います` : ''}。${revision ? `値は固定したビジュアル契約(revision ${revision})から取得しています。` : '値はビジュアル契約なしでcompose_design_tokensが返す出発点のトークンです。'}このファイルは${mode === 'dark' ? 'ダーク' : 'ライト'}テーマを記述します。`,
    bothModes: 'ダークテーマはこのファイルにありません。2つ目のファイルが必要な場合はcolorMode "dark"で再度リクエストしてください。',
    profile: (headline, surface, rhythm) => `ビジュアルプロフィール: ${headline}, ${surface}, ${rhythm}。`,
    colorsIntro: 'トークン名はDESIGN.mdの慣例に従います。括弧内はcompose_design_tokensの役割名です。',
    roles: {
      text: '本文と見出し。', textInverse: 'インク色(primary)の面の上の文字。', textMuted: '補助テキスト: キャプション、メタデータ、ヘルプ。',
      canvas: 'ページ背景。', surface: 'パネルとカード。', surfaceRaised: '入力欄、メニュー、ポップオーバーなど浮いた面。',
      surfaceMuted: 'ホバー行、くぼみ、無効領域などの淡い面。', borderStrong: '常に見えている必要がある操作要素の境界。',
      border: '区切り線と装飾線。', accent: 'スタイルを象徴するアクセント。', accentText: 'アクセントの上の文字。',
      accentSecondary: '選択状態と補助的な面に使う補助アクセント。主要アクションには使いません。', accentSecondaryText: '補助アクセントの上の文字。',
      actionPrimary: '主ボタンの背景。', actionPrimaryText: '主ボタンのラベル。', actionSecondary: '副ボタンの背景。',
      actionSecondaryText: '副ボタンのラベル。', link: 'リンクの文字。', focus: 'フォーカス表示。',
    },
    statusNote: 'ステータス色(positive, caution, critical, info)はこのファイルにありません。compose_design_tokensから取得してください。',
    intent: (typography) => `意図した書体: ${typography}。`,
    legacyType: 'これらの段階は出発点です。使う前に意図した書体と合っているか確認してください。',
    type: {
      weight: (value) => `ウェイト ${value}`, fluid: (min, max) => `可変サイズ ${min}–${max}rem、トークンは最大値`,
      lineHeight: (value) => `行間 ${value}`, letterSpacing: (value) => `字間 ${value}em`,
      transform: (value) => `text-transform ${value}`, italic: 'イタリック', measure: (value) => `行長 ${value}ch`,
      paragraph: (value) => `段落間隔 ${value}em`, tabular: '等幅数字', keepAll: 'word-break keep-all',
    },
    spacing: (list) => `余白トークン: ${list}。`,
    density: (value) => `密度: ${value}。`,
    structure: { title: 'ページ構造', hero: 'ファーストビュー', grid: 'グリッド', order: 'セクション順', density: '密度', typeScale: 'タイプスケール', moves: 'シグネチャームーブ' },
    mustHaves: (page) => `${page}の必須要素`,
    mustHaveRule: 'スタイルは見た目を変えてもかまいませんが、削除してはいけません。ファーストビューの項目はすべてファーストビューに入れてください。',
    noMustHaves: (type) => `productType "${type}"には必須要素が定義されていません。`,
    elevation: '影(CSS box-shadowの値):',
    radius: (list) => `角丸: ${list}。`,
    square: 'すべての角が直角です。',
    borders: (width, style) => `枠線: ${width}px ${style}。`,
    componentsIntro: 'コンポーネントごとに文字色と、その文字が置かれる背景を示します。',
    on: (fg, bg) => `${bg}の上の${fg}`,
    accentFill: 'アクセントの面の上の文字。',
    focusRing: 'フォーカスリングの色。',
    otherPairs: '文字ではない組み合わせです。背景と3:1のコントラストが必要です:',
    styleRule: (rule) => `(スタイル規則 ${rule})`,
    pattern: (id) => `(パターン ${id})`,
    allowed: (name, reason) => `このスタイルの土台である「${name}」は残してください: ${reason}`,
    omitted: {
      noShadows: 'このスタイルは影を使いません。面は枠線と塗りで分けます。',
      proseOff: 'includeProseがfalseで、トークンはfront matterにあります。',
      doDontOff: 'includeDoDontがfalseです。',
    },
    lossy: {
      dark: 'ダークテーマ: DESIGN.mdはテーマを一つだけ持つため、ダークのセットはこのファイルにありません。必要ならcolorMode "dark"でリクエストしてください。',
      status: 'ステータス色(positive, caution, critical, info): このファイルにありません。',
      motion: (duration, easing) => `モーション(${duration}, ${easing}): DESIGN.mdにモーションのキーがないため、このファイルにありません。`,
      shadows: '影: DESIGN.mdに影のキーがないため、Elevation & Depthに一覧で記載しました。',
      typography: (props, kept) => `タイポグラフィの${props}: DESIGN.mdにキーがありません。${kept ? 'Typographyで説明しました' : 'このファイルにありません'}。`,
      typeProps: { fluid: '可変サイズの最小値', measure: '行長', paragraph: '段落間隔', transform: 'text-transform', italic: 'font-style', wordBreak: 'word-break', overflowWrap: 'overflow-wrap' },
      borders: (kept) => `枠線の太さとスタイル: DESIGN.mdにキーがありません。${kept ? 'Shapesで説明しました' : 'このファイルにありません'}。`,
      pairs: (kept) => `文字ではない色の組み合わせ(フォーカス、操作要素の境界、区切り線): ${kept ? 'Componentsで説明しました' : 'このファイルにありません'}。`,
      fonts: 'フォントのスタイルシートの出典とライセンス: このファイルにありません。compose_design_tokensのvisualContract.typography.fontsを参照してください。',
      units: (values) => `px、em、remに変換できない値: ${values}。`,
    },
  },
};

interface ColorToken { name: string; role: ColorRole; value: string }
interface TypeLevel { name: string; props: Array<[string, YamlNode]>; notes: string[] }
interface Component { name: string; fg?: ColorRole; bg: ColorRole; note?: string }
interface SectionDraft { section: DesignMdSection; prose: string[]; tokens?: YamlMap; fixed?: string[]; omitReason?: string }

/** A px, em, or rem dimension; pt converts to px. Null when the value has no such form. */
function dimension(value: string | number): string | null {
  if (typeof value === 'number') return `${value}px`;
  const trimmed = value.trim();
  if (trimmed === '0') return '0px';
  if (DIMENSION.test(trimmed)) return trimmed;
  const pt = /^(-?\d*\.?\d+)pt$/.exec(trimmed);
  return pt ? `${Number((parseFloat(pt[1]!) * 4 / 3).toFixed(4))}px` : null;
}

function selected(set: TokenSetResult): { tokens: DesignTokens; spec?: ResolvedVisualContract; mode: 'light' | 'dark' } {
  const tokens = 'color' in set.tokens ? set.tokens : set.tokens.light;
  const visual = set.visualContract;
  const spec = visual === undefined ? undefined : 'mode' in visual ? visual : visual.light;
  return { tokens, ...(spec ? { spec } : {}), mode: spec?.mode ?? (set.colorMode === 'dark' ? 'dark' : 'light') };
}

function colorTokens(tokens: DesignTokens, spec: ResolvedVisualContract | undefined): ColorToken[] {
  const source = (spec?.colors ?? tokens.color) as Partial<Record<ColorRole, string>>;
  return COLOR_NAMES.flatMap(([name, role]) => (source[role] ? [{ name, role, value: source[role]! }] : []));
}

function typeLevels(tokens: DesignTokens, spec: ResolvedVisualContract | undefined, label: Labels, extras: Set<keyof Labels['lossy']['typeProps']>, units: string[]): TypeLevel[] {
  if (!spec) {
    return LEGACY_LEVELS.flatMap(([name, family, size, leading]) => {
      const fontSize = tokens.typography.scale[size];
      if (fontSize === undefined) return [];
      const dim = dimension(fontSize);
      if (!dim) units.push(`typography.${name}.fontSize ${fontSize}`);
      const props: Array<[string, YamlNode]> = [['fontFamily', tokens.typography[family]], ...(dim ? [['fontSize', dim] as [string, YamlNode]] : [])];
      const lineHeight = tokens.typography.lineHeight[leading];
      if (lineHeight !== undefined) props.push(['lineHeight', lineHeight]);
      return [{ name, props, notes: [] }];
    });
  }
  return TYPOGRAPHY_ROLES.map((name) => {
    const role = spec.typography.roles[name];
    const props: Array<[string, YamlNode]> = [
      ['fontFamily', role.fontFamily], ['fontSize', `${role.sizeMaxRem}rem`], ['fontWeight', role.fontWeight],
      ['lineHeight', role.lineHeight], ['letterSpacing', `${role.letterSpacingEm}em`],
    ];
    if (role.fontVariantNumeric === 'tabular-nums') props.push(['fontFeature', '"tnum"']);
    const notes: string[] = [];
    if (role.sizeMinRem !== role.sizeMaxRem) { notes.push(label.type.fluid(role.sizeMinRem, role.sizeMaxRem)); extras.add('fluid'); }
    if (role.textTransform !== 'none') { notes.push(label.type.transform(role.textTransform)); extras.add('transform'); }
    if (role.fontStyle === 'italic') { notes.push(label.type.italic); extras.add('italic'); }
    if (role.wordBreak === 'keep-all') { notes.push(label.type.keepAll); extras.add('wordBreak'); }
    if (role.overflowWrap !== 'normal') extras.add('overflowWrap');
    notes.push(label.type.measure(role.measureCh), label.type.paragraph(role.paragraphSpacingEm));
    extras.add('measure').add('paragraph');
    return { name, props, notes };
  });
}

function spacingTokens(tokens: DesignTokens, spec: ResolvedVisualContract | undefined, units: string[]): Array<[string, string]> {
  const raw: Array<[string, string | number]> = spec
    ? [['unit', spec.spacing.unit], ['stack', spec.spacing.stack], ['gutter', spec.spacing.gutter], ['row', spec.spacing.row], ['section', spec.spacing.section]]
    : [...Object.entries(tokens.spacing), ...Object.entries(tokens.density).map(([key, value]): [string, string] => [key, value])];
  return raw.flatMap(([key, value]) => {
    const dim = dimension(value);
    if (!dim) units.push(`spacing.${key} ${value}`);
    return dim ? [[key, dim] as [string, string]] : [];
  });
}

function roundedTokens(tokens: DesignTokens, spec: ResolvedVisualContract | undefined, units: string[]): Array<[string, string]> {
  const rank = (key: string) => (SCALE_ORDER.includes(key) ? SCALE_ORDER.indexOf(key) : SCALE_ORDER.length);
  const raw: Array<[string, string | number]> = Object.entries<string | number>(spec ? spec.radii : tokens.radius)
    .sort(([a], [b]) => rank(a) - rank(b));
  return raw.flatMap(([key, value]) => {
    const dim = dimension(value);
    if (!dim) units.push(`rounded.${key} ${value}`);
    return dim ? [[key, dim] as [string, string]] : [];
  });
}

function components(spec: ResolvedVisualContract | undefined, colors: readonly ColorToken[], label: Labels): { list: Component[]; other: Component[] } {
  const has = (role: ColorRole) => colors.some((color) => color.role === role);
  if (!spec) {
    return {
      list: [
        { name: 'body-canvas', fg: 'text', bg: 'canvas' }, { name: 'body-panel', fg: 'text', bg: 'surface' },
        { name: 'muted-panel', fg: 'textMuted', bg: 'surface' }, { name: 'button-primary', fg: 'accentText', bg: 'accent' },
        ...(has('accentSecondary') ? [{ name: 'selection', fg: 'accentSecondaryText', bg: 'accentSecondary' } as Component] : []),
        { name: 'focus-ring', bg: 'focus', note: label.focusRing },
      ],
      other: [],
    };
  }
  const pairs = spec.components.filter((pair) => !STATUS_ROLES.has(pair.foreground) && !STATUS_ROLES.has(pair.background));
  const textPair = (kind: string) => kind === 'text' || kind === 'large-text';
  return {
    list: [
      ...pairs.filter((pair) => textPair(pair.kind)).map((pair) => ({ name: COMPONENT_NAMES[pair.id] ?? pair.id, fg: pair.foreground, bg: pair.background, note: pair.context })),
      { name: 'accent-fill', fg: 'accentText', bg: 'accent', note: label.accentFill },
      { name: 'focus-ring', bg: 'focus', note: label.focusRing },
    ],
    other: pairs.filter((pair) => !textPair(pair.kind)).map((pair) => ({ name: pair.id, fg: pair.foreground, bg: pair.background, note: pair.context })),
  };
}

function dosAndDonts(style: CatalogStyle, repo: CatalogRepository, locale: Lang, label: Labels): string[] {
  if (!hasStructureGuide(style.id)) return [];
  const structure = styleStructure(style.id, repo, locale);
  return [
    ...structure.bannedPatterns.style.map((ban) => `- Do: ${ban.fix} ${label.styleRule(ban.rule)}`),
    ...structure.bannedPatterns.allowed.map((entry) => `- Do: ${label.allowed(text(globalPattern(entry.patternId).name, locale), entry.reason)} ${label.pattern(entry.patternId)}`),
    ...structure.bannedPatterns.global.map((id) => `- Don't: ${text(globalPattern(id).name, locale)} ${label.pattern(id)}`),
  ];
}

function structureLines(style: CatalogStyle, repo: CatalogRepository, options: Required<Omit<DesignMdOptions, 'productType'>> & { productType?: ProductType }, locale: Lang, label: Labels): string[] {
  const out: string[] = [];
  if (options.includeStructure && hasStructureGuide(style.id)) {
    const { archetype, signatureMoves } = styleStructure(style.id, repo, locale);
    const s = label.structure;
    out.push(
      `### ${s.title}`, '',
      `- **${s.hero}:** ${archetype.hero}`,
      `- **${s.grid}:** ${archetype.grid}`,
      `- **${s.density}:** ${archetype.density.note}`,
      `- **${s.typeScale}:** ${archetype.typeScale.note}`,
      `- **${s.order}:**`, ...archetype.sectionOrder.map((step, index) => `  ${index + 1}. ${step}`),
      `- **${s.moves}:**`, ...signatureMoves.map((move) => `  - ${move.name}: ${move.purpose}`),
    );
  }
  if (options.includeStructure && options.productType) {
    const must = productMustHaves(options.productType, 'explicit', locale);
    if (out.length) out.push('');
    if (must.page && must.items.length) {
      out.push(`### ${label.mustHaves(must.page)}`, '', label.mustHaveRule, '', ...must.items.map((item) => `- **${item.name}**: ${item.placement} ${item.build}`));
    } else {
      out.push(label.noMustHaves(options.productType));
    }
  }
  return out;
}

function componentMap(list: readonly Component[], nameOf: (role: ColorRole) => string): YamlMap {
  return list.map((component) => [component.name, [
    ['backgroundColor', `{colors.${nameOf(component.bg)}}`],
    ...(component.fg ? [['textColor', `{colors.${nameOf(component.fg)}}`] as const] : []),
  ]] as const);
}

/** Converts a composed token set to a DESIGN.md (google-labs-code/design.md, version alpha). */
export function tokenSetToDesignMd(set: TokenSetResult, input: ComposeDesignTokensInput, repo: CatalogRepository): DesignMd {
  const style = repo.getStyle(set.primaryStyleId);
  if (!style) throw new Error(`unknown style '${set.primaryStyleId}'`);
  const locale = input.locale ?? 'en';
  const label = LABELS[locale];
  const options = {
    tokenPlacement: input.designMd?.tokenPlacement ?? 'front-matter',
    includeProse: input.designMd?.includeProse ?? true,
    includeDoDont: input.designMd?.includeDoDont ?? true,
    includeStructure: input.designMd?.includeStructure ?? true,
    ...(input.designMd?.productType ? { productType: input.designMd.productType } : {}),
  };
  const interleaved = options.tokenPlacement === 'interleaved';
  const prose = options.includeProse;
  const { tokens, spec, mode } = selected(set);
  const units: string[] = [];
  const typeExtras = new Set<keyof Labels['lossy']['typeProps']>();

  const colors = colorTokens(tokens, spec);
  const nameOf = (role: ColorRole) => {
    const found = colors.find((color) => color.role === role);
    if (!found) throw new Error(`DESIGN.md component references the missing color role '${role}'`);
    return found.name;
  };
  const levels = typeLevels(tokens, spec, label, typeExtras, units);
  const spacing = spacingTokens(tokens, spec, units);
  const rounded = roundedTokens(tokens, spec, units);
  const parts = components(spec, colors, label);
  const shadows = Object.entries(spec?.shadows ?? tokens.shadow);
  const hasShadows = shadows.some(([, value]) => value.trim() !== 'none');

  const name = `${text(style.name, locale)} (web-stylebook · ${style.id}${set.secondaryStyleId ? ` + ${set.secondaryStyleId}` : ''})`;
  const tree = {
    colors: colors.map((color) => [color.name, color.value] as const),
    typography: levels.map((level) => [level.name, level.props] as const),
    rounded,
    spacing,
    components: componentMap(parts.list, nameOf),
  } satisfies Record<string, YamlMap>;

  const overview: string[] = [];
  if (prose) {
    overview.push(`${text(style.description, locale)} ${text(style.summary, locale)}`);
    overview.push(label.source(style.id, set.secondaryStyleId, spec?.revision, mode) + (set.colorMode === 'both' ? ` ${label.bothModes}` : ''));
    overview.push(label.profile(style.visualProfile.headline, style.visualProfile.surface, style.visualProfile.rhythm));
  }

  const colorProse = prose ? [
    label.colorsIntro,
    colors.map((color) => `- **${color.name}** (${color.role}) \`${color.value}\`: ${label.roles[color.role] ?? ''}`.trimEnd()).join('\n'),
    label.statusNote,
  ] : [];

  const typeProse = prose ? [
    [label.intent(style.typography), ...(spec ? [] : [label.legacyType])].join(' '),
    levels.map((level) => {
      const props = new Map(level.props);
      const head = [String(props.get('fontFamily')), ...(props.has('fontWeight') ? [label.type.weight(Number(props.get('fontWeight')))] : []),
        ...(props.has('fontSize') ? [String(props.get('fontSize'))] : []), ...(props.has('lineHeight') ? [label.type.lineHeight(Number(props.get('lineHeight')))] : []),
        ...(props.has('letterSpacing') && props.get('letterSpacing') !== '0em' ? [label.type.letterSpacing(parseFloat(String(props.get('letterSpacing'))))] : []),
        ...(props.has('fontFeature') ? [label.type.tabular] : [])];
      return `- **${level.name}**: ${[...head, ...level.notes].join(', ')}`;
    }).join('\n'),
  ] : [];

  const layoutProse = prose ? [
    label.spacing(spacing.map(([key, value]) => `${key} ${value}`).join(', ')) + (spec ? ` ${label.density(spec.spacing.density)}` : ''),
  ] : [];
  const layoutFixed = structureLines(style, repo, options, locale, label);

  const shapeProse = prose ? [
    [rounded.every(([, value]) => parseFloat(value) === 0) ? label.square : label.radius(rounded.map(([key, value]) => `${key} ${value}`).join(', ')),
      ...(spec ? [label.borders(spec.borders.width, spec.borders.style)] : [])].join(' '),
  ] : [];

  const componentProse = prose ? [
    label.componentsIntro,
    parts.list.map((part) => `- **${part.name}**: ${part.fg ? label.on(nameOf(part.fg), nameOf(part.bg)) : nameOf(part.bg)}${part.note ? ` — ${part.note}` : ''}`).join('\n'),
    ...(parts.other.length ? [`${label.otherPairs}\n${parts.other.map((part) => `- ${label.on(nameOf(part.fg!), nameOf(part.bg))} — ${part.note}`).join('\n')}`] : []),
  ] : [];

  const drafts: SectionDraft[] = [
    { section: 'Overview', prose: overview, ...(interleaved ? { tokens: [['version', DESIGN_MD_SPEC_VERSION]] as YamlMap } : {}) },
    { section: 'Colors', prose: colorProse, ...(interleaved ? { tokens: [['colors', tree.colors]] as YamlMap } : {}) },
    { section: 'Typography', prose: typeProse, ...(interleaved ? { tokens: [['typography', tree.typography]] as YamlMap } : {}) },
    { section: 'Layout', prose: layoutProse, fixed: layoutFixed, ...(interleaved ? { tokens: [['spacing', tree.spacing]] as YamlMap } : {}) },
    hasShadows
      ? { section: 'Elevation & Depth', prose: [], fixed: [label.elevation, '', ...shadows.map(([key, value]) => `- **${key}**: \`${value}\``)] }
      : { section: 'Elevation & Depth', prose: [], omitReason: label.omitted.noShadows },
    { section: 'Shapes', prose: shapeProse, ...(interleaved ? { tokens: [['rounded', tree.rounded]] as YamlMap } : {}) },
    { section: 'Components', prose: componentProse, ...(interleaved ? { tokens: [['components', tree.components]] as YamlMap } : {}) },
    options.includeDoDont
      ? { section: "Do's and Don'ts", prose: [], fixed: dosAndDonts(style, repo, locale, label) }
      : { section: "Do's and Don'ts", prose: [], omitReason: label.omitted.doDontOff },
  ];

  const frontMatter: YamlMap = interleaved
    ? [['name', name], ['description', text(style.description, locale)]]
    : [['version', DESIGN_MD_SPEC_VERSION], ['name', name], ['description', text(style.description, locale)], ...Object.entries(tree)];
  const body: string[] = [`# ${text(style.name, locale)}`];
  const sections: DesignMdSection[] = [];
  const omitted: DesignMd['omitted'] = [];
  for (const draft of drafts) {
    const blocks = [...draft.prose, ...(draft.fixed?.length ? [draft.fixed.join('\n')] : []), ...(draft.tokens ? [`\`\`\`yaml\n${toYaml(draft.tokens)}\n\`\`\``] : [])];
    if (!blocks.length) {
      omitted.push({ section: draft.section, reason: draft.omitReason ?? label.omitted.proseOff });
      continue;
    }
    sections.push(draft.section);
    body.push(`## ${draft.section}`, ...blocks);
  }

  const lossy: string[] = [];
  if (set.colorMode === 'both') lossy.push(label.lossy.dark);
  lossy.push(label.lossy.status);
  const motion = spec ? { duration: `${spec.motion.duration}ms`, easing: spec.motion.easing } : { duration: tokens.motion.duration ?? '', easing: tokens.motion.easing ?? '' };
  lossy.push(label.lossy.motion(motion.duration, motion.easing));
  if (hasShadows) lossy.push(label.lossy.shadows);
  if (typeExtras.size) {
    const order = Object.keys(label.lossy.typeProps) as Array<keyof Labels['lossy']['typeProps']>;
    lossy.push(label.lossy.typography(order.filter((key) => typeExtras.has(key)).map((key) => label.lossy.typeProps[key]).join(label.list), prose));
  }
  if (spec) lossy.push(label.lossy.borders(prose));
  if (parts.other.length) lossy.push(label.lossy.pairs(prose));
  if (spec?.typography.fonts.length) lossy.push(label.lossy.fonts);
  if (units.length) lossy.push(label.lossy.units(units.join(', ')));

  const content = `---\n${toYaml(frontMatter)}\n---\n\n${body.join('\n\n')}\n`;
  return {
    format: 'design-md',
    fileName: DESIGN_MD_FILE_NAME,
    content,
    specVersion: DESIGN_MD_SPEC_VERSION,
    sections,
    omitted,
    lossy,
    sourceHash: stableHashOf({
      schema: DESIGN_MD_SCHEMA,
      request: { ...input, format: 'design-md', locale, designMd: options },
      catalog: repo.contentHash,
      visualContract: repo.visualContractMetadata.contentHash,
    }),
  };
}
