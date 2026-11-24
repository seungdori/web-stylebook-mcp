---
version: alpha
name: "Mono Type (web-stylebook · mono-type)"
description: "文字のサイズと太さだけで階層を作るモノクロームスタイル。"
colors:
  primary: "#1a1a1a"
  on-primary: "#f4f3ef"
  secondary: "#5a5a5a"
  surface: "#f4f3ef"
  surface-container: "#f4f3ef"
  surface-container-high: "#f4f3ef"
  surface-variant: "#f4f3ef"
  outline: "#1a1a1a"
  outline-variant: "#0000002e"
  accent: "#1a1a1a"
  on-accent: "#ffffff"
  accent-secondary: "#f4f3ef"
  on-accent-secondary: "#1a1a1a"
  action-primary: "#1a1a1a"
  on-action-primary: "#ffffff"
  action-secondary: "#f4f3ef"
  on-action-secondary: "#1a1a1a"
  link: "#1a1a1a"
  focus: "#1a1a1a"
typography:
  display:
    fontFamily: "'Space Mono', 'Noto Sans JP', monospace"
    fontSize: 6rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0em
  heading:
    fontFamily: "'Space Mono', 'Noto Sans JP', monospace"
    fontSize: 2.52rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0em
  subheading:
    fontFamily: "'Space Mono', 'Noto Sans JP', monospace"
    fontSize: 1.296rem
    fontWeight: 700
    lineHeight: 1.65
    letterSpacing: 0em
  body:
    fontFamily: "'Noto Sans JP', sans-serif"
    fontSize: 0.96rem
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: 0em
  small:
    fontFamily: "'Noto Sans JP', sans-serif"
    fontSize: 0.84rem
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: 0em
  label:
    fontFamily: "'Noto Sans JP', sans-serif"
    fontSize: 0.8125rem
    fontWeight: 700
    lineHeight: 1.65
    letterSpacing: 0em
  caption:
    fontFamily: "'Noto Sans JP', sans-serif"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  data:
    fontFamily: "'Space Mono', 'Noto Sans JP', monospace"
    fontSize: 0.84rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
    fontFeature: "\"tnum\""
rounded:
  sm: 0px
  md: 0px
  lg: 0px
spacing:
  unit: 4px
  stack: 20px
  gutter: 24px
  row: 44px
  section: 48px
components:
  body-canvas:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
  body-panel:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.primary}"
  muted-panel:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.secondary}"
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.on-action-primary}"
  button-secondary:
    backgroundColor: "{colors.action-secondary}"
    textColor: "{colors.on-action-secondary}"
  input-placeholder:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.secondary}"
  link-canvas:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.link}"
  selection:
    backgroundColor: "{colors.accent-secondary}"
    textColor: "{colors.on-accent-secondary}"
  accent-fill:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  focus-ring:
    backgroundColor: "{colors.focus}"
---

# Mono Type

## Overview

文字のサイズと太さだけで階層を作るモノクロームスタイル。 色や装飾に頼らず、タイポグラフィそのものがUIになります。

web-stylebook-mcpがmono-typeスタイルから生成したファイルです。値は固定したビジュアル契約(revision fnv1a:ff1ac85f7985e38a)から取得しています。このファイルはライトテーマを記述します。 ダークテーマはこのファイルにありません。2つ目のファイルが必要な場合はcolorMode "dark"で再度リクエストしてください。

ビジュアルプロフィール: type-only hierarchy, monochrome slabs, reading rhythm。

## Colors

トークン名はDESIGN.mdの慣例に従います。括弧内はcompose_design_tokensの役割名です。

