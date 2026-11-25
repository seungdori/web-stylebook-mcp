// Plan PR 2 (2026-11-25 design-quality plan, 5.1): recommend_design_direction had no field for what the page does.
// In the 0.16.0 runs every landing call passed productType "operational-saas" for a marketing landing page, the
// product archetype set density high and daily use, and all three got the operations-dashboard styles. pageRole,
// given or inferred from the description, now sets those defaults and adds the product type whose job the page does.
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import { normalizeContext } from '../src/recommendation/normalize-context.js';
import { PAGE_ROLES, PAGE_ROLE_PROFILES } from '../src/recommendation/page-roles.js';
import type { ProductContext } from '../src/recommendation/types.js';
import { DENSITY_LEVELS, PRODUCT_TYPES, USAGE_FREQUENCIES } from '../src/types.js';

const repo = CatalogRepository.load();
const DASHBOARD_STYLES = repo.getProduct('operational-saas')!.recommendedPrimaryStyleIds;
const top = (brief: ProductContext) => recommendDesignDirection({ ...brief, candidateLimit: 5 }, repo).candidates;

// The landing calls as logged in runs/landing-on and runs/landing-on-r2 (2026-11-25, web-stylebook-mcp 0.16.0).
const LANDING_R1: ProductContext = {
  productDescription: 'Minutely: B2B SaaS that automatically summarizes team meeting recordings and turns them into action items (to-dos with owners and due dates). Marketing landing page with hero, features, how it works, testimonials, pricing summary, final CTA, footer.',
  productType: 'operational-saas',
  tone: ['trustworthy', 'calm', 'editorial'],
  audience: ['team leads', 'product managers', 'operations managers at SMB and mid-market companies'],
  primaryTasks: ['understand value quickly', 'start free trial', 'compare plans'],
  locale: 'ko',
  constraints: ['single index.html with inline CSS/JS', 'Korean copy', '1440px desktop, mobile responsive'],
};
const LANDING_R2: ProductContext = {
  productDescription: 'Minutely: B2B SaaS that records team meetings, automatically summarizes them and turns discussion into assigned action items (to-dos) synced to project tools. Marketing landing page.',
  productType: 'operational-saas',
  tone: ['calm', 'trustworthy', 'editorial'],
  audience: ['team leads', 'product managers', 'operations managers at SMB and mid-market companies'],
  primaryTasks: ['understand value quickly', 'see how it works', 'compare pricing', 'start free trial'],
  locale: 'ko',
  density: 'medium',
  trustSensitivity: 'medium',
  constraints: ['single index.html with inline CSS/JS', 'Korean copy', '1440px desktop and mobile responsive'],
};
const withoutLandingWords = (brief: ProductContext): ProductContext => ({
  ...brief, productDescription: brief.productDescription.replace(/ ?Marketing landing page[^.]*\./, ''),
});

