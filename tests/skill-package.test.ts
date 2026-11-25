import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TOOL_NAMES } from '../src/server-info.js';

// `npx skills add seungdori/web-stylebook-mcp` discovers skills/<name>/SKILL.md, and the Claude Code
// plugin marketplace installs the repository root as a plugin. Keep both installable.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));

function frontmatter(md: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return {};
  return Object.fromEntries(m[1]!.split(/\r?\n/).map((line) => {
    const at = line.indexOf(':');
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  }));
}

const BLOCKS = ['skills/CLAUDE.md', 'skills/AGENTS.md'] as const;
/** The new-page order every client surface gives: entry tool, tokens if needed, the build, both audits, validation. */
const FLOW = ['start_ui_design', 'compose_design_tokens', 'audit_page_structure', 'audit_copy', 'validate_design_audit_result'];
const section = (text: string, from: string, to?: string) => {
  const start = text.indexOf(from);
  expect(start, from).toBeGreaterThanOrEqual(0);
  const end = to === undefined ? -1 : text.indexOf(to, start);
  return text.slice(start, end < 0 ? undefined : end);
};
const expectFlowOrder = (text: string, label: string) => {
  const at = FLOW.map((tool) => text.indexOf(tool));
  expect(at.every((index) => index >= 0), `${label}: ${FLOW.filter((_, i) => at[i]! < 0).join(', ')} missing`).toBe(true);
  expect([...at].sort((x, y) => x - y), label).toEqual(at);
};

describe('client blocks send a new page to start_ui_design first', () => {
  const firstLine = (rel: string) => read(rel).split('\n').find((line) => line.trim())!;

  // Claude Code names a tool mcp__<server key>__<tool>, and a plugin server's tool mcp__plugin_<plugin>_<server key>__<tool>.
  // It lists MCP tools by name only until ToolSearch loads them, so the blocks must work under both install paths.
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  const serverKey = Object.keys(plugin.mcpServers)[0]!;
  const CLAUDE_CODE_NAMES = [`mcp__${serverKey}__start_ui_design`, `mcp__plugin_${plugin.name}_${serverKey}__start_ui_design`];
  const NAMING_DOCS = ['skills/CLAUDE.md', 'skills/AGENTS.md', 'skills/web-stylebook-design/SKILL.md', 'docs/reference.md', 'docs/reference.ko.md', 'docs/reference.ja.md'];

  it('the install commands use the server key the tool names assume', () => {
    expect(read('README.md')).toContain(`claude mcp add ${serverKey} -- npx -y web-stylebook-mcp@latest`);
    expect(CLAUDE_CODE_NAMES).toEqual(['mcp__web-stylebook__start_ui_design', 'mcp__plugin_web-stylebook_web-stylebook__start_ui_design']);
  });

  it('the first line names the entry tool under both Claude Code install paths', () => {
    for (const name of CLAUDE_CODE_NAMES) expect(firstLine('skills/CLAUDE.md'), name).toContain(`\`${name}\``);
    for (const rel of ['skills/CLAUDE.md', 'skills/web-stylebook-design/SKILL.md']) {
      // A keyword query finds the tool under either name; an exact select: of one name misses the other install.
      expect(read(rel), rel).toMatch(/ToolSearch with the query\s+`start_ui_design`/);
    }
    expect(firstLine('skills/AGENTS.md')).toContain('`start_ui_design`');
    expect(read('skills/AGENTS.md')).toContain('npx -y web-stylebook-mcp@latest call start_ui_design --input args.json');
  });

  it('wherever a Claude Code tool name appears, the other install path appears too', () => {
    for (const rel of NAMING_DOCS) {
      const text = read(rel);
      const named = [...text.matchAll(/mcp__[A-Za-z0-9_-]*?__start_ui_design/g)].map((m) => m[0]);
      for (const name of named) expect(CLAUDE_CODE_NAMES, `${rel}: ${name}`).toContain(name);
      if (named.length) for (const name of CLAUDE_CODE_NAMES) expect(text, `${rel} names one install path only`).toContain(name);
      for (const [, list] of text.matchAll(/select:([^\s`]*start_ui_design[^\s`]*)/g)) {
        for (const name of CLAUDE_CODE_NAMES) expect(list!.split(','), `${rel}: select:${list}`).toContain(name);
      }
    }
    // The note for a server added under another key covers the plugin prefix as well.
    const note = section(read('skills/CLAUDE.md'), '<!--', '-->');
    expect(note).toContain('mcp__<server key>__<tool>');
    expect(note).toContain('mcp__plugin_<plugin>_<server key>__<tool>');
    expect(note).toContain('mcp__<your key>__start_ui_design');
  });

  it('the blocks, the skill and the Cursor rule give the same order', () => {
    for (const rel of BLOCKS) expectFlowOrder(section(read(rel), '## ', '### Existing UI'), rel);
    expectFlowOrder(section(read('skills/web-stylebook-design/SKILL.md'), '## New page or screen', '\n## '), 'SKILL.md');
    for (const [readme, heading] of [['README.md', '## Use'], ['README.ko.md', '## 사용'], ['README.ja.md', '## 使い方']] as const) {
      expectFlowOrder(section(read(readme), `${heading}\n`, '\n## '), readme);
    }
    for (const doc of ['docs/reference.md', 'docs/reference.ko.md', 'docs/reference.ja.md']) {
      const rule = section(read(doc), '```markdown\n---\ndescription: Call Web Stylebook', '\n```\n');
      expect(rule, doc).toContain('alwaysApply: true');
      expectFlowOrder(rule, doc);
    }
  });

  it('the skill description covers every kind of page and the entry tool', () => {
    const fm = frontmatter(read('skills/web-stylebook-design/SKILL.md'));
    expect(fm.description).toContain('any page or screen, including dashboards, docs and settings');
    expectFlowOrder(fm.description!, 'SKILL.md description');
  });

  it('the blocks stay short, since a host loads them into every session', () => {
    for (const rel of BLOCKS) expect(Buffer.byteLength(read(rel)), rel).toBeLessThanOrEqual(8 * 1024);
  });
});

