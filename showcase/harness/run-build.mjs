#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import {
  ARMS,
  CLAUDE_BIN,
  EFFORT,
  MCP_CLI,
  MODEL,
  NPM_TIMEOUT_MS,
  PINNED_ENV,
  SESSION_TIMEOUT_MS,
  buildPrompt,
  childEnv,
  claudeArgs,
  harnessHashes,
  loadBriefs,
  logDir,
  mcpConfig,
  runDir,
  shellQuote,
  tilde,
} from './lib.mjs';
import { auditSession, readJsonl, sessionFilePath, summarizeStream } from './session.mjs';
import { shoot } from './shoot.mjs';

const [briefId, arm] = process.argv.slice(2);
const brief = loadBriefs().find((b) => b.id === briefId);
if (!brief || !ARMS.includes(arm)) {
  console.error('usage: node run-build.mjs <brief-id> <control|mcp>');
  process.exit(2);
}

const run = runDir(briefId, arm);
const logs = logDir(briefId, arm);
const metaPath = join(logs, 'meta.json');
if (existsSync(metaPath) || (existsSync(run) && readdirSync(run).length > 0)) {
  console.error(`refusing to reuse ${tilde(run)}: a build must start in an empty folder`);
  process.exit(2);
}
mkdirSync(run, { recursive: true });
mkdirSync(logs, { recursive: true });

const log = (message) => console.log(`${new Date().toISOString()} [${briefId}/${arm}] ${message}`);
const round = (n) => Math.round(n * 10) / 10;

const promptPath = join(logs, 'prompt.txt');
const mcpConfigPath = join(logs, 'mcp-config.json');
const prompt = buildPrompt(brief.brief, arm);
writeFileSync(promptPath, prompt);
writeFileSync(mcpConfigPath, `${JSON.stringify(mcpConfig(arm), null, 2)}\n`);
const args = claudeArgs(mcpConfigPath);

const meta = {
  brief: briefId,
  arm,
  stage: 'session',
  model: MODEL,
  effort: EFFORT,
  mcpCli: arm === 'mcp' ? tilde(MCP_CLI) : null,
  harness: harnessHashes(),
  command: {
    cwd: tilde(run),
    shell: tilde(`cd ${shellQuote(run)} && ${[CLAUDE_BIN, ...args].map(shellQuote).join(' ')} < ${shellQuote(promptPath)}`),
    env: PINNED_ENV,
    promptFile: tilde(promptPath),
    mcpConfigFile: tilde(mcpConfigPath),
  },
};
const save = () => writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
save();

function killGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function runSession() {
  const out = createWriteStream(join(logs, 'transcript.jsonl'));
  const err = createWriteStream(join(logs, 'stderr.log'));
  const child = spawn(CLAUDE_BIN, args, { cwd: run, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'], detached: true });
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  // claude can exit before it reads the prompt (EPIPE); the exit code and transcript already record that.
  child.stdin.on('error', () => {});

  const startedAt = new Date().toISOString();
  const started = performance.now();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killGroup(child.pid, 'SIGTERM');
    setTimeout(() => killGroup(child.pid, 'SIGKILL'), 15_000).unref();
  }, SESSION_TIMEOUT_MS);

  child.stdin.end(prompt);
  const outcome = await new Promise((resolve) => {
    child.once('error', (error) => resolve({ exitCode: null, signal: null, spawnError: error.message }));
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal, spawnError: null }));
  });
  clearTimeout(timer);
  const wallSeconds = round((performance.now() - started) / 1000);
  const endedAt = new Date().toISOString();

  // Dev servers and MCP children can outlive the session; none may survive into the next build.
  if (child.pid) killGroup(child.pid, 'SIGKILL');
  spawnSync('pkill', ['-f', '--', run]);
  await Promise.all([finished(out), finished(err)]);
  return { startedAt, endedAt, wallSeconds, timedOut, ...outcome };
}

function dirBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? dirBytes(path) : statSync(path).size;
  }
  return total;
}

function sourceFootprint() {
  const stats = { files: 0, cssLines: 0, scriptLines: 0 };
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      stats.files += 1;
      const isCss = entry.name.endsWith('.css');
      if (!isCss && !/\.(jsx?|tsx?)$/.test(entry.name)) continue;
      const lines = readFileSync(path, 'utf8').split('\n').length;
      if (isCss) stats.cssLines += lines;
      else stats.scriptLines += lines;
    }
  };
  if (existsSync(join(run, 'src'))) walk(join(run, 'src'));
  return stats;
}

