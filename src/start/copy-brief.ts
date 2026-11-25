import type { Lang, ProductType } from '../types.js';
import type { PageRole } from '../recommendation/page-roles.js';
import { COPY_PATTERNS, type CopyPattern } from '../copy/lexicon.js';
import { VOICE_PROFILES } from '../copy/voice.js';
import { COPY_PATTERNS_URI, COPY_RULES } from '../copy/guide.js';

/**
 * The copy part of start_ui_design (2026-11-25 design-quality plan, 6.4): the product's voice, the button, empty-state
 * and error rules, and the five patterns to watch on this kind of page. A topic is a pattern id without its language
 * prefix, so one list serves English, Korean and Japanese. The order follows how often each pattern was found on that
 * page type in the 2026-11-25 runs (PR #50), then how much harm it does there.
 */
export const COPY_TOPICS_BY_PAGE: Readonly<Record<PageRole | 'unknown', readonly string[]>> = {
  'marketing-landing': ['social-proof-count', 'setup-minutes', 'stop-doing-closer', 'generic-cta', 'team-size-pricing', 'percent-outcome', 'buzzwords', 'new-eyebrow'],
  'app-promo': ['generic-cta', 'new-eyebrow', 'setup-minutes', 'social-proof-count', 'buzzwords', 'mixed-register'],
  'product-detail': ['percent-outcome', 'buzzwords', 'generic-cta', 'social-proof-count', 'em-dash-density'],
  pricing: ['team-size-pricing', 'generic-cta', 'mixed-register', 'social-proof-count', 'percent-outcome', 'one-place'],
  signup: ['social-proof-count', 'generic-cta', 'mixed-register', 'setup-minutes', 'one-place'],
  dashboard: ['generic-cta', 'one-place', 'mixed-register', 'percent-outcome', 'em-dash-density'],
  'data-table': ['generic-cta', 'one-place', 'mixed-register', 'em-dash-density', 'percent-outcome'],
  settings: ['one-place', 'generic-cta', 'mixed-register', 'em-dash-density', 'new-eyebrow'],
  docs: ['one-place', 'setup-minutes', 'em-dash-density', 'mixed-register', 'generic-cta'],
  'blog-article': ['em-dash-density', 'social-proof-count', 'percent-outcome', 'mixed-register', 'buzzwords'],
  portfolio: ['percent-outcome', 'em-dash-density', 'buzzwords', 'mixed-register', 'generic-cta'],
  'restaurant-local': ['generic-cta', 'buzzwords', 'em-dash-density', 'mixed-register', 'one-place', 'new-eyebrow'],
  unknown: ['social-proof-count', 'percent-outcome', 'generic-cta', 'one-place', 'em-dash-density'],
};
const WATCH = 5;

/** The pattern for a topic in this language: "<locale>-<topic>", or a pattern shared by every language. */
export function patternForTopic(topic: string, locale: Lang): CopyPattern | undefined {
  return COPY_PATTERNS.find((entry) => entry.id === `${locale}-${topic}`)
    ?? COPY_PATTERNS.find((entry) => entry.id === topic && entry.locales.includes(locale));
}

export function copyBrief(productTypes: readonly ProductType[], pageRole: PageRole | undefined, locale: Lang) {
  const voice = productTypes.map((type) => VOICE_PROFILES.find((profile) => profile.productType === type)).find(Boolean);
  // The page list first, then the general one, so every language gets five even where a topic has no pattern.
  const topics = [...new Set([...COPY_TOPICS_BY_PAGE[pageRole ?? 'unknown'], ...COPY_TOPICS_BY_PAGE.unknown])];
  const watch = topics
    .map((topic) => patternForTopic(topic, locale))
    .filter((entry): entry is CopyPattern => entry !== undefined)
    .slice(0, WATCH)
    .map((entry) => ({ id: entry.id, ...(entry.verdict === 'fix-now' ? { verdict: entry.verdict } : {}), flagged: entry.example.flagged, instead: entry.instead }));
  return {
    ...(voice ? {
      voice: {
        productType: voice.productType,
        ...(locale === 'ko' ? { register: voice.koRegister } : {}),
        person: voice.person, maxWords: voice.maxWords, tone: voice.tone[locale], cta: voice.cta[locale],
      },
      examples: { hero: voice.sample.hero[locale], empty: voice.sample.empty[locale] },
    } : {}),
    rules: { button: COPY_RULES.button[locale], empty: COPY_RULES.empty[locale], error: COPY_RULES.error[locale] },
    watch,
    patternsUri: `${COPY_PATTERNS_URI}/${locale}`,
  };
}
