# 결과

브리프 10개에 군마다 빌드 하나씩, 같은 에이전트와 모델로 만든 10쌍입니다. 군은 MCP 없이 만든 대조군(`control`)과 MCP를 붙여 만든 MCP군(`mcp`)입니다. 측정이 아니라 눈으로 보기 위한 쇼케이스입니다. **먼저 [블라인드 비교 페이지](./compare/index.html)를 보세요.** 이 노트는 어느 쪽이 어느 군인지 밝힙니다.

근거는 [`runs.json`](./runs.json), [`key.json`](./key.json), 제가 쓴 블라인드 메모([`blind-notes.md`](./blind-notes.md)), 독립 평가자 두 명([`blind-reads/`](./blind-reads/))입니다. 점수는 매기지 않았습니다.

## 빌드

| 브리프 | 군 | 상태 | 소요 시간 | 턴 | 비용(추정) |
| --- | --- | --- | --- | --- | --- |
| SRE incident dashboard | control | 빌드 성공 | 74m 32s | 179 | $12.01 |
| SRE incident dashboard | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $16.33 |
| Indie long-form essay blog | control | 빌드 성공 | 43m 50s | 222 | $8.12 |
| Indie long-form essay blog | mcp | 빌드 성공 | 76m 22s | 286 | $16.21 |
| Luxury skincare product page | control | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $14.62 |
| Luxury skincare product page | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $30.56 |
| Kids coding-education landing page | control | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $23.64 |
| Kids coding-education landing page | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $16.41 |
| Developer API docs homepage | control | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $18.90 |
| Developer API docs homepage | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $20.71 |
| Personal budgeting app overview screen | control | 빌드 성공 | 85m 49s | 171 | $18.62 |
| Personal budgeting app overview screen | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $14.80 |
| Architecture studio portfolio | control | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $28.05 |
| Architecture studio portfolio | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $19.08 |
| Neighborhood bakery ordering site | control | 빌드 성공 | 72m 12s | 208 | $11.96 |
| Neighborhood bakery ordering site | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 01s | - | $16.88 |
| B2B HR SaaS landing page | control | 빌드 성공 | 40m 36s | 201 | $5.75 |
| B2B HR SaaS landing page | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $18.82 |
| Music festival event page | control | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $23.48 |
| Music festival event page | mcp | 빌드 성공, 90분 제한에서 중단 | 90m 00s | - | $16.90 |
| **합계** | control | 10/10 | 767m 00s |  | $165.15 |
| **합계** | mcp | 10/10 | 886m 25s |  | $186.70 |

- **20개 빌드 모두 `npm run build`를 통과했습니다.** 격리 감사도 전부 통과했고, 어떤 캡처에도 페이지 오류, 콘솔 오류, 실패한 요청, 가로 넘침이 없습니다.
- 경과 시간은 2026년 10월 18일 UTC 12:13부터 20:01까지 7시간 48분입니다. 빌드를 최대 4개씩 동시에 돌렸고, [README](./README.ko.md)에 적은 사용량 조절용 일시 정지가 있었습니다. 세션 시간을 합치면 27시간 33분이고, 대조군 12시간 47분, MCP군 14시간 46분입니다.
- 비용은 Claude Code가 정가로 추정한 값이며 청구액이 아닙니다. 대조군 $165.15, MCP군 $186.70입니다. 중단된 세션은 결과 이벤트를 남기지 않아 턴 수가 비어 있고, 비용은 Claude Code의 세션 기록에서 가져왔습니다.

## 실패와 이상한 점

빌드에 실패한 경우는 없습니다. 거친 부분은 다음과 같습니다.

