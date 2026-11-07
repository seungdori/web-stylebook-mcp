import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Cross-checks the numbers and verdicts the showcase documents against the data they are drawn from,
// so an edit to a note, a table or a data file cannot drift apart from the others unnoticed.
const dir = fileURLToPath(new URL('../showcase/', import.meta.url));
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const readJson = (name: string) => JSON.parse(read(name));

type Arm = 'control' | 'mcp';
interface Build {
  brief: string;
  arm: Arm;
  status: string;
  timedOut: boolean;
  wallSeconds: number;
  claude: { numTurns: number | null; estimatedCostUsd: number | null; toolCounts: Record<string, number>; subagentCalls: number };
  mcp: { calls: { isError: boolean }[] } | null;
  screenshots: Record<string, { pageHeight: number; capturedHeight: number; truncated: boolean }>;
}
interface Call {
  tool: string;
  isError: boolean;
  input: Record<string, unknown>;
  output: unknown;
  savedOutput?: string;
  savedOutputFile?: string;
}

const briefs: { id: string; title: string }[] = readJson('briefs.json').briefs;
const runs: { builds: Build[]; harnessSha256: Record<string, string> } = readJson('runs.json');
const key: { assignments: Record<string, { left: Arm; right: Arm }> } = readJson('key.json');
const armOf = (id: string, side: 'left' | 'right'): Arm => key.assignments[id]![side];
const build = (id: string, arm: Arm) => runs.builds.find((b) => b.brief === id && b.arm === arm)!;

const docs = {
  en: { results: read('RESULTS.md'), readme: read('README.md') },
  ko: { results: read('RESULTS.ko.md'), readme: read('README.ko.md') },
};

function tablesOf(text: string): string[][][] {
  const found: string[][][] = [];
  let current: string[][] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (!cells.every((c) => /^-+$/.test(c))) current.push(cells);
    } else if (current.length) {
      found.push(current);
      current = [];
    }
  }
  if (current.length) found.push(current);
  return found;
}

const tableStartingWith = (text: string, firstCell: string, secondCell: string) => {
  const table = tablesOf(text).find((t) => t[0]![0] === firstCell && t[0]![1] === secondCell);
  expect(table, `table "${firstCell} | ${secondCell}"`).toBeDefined();
  return table!.slice(1);
};