- **primary** (text) `#1a1a1a`: 本文と見出し。
- **on-primary** (textInverse) `#f4f3ef`: インク色(primary)の面の上の文字。
- **secondary** (textMuted) `#5a5a5a`: 補助テキスト: キャプション、メタデータ、ヘルプ。
- **surface** (canvas) `#f4f3ef`: ページ背景。
- **surface-container** (surface) `#f4f3ef`: パネルとカード。
- **surface-container-high** (surfaceRaised) `#f4f3ef`: 入力欄、メニュー、ポップオーバーなど浮いた面。
- **surface-variant** (surfaceMuted) `#f4f3ef`: ホバー行、くぼみ、無効領域などの淡い面。
- **outline** (borderStrong) `#1a1a1a`: 常に見えている必要がある操作要素の境界。
- **outline-variant** (border) `#0000002e`: 区切り線と装飾線。
- **accent** (accent) `#1a1a1a`: スタイルを象徴するアクセント。
- **on-accent** (accentText) `#ffffff`: アクセントの上の文字。
- **accent-secondary** (accentSecondary) `#f4f3ef`: 選択状態と補助的な面に使う補助アクセント。主要アクションには使いません。
- **on-accent-secondary** (accentSecondaryText) `#1a1a1a`: 補助アクセントの上の文字。
- **action-primary** (actionPrimary) `#1a1a1a`: 主ボタンの背景。
- **on-action-primary** (actionPrimaryText) `#ffffff`: 主ボタンのラベル。
- **action-secondary** (actionSecondary) `#f4f3ef`: 副ボタンの背景。
- **on-action-secondary** (actionSecondaryText) `#1a1a1a`: 副ボタンのラベル。
- **link** (link) `#1a1a1a`: リンクの文字。
- **focus** (focus) `#1a1a1a`: フォーカス表示。

ステータス色(positive, caution, critical, info)はこのファイルにありません。compose_design_tokensから取得してください。

## Typography

意図した書体: Mono or grotesk type with strict weights。

- **display**: 'Space Mono', 'Noto Sans JP', monospace, ウェイト 700, 6rem, 行間 1.2, 可変サイズ 2.5–6rem、トークンは最大値, 行長 18ch, 段落間隔 0.15em
- **heading**: 'Space Mono', 'Noto Sans JP', monospace, ウェイト 700, 2.52rem, 行間 1.2, 可変サイズ 1.8–2.52rem、トークンは最大値, 行長 28ch, 段落間隔 0.4em
- **subheading**: 'Space Mono', 'Noto Sans JP', monospace, ウェイト 700, 1.296rem, 行間 1.65, 可変サイズ 1.104–1.296rem、トークンは最大値, 行長 36ch, 段落間隔 0.45em
- **body**: 'Noto Sans JP', sans-serif, ウェイト 400, 0.96rem, 行間 1.85, 行長 64ch, 段落間隔 0.8em
- **small**: 'Noto Sans JP', sans-serif, ウェイト 400, 0.84rem, 行間 1.85, 行長 68ch, 段落間隔 0.6em
- **label**: 'Noto Sans JP', sans-serif, ウェイト 700, 0.8125rem, 行間 1.65, 行長 24ch, 段落間隔 0em
- **caption**: 'Noto Sans JP', sans-serif, ウェイト 400, 0.75rem, 行間 1.65, 行長 60ch, 段落間隔 0.4em
- **data**: 'Space Mono', 'Noto Sans JP', monospace, ウェイト 400, 0.84rem, 行間 1.65, 等幅数字, 行長 70ch, 段落間隔 0.25em

## Layout

余白トークン: unit 4px, stack 20px, gutter 24px, row 44px, section 48px。 密度: comfortable。

### ページ構造

