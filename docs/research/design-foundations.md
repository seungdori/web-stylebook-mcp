# UI 개선을 위한 디자인 원론 조사

검토일: 2026-10-28 · 지식 스키마: `webstylebook.design-foundations.v1` · 콘텐츠 버전: `1.0.0`

목적은 AI가 실제 UI의 과업과 문제를 관찰하고, 적절한 수정을 선택해 구현한 다음 전후 차이를 확인하도록 돕는 것이다. 원칙 이름을 나열한 리뷰나 특정 화면을 따라 하는 레시피를 결과물로 삼지 않는다. 외형으로 AI 제작 여부를 판정하지 않는다.

## 조사 범위와 방법

1. 지각·구성·타이포그래피·색·정보·상호작용·피드백·검증으로 질문을 나눴다. 각 영역에서 ‘무엇을 관찰하는가’, ‘언제 어떤 변경을 하는가’, ‘어떤 상황에서는 적용하지 않는가’, ‘무엇으로 전후를 확인하는가’를 조사했다.
2. W3C WAI의 기준 해설과 작성 지침, USWDS·IBM Carbon·GOV.UK의 공식 디자인 시스템, Nielsen Norman Group의 직접 작성 자료를 읽었다. 유행 모음이나 출처 없는 법칙 목록을 근거로 삼지 않았다. 이는 선택한 자료에 대한 구조화된 검토이며, 학술 연구 전체를 포괄한 체계적 문헌고찰은 아니다.
3. 출처에서 뒷받침하는 범위를 `sources.ts`의 `supports`에 따로 기록했다. 설계 시스템의 선택을 보편 법칙으로 확장하지 않고, 서로 다른 과업의 사례와 반례를 함께 작성했다. 예를 들어 밀도는 글 읽기, 데이터 비교, 빈번한 조작에서 다르게 판단한다.
4. 원문의 문장·이미지·서체·스크린샷을 가져오지 않았다. 요약과 적용 지침은 직접 작성했으며 원 출판물의 권리는 그대로 남는다. 검토일은 자료를 읽은 시점이지 모든 내용을 재현 실험한 날짜가 아니다.
5. 24개 항목을 영어·한국어·일본어로 작성하고 기존 디자인 원칙 25개에 연결했다. 각 항목의 두 적용 예시는 서로 다른 UI를 사용한다. 48개 예시 전체는 랜딩 페이지, 대시보드, 탐색, 폼, 결제, 채팅, 개발자 콘솔, 데이터 표, 콘텐츠, 설정, 온보딩의 11종을 포함한다.

## 지식 구조

| 필드 | 판단과 수정에서의 역할 |
| --- | --- |
| `principle`, `sourceIds` | 관계를 설명하는 원론과 그 근거를 연결한다. |
| `observe` | 실제 화면·콘텐츠·행동에서 확인해야 할 신호를 지정한다. |
| `decisions[].when` | 수정이 필요한 조건을 명시한다. |
| `decisions[].change` | AI가 구현할 수 있는 구조·내용·스타일·동작 변경을 제시한다. |
| `decisions[].instead` | 반례와 제약을 통해 부적절한 처방을 막는다. |
| `preserve` | 기능, 콘텐츠의 의미, 정체성, 사용자 통제 중 유지해야 할 것을 명시한다. |
| `compare` | 실제 화면, 계산된 스타일, 상호작용 또는 사용자 과업으로 확인한다. |
| `examples` | 다른 UI에도 적용하는 방법을 설명한다. 실제 측정 결과가 아니다. |

출처가 있는 원론이라도 우리가 작성한 수정법의 효과가 실험으로 입증된 것은 아니다. 모든 항목은 `applicationBasis: authored-contextual-guidance`, 예시는 `illustrative-not-observed-results`로 표시한다. WCAG 해설은 규범 문서 자체가 아니므로 준수를 주장할 때 실제 성공 기준의 범위·등급·예외를 적용한다.

## 24개 지식 항목