const duration = (seconds: number) => `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
const hoursMinutes = (seconds: number) => ({ h: Math.floor(seconds / 3600), m: Math.round((seconds % 3600) / 60) });
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const toolTotal = (arm: Arm) => sum(runs.builds.filter((b) => b.arm === arm).flatMap((b) => Object.values(b.claude.toolCounts)));

const LABELS = {
  en: { ok: 'built', 'built-timed-out': 'built, stopped at the 90 min cap', brief: 'Brief', mine: 'My read', tie: 'tie', slight: 'slight', clear: 'clear', lean: '(lean)', slightLean: '(slight lean)', mcp: 'MCP' },
  ko: { ok: '빌드 성공', 'built-timed-out': '빌드 성공, 90분 제한에서 중단', brief: '브리프', mine: '내 판단', tie: '비슷함', slight: '약간', clear: '분명', lean: '쪽', slightLean: '쪽 (약간)', mcp: 'MCP' },
} as const;

describe.each(['en', 'ko'] as const)('showcase claims (%s)', (lang) => {
  const text = docs[lang].results;
  const words = LABELS[lang];

  it('lists every build in the results table exactly as runs.json records it', () => {
    const header = lang === 'en' ? 'Brief' : '브리프';
    const second = lang === 'en' ? 'Arm' : '군';
    const rows = tableStartingWith(text, header, second).filter((r) => !r[0]!.startsWith('**'));
    expect(rows).toHaveLength(runs.builds.length);
    const titles = Object.fromEntries(briefs.map((b) => [b.id, b.title]));
    runs.builds.forEach((b, i) => {
      const cost = b.claude.estimatedCostUsd;
      expect(rows[i], `${b.brief}/${b.arm}`).toEqual([
        titles[b.brief],
        b.arm,
        words[b.status as 'ok' | 'built-timed-out'],
        duration(b.wallSeconds),
        b.claude.numTurns == null ? '-' : String(b.claude.numTurns),
        cost == null ? '-' : `$${cost.toFixed(2)}`,
      ]);
    });
  });

  it('shows the wall-time total of each arm as the sum of that arm', () => {
    const header = lang === 'en' ? 'Brief' : '브리프';
    const second = lang === 'en' ? 'Arm' : '군';
    const totals = tableStartingWith(text, header, second).filter((r) => r[0]!.startsWith('**'));
    expect(totals).toHaveLength(2);
    for (const arm of ['control', 'mcp'] as const) {
      const row = totals.find((r) => r[1] === arm)!;
      const list = runs.builds.filter((b) => b.arm === arm);
      expect(row[2]).toBe(`${list.filter((b) => b.status !== 'build-failed').length}/${list.length}`);
      expect(row[3]).toBe(duration(sum(list.map((b) => b.wallSeconds))));
      expect(row[5]).toBe(`$${sum(list.map((b) => b.claude.estimatedCostUsd ?? 0)).toFixed(2)}`);
    }
  });

  it('states the cap, truncation and tool-call counts that the data supports', () => {
    const stopped = runs.builds.filter((b) => b.timedOut);
    const byArm = (arm: Arm) => stopped.filter((b) => b.arm === arm).length;
    const longDesktop = runs.builds.filter((b) => b.screenshots['1440']!.truncated).length;
    const longPhone = runs.builds.filter((b) => b.screenshots['390']!.truncated).length;
    const fmt = (n: number) => n.toLocaleString('en-US');
    if (lang === 'en') {
      expect(text).toContain(`The 90-minute cap stopped ${stopped.length} of 20 sessions: ${byArm('mcp')} of the 10 MCP builds and ${byArm('control')} of the 10 control builds.`);
      expect(text).toContain(`${longDesktop} of the 20 desktop pages and all ${longPhone} phone pages are taller`);
      expect(text).toContain(`${fmt(toolTotal('control'))} against ${fmt(toolTotal('mcp'))}`);
    } else {
      expect(text).toContain(`90분 제한이 세션 20개 중 ${stopped.length}개를 중단시켰습니다. MCP군 10개 중 ${byArm('mcp')}개, 대조군 10개 중 ${byArm('control')}개입니다.`);
      expect(text).toContain(`데스크톱 페이지 20개 중 ${longDesktop}개와 모바일 페이지 ${longPhone}개 전부`);
      expect(text).toContain(`(${fmt(toolTotal('control'))} 대 ${fmt(toolTotal('mcp'))})`);
    }
  });

  it('states the elapsed and summed session times that runs.json supports', () => {
    const t = runs as unknown as { totals: { elapsedSeconds: number; sessionWallSecondsSum: number; perArm: Record<Arm, { sessionWallSeconds: number }> } };
    const elapsed = hoursMinutes(t.totals.elapsedSeconds);
    const all = hoursMinutes(t.totals.sessionWallSecondsSum);
    const ctl = hoursMinutes(t.totals.perArm.control.sessionWallSeconds);
    const mcp = hoursMinutes(t.totals.perArm.mcp.sessionWallSeconds);
    if (lang === 'en') {
      expect(text).toContain(`Elapsed time was ${elapsed.h} h ${elapsed.m} min`);
      expect(text).toContain(`Session times add up to ${all.h} h ${all.m} min: control ${ctl.h} h ${ctl.m} min, MCP ${mcp.h} h ${mcp.m} min`);
    } else {
      expect(text).toContain(`${elapsed.h}시간 ${elapsed.m}분입니다`);
      expect(text).toContain(`${all.h}시간 ${all.m}분이고, 대조군 ${ctl.h}시간 ${ctl.m}분, MCP군 ${mcp.h}시간 ${mcp.m}분`);
    }
  });

  it('puts each table under the heading that introduces it', () => {
    const expected: Record<string, string> =
      lang === 'en'
        ? { Builds: 'Arm', 'The reads': 'My read', 'What the MCP arm did': 'MCP calls' }
        : { 빌드: '군', '평가 결과표': '내 판단', 'MCP군이 한 일': 'MCP 호출' };
    const firstTable: Record<string, string> = {};
    let heading = '';
    for (const line of text.split('\n')) {
      if (line.startsWith('## ')) heading = line.slice(3).trim();
      else if (line.startsWith('|') && !(heading in firstTable)) firstTable[heading] = line.split('|')[2]!.trim();
    }
    for (const [name, secondColumn] of Object.entries(expected)) {
      expect(firstTable[name], `the first table under "${name}" should have a "${secondColumn}" column`).toBe(secondColumn);
    }
  });

  it('states the subagent counts that runs.json records', () => {
    const launched = (arm: Arm) => runs.builds.filter((b) => b.arm === arm && b.claude.subagentCalls > 0);
    const calls = (arm: Arm) => sum(launched(arm).map((b) => b.claude.subagentCalls));
    const control = [launched('control').length, calls('control')];
    const mcp = launched('mcp').length;
    if (lang === 'en') {
      expect(/subagents in (\d+) builds \((\d+) calls/.exec(text)!.slice(1).map(Number)).toEqual(control);
      expect(Number(/MCP sessions in (\d+) \(/.exec(text)![1])).toBe(mcp);
    } else {
      expect(/(\d+)개 빌드\(호출 (\d+)번/.exec(text)!.slice(1).map(Number)).toEqual(control);
      expect(Number(/MCP 세션은 (\d+)개 빌드/.exec(text)![1])).toBe(mcp);
    }
  });

  it('states how many MCP results were truncated, and the saved text matches the size each stub announces', () => {
    const calls = briefs.flatMap(({ id }) => readJson(join('mcp-outputs', `${id}.json`)).calls as Call[]);
    const outputText = (c: Call) => (typeof c.output === 'string' ? c.output : JSON.stringify(c.output));
    const stubs = calls.filter((c) => /persisted-output|exceeds maximum allowed tokens/.test(outputText(c)));
    const lists = stubs.filter((c) => c.tool === 'ListMcpResourcesTool');
    const resourceList = read(join('mcp-outputs', 'resource-list.txt'));
    for (const c of calls) {
      expect(Boolean(c.savedOutput ?? c.savedOutputFile), `${c.tool} carries a saved copy only when its result was a stub`).toBe(stubs.includes(c));
    }
    for (const c of stubs) {
      const text = c.savedOutput ?? resourceList;
      expect(text.length, c.tool).toBeGreaterThan(0);
      const characters = /result \(([\d,]+) characters\)/.exec(outputText(c));
      const kilobytes = /Output too large \(([\d.]+)KB\)/.exec(outputText(c));
      if (characters) expect(text.length).toBe(Number(characters[1]!.replaceAll(',', '')));
      else expect(Math.round((text.length / 1024) * 10) / 10).toBe(Number(kilobytes![1]));
    }
    expect(lists.every((c) => c.savedOutputFile === 'resource-list.txt')).toBe(true);
    const readme = docs[lang].readme;
    expect(readme).toContain('resource-list.txt');
    if (lang === 'en') {
      expect(/(\d+) of the (\d+) calls/.exec(readme)!.slice(1).map(Number)).toEqual([stubs.length, calls.length]);
    } else {
      expect(/호출 (\d+)번 중 (\d+)번/.exec(readme)!.slice(1).map(Number)).toEqual([calls.length, stubs.length]);
    }
  });

  it('states the MCP call and error counts that mcp-outputs support', () => {
    const calls = briefs.flatMap(({ id }) => readJson(join('mcp-outputs', `${id}.json`)).calls as Call[]);
    const errors = calls.filter((c) => c.isError);
    const pct = ((errors.length / calls.length) * 100).toFixed(1);
    const spacing = errors.filter((c) => /Spacing .* conflicts with the explicit/.test(JSON.stringify(c.output))).length;
    if (lang === 'en') {
      expect(text).toContain(`${errors.length} of the ${calls.length} MCP calls returned errors (${pct}%)`);
      expect(text).toContain(`spacing overrides that conflict with a density preset (${spacing} times)`);
    } else {
      expect(text).toContain(`MCP 호출 ${calls.length}번 중 ${errors.length}번이 오류를 돌려줬고(${pct}%)`);
      expect(text).toContain(`간격 덮어쓰기(${spacing}번)`);
    }
  });

  it('states which styles the MCP arm took from the recommender, as recomputed from the raw outputs', () => {
    const ranks: { id: string; style: string; rank: number; reranOnChangedInputs: boolean }[] = [];
    for (const { id } of briefs) {
      const calls = readJson(join('mcp-outputs', `${id}.json`)).calls as Call[];
      const recs = calls.filter((c) => c.tool.endsWith('__recommend_design_direction') && !c.isError);
      const candidatesOf = (c: Call) => {
        const blocks = c.output as { text: string }[];
        return (JSON.parse(blocks[blocks.length - 1]!.text) as { candidates: { styleId: string }[] }).candidates.map((x) => x.styleId);
      };
      const used = calls.find((c) => c.tool.endsWith('__compose_design_tokens') && !c.isError)!.input.primaryStyleId as string;
      const lastRank = candidatesOf(recs.at(-1)!).indexOf(used) + 1;
      ranks.push({ id, style: used, rank: lastRank, reranOnChangedInputs: recs.length > 1 && candidatesOf(recs[0]!).indexOf(used) !== 0 });
    }
    const earth = ranks.filter((r) => r.style === 'earth-atelier').length;
    const top = ranks.filter((r) => r.rank === 1).length;
    const second = ranks.filter((r) => r.rank === 2).length;
    const rerun = ranks.filter((r) => r.rank === 1 && r.reranOnChangedInputs).length;
    expect(top + second).toBe(10);
    if (lang === 'en') {
      expect(text).toContain(`used \`earth-atelier\` for ${earth} of the 10 briefs`);
      expect(text).toContain(`top candidate in ${top} briefs (in ${rerun} of them after running the recommender again with changed inputs) and the second candidate in ${second}.`);
    } else {
      expect(text).toContain(`브리프 10개 중 ${earth}개`);
      expect(text).toContain(`1순위 후보를 쓴 브리프가 ${top}개이고(그중 ${rerun}개는 입력을 바꿔 추천을 다시 돌린 뒤), 2순위를 쓴 브리프가 ${second}개`);
    }
  });

  it('translates every blind verdict from Left/Right to the right arm via key.json', () => {
    const table = tableStartingWith(text, words.brief, words.mine);
    expect(table).toHaveLength(10);
    const strength = (s?: string) => (s ? ` (${words[s as 'slight' | 'clear']})` : '');
    const arm = (a: Arm) => (a === 'mcp' ? words.mcp : 'control');

    // The summary line is what the tables are built from; each brief's own "Verdict:" line is a second source,
    // so a note edited in one place and not the other is caught.
    const notes = read('blind-notes.md');
    const summary = notes.split('\n').find((l) => l.startsWith('essay-blog:'))!;
    const summaryOf: Record<string, string> = Object.fromEntries(summary.split(' | ').map((p) => p.split(': ') as [string, string]));
    const verdictLines: Record<string, string> = {};
    let section = '';
    for (const line of notes.split('\n')) {
      if (line.startsWith('## ')) section = line.slice(3).trim();
      if (line.startsWith('Verdict:')) verdictLines[section] = line;
    }
    const mine = (id: string) => {
      const verdict = verdictLines[id]!;
      const side = /\b(LEFT|RIGHT)\b/.exec(verdict)?.[1];
      const summaryText = summaryOf[id]!.toLowerCase();
      expect(Boolean(side), `${id}: summary and verdict line agree on a direction`).toBe(/left|right/.test(summaryText));
      if (!side) return words.tie;
      expect(side.toLowerCase(), `${id}: summary and verdict line agree on a side`).toBe(/left/.test(summaryText) ? 'left' : 'right');
      const who = arm(armOf(id, side.toLowerCase() as 'left' | 'right'));
      if (summaryText.startsWith('tie,') || summaryText.startsWith('slight lean')) return `${who} ${words.slightLean}`;
      if (summaryText.startsWith('lean')) return `${who} ${words.lean}`;
      return who;
    };

    const reader = (file: string) => {
      const answers: Record<string, Record<string, string>> = {};
      let id = '';
      for (const line of read(join('blind-reads', file)).split('\n')) {
        const head = /^### (\S+)/.exec(line);
        if (head) id = head[1]!;
        const m = /^- (Ship|Less generic): (Left|Right|Tie)(?: \((clear|slight)\))?/.exec(line);
        if (!m || line.includes('NOT ASSESSED')) continue;
        (answers[id] ??= {})[m[1]!] = m[2] === 'Tie' ? words.tie : `${arm(armOf(id, m[2]!.toLowerCase() as 'left' | 'right'))}${strength(m[3])}`;
      }
      return answers;
    };
    const a = reader('reader-a.md');
    const b = reader('reader-b.md');

    for (const { id, title } of briefs) {
      expect(table.find((r) => r[0] === title), id).toEqual([
        title,
        mine(id),
        a[id]!.Ship,
        a[id]!['Less generic'],
        b[id]!.Ship,
        b[id]!['Less generic'],
      ]);
    }
  });
});