- **90분 제한이 세션 20개 중 14개를 중단시켰습니다. MCP군 10개 중 9개, 대조군 10개 중 5개입니다.** 제한은 제가 정했고 MCP군에 더 많이 걸렸으므로, MCP 세션은 마무리할 시간이 그만큼 적었습니다. 중단된 폴더도 모두 빌드되었고, 중단된 상태 그대로 캡처했습니다. 중단 시점에 대부분은 점검을 돌리거나 문서(`README.md`, `design.md`, 증거 스크립트)를 쓰는 중이었습니다. 그래도 최소 6개는 마지막 2분 안에 소스나 설정을 고치는 중이어서, 제한이 일부 작업을 끊은 것은 맞습니다. 어린이 코딩 대조군(컴포넌트 이름 변경), API 문서 대조군(오류 경계), 럭셔리 대조군(드로어 스타일), 건축 MCP군(히어로 스타일), 음악 대조군(Vite 설정), HR MCP군(타입 수정)입니다. 각 세션 기록의 끝부분을 읽어 찾았으므로 이 개수는 하한입니다.
- **MCP 호출 259번 중 7번이 오류를 돌려줬고(2.7%), 에이전트는 매번 복구했습니다.** 다섯 건은 툴 계약과 어긋난 경우입니다. `compose_design_tokens`가 밀도 프리셋과 충돌하는 간격 덮어쓰기(3번), 번들에 없는 비주얼 라이브러리 해시, 스타일에 없는 다크 모드를 거부했습니다. 나머지 둘은 에이전트가 만든 입력 문제입니다. `recommend_design_direction`이 거부한 잘못된 `density` 값과, Claude Code가 해석하지 못해 서버에 닿지 못한 JSON입니다.
- **MCP군은 브리프 10개 중 4개(럭셔리 스킨케어, 가계부, 건축, 빵집)에서 `earth-atelier`를 썼습니다.** 서버의 1순위 후보를 쓴 브리프가 7개이고(그중 2개는 입력을 바꿔 추천을 다시 돌린 뒤), 2순위를 쓴 브리프가 3개입니다.
- MCP 세션 두 개(가계부, 음악)는 `validate_design_audit_result`에 닿기 전에 중단되었습니다. MCP 폴더 10개 중 7개에는 정한 계약을 기록한 `design.md`가 있고, 대조군 폴더에는 하나도 없습니다.
- 대조군 세션은 6개 빌드(호출 7번: SRE, 어린이 코딩, API 문서, 가계부, 건축, 음악)에서, MCP 세션은 1개 빌드(럭셔리 스킨케어)에서 서브에이전트를 띄웠습니다. 서브에이전트 작업까지 세면 대조군의 툴 호출이 더 많습니다(3,484 대 2,752). 메인 스레드만 세면 MCP군이 더 많습니다(2,588 대 2,216).
- 동시에 돈 세션들은 한 대의 머신을 같이 썼고, 그 흔적이 남았습니다. 세션 20개 중 11개가 "Port 4173 is already in use"(`vite preview` 기본 포트)를 만났고, 14개가 `pkill`이나 `killall`을 실행했습니다. 한 세션의 `pkill` 직후 30초 안에 다른 실행 중 세션에서 연결 거부가 난 경우가 최소 세 번 있습니다. 에세이 대조군과 에세이 MCP군, 가계부 MCP군과 API 문서 MCP군, 빵집 대조군과 빵집·건축 MCP군입니다. 영향받은 세션은 각자 서버를 다시 띄우고 실패한 확인을 다시 돌렸습니다. 페이지가 바뀌었다고 보일 수도, 안 바뀌었다고 보일 수도 없습니다. 대조군 빌드는 열 쌍 모두에서 MCP 짝보다 먼저 또는 같이 시작했고, 다섯 쌍에서는 13분에서 62분 먼저였습니다.
- 캡처는 4000px에서 끊깁니다. 데스크톱 페이지 20개 중 15개와 모바일 페이지 20개 전부가 그보다 깁니다. 아래 판단 중 일부는 그 선 위에 무엇이 있었는지에 달려 있습니다.

## 대조군이 더 나아 보인 경우

제 블라인드 판독에서는 어느 쌍에서도 대조군이 전체적으로 낫다고 보지 않았습니다. 평가자는 그렇게 본 쌍이 있고, 겉모습보다 실용적인 완성도가 이유였습니다.