| 영역 | 항목 ID | 핵심 판단 |
| --- | --- | --- |
| 지각 | `priority-hierarchy` | 과업에서 중요한 것과 시각적으로 먼저 보이는 것이 일치하는가? |
| 지각 | `relational-grouping` | 근접·간격·경계가 실제 정보 관계를 표현하는가? |
| 지각 | `surface-hierarchy` | 카드와 레이어가 필요한 구분을 만드는가, 불필요한 중첩을 만드는가? |
| 지각 | `visual-balance` | 크기·대비·정보량의 무게가 구성 의도와 맞는가? |
| 구성 | `grid-alignment` | 읽기·비교·탐색을 돕는 정렬축과 그리드가 있는가? |
| 구성 | `rhythm-consistency` | 반복되는 역할이 일정한 리듬을 갖고 의미 있는 차이는 구별되는가? |
| 구성 | `task-density` | 함께 필요한 정보를 유지하면서 혼잡함을 줄였는가? |
| 구성 | `responsive-composition` | 작은 화면·확대·긴 콘텐츠에서도 과업 순서와 조작이 유지되는가? |
| 타이포그래피 | `type-roles` | 제목·본문·라벨·부가 정보의 역할이 구별되고 일관적인가? |
| 타이포그래피 | `reading-measure` | 실제 언어·폰트의 행 길이·행간·문단 간격이 함께 작동하는가? |
| 타이포그래피 | `language-resilience` | 번역·대체 폰트·긴 이름·다양한 문자 체계에서도 의미가 유지되는가? |
| 색 | `semantic-color` | 색의 역할이 테마·상태·컴포넌트 전반에서 일관적인가? |
| 색 | `contrast-legibility` | 실제 배경과 모든 조작 상태에서 필요한 정보와 단서가 읽히는가? |
| 색 | `data-encoding` | 범주·순서·차이를 데이터 의미에 맞는 시각 속성으로 전달하는가? |
| 정보 | `scannable-content` | 목록·행·문장 앞부분에서 항목의 차이와 필요한 행동을 찾을 수 있는가? |
| 정보 | `navigation-scent` | 위치와 다음 목적지를 라벨·맥락으로 예측할 수 있는가? |
| 정보 | `labels-instructions` | 입력·행동의 의미와 조건을 필요한 곳에서 알 수 있는가? |
| 정보 | `truthful-evidence` | 주장·숫자·시각적 강조의 강도가 실제 근거와 정보 가치에 맞는가? |
| 상호작용 | `action-affordance` | 조작 가능성과 상태를 구별하고 포인터·키보드로 사용할 수 있는가? |
| 피드백 | `state-continuity` | 로딩·빈 상태·갱신·완료에서 사용자가 현재 상태와 다음 행동을 아는가? |
| 피드백 | `error-recovery` | 오류를 이해하고 입력·진행 상황을 잃지 않은 채 복구할 수 있는가? |
| 상호작용 | `purposeful-motion` | 움직임이 피드백·관계를 설명하며 사용자의 작업을 지연하지 않는가? |
| 구성 | `imagery-purpose` | 이미지의 정보·기능·정서·장식 역할에 맞게 배치와 대체 설명을 정했는가? |
| 검증 | `comparative-iteration` | 동일 조건에서 관찰한 개선과 취향 판단·미검증을 구별했는가? |

## AI가 사용해야 하는 절차

1. 사용자가 달성하려는 과업, 현재 화면의 의도, 관찰된 방해 요소를 적는다. 이미 허용된 개선 범위에서 진행하며 잘 작동하는 디자인과 제품 정체성을 보존한다.
2. 변경 전에 실제 스크린샷, HTML/CSS, 콘텐츠·링크·입력·상호작용 목록을 남긴다. 전후 모두 경로·뷰포트·확대율·테마·언어·데이터·상태·폰트 로딩 조건을 기록한다. 관련 반응형 화면과 오류·빈 상태도 포함한다.
3. `get_design_improvement_plan`으로 해당 UI와 관심사에 맞는 지식을 받는다. 조건과 반례를 확인한 뒤 실제 관찰과 맞는 규칙을 선택한다. 원인이 정보 구조나 동작이면 색·그림자 조정보다 그 원인을 먼저 수정한다.
4. 호스트 AI가 실제 코드를 수정하고 화면을 다시 렌더링한다. 새 카탈로그 스타일 채택은 필수가 아니다. 큰 여백·그라데이션·카드·가운데 정렬·사진은 존재 자체만으로 실패하지 않는다.
5. 같은 조건의 화면을 나란히 비교하고, 선택한 항목의 확인 방법을 실행한다. 실제 입력·키보드·포커스·복구·접근성·반응형 동작을 확인한다. `compare_page_revisions`는 콘텐츠와 기능 단서 보존의 정적 검사로 사용하며, 브라우저 실행이나 시각 판단을 대체하지 않는다.
6. 퇴행을 수정하거나 되돌린 뒤 완료한 변경과 전후 자료를 보고한다. 개선·유지·퇴행·미검증을 구분하고, 측정하지 않은 사용자 탐색 시간·성공률을 만들지 않는다. 실제 사용자 실험이 없으면 전문가의 과업 기반 판단임을 밝힌다.

