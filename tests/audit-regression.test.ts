// Regression tests for the content audit (2026-06). Each test locks a confirmed fix.
import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import { compareDirections } from '../src/recommendation/compare.js';
import { contrastRatio } from '../src/tokens/contrast.js';
import { planUxPrinciples } from '../src/principles/planner.js';
import { planDesignPrinciples } from '../src/design-principles/planner.js';
import { SERVER_INSTRUCTIONS } from '../src/server-info.js';

const repo = CatalogRepository.load();
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist', 'cli.js');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

function rejectedFor(constraint: string): Set<string> {
  const r = recommendDesignDirection({ productDescription: 'an app', constraints: [constraint] } as never, repo);
  return new Set(r.rejected.filter((x) => x.reasonCodes.includes('ACCESSIBILITY_CONFLICT')).map((x) => x.styleId));
}

describe('audit HIGH#1 — constraint matcher no longer cross-matches on shared qualifier words', () => {
  it('reduced-motion-required rejects motion-risky styles but NOT contrast-only styles', () => {
    const r = rejectedFor('reduced-motion-required');
    expect(r.has('kinetic-pop')).toBe(true);        // genuine continuous-motion risk
    expect(r.has('quiet-utility')).toBe(false);      // contrast-only risk — must not be rejected
    expect(r.has('bento-bloom')).toBe(false);
  });
  it('high-contrast-required still rejects low-contrast styles', () => {
    expect(rejectedFor('high-contrast-required').has('quiet-utility')).toBe(true);
  });
});

describe('audit HIGH#2 / M2 — accent label color meets WCAG AA for every style and mode', () => {
  it('accentText (and accentSecondaryText) >= 4.5:1 across all styles, light + dark', () => {
    const failures: string[] = [];
    for (const s of repo.allStyles()) {
      for (const mode of ['light', 'dark'] as const) {
        const c = (composeDesignTokens({ primaryStyleId: s.id, format: 'json', colorMode: mode }, repo).tokens as { color: Record<string, string> }).color;
        const r = contrastRatio(c.accentText, c.accent);
        if (r < 4.5) failures.push(`${s.id}/${mode}: accentText ${r.toFixed(3)}`);
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });
});

describe('audit L10 — compose_design_tokens both-mode render branches', () => {
  it('css-variables + both emits :root, dark theme, and prefers-color-scheme blocks', () => {
    const out = composeDesignTokens({ primaryStyleId: 'platform-core', format: 'css-variables', colorMode: 'both' }, repo).rendered;
    expect(out).toContain(':root');
    expect(out).toContain('[data-theme="dark"]');
    expect(out).toContain('prefers-color-scheme');
  });
  it('typescript + both carries light and dark token sets', () => {
    const out = composeDesignTokens({ primaryStyleId: 'platform-core', format: 'typescript', colorMode: 'both' }, repo).rendered;
    expect(out).toContain('light');
    expect(out).toContain('dark');
  });
});

describe('audit M7 — unknown secondaryStyleId is rejected, not silently ignored', () => {
  it('compose_design_tokens throws on an unknown secondaryStyleId', () => {
    expect(() => composeDesignTokens({ primaryStyleId: 'platform-core', secondaryStyleId: 'nope-xyz', format: 'json' }, repo)).toThrow();
  });
  it('compare_design_directions throws on an unknown secondaryStyleId', () => {
    expect(() => compareDirections({ directions: [{ primaryStyleId: 'platform-core' }, { primaryStyleId: 'quiet-utility', secondaryStyleId: 'nope-xyz' }] } as never, repo)).toThrow();
  });
});

describe('audit L12 — all seven workflow prompts render a non-empty user message', () => {
  let client: Client;
  const args: Record<string, Record<string, string>> = {
    'design-product': { product: 'a billing dashboard' },
    'design-screen': { screenType: 'data-table', goal: 'triage incidents' },
    'complete-ui-states': { surfaceId: 'form' },
    'redesign-with-style': { current: 'a cluttered form', goal: 'calmer' },
    'audit-design-direction': { styleId: 'platform-core', summary: 'a settings page' },
    'audit-design-principles': { summary: 'a settings page', surface: 'settings' },
    'audit-ux-principles': { summary: 'a settings page', surface: 'settings' },
  };
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'audit-test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
  });
  it('renders each prompt with a substantive instruction', async () => {
    for (const [name, a] of Object.entries(args)) {
      const res = await client.getPrompt({ name, arguments: a });
      const text = (res.messages[0]?.content as { text?: string }).text ?? '';
      expect(text.length, name).toBeGreaterThan(40);
      expect(text, name).toMatch(/webstylebook:\/\/|recommend_design_direction|get_design_principle_plan|get_ux_principle_plan|get_ui_state_plan|compare_design_directions|compose_design_tokens|anti-patterns/);
    }
  });

  it('design-product spells the brief out — there is no "brief skeleton" resource to point at', async () => {
    const res = await client.getPrompt({ name: 'design-product', arguments: args['design-product']! });
    const text = (res.messages[0]?.content as { text?: string }).text ?? '';
    expect(text).not.toMatch(/the full brief skeleton/);
    for (const section of [
      'intent', 'rejected directions', 'color ROLES', 'motion', 'UI-state coverage',
      'accessibility', 'assumptions', 'verification checklist',
    ]) {
      expect(text, section).toContain(section);
    }
    expect(text).toMatch(/selected visual-design principles/);
    expect(text).toMatch(/selected UX principles/);
  });

  it('the served manifest keeps the canonical CATALOG_DOMAINS order', async () => {
    const res = await client.readResource({ uri: 'webstylebook://manifest' });
    const served = JSON.parse((res.contents[0] as { text: string }).text);
    const generated = JSON.parse(read('generated/manifest.v1.json'));
    expect(served.domains).toEqual(generated.domains);
    expect(served.counts.designPrinciples).toBe(generated.counts.designPrinciples);
    expect(served.counts.principles).toBe(generated.counts.principles);
  });
});

