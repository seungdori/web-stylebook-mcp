#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, homedir, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARMS, CLAUDE_VERSION, EFFORT, MCP_CLI, MODEL, ROOT, SHOWCASE_DIR, loadBriefs, logDir, sha256File } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outFlag = process.argv.indexOf('--out');
const out = outFlag > 0 ? process.argv[outFlag + 1] : SHOWCASE_DIR;
const MASTER_SHA = '5a783c9c71c049caf10c350e3d25bc346c5ccfbd';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const seconds = (a, b) => Math.round((new Date(b) - new Date(a)) / 100) / 10;
const sumSeconds = (values) => Math.round(values.reduce((total, v) => total + v, 0) * 10) / 10;
const sumUsd = (values) => Math.round(values.reduce((total, v) => total + v, 0) * 100) / 100;

// The repo is public; absolute paths would publish the local user name. Claude Code also encodes the working directory
// into its session folder names, so that form needs its own replacement.
const home = homedir();
const encodedHome = home.replace(/[^a-zA-Z0-9]/g, '-');
const scrub = (text) => text.replaceAll(home, '~').replaceAll(encodedHome, '-Users-<user>');

// Claude Code does not pass a result above its size limit to the model inline. The model gets a stub that names a saved
// copy, so the saved copy is the full result the agent could have read.
const STUB = /persisted-output|exceeds maximum allowed tokens/;
function savedOutputPath(output) {
  const text = typeof output === 'string' ? output : (output ?? []).map((b) => b.text ?? '').join('\n');
  if (!STUB.test(text)) return null;
  const match = text.match(/(\/[^\s"]+\/tool-results\/[^\s"]+?\.(?:txt|json))/);
  if (!match || !existsSync(match[1])) throw new Error(`a truncated MCP result points at a saved copy that is missing: ${text.slice(0, 200)}`);
  return match[1];
}
const RESOURCE_LIST_FILE = 'resource-list.txt';
const resourceLists = new Set();

// A session stopped at the cap writes no result event, but Claude Code's own session record keeps a final cost state.
function sessionRecordCost(meta) {
  const file = meta.transcript?.session?.replace(/^~/, homedir());
  if (!file || !existsSync(file)) return null;
  const last = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.includes('"cost-state"'))
    .map((line) => JSON.parse(line))
    .at(-1);
  if (!last) return null;
  const usage = last.modelUsage?.[MODEL] ?? {};
  return {
    usd: last.totalCostUSD,
    tokens: {
      input: usage.inputTokens ?? null,
      output: usage.outputTokens ?? null,
      cacheRead: usage.cacheReadInputTokens ?? null,
      cacheCreation: usage.cacheCreationInputTokens ?? null,
    },
  };
}

// A stopped session that still built is not a failed build, so the status keeps the kinds apart and the notes say what happened.
function classify(meta) {
  const notes = [];
  const { session, claude, build } = meta;
  const sessionOk = session.exitCode === 0 && !session.timedOut && !session.spawnError && claude.isError === false;
  if (session.spawnError) notes.push(`claude did not start: ${session.spawnError}`);
  if (session.timedOut) notes.push('the session hit the 90-minute limit and was stopped');
  if (session.exitCode !== 0 && !session.timedOut) notes.push(`claude exited with ${session.exitCode ?? session.signal}`);
  if (claude.isError) notes.push(`claude reported an error result (${claude.subtype}, api status ${claude.apiErrorStatus})`);
  if (build?.reason) notes.push(build.reason);
  if (build?.installRan) notes.push('node_modules was missing, so the harness ran npm install first');
  if (build?.build && build.build.exitCode !== 0) notes.push(`npm run build exited with ${build.build.exitCode ?? build.build.signal}`);
  if (build?.build && build.build.exitCode === 0 && !build.distIndex) notes.push('npm run build passed but wrote no dist/index.html');
  if (!meta.isolation.ok) notes.push(`isolation audit: ${meta.isolation.problems.join('; ')}`);

  const shots = meta.screenshots ?? {};
  for (const [width, shot] of Object.entries(shots)) {
    if (shot.pageErrors.length) notes.push(`${width} px: uncaught page errors (${shot.pageErrors.length})`);
    if (shot.horizontalOverflow) notes.push(`${width} px: the page is wider than the viewport (${shot.pageWidth} px)`);
    if (shot.truncated) notes.push(`${width} px: the page is ${shot.pageHeight} px tall; the screenshot stops at ${shot.capturedHeight} px`);
  }

  let status = 'ok';
  if (!build?.ok) status = 'build-failed';
  else if (meta.screenshotError || Object.keys(shots).length === 0) status = 'screenshot-failed';
  else if (Object.values(shots).some((s) => s.textLength < 20)) status = 'blank-page';
  else if (session.timedOut) status = 'built-timed-out';
  else if (!sessionOk) status = 'built-with-session-error';
  return { status, notes };
}

