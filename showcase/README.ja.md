# web-stylebook-mcp を使う場合と使わない場合

[English](./README.md) · [한국어](./README.ko.md) · **日本語**

[issue #7](https://github.com/seungdori/web-stylebook-mcp/issues/7) に関する実験です。検証する主張は、この MCP サーバーを持つコーディングエージェントが、持たない場合よりもありきたりでない UI を作る、というものです。

プロダクトのブリーフ 10 件を、同じヘッドレスエージェントが空のフォルダーから 2 回ずつ作りました。1 回は MCP なし、もう 1 回は MCP ありです。90 分の時間上限で止まったものも含め、すべてのビルドをここに置いています。スコアは付けていません。どちらの群かを伏せて左右に並べてあるので、ご自身で判断してください。

## はじめに

1. [`compare/index.html`](./compare/index.html) を開いてください。10 組すべてを、1440 px と 390 px の幅で左右に並べて表示します。GitHub は HTML をソースとして表示するため、リポジトリをクローンしてからファイルを開いてください。
2. ほかの文書を読む前に、すべてのペアを見てください。どちらが何かは、ブリーフごとにランダムに決めています。
3. 次に [`RESULTS.ja.md`](./RESULTS.ja.md)（失敗したビルドと、対照群のほうが良く見えた場合）を読み、[`key.json`](./key.json) で対応関係を確認してください。私が書いたブラインドメモと、独立した評価者 2 名のメモは、[`blind-notes.md`](./blind-notes.md) と [`blind-reads/`](./blind-reads/) にあります。

## このフォルダーの内容

| パス | 内容 |
|---|---|
| `briefs.json` | ブリーフ 10 件。最初の実行の前に書き、その後は一度も編集していません。 |
| `compare/index.html` | どちらの群かを伏せた、左右比較のページ。 |
| `key.json` | シード、アルゴリズム、どちらの群がどちら側だったか。 |
| `screenshots/<brief>/{left,right}-{1440,390}.webp` | ページ全体のスクリーンショット（4000 px で切っています）。名前は意図的に中立にしてあり、どの群かは `key.json` に書かれています。 |
| `mcp-outputs/<brief>.json`, `mcp-outputs/resource-list.txt` | MCP 群が行ったすべての MCP ツール呼び出しと、受け取った結果。また、大きすぎてインラインで渡せなかった結果の保存テキスト。 |
| `runs.json` | ビルドごとの記録。ステータス、経過時間、終了コード、トークン数、ツール数、隔離の監査、プロンプト、実際のコマンド。 |
| `RESULTS.md`, `RESULTS.ko.md`, `RESULTS.ja.md` | 結果のノート。 |
| `blind-notes.md` | `key.json` を開く前に、ペアごとに私が書いたメモ。 |
| `blind-reads/` | 新たに起動した Claude サブエージェント 2 体による、独立したブラインド判読と、彼らが受け取った指示文の全文。 |
| `harness/` | 実行、キャプチャ、公開に使ったスクリプト。 |

コミットしていないものは、生成されたアプリと、生のトランスクリプトです。どちらも実験を実行したマシンの `~/stylebook-showcase-runs/` にあり、各トランスクリプトのパスは `runs.json` に記録しています。

## プロトコル

プロトコルは最初の実行の前に確定させました。ブリーフ、ハーネス、比較用のシードは、それぞれ先にコミットしています。

### ブリーフ

各 3 文の、製品の説明だけからなるブリーフ 10 件です。デザインの指示は含めていません。SRE インシデント・ダッシュボード、エッセイブログ、高級スキンケア商品のページ、子ども向けプログラミング学習のランディングページ、開発者向け API ドキュメントのトップ、家計簿アプリの概要画面、建築スタジオのポートフォリオ、街のパン屋の注文サイト、B2B の HR SaaS のランディングページ、音楽フェスのページです。`runs.json` には `briefs.json` の SHA-256 を記録しています。

### 群

両群は、同じエージェント、同じモデル、同じツールの制限、同じビルド指示を使います。違いはプロンプトの 1 段落と、MCP サーバーを接続するかどうかだけです。

対照群のプロンプト（`{brief}` はブリーフ本文）:

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

MCP 群には、同じ本文に加えて次の段落を、最後の段落の直前に入れました:

```text
The web-stylebook MCP server is attached to this session. Call its `recommend_design_direction` tool first, before you design anything. After that, use its token, UI-state, and audit tools as you see fit.
```

プロンプトの最後の段落は、サーバー自身の指示が「ビルドの前にヒアリングを行い、承認を待つ」ことを求めているため入れました。ヘッドレス実行では誰も答えられないので、両群とも自分だけで決めるよう指示しています。対話型のセッションであれば、MCP 群の振る舞いは異なるかもしれません。

### エージェントと隔離

各ビルドは、それぞれ空のフォルダー `~/stylebook-showcase-runs/<brief>/<arm>/` で行った、別々のヘッドレス Claude Code の実行です。プロンプトは標準入力で渡しています。

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

ビルドごとの実際のコマンドラインは `runs.json` にあります。

- **モデルと推論の強度:** `claude-sonnet-5-5` を `max` の推論強度で、Claude Code 2.1.302 を使いました。自動更新で実行中にバージョンが変わらないよう、バージョン付きのバイナリを直接呼び出して固定しています。
- **ホスト側の設定を入れない:** `--setting-sources project` は、ユーザー設定、フック、プラグイン、出力スタイルを除外します。`CLAUDE_CODE_DISABLE_*` の 2 つの変数は、ユーザーの `CLAUDE.md` ファイルと自動メモリを除外します。`--setting-sources` だけでは、これらは除外されません。`--disable-slash-commands` は、同梱の `dataviz` スキルを含むすべてのスキルを除外します。これはデザイン指針として数えられてしまうためです。環境変数は許可リスト方式なので、親セッションの値は一切入りません。
- **MCP:** `--strict-mcp-config` は、指定された設定だけを読み込みます。対照群はサーバーの一覧が空で、MCP 群は後述する stdio サーバーを 1 つだけ受け取ります。
- **ツール:** エージェントは、確認なしにファイルを書き込み、コマンドを実行できます。Web 検索と Web の取得は、両群とも無効にしました。両群の外からデザイン指針が入ってしまうためです。ほかの拒否したツールと `Bash` のパターンは、実行フォルダーの外に及ぶ操作、すなわち公開、リモートホストへの接続、スケジュールされたジョブ、通知を対象としています。
- **時間上限と並行実行:** セッションは 90 分で停止しました。ハーネスは、停止した時点のフォルダーをそのままビルドし、停止を `timedOut` として記録しています。ビルドは最大 4 件まで同時に動かしました。最初の 4 件は 20 秒間隔で開始し、ペースを保つための待機のあとは、待っていたビルドがまとめて開始しました。時間上限はハーネス独自のもので、課題のプロトコルには含まれていません。両群に同じように適用しています。時間上限で止まったビルドは [`RESULTS.ja.md`](./RESULTS.ja.md) に記載しています。
- **使用量の調整:** max の推論強度のセッションを 4 つ同時に動かすと、Claude プランの 5 時間の使用量枠を、1 時間あたり約 5 分の 1 消費しました。アカウントの上限で途中で止まったビルドは、結果ではなくインフラの失敗になります。そこで `harness/governor.mjs` が `driver.mjs` を一時停止（`SIGSTOP`）し、新しく取得した使用量に空きがあるときだけ再開（`SIGCONT`）しました。実行中のビルドを止めたことはなく、ビルドスクリプトも変更していません。そのため、同じブリーフの 2 つの群が、必ずしも同時に動いたわけではありません。開始と終了の時刻はすべて `runs.json` にあります。`governor.mjs` は、最初のビルドで使用量がどれほど速く増えるかを確認したあとで、実行の途中に書きました。そのため、最初のビルドより前のコミットには含まれていません。ビルドを実行する 5 つのスクリプトは、そのコミットに含まれています。`runs.json` には、実行時のハッシュを記録しています。その後は、コメントを削除したり言い換えたりしただけです。コードの行は、最初のビルドより前のコミット（PR 履歴の `f17e821`）と同じです。
- **監査:** セッションが終わると、ハーネスはセッション自身の記録を読み、各群が受け取るべきものだけを受け取っていたことを確認します。確認項目は、`CLAUDE.md` の添付がないこと、メモリのセクションがないこと、スキルがないこと、余分な MCP サーバーがないこと、モデルとバージョンが正しいことです。結果は `runs.json` の `isolation` にあります。

### MCP 群

サーバーは、master の `5a783c9c71c049caf10c350e3d25bc346c5ccfbd` からビルドした `web-stylebook-mcp` 0.11.1 です。これには #9 の推薦の同点処理の修正が含まれています。`git archive` で書き出し、`npm ci` でインストールし、`npm run build` でビルドしてから、stdio で接続しました。

```json
{ "mcpServers": { "web-stylebook": { "type": "stdio", "command": "node", "args": ["<export>/dist/cli.js"] } } }
```

どのツールを呼ぶかは、エージェントが決めます。[`mcp-outputs/`](./mcp-outputs) には、すべての呼び出しと受け取った結果が、セッションのトランスクリプトから写されています。手を加えたのは、絶対パスのホームディレクトリを `~` に、Claude Code がエンコードしたセッションフォルダー名のユーザー名を `<user>` に置き換えた点だけです。Claude Code は、サイズの上限を超える結果をモデルにインラインでは渡しません。259 回の呼び出しのうち 18 回では、モデルは保存されたコピーを示す代替文だけを受け取りました。モデルは、validate と compose の 9 件のコピーをシェルコマンドで読み、保存された 9 件のリソース一覧は一度も開きませんでした。`savedOutput` には validate と compose のコピーが入っています。`resource-list.txt` には、9 回の `ListMcpResourcesTool` 呼び出しが保存した唯一のリソース一覧が入っています。

### ビルドごとの記録

`runs.json` には、ビルドごとに、ステータス、セッションの経過時間、終了コードとシグナル、トランスクリプトのパス、トークン数、Claude Code が報告するコストの推定値、ツール数が入っています。MCP 群については、MCP 呼び出しの順序も入っています。コストは定価で計算した推定値であり、請求額ではありません。

`npm run build` が 0 で終了し、`dist/index.html` が書き出された場合にだけ、ビルドを **成功** とみなします。ハーネスは、エージェントが残したフォルダーのままで、セッションのあとにこれを実行します。`node_modules` がない場合にだけ先に `npm install` を実行し、その事実を記録します。失敗したビルドは失敗として記録し、選んで再実行はしていません。今回の実行では、ビルドに失敗したものも、再実行したものもありません。

### スクリーンショット

Playwright 1.64.1 と Chromium 156.0.8078.4 を、ヘッドレスで使いました。小さな静的サーバーで `dist/` を配信しています。ビューポートは 1440×900 と 390×844 の CSS ピクセルで、デバイスのエミュレーションは使っていません。ハーネスは、スクロールで表示されるセクションも描画されるよう、ページを一度最後までスクロールし、先頭に戻り、1 秒待ってから、4000 px で切ったページ全体のスクリーンショットを撮りました。PNG はリポジトリ用に、品質 78 の WebP に変換しています。

### ブラインド比較

`briefs.json` の順に、ブリーフごとに、シードを固定した乱数生成器から 1 回抽選して、どちらの群を左に置くかを決めました。シードは `harness/seed.mjs` にあり、最初のビルドの前にコミットしています。[`key.json`](./key.json) に、アルゴリズムと結果を記録しています。ページと画像の名前には、群の名前は入っていません。

## 課題本文からの逸脱

課題のプロトコルのコメントには、Grok 4.7 high のクラウドエージェント、MCP SDK のクライアント、エージェント自身が撮るスクリーンショットが挙げられていました。今回の実行では、代わりにブリーフに従い、次のようにしました。

- エージェントは Claude Code（`claude -p`）で、モデルは `claude-sonnet-5-5`、推論の強度は max です。
- MCP サーバーは MCP 設定を通じて stdio で接続し、エージェントが直接呼び出します。
- スクリーンショットは、エージェントではなくハーネスが、すべてのビルドで同じ方法で撮りました。
- プロンプトには、課題にあった "responsive"、"realistic content"、"no stock photos" を加えました。また、質問に答える人がいないという一文も加えています。

## 再現方法

```sh
# 1. リポジトリのルートで、作業ツリーの外に、固定したコミットの MCP サーバーをビルドします。
mkdir -p ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9
git archive 5a783c9c71c049caf10c350e3d25bc346c5ccfbd | tar -x -C ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9
(cd ~/stylebook-showcase-runs/_mcp/web-stylebook-mcp-5a783c9 && npm ci && npm run build)

# 2. ハーネスの依存関係をインストールします。スクリーンショットには libwebp の cwebp も必要です（例: `brew install webp`）。
cd showcase/harness && npm install && npx playwright install chromium

# 3. ビルドを実行し（ヘッドレスセッション約 20 件）、そのあと収集して公開します。
node driver.mjs --concurrency 4
node publish.mjs && node build-compare.mjs
```

`SHOWCASE_ROOT` は実行フォルダーの場所を、`SHOWCASE_CLAUDE_BIN` と `SHOWCASE_MCP_CLI` はバイナリとサーバーのパスを変更します。再実行すると、Claude プランの使用量を実際に消費し、同じページになるとも限りません。

`harness/` のスクリプト:

| スクリプト | 役割 |
|---|---|
| `driver.mjs` | ワーカープールで、20 件のビルドすべてを実行します: `node driver.mjs --concurrency 4 [--stagger 20] [--only brief:arm,...]`。 |
| `run-build.mjs` | ビルドを 1 件実行し、そのあとビルドの確認とスクリーンショットを行います: `node run-build.mjs <brief-id> <control\|mcp>`。 |
| `governor.mjs` | 使用量の枠に合わせて driver のペースを調整します: `node governor.mjs <driver-pid> [--concurrency 4]`。 |
| `publish.mjs` | ビルドのログから `runs.json` と `mcp-outputs/` を書き出します。 |
| `build-compare.mjs` | WebP のスクリーンショット、`key.json`、比較ページを書き出します: `[--out <dir>] [--quality 78]`。 |
| `tables.mjs` | `RESULTS.md` で使った表を出力します: `[--lang ko]`、`[--lang ja]`。 |
| `lib.mjs`, `session.mjs`, `shoot.mjs` | 共通の設定とプロンプト、トランスクリプトの読み取りと隔離の監査、スクリーンショット。 |
| `assign.mjs`, `seed.mjs` | シードに基づく左右の抽選と、そのシード。 |

## 制限

- ブリーフごと、群ごとに 1 件のビルドで、エージェントもモデルも 1 つです。同じ群を 2 回作れば結果は違うはずなので、1 組のペアでは効果は示せません。
- ブリーフ 10 件はサンプルではなく、ショーケースです。統計的な主張は支えられません。
- エージェントはヘッドレスで動いたため、サーバーが案内するヒアリングと承認の手順は行えませんでした。
- 最大 4 つのセッションが、既定のプレビューポートとプロセス一覧を含めて、1 台のマシンを共有していました。セッションが互いのプレビューサーバーを止めたことが、少なくとも 3 回ありました。対照群のビルドは、すべてのペアで MCP の対になるビルドより先、または同時に開始しています。詳細は [`RESULTS.ja.md`](./RESULTS.ja.md) にあります。
- 判断は、ページ全体のスクリーンショットを Claude モデルが見て行いました。この実験を実行したエージェントと、新たに起動した 2 体のサブエージェントです。インタラクション、モーション、アクセシビリティは検証していません。
- スクリーンショットは 4000 px で切れるため、長いページの下の部分は表示されていません。
