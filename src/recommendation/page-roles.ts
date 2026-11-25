import type { Density, ProductType, UsageFrequency } from '../types.js';

/**
 * What the page or screen being built does, separate from what the product is. A marketing landing page for an
 * operational SaaS product is read once by a prospective buyer, not all day by an operator, so the product type alone
 * set the wrong density and usage (2026-11-25 design-quality plan, 5.1).
 */
export const PAGE_ROLES = [
  'marketing-landing', 'app-promo', 'product-detail', 'pricing', 'signup', 'dashboard',
  'data-table', 'settings', 'docs', 'blog-article', 'portfolio', 'restaurant-local',
] as const;
export type PageRole = (typeof PAGE_ROLES)[number];

export interface PageRoleProfile {
  /** Used when the caller states no density. */
  density: Density;
  /** Used when the caller states no usage frequency. */
  usageFrequency: UsageFrequency;
  /** The product type whose job this page does, when it is not the product's own, e.g. a landing page does a campaign's. */
  productType?: Exclude<ProductType, 'other'>;
  /**
   * Phrases that name the page in a brief (en/ko/ja). Single words that also describe a product feature ("settings",
   * "pricing") are left out, so a dashboard brief that lists a settings panel is not read as a settings page.
   */
  aliases: readonly string[];
}

export const PAGE_ROLE_PROFILES: Readonly<Record<PageRole, PageRoleProfile>> = {
  'marketing-landing': {
    density: 'low', usageFrequency: 'one-off', productType: 'campaign',
    aliases: ['landing page', 'marketing page', 'marketing site', 'marketing website', '랜딩 페이지', '랜딩페이지', '마케팅 페이지', 'ランディングページ'],
  },
  'app-promo': {
    density: 'low', usageFrequency: 'one-off', productType: 'campaign',
    aliases: ['app landing page', 'app promo page', 'app download page', 'app marketing page', '앱 소개 페이지', '앱 홍보 페이지', 'アプリ紹介ページ'],
  },
  'product-detail': {
    density: 'medium', usageFrequency: 'occasional', productType: 'commerce',
    aliases: ['product detail page', 'product page', 'pdp', '상품 상세 페이지', '상품 상세', '商品詳細ページ', '商品詳細'],
  },
  pricing: {
    density: 'medium', usageFrequency: 'occasional', productType: 'campaign',
    aliases: ['pricing page', '가격 페이지', '요금제 페이지', '料金ページ'],
  },
  signup: {
    density: 'low', usageFrequency: 'one-off',
    aliases: ['signup page', 'sign-up page', 'sign up page', 'registration page', '회원가입 페이지', '회원가입 화면', '가입 페이지', '登録ページ', '会員登録'],
  },
  dashboard: {
    density: 'high', usageFrequency: 'daily',
    aliases: ['dashboard', '대시보드', 'ダッシュボード'],
  },
  'data-table': {
    density: 'high', usageFrequency: 'daily',
    aliases: ['data table page', 'admin table', 'data grid', '데이터 표 화면', '관리자 목록 화면', 'データテーブル'],
  },
  settings: {
    density: 'medium', usageFrequency: 'occasional',
    aliases: ['settings page', 'settings screen', 'account settings', '설정 화면', '설정 페이지', '계정 설정', '設定画面', 'アカウント設定'],
  },
  docs: {
    density: 'medium', usageFrequency: 'occasional', productType: 'documentation',
    aliases: ['docs page', 'documentation page', 'documentation site', 'docs site', 'getting started page', '문서 사이트', '문서 페이지', 'ドキュメントサイト', 'ドキュメントページ'],
  },
  'blog-article': {
    density: 'low', usageFrequency: 'occasional', productType: 'content-editorial',
    aliases: ['blog post', 'blog article', 'article page', '블로그 글', '블로그 게시물', '기사 페이지', 'ブログ記事'],
  },
  portfolio: {
    density: 'low', usageFrequency: 'one-off', productType: 'portfolio',
    aliases: ['portfolio site', 'portfolio page', 'portfolio website', '포트폴리오 사이트', '포트폴리오 페이지', 'ポートフォリオサイト'],
  },
  'restaurant-local': {
    density: 'low', usageFrequency: 'occasional',
    aliases: ['restaurant website', 'restaurant site', 'restaurant page', 'cafe website', '레스토랑 웹사이트', '식당 홈페이지', '레스토랑 홈페이지', 'レストランのサイト'],
  },
};