describe('pageRole on a marketing landing page for an operational product', () => {
  it.each([['r1', LANDING_R1], ['r2', LANDING_R2]] as const)('%s: an operations-dashboard style is not first', (_run, brief) => {
    for (const variant of [brief, { ...brief, pageRole: 'marketing-landing' as const }]) {
      const [first] = top(variant);
      expect(DASHBOARD_STYLES).not.toContain(first!.styleId);
    }
  });

  it('infers the role from "Marketing landing page" in the description, as an explicit role would', () => {
    const inferred = normalizeContext(LANDING_R1, repo);
    expect(inferred.pageRole).toEqual({ value: 'marketing-landing', source: 'inferred', evidence: 'matched "landing page"' });
    expect(top(LANDING_R1)).toEqual(top({ ...LANDING_R1, pageRole: 'marketing-landing' }));
  });

  it('takes density and usage from the page role, unless the brief states them', () => {
    const r1 = normalizeContext(LANDING_R1, repo);
    expect(r1.density).toEqual({ value: 'low', source: 'inferred', evidence: 'page role marketing-landing' });
    expect(r1.usageFrequency).toEqual({ value: 'one-off', source: 'inferred', evidence: 'page role marketing-landing' });
    expect(r1.assumptions).toContain('density defaulted to low (page role marketing-landing)');
    const r2 = normalizeContext(LANDING_R2, repo);
    expect(r2.density).toEqual({ value: 'medium', source: 'explicit' });
    expect(r2.usageFrequency.value).toBe('one-off');
  });

  it('judges product fit against the product and the campaign job the landing page does', () => {
    const plain = recommendDesignDirection({ ...withoutLandingWords(LANDING_R1), candidateLimit: 10 }, repo);
    const role = recommendDesignDirection({ ...withoutLandingWords(LANDING_R1), pageRole: 'marketing-landing', candidateLimit: 10 }, repo);
    const fit = (r: typeof plain, id: string) => r.candidates.find((c) => c.styleId === id)?.scoreBreakdown.product;
    // bento-bloom claims campaign but not operational-saas.
    expect(repo.getStyle('bento-bloom')!.recommendationFacets.productTypes).toContain('campaign');
    expect(fit(role, 'bento-bloom')).toBeGreaterThan(fit(plain, 'bento-bloom') ?? 0);
    expect(fit(role, 'quiet-utility')).toBe(1);
  });

  it('keeps the earlier result when the brief names no page', () => {
    const brief = withoutLandingWords(LANDING_R1);
    expect(normalizeContext(brief, repo).pageRole).toBeUndefined();
    expect(normalizeContext(brief, repo).density).toEqual({ value: 'high', source: 'inferred', evidence: 'archetype default' });
    expect(DASHBOARD_STYLES).toContain(top(brief)[0]!.styleId);
  });
});

describe('pageRole inference', () => {
  const roleOf = (productDescription: string) => normalizeContext({ productDescription }, repo).pageRole?.value;

  it('reads Korean and Japanese page names', () => {
    expect(roleOf('회의록 요약 SaaS의 마케팅 랜딩 페이지')).toBe('marketing-landing');
    expect(roleOf('会議要約SaaSのランディングページ')).toBe('marketing-landing');
    expect(roleOf('쇼핑몰 운영팀이 매일 보는 매출 분석 대시보드')).toBe('dashboard');
    expect(roleOf('협업 도구 Planloop의 계정 설정 화면')).toBe('settings');
    expect(roleOf("오픈소스 HTTP 클라이언트 'fetchkit'의 문서 사이트")).toBe('docs');
  });

  it('prefers the most specific page name and ignores feature words', () => {
    expect(roleOf('App landing page for a habit tracker')).toBe('app-promo');
    expect(roleOf('Sales dashboard with a settings panel and pricing tiers for admins')).toBe('dashboard');
    expect(roleOf('A team chat product')).toBeUndefined();
  });

  it('lets an explicit role win over the description', () => {
    expect(normalizeContext({ productDescription: 'Marketing landing page', pageRole: 'pricing' }, repo).pageRole)
      .toEqual({ value: 'pricing', source: 'explicit' });
  });

  it('reports the resolved role with the other normalized facets', () => {
    const result = recommendDesignDirection(LANDING_R1, repo);
    expect(JSON.stringify(result)).toContain('pageRole: marketing-landing (inferred)');
  });
});

describe('page role profiles', () => {
  it('define valid defaults and at least one alias for every role', () => {
    expect(Object.keys(PAGE_ROLE_PROFILES).sort()).toEqual([...PAGE_ROLES].sort());
    for (const role of PAGE_ROLES) {
      const profile = PAGE_ROLE_PROFILES[role];
      expect(DENSITY_LEVELS, role).toContain(profile.density);
      expect(USAGE_FREQUENCIES, role).toContain(profile.usageFrequency);
      if (profile.productType) expect(PRODUCT_TYPES, role).toContain(profile.productType);
      expect(profile.aliases.length, role).toBeGreaterThan(0);
    }
  });
});
