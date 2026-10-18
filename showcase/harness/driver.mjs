#!/usr/bin/env node
// Runs every brief/arm build through run-build.mjs with a small worker pool, and records the invocation.
// Usage: node driver.mjs [--concurrency 4] [--stagger 20] [--only brief:arm,brief:arm]
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARMS,
  CLAUDE_BIN,
  CLAUDE_VERSION,
  EFFORT,
  MCP_CLI,
  MODEL,
  ROOT,
  SHOWCASE_DIR,
  harnessHashes,
  loadBriefs,
  logDir,
  sha256File,
  tilde,
} from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const options = { concurrency: '4', stagger: '20', only: '' };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, '');
  if (!(key in options) || process.argv[i + 1] === undefined) {
    console.error('usage: node driver.mjs [--concurrency 4] [--stagger 20] [--only brief:arm,...]');
    process.exit(2);
  }
  options[key] = process.argv[i + 1];
}
const concurrency = Number(options.concurrency);
const staggerMs = Number(options.stagger) * 1000;
const only = new Set(options.only.split(',').filter(Boolean));

const log = (message) => console.log(`${new Date().toISOString()} [driver] ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jobs = loadBriefs().flatMap((b) => ARMS.map((arm) => ({ brief: b.id, arm })));
const queue = [];
for (const job of jobs) {
  if (only.size && !only.has(`${job.brief}:${job.arm}`)) continue;
  const metaPath = join(logDir(job.brief, job.arm), 'meta.json');
  if (!existsSync(metaPath)) {
    queue.push(job);
    continue;
  }
  const { stage } = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (stage !== 'done') {
    console.error(`${job.brief}/${job.arm} was interrupted at stage "${stage}"; resolve it by hand before resuming`);
    process.exit(2);
  }
  log(`skip ${job.brief}/${job.arm} (done)`);
}
if (queue.length === 0) {
  log('nothing to run');
  process.exit(0);
}

const driverPath = join(ROOT, '_logs', 'driver.json');
mkdirSync(dirname(driverPath), { recursive: true });
const invocation = {
  startedAt: new Date().toISOString(),
  endedAt: null,
  concurrency,
  staggerSeconds: staggerMs / 1000,
  node: process.version,
  npm: spawnSync('npm', ['-v'], { encoding: 'utf8' }).stdout.trim(),
  claudeBin: tilde(CLAUDE_BIN),
  claudeVersion: CLAUDE_VERSION,
  model: MODEL,
  effort: EFFORT,
  mcpCli: tilde(MCP_CLI),
  briefsSha256: sha256File(join(SHOWCASE_DIR, 'briefs.json')),
  harness: harnessHashes(),
  builds: [],
};
const history = existsSync(driverPath) ? JSON.parse(readFileSync(driverPath, 'utf8')) : { invocations: [] };
history.invocations.push(invocation);
const saveHistory = () => writeFileSync(driverPath, `${JSON.stringify(history, null, 2)}\n`);
saveHistory();

const running = new Map();
let lastKnownLimit = null;

function readTail(path, bytes) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(bytes, size);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

// Newest rate_limit_event across the running transcripts, falling back to the last finished build.
function currentLimit() {
  const found = [];
  if (lastKnownLimit) found.push(lastKnownLimit);
  for (const { brief, arm } of running.values()) {
    const path = join(logDir(brief, arm), 'transcript.jsonl');
    if (!existsSync(path)) continue;
    const lines = readTail(path, 512 * 1024).split('\n').filter((l) => l.includes('"rate_limit_event"'));
    const last = lines.at(-1);
    if (!last) continue;
    try {
      found.push(JSON.parse(last).rate_limit_info);
    } catch {
      // A partially written last line; the next poll sees the whole event.
    }
  }
  const windows = found
    .map((info) => info?.unifiedWindows?.five_hour)
    .filter((w) => w && w.resetsAt * 1000 > Date.now());
  return windows.sort((a, b) => b.utilization - a.utilization)[0] ?? null;
}

// Starting a build that the account limit would cut short produces an infrastructure failure, not a result.
async function waitForHeadroom() {
  for (;;) {
    const limit = currentLimit();
    if (!limit || limit.utilization < 0.9) return;
    const waitMs = Math.max(60_000, limit.resetsAt * 1000 - Date.now() + 60_000);
    log(`five-hour usage window at ${Math.round(limit.utilization * 100)}%; holding new builds for ${Math.round(waitMs / 60_000)} min`);
    await sleep(Math.min(waitMs, 10 * 60_000));
  }
}

function runJob(job) {
  return new Promise((resolve) => {
    const key = `${job.brief}/${job.arm}`;
    const record = { ...job, startedAt: new Date().toISOString(), endedAt: null, exitCode: null };
    invocation.builds.push(record);
    running.set(key, job);
    log(`start ${key}`);
    const child = spawn(process.execPath, [join(here, 'run-build.mjs'), job.brief, job.arm], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('close', (code) => {
      record.endedAt = new Date().toISOString();
      record.exitCode = code;
      running.delete(key);
      const metaPath = join(logDir(job.brief, job.arm), 'meta.json');
      if (existsSync(metaPath)) {
        const limit = JSON.parse(readFileSync(metaPath, 'utf8')).claude?.rateLimit;
        if (limit?.unifiedWindows?.five_hour) lastKnownLimit = limit;
      }
      log(`finish ${key} exit=${code}`);
      saveHistory();
      resolve();
    });
  });
}

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`${signal}: no new builds will start; waiting for ${running.size} running`);
    stopping = true;
  });
}

async function worker(index) {
  await sleep(index * staggerMs);
  while (!stopping) {
    const job = queue.shift();
    if (!job) return;
    await waitForHeadroom();
    await runJob(job);
  }
}

log(`queue ${queue.length} builds, concurrency ${concurrency}, stagger ${staggerMs / 1000}s`);
await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
invocation.endedAt = new Date().toISOString();
saveHistory();
const crashed = invocation.builds.filter((b) => b.exitCode !== 0);
log(`all done; ${crashed.length} harness crashes`);
process.exit(crashed.length ? 1 : 0);
