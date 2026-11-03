// Issue #24: the token compiler (no contract) measured 8-digit accents with their alpha dropped and
// emitted '#'-less hex as-is. These checks recompute every ratio independently of src/ (CSS Color 4
// hex, source-over on the returned canvas, WCAG luminance) and compare it with what the tool returns.
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { composeDesignTokens, type ComposeDesignTokensInput, type TokenFormat } from '../src/tokens/compile.js';
import { checkContrast, contrastRatio, normalizeHexColor, parseHex } from '../src/tokens/contrast.js';
import type { DesignTokenColor, DesignTokens } from '../src/types.js';

const repo = CatalogRepository.load();
const contract = { schema: 'webstylebook.visual.v1' };

interface Rgba { r: number; g: number; b: number; a: number }
function rgba(hex: string): Rgba {
  const raw = hex.replace(/^#/, '');
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
  const at = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return { r: at(0), g: at(2), b: at(4), a: full.length === 8 ? at(6) / 255 : 1 };
}
const over = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1,
});
const luminance = ({ r, g, b }: Rgba) => {
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return lin(r) * 0.2126 + lin(g) * 0.7152 + lin(b) * 0.0722;
};
const ratio = (x: Rgba, y: Rgba) => {
  const a = luminance(x); const b = luminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const hex = ({ r, g, b }: Rgba) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
const WHITE = rgba('#ffffff');
const BLACK = rgba('#000000');

type Request = Partial<Omit<ComposeDesignTokensInput, 'format'>>;
const compose = (input: Request & { format?: TokenFormat }) =>
  composeDesignTokens({ primaryStyleId: 'runtime-signal', format: 'json', ...input }, repo);
const designMd = (input: Request) => composeDesignTokens({ primaryStyleId: 'runtime-signal', ...input, format: 'design-md' }, repo);
const FORMATS = ['json', 'css-variables', 'tailwind', 'typescript', 'design-md'] as const;
const run = (format: (typeof FORMATS)[number], input: Request) => (format === 'design-md' ? designMd(input) : compose({ ...input, format }));
const CSS_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

describe('#24 — the reported cases', () => {
  it('#00000033 is not judged as opaque black: no 21:1, and the text color is chosen on the canvas', () => {
    const result = compose({ format: 'css-variables', colorMode: 'light', accentOverride: '#00000033' });
    const c = (result.tokens as DesignTokens).color;
    expect(c.canvas).toBe('#fcfbf9');
    expect(c.accent).toBe('#00000033'); // alpha is kept: the design intent is not rewritten
    expect(contrastRatio('#ffffff', '#00000033')).toBeNull(); // unknown backdrop: no number, not 21
    expect(contrastRatio(c.accentText, c.accent)).toBeNull();
    expect(contrastRatio('#ffffff', c.accent, c.canvas)).toBeCloseTo(1.6584076429866101, 12); // the issue's figure
    expect(c.accentText).toBe('#000000');
    const shown = over(rgba(c.accent), rgba(c.canvas));
    expect(contrastRatio(c.accentText, c.accent, c.canvas)).toBeCloseTo(ratio(BLACK, shown), 12);
    expect(ratio(BLACK, shown)).toBeGreaterThan(4.5);
    expect(result.warnings.some((w) => w.startsWith('accent text'))).toBe(false);
    expect(result.warnings).toContain('accent on canvas (light) contrast 1.6:1 is below WCAG AA 3:1 — verify or adjust.');
    const review = result.warnings.find((w) => w.startsWith('accent (light)'));
    expect(review).toBe('accent (light) #00000033 is not opaque (alpha 20%): its contrast is measured as painted on canvas #fcfbf9, where it shows as #cac9c7; on any other backdrop it is unknown — requires rendered contrast review.');
  });

  it('#00000000 is fully transparent, not black: white text is not picked, and the invisible focus ring is repaired', () => {
    const result = compose({ colorMode: 'light', accentOverride: '#00000000' });
    const c = (result.tokens as DesignTokens).color;
    expect(c.accent).toBe('#00000000');
    expect(c.accentText).not.toBe('#ffffff');
    expect(c.accentText).toBe('#000000');
    expect(result.warnings).toContain('accent on canvas (light) contrast 1:1 is below WCAG AA 3:1 — verify or adjust.');
    expect(c.focus).not.toBe(c.accent);
    expect(ratio(over(rgba(c.focus), rgba(c.canvas)), rgba(c.canvas))).toBeGreaterThanOrEqual(3);
    expect(result.warnings.some((w) => w.includes('requires rendered contrast review'))).toBe(true);
  });

  it('bare hex is emitted as a CSS hex color in every format', () => {
    for (const format of FORMATS) {
      const result = run(format, { colorMode: 'light', accentOverride: '000000' });
      const text = 'rendered' in result ? result.rendered : result.content;
      expect(text, format).not.toMatch(/(?:--color-accent: |"accent": |accent: )"?000000/);
      if (format === 'css-variables') expect(text).toContain('--color-accent: #000000;');
      else if (format === 'design-md') expect(text).toContain('accent: "#000000"');
      else expect(text, format).toContain('"accent": "#000000"');
    }
  });
});

describe('#24 — one normalized color for input, math and every output', () => {
  it('normalizeHexColor adds a missing # and changes nothing else; unsupported forms are null', () => {
    expect(normalizeHexColor('000000')).toBe('#000000');
    expect(normalizeHexColor('abc')).toBe('#abc');
    expect(normalizeHexColor('ABCDEF80')).toBe('#ABCDEF80');
    expect(normalizeHexColor('#ABC')).toBe('#ABC');
    expect(normalizeHexColor('#00000033')).toBe('#00000033');
    for (const bad of ['', '#', '##abc', '#0008', '0008', '#12345', '#1234567', '#000000zz', 'ggg', 'red', ' #abc', '#abc ', 'rgb(0,0,0)']) {
      expect(normalizeHexColor(bad), bad).toBeNull();
    }
  });

  it('parseHex keeps the 8-digit alpha for 3/6/8 digits in either case', () => {
    expect(parseHex('#00000033')).toEqual({ r: 0, g: 0, b: 0, a: 0.2 });
    expect(parseHex('00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
    expect(parseHex('#FF0066FF')).toEqual({ r: 255, g: 0, b: 102, a: 1 });
    expect(parseHex('#ff0066ff')).toEqual(parseHex('#FF0066FF'));
    expect(parseHex('ABC')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseHex('#0008')).toBeNull();
  });

  it('a bare hex request returns the same tokens, output and warnings as the # form (3/6/8 digits, any case, light/dark/both)', () => {
    for (const bare of ['000000', 'abc', 'ABCDEF', '00000033', 'ffffff80', 'FF006600']) {
      for (const colorMode of ['light', 'dark', 'both'] as const) {
        for (const format of FORMATS) {
          // sourceHash fingerprints the request text itself, so it is the one field allowed to differ
          const { sourceHash: _a, ...withHash } = run(format, { colorMode, accentOverride: `#${bare}` }) as unknown as Record<string, unknown>;
          const { sourceHash: _b, ...withoutHash } = run(format, { colorMode, accentOverride: bare }) as unknown as Record<string, unknown>;
          expect(withoutHash, `${bare} ${colorMode} ${format}`).toEqual(withHash);
        }
      }
    }
  });

  it('every --color-* value in css-variables output is a valid CSS hex color, for every style and accepted input form', () => {
    const bad: string[] = [];
    for (const style of repo.allStyles()) {
      for (const accentOverride of ['000000', '#000000', 'abc', '#ABC', '00000033', '#00000033', '#FFFFFF80', 'ff006600']) {
        for (const colorMode of ['light', 'dark', 'both'] as const) {
          const css = compose({ primaryStyleId: style.id, format: 'css-variables', colorMode, accentOverride }).rendered;
          for (const [, name, value] of css.matchAll(/--(color-[\w-]+): ([^;]*);/g)) {
            if (!CSS_HEX.test(value!)) bad.push(`${style.id} ${accentOverride} ${colorMode} ${name}: ${value}`);
          }
        }
      }
    }
    expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
  });

  it('CSS, JSON, TypeScript, Tailwind and DESIGN.md carry the same accent and accentText', () => {
    for (const accentOverride of ['00000033', '#FFFFFF80', 'abc']) {
      for (const colorMode of ['light', 'dark'] as const) {
        const json = compose({ format: 'json', colorMode, accentOverride });
        const c = (json.tokens as DesignTokens).color;
        expect(c.accent).toBe(normalizeHexColor(accentOverride));
        const css = compose({ format: 'css-variables', colorMode, accentOverride });
        expect(css.rendered).toContain(`--color-accent: ${c.accent};`);
        expect(css.rendered).toContain(`--color-accentText: ${c.accentText};`);
        for (const format of ['typescript', 'tailwind'] as const) {
          const out = compose({ format, colorMode, accentOverride });
          expect(out.rendered).toContain(`"accent": "${c.accent}"`);
          expect(out.rendered).toContain(`"accentText": "${c.accentText}"`);
          expect(out.warnings).toEqual(json.warnings);
        }
        const md = designMd({ colorMode, accentOverride });
        expect(md.content).toContain(`  accent: "${c.accent}"`);
        expect(md.content).toContain(`  on-accent: "${c.accentText}"`);
        expect(md.warnings).toEqual(json.warnings);
      }
    }
  });
});

describe('#24 — accentText, warnings and the canvas use one compositing rule', () => {
  const accents = [
    '#00000033', '#00000000', '#00000080', '#000000ff', '#000000fe',
    '#FFFFFF33', '#ffffff80', '#ffffff00', '#FF006680', '#ff0066ff', '#74C2B4CC',
    '#0f0', '#ABCDEF', '00000033', 'fff',
  ];

  it('the known backdrop (the returned canvas) decides accentText, every accent warning, and the review flag — light and dark', () => {
    for (const primaryStyleId of ['runtime-signal', 'quiet-utility', 'brutalist-grid']) {
      for (const colorMode of ['light', 'dark'] as const) {
        for (const accentOverride of accents) {
          const at = `${primaryStyleId} ${colorMode} ${accentOverride}`;
          const result = compose({ primaryStyleId, colorMode, accentOverride });
          const c = (result.tokens as DesignTokens).color;
          const has = (prefix: string) => result.warnings.find((w) => w.startsWith(prefix));
          expect(c.accent, at).toBe(normalizeHexColor(accentOverride));

          const canvas = rgba(c.canvas);
          const accent = rgba(c.accent);
          const shown = over(accent, canvas);
          const onWhite = ratio(WHITE, shown); const onBlack = ratio(BLACK, shown);
          expect(c.accentText, at).toBe(onWhite >= onBlack ? '#ffffff' : '#000000');
          const textRatio = Math.max(onWhite, onBlack);
          expect(contrastRatio(c.accentText, c.accent, c.canvas), at).toBeCloseTo(textRatio, 12);
          expect(!!has(`accent text (${colorMode})`), at).toBe(textRatio < 4.5);

          const onCanvas = ratio(shown, canvas);
          const accentWarning = has(`accent on canvas (${colorMode})`);
          expect(!!accentWarning, at).toBe(onCanvas < 3);
          if (accentWarning) expect(accentWarning, at).toContain(`contrast ${Math.round(onCanvas * 100) / 100}:1`);

          const focusRatio = ratio(over(rgba(c.focus), canvas), canvas);
          expect(!!has(`focus ring (${colorMode})`), at).toBe(focusRatio < 3);

          const review = has(`accent (${colorMode})`);
          expect(!!review, at).toBe(accent.a < 1);
          if (review) {
            expect(review, at).toContain(`canvas ${c.canvas}, where it shows as ${hex(shown)}`);
            expect(review, at).toContain('requires rendered contrast review');
          }
        }
      }
    }
  });

  it('colorMode both measures each mode on its own canvas', () => {
    const result = compose({ colorMode: 'both', accentOverride: '#00000033' });
    const tokens = result.tokens as { light: DesignTokens; dark: DesignTokens };
    for (const mode of ['light', 'dark'] as const) {
      const c: DesignTokenColor = tokens[mode].color;
      const shown = over(rgba(c.accent), rgba(c.canvas));
      expect(c.accentText, mode).toBe(ratio(WHITE, shown) >= ratio(BLACK, shown) ? '#ffffff' : '#000000');
      expect(result.warnings.some((w) => w.startsWith(`accent (${mode}) #00000033 is not opaque`) && w.includes(`canvas ${c.canvas}`)), mode).toBe(true);
    }
    expect(tokens.light.color.accentText).toBe('#000000');
  });

  it('alpha ff is opaque and changes nothing but the accent string; alpha fe is already translucent', () => {
    for (const primaryStyleId of ['runtime-signal', 'quiet-utility']) {
      for (const colorMode of ['light', 'dark'] as const) {
        const six = compose({ primaryStyleId, colorMode, accentOverride: '#ff0066' });
        const eight = compose({ primaryStyleId, colorMode, accentOverride: '#FF0066FF' });
        const { accent: a6, focus: f6, ...rest6 } = (six.tokens as DesignTokens).color;
        const { accent: a8, focus: f8, ...rest8 } = (eight.tokens as DesignTokens).color;
        expect([a6, a8]).toEqual(['#ff0066', '#FF0066FF']);
        expect(rest8).toEqual(rest6);
        expect(f8 === a8 ? a6 : f8).toBe(f6); // focus keeps the accent string only when it is the accent itself
        expect(eight.warnings).toEqual(six.warnings);
        expect(eight.notes).toEqual(six.notes);
        const fe = compose({ primaryStyleId, colorMode, accentOverride: '#ff0066fe' });
        expect(fe.warnings.some((w) => w.startsWith(`accent (${colorMode}) #ff0066fe is not opaque (alpha 99.6%)`))).toBe(true);
      }
    }
  });
});

describe('#24 — contrast math: opaque colors and thresholds unchanged', () => {
  it('opaque pairs measure as before; a translucent background needs an opaque backdrop', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#ffffff', '#000000ff')).toBe(contrastRatio('#ffffff', '#000000'));
    expect(contrastRatio('#74c2b4', '#fcfbf9', '#000000')).toBe(contrastRatio('#74c2b4', '#fcfbf9')); // backdrop is unused for an opaque background
    expect(contrastRatio('nope', '#ffffff')).toBe(0); // unparseable stays 0, as before
    expect(contrastRatio('#00000080', '#ffffff')).toBeCloseTo(ratio(over(rgba('#00000080'), WHITE), WHITE), 12); // translucent text over an opaque background
    expect(contrastRatio('#ffffff', '#00000033')).toBeNull();
    expect(contrastRatio('#ffffff', '#00000033', '#ffffff80')).toBeNull(); // a translucent backdrop is unknown too
    expect(contrastRatio('#ffffff', '#00000033', 'nope')).toBeNull();
    expect(contrastRatio('#ffffff', '#00000000', '#fcfbf9')).toBeCloseTo(1.034183604267572, 12);
  });

  it('checkContrast reports an unknown backdrop as needing review, and a known one as a number', () => {
    const unknown = checkContrast('#ffffff', '#00000033', 'button label');
    expect(unknown).toEqual({ pair: 'button label', ratio: null, threshold: 4.5, message: 'button label: the background is translucent and its backdrop is unknown — requires rendered contrast review.' });
    const known = checkContrast('#ffffff', '#00000033', 'button label', 4.5, '#fcfbf9');
    expect(known?.ratio).toBe(1.66);
    expect(known?.message).toBe('button label contrast 1.66:1 is below WCAG AA 4.5:1 — verify or adjust.');
  });

  it('compares the unrounded ratio at 4.5:1 and 3:1', () => {
    expect(contrastRatio('#2626fe', '#c8c8c8')).toBeCloseTo(4.4975, 4);
    expect(checkContrast('#2626fe', '#c8c8c8', 'x')?.message).toBe('x contrast 4.5:1 is below WCAG AA 4.5:1 — verify or adjust.');
    expect(checkContrast('#2929fc', '#c9c9c9', 'x')).toBeNull(); // 4.5016
    expect(checkContrast('#5757fd', '#c8c8c8', 'x', 3)?.message).toBe('x contrast 3:1 is below WCAG AA 3:1 — verify or adjust.'); // 2.9978
    expect(checkContrast('#5c5cf2', '#cacaca', 'x', 3)).toBeNull(); // 3.0019
  });

  it('an opaque accent just under 3:1 on the canvas still warns and repairs focus; just over does not', () => {
    const below = compose({ colorMode: 'light', accentOverride: '#02a680' });
    const bc = (below.tokens as DesignTokens).color;
    expect(contrastRatio('#02a680', bc.canvas)).toBeCloseTo(2.99993, 5);
    expect(below.warnings).toContain('accent on canvas (light) contrast 3:1 is below WCAG AA 3:1 — verify or adjust.');
    expect(bc.focus).not.toBe('#02a680');
    expect(below.warnings.some((w) => w.includes('not opaque'))).toBe(false);

    const above = compose({ colorMode: 'light', accentOverride: '#00a680' });
    const ac = (above.tokens as DesignTokens).color;
    expect(contrastRatio('#00a680', ac.canvas)).toBeGreaterThanOrEqual(3);
    expect(above.warnings.some((w) => w.startsWith('accent on canvas'))).toBe(false);
    expect(ac.focus).toBe('#00a680');
  });
});

describe('#24 — the MCP schema and the compilers accept the same accentOverride values', () => {
  let client: Client;
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'token-color-alpha', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  const inputs = ['000000', '#000000', 'abc', '#ABC', 'AbCdEf', '00000033', '#00000033', '#FFFFFF80',
    '', '#', '#0008', '0008', ' #abc', '#abc ', '##abc', '#12345', '#1234567', '#000000zz', 'ggg', 'red', 'rgb(0,0,0)'];

  it('legacy and contract compilers agree with the schema, and accepted values come back normalized', async () => {
    for (const accentOverride of inputs) {
      const legacyOk = (() => { try { compose({ format: 'css-variables', accentOverride }); return true; } catch { return false; } })();
      const contractOk = (() => { try { compose({ primaryStyleId: 'brutalist-grid', contract, accentOverride }); return true; } catch { return false; } })();
      const response = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'runtime-signal', format: 'css-variables', accentOverride } })
        .catch((thrown: unknown) => ({ thrown }));
      const mcpOk = !('thrown' in response) && !response.isError;
      expect(legacyOk, `legacy '${accentOverride}'`).toBe(normalizeHexColor(accentOverride) !== null);
      expect(contractOk, `contract '${accentOverride}'`).toBe(legacyOk);
      expect(mcpOk, `mcp '${accentOverride}'`).toBe(legacyOk);
      if (mcpOk) {
        const structured = (response as unknown as { structuredContent: { tokens: DesignTokens; rendered: string } }).structuredContent;
        expect(structured.tokens.color.accent).toBe(normalizeHexColor(accentOverride));
        expect(structured.rendered).toContain(`--color-accent: ${normalizeHexColor(accentOverride)};`);
      }
    }
  });

  it('the text response lists the rendered-review warning for a translucent accent', async () => {
    const response = await client.callTool({ name: 'compose_design_tokens', arguments: { primaryStyleId: 'runtime-signal', format: 'css-variables', colorMode: 'light', accentOverride: '00000033' } });
    const text = (response.content as Array<{ type: string; text?: string }>).find((part) => part.type === 'text')?.text ?? '';
    expect(text).toContain('⚠ Contrast warnings:');
    expect(text).toContain('- accent (light) #00000033 is not opaque (alpha 20%)');
    expect(text).toContain('--color-accent: #00000033;');
    expect(text).toContain('--color-accentText: #000000;');
  });
});