- **럭셔리 스킨케어:** 두 평가자 모두 대조군 페이지를 출시하겠다고 했습니다. 첫 화면이 완결된 구매 영역입니다. 용량 3종과 1회 가격, 장바구니 담기, 배송, 보증, 후기가 있습니다. MCP 페이지는 스크린샷에 보이는 부분에 구매 버튼 하나뿐이고 용량 선택이 없습니다. 모바일에서 대조군 페이지의 "NIGHT SERUM" 라벨 일부를 어두운 블록이 가립니다. 평가자 A와 저는 결함으로 셌고, 평가자 B는 고정 요소일 수 있다고 보고 세지 않았습니다.
- **어린이 코딩:** 두 평가자 모두 대조군 페이지를 출시하겠다고 했습니다. 가격이 맨 앞에 있고("첫 수업 $0, 이후 월 $79부터"), 히어로에서 실제 코드를 바로 고칠 수 있으며, 가상의 라이브 수업 화면이 수업 방식을 보여 줍니다.
- **가계부:** 두 평가자 모두 대조군 페이지를 출시하겠다고 했습니다. 한눈에 보이는 판정("쓸 수 있는 돈 $699"), 모든 행의 상태 라벨, 하단 탭 바가 있는 모바일 레이아웃이 더 분명합니다. MCP 페이지는 긴 문서처럼 읽힙니다.
- **API 문서:** 평가자 B는 대조군 페이지가 출시용으로도, 덜 뻔한 쪽으로도 낫다고 봤습니다. 브랜드가 따뜻하고, 퀵스타트 단계 번호가 코드 패널과 맞물립니다.
- **에세이 블로그:** 평가자 B는 본문 글자가 더 큰 따뜻한 일러스트 페이지인 대조군을 출시하겠다고 했습니다. 저도 둘 중 더 매력적이라고 봤습니다.
- **HR SaaS:** 평가자 A는 가격, 도입 기간, 성과 수치가 히어로에 있는 대조군 페이지를 출시하겠다고 했습니다. 평가자 둘과 저는 모두 이쪽이 더 템플릿 같다고 봤습니다.
- **빵집과 음악:** 평가자 B는 대조군 빵집 페이지가 덜 뻔하다고 봤고(맞춤 가게 일러스트), 평가자 A는 대조군 음악 페이지가 덜 뻔하다고 봤습니다(긴 그림자 워드마크가 있는 노을 히어로).

## MCP군이 더 나아 보인 경우

- **덜 뻔함**에서 MCP 빌드가 가장 잘했습니다. 다섯 쌍(SRE, 럭셔리 스킨케어, 가계부, 건축, HR)에서는 제 판독과 두 평가자의 "덜 뻔함" 답이 모두 MCP 빌드를 가리킵니다. 나머지 다섯 쌍에서는 판독이 갈렸습니다.
- 가장 뚜렷한 사례는 히어로나 메인 화면이 제품의 핵심 동작을 직접 보여 주는 경우입니다. 배포와 성능이 떨어진 서비스를 한 축에 맞춰 보여 주는 "무엇이 바뀌었나" 타임라인(SRE), 입사자 한 명의 기록이 온보딩·휴가·급여·평가로 퍼지는 모습(HR), 단면 도면 위의 정오 태양 슬라이더(건축), 밤새 피부 변화를 직접 돌려 보는 테스트(럭셔리), 아직 오지 않은 인보이스까지 따져 청구서를 점검하는 문장형 판정(가계부)입니다.
- 대조군 페이지 중에도 맞춤형인 것이 여럿 있습니다. 일러스트가 있는 에세이 블로그, 가게를 그려 넣은 빵집, 포스터 스타일 페스티벌 페이지입니다. 대조군 기준선이 높아서 많은 쌍에서 차이가 크지 않습니다.

## 평가 결과표

칸마다 평가자가 고른 군을 적었습니다. "출시"는 브리프의 실제 사용자에게 어느 빌드를 내보내겠느냐는 질문이고, "덜 뻔함"은 어느 쪽이 템플릿처럼 덜 보이느냐는 질문입니다. 평가자 A는 Claude Opus, 평가자 B는 Claude Sonnet이고, 둘 다 중립 파일만 봤습니다. 평가자 B의 첫 실행은 브리프 6개를 볼 수 없어서, 이미지 수 제한을 두고 그 6개를 다시 돌렸습니다([`blind-reads/reader-b.md`](./blind-reads/reader-b.md) 참고). 평가자 B는 가계부의 모바일 캡처도 앞쪽 2,000px쯤만 봤습니다.

| 브리프 | 내 판단 | 평가자 A: 출시 | 평가자 A: 덜 뻔함 | 평가자 B: 출시 | 평가자 B: 덜 뻔함 |
| --- | --- | --- | --- | --- | --- |
| SRE incident dashboard | MCP 쪽 | MCP (약간) | MCP (약간) | MCP (약간) | MCP (약간) |
| Indie long-form essay blog | MCP 쪽 (약간) | MCP (약간) | MCP (분명) | control (약간) | 비슷함 |
| Luxury skincare product page | MCP | control (약간) | MCP (분명) | control (약간) | MCP (분명) |
| Kids coding-education landing page | 비슷함 | control (약간) | MCP (약간) | control (약간) | 비슷함 |
| Developer API docs homepage | 비슷함 | MCP (약간) | MCP (약간) | control (약간) | control (약간) |
| Personal budgeting app overview screen | MCP 쪽 (약간) | control (약간) | MCP (약간) | control (약간) | MCP (약간) |
| Architecture studio portfolio | MCP 쪽 (약간) | MCP (약간) | MCP (약간) | MCP (약간) | MCP (약간) |
| Neighborhood bakery ordering site | 비슷함 | MCP (약간) | MCP (약간) | MCP (약간) | control (약간) |
| B2B HR SaaS landing page | MCP | control (약간) | MCP (분명) | MCP (약간) | MCP (분명) |
| Music festival event page | MCP 쪽 (약간) | MCP (약간) | control (약간) | MCP (약간) | 비슷함 |