describe('showcase claims: EN and KO say the same thing in the same shape', () => {
  const pairs = [
    ['README.md', 'README.ko.md'],
    ['RESULTS.md', 'RESULTS.ko.md'],
  ] as const;

  it.each(pairs)('%s and %s have the same headings, tables, links and commands', (en, ko) => {
    const [e, k] = [read(en), read(ko)];
    const headings = (t: string) => [...t.matchAll(/^(#{1,6}) /gm)].map((m) => m[1]!.length);
    expect(headings(k)).toEqual(headings(e));
    expect(tablesOf(k).map((t) => [t.length, t[0]!.length])).toEqual(tablesOf(e).map((t) => [t.length, t[0]!.length]));

    const normalize = (t: string) => t.replaceAll('.ko.md', '.md');
    const links = (t: string) => [...normalize(t).matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!).sort();
    expect(links(k)).toEqual(links(e));

    const blocks = (t: string) =>
      [...t.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((m) => `${m[1]}\n${m[2]!.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')}`);
    expect(blocks(k)).toEqual(blocks(e));
  });

  it('adds one line to each root README, linking the matching language of the showcase', () => {
    const before = (name: string) => readFileSync(join(dir, '..', name), 'utf8');
    expect(before('README.md').match(/\(\.\/showcase\/\)/g)).toHaveLength(1);
    expect(before('README.ko.md').match(/\(\.\/showcase\/README\.ko\.md\)/g)).toHaveLength(1);
  });
});

describe('showcase claims: the blind comparison page', () => {
  const page = read(join('compare', 'index.html'));
  const figures = [...page.matchAll(/<figure[^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);

  function webpSize(file: string): { width: number; height: number } {
    const b = readFileSync(file);
    expect(b.toString('ascii', 0, 4), file).toBe('RIFF');
    expect(b.toString('ascii', 8, 12), file).toBe('WEBP');
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }

  it('words every caption and alt text the same for both arms', () => {
    expect(figures.length).toBe(40);
    for (const figure of figures) {
      expect(/mcp|control/i.test(figure), figure.slice(0, 120)).toBe(false);
      expect(figure).toMatch(/<figcaption>(Left|Right)<\/figcaption>/);
    }
    const alts = [...page.matchAll(/alt="([^"]*)"/g)].map((m) => m[1]!);
    expect(alts).toHaveLength(40);
    for (const alt of alts) expect(alt).toMatch(/^(Left|Right) build of [^,]+, (1440|390) px wide$/);
  });

  it('declares each image at its real size and says when the capture was cut', () => {
    for (const { id, title } of briefs) {
      for (const side of ['left', 'right'] as const) {
        for (const width of [1440, 390]) {
          const src = `../screenshots/${id}/${side}-${width}.webp`;
          const tag = new RegExp(`src="${src.replaceAll('.', '\\.')}" width="(\\d+)" height="(\\d+)"`).exec(page);
          expect(tag, src).not.toBeNull();
          const real = webpSize(join(dir, 'compare', src));
          const shot = build(id, armOf(id, side)).screenshots[String(width)]!;
          expect({ width: Number(tag![1]), height: Number(tag![2]) }, src).toEqual(real);
          expect(real, src).toEqual({ width, height: shot.capturedHeight });
          const section = page.slice(page.indexOf(`<section id="${id}">`), page.indexOf('</section>', page.indexOf(`<section id="${id}">`)));
          const note = `The page is ${shot.pageHeight} px tall; the capture stops at ${shot.capturedHeight} px.`;
          const figure = figures.find((f) => f.includes(src))!;
          expect(section.includes(figure), `${title} contains its figure`).toBe(true);
          expect(figure.includes(note), `${src} truncation note`).toBe(shot.truncated);
        }
      }
    }
  });

  it('references every screenshot file and no other file lives in screenshots/', () => {
    const referenced = new Set([...page.matchAll(/src="\.\.\/(screenshots\/[^"]+)"/g)].map((m) => m[1]));
    const onDisk: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else onDisk.push(relative(dir, p).split(sep).join('/'));
      }
    };
    walk(join(dir, 'screenshots'));
    expect(new Set(onDisk)).toEqual(referenced);
  });
});

describe('showcase claims: what is committed', () => {
  it('holds no generated app, only the harness and the published data', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        if (name === 'node_modules') continue;
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(relative(dir, p).split(sep).join('/'));
      }
    };
    walk(dir);
    const offenders = files.filter(
      (f) =>
        /(^|\/)(dist|build|public|src)\//.test(f) ||
        /(^|\/)(vite\.config\.[cm]?[jt]s|tsconfig.*\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(f) ||
        (/(^|\/)package(-lock)?\.json$/.test(f) && !f.startsWith('harness/')) ||
        (/(^|\/)index\.html$/.test(f) && f !== 'compare/index.html'),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the code of the five scripts that ran the builds identical to the commit before the first build', () => {
    // Digests of the scripts at f17e821 with blank lines and comment-only lines dropped; the README says only comments changed.
    const codeDigests: Record<string, string> = {
      'driver.mjs': 'c0d53cf436c09fb8622855d44e5739050a644a243a42453465934d658d86f1a8',
      'lib.mjs': '1dd899dede406aec71040a686996358d70b38e028cb4baf6e35e074910cb6fcc',
      'run-build.mjs': '7992534872acbe3d1e1711148f150a20100c629a77f095e52fd144fcc547186b',
      'session.mjs': '5c6023782f77d02aaf60220767439b2c6bc73bd4af365e39c4626c8e9d395c1c',
      'shoot.mjs': 'a3aa2771287712f382d1255c12fc182f2eaf0d5c9088555adfe93c31a6c20b40',
    };
    for (const [file, digest] of Object.entries(codeDigests)) {
      const code = read(join('harness', file))
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//'))
        .join('\n');
      expect(createHash('sha256').update(code).digest('hex'), file).toBe(digest);
    }
  });

  it('keeps the home directory and user name out of every published text file', () => {
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        if (name === 'node_modules' || name === 'screenshots') continue;
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(md|json|mjs|html|txt)$/.test(name)) {
          const text = readFileSync(p, 'utf8');
          const hit = /\/Users\/[\w.-]+|\/home\/[\w.-]+|-Users-(?!<user>)[A-Za-z0-9]+-/.exec(text);
          if (hit) offenders.push(`${relative(dir, p)}: ${hit[0]}`);
        }
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });

  it('records the hashes of the five scripts that ran the builds, as they ran', () => {
    // Comments in these scripts were reworded after the run, so the hashes are a record, not a live check.
    expect(Object.keys(runs.harnessSha256).sort()).toEqual(['driver.mjs', 'lib.mjs', 'run-build.mjs', 'session.mjs', 'shoot.mjs']);
    for (const sha of Object.values(runs.harnessSha256)) expect(sha).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(join(dir, 'harness', 'seed.mjs'))).toBe(true);
  });
});
