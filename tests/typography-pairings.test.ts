// Plan PR 3 (2026-11-25 design-quality plan, 4.2 and 8): in the 0.16.0 runs, 15 of the 26 sessions that called the
// server never received a font, and only 4 of those loaded a web font. The pairings give every style two or more
// alternatives with Korean and Japanese faces and paste-ready loading code. Every stylesheet URL the pairings produce
// returned HTTP 200 with @font-face rules from Google Fonts and jsDelivr on 2026-11-25.
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { createWebStylebookServer } from '../src/server.js';
import { PAGE_ROLES } from '../src/recommendation/page-roles.js';
import { PRODUCT_TYPES } from '../src/types.js';
import { FONT_LICENSES, FONT_SCRIPT_COVERAGE } from '../src/visual-canonical/fontSources.js';
import { TYPE_PAIRINGS, type FontRef } from '../src/typography/pairings.js';
import { TYPE_PAIRINGS_URI, catalogFonts, firstFamily, loadingCode, roleFonts, stylesheets } from '../src/typography/loading.js';

const repo = CatalogRepository.load();
const catalog = catalogFonts(repo);
const MIN_PER_STYLE = 2;
const FREE_LICENSES = ['OFL-1.1', 'Apache-2.0'];

const allFonts = (): Array<[string, FontRef]> => TYPE_PAIRINGS.flatMap((p) => [
  [`${p.id} display`, p.display], [`${p.id} body`, p.body], ...(p.mono ? [[`${p.id} mono`, p.mono] as [string, FontRef]] : []),
  ...(['ko', 'ja'] as const).flatMap((locale) => [
    ...(p.locales[locale].display ? [[`${p.id} ${locale} display`, p.locales[locale].display!] as [string, FontRef]] : []),
    [`${p.id} ${locale} body`, p.locales[locale].body] as [string, FontRef],
  ]),
]);