보고의 최소 구조는 다음과 같다. 빈 칸에 추측이나 예시 결과를 실제 관찰처럼 채우지 않는다.

| 대상·조건 | 변경 전 자료와 관찰 | 구현한 변경 | 변경 후 자료와 확인 | 결과·한계 |
| --- | --- | --- | --- | --- |
| 실제 경로·상태·뷰포트·언어 등 | 저장한 스크린샷/파일 + 확인한 문제 | 실제 변경한 코드/내용 | 동일 조건의 스크린샷 + 수행한 동작 검사 | 개선/유지/퇴행/미검증, 남은 확인 사항 |

## 출처 지도

아래 자료는 2026-10-28에 검토했다. 런타임은 오프라인이며 URL을 자동 재조회하지 않는다. 각 출처가 뒷받침하는 범위와 정확한 기준 메타데이터는 [`sources.ts`](../../src/foundations/sources.ts) 및 `webstylebook://foundations/sources`에 있다.

| 출처 ID | 직접 검토한 자료 | 사용 범위 |
| --- | --- | --- |
| `visual-hierarchy` | [NN/g — 5 Principles of Visual Design in UX](https://www.nngroup.com/articles/principles-visual-design/) | 크기·위계·균형·대비·그룹화 |
| `proximity` | [NN/g — Proximity Principle](https://www.nngroup.com/articles/gestalt-proximity/) | 간격과 정보 관계 |
| `common-region` | [NN/g — Common Region](https://www.nngroup.com/articles/common-region/) | 경계와 그룹화 |
| `grid` | [IBM Carbon — 2x Grid](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/guidelines) | 콘텐츠 목적별 그리드 |
| `spacing` | [IBM Carbon — Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) | 간격의 일관성과 관계 |
| `typesetting` | [USWDS — Typography](https://designsystem.digital.gov/components/typography/) | 글자·행 길이·행간의 관계 |
| `translation` | [W3C Internationalization — Text size in translation](https://www.w3.org/International/articles/article-text-size.en) | 번역에 따른 길이·높이 변화 |
| `disclosure` | [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | 필요한 정보와 보조 정보 분리 |
| `recognition` | [NN/g — Recognition and Recall](https://www.nngroup.com/articles/recognition-and-recall/) | 맥락 단서와 기억 부담 |
| `information-scent` | [NN/g — Information Scent](https://www.nngroup.com/articles/information-scent/) | 탐색 라벨과 목적지 예측 |
| `heuristics` | [NN/g — 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | 피드백·일관성·통제·복구의 점검 질문 |
| `validation` | [GOV.UK — Recover from validation errors](https://design-system.service.gov.uk/patterns/validation/) | 입력 보존·오류 위치·수정 안내 |
| `data-table` | [IBM Carbon — Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | 비교·정렬·선택·행 밀도 |
| `image-purpose` | [W3C WAI — An alt Decision Tree](https://www.w3.org/WAI/tutorials/images/decision-tree/) | 이미지 기능에 따른 대체 설명 |
| `data-color` | [IBM Carbon — Data visualization color palettes](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes) | 범주형·순차형·발산형 척도 |
| `empty-states` | [IBM Carbon — Empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states) | 빈 상태의 이유와 다음 행동 |
| `color-roles` | [IBM Carbon — Color](https://www.carbondesignsystem.com/building-blocks/foundations/color/guidelines) | 역할·레이어·테마의 색 관계 |
| `user-testing` | [NN/g — Usability Testing 101](https://www.nngroup.com/articles/usability-testing-101/) | 대표 사용자의 실제 과업 관찰 |
| `motion-purpose` | [NN/g — Animation and Motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/) | 움직임의 피드백·연속성·주의 비용 |
| `keyboard` | [W3C ARIA APG — Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | 키보드 동작·포커스·선택 구별 |
| `labels` | [W3C WAI — Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/) | 의미 있는 라벨과 연결 |
| `text-contrast` | [WCAG 2.2 해설 — 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | AA, 텍스트 대비와 예외 |
| `ui-contrast` | [WCAG 2.2 해설 — 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | AA, 필요한 조작·상태·그래픽 단서 |
| `color-not-alone` | [WCAG 2.2 해설 — 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | A, 색 이외의 구별 단서 |
| `target-size` | [WCAG 2.2 해설 — 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | AA, 24×24 CSS 픽셀 또는 명시된 예외 |
| `focus-visible-area` | [WCAG 2.2 해설 — 2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | AA, 포커스 대상이 완전히 가려지지 않음 |
| `status-message` | [WCAG 2.2 해설 — 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | AA, 해당 상태 메시지의 프로그램적 전달 |
| `reflow` | [WCAG 2.2 해설 — 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | AA, 재배치와 필수 2차원 영역 예외 |
| `text-spacing` | [WCAG 2.2 해설 — 1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | AA, 사용자 간격 변경에 대한 내구성 |
| `interaction-motion` | [WCAG 2.2 해설 — 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | AAA, 비필수 상호작용 모션 비활성화 |

숫자 사용 시 특별히 구별한 사항:

- 24×24는 적용 범위와 예외가 있는 포인터 대상 기준이다. 아이콘 그림 자체의 최소 크기나 모든 사용자의 편안한 조작 크기를 뜻하지 않는다.
- 텍스트 간격 재정의 값은 기본 행간·자간을 강제하는 디자인 값이 아니다. 동시에 재정의해도 내용과 기능을 보존하는지 검사한다.
- 필요한 비텍스트 단서의 대비 조건을 모든 장식 테두리에 일괄 적용하지 않는다. 텍스트 대비의 큰 글자 조건과 예외도 따로 확인한다.
- 포커스의 일부라도 보이는 AA 최소 조건과 전부 보이는 더 강한 기준을 혼동하지 않는다. 상호작용 애니메이션의 2.3.3은 AAA이며, 자동 재생 움직임과 같은 기준이 아니다.
- 한 디자인 시스템의 간격 단위·색·글자 수 권고를 모든 제품과 문자 체계의 보편값으로 사용하지 않는다.

## MCP 연결과 유지보수

- `get_design_improvement_plan({ surface, concerns, category, foundationIds, limit, locale })`가 필요한 항목과 관련 출처·비교 프로토콜만 반환한다. 선택자는 최소 하나 필요하다. 기본 6개(명시 ID가 있으면 그 개수), 최대 12개이며 `coverage`로 누락과 필터 제외를 확인한다.
- 필터 차원 사이는 AND, 관심사 내부는 OR이다. `global` 항목은 각 화면에 적용될 수 있다. 명시 ID가 있어도 다른 필터를 무시하지 않는다. 일치 항목이 없으면 임의의 대안을 만들어내지 않는다. 순위는 조회 편의를 위한 것이며 디자인 점수가 아니다.
- `webstylebook://foundations`는 간결한 목록, `/foundations/{id}?locale=ko`는 선택 언어의 전체 지침, `/foundations/sources`는 출처 목록이다. 상세 지침은 `structuredContent`를 읽지 않는 클라이언트에도 텍스트로 온전히 전달된다.
- [`src/foundations/`](../../src/foundations/)가 이 MCP 보충 지식의 원본이다. 웹사이트가 소유한 `generated/` 정본을 수동 편집하지 않는다. `manifest.designFoundations`의 버전과 hash는 정본 카탈로그의 버전·hash와 별도다. 콘텐츠·출처·비교 프로토콜이 hash에 포함된다.
- 새 항목은 세 언어, 조건별 수정 두 가지 이상, 반례, 보존 조건, 확인 방법, 서로 다른 화면의 예시 두 가지 이상, 유효한 출처와 기존 원칙 연결을 함께 작성한다. 외부 링크의 내용이 바뀌면 해당 주장·검토일을 재확인한다. 다음 발행 시 콘텐츠 변경의 호환성과 버전을 검토한다.
- `--validate-catalog`는 기존 카탈로그와 새 지식의 무결성을 함께 검사한다. 테스트는 출처·번역·참조, 분야와 예시의 범위, 다양한 과업의 조회, 응답 크기, MCP 전달과 오류를 검사한다. 이 테스트가 실제 UI 개선이나 사용자 성공률을 입증하지는 않는다. 그 검증은 호스트가 실제 제품에서 수행한다.