function npm(npmArgs) {
  const started = performance.now();
  const result = spawnSync('npm', npmArgs, {
    cwd: run,
    env: childEnv(),
    encoding: 'utf8',
    timeout: NPM_TIMEOUT_MS,
    maxBuffer: 256 * 1024 * 1024,
  });
  appendFileSync(
    join(logs, 'build.log'),
    `$ npm ${npmArgs.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}\n[exit ${result.status}, signal ${result.signal}]\n\n`,
  );
  return {
    exitCode: result.status,
    signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    seconds: round((performance.now() - started) / 1000),
  };
}

// Judged on the folder exactly as the agent left it; the harness only installs when node_modules is missing.
function buildCheck() {
  const check = { installRan: false, install: null, build: null, distIndex: false, distBytes: null, ok: false };
  if (!existsSync(join(run, 'package.json'))) return { ...check, reason: 'no package.json in the run folder' };
  if (!existsSync(join(run, 'node_modules'))) {
    check.installRan = true;
    check.install = npm(['install', '--no-audit', '--no-fund']);
  }
  rmSync(join(run, 'dist'), { recursive: true, force: true });
  check.build = npm(['run', 'build']);
  check.distIndex = existsSync(join(run, 'dist', 'index.html'));
  check.ok = check.build.exitCode === 0 && check.distIndex;
  if (check.distIndex) check.distBytes = dirBytes(join(run, 'dist'));
  return check;
}

try {
  log('session start');
  meta.session = await runSession();
  meta.stage = 'postprocess';
  save();
  log(`session end exit=${meta.session.exitCode} signal=${meta.session.signal} wall=${meta.session.wallSeconds}s timedOut=${meta.session.timedOut}`);

  const transcriptPath = join(logs, 'transcript.jsonl');
  const { events, badLines } = readJsonl(transcriptPath);
  const summary = summarizeStream(events);
  const result = summary.result;
  meta.claude = {
    version: summary.init?.claude_code_version ?? null,
    sessionId: summary.init?.session_id ?? null,
    subtype: result?.subtype ?? null,
    isError: result?.is_error ?? null,
    apiErrorStatus: result?.api_error_status ?? null,
    terminalReason: result?.terminal_reason ?? null,
    numTurns: result?.num_turns ?? null,
    durationMs: result?.duration_ms ?? null,
    durationApiMs: result?.duration_api_ms ?? null,
    totalCostUsd: result?.total_cost_usd ?? null,
    usage: result?.usage ?? null,
    permissionDenials: result?.permission_denials ?? null,
    subagentStats: result?.subagent_stats ?? null,
    assistantMessages: summary.assistantMessages,
    toolCounts: summary.toolCounts,
    rateLimit: summary.rateLimit,
    finalMessage: typeof result?.result === 'string' ? result.result.slice(0, 2000) : null,
  };
  meta.transcript = {
    stream: tilde(transcriptPath),
    streamBytes: statSync(transcriptPath).size,
    badLines,
    session: summary.init ? tilde(sessionFilePath(summary.init)) : null,
  };
  meta.isolation = summary.init
    ? auditSession(arm, summary.init)
    : { ok: false, problems: ['the stream has no init event'], observed: {} };
  meta.mcp = {
    calls: summary.mcpCalls.map((c) => ({
      seq: c.seq,
      tool: c.tool,
      isError: c.isError,
      outputChars: JSON.stringify(c.output ?? null).length,
    })),
    firstCall: summary.mcpCalls[0]?.tool ?? null,
    toolsBeforeFirstCall: summary.toolsBeforeFirstMcp,
  };
  writeFileSync(join(logs, 'mcp-calls.json'), `${JSON.stringify(summary.mcpCalls, null, 2)}\n`);
  save();
  if (!meta.isolation.ok) log(`isolation problems: ${meta.isolation.problems.join('; ')}`);

  meta.build = buildCheck();
  meta.source = sourceFootprint();
  save();
  log(`build ok=${meta.build.ok} distIndex=${meta.build.distIndex}`);

  if (meta.build.ok) {
    try {
      const shots = await shoot(join(run, 'dist'), join(logs, 'shots'));
      for (const shot of Object.values(shots)) shot.file = tilde(shot.file);
      meta.screenshots = shots;
    } catch (error) {
      meta.screenshotError = String(error.stack ?? error);
      log(`screenshot error: ${error.message}`);
    }
  }

  meta.stage = 'done';
  meta.finishedAt = new Date().toISOString();
  save();
  log('done');
} catch (error) {
  meta.stage = 'crashed';
  meta.error = String(error.stack ?? error);
  save();
  console.error(error);
  process.exit(1);
}
