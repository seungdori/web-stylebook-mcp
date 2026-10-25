# Issue #1 상태

대상: [issue #1](https://github.com/seungdori/web-stylebook-mcp/issues/1) — canonical visual contract 소비와 토큰 출력의 스타일 충실도.

0.11.0에서 `contract`를 생략한 호출의 섀도와 에디토리얼·모노 글꼴을 작성값으로 바꿨다. 도구 입력과 `DesignTokens` 필드 이름은 그대로다. 웹사이트 비교는 테스트 시점에 네트워크를 쓰지 않고, 패키지에 핀된 픽스처를 읽는다. 픽스처의 출처는 MCP 0.10.1과 함께 공개된 웹사이트 커밋 `b6771f98480eabbe3dc602ab7c5dfd665d338178`이다.

상태 의미:

- **met**: 현재 코드가 그 기준을 만족하고, 회귀 테스트 또는 고정 산출물이 그 값을 잠근다.
- **partial**: 계약 경로 또는 문서의 일부는 만족하지만, 기준 전체가 끝나지 않았다.
- **unmet**: 기준을 만족하는 동작이나 증명이 없다.

## 요약

| # | 수용 기준 | 상태 |
| --- | --- | --- |
| 1 | 같은 계약 해시와 오버라이드에서 웹사이트와 MCP 픽스처의 색·타입·표면 역할이 일치 | met |
| 2 | `brutalist-grid`가 작성된 텍스트/액센트 역할을 유지하고 금지된 일반 소프트 섀도를 받지 않음 | met |
| 3 | 에디토리얼·모노 스타일이 불일치 메모가 아니라 작성된 타이포그래피를 유지 | met |
| 4 | 패밀리 기본값이 있어도 compact/comfortable이 문서화된 row/gutter와 간격에 도달 | met |
| 5 | CSS와 테마 출력이 기존 행간과 지원 타이포그래피 역할/메타데이터를 유지 | met |
| 6 | 명시적 `none`, 0, 오버라이드, 네이티브 모드, 로케일, both 모드가 렌더러를 통과 | met |
| 7 | 잘못된 액센트, 대비 수리, 알 수 없는 스타일, 레거시 보조 오버레이 회귀가 통과 | met |
| 8 | 알 수 없는 리비전/스키마와 안전하지 않은 값이 네트워크 폴백 없이 실패 | met |
| 9 | 기존 클라이언트 호환 경로가 테스트되고, 릴리스 노트가 기본값·추가 필드를 설명 | met |
| 10 | 라이선스/출처 검사가 통과하고 제한된 사이트·폰트·이미지가 번들에 없음 | met |
| 11 | 시작 비용, 호출 비용, 패키지/산출물/응답 크기의 기준선과 예산이 있음 | met |
| 12 | 선택한 계약 요청이 요청한 내용만 반환하고 전체 스타일/레퍼런스/로케일을 덤프하지 않음 | met |

## 기준별 근거

### 1. 웹사이트·MCP 픽스처 일치 — met

`tests/fixtures/website-visual-parity.v1.json`은 위 웹사이트 리비전에서 `resolveVisualContract`와 `visualContractToCss`로 만든 결과다. 스타일은 `brutalist-grid`, 에디토리얼 계열과 `fusion-editorial-terminal`, 모노스페이스가 본문 또는 디스플레이를 이끄는 스타일, 그리고 계열 글꼴이 남아야 하는 대조군 `quiet-utility`다. 지원 모드와 동일한 색·본문·밀도 오버라이드가 들어 있다.

`tests/website-parity.test.ts`는 이 파일을 읽고 `compose_design_tokens`의 계약 경로 JSON·`visualContract`·CSS와 깊은 동등성으로 비교한다. 테스트는 `fetch`를 가로채 호출이 없으면 통과한다. 저장소 CI는 여전히 웹사이트의 `npm run quality:parity`를 실행하지 않는다. 그 명령은 웹사이트 쪽에서 최신 트리를 볼 때 쓰는 검사고, 이 패키지의 증명 범위는 핀된 리비전의 아티팩트다.

### 2. `brutalist-grid` 텍스트·액센트·소프트 섀도 — met

계약 경로는 핀된 라이트 모드에서 텍스트 `#111`, 액센트 `#d72600`, 섀도 `none`이다. `tests/issue-1-regressions.test.ts`가 JSON, CSS, TypeScript, Tailwind에서 일반 소프트 섀도 문자열이 없음을 본다.

`contract`를 생략해도 같다. `src/tokens/compile.ts`의 `buildTokens`는 스타일에 핀된 계약이 있으면 그 모드의 작성 섀도를 호환 토큰에 복사한다. 모드 레시피에 섀도가 없으면 계약 공통 섀도를 쓴다. `brutalist-grid`는 `none`이다. `tests/website-parity.test.ts`가 일반 소프트 섀도 세 문자열이 기본 렌더에 없고, 픽스처 섀도와 같음을 본다. 색 합성, 타입 스케일, 행간은 레거시 값으로 남는다.

### 3. 에디토리얼·모노 타이포그래피 — met

계약 경로는 이전과 같이 작성된 역할을 쓴다. `tests/visual-token-fidelity.test.ts`가 `editorial-silence`의 세리프 디스플레이와 모노 본문을 잠근다.

기본 경로도 이제 작성 글꼴을 낸다. 대상은 에디토리얼 패밀리, 아이디에 `editorial` 또는 `mono`가 있는 스타일, 그리고 디스플레이나 본문 패밀리가 monospace/courier인 스타일이다. `editorial-silence`는 `'Noto Serif KR'`과 `'Instrument Sans'`, `mono-type`은 `'Space Mono'`, `brutalist-grid` 본문은 `'IBM Plex Mono'`이다. 패밀리 `tokenDefaults`와 다르면 그 차이를 테스트가 요구한다. 노트는 불일치를 경고하는 대신 작성 글꼴을 썼다고 말한다.

에디토리얼·모노가 아닌 스타일의 글꼴은 패밀리 기본값이다. `quiet-utility`가 그 대조군이고, `midnight-noir`의 세리프 불일치 노트는 그대로다.

### 4. compact/comfortable의 row·gutter — met

레거시 `buildTokens`는 패밀리 density를 먼저 펼친 뒤, 요청이 있을 때만 `row`/`gutter`를 덮어쓴다. 생략하면 패밀리 값과 추가 키가 남는다. 계약 리졸버는 `overrides.density`가 있으면 `compact`를 row 32 / gutter 12 / stack 12, `comfortable`을 row 44 / gutter 24 / stack 20으로 둔다.

`tests/legacy-token-fidelity.test.ts`와 `tests/issue-1-regressions.test.ts`가 적대적 패밀리 density 위에서의 덮어쓰기를 본다. 이번 섀도·글꼴 변경은 그 밀도 규칙을 바꾸지 않는다.

### 5. 행간이 JSON·CSS·TypeScript·Tailwind에 있음 — met

레거시 `flatten`은 `line-height-*`를 만들고, Tailwind 테마는 `lineHeight`를 포함한다. 계약 CSS는 `--line-height-tight|normal|relaxed`와 `--type-<role>-line-height`를 같이 낸다. `tests/issue-1-regressions.test.ts`는 레거시 1.2/1.5/1.7과 계약 경로의 작성 행간을 네 포맷에서 본다. `tests/website-parity.test.ts`는 기본 경로의 행간이 1.2/1.5/1.7로 남는지도 본다.

### 6. `none`, 0, 오버라이드, 네이티브 모드, 로케일, both — met

`tests/issue-1-regressions.test.ts`와 `tests/visual-token-fidelity.test.ts`, `tests/visual-protocol.test.ts`가 기존 계약을 유지한다. 핀된 픽스처의 편집 케이스는 같은 텍스트 `#101010`, 본문 행간 1.8, 자간 0, compact 밀도를 웹사이트 해석 결과와 비교한다.

### 7. 기존 회귀 — met

빈 문자열·`red` 액센트 거부, 대비 수리, 알 수 없는 스타일, 레거시 `secondaryStyleId`의 액센트 전용 오버레이는 기존 테스트가 본다. 보조 스타일은 글꼴과 섀도를 바꾸지 않는다. `tests/edge-cases.test.ts`의 세리프 노트는 패밀리 글꼴이 남은 스타일에만 붙는다.

### 8. 알 수 없는 리비전·스키마·위험 값 — met

스키마, 해시, 리비전, CSS/URL 주입, 밀도 충돌은 `tests/visual-token-fidelity.test.ts`와 `tests/visual-protocol.test.ts`가 본다. 컴파일러와 리졸버에 `fetch`가 없고, 로드 실패 문구는 `Runtime network fallback is disabled`이다. 패리티 테스트도 `fetch` 호출이 0인지 확인한다.

### 9. 호환 경로와 릴리스 노트 — met

`contract`를 생략하면 `visualContract`를 붙이지 않고 레거시 토큰 객체를 반환한다. 0.11.0은 그 객체 안에서 섀도와 에디토리얼·모노 글꼴 값만 작성값으로 바꾼다. `CHANGELOG.md`의 0.11.0 절이 깨지는 출력, 유지되는 필드, 이전 문자열을 클라이언트가 직접 고정해야 하는 이전 방법을 적는다. `README.md`와 `README.ko.md`도 같은 기본값을 설명한다.

### 10. 라이선스·출처·번들 제한 — met

`tests/visual-token-fidelity.test.ts`와 `tests/visual-source-sync.test.ts`가 출처 해시와 MIT 경계를 본다. 픽스처는 `tests/`에만 있고 `package.json`의 `files`에 없다. 폰트 바이너리와 사이트 이미지는 추가하지 않았다.

### 11. 비용·크기 예산 — met

기준선과 예산은 `docs/visual-contract-rollout.md`와 `scripts/benchmark-visual.mjs`에 있다. 이번 변경은 응답 필드를 추가하지 않고, 기본 경로의 섀도·글꼴 문자열만 바꾼다. 테스트 픽스처는 게시 패키지에 들어가지 않는다. CI는 그 스크립트를 매 커밋 실행하지 않는다.

### 12. 선택 계약만 반환 — met

`composeContractTokens`는 요청한 스타일, 모드, 로케일만 해석한다. `tests/visual-protocol.test.ts`가 `modes`/`styles` 덤프가 없고 매니페스트는 개수와 해시만 돌려주는지 본다. 패리티 테스트도 케이스마다 그 스타일의 해석 결과만 비교한다.

## 이번 변경

- `src/tokens/compile.ts`: 계약이 없는 호출이 핀된 작성 섀도를 쓰고, 에디토리얼·모노 스타일은 작성 글꼴을 쓴다.
- `tests/fixtures/website-visual-parity.v1.json`, `tests/website-parity.test.ts`: 웹사이트 리비전 `b6771f9`의 계약 경로 출력과 기본 경로의 섀도·글꼴을 비교한다.
- 패키지 버전 `0.13.0`. 정규 카탈로그 버전은 `0.10.1`이다. `v0.11.0`은 게시되지 않았다. `CHANGELOG.md`, `README.md`, `README.ko.md`.

입력 스키마와 `DesignTokens` 키, 계약 경로의 해석 결과는 바꾸지 않았다.

## 기준 밖에 둔 항목

`compare_design_directions`의 `secondaryStyleId`는 토큰 액센트가 아니라 추천 축을 합친다. 이슈의 열두 기준에 없고, 비교 도구의 공개 결과를 바꾸지 않았다.
