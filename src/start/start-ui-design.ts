import type { CatalogRepository } from '../catalog/repository.js';
import type { Lang, ProductType } from '../types.js';
import { text } from '../localization.js';
import { recommendDesignDirection } from '../recommendation/index.js';
import { normalizeContext } from '../recommendation/normalize-context.js';
import { PAGE_ROLE_PROFILES, type PageRole } from '../recommendation/page-roles.js';
import type { ProductContext, ResolvedContext } from '../recommendation/types.js';
import { styleStructure } from '../structure/guidance.js';
import { productMustHaves } from '../structure/must-haves.js';
import { FONT_SCRIPT_COVERAGE } from '../visual-canonical/fontSources.js';
import { TYPE_PAIRINGS } from '../typography/pairings.js';
import { PRECONNECT, TYPE_PAIRINGS_URI, catalogFonts, firstFamily, loadingCode } from '../typography/loading.js';
import { NEW_UI_WORKFLOW_URI } from '../server-info.js';
import { copyBrief } from './copy-brief.js';
import { PHOTO_PLANS, PHOTO_RULES, SOFTWARE_PRODUCT_TYPES } from './photos.js';

/**
 * The entry tool for a new page or screen (2026-11-25 design-quality plan, 3.3 and 8). In the 0.16.0 runs, 7 of the
 * 26 sessions that called the server stopped after recommend_design_direction and 15 never received a font, a photo
 * plan or any copy guidance. One call now returns the direction, the chosen style's structure, fonts with loading
 * code, the photo plan, a copy brief and the next calls, within START_UI_DESIGN_BUDGET_BYTES.
 */
export const START_UI_DESIGN_SCHEMA = 'webstylebook.start-ui-design.v1';
/** The whole tool result (text and structuredContent) stays under this; scripts/benchmark-visual.mjs checks it. */
export const START_UI_DESIGN_BUDGET_BYTES = 16 * 1024;
const DIRECTIONS = 3;
const ALTERNATIVE_FONTS = 2;

export interface StartUiDesignInput extends ProductContext {
  /** Build with this style instead of the top-ranked one. */
  styleId?: string;
}

export class StartUiDesignError extends Error {
  constructor(readonly kind: 'NO_COMPATIBLE_STYLE' | 'STYLE_NOT_FOUND', message: string, readonly rejectedCount = 0) {
    super(message);
  }
}

/** The product type whose main page this page is, or none when the product's must-haves describe another page. */
function pageProductType(ctx: ResolvedContext): ProductType | undefined {
  const role = ctx.pageRole?.value;
  if (!role) return ctx.productType.value;
  const own = PAGE_ROLE_PROFILES[role].productType;
  if (own) return own;
  return role === 'dashboard' || role === 'data-table' ? ctx.productType.value : undefined;
}

function authoredFonts(repo: CatalogRepository, styleId: string, locale: Lang) {
  const { roles, fonts } = repo.visualContracts.authored(styleId).typography;
  const stacks = { display: roles.display.fontFamily, body: roles.body.fontFamily, mono: roles.data.fontFamily };
  const script = locale === 'ko' ? 'hangul' : locale === 'ja' ? 'japanese' : undefined;
  const wanted = new Set<string>();
  for (const stack of Object.values(stacks)) {
    const families = stack.split(',').map((entry) => firstFamily(entry));
    wanted.add(families[0]!);
    const local = script ? families.find((family) => FONT_SCRIPT_COVERAGE[family]?.includes(script)) : undefined;
    if (local) wanted.add(local);
  }
  const urls = [...new Set(fonts.filter((font) => font.source === 'external' && wanted.has(font.family) && font.stylesheetUrl).map((font) => font.stylesheetUrl!))];
  return {
    display: firstFamily(stacks.display),
    body: firstFamily(stacks.body),
    head: urls.map((url) => `<link rel="stylesheet" href="${url}">`).join('\n'),
    css: `:root {\n${Object.entries(stacks).map(([role, stack]) => `  --font-${role}: ${stack};`).join('\n')}\n}`,
  };
}

