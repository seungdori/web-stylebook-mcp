/**
 * Static design evaluation of saved pages: audit_page_structure (with its asset checks) and audit_copy on each page,
 * plus a few page facts, as one scorecard. It reads files only: no model call, no network, no write to an input folder.
 *
 *   npm run eval:static                              # the repository fixtures (what CI runs)
 *   npm run eval:static -- --experiment <dir>        # a before/after experiment folder (runs/, prompts/), read-only
 *   npm run eval:static -- --experiment <dir> --arms A,B,C,D --compare A:C,B:C
 *                                                    # run folders <page>-<arm>[-r<n>]; arms default to off,on
 *   npm run eval:static -- --json                    # JSON instead of markdown on stdout
 *   npm run eval:static -- --out <dir>               # write scorecard.json and scorecard.md to <dir>
 *
 * The counts are flagged patterns, not a quality score: fewer means fewer flags, not a better page.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CatalogRepository } from '../src/catalog/repository.js';
import { auditCopy } from '../src/copy/audit.js';
import { auditPageStructure, PAGE_LIMITS } from '../src/structure/audit.js';
import { buildPage } from '../src/structure/dom/page.js';
import { textContent, type DomElement } from '../src/structure/dom/html.js';
import type { PageRole } from '../src/recommendation/page-roles.js';
import type { Lang, ProductType } from '../src/types.js';

export const STATIC_EVAL_SCHEMA = 'webstylebook.static-eval.v1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The pages of the 2026-11-25 before/after experiment (folder name <page>-<on|off>[-r<n>]), read from each prompt.
 * `structure` is the productType start_ui_design passes to audit_page_structure for that page role and product, and
 * is absent where it passes none; tests/static-eval.test.ts keeps the two in step.
 */
export const EXPERIMENT_PAGES: Readonly<Record<string, { pageRole: PageRole; productType: ProductType; structure?: ProductType }>> = {
  'admin-table': { pageRole: 'data-table', productType: 'operational-saas', structure: 'operational-saas' },
  'app-promo': { pageRole: 'app-promo', productType: 'consumer-app', structure: 'campaign' },
  blog: { pageRole: 'blog-article', productType: 'content-editorial', structure: 'content-editorial' },
  dashboard: { pageRole: 'dashboard', productType: 'data-analytics', structure: 'data-analytics' },
  docs: { pageRole: 'docs', productType: 'documentation', structure: 'documentation' },
  landing: { pageRole: 'marketing-landing', productType: 'operational-saas', structure: 'campaign' },
  portfolio: { pageRole: 'portfolio', productType: 'portfolio', structure: 'portfolio' },
  pricing: { pageRole: 'pricing', productType: 'developer-tool', structure: 'campaign' },
  product: { pageRole: 'product-detail', productType: 'commerce', structure: 'commerce' },
  restaurant: { pageRole: 'restaurant-local', productType: 'other' },
  settings: { pageRole: 'settings', productType: 'operational-saas' },
  signup: { pageRole: 'signup', productType: 'operational-saas' },
};

export interface PageInput {
  id: string;
  /** Where the page came from, relative to the corpus root. */
  source: string;
  html: string;
  css?: string[];
  locale: Lang;
  styleId?: string;
  pageRole?: PageRole;
  /** The product voice for audit_copy. */
  productType?: ProductType;
  /** The must-have list for audit_page_structure. */
  structureProductType?: ProductType;
  pair?: { page: string; arm: string; round: number };
  /** MCP tools the run called, in order, without the server prefix; absent when the run left no call log. */
  mcpCalls?: string[];
}

type Verdict = 'PASS' | 'FIX_NOW' | 'RISK' | 'NOT_APPLICABLE' | 'NOT_VERIFIED';