## MCP군이 한 일

| 브리프 | MCP 호출 | 첫 호출 | recommend | compare | principles | ux | states | tokens | search refs | get ref | audit plan | validate | resources |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SRE incident dashboard | 29 | recommend_design_direction | 1 | 1 | 1 | 1 | 2 | 6 | 9 | 1 | 1 | 2 | 4 |
| Indie long-form essay blog | 23 | recommend_design_direction | 2 | 1 | 1 | 1 | 1 | 2 | 5 | 3 | 1 | 3 | 3 |
| Luxury skincare product page | 26 | recommend_design_direction | 1 | 1 | 1 | 1 | 2 | 4 | 6 | 2 | 2 | 1 | 5 |
| Kids coding-education landing page | 26 | recommend_design_direction | 1 | 1 | 1 | 1 | 1 | 3 | 5 | 2 | 1 | 2 | 8 |
| Developer API docs homepage | 24 | recommend_design_direction | 1 | 1 | 1 | 1 | 1 | 3 | 4 | 1 | 1 | 3 | 7 |
| Personal budgeting app overview screen | 27 | recommend_design_direction | 1 | 1 | 2 | 1 | 1 | 3 | 5 | 2 | 2 | 0 | 9 |
| Architecture studio portfolio | 21 | recommend_design_direction | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 1 | 4 | 6 |
| Neighborhood bakery ordering site | 26 | recommend_design_direction | 1 | 0 | 2 | 2 | 2 | 1 | 8 | 3 | 1 | 1 | 5 |
| B2B HR SaaS landing page | 31 | recommend_design_direction | 2 | 1 | 1 | 1 | 2 | 4 | 8 | 2 | 1 | 3 | 6 |
| Music festival event page | 26 | recommend_design_direction | 2 | 1 | 1 | 1 | 2 | 2 | 6 | 2 | 1 | 0 | 8 |

MCP 세션 10개 모두 스키마를 불러온 뒤 `recommend_design_direction`을 가장 먼저 불렀습니다. 모든 세션이 원칙·UX·상태·토큰·감사 계획 툴도 썼습니다. 원본 호출은 [`mcp-outputs/`](./mcp-outputs)에 있습니다.

## 판단 방법

실험을 돌린 에이전트인 제가 `key.json`을 열기 전에 중립 파일로 10쌍을 모두 읽고 인상을 먼저 적었습니다([`blind-notes.md`](./blind-notes.md)). 어떤 빌드가 중단됐는지는 로그로 알았지만, 어느 쪽이 어느 군인지는 몰랐습니다. 기준은 정체성과 구체성, 브리프와의 적합성, 위계와 가독성, 눈에 보이는 결함, 모바일 레이아웃이었습니다. 이 기준은 MCP 서버가 자체 지침에 밝힌 목표와 가깝습니다. 그래서 제 판독은 구조상 MCP군에 유리합니다. 이를 확인하려고 독립 평가자 두 명을 더했고, 그들은 주로 "출시"에서 더 엇갈린 그림을 줬습니다. 평가자는 모두 페이지를 만든 에이전트와 같은 계열의 Claude 모델이고, 각 판독은 표본 하나입니다.

## 이 결과가 보여 주는 것과 못 보여 주는 것

보여 주는 것: 에이전트는 지시를 받으면 10개 빌드 모두에서 서버의 워크플로를 따랐습니다. 또 일부 MCP 빌드는 짝이 되는 대조군 빌드보다 제품에 더 맞춤이었고, 평가자들은 어느 쪽이 어느 군인지 모른 채 그 점을 알아챘습니다.

못 보여 주는 것: MCP가 더 나은 UI를 만든다는 인과관계입니다. 칸마다 빌드가 하나뿐이고 브리프는 10개입니다. 평가자는 모델이고, 제 기준은 이 툴의 기준과 겹칩니다. 90분 제한은 MCP군 10개 중 9개, 대조군 10개 중 5개를 중단시켰습니다. 캡처는 대부분의 페이지 아랫부분을 자릅니다. 인터랙션, 모션, 접근성은 시험하지 않았습니다. 쌍을 다르게 읽으셨다면 [비교 페이지](./compare/index.html)에서 직접 판단하세요.
