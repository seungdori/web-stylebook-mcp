# Issue #1 상태

대상: [issue #1](https://github.com/seungdori/web-stylebook-mcp/issues/1) — canonical visual contract 소비와 토큰 출력의 스타일 충실도.

감사 기준 커밋: `master`의 `2f1b2be` (`fix: sync portable CJK font contracts for 0.10.1`). 판정은 그 코드와 이 브랜치의 회귀 테스트를 대조한 결과다. 웹사이트를 다시 받지 않았고, 공개 시그니처와 `contract`를 생략한 기본 토큰 값은 바꾸지 않았다.

상태 의미:

- **met**: 현재 코드가 그 기준을 만족하고, 회귀 테스트 또는 고정 산출물이 그 값을 잠근다.
- **partial**: 계약 경로 또는 문서의 일부는 만족하지만, 기준 전체가 끝나지 않았다.
- **unmet**: 기준을 만족하는 동작이나 증명이 없다.

## 요약

| # | 수용 기준 | 상태 |
| --- | --- | --- |
| 1 | 같은 계약 해시와 오버라이드에서 웹사이트와 MCP 픽스처의 색·타입·표면 역할이 일치 | partial |
| 2 | `brutalist-grid`가 작성된 텍스트/액센트 역할을 유지하고 금지된 일반 소프트 섀도를 받지 않음 | partial |
| 3 | 에디토리얼·모노 스타일이 불일치 메모가 아니라 작성된 타이포그래피를 유지 | partial |
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

### 1. 웹사이트·MCP 픽스처 일치 — partial

패키지 안에서는 맞다. `tests/visual-token-fidelity.test.ts`의 `uses the same resolver for every style and every supported locale/mode`는 번들된 48개 스타일의 지원 모드와 `en`/`ko`/`ja`, 그리고 동일한 오버라이드를 `resolveContract`와 `composeDesignTokens`에 넣어 깊은 동등성으로 비교한다. 아티팩트 해시는 `generated/visual-contracts.v1.json`의 `contentHash`이고, `generated/visual-contract-source.v1.json`의 `artifactHash`가 그 바이트와 맞아야 `src/catalog/visual.ts`의 `VisualContractRepository.load`가 성공한다.

끝나지 않은 부분: 이 저장소 CI(`.github/workflows/ci.yml`)는 웹사이트 저장소의 `npm run quality:parity`를 실행하지 않는다. 그 명령은 `docs/visual-contract-rollout.md`에 웹사이트 쪽에서 실행한다고만 적혀 있다. 이번 감사는 네트워크로 웹사이트 픽스처를 다시 가져오지 않았으므로, 증명은 “핀된 복사본과 공유 리졸버의 일치”까지다. 별도의 웹사이트 골든 파일 재비교는 남았다.

### 2. `brutalist-grid` 텍스트·액센트·소프트 섀도 — partial

계약 경로는 만족한다. 핀된 계약의 라이트 모드 색은 텍스트 `#111`, 액센트 `#d72600`이고 `shadows`는 `sm`/`md`/`lg` 모두 `none`이다 (`generated/visual-contracts.v1.json`의 `brutalist-grid`). `src/tokens/visual.ts`의 `visualToLegacyTokens`는 그 섀도를 호환 토큰에 그대로 복사한다. `tests/issue-1-regressions.test.ts`는 JSON, CSS, TypeScript, Tailwind 렌더 결과에 `none`이 있고, 레거시 일반 섀도 문자열 `0 1px 2px rgba(0,0,0,0.06)`, `0 4px 12px rgba(0,0,0,0.10)`, `0 12px 32px rgba(0,0,0,0.16)`이 없는지 확인한다.

레거시 경로는 그대로다. `contract`가 없으면 `src/tokens/compile.ts`의 `buildTokens`가 스타일과 무관하게 위 세 소프트 섀도를 넣는다. 이슈는 레거시 요청이 이전 기본값을 유지할 수 있다고 했고, 이번 작업도 기본 출력을 바꾸지 않는다. 그래서 기본 `compose_design_tokens`의 `brutalist-grid`는 여전히 일반 소프트 섀도를 받는다. 이 값을 `none`으로 바꾸는 것은 기본 출력 변경이라 하지 않았다.

### 3. 에디토리얼·모노 타이포그래피 — partial

계약 경로는 작성된 역할을 쓴다. `src/visual-canonical/resolve.ts`는 팔레트 순서나 패밀리 기본 폰트로 역할을 다시 만들지 않고, 모드 레시피와 로케일 조정, 유효한 오버라이드만 적용한다. `tests/visual-token-fidelity.test.ts`의 `preserves the authored Editorial and mono typography rather than family substitutions`가 `editorial-silence`의 세리프 디스플레이와 모노 본문 패밀리를 잠근다.

레거시 경로는 여전히 패밀리 `tokenDefaults` 폰트와 고정 스케일/행간을 쓰고, `compile.ts`의 타이포그래피 노트만 불일치를 알린다. 노트는 값을 바꾸지 않는다. 이 기본 폰트를 스타일별 작성 폰트로 바꾸는 것도 기본 출력 변경이라 하지 않았다.

### 4. compact/comfortable의 row·gutter — met

레거시 `buildTokens`는 패밀리 density를 먼저 펼친 뒤, 요청이 있을 때만 `row`/`gutter`를 덮어쓴다. 생략하면 패밀리 값과 추가 키가 남는다. 계약 리졸버는 `overrides.density`가 있으면 `compact`를 row 32 / gutter 12 / stack 12, `comfortable`을 row 44 / gutter 24 / stack 20으로 둔다 (`src/visual-canonical/resolve.ts`).

`tests/legacy-token-fidelity.test.ts`가 패밀리 기본값 `51px`/`23px` 위에서의 레거시 덮어쓰기를 본다. `tests/issue-1-regressions.test.ts`는 `brutalist-grid` 패밀리 density를 `99px`/`77px`로 바꾼 픽스처에서 레거시 생략·compact·comfortable과, 계약 경로의 row/gutter/stack 및 CSS `--density-row`/`--spacing-row`를 본다. 적대적 패밀리 값은 계약 렌더 결과에 나타나지 않는다.

### 5. 행간이 JSON·CSS·TypeScript·Tailwind에 있음 — met

레거시 `flatten`은 `line-height-*`를 만들고, Tailwind 테마는 `lineHeight`를 포함한다 (`src/tokens/compile.ts`). 계약 CSS는 `--line-height-tight|normal|relaxed`와 `--type-<role>-line-height`를 같이 낸다 (`src/visual-canonical/export.ts`). Tailwind 계약 테마는 `roleStyles`, `extend.fontSize[*][1].lineHeight`, `metadata`에 역할 행간을 둔다. JSON과 TypeScript는 해석된 계약 전체다.

`tests/issue-1-regressions.test.ts`는 레거시 1.2/1.5/1.7을 네 포맷과 `light`/`both`에서 확인하고, 계약 경로의 작성값 디스플레이 `0.82`와 본문 `1.65`가 네 포맷에 남는지도 확인한다. 컴포넌트 역할 쌍은 CSS 스칼라로 풀지 않고 컴패니언에 남긴다. 이것은 `export.ts`와 `docs/visual-contract-rollout.md`에 적힌 형식 한계다.

### 6. `none`, 0, 오버라이드, 네이티브 모드, 로케일, both — met

`brutalist-grid` 작성값은 반지름 0, 모션 duration 0, `reducedMotion: "none"`, 섀도 `none`, 본문 `letterSpacingEm: 0`, `textTransform: "none"`이다. `tests/issue-1-regressions.test.ts`는 이 값과 명시적 `paragraphSpacingEm: 0`이 JSON 숫자 0, CSS `0px`/`0ms`/`0em`/`none`, TypeScript, Tailwind `extend`와 `metadata`에 남는지 본다.

추가로 이미 있는 테스트:

- 모드별로 다른 타이포그래피·모션·보더 0과 섀도 `none`: `tests/visual-token-fidelity.test.ts`의 both-mode 케이스
- 로케일 역할 차이와 명시적 디스플레이 오버라이드: 같은 파일의 로케일 케이스
- 네이티브 모드: `tests/visual-protocol.test.ts`가 `colorMode` 생략 결과를 스타일 리소스의 `visualContract.mode`와 비교

### 7. 기존 회귀 — met

유지되는 테스트:

- 빈 문자열·`red` 액센트 거부: `tests/edge-cases.test.ts`, `tests/contract.test.ts`
- 대비 수리와 액센트 정체성 분리: `tests/visual-token-fidelity.test.ts`의 accepted repairs, `src/tokens/compile.ts`의 `buildColor` focus 수리
- 알 수 없는 스타일과 알 수 없는 `secondaryStyleId`: `tests/audit-regression.test.ts`
- 레거시 보조 오버레이가 `accentSecondary`를 추가: `tests/edge-cases.test.ts`, `tests/contract.test.ts`
- 이번 추가 테스트는 그 오버레이가 액센트 쌍 외의 토큰을 바꾸지 않는지까지 잠근다

### 8. 알 수 없는 리비전·스키마·위험 값 — met

`src/tokens/visual.ts`는 스키마가 `webstylebook.visual.v1`이 아니거나 번들 해시/리비전이 아니면 `TokenError`를 던지고, 계약 모드의 `secondaryStyleId`도 거부한다. `src/catalog/visual.ts`의 로드 실패 메시지는 `Runtime network fallback is disabled`이다. 컴파일러와 리졸버에 `fetch`가 없다. `tests/visual-token-fidelity.test.ts`와 `tests/visual-protocol.test.ts`가 스키마, 해시, 리비전, CSS/URL 주입, 밀도 충돌을 본다.

### 9. 호환 경로와 릴리스 노트 — met

`contract`를 생략하면 `composeDesignTokens`가 레거시 `buildTokens`로 가고 `visualContract`를 붙이지 않는다. `tests/visual-protocol.test.ts`의 `keeps the existing invocation available without opting into a contract`와 `tests/legacy-token-fidelity.test.ts`가 그 경로를 본다.

동작 설명은 `README.md`, `README.ko.md`, `docs/visual-contract-rollout.md`에 있다. 변경 이력에는 0.10.0 절이 비어 있어서, 이번 감사에서 `CHANGELOG.md`에 추가 필드(`contract`, `visualContract`, `repairProposals`), 명시적 density의 row/gutter 변경, 그리고 생략 시 이전 기본값 유지를 적었다. 런타임 기본 출력은 바꾸지 않았다.

### 10. 라이선스·출처·번들 제한 — met

`tests/visual-token-fidelity.test.ts`가 출처 파일의 SHA-256과 MIT SPDX를 대조한다. `tests/visual-source-sync.test.ts`는 허용 목록 밖 import와 MIT 선언 누락을 동기화 전에 거부한다. `package.json`의 `files`는 `dist`, `generated`, `skill`, README만 포함한다. 저장소의 유일한 래스터인 `docs/example-throughline-hero.png`는 그 목록에 없다. 폰트 바이너리(`.woff`, `.ttf`, `.otf`)는 저장소에 없고, 폰트 항목은 라이선스 메타데이터다.

### 11. 비용·크기 예산 — met

기준선과 이후 샘플, 그리고 검토된 예산(응답 48 KiB, 비주얼 아티팩트 1 MiB, 압축 패키지 1.5 MiB)은 `docs/visual-contract-rollout.md`에 있다. `scripts/benchmark-visual.mjs`가 같은 예산을 넘으면 종료 코드 1을 낸다. 스크립트 주석대로 이것은 CI 벽시계 게이트가 아니고, `.github/workflows/ci.yml`도 호출하지 않는다. 이번 변경은 토큰 값과 아티팩트를 바꾸지 않으므로 그 예산을 다시 측정하지 않았다.

### 12. 선택 계약만 반환 — met

`composeContractTokens`는 요청한 `primaryStyleId` 하나와 요청한 모드, 하나의 `contentLocale`만 해석한다. 스타일 리소스는 `{ ...style, visualContract: resolved }`로 그 스타일의 해석 결과를 덮어쓴다 (`src/protocol/register-resources.ts`). `tests/visual-protocol.test.ts`는 해석 결과에 `modes`와 `styles`가 없고, 네이티브 계약의 `styleId`가 `brutalist-grid`이며, 매니페스트는 개수와 해시만 돌려주는지 본다. 레퍼런스 코퍼스나 다른 스타일 계약 맵은 이 응답에 없다. 카탈로그 스타일 레코드 자체의 기존 다국어 이름 필드는 스타일 상세의 이전 동작이다.

## 이번 변경

- `tests/issue-1-regressions.test.ts`: 계약 `brutalist-grid`에 일반 소프트 섀도가 없는지, 적대적 패밀리 density 위에서도 compact/comfortable이 row/gutter에 도달하는지, 행간이 네 포맷에 있는지, `none`과 0이 네 포맷에 남는지, 레거시 `secondaryStyleId`가 액센트 오버레이만 바꾸는지.
- `CHANGELOG.md`: 빠져 있던 0.10.0 계약 노트.

코드의 토큰 값, 도구 스키마, 기본 출력은 바꾸지 않았다.

## 수정하지 않은 큰 항목

1. 웹사이트 저장소와 이 패키지를 같은 해시로 다시 비교하는 `quality:parity`. 네트워크 호출이 필요하고 이 저장소 CI에 없다.
2. 레거시 컴파일러가 `brutalist-grid`에 일반 소프트 섀도를 넣고, 에디토리얼/모노 스타일에 패밀리 폰트를 넣는 기본 출력. 계약 경로는 이미 작성값을 낸다. 레거시 값을 바꾸면 기존 클라이언트의 기본 결과가 바뀐다.
3. `compare_design_directions`의 `secondaryStyleId`는 토큰 액센트가 아니라 추천 축을 합친다 (`src/recommendation/compare.ts`). 이슈의 토큰 오버레이 의미와 다르고, 비교 도구의 공개 결과를 바꾸므로 건드리지 않았다.
4. 성능 예산을 CI에서 매 커밋 재측정하는 일. 보고서와 스크립트는 있고, 이번 diff는 그 측정값을 바꾸지 않는다.
