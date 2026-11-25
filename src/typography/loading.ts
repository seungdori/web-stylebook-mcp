import type { CatalogRepository } from '../catalog/repository.js';
import type { Lang } from '../types.js';
import { CDN_FONT_STYLESHEETS, FONT_LICENSES } from '../visual-canonical/fontSources.js';
import { TYPE_PAIRINGS, type FontRef, type TypePairing } from './pairings.js';

export const TYPE_PAIRINGS_SCHEMA = 'webstylebook.type-pairings.v1';
export const TYPE_PAIRINGS_URI = 'webstylebook://typography/pairings';
const GOOGLE_CSS2 = 'https://fonts.googleapis.com/css2';
export const PRECONNECT = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
];

export interface CatalogFont { weights: ReadonlySet<number>; fallbacks: ReadonlySet<string> }

/** Every externally loaded family in the authored visual contracts, with the weights and generic fallbacks they use. */
export function catalogFonts(repo: CatalogRepository): ReadonlyMap<string, CatalogFont> {
  const fonts = new Map<string, { weights: Set<number>; fallbacks: Set<string> }>();
  for (const style of repo.allStyles()) {
    for (const font of repo.visualContracts.authored(style.id).typography.fonts) {
      if (font.source !== 'external') continue;
      const entry = fonts.get(font.family) ?? { weights: new Set<number>(), fallbacks: new Set<string>() };
      for (const weight of font.weights) entry.weights.add(weight);
      entry.fallbacks.add(font.fallback);
      fonts.set(font.family, entry);
    }
  }
  return fonts;
}