let client: Client;
beforeAll(async () => {
  const server = createWebStylebookServer(repo);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'typography-pairings-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});
const read = async (uri: string) => JSON.parse((await client.readResource({ uri })).contents[0]!.text as string);

describe('type pairing data', () => {
  it('uses only families with a verified free licence', () => {
    for (const [where, font] of allFonts()) {
      expect(FONT_LICENSES[font.family], `${where}: ${font.family}`).toBeDefined();
      expect(FREE_LICENSES, `${where}: ${font.family}`).toContain(FONT_LICENSES[font.family]!.license);
    }
  });

  it('uses only families and weights a visual contract already loads', () => {
    for (const [where, font] of allFonts()) {
      const loaded = catalog.get(font.family);
      expect(loaded, `${where}: ${font.family} is not loaded by any visual contract`).toBeDefined();
      expect(font.weights.length, where).toBeGreaterThan(0);
      expect([...font.weights], where).toEqual([...new Set(font.weights)].sort((a, b) => a - b));
      for (const weight of font.weights) expect([...loaded!.weights], `${where}: ${font.family} ${weight}`).toContain(weight);
    }
  });

  it(`gives every catalog style at least ${MIN_PER_STYLE} alternatives that differ from its authored fonts`, () => {
    const styleIds = repo.allStyles().map((style) => style.id);
    expect(styleIds).toHaveLength(48);
    for (const pairing of TYPE_PAIRINGS) for (const id of pairing.styleIds) expect(styleIds, `${pairing.id} lists ${id}`).toContain(id);
    for (const id of styleIds) {
      const pairings = TYPE_PAIRINGS.filter((pairing) => pairing.styleIds.includes(id));
      expect(pairings.length, id).toBeGreaterThanOrEqual(MIN_PER_STYLE);
      const roles = repo.visualContracts.authored(id).typography.roles;
      const own = `${firstFamily(roles.display.fontFamily)} / ${firstFamily(roles.body.fontFamily)}`;
      for (const pairing of pairings) expect(`${pairing.display.family} / ${pairing.body.family}`, `${pairing.id} for ${id}`).not.toBe(own);
    }
  });

  it('sets Korean and Japanese headings and text with a face that covers the script', () => {
    const script = { ko: 'hangul', ja: 'japanese' } as const;
    for (const pairing of TYPE_PAIRINGS) {
      for (const locale of ['ko', 'ja'] as const) {
        const roles = roleFonts(pairing, locale);
        for (const role of ['display', 'body'] as const) {
          const covered = roles[role].some((font) => FONT_SCRIPT_COVERAGE[font.family]?.includes(script[locale]));
          expect(covered, `${pairing.id} ${locale} ${role}`).toBe(true);
        }
      }
    }
  });

  it('keeps its own fields consistent', () => {
    const ids = TYPE_PAIRINGS.map((pairing) => pairing.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pairing of TYPE_PAIRINGS) {
      expect(pairing.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(pairing.axis === 'single-family', pairing.id).toBe(pairing.display.family === pairing.body.family);
      if (pairing.mono) expect([...catalog.get(pairing.mono.family)!.fallbacks], pairing.id).toEqual(['ui-monospace, monospace']);
      expect(pairing.pageRoles.length, pairing.id).toBeGreaterThan(0);
      for (const role of pairing.pageRoles) expect(PAGE_ROLES, pairing.id).toContain(role);
      for (const type of pairing.productTypes) expect(PRODUCT_TYPES, pairing.id).toContain(type);
      for (const text of [pairing.why, pairing.avoid]) for (const lang of ['en', 'ko', 'ja'] as const) expect(text[lang].trim(), `${pairing.id} ${lang}`).not.toBe('');
    }
    for (const role of PAGE_ROLES) expect(TYPE_PAIRINGS.some((pairing) => pairing.pageRoles.includes(role)), role).toBe(true);
  });

  it('has one generic fallback for every Latin face it leads a stack with', () => {
    for (const pairing of TYPE_PAIRINGS) {
      for (const font of [pairing.display, pairing.body, ...(pairing.mono ? [pairing.mono] : [])]) {
        expect(catalog.get(font.family)!.fallbacks.size, `${pairing.id}: ${font.family}`).toBe(1);
      }
    }
  });
});

describe('type pairing loading code', () => {
  it('builds one Google Fonts request with display=swap, and a pinned link for Pretendard', () => {
    expect(stylesheets([{ family: 'Newsreader', weights: [500, 600] }, { family: 'Instrument Sans', weights: [400, 500, 600] }]))
      .toEqual(['https://fonts.googleapis.com/css2?family=Newsreader:wght@500;600&family=Instrument+Sans:wght@400;500;600&display=swap']);
    expect(stylesheets([{ family: 'Anton', weights: [400] }, { family: 'Inter', weights: [600] }, { family: 'Inter', weights: [400] }]))
      .toEqual(['https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600&display=swap']);
    expect(stylesheets([{ family: 'Pretendard Variable', weights: [400, 700] }]))
      .toEqual(['https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css']);
  });

  it('puts the Latin face first and the Korean face second in each stack', () => {
    const pairing = TYPE_PAIRINGS.find((entry) => entry.id === 'condensed-caps-text')!;
    const code = loadingCode(pairing, 'ko', catalog);
    expect(code.css).toBe(":root {\n  --font-display: 'Anton', 'Black Han Sans', system-ui, sans-serif;\n  --font-body: 'Golos Text', 'Pretendard Variable', system-ui, sans-serif;\n}");
    expect(code.head.split('\n')).toEqual([
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Black+Han+Sans&family=Golos+Text:wght@400;500&display=swap">',
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css">',
    ]);
    expect(code.budget).toEqual({ stylesheets: 2, faces: 6 });
    expect(loadingCode(pairing, 'en', catalog).css).not.toMatch(/Black Han Sans|Pretendard/);
  });

  it('keeps code in its mono without a Korean or Japanese face', () => {
    const pairing = TYPE_PAIRINGS.find((entry) => entry.id === 'literary-single-serif')!;
    expect(loadingCode(pairing, 'ja', catalog).css).toContain("--font-mono: 'IBM Plex Mono', ui-monospace, monospace;");
  });
});

describe('type pairing resources', () => {
  it('lists the collection and the per-style template', async () => {
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toContain(TYPE_PAIRINGS_URI);
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((template) => template.uriTemplate)).toContain(`${TYPE_PAIRINGS_URI}/{styleId}`);
    const manifest = await read('webstylebook://manifest');
    expect(manifest.resourceUriTemplates).toContain(`${TYPE_PAIRINGS_URI}/{id}`);
  });

  it('serves an English index of every pairing and each style', async () => {
    const body = await read(TYPE_PAIRINGS_URI);
    expect(body.schema).toBe('webstylebook.type-pairings.v1');
    expect(body.pairings).toHaveLength(TYPE_PAIRINGS.length);
    expect(Object.keys(body.styles)).toHaveLength(48);
    expect(body.styles['quiet-utility']).toEqual({ authored: { display: 'Inter', body: 'Inter' }, pairingIds: ['geist-system', 'friendly-geometric-ui'] });
    const first = body.pairings[0];
    expect(first.why).toBe(TYPE_PAIRINGS[0]!.why.en);
    expect(first.localeFonts).toBeUndefined();
    expect(first.loading).toBeUndefined();
    expect(body.licenses.Newsreader).toEqual(FONT_LICENSES.Newsreader);
  });

  it("serves one style's pairings with loading code for the requested language", async () => {
    const body = await read(`${TYPE_PAIRINGS_URI}/kinetic-pop?locale=ja`);
    expect(body).toMatchObject({ styleId: 'kinetic-pop', locale: 'ja', authored: { display: 'Bowlby One', body: 'Work Sans' } });
    expect(body.pairings.map((pairing: { id: string }) => pairing.id)).toEqual(['condensed-poster-sans', 'condensed-caps-text', 'heavy-poster-grotesk']);
    const caps = body.pairings[1];
    expect(caps.loading.css).toContain("--font-display: 'Anton', 'Dela Gothic One', system-ui, sans-serif;");
    expect(caps.loading.head).toContain('family=Dela+Gothic+One');
    expect(caps.localeFonts).toEqual(TYPE_PAIRINGS.find((pairing) => pairing.id === 'condensed-caps-text')!.locales.ja);
    expect(caps.why).toBe(TYPE_PAIRINGS.find((pairing) => pairing.id === 'condensed-caps-text')!.why.ja);
    expect(body.systemBody.stack).toContain('Hiragino Sans');
    expect(Object.keys(body.licenses)).toEqual(expect.arrayContaining(['Anton', 'Dela Gothic One', 'Noto Sans JP']));
    expect(Object.keys(body.licenses)).not.toContain('Black Han Sans');
  });

  it('returns an explicit error for an unknown style or query', async () => {
    expect((await read(`${TYPE_PAIRINGS_URI}/no-such-style`)).error).toMatch(/not found/);
    expect((await read(`${TYPE_PAIRINGS_URI}/kinetic-pop?locale=fr`)).error.code).toBe('INVALID_INPUT');
    expect((await read(`${TYPE_PAIRINGS_URI}/kinetic-pop?mode=dark`)).error.code).toBe('INVALID_INPUT');
  });
});