describe('UX-principle guidance is wired through server, skill, and agent fragments', () => {
  it('on-init instructions frame principles as contextual evidence and name the planner', () => {
    expect(SERVER_INSTRUCTIONS).toContain('get_ux_principle_plan');
    expect(SERVER_INSTRUCTIONS).toMatch(/decision prompts, not universal laws/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/accessibility.*safety.*informed consent.*truthful feedback/i);
  });

  it('the skill and both fragments carry the same safety boundary', () => {
    for (const rel of [
      'skill/web-stylebook-design/SKILL.md',
      'skill/CLAUDE.md',
      'skill/AGENTS.md',
    ]) {
      const content = read(rel);
      expect(content, rel).toContain('get_ux_principle_plan');
      expect(content, rel).toMatch(/contextual\s+(?:decision\s+)?prompts, not universal laws/i);
      expect(content, rel).toMatch(/Accessibility, safety, informed consent, and truthful feedback/i);
    }
  });
});

describe('design-principle guidance is wired through server, skill, and agent fragments', () => {
  it('on-init instructions name the planner and frame it as craft guidance, not a fixed recipe', () => {
    expect(SERVER_INSTRUCTIONS).toContain('get_design_principle_plan');
    expect(SERVER_INSTRUCTIONS).toMatch(/rather than a fixed recipe/i);
  });

  it('the skill and both fragments name the planner and its placement/verification output', () => {
    for (const rel of [
      'skill/web-stylebook-design/SKILL.md',
      'skill/CLAUDE.md',
      'skill/AGENTS.md',
    ]) {
      const content = read(rel);
      expect(content, rel).toContain('get_design_principle_plan');
      expect(content, rel).toMatch(/placement/i);
      expect(content, rel).toMatch(/webstylebook:\/\/design-principles/);
    }
  });

  it('the design.md brief in every layer carries the selected principles, not just the tool call', () => {
    for (const rel of [
      'skill/web-stylebook-design/SKILL.md',
      'skill/CLAUDE.md',
      'skill/AGENTS.md',
    ]) {
      const content = read(rel);
      expect(content, rel).toMatch(/selected (visual-)?design principles/i);
      expect(content, rel).toMatch(/selected UX principles/i);
    }
  });
});

describe('the closing gate checks that principles were applied, not just selected', () => {
  it('the verification checklist carries a principles group with observable checks', () => {
    const group = repo.policies.verification.find((g) => g.id === 'principles');
    expect(group, 'policies/verification is missing the "principles" group').toBeDefined();
    const items = JSON.stringify(group);
    expect(items).toContain('get_design_principle_plan');
    expect(items).toContain('get_ux_principle_plan');
    expect(items).toMatch(/contested/);
  });

  it('every localized principles-group item is present in all three languages', () => {
    const group = repo.policies.verification.find((g) => g.id === 'principles');
    for (const item of group?.items ?? []) {
      for (const lang of ['en', 'ko', 'ja'] as const) {
        expect((item as Record<string, string>)[lang]?.length, lang).toBeGreaterThan(10);
      }
    }
  });

  it('the catalog carries the principle-as-decoration anti-pattern', () => {
    const entry = repo.policies.antiPatterns.find((a) => a.id === 'principle-as-decoration');
    expect(entry, 'policies/anti-patterns is missing principle-as-decoration').toBeDefined();
    expect(JSON.stringify(entry)).toMatch(/never verified|검증하지 않음/);
  });

  it('the skill and both fragments route the self-audit through the principles group', () => {
    for (const rel of [
      'skill/web-stylebook-design/SKILL.md',
      'skill/CLAUDE.md',
      'skill/AGENTS.md',
    ]) {
      const content = read(rel);
      expect(content, rel).toContain('webstylebook://policies/verification');
      expect(content, rel).toMatch(/`principles` group/);
    }
  });
});

