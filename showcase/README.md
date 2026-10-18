# With and without web-stylebook-mcp

**English** · [한국어](./README.ko.md)

An experiment for [issue #7](https://github.com/seungdori/web-stylebook-mcp/issues/7). The claim under test: a coding agent that has this MCP server produces less generic UI than the same agent without it.

Ten product briefs were each built twice from an empty folder by the same headless agent, once without the MCP and once with it. Every build is here, including the ones the 90-minute time cap stopped. There is no score. The pairs are shown side by side with the arm hidden, so you can judge them yourself.

## Start here

1. Open [`compare/index.html`](./compare/index.html). It shows all ten pairs, left against right, at 1440 px and 390 px. GitHub shows HTML as source, so clone the repo and open the file.
2. Look at every pair before you read anything else. Which side is which is random per brief.
3. Then read [`RESULTS.md`](./RESULTS.md) (failures, and where the control build looked better) and open [`key.json`](./key.json) for the mapping. My own blind notes and two independent readers' notes are in [`blind-notes.md`](./blind-notes.md) and [`blind-reads/`](./blind-reads/).

## What is in this folder

| Path | Contents |
|---|---|
| `briefs.json` | The ten briefs. Written before any run and never edited after. |
| `compare/index.html` | The blind side-by-side page. |
| `key.json` | The seed, the algorithm, and which arm was on which side. |
| `screenshots/<brief>/{left,right}-{1440,390}.webp` | Full-page screenshots, cut at 4000 px. The names are neutral on purpose; `key.json` says which arm each one is. |
| `mcp-outputs/<brief>.json`, `mcp-outputs/resource-list.txt` | Every MCP tool call the MCP arm made, with the result it received, plus the saved text of results too large to pass inline. |
| `runs.json` | Per-build record: status, wall time, exit code, token counts, tool counts, isolation audit, prompt, exact command. |
| `RESULTS.md`, `RESULTS.ko.md` | The results note. |
| `blind-notes.md` | My notes on each pair, written before I opened `key.json`. |
| `blind-reads/` | Two independent blind reads by fresh Claude subagents, with the exact instructions they got. |
| `harness/` | The scripts that ran, captured, and published everything. |

Not committed: the generated apps and the raw transcripts. They stay in `~/stylebook-showcase-runs/` on the machine that ran the experiment, and `runs.json` records each transcript path.

## Protocol

The protocol was fixed before the first run. The briefs, the harness, and the comparison seed were each committed first.

### Briefs

Ten briefs of three sentences each, product description only, with no design guidance: an SRE incident dashboard, an essay blog, a luxury skincare product page, a kids coding landing page, a developer API docs homepage, a budgeting app overview screen, an architecture studio portfolio, a bakery ordering site, a B2B HR SaaS landing page, and a music festival page. `runs.json` records the SHA-256 of `briefs.json`.

### Arms

Both arms use the same agent, the same model, the same tool limits, and the same build instruction. They differ in one paragraph and in whether the MCP server is attached.

Control prompt (`{brief}` is the brief text):

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

The MCP arm gets the same text plus this paragraph, placed before the last one:

```text
The web-stylebook MCP server is attached to this session. Call its `recommend_design_direction` tool first, before you design anything. After that, use its token, UI-state, and audit tools as you see fit.
```

The last paragraph of the prompt exists because the server's own instructions tell an agent to run an intake and wait for approval before building. Nobody can answer in a headless run, so both arms are told to decide alone. In an interactive session the MCP arm would behave differently.

### Agent and isolation

Each build is a separate headless Claude Code run in its own empty folder, `~/stylebook-showcase-runs/<brief>/<arm>/`. The prompt goes in on stdin.

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

`runs.json` holds the exact command line of every build.

- **Model and effort:** `claude-sonnet-5-5` at `max` effort, Claude Code 2.1.302, pinned by calling the versioned binary so an auto-update cannot change it mid-run.
- **Nothing from the host setup:** `--setting-sources project` drops user settings, hooks, plugins, and the output style. The two `CLAUDE_CODE_DISABLE_*` variables drop the user's `CLAUDE.md` files and auto-memory, which `--setting-sources` alone does not. `--disable-slash-commands` removes every skill, including the bundled `dataviz` skill that would count as design guidance. The environment is an allowlist, so nothing from the parent session leaks in.
- **MCP:** `--strict-mcp-config` loads only the given config. The control arm gets an empty server list. The MCP arm gets one stdio server, described below.
- **Tools:** The agent can write files and run commands without prompts. Web search and fetch are off in both arms because they would bring in design guidance from outside the arms. The other denied tools and `Bash` patterns reach beyond the run folder: publishing, remote hosts, scheduled jobs, and notifications.
- **Time limit and concurrency:** A session is stopped after 90 minutes. The harness then builds the folder as it stands and records the stop as `timedOut`. Up to four builds ran at once. The first four started 20 seconds apart, and after each pacing pause the builds that were waiting started together. The limit is the harness's own, not part of the issue's protocol, and it applied to both arms. [`RESULTS.md`](./RESULTS.md) lists the builds it stopped.
- **Usage pacing:** Four concurrent max-effort sessions used about a fifth of a Claude plan's five-hour usage window per hour, and a build cut short by the account limit would be an infrastructure failure, not a result. So `harness/governor.mjs` paused `driver.mjs` (`SIGSTOP`) and resumed it (`SIGCONT`) only when a fresh usage reading left room for the free slots. It never paused a running build, and it left the build scripts unchanged. The two arms of a brief therefore did not always run at the same time; `runs.json` has every start and end time. I wrote `governor.mjs` during the run, after the first builds showed how fast usage grew, so it is not in the commit that precedes the first build. The five scripts that run a build are, and `runs.json` records their hashes as they ran. Afterwards I only removed or reworded comments in them: their code lines are identical to the commit that precedes the first build (`f17e821` in the PR history).
- **Audit:** After each session the harness reads the session's own record and checks that it received exactly what its arm should have: no `CLAUDE.md` attachment, no memory section, no skills, no stray MCP servers, the right model and version. The result is `isolation` in `runs.json`.

### MCP arm

The server is `web-stylebook-mcp` 0.11.1 built from master at `5a783c9c71c049caf10c350e3d25bc346c5ccfbd`, which includes the recommendation tie fix from #9. It was exported with `git archive`, installed with `npm ci`, built with `npm run build`, and attached over stdio:

```json
{ "mcpServers": { "web-stylebook": { "type": "stdio", "command": "node", "args": ["<export>/dist/cli.js"] } } }
```

The agent decides which tools to call. [`mcp-outputs/`](./mcp-outputs) has every call and the result it got, copied from the session transcript. The only edits are that the home directory in absolute paths became `~` and the user name in Claude Code's encoded session folder names became `<user>`. Claude Code does not pass a result above its size limit to the model inline: for 18 of the 259 calls the model got a stub that names a saved copy. The model read the nine validate and compose copies with a shell command and never opened the nine saved resource lists. `savedOutput` holds the validate and compose copies, and `resource-list.txt` holds the one resource list that the nine `ListMcpResourcesTool` calls saved.

### Per-build record

For every build `runs.json` has the status, wall time of the session, exit code and signal, the transcript paths, token counts and the cost estimate Claude Code reports, tool counts, and, for the MCP arm, the order of MCP calls. Cost is an estimate at list price, not a bill.

A build counts as **built** only if `npm run build` exits 0 and writes `dist/index.html`. The harness runs it after the session on the folder as the agent left it, and runs `npm install` first only when `node_modules` is missing, which it flags. Failed builds are recorded as failures and nothing is retried selectively. In this run no build failed and none was retried.

### Screenshots

Playwright 1.64.1 with Chromium 156.0.8078.4, headless. A small static server serves `dist/`. The viewports are 1440×900 and 390×844 CSS pixels, with no device emulation. The harness scrolls through the page once so reveal-on-scroll sections are drawn, returns to the top, waits a second, and takes a full-page screenshot cut at 4000 px. PNGs were converted to WebP at quality 78 for the repo.

### Blind comparison

For each brief, in the order of `briefs.json`, one draw from a seeded generator decides which arm is on the left. The seed is in `harness/seed.mjs` and was committed before the first build. [`key.json`](./key.json) records the algorithm and the result. The page and the image names do not name the arm.

## Deviations from the issue text

The protocol comment on the issue names a Grok 4.7 high cloud agent, an MCP SDK client, and screenshots taken by the agent. This run follows the task brief instead:

- The agent is Claude Code (`claude -p`) with `claude-sonnet-5-5` at max effort.
- The MCP server is attached through an MCP config over stdio, and the agent calls it directly.
- The harness took the screenshots, identically for all builds.
- The prompt adds "responsive", "realistic content", and "no stock photos" from the issue and the line that nobody can answer questions.

## Reproduce

```sh
# 1. From the repo root, build the MCP server at the pinned commit, outside your working tree.
mkdir -p ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9
git archive 5a783c9c71c049caf10c350e3d25bc346c5ccfbd | tar -x -C ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9
(cd ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9 && npm ci && npm run build)

# 2. Install the harness dependencies. The screenshots also need cwebp from libwebp, for example `brew install webp`.
cd showcase/harness && npm install && npx playwright install chromium

# 3. Run the builds (about 20 headless sessions), then collect and publish.
node driver.mjs --concurrency 4
node publish.mjs && node build-compare.mjs
```

`SHOWCASE_ROOT` moves the run folders, `SHOWCASE_CLAUDE_BIN` and `SHOWCASE_MCP_CLI` override the binary and the server path. Re-running spends real usage on your Claude plan and will not give identical pages.

The scripts in `harness/`:

| Script | What it does |
|---|---|
| `driver.mjs` | Runs all 20 builds with a worker pool: `node driver.mjs --concurrency 4 [--stagger 20] [--only brief:arm,...]`. |
| `run-build.mjs` | Runs one build, then the build check and the screenshots: `node run-build.mjs <brief-id> <control\|mcp>`. |
| `governor.mjs` | Paces the driver against the usage window: `node governor.mjs <driver-pid> [--concurrency 4]`. |
| `publish.mjs` | Writes `runs.json` and `mcp-outputs/` from the build logs. |
| `build-compare.mjs` | Writes the WebP screenshots, `key.json`, and the comparison page: `[--out <dir>] [--quality 78]`. |
| `tables.mjs` | Prints the tables used in `RESULTS.md`: `[--lang ko]`. |
| `lib.mjs`, `session.mjs`, `shoot.mjs` | Shared settings and prompts, transcript reading and the isolation audit, and the screenshots. |
| `assign.mjs`, `seed.mjs` | The seeded left/right draw and its seed. |

## Limits

- One build per brief per arm, from one agent and one model. Two builds of the same arm would differ too, so a single pair cannot show an effect.
- Ten briefs is a showcase, not a sample. Nothing here supports a statistical claim.
- The agent ran headless, so the server's intake and approval steps could not happen.
- Up to four sessions shared one machine, including the default preview port and the process table. Sessions did stop each other's preview servers at least three times, and the control build started before or with its MCP twin in every pair. [`RESULTS.md`](./RESULTS.md) has the details.
- Judgement is by eye, from full-page screenshots, and by Claude models: the agent that ran this and two fresh subagents. Interaction, motion, and accessibility were not tested.
- Screenshots are cut at 4000 px, so the bottom of long pages is not shown.
