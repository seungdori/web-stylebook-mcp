---
version: alpha
name: "Neumorphism (web-stylebook · neumorphism)"
description: "背景と一体化した面で光と影の浮き彫りを使うルック。"
colors:
  primary: "#344055"
  on-primary: "#e0e5ec"
  secondary: "#8a96a8"
  surface: "#e0e5ec"
  surface-container: "#e0e5ec"
  surface-container-high: "#e0e5ec"
  surface-variant: "#e0e5ec"
  outline: "#344055"
  outline-variant: "#344055"
  accent: "#1a73e8"
  on-accent: "#000000"
  accent-secondary: "#e0e5ec"
  on-accent-secondary: "#344055"
  action-primary: "#1a73e8"
  on-action-primary: "#000000"
  action-secondary: "#e0e5ec"
  on-action-secondary: "#344055"
  link: "#1a73e8"
  focus: "#1a73e8"
typography:
  display:
    fontFamily: "'Poppins', 'Noto Sans JP', sans-serif"
    fontSize: 4rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0em
  heading:
    fontFamily: "'Poppins', 'Noto Sans JP', sans-serif"
    fontSize: 2.2rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0em
  subheading:
    fontFamily: "'Poppins', 'Noto Sans JP', sans-serif"
    fontSize: 1.62rem
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: 0em
  body:
    fontFamily: "'Poppins', 'Noto Sans JP', sans-serif"
    fontSize: 1.2rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  small:
    fontFamily: "'Poppins', 'Noto Sans JP', sans-serif"
    fontSize: 1.05rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  label:
    fontFamily: "'Poppins', 'Noto Sans JP', sans-serif"
    fontSize: 1.02rem
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: 0em
  caption:
    fontFamily: "'Poppins', 'Noto Sans JP', sans-serif"
    fontSize: 0.8999999999999999rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  data:
    fontFamily: "'Noto Sans JP', ui-monospace, monospace"
    fontSize: 1.05rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
    fontFeature: "\"tnum\""
rounded:
  sm: 8px
  md: 24px
  lg: 24px
spacing:
  unit: 4px
  stack: 20px
  gutter: 24px
  row: 44px
  section: 64px
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

# Neumorphism

## Overview

背景と一体化した面で光と影の浮き彫りを使うルック。 コントロール、計算機、触覚的な設定画面に合う柔らかなハードウェア風UIです。

web-stylebook-mcpがneumorphismスタイルから生成したファイルです。値は固定したビジュアル契約(revision fnv1a:e9870591906981ee)から取得しています。このファイルはライトテーマを記述します。 ダークテーマはこのファイルにありません。2つ目のファイルが必要な場合はcolorMode "dark"で再度リクエストしてください。

ビジュアルプロフィール: soft control type, embossed panels, pressed-state rhythm。

## Colors

トークン名はDESIGN.mdの慣例に従います。括弧内はcompose_design_tokensの役割名です。

- **primary** (text) `#344055`: 本文と見出し。
- **on-primary** (textInverse) `#e0e5ec`: インク色(primary)の面の上の文字。
- **secondary** (textMuted) `#8a96a8`: 補助テキスト: キャプション、メタデータ、ヘルプ。
- **surface** (canvas) `#e0e5ec`: ページ背景。
- **surface-container** (surface) `#e0e5ec`: パネルとカード。
- **surface-container-high** (surfaceRaised) `#e0e5ec`: 入力欄、メニュー、ポップオーバーなど浮いた面。
- **surface-variant** (surfaceMuted) `#e0e5ec`: ホバー行、くぼみ、無効領域などの淡い面。
- **outline** (borderStrong) `#344055`: 常に見えている必要がある操作要素の境界。
- **outline-variant** (border) `#344055`: 区切り線と装飾線。
- **accent** (accent) `#1a73e8`: スタイルを象徴するアクセント。
- **on-accent** (accentText) `#000000`: アクセントの上の文字。
- **accent-secondary** (accentSecondary) `#e0e5ec`: 選択状態と補助的な面に使う補助アクセント。主要アクションには使いません。
- **on-accent-secondary** (accentSecondaryText) `#344055`: 補助アクセントの上の文字。
- **action-primary** (actionPrimary) `#1a73e8`: 主ボタンの背景。
- **on-action-primary** (actionPrimaryText) `#000000`: 主ボタンのラベル。
- **action-secondary** (actionSecondary) `#e0e5ec`: 副ボタンの背景。
- **on-action-secondary** (actionSecondaryText) `#344055`: 副ボタンのラベル。
- **link** (link) `#1a73e8`: リンクの文字。
- **focus** (focus) `#1a73e8`: フォーカス表示。

ステータス色(positive, caution, critical, info)はこのファイルにありません。compose_design_tokensから取得してください。

## Typography

意図した書体: Rounded sans with clear numeric hierarchy。

