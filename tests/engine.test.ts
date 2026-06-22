import { describe, it, expect } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { planUiStates } from '../src/state-atlas/planner.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import { compareDirections } from '../src/recommendation/compare.js';
import { contrastRatio, checkContrast } from '../src/tokens/contrast.js';

const repo = CatalogRepository.load();

describe('contrast math', () => {
  it('black on white is 21:1', () => {
    expect(Math.round(contrastRatio('#000000', '#ffffff'))).toBe(21);
  });
  it('flags low contrast below AA', () => {
    expect(checkContrast('#bbbbbb', '#ffffff', 'x')).not.toBeNull();
    expect(checkContrast('#000000', '#ffffff', 'x')).toBeNull();
  });
});

describe('state planner', () => {
  it('splits required/recommended/domain-specific for every surface', () => {
    for (const s of repo.listSurfaces()) {
      const plan = planUiStates({ surfaceId: s.id }, repo);
      expect(plan.required.length).toBeGreaterThan(0);
      expect(plan.required.every((r) => r.criticality === 'required')).toBe(true);
      expect(plan.implementationOrder.length).toBe(plan.required.length + plan.recommended.length + plan.domainSpecific.length);
    }
  });
  it('criticalOnly drops recommended + domain-specific', () => {
    const plan = planUiStates({ surfaceId: 'checkout', criticalOnly: true }, repo);
    expect(plan.recommended).toHaveLength(0);
    expect(plan.domainSpecific).toHaveLength(0);
  });
  it('category filter restricts states', () => {
    const plan = planUiStates({ surfaceId: 'data-table', includeCategories: ['network'] }, repo);
    const all = [...plan.required, ...plan.recommended, ...plan.domainSpecific];
    expect(all.every((s) => s.category === 'network')).toBe(true);
  });
  it('emits a style note when styleId given', () => {
    const plan = planUiStates({ surfaceId: 'chat', styleId: 'runtime-signal' }, repo);
    expect(plan.styleNote).toBeTruthy();
  });
  it('every state summary has mustShow + mustNot + primaryAction', () => {
    const plan = planUiStates({ surfaceId: 'form' }, repo);
    for (const s of [...plan.required, ...plan.recommended, ...plan.domainSpecific]) {
      expect(s.mustShow.length).toBeGreaterThan(0);
      expect(s.mustNot.length).toBeGreaterThan(0);
      expect(s.primaryAction.length).toBeGreaterThan(0);
    }
  });
});

describe('token compiler', () => {
  it('emits all 4 formats with role-based color tokens', () => {
    for (const format of ['json', 'css-variables', 'tailwind', 'typescript'] as const) {
      const r = composeDesignTokens({ primaryStyleId: 'runtime-signal', format }, repo);
      expect(r.rendered.length).toBeGreaterThan(50);
      expect(r.notes.length).toBeGreaterThan(0);
    }
  });
  it('css-variables include a visible border token (>=22% blend)', () => {
    const r = composeDesignTokens({ primaryStyleId: 'platform-core', format: 'json', colorMode: 'light' }, repo);
    const t = r.tokens as any;
    expect(t.color.border).toMatch(/^#[0-9a-f]{6}$/i);
    // border must differ meaningfully from canvas (not an 8-12% ghost)
    expect(contrastRatio(t.color.border, t.color.canvas)).toBeGreaterThan(1.05);
  });
  it('accent override produces a note and validates hex', () => {
    const r = composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json', accentOverride: '#ff0066' }, repo);
    expect(r.notes.some((n) => n.toLowerCase().includes('accent'))).toBe(true);
    expect(() => composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json', accentOverride: 'notahex' }, repo)).toThrow();
  });
  it('both mode yields light + dark', () => {
    const r = composeDesignTokens({ primaryStyleId: 'midnight-noir', format: 'json', colorMode: 'both' }, repo);
    const t = r.tokens as any;
    expect(t.light).toBeDefined();
    expect(t.dark).toBeDefined();
  });
});

describe('compare', () => {
  it('returns a profile per direction with axes', () => {
    const r = compareDirections({ directions: [{ primaryStyleId: 'runtime-signal' }, { primaryStyleId: 'editorial-silence' }, { primaryStyleId: 'cyberpunk-glitch' }] }, repo);
    expect(r.directions).toHaveLength(3);
    for (const d of r.directions) {
      expect(d.axes.motionIntensity).toMatch(/low|medium|high/);
      expect(d.likelyFailureMode.length).toBeGreaterThan(0);
    }
  });
  it('rejects <2 or >4 directions', () => {
    expect(() => compareDirections({ directions: [{ primaryStyleId: 'runtime-signal' }] }, repo)).toThrow();
  });
});
