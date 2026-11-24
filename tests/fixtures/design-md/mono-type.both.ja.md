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

- **ファーストビュー:** Flush left and type only on a near-black #111111 canvas: an uppercase Space Mono kicker at 0.84rem tracked 0.18em, the product name in Space Mono 700 on two lines at clamp(2.5rem, 8vw, 6rem), and one Space Mono lead at 0.96rem within 620px, closed by a 1px rule 40px below. Directly under it sits the product's specimen sheet: its key token (a glyph pair, a command, a record id) set huge with dashed guide lines named in the margin; no image and no hue.
- **グリッド:** A single min(960px, 90vw) column with a 20px gutter. The sheet is one 1px-bordered panel; below it come numbered blocks that each open with a 1px top rule, 56px above and 28px of padding. Inside, structure is ruled grids at gap 0 within one 1px outer border (auto-fit columns of 60px, 120px, 180px, or 220px minimum) and two-track 130px | 1fr rows for history entries.
- **密度:** High: ruled grids pack dozens of cells per block on shared 1px lines instead of gutters, tables run 10-12px cell padding at 0.78-0.82rem, and history rows sit 22px apart; generous space appears only as the 56px above each block rule and the 1.85-2.2 leading of running text on the sheet.
- **タイプスケール:** Two faces with fixed jobs: Space Mono 700 sets the 2.5-6rem headline (line-height 0.95, -0.03em), the clamp(6rem, 18vw, 14rem) specimen glyph, and every label, table, button, and tab in small uppercase tracked 0.12-0.2em; Noto Sans KR 700 sets the 1.4rem section titles (1.1rem on phones) under a 0.7rem Space Mono § number line, and the 2.4-2.6rem figures and prices. Greys from #eeeeee to #6a6a6a stand in for color; emphasis is weight, underline, strike-through, or inversion.
- **セクション順:**
  1. Opening: tracked kicker, two-line Space Mono name, one lead line, and the 1px closing rule
  2. The specimen sheet: giant token with named guides, width comparison, tab ruler, a live typed line, and a dashed-top colophon
  3. Numbered blocks of ruled inventory cells: glyphs, weights, kerning pairs, or commands, each with a corner code
  4. Reference table and order form: bold property left, muted value right-aligned, bottom-rule inputs with typed prefixes
  5. Three licence tiers with + and − lists, the chosen one tinted at 4% ink and tagged SELECTED
  6. Edition history: version and date in a 130px column beside a Noto Sans KR 700 title and a muted note
- **シグネチャームーブ:**
  - Character-cell sheet with colophon: Proof of provenance: readers see the real document with its revision and date, the way an archive, docs product, or foundry should present it.
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
