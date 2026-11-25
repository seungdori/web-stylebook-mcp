---
name: "Brutalist Grid (web-stylebook · brutalist-grid)"
description: "회색 바탕 위의 흰 용지를 5px 검은 테두리로 감싸고 4px 검은 선으로 나눕니다. 압축 대문자와 타자체 모노 필드를 쓰며, 노랑과 빨강은 단색 블록으로만 씁니다."
---

# Brutalist Grid

## Overview

회색 바탕 위의 흰 용지를 5px 검은 테두리로 감싸고 4px 검은 선으로 나눕니다. 압축 대문자와 타자체 모노 필드를 쓰며, 노랑과 빨강은 단색 블록으로만 씁니다. 한 장의 틀 안에 기록과 집계를 담습니다. 압축 대문자, 타자체 모노 필드, 4px 선을 씁니다. 기록 보관소, 등록 명부, 시간표에 어울립니다.

web-stylebook-mcp가 brutalist-grid 스타일로 만든 파일입니다. 값은 고정한 시각 계약(revision fnv1a:cf61464e6b8958a7)에서 가져왔습니다. 이 파일은 라이트 테마를 담습니다.

시각 프로필: condensed capitals and typed mono, white sheet in a black frame, blocks on 4px rules.

```yaml
version: alpha
```

## Colors

토큰 이름은 DESIGN.md 관례를 따릅니다. 괄호 안은 compose_design_tokens의 역할 이름입니다.

- **primary** (text) `#111111`: 본문과 제목.
- **on-primary** (textInverse) `#e6e6e1`: 잉크색(primary) 면 위의 글자.
- **secondary** (textMuted) `#4d4d49`: 보조 글자: 캡션, 메타데이터, 도움말.
- **surface** (canvas) `#e6e6e1`: 페이지 배경.
- **surface-container** (surface) `#ffffff`: 패널과 카드.
- **surface-container-high** (surfaceRaised) `#ffffff`: 입력란, 메뉴, 팝오버처럼 떠 있는 면.
- **surface-variant** (surfaceMuted) `#ffffff`: 호버 행, 움푹한 영역, 비활성 영역 같은 옅은 면.
- **outline** (borderStrong) `#111111`: 항상 보여야 하는 조작 요소 경계.
- **outline-variant** (border) `#111111`: 구분선과 장식 선.
- **accent** (accent) `#d72600`: 스타일의 정체성 강조색.
- **on-accent** (accentText) `#ffffff`: 강조색 위의 글자.
- **accent-secondary** (accentSecondary) `#ffffff`: 선택 상태와 보조 면에 쓰는 보조 강조색. 주 행동에는 쓰지 않습니다.
- **on-accent-secondary** (accentSecondaryText) `#111111`: 보조 강조색 위의 글자.
- **action-primary** (actionPrimary) `#d72600`: 주 버튼 배경.
- **on-action-primary** (actionPrimaryText) `#ffffff`: 주 버튼 라벨.
- **action-secondary** (actionSecondary) `#ffffff`: 보조 버튼 배경.
- **on-action-secondary** (actionSecondaryText) `#111111`: 보조 버튼 라벨.
- **link** (link) `#d72600`: 링크 글자.
- **focus** (focus) `#d72600`: 포커스 표시.

상태 색(positive, caution, critical, info)은 이 파일에 없습니다. compose_design_tokens에서 가져오세요.

```yaml
colors:
  primary: "#111111"
  on-primary: "#e6e6e1"
  secondary: "#4d4d49"
  surface: "#e6e6e1"
  surface-container: "#ffffff"
  surface-container-high: "#ffffff"
  surface-variant: "#ffffff"
  outline: "#111111"
  outline-variant: "#111111"
  accent: "#d72600"
  on-accent: "#ffffff"
  accent-secondary: "#ffffff"
  on-accent-secondary: "#111111"
  action-primary: "#d72600"
  on-action-primary: "#ffffff"
  action-secondary: "#ffffff"
  on-action-secondary: "#111111"
  link: "#d72600"
  focus: "#d72600"
```

## Typography

의도한 서체: Condensed upper-case capitals for names and counts, a typed mono for every field.

