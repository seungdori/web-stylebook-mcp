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

- **첫 화면:** A full-width ruled cell at the top of the page grid, flush left: a boxed mono label strip, an Archivo Black h1 at 2-4.2rem over one aria-hidden uppercase word at 5-10rem that runs into the cell border and is cropped by it, a mono paragraph capped near 560px, and at most one rotated stamp. No image and no centered stack.
- **그리드:** One 12-column grid with zero gap whose cells draw 4px ink rules on their right and bottom edges, so the rules are the gutters. Full-width rows re-declare 12 columns to keep column lines aligned down the page; side-by-side content uses explicit 8/4 or 6/6 spans.
- **밀도:** High: modules butt against each other with no gaps and 14-36px of padding inside each cell, so whitespace lives inside cells, never between them, and one screen holds many declared modules.
- **타입 스케일:** Archivo Black for every loud role and mono for the rest: the h1 at 2-4.2rem, manifest titles at 1.6-2.8rem, and 2.4rem numerals that index the sections where other styles would use icons, while the opening's one cropped decorative word runs to 5-10rem. Body, labels, and data are mono at 0.6-0.88rem, with labels uppercase and widely tracked.
- **섹션 순서:**
  1. Opening cell: label strip, cropped display line, one-paragraph claim
  2. A numbered column ruler that exposes the grid under the opening
  3. Rows of flat color blocks whose spans carry real labels and values
  4. An 8/4 split of numbered rule rows beside a filled cell of hard facts
  5. A closing full-width ink bar that states the next action in uppercase
- **시그니처 무브:**
  - Zero-gap ruled cell grid: Turns each section into a declared cell, so scanning follows the rules instead of whitespace and more modules fit on a screen.
  - Numbered column ruler band: Orientation: shows the layout system as a ruler, so later spans and offsets read as measured rather than arbitrary.
  - Span-labelled value blocks: Proof and comparison: proportions become content, so features or metrics read as a measured tiling with checkable values instead of a card grid.

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
- Do: 단색 면을 쓰세요. 섹션·카드·버튼·장식 도형에 그라디언트를 쓰지 마세요. (스타일 규칙 gradient-fill)
- Do: 카드·패널·버튼·입력란·이미지의 모서리 반경을 0px 이하로 두세요. (스타일 규칙 corner-radius)
- Don't: 그라디언트 얼룩 위의 가운데 정렬 히어로 (패턴 gradient-blob-hero)
- Don't: 텍스트만 가운데로 쌓은 첫 화면 (패턴 centered-stack-hero)
- Don't: 스톡 사진 히어로 (패턴 stock-photo-hero)
- Don't: 로고 띠 (패턴 logo-strip)
- Don't: 막연한 “○○가 신뢰하는” 띠 (패턴 trusted-by-band)
- Don't: 아이콘 기능 카드 (패턴 icon-feature-grid)
- Don't: 후기 캐러셀 (패턴 testimonial-carousel)
- Don't: 막연한 마무리 CTA 배너 (패턴 closing-cta-banner)
- Don't: 일반 SaaS 페이지 골격 (패턴 generic-saas-skeleton)