const briefs = loadBriefs();
const builds = [];
for (const brief of briefs) {
  for (const arm of ARMS) {
    const metaPath = join(logDir(brief.id, arm), 'meta.json');
    if (!existsSync(metaPath)) throw new Error(`missing ${metaPath}; every build must be finished before publishing`);
    const meta = readJson(metaPath);
    if (meta.stage !== 'done') throw new Error(`${brief.id}/${arm} is at stage "${meta.stage}"`);

    const { status, notes } = classify(meta);
    const usage = meta.claude.usage ?? {};
    const fallback = meta.claude.totalCostUsd == null ? sessionRecordCost(meta) : null;
    const costUsd = meta.claude.totalCostUsd ?? fallback?.usd;
    if (costUsd == null) throw new Error(`${brief.id}/${arm} has no cost in the result event or the session record`);
    builds.push({
      brief: brief.id,
      arm,
      status,
      built: meta.build?.ok === true,
      notes,
      startedAt: meta.session.startedAt,
      endedAt: meta.session.endedAt,
      wallSeconds: meta.session.wallSeconds,
      exitCode: meta.session.exitCode,
      signal: meta.session.signal,
      timedOut: meta.session.timedOut,
      buildCheck: {
        installRanByHarness: meta.build?.installRan ?? false,
        npmRunBuildExitCode: meta.build?.build?.exitCode ?? null,
        npmRunBuildSeconds: meta.build?.build?.seconds ?? null,
        distIndexWritten: meta.build?.distIndex ?? false,
        distBytes: meta.build?.distBytes ?? null,
      },
      claude: {
        sessionId: meta.claude.sessionId,
        subtype: meta.claude.subtype,
        isError: meta.claude.isError,
        numTurns: meta.claude.numTurns,
        durationMs: meta.claude.durationMs,
        durationApiMs: meta.claude.durationApiMs,
        estimatedCostUsd: costUsd,
        costSource: meta.claude.totalCostUsd != null ? 'result event' : 'session record',
        tokens: fallback?.tokens ?? {
          input: usage.input_tokens ?? null,
          output: usage.output_tokens ?? null,
          cacheRead: usage.cache_read_input_tokens ?? null,
          cacheCreation: usage.cache_creation_input_tokens ?? null,
        },
        toolCounts: meta.claude.toolCounts,
        permissionDenials: meta.claude.permissionDenials,
        subagentCalls: meta.claude.toolCounts.Agent ?? 0,
        finalMessage: meta.claude.finalMessage,
      },
      mcp: arm === 'mcp' ? meta.mcp : null,
      isolation: { ok: meta.isolation.ok, problems: meta.isolation.problems },
      transcript: meta.transcript,
      source: meta.source,
      screenshots: Object.fromEntries(
        Object.entries(meta.screenshots ?? {}).map(([width, s]) => [
          width,
          {
            pageHeight: s.pageHeight,
            capturedHeight: s.capturedHeight,
            truncated: s.truncated,
            pageWidth: s.pageWidth,
            horizontalOverflow: s.horizontalOverflow,
            textLength: s.textLength,
            hasViewportMeta: s.hasViewportMeta,
            consoleErrors: s.consoleErrors,
            pageErrors: s.pageErrors,
            failedRequests: s.failedRequests,
            notes: s.notes,
          },
        ]),
      ),
      command: meta.command.shell,
      commandEnv: meta.command.env,
      prompt: readFileSync(join(logDir(brief.id, arm), 'prompt.txt'), 'utf8'),
    });

    if (arm === 'mcp') {
      const calls = readJson(join(logDir(brief.id, arm), 'mcp-calls.json'));
      for (const call of calls) {
        const saved = savedOutputPath(call.output);
        if (!saved) continue;
        const text = readFileSync(saved, 'utf8');
        if (call.tool === 'ListMcpResourcesTool') {
          resourceLists.add(text);
          call.savedOutputFile = RESOURCE_LIST_FILE;
        } else {
          call.savedOutput = text;
        }
      }
      mkdirSync(join(out, 'mcp-outputs'), { recursive: true });
      const source =
        'tool calls and results from the session transcript; the home directory in paths is replaced by ~; savedOutput is the full text Claude Code saved when a result was too large to pass inline';
      writeFileSync(join(out, 'mcp-outputs', `${brief.id}.json`), scrub(`${JSON.stringify({ brief: brief.id, source, calls }, null, 2)}\n`));
    }
  }
}

