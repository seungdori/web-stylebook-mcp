# web-stylebook-mcp를 쓸 때와 안 쓸 때

[English](./README.md) · **한국어**

[이슈 #7](https://github.com/seungdori/web-stylebook-mcp/issues/7)을 위한 실험입니다. 검증하려는 주장은 이렇습니다. 이 MCP 서버를 쓰는 코딩 에이전트가 서버 없이 만들 때보다 덜 뻔한 UI를 만든다는 것입니다.

제품 브리프 10개를 같은 헤드리스 에이전트가 빈 폴더에서 두 번씩 만들었습니다. 한 번은 MCP 없이, 한 번은 MCP와 함께입니다. 시간 제한에 걸려 중단된 빌드까지 전부 실었고, 점수는 매기지 않았습니다. 어느 쪽이 어느 쪽인지 가린 채 두 결과를 나란히 보여 주니, 직접 판단해 보세요.

## 여기서 시작하세요

1. [`compare/index.html`](./compare/index.html)을 엽니다. 10개 쌍을 1440px, 390px 폭으로 좌우에 나란히 보여 줍니다. GitHub는 HTML을 소스로 보여 주므로, 저장소를 클론한 뒤 파일을 여세요.
2. 다른 문서를 읽기 전에 모든 쌍을 먼저 봅니다. 어느 쪽이 어느 쪽인지는 브리프마다 무작위입니다.
3. 그다음 [`RESULTS.ko.md`](./RESULTS.ko.md)(실패한 빌드, 대조군이 더 나아 보인 경우)를 읽고, [`key.json`](./key.json)에서 대응표를 확인합니다. 제 블라인드 메모와 독립 평가자 두 명의 판독은 [`blind-notes.md`](./blind-notes.md)와 [`blind-reads/`](./blind-reads/)에 있습니다.

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `briefs.json` | 브리프 10개. 첫 실행 전에 썼고 그 뒤로 고치지 않았습니다. |
| `compare/index.html` | 어느 쪽인지 가린 좌우 비교 페이지. |
| `key.json` | 시드, 알고리즘, 각 쌍에서 어느 군이 왼쪽이었는지. |
| `screenshots/<brief>/{left,right}-{1440,390}.webp` | 전체 페이지 스크린샷(4000px에서 자름). 이름은 일부러 중립적입니다. 어느 군인지는 `key.json`에 있습니다. |
| `mcp-outputs/<brief>.json`, `mcp-outputs/resource-list.txt` | MCP군이 부른 MCP 툴 호출 전부와 받은 결과, 그리고 너무 커서 그대로 넘기지 못한 결과의 저장본. |
| `runs.json` | 빌드별 기록: 상태, 소요 시간, 종료 코드, 토큰 수, 툴 호출 수, 격리 감사, 프롬프트, 실제 명령어. |
| `RESULTS.md`, `RESULTS.ko.md` | 결과 노트. |
| `blind-notes.md` | `key.json`을 열기 전에 쌍마다 적은 제 메모. |
| `blind-reads/` | 새로 띄운 Claude 서브에이전트 두 명의 독립 블라인드 판독과, 그들이 받은 지시문 전문. |
| `harness/` | 실행·촬영·게시에 쓴 스크립트. |

커밋하지 않은 것은 생성된 앱과 원본 세션 기록입니다. 둘 다 실험을 돌린 머신의 `~/stylebook-showcase-runs/`에 있고, 세션 기록 경로는 `runs.json`에 적혀 있습니다.

## 프로토콜

프로토콜은 첫 실행 전에 확정했습니다. 브리프, 실행 스크립트, 비교용 시드는 각각 먼저 커밋했습니다.

### 브리프

브리프 10개는 각각 세 문장이고, 제품 설명만 담았으며 디자인 지침은 없습니다. SRE 인시던트 대시보드, 에세이 블로그, 럭셔리 스킨케어 상품 페이지, 어린이 코딩 랜딩, 개발자 API 문서 홈, 가계부 앱 개요 화면, 건축 스튜디오 포트폴리오, 동네 빵집 주문 사이트, B2B HR SaaS 랜딩, 음악 페스티벌 페이지입니다. `runs.json`에 `briefs.json`의 SHA-256을 기록했습니다.

### 두 군

대조군(`control`)은 MCP 없이, MCP군(`mcp`)은 MCP와 함께 만듭니다. 두 군은 에이전트, 모델, 툴 제한, 빌드 지시가 같고, 다른 점은 프롬프트 문단 하나와 MCP 서버를 붙였는지 여부뿐입니다.

대조군 프롬프트(`{brief}`는 브리프 본문):

```text
Build a single-page website for the product described in this brief.

Brief: {brief}

Requirements:
- Vite + React + plain CSS. No UI kits, no component libraries, and no Tailwind.
- One responsive page that works on phones and desktops.
- Realistic content written for this product: no lorem ipsum, no stock photos, and no external image URLs.
- Work in the current directory, which is empty. `npm install` and `npm run build` must both succeed when you finish.

No one is available to answer questions or approve a plan, so make every decision yourself and deliver the finished build in this session.
```

MCP군에는 같은 글의 마지막 문단 앞에 아래 문단을 넣었습니다.

```text
The web-stylebook MCP server is attached to this session. Call its `recommend_design_direction` tool first, before you design anything. After that, use its token, UI-state, and audit tools as you see fit.
```

프롬프트의 마지막 문단은 서버의 자체 지침 때문에 넣었습니다. 그 지침은 에이전트가 먼저 사용자에게 질문하고 승인을 받은 뒤에 만들라고 합니다. 헤드리스 실행에는 답해 줄 사람이 없어서, 두 군 모두 혼자 결정하라고 알렸습니다. 대화형 세션에서는 MCP군이 다르게 움직일 수 있습니다.

### 에이전트와 격리

빌드마다 빈 폴더 `~/stylebook-showcase-runs/<brief>/<arm>/`에서 헤드리스 Claude Code를 따로 실행했습니다. 프롬프트는 stdin으로 넣습니다.

```sh
env -i HOME="$HOME" USER="$USER" LOGNAME="$USER" PATH="$PATH" SHELL="$SHELL" TMPDIR="$TMPDIR" \
  LANG=en_US.UTF-8 TERM=dumb \
  CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 DISABLE_AUTOUPDATER=1 \
  ~/.local/share/claude/versions/2.1.302 -p \
    --model claude-sonnet-5-5 --effort max \
    --setting-sources project --disable-slash-commands \
    --strict-mcp-config --mcp-config <mcp-config.json> \
    --permission-mode bypassPermissions \
    --output-format stream-json --verbose \
    --disallowedTools WebSearch WebFetch DesignSync PushNotification RemoteTrigger SendMessage \
      CronCreate CronDelete CronList ScheduleWakeup EnterWorktree ExitWorktree Workflow \
      'Bash(sudo *)' 'Bash(ssh *)' 'Bash(scp *)' 'Bash(gh *)' 'Bash(git push *)' \
      'Bash(npm publish*)' 'Bash(npm login*)' 'Bash(brew *)' \
  < prompt.txt
```

빌드별 실제 명령어는 `runs.json`에 있습니다.

- **모델과 노력 수준:** `claude-sonnet-5-5`, `max` 노력 수준, Claude Code 2.1.302. `claude` 링크 대신 버전이 붙은 실행 파일을 직접 호출해서, 도중에 자동 업데이트가 버전을 바꾸지 못하게 했습니다.
- **호스트 설정 차단:** `--setting-sources project`는 사용자 설정, 훅, 플러그인, 출력 스타일을 제외합니다. `CLAUDE_CODE_DISABLE_*` 변수 둘은 사용자의 `CLAUDE.md` 파일과 자동 메모리를 뺍니다. `--setting-sources`만으로는 이 둘이 빠지지 않습니다. `--disable-slash-commands`는 스킬을 모두 없앱니다. 번들 `dataviz` 스킬도 디자인 지침이 될 수 있어서입니다. 환경 변수는 허용 목록 방식이라, 부모 세션의 값이 새어 들어오지 않습니다.
- **MCP:** `--strict-mcp-config`는 지정한 설정만 읽습니다. 대조군은 서버 목록이 비어 있고, MCP군은 아래의 stdio 서버 하나만 받습니다.
- **툴:** 에이전트는 확인 없이 파일을 쓰고 명령을 실행합니다. 웹 검색과 웹 가져오기는 두 군 모두 껐습니다. 두 군 밖에서 디자인 지침이 들어올 수 있기 때문입니다. 그 밖의 차단 툴과 `Bash` 패턴은 실행 폴더 밖에 영향을 주는 동작입니다. 배포, 원격 호스트 접속, 예약 작업, 알림이 그렇습니다.
- **시간 제한과 동시 실행:** 세션은 90분이 지나면 중단했습니다. 중단한 폴더는 그 상태 그대로 빌드하고, 중단 사실은 `timedOut`으로 기록했습니다. 빌드는 최대 4개가 동시에 돌았습니다. 처음 4개는 20초 간격으로 시작했고, 사용량 조절로 멈춘 뒤에는 기다리던 빌드가 한꺼번에 시작했습니다. 90분 제한은 이슈의 프로토콜에 없던 것으로, 실행하는 쪽에서 정했고 두 군에 똑같이 적용했습니다. 이 제한에 걸려 중단된 빌드는 [`RESULTS.ko.md`](./RESULTS.ko.md)에 있습니다.
- **사용량 조절:** max 노력 수준 세션 네 개를 동시에 돌리면 Claude 요금제의 5시간 사용량 창을 한 시간에 20%쯤 씁니다. 계정 한도에 걸려 끊긴 빌드는 결과가 아니라 인프라 실패입니다. 그래서 `harness/governor.mjs`가 `driver.mjs`를 멈추고(`SIGSTOP`), 새로 잰 사용량에 빈 자리만큼 여유가 있을 때만 다시 풀었습니다(`SIGCONT`). 실행 중인 빌드는 멈춘 적이 없고, 빌드 스크립트도 바꾸지 않았습니다. 그래서 한 브리프의 두 군이 항상 같은 시간에 돈 것은 아니며, 시작·종료 시각은 모두 `runs.json`에 있습니다. `governor.mjs`는 첫 빌드들로 사용량이 얼마나 빨리 느는지 확인한 뒤 실행 도중에 썼으므로, 첫 빌드 전의 커밋에는 없습니다. 빌드를 실행하는 스크립트 다섯 개는 그 커밋에 있고, `runs.json`에는 실행 당시의 해시가 있습니다. 그 뒤에는 주석만 지우거나 고쳤습니다. 코드 줄은 첫 빌드 전의 커밋(PR 이력의 `f17e821`)과 같습니다.
- **감사:** 세션이 끝나면 실행 스크립트가 세션의 자체 기록을 읽어, 각 군이 받아야 할 것만 받았는지 확인합니다. 확인 항목은 `CLAUDE.md` 첨부, 메모리 섹션, 스킬, 다른 MCP 서버가 없는지와 모델·버전이 맞는지입니다. 결과는 `runs.json`의 `isolation`입니다.

### MCP군

서버는 master `5a783c9c71c049caf10c350e3d25bc346c5ccfbd`에서 빌드한 `web-stylebook-mcp` 0.11.1이고, #9의 추천 동점 처리 수정을 포함합니다. `git archive`로 내보내 `npm ci`로 설치하고 `npm run build`로 빌드한 뒤 stdio로 붙였습니다.

```json
{ "mcpServers": { "web-stylebook": { "type": "stdio", "command": "node", "args": ["<export>/dist/cli.js"] } } }
```

어떤 툴을 부를지는 에이전트가 정합니다. [`mcp-outputs/`](./mcp-outputs)에 모든 호출과 받은 결과가 있고, 세션 기록에서 옮겼습니다. 고친 것은 절대 경로의 홈 디렉터리를 `~`로, Claude Code가 세션 폴더 이름에 넣은 사용자 이름을 `<user>`로 바꾼 것뿐입니다. Claude Code는 크기 제한을 넘는 결과를 모델에 그대로 넘기지 않습니다. 호출 259번 중 18번은 저장된 사본을 가리키는 짧은 안내문만 받았습니다. 모델은 검증·토큰 구성 결과 사본 9개를 셸 명령으로 읽었고, 저장된 리소스 목록 9개는 한 번도 열지 않았습니다. `savedOutput`이 검증·토큰 구성 결과의 사본이고, `ListMcpResourcesTool` 호출 9번이 저장한 같은 리소스 목록은 `resource-list.txt`에 하나만 있습니다.

### 빌드별 기록

`runs.json`에는 빌드마다 상태, 세션 소요 시간, 종료 코드와 시그널, 세션 기록 경로, 토큰 수, Claude Code가 보고한 비용 추정치, 툴 호출 수가 있습니다. MCP군은 MCP 호출 순서도 있습니다. 비용은 정가 기준 추정치이지 청구액이 아닙니다.

`npm run build`가 0으로 끝나고 `dist/index.html`이 생기면 빌드 성공(**built**)으로 칩니다. 실행 스크립트가 세션이 끝난 뒤 에이전트가 남긴 폴더 그대로 빌드합니다. `node_modules`가 없을 때만 먼저 `npm install`을 하고, 그 사실을 표시합니다. 실패한 빌드는 실패로 기록했고, 골라서 다시 돌리지 않았습니다. 이번 실행에서는 빌드에 실패한 경우도, 다시 돌린 빌드도 없습니다.

### 스크린샷

Playwright 1.64.1, Chromium 156.0.8078.4, 헤드리스입니다. 작은 정적 서버로 `dist/`를 띄웠습니다. 뷰포트는 1440×900, 390×844 CSS 픽셀이고 기기 에뮬레이션은 쓰지 않았습니다. 스크롤해야 나타나는 섹션도 그려지도록 페이지를 한 번 끝까지 내려 본 뒤 맨 위로 돌아와 1초 기다리고, 4000px에서 자른 전체 페이지 스크린샷을 찍었습니다. 저장소에는 PNG를 품질 78의 WebP로 바꿔 넣었습니다.

### 블라인드 비교

`briefs.json` 순서대로 브리프마다 시드가 고정된 난수를 한 번씩 뽑아 어느 군이 왼쪽인지 정했습니다. 시드는 `harness/seed.mjs`에 있고 첫 빌드 전에 커밋했습니다. [`key.json`](./key.json)에 알고리즘과 결과가 있습니다. 페이지와 이미지 이름에는 군 이름이 없습니다.

## 이슈 본문과 다른 점

이슈의 프로토콜 댓글에는 Grok 4.7 high 클라우드 에이전트, MCP SDK 클라이언트, 에이전트가 직접 찍는 스크린샷이 적혀 있습니다. 이번 실행은 그 대신 아래처럼 했습니다.

- 에이전트는 Claude Code(`claude -p`)이고, 모델은 `claude-sonnet-5-5`, 노력 수준은 max입니다.
- MCP 서버는 stdio MCP 설정으로 붙이고, 에이전트가 직접 부릅니다.
- 스크린샷은 에이전트가 아니라 실행 스크립트가 모든 빌드에 똑같이 찍었습니다.
- 프롬프트에는 이슈에 있던 "responsive", "realistic content", "no stock photos"와, 질문에 답해 줄 사람이 없다는 문장을 더했습니다.

## 다시 돌리려면

```sh
# 1. 저장소 루트에서, 작업 트리 밖에 고정 커밋의 MCP 서버를 빌드합니다.
mkdir -p ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9
git archive 5a783c9c71c049caf10c350e3d25bc346c5ccfbd | tar -x -C ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9
(cd ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9 && npm ci && npm run build)

# 2. 실행 스크립트의 의존성을 설치합니다. 스크린샷 변환에는 libwebp의 cwebp도 필요합니다(예: `brew install webp`).
cd showcase/harness && npm install && npx playwright install chromium

# 3. 빌드를 돌리고(헤드리스 세션 약 20개), 모아서 게시합니다.
node driver.mjs --concurrency 4
node publish.mjs && node build-compare.mjs
```

`SHOWCASE_ROOT`는 실행 폴더 위치를, `SHOWCASE_CLAUDE_BIN`과 `SHOWCASE_MCP_CLI`는 바이너리와 서버 경로를 바꿉니다. 다시 돌리면 Claude 요금제 사용량이 실제로 들고, 똑같은 페이지가 나오지도 않습니다.

`harness/`의 스크립트:

| 스크립트 | 하는 일 |
|---|---|
| `driver.mjs` | 작업자 풀로 빌드 20개를 모두 돌립니다: `node driver.mjs --concurrency 4 [--stagger 20] [--only brief:arm,...]`. |
| `run-build.mjs` | 빌드 하나를 돌린 뒤 빌드 확인과 스크린샷을 합니다: `node run-build.mjs <brief-id> <control\|mcp>`. |
| `governor.mjs` | 사용량 창에 맞춰 드라이버 속도를 조절합니다: `node governor.mjs <driver-pid> [--concurrency 4]`. |
| `publish.mjs` | 빌드 로그에서 `runs.json`과 `mcp-outputs/`를 만듭니다. |
| `build-compare.mjs` | WebP 스크린샷, `key.json`, 비교 페이지를 만듭니다: `[--out <dir>] [--quality 78]`. |
| `tables.mjs` | `RESULTS.md`에 쓴 표를 출력합니다: `[--lang ko]`. |
| `lib.mjs`, `session.mjs`, `shoot.mjs` | 공통 설정과 프롬프트, 세션 기록 읽기와 격리 감사, 스크린샷. |
| `assign.mjs`, `seed.mjs` | 시드 기반 좌우 추첨과 그 시드. |

## 한계

- 브리프마다, 군마다 빌드 하나씩이고 에이전트와 모델도 하나입니다. 같은 군을 두 번 만들어도 결과가 다를 것이므로, 쌍 하나로는 효과를 보일 수 없습니다.
- 브리프 10개는 표본이 아니라 쇼케이스입니다. 통계적 주장은 뒷받침하지 못합니다.
- 에이전트가 헤드리스로 돌아서, 서버가 안내하는 사전 질문과 승인 단계는 거치지 못했습니다.
- 최대 4개 세션이 기본 미리보기 포트와 프로세스 목록을 포함해 한 대의 머신을 같이 썼습니다. 세션끼리 서로의 미리보기 서버를 끈 경우가 최소 세 번 있고, 대조군 빌드는 모든 쌍에서 MCP 짝보다 먼저 또는 같이 시작했습니다. 자세한 내용은 [`RESULTS.ko.md`](./RESULTS.ko.md)에 있습니다.
- 판단은 전체 페이지 스크린샷을 Claude 모델이 눈으로 본 것입니다. 이 실험을 돌린 에이전트와 새로 띄운 서브에이전트 둘입니다. 인터랙션, 모션, 접근성은 시험하지 않았습니다.
- 스크린샷은 4000px에서 잘려서, 긴 페이지의 아래쪽은 보이지 않습니다.