describe('installable skill package', () => {
  const skillDirs = readdirSync(join(root, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory());

  it('every skill directory has a SKILL.md whose name matches the directory', () => {
    expect(skillDirs.map((d) => d.name)).toContain('web-stylebook-design');
    for (const d of skillDirs) {
      const fm = frontmatter(read(`skills/${d.name}/SKILL.md`));
      expect(fm.name).toBe(d.name);
      expect(fm.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(fm.description!.length).toBeGreaterThan(50);
      expect(fm.description!.length).toBeLessThanOrEqual(1024);
    }
  });

  it('links inside the skill resolve to files that ship with it', () => {
    const skill = read('skills/web-stylebook-design/SKILL.md');
    for (const [, target] of skill.matchAll(/\]\((references\/[^)#]+)\)/g)) {
      expect(existsSync(join(root, 'skills/web-stylebook-design', target!)), target).toBe(true);
    }
  });

  it('the skill works without MCP: it documents the CLI fallback with real commands', () => {
    const skill = read('skills/web-stylebook-design/SKILL.md');
    expect(skill).toContain('npx -y web-stylebook-mcp@latest call get_design_improvement_plan --input');
    expect(skill).toMatch(/workflow\.planHash/);
    for (const rel of ['skills/AGENTS.md', 'skills/CLAUDE.md']) {
      expect(read(rel), rel).toContain('npx -y web-stylebook-mcp@latest call <tool> --input');
    }
    // Every tool the skill and the blocks name must exist, so the fallback never points at a missing command.
    for (const rel of [...BLOCKS, 'skills/web-stylebook-design/SKILL.md', 'skills/web-stylebook-design/references/new-direction.md']) {
      for (const [, name] of read(rel).matchAll(/`((?:start|get|validate|compare|compose|audit|recommend|search)_[a-z_]+)`/g)) {
        expect(TOOL_NAMES as readonly string[], `${rel}: ${name}`).toContain(name);
      }
    }
  });

  it('the npm package ships the skills directory', () => {
    expect(pkg.files).toContain('skills');
  });

  it('the Claude Code plugin bundles the skill and the MCP server at the package version', () => {
    const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
    expect(plugin.name).toBe('web-stylebook');
    expect(plugin.version).toBe(pkg.version);
    expect(plugin.license).toBe(pkg.license);
    expect(plugin.mcpServers['web-stylebook']).toEqual({ command: 'npx', args: ['-y', `${pkg.name}@latest`] });

    const market = JSON.parse(read('.claude-plugin/marketplace.json'));
    expect(market.plugins).toHaveLength(1);
    expect(market.plugins[0].name).toBe(plugin.name);
    expect(market.plugins[0].source).toBe('./');
  });
});