const driver = readJson(join(ROOT, '_logs', 'driver.json')).invocations;
const first = driver[0];
const starts = builds.map((b) => b.startedAt).sort();
const ends = builds.map((b) => b.endedAt).sort();
const perArm = Object.fromEntries(
  ARMS.map((arm) => {
    const list = builds.filter((b) => b.arm === arm);
    return [
      arm,
      {
        builds: list.length,
        built: list.filter((b) => b.built).length,
        sessionWallSeconds: sumSeconds(list.map((b) => b.wallSeconds)),
        estimatedCostUsd: sumUsd(list.map((b) => b.claude.estimatedCostUsd)),
      },
    ];
  }),
);

const playwrightDir = join(here, 'node_modules');
const runs = {
  masterSha: MASTER_SHA,
  mcpPackageVersion: readJson(join(dirname(dirname(MCP_CLI)), 'package.json')).version,
  model: MODEL,
  effort: EFFORT,
  claudeCodeVersion: CLAUDE_VERSION,
  briefsSha256: sha256File(join(SHOWCASE_DIR, 'briefs.json')),
  tooling: {
    os: `Darwin ${release()} ${arch()}`,
    node: first.node,
    npm: first.npm,
    playwright: readJson(join(playwrightDir, 'playwright', 'package.json')).version,
    chromium: readJson(join(playwrightDir, 'playwright-core', 'browsers.json')).browsers.find((b) => b.name === 'chromium').browserVersion,
  },
  harnessSha256: first.harness,
  invocations: driver.map((d) => ({
    startedAt: d.startedAt,
    endedAt: d.endedAt,
    concurrency: d.concurrency,
    staggerSeconds: d.staggerSeconds,
    harnessMatchesFirstInvocation: JSON.stringify(d.harness) === JSON.stringify(first.harness),
  })),
  totals: {
    builds: builds.length,
    built: builds.filter((b) => b.built).length,
    elapsedSeconds: seconds(starts[0], ends.at(-1)),
    sessionWallSecondsSum: sumSeconds(builds.map((b) => b.wallSeconds)),
    perArm,
  },
  builds,
};
if (resourceLists.size > 1) throw new Error('the saved resource lists differ between builds, so they cannot share one file');
if (resourceLists.size === 1) writeFileSync(join(out, 'mcp-outputs', RESOURCE_LIST_FILE), scrub([...resourceLists][0]));
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'runs.json'), scrub(`${JSON.stringify(runs, null, 2)}\n`));
console.log(`wrote ${builds.length} builds to ${out}`);