export interface PageScore {
  id: string;
  source: string;
  pair?: PageInput['pair'];
  input: { locale: Lang; styleId?: string; pageRole?: PageRole; productType?: ProductType; structureProductType?: ProductType };
  mcp?: {
    calls: number;
    tools: string[];
    /** The run called start_ui_design. */
    startUiDesign: boolean;
    /** The run called audit_page_structure or audit_copy after its first start_ui_design call. */
    auditAfterStart: boolean;
  };
  structure: {
    findings: number;
    /** Global page shapes: a task judgment is still needed. */
    shapes: number;
    /** Bans of the chosen style; only with a styleId. */
    styleBans: number;
    mustHavesMissing: string[];
    mustHavesMisplaced: string[];
    patterns: Record<string, number>;
  };
  copy: { findings: number; claims: number; observations: number; patterns: Record<string, number> };
  assets: Record<string, { verdict: Verdict; count: number }>;
  facts: {
    /** The first family of the body (else html) font, from font-family or the font shorthand. */
    firstFont: string | null;
    /** The first family of the first h1's font, inherited when the h1 sets none; the body font without an h1. */
    displayFont: string | null;
    /** How the page loads web fonts: Google Fonts, an @font-face rule, the Pretendard CDN, or another font stylesheet. */
    fontSources: Array<'google' | 'font-face' | 'pretendard' | 'other'>;
    /** <img> elements in the HTML as served; images a script creates later are not counted. */
    images: number;
    externalImageHosts: string[];
    /** The title and the body text contain 무료로 시작. */
    freeStart: boolean;
    /** Em dashes in the title and the body text. */
    emDashes: number;
  };
  /** Structure findings + copy findings + asset checks at FIX_NOW or RISK. */
  flags: number;
}

const ARM_FACTS = [
  'pages', 'pretendardVariableFirst', 'webFontLoaded', 'googleOrFontFace', 'externalImages', 'imagePages', 'freeStart', 'emDash', 'noMcpCall',
  'startUiDesign', 'auditAfterStart', 'stockPhotoPages', 'creditedStockPages',
] as const;
type ArmTotals = Record<(typeof ARM_FACTS)[number], number> & {
  structureFindings: number; shapes: number; mustHaveGaps: number; copyFindings: number; copyClaims: number; assetIssues: number; flags: number;
  /** Distinct display fonts over the arm's pages, and per round (each round is one run of every page). */
  displayFonts: number; displayFontsByRound: Record<string, number>;
};

export interface Scorecard {
  schema: typeof STATIC_EVAL_SCHEMA;
  corpus: string;
  pages: PageScore[];
  totals: Record<string, ArmTotals>;
  /** One entry per compared arm pair (`compare`) and page round: `from` is the first arm, `to` the second. */
  pairs: Array<{ page: string; round: number; arms: [string, string]; from: PairSide; to: PairSide }>;
  skipped: Array<{ source: string; reason: string }>;
}
type PairSide = { structure: number; mustHaveGaps: number; copy: number; assets: number; flags: number; displayFont: string | null; mcpCalls: number | null };

