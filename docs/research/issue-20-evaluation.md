# 이슈 #20 평가 기록: 기준 적용과 검증 연결

- 기록일: 2026-11-25
- 기준 커밋: `c5fbe10` (master, #30·#31·#32·#33 머지 후)
- 범위: 이슈 #20의 문제 A~E와 대표 사례 표

이 기록은 계약과 판정 규칙이 대표 사례를 어떻게 다루는지 적습니다. 사용자 연구나 전환율 실험은 하지 않았습니다. 아래의 "통과"는 계약이 정확하다는 뜻입니다. UI·UX 품질이 좋아졌다는 증명이 아닙니다.

## 문제별 변경

| 문제 | 변경 | PR |
|---|---|---|
| A 형태 판정 | 발견 항목과 검사에 `claim`을 붙였습니다. `styleId` 없이 찾은 형태는 `shape-observation`입니다. 형태가 있으면 NOT_VERIFIED로 판정하고, 과업 판단은 `manual` 증거로 받습니다. 형태가 없으면 NOT_APPLICABLE입니다. 고른 스타일의 금지 항목은 `style-fidelity`, 필수 요소는 `required-element`이며 기존 심각도를 유지합니다. | #30 |
| C 필수 요소 조건 | 이름 붙은 조건 4개(`single-variant`, `no-code-interface`, `docs-article`, `not-time-series`)와 12자 이상의 이유로만 필수 요소를 뺄 수 있습니다. 빠진 요소는 FIX_NOW이고, 첫 화면 밖 배치는 RISK입니다. 단, 첫 화면의 행동 전에 봐야 하는 정보(구매 버튼 아래의 가격·옵션·배송 안내)는 FIX_NOW입니다. | #31 |
| B 원칙별 verify | 고른 원칙의 verify 문장마다 `principle-<design\|ux>-<id>-verify-<n>` 검사를 만듭니다. 검토한 표(`src/audit/principle-verify.ts`)가 71문장 각각의 증거 방법을 정합니다. 감사 증거의 `method`가 검사가 받는 방법과 맞지 않으면 NOT_VERIFIED입니다. | #32 |
| D 증거 방법과 주장 | 개선 제출의 `checks[].method`, `changes[].claim`, `changes[].successCriterion`을 추가했습니다. 정적 검사나 검토로는 동작·접근성 통과를 낼 수 없습니다. 스타일 선호만으로는 개선을 주장할 수 없습니다. | #33 |
| E 충돌과 출처 | 인지부하 출처 제목, 선택 과부하의 조절 조건과 2015 메타분석, `task-sized-composition`의 2차원 표·지도 예외, "subordinate"의 한국어 번역을 정본에서 고쳤습니다. 형태 금지와 `truthful-evidence`의 충돌은 A가, 오프닝 제약과 필수 요소의 관계는 C가 다룹니다. | seungdori/web-stylebook#62 (머지 대기) |

## 대표 사례

분류는 이슈의 평가 보고 방식을 따릅니다. 오탐 방지는 정당한 화면을 결함으로 확정하지 않는지 봅니다. 실제 결함은 관찰 가능한 결함을 계속 잡는지 봅니다. 맥락 부족은 근거 없는 PASS나 결함 확정 대신 부족한 정보를 표시하는지 봅니다. 절충은 규칙 통과만으로 개선을 판정하지 않는지 봅니다.

| 사례 | 분류 | 현재 결과 | 확인한 테스트 |
|---|---|---|---|
| 서로 다른 업무로 이동하는 카드 3개 | 오탐 방지 | `styleId`가 없으면 NOT_VERIFIED이고 FIX_NOW는 없습니다. 과업 판단을 `manual` 증거로 내면 PASS로 검증됩니다. 고른 스타일이 금지하면 FIX_NOW입니다. | `tests/issue-20-shape-observations.test.ts` |
| 실제 고객 근거가 연결된 로고 영역 | 오탐 방지 | `styleId`가 없으면 `shape-observation`, NOT_VERIFIED입니다. 제거를 요구하지 않습니다. | `tests/issue-20-evaluation-cases.test.ts` |
| 출처가 없거나 사실과 다른 고객 주장 | 맥락 부족 | 정적 검사는 진위를 판단하지 않습니다. `evidence-near-claim` 원칙 검사는 `agent-review` 증거를 요구하는 검토 항목입니다. | `tests/issue-20-principle-verify.test.ts` (방법 표) |
| 적절한 중앙 오프닝과 과업을 밀어내는 빈 오프닝 | 맥락 부족 | 두 화면 모두 FIX_NOW가 없습니다. 형태만으로는 둘을 구별하지 못하므로, 구별은 호스트의 과업 판단이 합니다. | `tests/issue-20-evaluation-cases.test.ts` |
| 단일 옵션 상품, GUI 개발 도구, 문서 상세 | 오탐 방지 | 조건을 밝히면 해당 필수 요소만 NOT_APPLICABLE입니다. 나머지 필수 요소는 그대로 검사합니다. | `tests/issue-20-must-have-conditions.test.ts` |
| 작은 모바일 첫 화면 | 오탐 방지 | 구매 영역 전체가 첫 화면 아래에 있으면 RISK입니다. 첫 화면이 추정값이라는 안내를 붙입니다. | `tests/issue-20-must-have-conditions.test.ts` |
| 본질적인 가로 스크롤 표 | 오탐 방지 | 정본의 reflow 검증 문장에 2차원 배치 예외를 넣었습니다. MCP 동기화 전까지 MCP catalog 문장은 그대로입니다. | seungdori/web-stylebook#62 |
| 실제 구매 정보 누락 | 실제 결함 | 가격이 없으면 스타일과 조건에 관계없이 FIX_NOW입니다. 구매 버튼만 첫 화면에 있고 가격이 아래에 있어도 FIX_NOW입니다. | `tests/issue-20-evaluation-cases.test.ts`, `tests/must-haves.test.ts` |
| 키보드 조작 불가, 입력 상태 소실 | 실제 결함 | 해당 원칙 검사는 `interaction` 증거와 `browser` 방법을 요구합니다. 정적 검사나 검토로는 통과하지 못합니다. | `tests/issue-20-evaluation-cases.test.ts`, `tests/issue-20-improvement-claims.test.ts` |
| 테두리 제거로 그룹 식별 악화, 여백 증가로 비교 정보 감소 | 절충 | `regressed` 결과와 실패한 검사는 완료를 막습니다. 스타일 선호뿐인 변경은 개선으로 인정하지 않습니다. | `tests/improvement-workflow.test.ts`, `tests/issue-20-improvement-claims.test.ts` |
| 맥락이나 필요한 증거가 없는 화면 | 맥락 부족 | 개선 계획에 `context`가 없으면 완료할 수 없습니다(CONTEXT_REQUIRED). 증거가 없는 감사 검사는 NOT_VERIFIED입니다. | `tests/improvement-workflow.test.ts` |
| 이미 적절한 화면 | 오탐 방지 | 변경 없이 검증한 대상은 `no-change`로 끝납니다. | `tests/improvement-workflow.test.ts` |
| 힉의 법칙 등 선택한 원칙의 검증 | 맥락 부족 | 일반 원칙 검사 4개와 별도로 verify 문장마다 검사가 생깁니다. 선택 시간 문장은 `participant`나 `analytics` 증거만 받습니다. | `tests/issue-20-principle-verify.test.ts` |
| 직접적인 기능 복구, 과업 경로 개선 | 실제 결함 | `observed-defect` 변경은 추가 필드 없이 완료됩니다. 같은 조건의 전후 캡처가 필요한 것은 그대로입니다. | `tests/issue-20-improvement-claims.test.ts` |

## 호환성과 버전

- 구조 감사의 규칙 hash에 판정 정책 id를 넣었습니다(`claims-v1` → `claims-v2`). 서버 버전을 올리기 전에도 예전 증거가 새 규칙과 맞지 않습니다.
- 다음 계획은 plan hash가 바뀝니다.
  - `styleId` 없는 구조 계획
  - `mustHaveConditions`를 넣은 계획
  - 원칙을 고른 감사 계획
  - 모든 개선 계획(`validationVersion` 3)
- 그 밖의 계획은 hash가 그대로입니다. 새 필드는 모두 선택 사항이라 예전 제출 형식도 계속 받습니다.
- `generated/`와 `src/visual-canonical/`은 바꾸지 않았습니다. 정본 수정(#62)은 아직 머지하지 않았습니다. MCP의 catalog 스냅샷은 정본 main과 이미 약 4,950곳이 다르므로, 동기화는 별도 작업입니다.
- 버전, 태그, npm 배포는 하지 않았습니다.

## 남은 한계

- 형태 관찰의 과업 영향은 도구가 판단하지 않습니다. 호스트가 판단해 `manual` 증거로 냅니다.
- 고객 주장의 진위는 DOM으로 확인할 수 없습니다.
- 필수 요소 조건은 대표 예외 4개뿐입니다. 다른 예외가 필요하면 조건을 추가해야 합니다.
- `compare_page_revisions`는 원래 첫 화면에 있던 필수 요소가 밖으로 옮겨지면 여전히 FIX_NOW입니다. 원본 대비 보존 검사이기 때문입니다.
- 원칙별 증거 방법은 MCP의 검토한 표에 있습니다. 정본 catalog의 구조화된 필드로 옮기는 일은 후속 작업입니다.
- 일본어 reference 문서는 없습니다. 판정 문구와 다음 행동은 en·ko·ja로 나오지만, 새 reference 문단은 en·ko만 있습니다.
- 이번 평가는 작은 회귀 사례 세트입니다. 일반적인 사용자 성과 향상을 입증하지 않습니다.