describe('the principle selectors are honestly represented', () => {
  it('the compact list resources expose phaseTags — `phase` is a first-class tool selector', () => {
    for (const entry of repo.listPrinciples()) {
      expect(Array.isArray(entry.phaseTags), entry.id).toBe(true);
      expect(entry.phaseTags.length, entry.id).toBeGreaterThan(0);
    }
    for (const entry of repo.listDesignPrinciples()) {
      expect(Array.isArray(entry.phaseTags), entry.id).toBe(true);
      expect(entry.phaseTags.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('a near-universal selector says so instead of reading as a targeted filter', () => {
    // every UX principle carries the `validation` phase, so this filter narrows nothing
    const ux = planUxPrinciples({ phase: 'validation' }, repo);
    expect(ux.coverage.matching).toBe(ux.coverage.catalogTotal);
    expect(ux.guidance[0]).toMatch(/did not narrow the catalog/);

    const design = planDesignPrinciples({ phase: 'validation' }, repo);
    expect(design.coverage.matching / design.coverage.catalogTotal).toBeGreaterThan(0.8);
    expect(design.guidance[0]).toMatch(/did not narrow the catalog/);
  });

  it('a genuinely narrow selector carries no weak-selector warning', () => {
    const narrow = planDesignPrinciples({ concerns: ['grouping'] }, repo);
    expect(narrow.coverage.matching).toBeLessThan(narrow.coverage.catalogTotal * 0.9);
    expect(narrow.guidance.join(' ')).not.toMatch(/did not narrow the catalog/);
  });

  it('stays quiet for a broad-but-ranked query — the warning means "no-op selector", not "many matches"', () => {
    // `decision` is carried by 2 principles while `checkout` is carried by 12, so the match set is
    // wide, but the ranking genuinely separates them. Warning at that point would be noise.
    const ranked = planUxPrinciples({ outcomes: ['decision'], surface: 'checkout' }, repo);
    expect(ranked.coverage.matching).toBeGreaterThan(ranked.coverage.catalogTotal * 0.8);
    expect(ranked.coverage.matching).toBeLessThan(ranked.coverage.catalogTotal * 0.9);
    expect(ranked.guidance.join(' ')).not.toMatch(/did not narrow the catalog/);
    expect(ranked.principles[0]!.score).toBeGreaterThan(ranked.principles.at(-1)!.score);
  });

  it('explicit principleIds never trigger the weak-selector warning', () => {
    const byId = planUxPrinciples({ principleIds: ['hicks-law'], phase: 'validation' }, repo);
    expect(byId.guidance.join(' ')).not.toMatch(/did not narrow the catalog/);
  });

  it('the weak-selector warning is localized, not English leaking into ko/ja', () => {
    expect(planUxPrinciples({ phase: 'validation', locale: 'ko' }, repo).guidance[0])
      .toMatch(/좁히지 못했습니다/);
    expect(planDesignPrinciples({ phase: 'validation', locale: 'ja' }, repo).guidance[0])
      .toMatch(/絞り込めていません/);
  });
});

describe('landing-page — the skill\'s lead surface — is actually covered by both catalogs', () => {
  it('surface scoping does real work on a landing page instead of falling back to global', () => {
    const ux = repo.listPrinciples().filter((p) => p.surfaceTags.includes('landing-page'));
    const design = repo.listDesignPrinciples().filter((p) => p.surfaceTags.includes('landing-page'));
    // it used to be 1 of 23 and 3 of 21 — the surface signal was effectively dead here
    expect(ux.length).toBeGreaterThanOrEqual(8);
    expect(design.length).toBeGreaterThanOrEqual(8);
  });

  it('a landing-page query surfaces landing-tagged principles above merely-global ones', () => {
    const plan = planDesignPrinciples({ surface: 'landing-page', phase: 'structure' }, repo);
    const top = plan.principles[0];
    expect(top, 'expected at least one match').toBeDefined();
    const detail = repo.getDesignPrinciple(top!.id);
    expect(detail?.surfaceTags).toContain('landing-page');
  });
});

describe('the opening furniture-check is queryable, not only prose in the skill', () => {
  it('the catalog carries a design principle for composing the opening', () => {
    const entry = repo.getDesignPrinciple('opening-earns-its-frame');
    expect(entry, 'designPrinciples is missing opening-earns-its-frame').toBeDefined();
    expect(entry?.surfaceTags).toContain('landing-page');
    const text = JSON.stringify(entry);
    expect(text).toMatch(/swapping the logo and one noun|명사 하나만 바꿔/);
    expect(text).toMatch(/three structurally different openings|구조가 다른 오프닝 세 가지/);
  });

  it('it cross-links to the UX principles that explain why the default fails', () => {
    const entry = repo.getDesignPrinciple('opening-earns-its-frame');
    expect(entry?.relatedUxPrincipleIds.length).toBeGreaterThan(0);
    for (const id of entry?.relatedUxPrincipleIds ?? []) {
      expect(repo.getPrinciple(id), `dangling relatedUxPrincipleId ${id}`).toBeDefined();
    }
  });

  it('get_design_principle_plan can actually reach it from a landing-page query', () => {
    const plan = planDesignPrinciples(
      { concerns: ['focus', 'balance', 'restraint'], surface: 'landing-page', phase: 'discover' },
      repo,
    );
    expect(plan.principles.map((p) => p.id)).toContain('opening-earns-its-frame');
  });
});

describe('anti-formulaic-opening guidance targets generic furniture (not column count) across all three layers', () => {
  it('the bundled catalog carries the formulaic-opening anti-pattern + the furniture verification check', () => {
    const catalog = read('generated/catalog.v1.json');
    expect(catalog).toContain('formulaic-opening');
    expect(catalog).toContain('generic furniture');
    expect(catalog).toContain('bespoke product demonstration');
  });
  it('the on-init server instructions target generic furniture + require structurally-distinct candidates', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/generic furniture/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/bespoke demonstration/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/differ in opening STRUCTURE/i);
  });
  it('SKILL.md encodes the forcing function + the furniture-check (not a buried prohibition, not a blunt two-column ban)', () => {
    const skill = read('skill/web-stylebook-design/SKILL.md');
    expect(skill).toContain('the one thing, not a hero');
    expect(skill).toContain('generic furniture');
    expect(skill).toContain('bespoke demonstration of THIS product');
    expect(skill).toMatch(/three structurally-different openings/i);
    expect(skill).toMatch(/no running-text column/i);
  });
  it('the CLAUDE.md and AGENTS.md fragments mirror the furniture-check (seam does not launder a generic visual)', () => {
    for (const rel of ['skill/CLAUDE.md', 'skill/AGENTS.md']) {
      const frag = read(rel);
      expect(frag, rel).toContain('No formulaic opening');
      expect(frag, rel).toContain('generic furniture');
      expect(frag, rel).toMatch(/furniture-check/i);
      expect(frag, rel).toMatch(/seam.*does NOT launder|does NOT launder a generic visual/i);
    }
  });
});

describe('anti-AI-headline-cadence guidance is present and example-free', () => {
  it('the bundled catalog carries the ai-headline-cadence anti-pattern (described abstractly)', () => {
    const catalog = read('generated/catalog.v1.json');
    expect(catalog).toContain('ai-headline-cadence');
    expect(catalog).toContain('italicized in the accent color');
  });
  it('the on-init server instructions name the AI headline cadence + the paste-test', () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/AI headline cadence/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/paste-test/i);
  });
  it('SKILL.md and both fragments encode the "kill the AI headline cadence" rule', () => {
    expect(read('skill/web-stylebook-design/SKILL.md')).toMatch(/Kill the AI headline cadence/i);
    for (const rel of ['skill/CLAUDE.md', 'skill/AGENTS.md']) {
      expect(read(rel), rel).toMatch(/Kill the AI headline cadence/i);
    }
  });
  it('the guidance describes the cliché abstractly — no baked example headline phrases', () => {
    const corpus = [
      'skill/web-stylebook-design/SKILL.md',
      'skill/CLAUDE.md',
      'skill/AGENTS.md',
      'src/server-info.ts',
      'generated/catalog.v1.json',
    ].map(read).join('\n');
    for (const phrase of ['깊이 들어가는 시간', '단 하나의 상', 'Find the throughline']) {
      expect(corpus, `example phrase leaked into guidance: ${phrase}`).not.toContain(phrase);
    }
  });
});

describe('audit L11 — CLI flags', () => {
  const run = (args: string[]): Promise<{ code: number | null; out: string; err: string }> =>
    new Promise((resolve) => {
      const child = spawn('node', [cli, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let err = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { err += d.toString(); });
      child.on('close', (code) => resolve({ code, out, err }));
    });

  it('--version prints a semver and exits 0', async () => {
    const r = await run(['--version']);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toMatch(/\d+\.\d+\.\d+/);
  }, 10000);
  it('--catalog-info emits JSON with catalogVersion + counts', async () => {
    const r = await run(['--catalog-info']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.catalogVersion).toBeDefined();
    expect(j.counts.styles).toBe(48);
  }, 10000);
  it('--validate-catalog exits 0 for the bundled catalog', async () => {
    const r = await run(['--validate-catalog']);
    expect(r.code).toBe(0);
  }, 10000);
});
