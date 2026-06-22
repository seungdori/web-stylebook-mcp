// UI State Atlas planner — get_ui_state_plan (01 §8.6, 02 §12, 06).
// Pure selection over the catalog: required/recommended/domain-specific, category
// filter, criticalOnly, coverage groups, implementation order.

import type { StateRecipe, StateCategory, Lang } from '../types.js';
import { STATE_CATEGORIES } from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import { text, texts } from '../localization.js';

export interface GetUiStatePlanInput {
  surfaceId: string;
  productContext?: string;
  domainSignals?: string[];
  includeCategories?: StateCategory[];
  styleId?: string;
  criticalOnly?: boolean;
  locale?: Lang;
}

export interface StateSummary {
  id: string;
  category: StateCategory;
  criticality: string;
  name: string;
  trigger: string;
  userQuestion: string;
  mustShow: string[];
  mustPreserve: string[];
  primaryAction: string;
  mustNot: string[];
  accessibility: string[];
  motion: string[];
  resourceUri: string;
}

export interface UiStatePlan {
  surfaceId: string;
  required: StateSummary[];
  recommended: StateSummary[];
  domainSpecific: StateSummary[];
  coverageGroups: Array<{ category: string; stateIds: string[] }>;
  implementationOrder: string[];
  styleNote?: string;
  unresolvedQuestions: string[];
}

// 03 §12 implementation priority by category.
const CATEGORY_ORDER: StateCategory[] = ['data', 'content', 'interaction', 'network', 'permission', 'time', 'environment'];

function summarize(r: StateRecipe, locale: Lang): StateSummary {
  const acc: string[] = [];
  if (r.accessibility.announcement) acc.push(text(r.accessibility.announcement, locale));
  if (r.accessibility.focus) acc.push(text(r.accessibility.focus, locale));
  if (r.accessibility.keyboard) acc.push(...texts(r.accessibility.keyboard, locale));
  return {
    id: r.id,
    category: r.category,
    criticality: r.criticality,
    name: text(r.name, locale),
    trigger: r.triggers[0] ? text(r.triggers[0], locale) : '',
    userQuestion: r.userQuestions[0] ? text(r.userQuestions[0], locale) : '',
    mustShow: texts(r.mustShow, locale),
    mustPreserve: texts(r.mustPreserve, locale),
    primaryAction: r.primaryActions[0] ? text(r.primaryActions[0], locale) : '',
    mustNot: texts(r.mustNot, locale),
    accessibility: acc,
    motion: texts(r.motion.guidance, locale),
    resourceUri: `webstylebook://states/${r.surfaceIds[0] ?? ''}/${r.id}`,
  };
}

export function planUiStates(input: GetUiStatePlanInput, repo: CatalogRepository): UiStatePlan {
  const locale = input.locale ?? 'en';
  const surface = repo.getSurface(input.surfaceId);
  if (!surface) throw new StatePlanError(`unknown surface '${input.surfaceId}'`);

  const include = input.includeCategories && input.includeCategories.length
    ? new Set<StateCategory>(input.includeCategories) : null;

  let recipes = repo.recipesForSurface(input.surfaceId);
  if (include) recipes = recipes.filter((r) => include.has(r.category));
  if (input.criticalOnly) recipes = recipes.filter((r) => r.criticality === 'required');

  // stable canonical order (category priority, then id) so output never depends on catalog
  // array order — same rule as implementationOrder (round 4 order-independence).
  const canon = (a: StateSummary, b: StateSummary) =>
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || (a.id < b.id ? -1 : 1);
  const byCrit = (c: StateRecipe['criticality']) =>
    recipes.filter((r) => r.criticality === c).map((r) => summarize(r, locale)).sort(canon);

  const required = byCrit('required');
  const recommended = byCrit('recommended');
  const domainSpecific = byCrit('domain-specific');

  // coverage groups by category; stateIds sorted by id for order-independence
  const coverageGroups = STATE_CATEGORIES
    .map((cat) => ({ category: cat, stateIds: recipes.filter((r) => r.category === cat).map((r) => r.id).sort() }))
    .filter((g) => g.stateIds.length > 0);

  const implementationOrder = [...required, ...recommended, ...domainSpecific].map((s) => s.id);

  const style = input.styleId ? repo.getStyle(input.styleId) : undefined;
  const styleNote = style
    ? `Apply ${style.id} presentation: ${style.recommendationFacets.risks.length ? `watch ${style.recommendationFacets.risks[0]}; ` : ''}keep state changes legible, not decorative.`
    : undefined;

  const unresolvedQuestions: string[] = [];
  const signals = (input.domainSignals ?? []).concat(input.productContext ? [input.productContext] : []);
  const sigText = signals.join(' ').toLowerCase();
  if (/live|stream|realtime|real-time/.test(sigText) && input.surfaceId === 'data-table') {
    unresolvedQuestions.push('Does the source stream live, requiring a reconnecting/stale state?');
  }
  if (!signals.length && domainSpecific.length === 0) {
    unresolvedQuestions.push('No domain signals provided and no domain-specific states matched — consider whether this surface needs custom states.');
  }

  return {
    surfaceId: input.surfaceId,
    required,
    recommended,
    domainSpecific,
    coverageGroups,
    implementationOrder,
    ...(styleNote ? { styleNote } : {}),
    unresolvedQuestions,
  };
}

export class StatePlanError extends Error {}