- **display**: 'Anton', 'Black Han Sans', 'Impact', 'Arial Narrow', sans-serif, 굵기 400, 4.5rem, 줄 간격 1.2, 유동 크기 2.5–4.5rem, 토큰은 최댓값, word-break keep-all, 행 길이 18ch, 문단 간격 0.15em
- **heading**: 'Anton', 'Black Han Sans', 'Impact', 'Arial Narrow', sans-serif, 굵기 400, 1.89rem, 줄 간격 1.2, 유동 크기 1.8–1.89rem, 토큰은 최댓값, word-break keep-all, 행 길이 28ch, 문단 간격 0.4em
- **subheading**: 'Anton', 'Black Han Sans', 'Impact', 'Arial Narrow', sans-serif, 굵기 400, 1.35rem, 줄 간격 1.65, 유동 크기 1.15–1.35rem, 토큰은 최댓값, word-break keep-all, 행 길이 36ch, 문단 간격 0.45em
- **body**: 'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace, 굵기 400, 1rem, 줄 간격 1.65, word-break keep-all, 행 길이 64ch, 문단 간격 0.8em
- **small**: 'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace, 굵기 400, 0.875rem, 줄 간격 1.65, word-break keep-all, 행 길이 68ch, 문단 간격 0.6em
- **label**: 'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace, 굵기 600, 0.8125rem, 줄 간격 1.65, word-break keep-all, 행 길이 24ch, 문단 간격 0em
- **caption**: 'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace, 굵기 400, 0.75rem, 줄 간격 1.65, word-break keep-all, 행 길이 60ch, 문단 간격 0.4em
- **data**: 'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace, 굵기 400, 0.875rem, 줄 간격 1.65, 고정폭 숫자, word-break keep-all, 행 길이 70ch, 문단 간격 0.25em

```yaml
typography:
  display:
    fontFamily: "'Anton', 'Black Han Sans', 'Impact', 'Arial Narrow', sans-serif"
    fontSize: 4.5rem
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0em
  heading:
    fontFamily: "'Anton', 'Black Han Sans', 'Impact', 'Arial Narrow', sans-serif"
    fontSize: 1.89rem
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0em
  subheading:
    fontFamily: "'Anton', 'Black Han Sans', 'Impact', 'Arial Narrow', sans-serif"
    fontSize: 1.35rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  body:
    fontFamily: "'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  small:
    fontFamily: "'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  label:
    fontFamily: "'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: 0.8125rem
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: 0em
  caption:
    fontFamily: "'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
  data:
    fontFamily: "'Overpass Mono', 'Noto Sans KR', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0em
    fontFeature: "\"tnum\""
```

## Layout

간격 토큰: unit 4px, stack 20px, gutter 24px, row 44px, section 48px. 밀도: comfortable.

### 페이지 구조

- **첫 화면:** The archive's name block, flush left inside the framed sheet under a 64px header row: an Anton upper-case name at min(14rem, 16.2cqi)/0.84 across all 12 columns with its second word hollow (transparent fill, 2.5px ink stroke), a count line at min(5.5rem, 8.2cqi) over 8 columns, a red rubber stamp (4px frame with a 2px frame inside, rotated -4deg) in columns 9-12, then a mono intro in columns 1-6 capped at 34em beside a framed search field in columns 8-12. No image and no centered stack.
- **그리드:** One white sheet in a 5px ink frame on the #e6e6e1 ground; every block inside it is stacked with a 4px ink rule on its top edge and no gap. Inside a block, content sits on repeat(12, minmax(0, 1fr)) with a 24px column gap and explicit spans (1-6 beside 7-12, 1-5 beside 6-12, 1-8 beside 9-12); blocks that sit side by side are split by a 4px border-right instead of a gutter, and proportional rows use fr shares such as 731fr 341fr 212fr.
- **밀도:** Medium-high: blocks butt against each other on 4px rules with no space between them, and whitespace lives inside each block as clamp(18px, 3.4vw, 40px) side padding; table cells pad 11px 14px and every control keeps a 44px touch height, so one screen holds the count, the bars and the first listing rows.
- **타입 스케일:** Anton at its one weight, always upper case, sets the name, counts, years, headings, stamps and button words: the name at min(14rem, 16.2cqi), section headings at clamp(2.5rem, 5.4vw, 4.5rem)/0.9 with 0.005em tracking, state counts at clamp(3rem, 5vw, 4.25rem), the readers count at clamp(4.5rem, 9vw, 7.5rem) and step numerals at 2.75rem. Overpass Mono at 400, 500 and 600 types every record field, label, paragraph and control at 1rem/1.6, table heads at 500, with 0.75rem captions.
- **섹션 순서:**
  1. Header row: name mark, nav and a red submit link, split by 4px rules
  2. Name block: hollow-word name, count line, stamp, intro and search
  3. Ink band of 35 year bars with a 7-column axis, then one row of state blocks as wide as their share and an ink headline line
  4. Browse: heading and note on a 6/6 split, a ruled filter bar, a fixed-layout listing table and a pager
  5. Record sheet: a yellow facts block over 5 of 12 columns beside the history, then a ruled plan drawing
  6. Submit: an ink block, a yellow numbered steps block and a red start button overlapping on one grid
  7. Footer on the 12-column grid, 1-5 and 7-12
