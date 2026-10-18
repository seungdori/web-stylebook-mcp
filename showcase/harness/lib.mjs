import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const SHOWCASE_DIR = resolve(here, '..');
export const ROOT = process.env.SHOWCASE_ROOT ?? join(homedir(), 'stylebook-showcase-runs');

export const MODEL = 'claude-sonnet-5-5';
export const EFFORT = 'max';
export const CLAUDE_VERSION = '2.1.302';
// The `claude` symlink follows auto-updates; the versioned binary keeps all 20 builds on one release.
export const CLAUDE_BIN =
  process.env.SHOWCASE_CLAUDE_BIN ?? join(homedir(), '.local/share/claude/versions', CLAUDE_VERSION);

export const MCP_SERVER_NAME = 'web-stylebook';
export const MCP_CLI =
  process.env.SHOWCASE_MCP_CLI ?? join(ROOT, '_mcp/web-stylebook-mcp-5a783c9/dist/cli.js');

export const ARMS = ['control', 'mcp'];
export const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
export const MAX_SHOT_HEIGHT = 4000;
export const SESSION_TIMEOUT_MS = 90 * 60_000;
export const NPM_TIMEOUT_MS = 5 * 60_000;

// Denied for both arms: web access would add design guidance from outside the arms, and the
// rest reach beyond the run folder (publishing, remote hosts, scheduled jobs, notifications).
export const DENIED_TOOLS = [
  'WebSearch',
  'WebFetch',
  'DesignSync',
  'PushNotification',
  'RemoteTrigger',
  'SendMessage',
  'CronCreate',
  'CronDelete',
  'CronList',
  'ScheduleWakeup',
  'EnterWorktree',
  'ExitWorktree',
  'Workflow',
  'Bash(sudo *)',
  'Bash(ssh *)',
  'Bash(scp *)',
  'Bash(gh *)',
  'Bash(git push *)',
  'Bash(npm publish*)',
  'Bash(npm login*)',
  'Bash(brew *)',
];

const REQUIREMENTS = [
  'Requirements:',
  '- Vite + React + plain CSS. No UI kits, no component libraries, and no Tailwind.',
  '- One responsive page that works on phones and desktops.',
  '- Realistic content written for this product: no lorem ipsum, no stock photos, and no external image URLs.',
  '- Work in the current directory, which is empty. `npm install` and `npm run build` must both succeed when you finish.',
].join('\n');

const MCP_NOTE =
  'The web-stylebook MCP server is attached to this session. Call its `recommend_design_direction` tool first, before you design anything. After that, use its token, UI-state, and audit tools as you see fit.';

// The server's own instructions ask for an intake and an approval step; nobody can answer in a headless run.
const NO_HUMAN =
  'No one is available to answer questions or approve a plan, so make every decision yourself and deliver the finished build in this session.';

export function buildPrompt(brief, arm) {
  const parts = [
    'Build a single-page website for the product described in this brief.',
    `Brief: ${brief}`,
    REQUIREMENTS,
    ...(arm === 'mcp' ? [MCP_NOTE] : []),
    NO_HUMAN,
  ];
  return `${parts.join('\n\n')}\n`;
}

export function mcpConfig(arm) {
  const servers =
    arm === 'mcp' ? { [MCP_SERVER_NAME]: { type: 'stdio', command: 'node', args: [MCP_CLI] } } : {};
  return { mcpServers: servers };
}

export function claudeArgs(mcpConfigPath) {
  return [
    '-p',
    '--model', MODEL,
    '--effort', EFFORT,
    // Project-only sources keep the user's hooks, plugins, output style and permission defaults out.
    '--setting-sources', 'project',
    '--disable-slash-commands',
    '--strict-mcp-config',
    '--mcp-config', mcpConfigPath,
    '--permission-mode', 'bypassPermissions',
    '--output-format', 'stream-json',
    '--verbose',
    // Variadic, so it must come last.
    '--disallowedTools', ...DENIED_TOOLS,
  ];
}

// Set on top of an allowlist, so nothing from the parent Claude Code session (session id, sockets,
// tokens) leaks in. The two CLAUDE_CODE_DISABLE_* switches keep the user's CLAUDE.md files and
// auto-memory out of the session; --setting-sources alone does not.
export const PINNED_ENV = {
  LANG: 'en_US.UTF-8',
  TERM: 'dumb',
  CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1',
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
  DISABLE_AUTOUPDATER: '1',
};

export function childEnv() {
  const env = {};
  for (const key of ['HOME', 'USER', 'LOGNAME', 'PATH', 'SHELL', 'TMPDIR']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, ...PINNED_ENV };
}

export const runDir = (brief, arm) => join(ROOT, brief, arm);
export const logDir = (brief, arm) => join(ROOT, '_logs', brief, arm);

export function loadBriefs() {
  return JSON.parse(readFileSync(join(SHOWCASE_DIR, 'briefs.json'), 'utf8')).briefs;
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// These files decide how a build runs, so their hashes go into every build's metadata.
export function harnessHashes() {
  const files = ['lib.mjs', 'session.mjs', 'shoot.mjs', 'run-build.mjs', 'driver.mjs'];
  return Object.fromEntries(files.map((f) => [f, sha256File(join(here, f))]));
}

export const tilde = (value) => (typeof value === 'string' ? value.split(homedir()).join('~') : value);

export function shellQuote(arg) {
  return /^[\w@%+=:,./~-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}