- **ファーストビュー:** Flush left and type only: a small uppercase mono label, a two-line Space Mono 700 headline at 2.5-6rem, and one lead line within 620px, closed by a hairline. Directly below, the product's own token (a command, a record id, a glyph pair) is set huge on a character-cell sheet with labelled guide lines naming its parts, followed by one inverting text button; no image and no hue.
- **グリッド:** A narrow min(960px, 90vw) column of full-width blocks, each opened by a 1px top rule with 56px above and 28px of padding. Inside, structure is ruled tables with zero gap: auto-fit minmax(60-260px, 1fr) cells sharing 1px borders within one outer border, plus two-track 130px | 1fr rows for lists and changelogs.
- **密度:** High: 10-22px rows, tiny uppercase labels, and ruled tables that pack dozens of cells per block on shared 1px rules instead of gutters; generous space appears only as the 56px above each block rule and the 1.85-2.2 leading of running text.
- **タイプスケール:** Type is the only hierarchy: Space Mono 700 display at 2.5-6rem (about six times the 0.96rem body) with 0.95 leading and -0.03em tracking, 1.4rem bold block titles, 2.4-2.6rem bold numerals, and every label in small uppercase mono tracked 0.08-0.2em. Grays from #eee to #6a6a6a stand in for color; emphasis is weight, underline, strike-through, or italic.
- **セクション順:**
  1. Opening: mono label, bold two-line headline, one lead line, the product token with anatomy guides
  2. The working document on one bordered sheet with running heads and a colophon row
  3. Ruled index of every command, endpoint, or term, each cell carrying a corner code
  4. Reference table: bold property left, muted value right-aligned, solid rule under the header
  5. Edition history: version and date beside each change, replaced words struck through
  6. Start row: the install or request command in a bordered block beside an inverting button
- **シグネチャームーブ:**
  - Character-cell sheet with colophon: Proof of provenance: readers see the real document with its revision and date, the way an archive or docs product should present it.
  - Giant token with hung guides: Opening: measures the product's own token in place of a picture and teaches the vocabulary the rest of the page relies on.
  - Corner-coded inventory cells: Capabilities at a glance: a dense, scannable index of everything on offer (commands, endpoints, glyphs, SKUs) with lookup codes and a colorless active state.

## Shapes

すべての角が直角です。 枠線: 1px solid。

## Components

コンポーネントごとに文字色と、その文字が置かれる背景を示します。

- **body-canvas**: surfaceの上のprimary — Body copy on the page
- **body-panel**: surface-containerの上のprimary — Body copy in a panel
- **muted-panel**: surface-containerの上のsecondary — Supporting copy in a panel
- **button-primary**: action-primaryの上のon-action-primary — Primary button label
- **button-secondary**: action-secondaryの上のon-action-secondary — Secondary button label
- **input-placeholder**: surface-container-highの上のsecondary — Input placeholder
- **link-canvas**: surfaceの上のlink — Link text
- **selection**: accent-secondaryの上のon-accent-secondary — Selected item label
- **accent-fill**: accentの上のon-accent — アクセントの面の上の文字。
- **focus-ring**: focus — フォーカスリングの色。

文字ではない組み合わせです。背景と3:1のコントラストが必要です:
- surface-container-highの上のoutline — Essential input boundary
- surfaceの上のfocus — Focus indicator adjacent to canvas
- surface-containerの上のfocus — Focus indicator adjacent to panel
- surfaceの上のoutline-variant — Decorative separator, not a control boundary

## Do's and Don'ts

- Do: 無彩色だけを使い、強調は太さ・大きさ・余白で行ってください。 (スタイル規則 accent-hues)
- Do: 柔らかい影を外し、このスタイルのように罫線・枠線・単色の面で面を分けてください。 (スタイル規則 shadow-blur)
- Do: カード・パネル・ボタン・入力欄・画像の角丸を0px以下にしてください。 (スタイル規則 corner-radius)
- Don't: グラデーションの塊に重ねた中央揃えヒーロー (パターン gradient-blob-hero)
- Don't: テキストだけを中央に積んだ冒頭 (パターン centered-stack-hero)
- Don't: ストック写真のヒーロー (パターン stock-photo-hero)
- Don't: ロゴの帯 (パターン logo-strip)
- Don't: 漠然とした「○○に信頼されています」帯 (パターン trusted-by-band)
- Don't: アイコン付き機能カード (パターン icon-feature-grid)
- Don't: お客様の声カルーセル (パターン testimonial-carousel)
- Don't: 漠然とした締めのCTAバナー (パターン closing-cta-banner)
- Don't: 汎用SaaSページの骨格 (パターン generic-saas-skeleton)
