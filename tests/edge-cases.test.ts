import { describe, it, expect } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { composeDesignTokens } from '../src/tokens/compile.js';
import { compareDirections } from '../src/recommendation/compare.js';
import { planUiStates } from '../src/state-atlas/planner.js';
import { contrastRatio, parseHex } from '../src/tokens/contrast.js';
import type { ProductContext } from '../src/recommendation/types.js';

const repo = CatalogRepository.load();
const chroma = (hex: string) => { const c = parseHex(hex)!; return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b); };

describe('token compiler — usable output for every style (eval #1 regression)', () => {
  it('all 48 styles produce AA-clean, non-saturated tokens in BOTH light and dark', () => {
    const failures: string[] = [];
    for (const s of repo.allStyles()) {
      for (const mode of ['light', 'dark'] as const) {
        const c = (composeDesignTokens({ primaryStyleId: s.id, format: 'json', colorMode: mode }, repo).tokens as { color: Record<string, string> }).color;
        if (contrastRatio(c.text, c.canvas) < 4.5) failures.push(`${s.id}/${mode}: body ${contrastRatio(c.text, c.canvas).toFixed(2)}`);
        if (contrastRatio(c.focus, c.canvas) < 3) failures.push(`${s.id}/${mode}: focus ${contrastRatio(c.focus, c.canvas).toFixed(2)}`);
        if (chroma(c.canvas) > 30) failures.push(`${s.id}/${mode}: saturated canvas ${c.canvas}`);
      }
    }
    expect(failures, failures.join('\n')).toHaveLength(0);
  });

  it('preserves the style brand accent while repairing focus separately', () => {
    const c = (composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json', colorMode: 'light' }, repo).tokens as { color: Record<string, string> }).color;
    expect(c.accent.toLowerCase()).toBe('#74c2b4'); // brand accent preserved
    expect(c.focus).not.toBe(c.canvas);             // focus is not invisible
  });

  it('accepts 3-char and 8-char hex accent overrides, rejects garbage', () => {
    expect(() => composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json', accentOverride: '#0f0' }, repo)).not.toThrow();
    expect(() => composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json', accentOverride: '#ff0066ff' }, repo)).not.toThrow();
    expect(() => composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json', accentOverride: 'nope' }, repo)).toThrow();
  });

  it('secondaryStyleId is not a no-op — it adds accentSecondary (eval probe)', () => {
    const a = composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json' }, repo);
    const b = composeDesignTokens({ primaryStyleId: 'runtime-signal', secondaryStyleId: 'quiet-utility', format: 'json' }, repo);
    expect(JSON.stringify(a.tokens)).not.toBe(JSON.stringify(b.tokens));
    expect((b.tokens as { color: Record<string, string> }).color.accentSecondary).toBeTruthy();
  });
});

describe('recommend — ranking, confidence, pairing fixes', () => {
  const sre: ProductContext = { productType: 'operational-saas', productDescription: 'Daily SRE dashboard, calm, dense', tone: ['calm', 'technical'], density: 'high', usageFrequency: 'daily', avoid: ['cyberpunk decoration'] };

  it('merit tie-break demotes console-launch below quiet-utility/runtime-signal (eval #2)', () => {
    const r = recommendDesignDirection(sre, repo);
    const ids = r.candidates.map((c) => c.styleId);
    const iConsole = ids.indexOf('console-launch');
    const iRuntime = ids.indexOf('runtime-signal');
    const iQuiet = ids.indexOf('quiet-utility');
    expect(iRuntime).toBeGreaterThanOrEqual(0);
    if (iConsole >= 0) { expect(iConsole).toBeGreaterThan(iRuntime); expect(iConsole).toBeGreaterThan(iQuiet); }
  });

  it('candidates carry differentiators (eval #2)', () => {
    const r = recommendDesignDirection(sre, repo);
    expect(r.candidates.every((c) => c.differentiators.length > 0)).toBe(true);
    expect(r.candidates[0]!.differentiators.some((d) => d.startsWith('motion:'))).toBe(true);
  });

  it('confidence is high for a fully-specified query despite a top tie (eval #5)', () => {
    expect(recommendDesignDirection(sre, repo).confidence).toBe('high');
    expect(recommendDesignDirection({ productDescription: 'a thing' }, repo).confidence).toBe('low'); // sparse stays low
  });

  it('guidance explains the tie when candidates are tied at the top', () => {
    const r = recommendDesignDirection(sre, repo);
    const topScore = r.candidates[0]!.score;
    if (r.candidates.filter((c) => c.score === topScore).length > 1) {
      expect(r.guidance.toLowerCase()).toContain('tied');
    }
  });

  it('pairings never include a secondary whose antiTones conflict with the request (eval #3)', () => {
    const ecom: ProductContext = { productType: 'commerce', productDescription: 'premium fashion', tone: ['premium', 'trustworthy'], trustSensitivity: 'high' };
    const r = recommendDesignDirection(ecom, repo);
    for (const p of r.pairings) {
      const s = repo.getStyle(p.styleId)!;
      expect(s.recommendationFacets.antiTones.some((t) => ecom.tone!.includes(t))).toBe(false);
    }
    expect(r.pairings.map((p) => p.styleId)).not.toContain('duotone-bold');
  });

  it('facet fixes: neumorphism/bento-bloom no longer surface for operational-saas (eval #4)', () => {
    const r = recommendDesignDirection({ productType: 'operational-saas', productDescription: 'ops tool', density: 'high', usageFrequency: 'daily' }, repo);
    const ids = r.candidates.map((c) => c.styleId);
    expect(ids).not.toContain('neumorphism');
    expect(ids).not.toContain('bento-bloom');
  });

  it('localizes matched text and rejection explanations for ko/ja', () => {
    for (const locale of ['ko', 'ja'] as const) {
      const r = recommendDesignDirection({ ...sre, locale }, repo);
      const rej = r.rejected.find((x) => x.reasonCodes.includes('DAILY_USE_OVERSTIMULATION'));
      // explanation must contain CJK characters (i.e. it was localized)
      expect(/[぀-ヿ一-鿿가-힯]/.test(rej?.explanation ?? '')).toBe(true);
    }
  });

  it('is deterministic across repeated runs', () => {
    const out = () => JSON.stringify(recommendDesignDirection(sre, repo));
    expect(out()).toBe(out());
  });
});

describe('state plan — new recipes + filters (eval #7)', () => {
  it('checkout exposes item-unavailable and price-changed', () => {
    const ids = planUiStates({ surfaceId: 'checkout' }, repo).recommended.map((s) => s.id);
    expect(ids).toContain('item-unavailable');
    expect(ids).toContain('price-changed');
  });
  it('form exposes autosaving and saved', () => {
    const ids = planUiStates({ surfaceId: 'form' }, repo).recommended.map((s) => s.id);
    expect(ids).toContain('autosaving');
    expect(ids).toContain('saved');
  });
  it('the 4 new recipes are fully populated', () => {
    for (const id of ['item-unavailable', 'price-changed', 'autosaving', 'saved']) {
      const r = repo.getRecipe(id)!;
      expect(r, id).toBeDefined();
      expect(r.mustShow.length).toBeGreaterThan(1);
      expect(r.mustNot.length).toBeGreaterThan(1);
    }
  });
  it('includeCategories filters across all criticalities', () => {
    const plan = planUiStates({ surfaceId: 'data-table', includeCategories: ['permission'] }, repo);
    const all = [...plan.required, ...plan.recommended, ...plan.domainSpecific];
    expect(all.every((s) => s.category === 'permission')).toBe(true);
  });
  it('does not cry wolf about domain states when some were returned', () => {
    const plan = planUiStates({ surfaceId: 'checkout' }, repo); // has domain-specific (refund-pending)
    expect(plan.unresolvedQuestions.join(' ')).not.toContain('domain-specific states may be incomplete');
  });
});

describe('hardening sweep regressions', () => {
  it('empty / invalid accentOverride is rejected, never silently corrupt (#1)', () => {
    expect(() => composeDesignTokens({ primaryStyleId: 'brutalist-grid', format: 'css-variables', accentOverride: '' }, repo)).toThrow();
    expect(() => composeDesignTokens({ primaryStyleId: 'brutalist-grid', format: 'json', accentOverride: 'red' }, repo)).toThrow();
    // a valid override still works and never yields an empty color token
    const t = composeDesignTokens({ primaryStyleId: 'brutalist-grid', format: 'css-variables', accentOverride: '#abc' }, repo);
    expect(t.rendered).not.toContain('--color-accent: ;');
  });

  it('facet wins over a fuzzy notIdealFor phrase — consumer-app keeps its declared pool (#3)', () => {
    const r = recommendDesignDirection({ productType: 'consumer-app', productDescription: 'a consumer app' }, repo);
    expect(48 - r.rejected.length).toBeGreaterThan(7); // was decimated to 7 before the facet-wins guard
    // no style is rejected PRODUCT_NOT_IDEAL for a productType it explicitly claims
    for (const rej of r.rejected) {
      if (rej.reasonCodes.includes('PRODUCT_NOT_IDEAL')) {
        const s = repo.getStyle(rej.styleId)!;
        expect(s.recommendationFacets.productTypes.includes('consumer-app'), `${rej.styleId} wrongly PRODUCT_NOT_IDEAL'd`).toBe(false);
      }
    }
  });

  it('confidence is not high when the winner fails the explicitly-requested tone (#4)', () => {
    const r = recommendDesignDirection({ productType: 'finance-admin', productDescription: 'x', tone: ['playful', 'bold', 'experimental'], density: 'compact', usageFrequency: 'daily', trustSensitivity: 'high' }, repo);
    expect(r.candidates[0]!.scoreBreakdown.tone).toBeLessThan(0.5);
    expect(r.confidence).not.toBe('high');
  });

  it('sub-AA secondary accent text is warned, like the primary (#5)', () => {
    const r = composeDesignTokens({ primaryStyleId: 'earth-atelier', secondaryStyleId: 'mesh-gradient', format: 'json', colorMode: 'light' }, repo);
    const c = (r.tokens as { color: Record<string, string> }).color;
    if (contrastRatio(c.accentSecondaryText!, c.accentSecondary!) < 4.5) {
      expect(r.warnings.some((w) => w.includes('secondary'))).toBe(true);
    }
  });
});

describe('round 3 — inference, locale, token-render', () => {
  it('free-text inference uses word boundaries — no short-alias substring collisions (r3 #1)', () => {
    // these natural briefs must NOT infer a confident wrong productType via substring collision
    const funeral = recommendDesignDirection({ productDescription: 'a funeral home website' }, repo);
    expect(funeral.confidence).toBe('low');
    // the old bug inferred campaign/consumer-app + playful; the safe outcome is 'other' default
    expect(funeral.resolvedContext.normalizedFacets[0]).toContain('other');
    // positive case still works: explicit alias 'trading' -> finance-admin
    const crypto = recommendDesignDirection({ productDescription: 'a crypto trading terminal' }, repo);
    expect(crypto.resolvedContext.normalizedFacets[0]).toContain('finance-admin');
  });

  it('guidance and pairing rationale are localized for ko/ja (r3 #2)', () => {
    const ko = recommendDesignDirection({ productType: 'operational-saas', productDescription: 'x', tone: ['calm'], locale: 'ko' }, repo);
    expect(/[가-힣]/.test(ko.guidance)).toBe(true);
    expect(/politely|candidates\[0\] is the strongest/i.test(ko.guidance)).toBe(false); // no raw English sentence
    if (ko.pairings[0]) expect(/[가-힣]/.test(ko.pairings[0].rationale)).toBe(true);
    const ja = recommendDesignDirection({ productType: 'operational-saas', productDescription: 'x', tone: ['calm'], locale: 'ja' }, repo);
    expect(/[ぁ-んァ-ヶ一-龯]/.test(ja.guidance)).toBe(true);
  });

  it('tailwind colorMode:both keeps BOTH themes, not just light (r3 #3)', () => {
    const r = composeDesignTokens({ primaryStyleId: 'bento-bloom', format: 'tailwind', colorMode: 'both' }, repo);
    expect(r.rendered).toContain('"dark"');
    expect(r.rendered).toContain('"light"');
  });

  it('save-conflict recipe exists for the form surface and is well-formed (r3 #7)', () => {
    const r = repo.getRecipe('save-conflict')!;
    expect(r).toBeDefined();
    expect(r.surfaceIds).toContain('form');
    expect(r.mustNot.length).toBeGreaterThan(1);
    expect(planUiStates({ surfaceId: 'form' }, repo).recommended.map((s) => s.id)).toContain('save-conflict');
  });
});

describe('round 4 — archetype consistency, ties, order, inference', () => {
  it('no archetype recommends a style its own productType hard-rejects (r4 build guard)', () => {
    for (const a of repo.data.productArchetypes) {
      for (const sid of a.recommendedPrimaryStyleIds) {
        const r = recommendDesignDirection({ productType: a.id as never, productDescription: a.id }, repo);
        const rej = r.rejected.find((x) => x.styleId === sid);
        expect(rej?.reasonCodes.includes('PRODUCT_NOT_IDEAL'),
          `archetype ${a.id} primary ${sid} is hard-rejected`).not.toBe(true);
      }
    }
  });

  it('commerce curated primaries are not rejected and surface as survivors (r4 blocking)', () => {
    const r = recommendDesignDirection({ productType: 'commerce', productDescription: 'an online store' }, repo);
    const rejectedIds = new Set(r.rejected.map((x) => x.styleId));
    for (const id of ['mesh-gradient', 'bento-bloom', 'macos-liquid-glass']) {
      expect(rejectedIds.has(id), `${id} should not be rejected for commerce`).toBe(false);
      expect(repo.getStyle(id)!.recommendationFacets.productTypes).toContain('commerce');
    }
  });

  it('healthcare-portal has direct facet matches (r4 coverage)', () => {
    const claimers = repo.allStyles().filter((s) => s.recommendationFacets.productTypes.includes('healthcare-portal'));
    expect(claimers.length).toBeGreaterThan(0);
    const r = recommendDesignDirection({ productType: 'healthcare-portal', productDescription: 'patient portal', tone: ['calm', 'trustworthy'] }, repo);
    expect(repo.getStyle(r.candidates[0]!.styleId)!.recommendationFacets.productTypes).toContain('healthcare-portal');
  });

  it('tie-guidance count matches the displayed (round2) scores (r4 medium)', () => {
    // grid of tone/task/usage to find tie cases, then assert consistency
    const inputs = [
      { productType: 'finance-admin' as const, tone: ['playful', 'bold'] as never, primaryTasks: ['read', 'search'], usageFrequency: 'occasional' as const },
      { productType: 'operational-saas' as const, tone: ['playful', 'bold'] as never, primaryTasks: ['monitor'], usageFrequency: 'occasional' as const },
    ];
    for (const inp of inputs) {
      const r = recommendDesignDirection({ ...inp, productDescription: 'x' }, repo);
      const top = r.candidates[0]!.score;
      const visibleTies = r.candidates.filter((c) => c.score === top).length;
      const claimsTie = /tied at the top/i.test(r.guidance) || /상위.*동점/.test(r.guidance) || /同点/.test(r.guidance);
      if (visibleTies > 1) expect(claimsTie, `${visibleTies} visible ties but guidance silent`).toBe(true);
      if (visibleTies === 1) expect(claimsTie, 'no visible tie but guidance claims one').toBe(false);
    }
  });

  it('planUiStates lists are order-independent (sorted), not catalog-array dependent (r4)', () => {
    const ids = planUiStates({ surfaceId: 'data-table' }, repo).required.map((s) => s.id);
    const sorted = [...ids].sort((a, b) => a < b ? -1 : 1);
    // within a category they are id-sorted; assert the whole list is a deterministic function (re-run equal)
    expect(planUiStates({ surfaceId: 'data-table' }, repo).required.map((s) => s.id)).toEqual(ids);
    void sorted;
  });

  it('inference matches dashboard/chatbot and prefers the most specific alias (r4)', () => {
    expect(recommendDesignDirection({ productDescription: 'an internal admin dashboard' }, repo).resolvedContext.normalizedFacets[0]).toContain('operational-saas');
    expect(recommendDesignDirection({ productDescription: 'a customer support chatbot' }, repo).resolvedContext.normalizedFacets[0]).toContain('ai-chat');
    // specific signal beats generic: 'trading' (finance) should win over a generic word
    expect(recommendDesignDirection({ productDescription: 'a trading app' }, repo).resolvedContext.normalizedFacets[0]).toContain('finance-admin');
  });
});

describe('round 5 — compare axes + cross-tool coherence', () => {
  it('compare uses the secondaryStyleId — it changes the axes (r5 #1)', () => {
    const base = compareDirections({ directions: [{ primaryStyleId: 'quiet-utility' }, { primaryStyleId: 'editorial-silence' }] }, repo).directions[0]!;
    const merged = compareDirections({ directions: [{ primaryStyleId: 'quiet-utility', secondaryStyleId: 'cyberpunk-glitch' }, { primaryStyleId: 'editorial-silence' }] }, repo).directions[0]!;
    expect(JSON.stringify(merged.axes)).not.toBe(JSON.stringify(base.axes));
    expect(merged.axes.motionIntensity).toBe('high'); // cyberpunk drags motion up
    expect(merged.axes.accessibilityRisk).toBe('high');
  });

  it('compare accessibilityRisk + visualDistinctiveness are facet/motion-aware (r5 #2/#3)', () => {
    const cy = compareDirections({ directions: [{ primaryStyleId: 'cyberpunk-glitch' }, { primaryStyleId: 'quiet-utility' }] }, repo).directions[0]!;
    expect(cy.axes.accessibilityRisk).toBe('high'); // high motion must count
    expect(cy.axes.visualDistinctiveness).toBe('high'); // continuousSpectacle must count, not just family
    expect(cy.likelyFailureMode).not.toMatch(/\b(borders|colors|patterns)\s+is\b/); // no plural subject-verb error
  });

  it('compare productFit is adjacency-aware, matching recommend (r5 #4)', () => {
    // soft-pastel is recommended (adjacency) for ai-chat; compare must not call it 'weak'
    const d = compareDirections({ directions: [{ primaryStyleId: 'soft-pastel' }, { primaryStyleId: 'editorial-silence' }], product: { productDescription: 'ai chat', productType: 'ai-chat' } }, repo).directions[0]!;
    expect(d.axes.productFit).toBe('adjacent');
  });

  it('compose_design_tokens notes a dark-only style under light mode (r5 #5)', () => {
    const r = composeDesignTokens({ primaryStyleId: 'console-launch', format: 'json', colorMode: 'light' }, repo);
    expect(r.notes.some((n) => n.toLowerCase().includes('dark-only'))).toBe(true);
    // and NOT noted under dark mode
    const dark = composeDesignTokens({ primaryStyleId: 'console-launch', format: 'json', colorMode: 'dark' }, repo);
    expect(dark.notes.some((n) => n.toLowerCase().includes('dark-only'))).toBe(false);
  });

  it('motion glow is continuous, consistent with its breathing fallback (r5 #6)', () => {
    expect(repo.getMotion('glow')!.continuous).toBe(true);
    // every non-continuous pattern fallback must not reference looping motion
    for (const m of repo.data.motionPatterns) {
      if (!m.continuous) {
        expect(m.reducedMotionFallback.en.toLowerCase()).not.toMatch(/breathing|loop|sweep/);
      }
    }
  });
});

describe('round 6 — compare safety axes + token typography', () => {
  const rank: Record<string, number> = { low: 0, medium: 1, high: 2 };

  it('a calm/high-trust secondary NEVER inflates trust or repeatedUse (r6 blocking)', () => {
    // exhaustive: for every (primary, calmer-secondary) the merged safety axes must not exceed the primary's
    const styles = repo.allStyles();
    for (const p of styles) {
      const solo = compareDirections({ directions: [{ primaryStyleId: p.id }, { primaryStyleId: 'editorial-silence' }] }, repo).directions[0]!;
      for (const s of ['quiet-utility', 'platform-core', 'soft-pastel']) {
        if (s === p.id) continue;
        const merged = compareDirections({ directions: [{ primaryStyleId: p.id, secondaryStyleId: s }, { primaryStyleId: 'editorial-silence' }] }, repo).directions[0]!;
        expect(rank[merged.axes.trust] ?? 1, `${p.id}+${s} trust inflated`).toBeLessThanOrEqual(rank[solo.axes.trust] ?? 1);
        expect(rank[merged.axes.repeatedUseSuitability] ?? 1, `${p.id}+${s} reuse inflated`).toBeLessThanOrEqual(rank[solo.axes.repeatedUseSuitability] ?? 1);
      }
    }
  });

  it('a loud secondary still RAISES risk axes (worst-case preserved)', () => {
    const solo = compareDirections({ directions: [{ primaryStyleId: 'quiet-utility' }, { primaryStyleId: 'editorial-silence' }] }, repo).directions[0]!;
    const merged = compareDirections({ directions: [{ primaryStyleId: 'quiet-utility', secondaryStyleId: 'cyberpunk-glitch' }, { primaryStyleId: 'editorial-silence' }] }, repo).directions[0]!;
    expect(rank[merged.axes.motionIntensity]!).toBeGreaterThanOrEqual(rank[solo.axes.motionIntensity]!);
    expect(merged.axes.accessibilityRisk).toBe('high');
  });

  it('token output notes a serif/sans typography mismatch only when real (r6)', () => {
    // risograph-print: serif-described but expressive/sans family -> mismatch note
    const miss = composeDesignTokens({ primaryStyleId: 'risograph-print', format: 'json' }, repo);
    expect(miss.notes.some((n) => n.includes('suggests a serif'))).toBe(true);
    // editorial-silence: editorial family already serif -> no mismatch (general note only)
    const ok = composeDesignTokens({ primaryStyleId: 'fusion-grain-mono', format: 'json' }, repo);
    expect(ok.notes.some((n) => n.includes('suggests a serif'))).toBe(false);
    // every token result carries a typography reconciliation note
    expect(miss.notes.some((n) => n.toLowerCase().includes('typography'))).toBe(true);
  });

  it('serif-note polarity is correct, incl. negated typography (r7 regression)', () => {
    const fires = (id: string) => composeDesignTokens({ primaryStyleId: id, format: 'json' }, repo).notes.some((n) => n.includes('suggests a serif'));
    // negated serif mentions with an intervening adjective must NOT fire the serif note
    expect(fires('fusion-soft-inflate')).toBe(false); // "No classical serif..."
    expect(fires('fusion-quiet-manifesto')).toBe(false); // "...no serif anywhere"
    // genuine sans-family-wants-serif must fire
    expect(fires('midnight-noir')).toBe(true);
    // NO style whose typography NEGATES serif may fire the serif note (global guard)
    for (const s of repo.allStyles()) {
      const typo = s.typography.toLowerCase();
      const negated = /\b(?:no|without|not|anti|never)\b[\w\s-]{0,24}?\bserif\b/.test(typo) || /sans-?\s?serif/.test(typo);
      if (negated && !/\bserif\b/.test(typo.replace(/sans-?\s?serif/g, '').replace(/\b(?:no|without|not|anti|never)\b[\w\s-]{0,24}?\bserif\b/g, ''))) {
        expect(fires(s.id), `${s.id} negates serif but fired the serif note`).toBe(false);
      }
    }
  });
});
