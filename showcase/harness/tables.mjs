#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHOWCASE_DIR, loadBriefs } from './lib.mjs';

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const lang = flag('lang', 'en');
const runs = JSON.parse(readFileSync(flag('runs', join(SHOWCASE_DIR, 'runs.json')), 'utf8'));
const titles = Object.fromEntries(loadBriefs().map((b) => [b.id, b.title]));

const text = {
  en: {
    builds: ['Brief', 'Arm', 'Status', 'Wall time', 'Turns', 'Cost (est.)'],
    total: 'Total',
    mcp: ['Brief', 'MCP calls', 'First call'],
    none: 'none',
    status: {
      ok: 'built',
      'built-timed-out': 'built, stopped at the 90 min cap',
      'built-with-session-error': 'built, session error',
      'build-failed': 'build failed',
      'blank-page': 'built, blank page',
      'screenshot-failed': 'built, screenshot failed',
    },
  },
  ko: {
    builds: ['브리프', '군', '상태', '소요 시간', '턴', '비용(추정)'],
    total: '합계',
    mcp: ['브리프', 'MCP 호출', '첫 호출'],
    none: '없음',
    status: {
      ok: '빌드 성공',
      'built-timed-out': '빌드 성공, 90분 제한에서 중단',
      'built-with-session-error': '빌드 성공, 세션 오류',
      'build-failed': '빌드 실패',
      'blank-page': '빌드 성공, 빈 페이지',
      'screenshot-failed': '빌드 성공, 스크린샷 실패',
    },
  },
}[lang];

const duration = (seconds) => `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
const usd = (value) => (value == null ? '-' : `$${value.toFixed(2)}`);
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (header, rows) => [row(header), row(header.map(() => '---')), ...rows.map(row)].join('\n');

const buildRows = runs.builds.map((b) => [
  titles[b.brief],
  b.arm,
  text.status[b.status],
  duration(b.wallSeconds),
  b.claude.numTurns ?? '-',
  usd(b.claude.estimatedCostUsd),
]);
for (const [arm, totals] of Object.entries(runs.totals.perArm)) {
  buildRows.push([`**${text.total}**`, arm, `${totals.built}/${totals.builds}`, duration(totals.sessionWallSeconds), '', usd(totals.estimatedCostUsd)]);
}
console.log(table(text.builds, buildRows));

const TOOLS = [
  ['recommend_design_direction', 'recommend'],
  ['compare_design_directions', 'compare'],
  ['get_design_principle_plan', 'principles'],
  ['get_ux_principle_plan', 'ux'],
  ['get_ui_state_plan', 'states'],
  ['compose_design_tokens', 'tokens'],
  ['search_design_references', 'search refs'],
  ['get_design_reference', 'get ref'],
  ['get_design_audit_plan', 'audit plan'],
  ['validate_design_audit_result', 'validate'],
];
const RESOURCE_TOOLS = ['ListMcpResourcesTool', 'ReadMcpResourceTool', 'ReadMcpResourceDirTool'];
const mcpRows = runs.builds
  .filter((b) => b.arm === 'mcp')
  .map((b) => {
    const counts = b.claude.toolCounts;
    const resources = RESOURCE_TOOLS.reduce((n, t) => n + (counts[t] ?? 0), 0);
    const first = b.mcp.firstCall ? b.mcp.firstCall.replace('mcp__web-stylebook__', '') : text.none;
    return [
      titles[b.brief],
      b.mcp.calls.length,
      first,
      ...TOOLS.map(([name]) => counts[`mcp__web-stylebook__${name}`] ?? 0),
      resources,
    ];
  });
console.log();
console.log(table([...text.mcp, ...TOOLS.map(([, label]) => label), 'resources'], mcpRows));

// Blind reads, translated from Left/Right to arms through key.json so no verdict is copied by hand.
const words = {
  en: { brief: 'Brief', mine: 'My read', ship: 'ship', generic: 'less generic', tie: 'tie', slight: 'slight', clear: 'clear', lean: '(lean)', slightLean: '(slight lean)', missing: 'not assessed' },
  ko: { brief: '브리프', mine: '내 판단', ship: '출시', generic: '덜 뻔함', tie: '비슷함', slight: '약간', clear: '분명', lean: '쪽', slightLean: '쪽 (약간)', missing: '미평가' },
}[lang];
const key = JSON.parse(readFileSync(join(SHOWCASE_DIR, 'key.json'), 'utf8')).assignments;
const armLabel = { control: 'control', mcp: 'MCP' };
const side = (brief, which) => armLabel[key[brief][which.toLowerCase()]];

function myVerdicts() {
  const summary = readFileSync(join(SHOWCASE_DIR, 'blind-notes.md'), 'utf8').split('\n').find((l) => l.includes(' | ') && l.includes('essay-blog:'));
  const verdicts = {};
  for (const part of summary.split(' | ')) {
    const [brief, raw] = part.split(': ').map((s) => s.trim());
    const text = raw.toLowerCase();
    const which = /left/.test(text) ? 'Left' : /right/.test(text) ? 'Right' : null;
    if (!which) verdicts[brief] = words.tie;
    else if (text.startsWith('tie,') || text.startsWith('slight lean')) verdicts[brief] = `${side(brief, which)} ${words.slightLean}`;
    else if (text.startsWith('lean')) verdicts[brief] = `${side(brief, which)} ${words.lean}`;
    else verdicts[brief] = side(brief, which);
  }
  return verdicts;
}

function readerVerdicts(file) {
  const out = {};
  let brief = null;
  for (const line of readFileSync(join(SHOWCASE_DIR, 'blind-reads', file), 'utf8').split('\n')) {
    const head = line.match(/^### (\S+)/);
    if (head) brief = head[1];
    const m = line.match(/^- (Ship|Less generic): (Left|Right|Tie) ?(?:\((clear|slight)\))?/);
    if (brief && m && !line.includes('NOT ASSESSED')) {
      out[brief] ??= {};
      out[brief][m[1]] = m[2] === 'Tie' ? words.tie : `${side(brief, m[2])} (${words[m[3]]})`;
    }
  }
  return out;
}

const readers = [[lang === 'ko' ? '평가자 A' : 'Reader A', 'reader-a.md'], [lang === 'ko' ? '평가자 B' : 'Reader B', 'reader-b.md']].filter(([, f]) => existsSync(join(SHOWCASE_DIR, 'blind-reads', f)));
const mine = myVerdicts();
const parsed = readers.map(([name, file]) => [name, readerVerdicts(file)]);
const readsHeader = [words.brief, words.mine, ...parsed.flatMap(([name]) => [`${name}: ${words.ship}`, `${name}: ${words.generic}`])];
const readsRows = Object.keys(key).map((brief) => [
  titles[brief],
  mine[brief],
  ...parsed.flatMap(([, verdicts]) => [verdicts[brief]?.Ship ?? words.missing, verdicts[brief]?.['Less generic'] ?? words.missing]),
]);
console.log();
console.log(table(readsHeader, readsRows));
