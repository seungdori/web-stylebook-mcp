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
    // Every tool the skill names must exist, so the fallback never points at a missing command.
    for (const [, name] of skill.matchAll(/`((?:get|validate|compare|compose|audit|recommend|search)_[a-z_]+)`/g)) {
      expect(TOOL_NAMES as readonly string[], name).toContain(name);
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