- **시그니처 무브:**
  - Framed sheet of rule-split blocks: Makes the page read as one filed record sheet, so each section is a declared block and the reader scans along the rules instead of through whitespace.
  - Year-bar band over share-width state blocks: Proof: the record counts are drawn at their true proportions, so the reader sees the size and split of the archive before reading a single row.
  - Overlapping ink, yellow and red submit slabs: Action: the steps and the one button sit physically on top of the reason to contribute, so the next action reads as part of the record rather than a detached banner.

### 제품 랜딩 페이지의 필수 요소

스타일은 이 요소의 모양을 바꿀 수 있지만 빼면 안 됩니다. 첫 화면 항목은 모두 첫 화면에 넣으세요.

- **코드 예시**: 첫 화면: 첫 섹션 안이나 그 위, 첫 스크롤 전. 실제 코드 조각이나 설치 명령을 pre나 code 요소에 보여 주세요.
- **문서 링크**: 첫 화면: 첫 섹션 안이나 그 위, 첫 스크롤 전. 헤더나 첫 섹션에서 문서나 API 레퍼런스로 가는 링크를 두세요.

```yaml
spacing:
  unit: 4px
  stack: 20px
  gutter: 24px
  row: 44px
  section: 48px
```

## Shapes

모든 모서리가 직각입니다. 테두리: 4px solid.

```yaml
rounded:
  sm: 0px
  md: 0px
  lg: 0px
```

## Components

컴포넌트마다 글자색과 그 글자가 놓이는 배경을 적었습니다.

- **body-canvas**: surface 위의 primary — Body copy on the page
- **body-panel**: surface-container 위의 primary — Body copy in a panel
- **muted-panel**: surface-container 위의 secondary — Supporting copy in a panel
- **button-primary**: action-primary 위의 on-action-primary — Primary button label
- **button-secondary**: action-secondary 위의 on-action-secondary — Secondary button label
- **input-placeholder**: surface-container-high 위의 secondary — Input placeholder
- **link-canvas**: surface 위의 link — Link text
- **selection**: accent-secondary 위의 on-accent-secondary — Selected item label
- **accent-fill**: accent 위의 on-accent — 강조색 면 위의 글자.
- **focus-ring**: focus — 포커스 링 색.

글자가 아닌 쌍입니다. 배경과 3:1 대비가 필요합니다:
- surface-container-high 위의 outline — Essential input boundary
- surface 위의 focus — Focus indicator adjacent to canvas
- surface-container 위의 focus — Focus indicator adjacent to panel
- surface 위의 outline-variant — Decorative separator, not a control boundary

```yaml
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
```

## Do's and Don'ts

- Do: 부드러운 그림자를 빼세요. 이 스타일처럼 선·테두리·단색 면으로 표면을 나누세요. (스타일 규칙 shadow-blur)
- Do: 카드·패널·버튼·입력란·이미지의 모서리 반경을 0px 이하로 두세요. (스타일 규칙 corner-radius)
- Do: 반복되는 카드는 단색 면에 두세요. 그라디언트는 한 영역에만 쓰세요. (스타일 규칙 gradient-fill)
- Do: 본문에는 고정폭 글꼴을 쓰세요. (스타일 규칙 typeface)
- Don't: 그라디언트 얼룩 위의 가운데 정렬 히어로 (패턴 gradient-blob-hero)
- Don't: 텍스트만 가운데로 쌓은 첫 화면 (패턴 centered-stack-hero)
- Don't: 스톡 사진 히어로 (패턴 stock-photo-hero)
- Don't: 로고 띠 (패턴 logo-strip)
- Don't: 막연한 “○○가 신뢰하는” 띠 (패턴 trusted-by-band)
- Don't: 아이콘 기능 카드 (패턴 icon-feature-grid)
- Don't: 후기 캐러셀 (패턴 testimonial-carousel)
- Don't: 막연한 마무리 CTA 배너 (패턴 closing-cta-banner)
- Don't: 일반 SaaS 페이지 골격 (패턴 generic-saas-skeleton)