const langOf = (html: string): Lang => {
  const lang = /<html\b[^>]*\blang\s*=\s*["']?([a-z]{2})/i.exec(html)?.[1]?.toLowerCase();
  return lang === 'ko' || lang === 'ja' ? lang : 'en';
};
const unquote = (family: string) => family.trim().replace(/^["']|["']$/g, '').trim();
const FONT_SHEET = /fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|fonts\.cdnfonts\.com|pretendard|webfont|\/fonts?\//i;
const GOOGLE_SHEET = /fonts\.googleapis\.com|fonts\.bunny\.net/i;
/** The family part of the font shorthand: what follows the size and line height, after any style or numeric weight. */
const FONT_SIZE = String.raw`(?:[\d.]+(?:px|r?em|%|pt|pc|vw|vh|vmin|vmax|ch|ex|cm|mm|in|q)|(?:xx?-)?(?:small|large)|medium|smaller|larger|(?:calc|clamp|min|max)\([^)]*\))`;
const SHORTHAND = new RegExp(String.raw`(?:^|\s)${FONT_SIZE}(?:\s*\/\s*\S+)?\s+(.+)$`, 'i');
export const shorthandFamily = (value: string) => SHORTHAND.exec(value.trim())?.[1];
const sortedRecord = (entries: Iterable<[string, number]>) => Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));

/** First font, web font loading, images and two text facts, read the way the asset and copy checks read a page. */
function pageFacts(html: string, css: readonly string[]): PageScore['facts'] {
  const page = buildPage(html, css, { viewportWidth: 1440, viewportHeight: 900 }, PAGE_LIMITS.maxElements);
  const elements = page.html.elements;
  const body = elements.find((element) => element.tag === 'body');
  const root = elements.find((element) => element.tag === 'html');
  // The face an element is drawn in: its own font shorthand (the style engine does not expand it), else its font-family,
  // which the engine already inherits from ancestors; failing both, the same for its parent.
  const familyOf = (element: DomElement | null | undefined): string | null => {
    for (let node = element; node; node = node.parent) {
      const family = page.styles.get(node, 'font-family');
      const stack = shorthandFamily(page.styles.get(node, 'font') ?? '') ?? (family && !/^(?:inherit|initial|unset)$/i.test(family.trim()) ? family : undefined);
      if (stack) return unquote(stack.split(',')[0]!) || null;
    }
    return null;
  };
  const firstFont = familyOf(body ?? root);
  const h1 = elements.find((element) => element.tag === 'h1');
  const displayFont = h1 ? familyOf(h1) : firstFont;
  const sheets = [...css, ...page.html.styleSheets];
  const linked = elements.filter((element) => element.tag === 'link' && /\bstylesheet\b/i.test(element.attrs.get('rel') ?? ''))
    .map((element) => element.attrs.get('href') ?? '');
  const imported = sheets.flatMap((sheet) => [...sheet.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)/gi)].map((match) => match[1]!));
  const fontSheets = [...linked, ...imported].filter((url) => FONT_SHEET.test(url));
  const fontSources = [
    ...(fontSheets.some((url) => GOOGLE_SHEET.test(url)) ? ['google' as const] : []),
    ...(sheets.some((sheet) => /@font-face\s*{/i.test(sheet)) ? ['font-face' as const] : []),
    ...(fontSheets.some((url) => /pretendard/i.test(url)) ? ['pretendard' as const] : []),
    ...(fontSheets.some((url) => !GOOGLE_SHEET.test(url) && !/pretendard/i.test(url)) ? ['other' as const] : []),
  ];
  const images = elements.filter((element) => element.tag === 'img');
  const urls = [
    ...images.flatMap((image) => [image.attrs.get('src') ?? '', ...(image.attrs.get('srcset') ?? '').split(',').map((entry) => entry.trim().split(/\s+/)[0]!)]),
    ...sheets.flatMap((sheet) => [...sheet.matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)/gi)].map((match) => match[1]!)).filter((url) => !FONT_SHEET.test(url) && !/\.(?:woff2?|ttf|otf)\b/i.test(url)),
  ];
  const hosts = [...new Set(urls.map((url) => /^(?:https?:)?\/\/([^/?#]+)/i.exec(url.trim())?.[1]?.toLowerCase()).filter((host): host is string => !!host))].sort();
  const title = elements.find((element) => element.tag === 'title');
  const text = [title, body].map((element) => (element ? textContent(element) : '')).join(' ').replace(/\s+/g, ' ');
  return { firstFont, displayFont, fontSources, images: images.length, externalImageHosts: hosts, freeStart: text.includes('무료로 시작'), emDashes: (text.match(/—/g) ?? []).length };
}

function mcpOf(calls: readonly string[]): NonNullable<PageScore['mcp']> {
  const start = calls.indexOf('start_ui_design');
  return {
    calls: calls.length,
    tools: [...new Set(calls)],
    startUiDesign: start >= 0,
    auditAfterStart: start >= 0 && calls.slice(start + 1).some((tool) => tool === 'audit_page_structure' || tool === 'audit_copy'),
  };
}

export function scorePage(input: PageInput, repo: CatalogRepository): PageScore {
  const css = input.css ?? [];
  const structure = auditPageStructure({
    html: input.html, css, locale: input.locale, targetId: input.id,
    ...(input.styleId ? { styleId: input.styleId } : {}),
    ...(input.structureProductType ? { productType: input.structureProductType } : {}),
  }, repo);
  const copy = auditCopy({ html: input.html, css, locale: input.locale, targetId: input.id, ...(input.productType ? { productType: input.productType } : {}) }, repo);
  const mustHaves = structure.mustHaves;
  const assets = Object.fromEntries(structure.assets.checks.map((check) => [check.checkId, { verdict: check.verdict, count: check.count }]));
  const assetIssues = structure.assets.checks.filter((check) => check.verdict === 'FIX_NOW' || check.verdict === 'RISK').length;
  return {
    id: input.id,
    source: input.source,
    ...(input.pair ? { pair: input.pair } : {}),
    input: {
      locale: input.locale,
      ...(input.styleId ? { styleId: input.styleId } : {}),
      ...(input.pageRole ? { pageRole: input.pageRole } : {}),
      ...(input.productType ? { productType: input.productType } : {}),
      ...(input.structureProductType ? { structureProductType: input.structureProductType } : {}),
    },
    ...(input.mcpCalls ? { mcp: mcpOf(input.mcpCalls) } : {}),
    structure: {
      findings: structure.summary.findings,
      shapes: structure.summary.claims['shape-observation'],
      styleBans: structure.summary.claims['style-fidelity'],
      mustHavesMissing: mustHaves?.missing ?? [],
      mustHavesMisplaced: mustHaves?.misplaced ?? [],
      patterns: sortedRecord(structure.findings.map((finding) => [finding.patternId, finding.count])),
    },
    copy: {
      findings: copy.summary.findings,
      claims: copy.summary.fixNow,
      observations: copy.summary.observations,
      patterns: sortedRecord(copy.findings.map((finding) => [finding.patternId, finding.count])),
    },
    assets,
    facts: pageFacts(input.html, css),
    flags: structure.summary.findings + copy.summary.findings + assetIssues,
  };
}

function totalsOf(pages: readonly PageScore[]): ArmTotals {
  const count = (test: (page: PageScore) => boolean) => pages.filter(test).length;
  const sum = (value: (page: PageScore) => number) => pages.reduce((total, page) => total + value(page), 0);
  return {
    pages: pages.length,
    pretendardVariableFirst: count((page) => page.facts.firstFont === 'Pretendard Variable'),
    webFontLoaded: count((page) => page.facts.fontSources.length > 0),
    googleOrFontFace: count((page) => page.facts.fontSources.includes('google') || page.facts.fontSources.includes('font-face')),
    externalImages: count((page) => page.facts.externalImageHosts.length > 0),
    imagePages: count((page) => page.facts.images > 0),
    freeStart: count((page) => page.facts.freeStart),
    emDash: count((page) => page.facts.emDashes > 0),
    noMcpCall: count((page) => page.mcp?.calls === 0),
    startUiDesign: count((page) => page.mcp?.startUiDesign === true),
    auditAfterStart: count((page) => page.mcp?.auditAfterStart === true),
    stockPhotoPages: count((page) => !!page.assets['assets-image-credit'] && page.assets['assets-image-credit'].verdict !== 'NOT_APPLICABLE'),
    creditedStockPages: count((page) => page.assets['assets-image-credit']?.verdict === 'PASS'),
    structureFindings: sum((page) => page.structure.findings),
    shapes: sum((page) => page.structure.shapes),
    mustHaveGaps: sum((page) => page.structure.mustHavesMissing.length + page.structure.mustHavesMisplaced.length),
    copyFindings: sum((page) => page.copy.findings),
    copyClaims: sum((page) => page.copy.claims),
    assetIssues: sum((page) => Object.values(page.assets).filter((check) => check.verdict === 'FIX_NOW' || check.verdict === 'RISK').length),
    flags: sum((page) => page.flags),
    displayFonts: distinct(pages),
    displayFontsByRound: Object.fromEntries([...new Set(pages.flatMap((page) => (page.pair ? [page.pair.round] : [])))].sort()
      .map((round) => [`r${round}`, distinct(pages.filter((page) => page.pair?.round === round))])),
  };
}

const distinct = (pages: readonly PageScore[]) => new Set(pages.map((page) => page.facts.displayFont).filter((font) => font !== null)).size;

const side = (page: PageScore): PairSide => ({
  structure: page.structure.findings,
  mustHaveGaps: page.structure.mustHavesMissing.length + page.structure.mustHavesMisplaced.length,
  copy: page.copy.findings,
  assets: Object.values(page.assets).filter((check) => check.verdict === 'FIX_NOW' || check.verdict === 'RISK').length,
  flags: page.flags,
  displayFont: page.facts.displayFont,
  mcpCalls: page.mcp?.calls ?? null,
});

/** `arms` orders the totals (default: alphabetical); `compare` lists the arm pairs to set side by side (default: the two arms when there are two). */
export interface ScorecardOptions { arms?: readonly string[]; compare?: ReadonlyArray<readonly [string, string]> }

export function buildScorecard(corpus: string, inputs: readonly PageInput[], skipped: Scorecard['skipped'], repo: CatalogRepository, options: ScorecardOptions = {}): Scorecard {
  const pages = [...inputs].sort((a, b) => a.id.localeCompare(b.id)).map((input) => scorePage(input, repo));
  const arms = new Map<string, PageScore[]>();
  for (const page of pages) {
    const arm = page.pair?.arm ?? 'fixtures';
    arms.set(arm, [...(arms.get(arm) ?? []), page]);
  }
  const order = (arm: string) => (options.arms?.includes(arm) ? options.arms.indexOf(arm) : Number.MAX_SAFE_INTEGER);
  const armIds = [...arms.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  const compare = options.compare ?? (armIds.length === 2 && pages.some((page) => page.pair) ? [[armIds[0]!, armIds[1]!] as const] : []);
  const byKey = new Map(pages.filter((page) => page.pair).map((page) => [`${page.pair!.page}/${page.pair!.round}/${page.pair!.arm}`, page]));
  const pairs = compare.flatMap(([from, to]) => pages.filter((page) => page.pair?.arm === from).flatMap((first) => {
    const second = byKey.get(`${first.pair!.page}/${first.pair!.round}/${to}`);
    return second ? [{ page: first.pair!.page, round: first.pair!.round, arms: [from, to] as [string, string], from: side(first), to: side(second) }] : [];
  }));
  return {
    schema: STATIC_EVAL_SCHEMA,
    corpus,
    pages,
    totals: Object.fromEntries(armIds.map((arm) => [arm, totalsOf(arms.get(arm)!)])),
    pairs,
    skipped: [...skipped].sort((a, b) => a.source.localeCompare(b.source)),
  };
}

/** The repository fixtures: the structure cases, the experiment pages kept here, and the must-have pages. */
export function repositoryPages(root = ROOT): { inputs: PageInput[]; skipped: Scorecard['skipped'] } {
  const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
  const inputs: PageInput[] = [];
  const cases = JSON.parse(read('tests/fixtures/page-structure/cases.json')).cases as Array<{ file: string; styleId?: string; css?: string }>;
  for (const entry of cases) {
    const source = `tests/fixtures/page-structure/${entry.file}`;
    const html = read(source);
    inputs.push({
      id: `page-structure/${entry.file.replace(/\.html$/, '')}`, source, html, locale: langOf(html),
      ...(entry.css ? { css: [read(`tests/fixtures/page-structure/${entry.css}`)] } : {}),
      ...(entry.styleId ? { styleId: entry.styleId } : {}),
    });
  }
  const kept = 'tests/fixtures/page-structure/runs-2026-11-25';
  for (const file of readdirSync(join(root, kept)).filter((name) => name.endsWith('.html')).sort()) {
    const run = parseRunName(file.replace(/\.html$/, ''), DEFAULT_ARMS);
    const html = read(`${kept}/${file}`);
    inputs.push({ id: `runs-2026-11-25/${file.replace(/\.html$/, '')}`, source: `${kept}/${file}`, html, locale: langOf(html), ...(run ? contextOf(run.page) : {}) });
  }
  const mustHaves = 'tests/fixtures/must-haves';
  for (const file of readdirSync(join(root, mustHaves)).filter((name) => name.endsWith('.html')).sort()) {
    const productType = file.replace(/\.html$/, '').replace(/-(?:ko|ja|buy-button-only)$/, '') as ProductType;
    const html = read(`${mustHaves}/${file}`);
    inputs.push({ id: `must-haves/${file.replace(/\.html$/, '')}`, source: `${mustHaves}/${file}`, html, locale: langOf(html), productType, structureProductType: productType });
  }
  return { inputs, skipped: [] };
}

export const DEFAULT_ARMS = ['off', 'on'] as const;

/** `<page>-<arm>[-r<n>]` with an arm from `arms`; the page is lowercase words joined by hyphens. */
export function parseRunName(name: string, arms: readonly string[]): { page: string; arm: string; round: number } | null {
  const roundMatch = /-r(\d+)$/.exec(name);
  const base = roundMatch ? name.slice(0, roundMatch.index) : name;
  for (const arm of arms) {
    const page = base.endsWith(`-${arm}`) ? base.slice(0, -arm.length - 1) : '';
    if (/^[a-z]+(?:-[a-z]+)*$/.test(page)) return { page, arm, round: roundMatch ? Number(roundMatch[1]) : 1 };
  }
  return null;
}

function contextOf(page: string): Pick<PageInput, 'pageRole' | 'productType' | 'structureProductType'> {
  const known = EXPERIMENT_PAGES[page];
  return known ? { pageRole: known.pageRole, productType: known.productType, ...(known.structure ? { structureProductType: known.structure } : {}) } : {};
}

/** An experiment folder: runs/<page>-<arm>[-r<n>]/workspace/index.html and mcp-calls.jsonl. Read-only. */
export function experimentPages(dir: string, arms: readonly string[] = DEFAULT_ARMS): { inputs: PageInput[]; skipped: Scorecard['skipped'] } {
  const runs = join(dir, 'runs');
  if (!existsSync(runs)) throw new Error(`${dir} has no runs/ folder`);
  const inputs: PageInput[] = [];
  const skipped: Scorecard['skipped'] = [];
  for (const name of readdirSync(runs, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    const run = parseRunName(name, arms);
    const page = join(runs, name, 'workspace', 'index.html');
    if (!run) { skipped.push({ source: `runs/${name}`, reason: `name is not <page>-<${arms.join('|')}>[-r<n>]` }); continue; }
    if (!existsSync(page)) { skipped.push({ source: `runs/${name}`, reason: 'no workspace/index.html' }); continue; }
    const html = readFileSync(page, 'utf8');
    const calls = join(runs, name, 'mcp-calls.jsonl');
    const mcpCalls = existsSync(calls)
      ? readFileSync(calls, 'utf8').split('\n').filter((line) => line.trim()).map((line) => String(JSON.parse(line).tool ?? '').replace(/^mcp__[^_]+(?:_[^_]+)*?__/, ''))
      : undefined;
    inputs.push({
      id: name, source: `runs/${name}/workspace/index.html`, html, locale: langOf(html), pair: run, ...contextOf(run.page),
      ...(mcpCalls ? { mcpCalls } : {}),
    });
  }
  return { inputs, skipped };
}

const cell = (from: number | string | null, to: number | string | null) => {
  const show = (value: number | string | null) => (value === null ? '–' : String(value));
  return `${show(from)} → ${show(to)}`;
};

export function renderScorecard(card: Scorecard): string {
  const arms = Object.keys(card.totals);
  const lines = [
    `# Static design evaluation: ${card.corpus}`,
    '',
    'Flags from audit_page_structure (with its asset checks) and audit_copy on saved pages. They count patterns to look at, not page quality.',
    '',
    '## Totals',
    '',
    `| | ${arms.join(' | ')} |`,
    `|---|${arms.map(() => '---').join('|')}|`,
    ...([
      ['pages', 'pages'], ['first font is Pretendard Variable', 'pretendardVariableFirst'], ['web font loaded (any source)', 'webFontLoaded'],
      ['web font from Google Fonts or @font-face', 'googleOrFontFace'], ['external images', 'externalImages'], ['pages with <img> as served', 'imagePages'],
      ['title or text has 무료로 시작', 'freeStart'], ['title or text has an em dash', 'emDash'],
      ...(card.pages.some((page) => page.mcp) ? [
        ['runs with no MCP call', 'noMcpCall'], ['runs that called start_ui_design', 'startUiDesign'],
        ['… then audit_page_structure or audit_copy', 'auditAfterStart'],
      ] as const : []),
      ['pages with stock photos', 'stockPhotoPages'], ['… all credited', 'creditedStockPages'],
      ['structure findings', 'structureFindings'], ['… generic page shapes', 'shapes'], ['must-have gaps', 'mustHaveGaps'], ['copy findings', 'copyFindings'],
      ['copy claims (FIX_NOW)', 'copyClaims'], ['asset checks at FIX_NOW or RISK', 'assetIssues'], ['all flags', 'flags'],
      ['distinct display fonts', 'displayFonts'],
    ] as const).map(([label, key]) => `| ${label} | ${arms.map((arm) => card.totals[arm]![key]).join(' | ')} |`),
    ...[...new Set(arms.flatMap((arm) => Object.keys(card.totals[arm]!.displayFontsByRound)))].sort()
      .map((round) => `| … in ${round} | ${arms.map((arm) => card.totals[arm]!.displayFontsByRound[round] ?? '–').join(' | ')} |`),
  ];
  if (card.pairs.length) {
    for (const [from, to] of [...new Set(card.pairs.map((pair) => pair.arms.join('\u0000')))].map((key) => key.split('\u0000'))) {
      lines.push('', `## Pairs (${from} → ${to})`, '', '| page | structure | must-have gaps | copy | assets | all flags | display font | MCP calls |', '|---|---|---|---|---|---|---|---|');
      for (const pair of card.pairs.filter((entry) => entry.arms[0] === from && entry.arms[1] === to)) {
        lines.push(`| ${pair.page} r${pair.round} | ${cell(pair.from.structure, pair.to.structure)} | ${cell(pair.from.mustHaveGaps, pair.to.mustHaveGaps)} | ${cell(pair.from.copy, pair.to.copy)} | ${cell(pair.from.assets, pair.to.assets)} | ${cell(pair.from.flags, pair.to.flags)} | ${cell(pair.from.displayFont, pair.to.displayFont)} | ${cell(pair.from.mcpCalls, pair.to.mcpCalls)} |`);
      }
    }
  } else {
    lines.push('', '## Pages', '', '| page | structure | must-have gaps | copy | assets | all flags |', '|---|---|---|---|---|---|');
    for (const page of card.pages) {
      const assets = Object.values(page.assets).filter((check) => check.verdict === 'FIX_NOW' || check.verdict === 'RISK').length;
      lines.push(`| ${page.id} | ${page.structure.findings} | ${page.structure.mustHavesMissing.length + page.structure.mustHavesMisplaced.length} | ${page.copy.findings} | ${assets} | ${page.flags} |`);
    }
  }
  if (card.skipped.length) lines.push('', `Skipped: ${card.skipped.map((entry) => `${entry.source} (${entry.reason})`).join('; ')}`);
  return `${lines.join('\n')}\n`;
}

const inside = (path: string, folder: string) => {
  const rel = relative(folder, path);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[a-z]:/i.test(rel));
};
/** The real path, resolved through the nearest folder that exists, so a symlinked parent (macOS /tmp) compares equal. */
function real(path: string): string {
  const missing: string[] = [];
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    missing.unshift(current.slice(parent.length).replace(/^[\\/]+/, ''));
    current = parent;
  }
  return join(existsSync(current) ? realpathSync(current) : current, ...missing);
}

/** Writes the scorecard; refuses a folder inside the experiment, whose files must stay as they are. */
export function writeScorecard(card: Scorecard, out: string, experiment?: string): string[] {
  const target = real(out);
  if (experiment && (inside(target, real(experiment)) || inside(real(experiment), target))) {
    throw new Error(`--out ${out} is inside or contains the experiment folder; write the scorecard elsewhere`);
  }
  mkdirSync(target, { recursive: true });
  const files = [join(target, 'scorecard.json'), join(target, 'scorecard.md')];
  writeFileSync(files[0]!, `${JSON.stringify(card, null, 2)}\n`);
  writeFileSync(files[1]!, renderScorecard(card));
  return files;
}

type Args = { experiment?: string; out?: string; json: boolean; arms?: string[]; compare?: Array<[string, string]> };

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--json') { args.json = true; continue; }
    const value = argv[++i];
    if (!['--experiment', '--out', '--arms', '--compare'].includes(arg)) throw new Error(`unknown argument ${arg}; use --experiment <dir>, --out <dir>, --arms <a,b,...>, --compare <a:b,...> or --json`);
    if (!value) throw new Error(`${arg} needs a value`);
    if (arg === '--experiment') args.experiment = value;
    else if (arg === '--out') args.out = value;
    else if (arg === '--arms') args.arms = value.split(',').map((arm) => arm.trim()).filter(Boolean);
    else {
      args.compare = value.split(',').map((pair) => {
        const [from, to] = pair.split(':').map((arm) => arm.trim());
        if (!from || !to) throw new Error(`--compare takes from:to pairs, got ${pair}`);
        return [from, to] as [string, string];
      });
    }
  }
  const arms = args.arms ?? [...DEFAULT_ARMS];
  for (const [from, to] of args.compare ?? []) {
    if (!arms.includes(from) || !arms.includes(to)) throw new Error(`--compare ${from}:${to} names an arm outside ${arms.join(',')}`);
  }
  return args;
}

const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (invokedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const repo = CatalogRepository.load();
    const { inputs, skipped } = args.experiment ? experimentPages(args.experiment, args.arms) : repositoryPages();
    const card = buildScorecard(args.experiment ? `experiment ${args.experiment.replace(/\/+$/, '').split(/[\\/]/).pop()}` : 'repository fixtures', inputs, skipped, repo,
      { ...(args.arms ? { arms: args.arms } : {}), ...(args.compare ? { compare: args.compare } : {}) });
    if (args.out) process.stderr.write(`wrote ${writeScorecard(card, args.out, args.experiment).join(', ')}\n`);
    process.stdout.write(args.json ? `${JSON.stringify(card, null, 2)}\n` : renderScorecard(card));
  } catch (error) {
    process.stderr.write(`eval:static: ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