- **display**: 'Poppins', 'Noto Sans JP', sans-serif, ウェイト 600, 4rem, 行間 1.2, 可変サイズ 2.5–4rem、トークンは最大値, 行長 24ch, 段落間隔 1em
- **heading**: 'Poppins', 'Noto Sans JP', sans-serif, ウェイト 600, 2.2rem, 行間 1.2, 可変サイズ 1.8–2.2rem、トークンは最大値, 行長 36ch, 段落間隔 1em
- **subheading**: 'Poppins', 'Noto Sans JP', sans-serif, ウェイト 600, 1.62rem, 行間 1.65, 可変サイズ 1.38–1.62rem、トークンは最大値, 行長 42ch, 段落間隔 1em
- **body**: 'Poppins', 'Noto Sans JP', sans-serif, ウェイト 400, 1.2rem, 行間 1.65, 行長 68ch, 段落間隔 1em
- **small**: 'Poppins', 'Noto Sans JP', sans-serif, ウェイト 400, 1.05rem, 行間 1.65, 行長 72ch, 段落間隔 1em
- **label**: 'Poppins', 'Noto Sans JP', sans-serif, ウェイト 600, 1.02rem, 行間 1.65, 行長 36ch, 段落間隔 1em
- **caption**: 'Poppins', 'Noto Sans JP', sans-serif, ウェイト 400, 0.8999999999999999rem, 行間 1.65, 行長 72ch, 段落間隔 1em
- **data**: 'Noto Sans JP', ui-monospace, monospace, ウェイト 400, 1.05rem, 行間 1.65, 等幅数字, 行長 80ch, 段落間隔 1em

## Layout

余白トークン: unit 4px, stack 20px, gutter 24px, row 44px, section 64px。 密度: comfortable。

### ページ構造

- **ファーストビュー:** Left-aligned on the flat #e0e5ec canvas, never on a raised slab: a 2.5-4rem Poppins heading of a few words and one muted sentence sit beside the device's main control, a 240-280px concentric dial (raised ring, inset core, live value) that owns the right half of the frame, with an inset mode track beneath it. The first read is the dial's numeral; one raised pill button carries the only action, and no image or photo appears.
- **グリッド:** A centered container capped at 1000px (92vw on small screens) holding 1fr/1fr pairs with 24-30px gutters and 40px between pairs, each cell a single 24px-radius raised card with 30px padding; let the main control span both columns once so the page is not an even tile wall. Border width is 0 everywhere, so cell edges exist only as the paired shadow, and pairs stack to one column under 768px.
- **密度:** Low: one control per raised card with 30px of padding, 24-30px gutters, 40px between pairs, and 64px between sections, so roughly one pair fits a viewport; toggle and form rows sit at 44px with 20px stacks on a 4px unit.
- **タイプスケール:** Poppins throughout, with the 2.5-4rem weight-600 display line (-0.02em, two to three and a half times the 1.2rem body) used once and only on the flat canvas; running text stays #344055 and the muted #8a96a8 is kept for labels. Card titles are 0.75-0.85rem uppercase captions tracked about 0.1em, and hierarchy lives in numerals: a 2.8rem weight-300 reading and 1.3-1.6rem semibold values in dials and wells over 0.65rem tracked captions.
- **セクション順:**
  1. Opening: a short heading on the flat canvas beside the main dial and its live value
  2. Mode track: an inset segmented control whose single raised segment marks the current mode
  3. Readings: inset wells holding the device's current numbers over tracked micro-labels
  4. Control pairs: raised cards, each with one physical control such as a knob, slider, or toggles
  5. Setup: inset fields and one raised button labelled with what pressing it does
- **シグネチャームーブ:**
  - Concentric emboss dial: Shows the one quantity a person sets most (temperature, volume, a spending cap) as a physical control that reads at a glance.
  - Inset readout wells: Evidence a person can check: current measured state reads as instrument readouts pressed into the surface, never as vanity totals.
  - Selection by shadow inversion: Signals modes, filters, and on/off state through depth rather than color, so the single-tone surface stays intact while the current choice stays obvious.

## Elevation & Depth

影(CSS box-shadowの値):

- **sm**: `none`
- **md**: `8px 8px 16px rgba(163, 177, 198, 0.6), -8px -8px 16px rgba(255, 255, 255, 0.5)`
- **lg**: `8px 8px 16px rgba(163, 177, 198, 0.6), -8px -8px 16px rgba(255, 255, 255, 0.5)`

## Shapes

角丸: sm 8px, md 24px, lg 24px。 枠線: 0px solid。

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

- Do: ステッカーのようにずらした影を外してください。このスタイルは別の方法で奥行きを作ります。 (スタイル規則 hard-shadow)
- Do: 繰り返すカードは単色の面に置き、グラデーションは一つの領域だけにしてください。 (スタイル規則 gradient-fill)
- Do: 光彩は信号要素0個までにし、本文には使わないでください。 (スタイル規則 glow)
- Don't: グラデーションの塊に重ねた中央揃えヒーロー (パターン gradient-blob-hero)
- Don't: テキストだけを中央に積んだ冒頭 (パターン centered-stack-hero)
- Don't: ストック写真のヒーロー (パターン stock-photo-hero)
- Don't: ロゴの帯 (パターン logo-strip)
- Don't: 漠然とした「○○に信頼されています」帯 (パターン trusted-by-band)
- Don't: アイコン付き機能カード (パターン icon-feature-grid)
- Don't: お客様の声カルーセル (パターン testimonial-carousel)
- Don't: 漠然とした締めのCTAバナー (パターン closing-cta-banner)
- Don't: 汎用SaaSページの骨格 (パターン generic-saas-skeleton)