function fontAlternatives(repo: CatalogRepository, styleId: string, ctx: ResolvedContext, locale: Lang) {
  const role = ctx.pageRole?.value;
  const rank = (pairing: (typeof TYPE_PAIRINGS)[number]) =>
    (role && pairing.pageRoles.includes(role) ? 2 : 0) + (pairing.productTypes.includes(ctx.productType.value) ? 1 : 0);
  const catalog = catalogFonts(repo);
  return TYPE_PAIRINGS
    .filter((pairing) => pairing.styleIds.includes(styleId))
    .map((pairing, order) => ({ pairing, order, score: rank(pairing) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, ALTERNATIVE_FONTS)
    .map(({ pairing }) => {
      const { head, css } = loadingCode(pairing, locale, catalog);
      return { id: pairing.id, axis: pairing.axis, why: pairing.why[locale], head: head.split('\n').filter((line) => !PRECONNECT.includes(line)).join('\n'), css };
    });
}

function fontsBlock(repo: CatalogRepository, styleId: string, ctx: ResolvedContext, locale: Lang) {
  const authored = authoredFonts(repo, styleId, locale);
  const alternatives = fontAlternatives(repo, styleId, ctx, locale);
  const google = [authored.head, ...alternatives.map((alt) => alt.head)].some((head) => head.includes('https://fonts.googleapis.com/'));
  return {
    ...(google ? { preconnect: PRECONNECT.join('\n') } : {}),
    authored,
    alternatives,
    pairingsUri: `${TYPE_PAIRINGS_URI}/${styleId}?locale=${locale}`,
  };
}

function photoPlan(role: PageRole | undefined, productType: ProductType, locale: Lang) {
  const base = role ? PHOTO_PLANS[role] : undefined;
  if (!base) {
    return { use: false, reason: text({ en: 'No page role was given or found in the description; pass pageRole to get a photo plan.', ko: '페이지 역할이 없고 설명에서도 찾지 못했습니다. 사진 계획을 받으려면 pageRole을 주세요.', ja: 'ページの役割が指定されず、説明からも見つかりませんでした。写真の計画を受け取るには pageRole を指定してください。' }, locale) };
  }
  if (role === 'product-detail' && SOFTWARE_PRODUCT_TYPES.has(productType)) {
    return { use: false, reason: text({ en: 'A software product page shows the product screen, not a photo.', ko: '소프트웨어 제품 페이지는 사진 대신 제품 화면을 보여 줍니다.', ja: 'ソフトウェアの製品ページでは、写真ではなく製品の画面を見せます。' }, locale) };
  }
  if (!base.use) return { use: false, reason: base.reason[locale] };
  return {
    use: true,
    reason: base.reason[locale],
    slots: base.slots.map((slot) => ({
      slot: slot.slot, subject: slot.subject[locale], avoid: slot.avoid[locale], orientation: slot.orientation,
      minWidth: slot.minWidth, ...(slot.query ? { query: slot.query } : {}), crop: slot.crop, alt: slot.alt[locale], own: slot.own,
    })),
    ...PHOTO_RULES,
  };
}

export function startUiDesign(input: StartUiDesignInput, repo: CatalogRepository) {
  const locale: Lang = input.locale ?? 'en';
  const { styleId: requested, ...context } = input;
  const ctx = normalizeContext(context, repo);
  const recommendation = recommendDesignDirection({ ...context, candidateLimit: DIRECTIONS }, repo);
  if (requested !== undefined && !repo.getStyle(requested)) throw new StartUiDesignError('STYLE_NOT_FOUND', `unknown style '${requested}'`);
  if (!recommendation.candidates.length && requested === undefined) {
    throw new StartUiDesignError('NO_COMPATIBLE_STYLE', 'No style satisfies all the hard constraints (every candidate was rejected).', recommendation.rejected.length);
  }
  const styleId = requested ?? recommendation.candidates[0]!.styleId;
  const style = repo.getStyle(styleId)!;
  const structure = styleStructure(styleId, repo, locale);
  const role = ctx.pageRole?.value;
  const pageType = pageProductType(ctx);
  const mustHaves = pageType ? productMustHaves(pageType, pageType === ctx.productType.value ? ctx.productType.source : 'inferred', locale) : undefined;
  const auditType = mustHaves?.items.length ? pageType : undefined;

  return {
    schema: START_UI_DESIGN_SCHEMA,
    locale,
    page: {
      pageRole: ctx.pageRole ? { value: ctx.pageRole.value, source: ctx.pageRole.source } : null,
      productType: { value: ctx.productType.value, source: ctx.productType.source },
      density: ctx.density.value,
      usageFrequency: ctx.usageFrequency.value,
      assumptions: ctx.assumptions,
    },
    directions: recommendation.candidates.map((candidate) => ({
      styleId: candidate.styleId,
      name: text(repo.getStyle(candidate.styleId)!.name, locale),
      score: candidate.score,
    })),
    confidence: recommendation.confidence,
    tiedTop: recommendation.ranking?.tied ?? false,
    style: {
      styleId,
      name: text(style.name, locale),
      chosen: requested === undefined ? 'top-ranked' : 'requested',
      resourceUri: `webstylebook://styles/${styleId}${locale === 'en' ? '' : `?locale=${locale}`}`,
      hero: structure.archetype.hero,
      sectionOrder: structure.archetype.sectionOrder,
      signatureMoves: structure.signatureMoves.map((move) => ({ name: move.name, purpose: move.purpose })),
      avoid: structure.bannedPatterns.style.map((ban) => ban.name),
    },
    ...(mustHaves?.items.length ? {
      mustHaves: { productType: mustHaves.productType, page: mustHaves.page, items: mustHaves.items.map((item) => ({ name: item.name, zone: item.zone })) },
    } : {}),
    fonts: fontsBlock(repo, styleId, ctx, locale),
    photos: photoPlan(role, ctx.productType.value, locale),
    copy: copyBrief([ctx.productType.value, ...(pageType && pageType !== ctx.productType.value ? [pageType] : [])], role, locale),
    next: [
      { tool: 'compose_design_tokens', arguments: { primaryStyleId: styleId, contract: { schema: 'webstylebook.visual.v1' }, locale }, when: 'before writing CSS: colors, type scale, spacing' },
      { resource: `webstylebook://styles/${styleId}${locale === 'en' ? '' : `?locale=${locale}`}`, when: 'build steps of the moves and ban criteria' },
      { tool: 'get_ui_state_plan', arguments: { surfaceId: '<a webstylebook://states/surfaces id>', styleId, locale }, when: 'for each surface that loads data or takes input' },
      { tool: 'audit_page_structure', arguments: { html: '<rendered HTML>', css: ['<page CSS>'], styleId, ...(auditType ? { productType: auditType } : {}), locale }, when: 'after building' },
      { tool: 'audit_copy', arguments: { html: '<rendered HTML>', locale, productType: ctx.productType.value }, when: 'check the page text before finishing' },
      { tool: 'get_design_audit_plan', when: 'then validate_design_audit_result with real evidence' },
      { resource: NEW_UI_WORKFLOW_URI, when: 'full workflow; recommend_design_direction compares more directions' },
    ],
  };
}

export type StartUiDesignResult = ReturnType<typeof startUiDesign>;

const fence = (lang: string, body: string) => (body ? `\`\`\`${lang}\n${body}\n\`\`\`` : '');

/**
 * The text fallback for clients that read only content. Claude Code is reported to pass structuredContent to the model
 * instead of the text when both are present, so the full brief lives there; this keeps what a text-only client needs to
 * start (font code, photo slots, the copy watch list, the next calls) and points to the rest.
 */
export function renderStartUiDesign(result: StartUiDesignResult): string {
  const { page, style, fonts, photos, copy } = result;
  const lines: string[] = [
    `# Start: ${style.name} (${style.styleId}) · ${page.pageRole?.value ?? 'page role unknown'} · ${page.productType.value}`,
    `Directions: ${result.directions.map((d, i) => `${i + 1}. ${d.styleId} ${d.score.toFixed(2)}`).join(' · ')} (confidence ${result.confidence}${result.tiedTop ? ', top tied' : ''}). Full brief: structuredContent; structure: ${style.resourceUri}`,
    `Sections: ${style.sectionOrder.map((section, i) => `${i + 1}. ${section}`).join(' ')}`,
    `Moves: ${style.signatureMoves.map((move) => move.name).join('; ')}${style.avoid.length ? `. Avoid: ${style.avoid.join('; ')}` : ''}`,
    ...(result.mustHaves ? [`Must-haves (${result.mustHaves.productType}): ${result.mustHaves.items.map((item) => `${item.name} [${item.zone}]`).join(', ')}`] : []),
    `Fonts: ${fonts.authored.display} / ${fonts.authored.body}; alternatives ${fonts.alternatives.map((alt) => alt.id).join(', ')} in ${fonts.pairingsUri}`,
    fence('html', [fonts.preconnect ?? '', fonts.authored.head].filter(Boolean).join('\n')), fence('css', fonts.authored.css),
    `Photos: ${photos.use ? 'yes' : 'no'}. ${photos.reason}`,
  ];
  if (photos.use && 'slots' in photos) {
    for (const slot of photos.slots) lines.push(`- ${slot.slot}${slot.own ? ' (own photo)' : ''}: ${slot.subject}${slot.query ? ` Search: "${slot.query.unsplash}"` : ''}`);
    lines.push(photos.credit);
  }
  if (copy.voice) lines.push(`Copy voice (${copy.voice.register ?? copy.voice.person}, ≤${copy.voice.maxWords} words): ${copy.voice.tone} Button: "${copy.voice.cta}".`);
  lines.push(`Buttons: ${copy.rules.button}`, ...copy.watch.map((entry) => `- Watch ${entry.id}${'verdict' in entry ? ' (fix-now)' : ''}: "${entry.flagged}"`));
  lines.push('Next:', ...result.next.map((step, i) => `${i + 1}. ${'tool' in step ? `${step.tool}${step.arguments ? ` ${JSON.stringify(step.arguments)}` : ''}` : `read ${step.resource}`}`));
  return lines.filter(Boolean).join('\n');
}
