#!/usr/bin/env node
// A build cut short by the usage limit would be an infrastructure failure, not a result, so new builds start
// only when a fresh reading leaves room for them. The driver is paused with SIGSTOP and resumed with SIGCONT; running
// builds are never touched.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARMS, CLAUDE_BIN, ROOT, childEnv, claudeArgs, loadBriefs, logDir, mcpConfig } from './lib.mjs';

// Utilization one build adds over its 90-minute cap: about 0.11 percentage points per minute, measured.
export function canStart({ utilization, running, starting, perBuild, ceiling }) {
  return utilization + perBuild * (running + starting) <= ceiling;
}

function probeUsage() {
  const dir = join(ROOT, '_probe', 'governor');
  mkdirSync(dir, { recursive: true });
  const config = join(dir, 'mcp.json');
  writeFileSync(config, JSON.stringify(mcpConfig('control')));
  const args = claudeArgs(config);
  args[args.indexOf('--effort') + 1] = 'low';
  args.push('--no-session-persistence');
  const result = spawnSync(CLAUDE_BIN, args, { cwd: dir, env: childEnv(), input: 'Reply OK.', encoding: 'utf8', timeout: 120_000 });
  const events = (result.stdout ?? '').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const info = events.filter((e) => e.type === 'rate_limit_event').at(-1)?.rate_limit_info;
  const window = info?.unifiedWindows?.five_hour;
  if (!window) throw new Error(`no usage reading in the probe output (exit ${result.status})`);
  return { utilization: window.utilization, resetsAt: window.resetsAt, sevenDay: info.unifiedWindows.seven_day?.utilization ?? null };
}

function scan() {
  let running = 0;
  let pending = 0;
  for (const brief of loadBriefs()) {
    for (const arm of ARMS) {
      const metaPath = join(logDir(brief.id, arm), 'meta.json');
      if (!existsSync(metaPath)) pending += 1;
      else if (JSON.parse(readFileSync(metaPath, 'utf8')).stage !== 'done') running += 1;
    }
  }
  return { running, pending };
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`${new Date().toISOString()} [governor] ${message}`);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pid = Number(process.argv[2]);
  const flag = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? Number(process.argv[i + 1]) : fallback;
  };
  const concurrency = flag('concurrency', 4);
  const ceiling = flag('ceiling', 0.95);
  const perBuild = flag('per-build', 0.099);
  if (!pid || !alive(pid)) {
    console.error('usage: node governor.mjs <driver-pid> [--concurrency 4] [--ceiling 0.95] [--per-build 0.099]');
    process.exit(2);
  }

  let usage = null;
  let probedAt = 0;
  log(`pacing driver ${pid}: concurrency ${concurrency}, ceiling ${ceiling}, per-build ${perBuild}`);
  while (alive(pid)) {
    const { running, pending } = scan();
    if (pending === 0) {
      process.kill(pid, 'SIGCONT');
      log('every build has started; leaving the driver running');
      break;
    }
    const free = concurrency - running;
    if (free > 0) {
      const windowPassed = usage && usage.resetsAt * 1000 < Date.now();
      if (!usage || windowPassed || Date.now() - probedAt > 5 * 60_000) {
        try {
          usage = probeUsage();
          probedAt = Date.now();
        } catch (error) {
          log(`probe failed, holding: ${error.message}`);
          await sleep(60_000);
          continue;
        }
      }
      const starting = Math.min(free, pending);
      if (canStart({ utilization: usage.utilization, running, starting, perBuild, ceiling })) {
        log(`start ${starting}: five-hour ${Math.round(usage.utilization * 100)}%, ${running} running, ${pending} pending`);
        process.kill(pid, 'SIGCONT');
        await sleep(10_000);
        if (alive(pid)) process.kill(pid, 'SIGSTOP');
        usage = null;
        continue;
      }
      log(`hold: five-hour ${Math.round(usage.utilization * 100)}% (resets ${new Date(usage.resetsAt * 1000).toISOString()}), ${running} running, ${free} free, ${pending} pending`);
    }
    await sleep(30_000);
  }
  if (!alive(pid)) log('driver exited');
}