/** The first family of an authored CSS font stack, without quotes. */
export function firstFamily(stack: string): string {
  return (stack.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

/** The faces for each role on a page in this locale: the Latin face first, then the Korean or Japanese face. */
export function roleFonts(pairing: TypePairing, locale: Lang): { display: FontRef[]; body: FontRef[]; mono: FontRef[] } {
  const extra = locale === 'en' ? undefined : pairing.locales[locale];
  return {
    display: [pairing.display, ...(extra ? [extra.display ?? extra.body] : [])],
    body: [pairing.body, ...(extra ? [extra.body] : [])],
    // Code keeps its mono; Korean and Japanese characters in code fall back to the system face.
    mono: pairing.mono ? [pairing.mono] : [],
  };
}

/** One Google Fonts CSS2 request for every Google family, then one link per pinned CDN stylesheet. */
export function stylesheets(fonts: readonly FontRef[]): string[] {
  const google = new Map<string, Set<number>>();
  const cdn = new Set<string>();
  for (const font of fonts) {
    const pinned = CDN_FONT_STYLESHEETS[font.family];
    if (pinned) { cdn.add(pinned); continue; }
    const weights = google.get(font.family) ?? new Set<number>();
    for (const weight of font.weights) weights.add(weight);
    google.set(font.family, weights);
  }
  const families = [...google].map(([family, set]) => {
    const weights = [...set].sort((a, b) => a - b);
    const name = family.replace(/ /g, '+');
    // A single regular weight needs no axis, the way the contracts request single-weight families such as Anton.
    return weights.length === 1 && weights[0] === 400 ? `family=${name}` : `family=${name}:wght@${weights.join(';')}`;
  });
  return [...(families.length ? [`${GOOGLE_CSS2}?${families.join('&')}&display=swap`] : []), ...cdn];
}

function stack(fonts: readonly FontRef[], catalog: ReadonlyMap<string, CatalogFont>): string {
  const families = [...new Set(fonts.map((font) => font.family))];
  const generic = [...(catalog.get(families[0]!)?.fallbacks ?? [])][0];
  if (!generic) throw new Error(`type pairing font '${families[0]}' is not loaded by any visual contract`);
  return [...families.map((family) => `'${family}'`), generic].join(', ');
}

/** Paste-ready <link> tags and CSS custom properties for one pairing on a page in this locale. */
export function loadingCode(pairing: TypePairing, locale: Lang, catalog: ReadonlyMap<string, CatalogFont>) {
  const roles = roleFonts(pairing, locale);
  const fonts = [...roles.display, ...roles.body, ...roles.mono];
  const sheets = stylesheets(fonts);
  const stacks = Object.entries(roles).filter(([, list]) => list.length).map(([role, list]) => `  --font-${role}: ${stack(list, catalog)};`);
  return {
    head: [...(sheets[0]?.startsWith(GOOGLE_CSS2) ? PRECONNECT : []), ...sheets.map((url) => `<link rel="stylesheet" href="${url}">`)].join('\n'),
    css: `:root {\n${stacks.join('\n')}\n}`,
    budget: { stylesheets: sheets.length, faces: new Set(fonts.flatMap((font) => font.weights.map((weight) => `${font.family}:${weight}`))).size },
  };
}

// styleIds is served once, as the styles index of the collection.
function localized(pairing: TypePairing, locale: Lang) {
  const { locales, why, avoid, styleIds: _styleIds, ...rest } = pairing;
  return { ...rest, ...(locale === 'en' ? {} : { localeFonts: locales[locale] }), why: why[locale], avoid: avoid[locale] };
}

function licenses(pairings: readonly TypePairing[], locale: Lang) {
  const families = [...new Set(pairings.flatMap((pairing) => Object.values(roleFonts(pairing, locale)).flat().map((font) => font.family)))].sort();
  return Object.fromEntries(families.map((family) => {
    const license = FONT_LICENSES[family];
    if (!license) throw new Error(`type pairing font '${family}' has no verified licence in FONT_LICENSES`);
    return [family, license];
  }));
}

function authored(repo: CatalogRepository, styleId: string) {
  const roles = repo.visualContracts.authored(styleId).typography.roles;
  return { display: firstFamily(roles.display.fontFamily), body: firstFamily(roles.body.fontFamily) };
}

const NOTES = {
  default: "Each style's authored fonts (compose_design_tokens with contract, visualContract.typography.fonts) stay the default. These pairings are alternatives when the product or page needs another voice; keep the style's sizes, spacing and colors.",
  rights: 'No font file is bundled. Each family keeps its own licence, listed in licenses.',
};
const LOADING_NOTES = {
  loading: 'Paste loading.head into <head> and loading.css before your styles; every stylesheet uses font-display: swap.',
  budget: "budget.faces counts the family and weight combinations requested. Google serves a variable family's weights from one file, and Korean and Japanese faces download only the unicode-range slices for the characters a page shows.",
  production: "The Google Fonts stylesheet sends each visitor's IP address to Google. For production, self-host the same families and weights, for example with Fontsource packages (@fontsource/<family-id>).",
};
const SYSTEM_BODY: Readonly<Record<Exclude<Lang, 'en'>, { note: string; stack: string }>> = {
  ko: { note: 'For long Korean body text you can leave the body to the system face and load web fonts for headings only.', stack: "'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif" },
  ja: { note: 'For long Japanese body text you can leave the body to the system face and load web fonts for headings only.', stack: "'Hiragino Sans', 'Yu Gothic', Meiryo, system-ui, sans-serif" },
};

/** webstylebook://typography/pairings: an English index of every pairing, and each style's authored fonts and pairing ids. */
export function typePairingsResource(repo: CatalogRepository) {
  return {
    schema: TYPE_PAIRINGS_SCHEMA,
    notes: { ...NOTES, detail: `${TYPE_PAIRINGS_URI}/{styleId}?locale=en|ko|ja returns one style's pairings with their Korean or Japanese faces, paste-ready <link> tags and CSS font stacks.` },
    styles: Object.fromEntries(repo.allStyles().map((style) => [style.id, {
      authored: authored(repo, style.id),
      pairingIds: TYPE_PAIRINGS.filter((pairing) => pairing.styleIds.includes(style.id)).map((pairing) => pairing.id),
    }])),
    pairings: TYPE_PAIRINGS.map((pairing) => localized(pairing, 'en')),
    licenses: licenses(TYPE_PAIRINGS, 'en'),
  };
}

/** webstylebook://typography/pairings/{styleId}: one style's authored fonts and its pairings with loading code. */
export function styleTypePairings(repo: CatalogRepository, styleId: string, locale: Lang) {
  const catalog = catalogFonts(repo);
  const pairings = TYPE_PAIRINGS.filter((pairing) => pairing.styleIds.includes(styleId));
  return {
    schema: TYPE_PAIRINGS_SCHEMA,
    styleId,
    locale,
    authored: authored(repo, styleId),
    notes: { ...NOTES, ...LOADING_NOTES },
    ...(locale === 'en' ? {} : { systemBody: SYSTEM_BODY[locale] }),
    pairings: pairings.map((pairing) => ({ ...localized(pairing, locale), loading: loadingCode(pairing, locale, catalog) })),
    licenses: licenses(pairings, locale),
  };
}
