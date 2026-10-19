import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { buildPage } from '../src/structure/dom/page.js';
import { STRUCTURE_GUIDES } from '../src/structure/guides/index.js';
import { faceClass, detectStyleBan } from '../src/structure/rules.js';
import type { StyleBanDef, StyleRuleParams } from '../src/structure/types.js';
import { STYLE_RULE_IDS } from '../src/structure/types.js';

const repo = CatalogRepository.load();
const ctx = { viewportWidth: 1440, viewportHeight: 900 };
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

function page(body: string, css = '') {
  return buildPage(`<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`, [], ctx, 40000);
}
function status(body: string, css: string, ban: StyleBanDef) {
  return detectStyleBan(page(body, css), ban).status;
}
const ban = <R extends StyleBanDef['rule']>(rule: R, params: StyleRuleParams[R]) => ({
  rule, params, why: 'test fixture ban', source: { kind: 'specimen', note: 'unit-test fixture' },
}) as StyleBanDef;

const card = (style: string, text = words(8)) => `<main><section><h1>Product</h1><div class="card" style="${style}"><h3>Panel</h3><p>${text}</p></div></section></main>`;
const hues = (count: number) => `<main><section><h1>Palette</h1>${Array.from({ length: count }, (_, i) => `<div style="background-color: hsl(${i * 45} 80% 50%)"><p>${words(4)}</p></div>`).join('')}</section></main>`;

/** For each rule and params: a page that violates any allowed threshold, and one that satisfies any allowed threshold. */
function samples(b: StyleBanDef): { violates: [string, string]; complies: [string, string] } {
  switch (b.rule) {
    case 'corner-radius':
      return b.params.max !== undefined
        ? { violates: [card('border-radius: 9999px; border: 1px solid #000'), ''], complies: [card('border-radius: 0; border: 1px solid #000'), ''] }
        : { violates: [card('border-radius: 0; border: 1px solid #000'), ''], complies: [card('border-radius: 64px; border: 1px solid #000'), ''] };
    case 'shadow-blur': return { violates: [card('box-shadow: 0 20px 80px rgba(0,0,0,.4)'), ''], complies: [card('border: 1px solid #000'), ''] };
    case 'hard-shadow': return { violates: [card('box-shadow: 40px 40px 0 #000'), ''], complies: [card('border: 1px solid #000'), ''] };
    case 'shadow-layers': return { violates: [card(`box-shadow: ${Array.from({ length: 8 }, (_, i) => `0 ${i}px ${i * 2}px rgba(0,0,0,.1)`).join(', ')}`), ''], complies: [card('box-shadow: 0 1px 2px rgba(0,0,0,.1)'), ''] };
    case 'gradient-fill':
      if (b.params.scope === 'cards') {
        const cards = (fill: string) => `<main><section><h1>Cards</h1><div>${[1, 2, 3].map(() => `<div style="border:1px solid #000; background: ${fill}"><h3>Card</h3><p>${words(6)}</p></div>`).join('')}</div></section></main>`;
        return { violates: [cards('linear-gradient(#f0f, #0ff)'), ''], complies: [cards('#ffffff'), ''] };
      }
      if (b.params.scope === 'text') return { violates: ['<main><section><h1 class="g">Gradient words</h1></section></main>', '.g { background: linear-gradient(90deg, #f0f, #0ff); -webkit-background-clip: text; color: transparent; }'], complies: ['<main><section><h1>Solid words</h1></section></main>', ''] };
      return { violates: [card('background: linear-gradient(135deg, #f0f, #0ff)'), ''], complies: [card('background: #fafafa'), ''] };
    case 'backdrop-blur': return { violates: [card('backdrop-filter: blur(80px); background: rgba(255,255,255,.3)'), ''], complies: [card('background: #fff'), ''] };
    case 'glow': return {
      violates: [`<main><section><h1>Glow</h1>${Array.from({ length: 25 }, () => `<p style="text-shadow: 0 0 16px #22d3ee">${words(3)}</p>`).join('')}</section></main>`, ''],
      complies: [`<main><section><h1>Calm</h1><p>${words(3)}</p></section></main>`, ''],
    };
    case 'centered-copy': return { violates: [`<main><section><h1>Copy</h1><p style="text-align:center">${words(70)}</p></section></main>`, ''], complies: [`<main><section><h1>Copy</h1><p style="text-align:left">${words(70)}</p></section></main>`, ''] };
    case 'unguarded-motion': return {
      violates: ['<main><section><h1>Motion</h1><div class="orb"><p>moving thing here</p></div></section></main>', '.orb { animation: drift 8s ease-in-out infinite; }'],
      complies: ['<main><section><h1>Motion</h1><div class="orb"><p>moving thing here</p></div></section></main>', '.orb { animation: drift 8s ease-in-out infinite; } @media (prefers-reduced-motion: reduce) { .orb { animation: none; } }'],
    };
    case 'eased-motion': return { violates: [card('transition: transform 2s ease'), ''], complies: [card('border: 1px solid #000'), ''] };
    case 'accent-hues':
      return b.params.max !== undefined
        ? { violates: [hues(8), ''], complies: [hues(0) + '<p style="color:#111">neutral text only</p>', ''] }
        : { violates: [hues(0) + '<p style="color:#111">neutral text only</p>', ''], complies: [hues(8), ''] };
    case 'canvas': {
      const body = `<main><section><h1>Canvas</h1><p>${words(5)}</p></section></main>`;
      const css = (color: string) => `body { background-color: ${color}; }`;
      const bad = { 'pure-white': '#ffffff', light: '#ffffff', dark: '#050505', tinted: '#f3ead8' }[b.params.forbid];
      const good = { 'pure-white': '#f3ead8', light: '#050505', dark: '#ffffff', tinted: '#ffffff' }[b.params.forbid];
      return { violates: [body, css(bad)], complies: [body, css(good)] };
    }
    case 'text-on-effect':
      return b.params.surface === 'gradient'
        ? { violates: [`<main><section style="background: linear-gradient(#f0f, #0ff)"><h1>Field</h1><p>${words(90)}</p></section></main>`, ''], complies: [`<main><section style="background: linear-gradient(#f0f, #0ff)"><h1>Field</h1><div style="background:#111"><p>${words(90)}</p></div></section></main>`, ''] }
        : { violates: [`<main><section><h1>Glass</h1><div style="backdrop-filter: blur(20px); background: rgba(255,255,255,.2)"><p>${words(90)}</p></div></section></main>`, ''], complies: [`<main><section><h1>Glass</h1><div style="background:#ffffff"><p>${words(90)}</p></div></section></main>`, ''] };
    case 'nested-surfaces':
      return b.params.kind === 'glass'
        ? { violates: ['<main><section><h1>Glass</h1><div style="backdrop-filter: blur(12px)"><div style="backdrop-filter: blur(12px)"><p>inner glass text</p></div></div></section></main>', ''], complies: ['<main><section><h1>Glass</h1><div style="backdrop-filter: blur(12px)"><p>single glass text</p></div></section></main>', ''] }
        : { violates: [`<main><section><h1>Cards</h1><div style="border:1px solid #000; border-radius:12px"><h3>Outer</h3><div style="border:1px solid #000; border-radius:8px"><p>${words(5)}</p></div></div></section></main>`, ''], complies: [`<main><section><h1>Cards</h1><div style="border:1px solid #000; border-radius:12px"><h3>Only</h3><p>${words(5)}</p></div></section></main>`, ''] };
    case 'icon-tiles': return {
      violates: [`<main><section><h1>Tiles</h1>${Array.from({ length: 14 }, () => '<div style="width:48px; height:48px; background:#eef"><svg width="24" height="24"></svg></div>').join('')}</section></main>`, ''],
      complies: [`<main><section><h1>No tiles</h1><p>${words(6)}</p></section></main>`, ''],
    };
    case 'faint-borders': return { violates: [card('border: 1px solid rgba(255,255,255,0.02)'), ''], complies: [card('border: 1px solid #000000'), ''] };
    case 'typeface': {
      const role = b.params.role;
      const families = ['"JetBrains Mono", monospace', 'Georgia, serif', 'Inter, sans-serif', ...(b.params.forbidFamilies ?? []).map((family) => `"${family}", sans-serif`)];
      const banned = (family: string) => {
        const face = faceClass(family);
        const first = family.split(',')[0]!.replace(/"/g, '').trim().toLowerCase();
        return (b.params.require !== undefined && face !== b.params.require) || (b.params.forbid ?? []).includes(face)
          || (b.params.forbidFamilies ?? []).some((name) => name.toLowerCase() === first);
      };
      const bad = families.find(banned)!;
      const good = families.find((family) => !banned(family))!;
      const body = role === 'display' ? '<main><section><h1 class="t">Display line</h1></section></main>' : `<main><section><h1>Doc</h1><p class="t">${words(12)}</p></section></main>`;
      return { violates: [body, `.t { font-family: ${bad}; }`], complies: [body, `.t { font-family: ${good}; }`] };
    }
    case 'imagery': {
      const kind = b.params.forbid[0]!;
      const bad = {
        illustration: '<svg width="400" height="300" aria-hidden="true"><path d="M0 0"/></svg>',
        photo: '<img src="/hero/team.jpg" width="800" height="500" alt="Team">',
        emoji: '<h2>🚀 Launch</h2>',
      }[kind];
      return { violates: [`<main><section><h1>Images</h1>${bad}</section></main>`, ''], complies: [`<main><section><h1>Images</h1><p>${words(6)}</p></section></main>`, ''] };
    }
    case 'crowded-grid': return {
      violates: [`<main><section><h1>Grid</h1><div style="display:grid; grid-template-columns: repeat(13, 1fr)">${'<p>cell text</p>'.repeat(13)}</div></section></main>`, ''],
      complies: [`<main><section><h1>Grid</h1><div style="display:grid; grid-template-columns: 1fr">${'<p>cell text</p>'.repeat(3)}</div></section></main>`, ''],
    };
  }
}

const representative: StyleBanDef[] = [
  ban('corner-radius', { max: 4 }), ban('corner-radius', { min: 16 }), ban('shadow-blur', { maxBlurPx: 0 }),
  ban('hard-shadow', { minOffsetPx: 4 }), ban('shadow-layers', { maxLayers: 2 }), ban('gradient-fill', { scope: 'any' }),
  ban('gradient-fill', { scope: 'cards' }), ban('gradient-fill', { scope: 'text' }), ban('backdrop-blur', { maxBlurPx: 0 }),
  ban('glow', { maxElements: 1, target: 'any' }), ban('glow', { maxElements: 0, target: 'text' }), ban('centered-copy', { minWords: 12 }),
  ban('unguarded-motion', { includeFinite: false }), ban('eased-motion', { maxDurationMs: 0 }),
  ban('accent-hues', { max: 1, minSaturation: 0.45 }), ban('accent-hues', { min: 2, minSaturation: 0.45 }),
  ban('canvas', { forbid: 'pure-white' }), ban('canvas', { forbid: 'light' }), ban('canvas', { forbid: 'dark' }), ban('canvas', { forbid: 'tinted' }),
  ban('text-on-effect', { surface: 'gradient', minWords: 12 }), ban('text-on-effect', { surface: 'glass', minWords: 12 }),
  ban('nested-surfaces', { kind: 'card' }), ban('nested-surfaces', { kind: 'glass' }), ban('icon-tiles', { maxTiles: 0 }),
  ban('faint-borders', { minAlpha: 0.28 }), ban('typeface', { role: 'display', require: 'monospace' }),
  ban('typeface', { role: 'display', forbid: ['serif'], forbidFamilies: ['Archivo Black'] }), ban('typeface', { role: 'body', forbid: ['monospace'] }),
  ban('imagery', { forbid: ['illustration'] }), ban('imagery', { forbid: ['photo'] }), ban('imagery', { forbid: ['emoji'] }),
  ban('crowded-grid', { maxColumns: 2 }),
];

describe('style rule detectors', () => {
  it('cover every rule id', () => {
    expect(new Set(representative.map((item) => item.rule))).toEqual(new Set(STYLE_RULE_IDS));
  });

  it.each(representative.map((item) => [`${item.rule} ${JSON.stringify(item.params)}`, item] as const))('%s fires on a violation and not on a compliant page', (_name, item) => {
    const sample = samples(item);
    expect(status(...sample.violates, item)).toBe('found');
    expect(status(...sample.complies, item)).toBe('absent');
  });

  it('every authored style ban fires on a violating page and stays quiet on a compliant one', () => {
    const failures: string[] = [];
    for (const guide of STRUCTURE_GUIDES) {
      for (const item of guide.bans) {
        const sample = samples(item);
        const hit = status(...sample.violates, item);
        const quiet = status(...sample.complies, item);
        if (hit !== 'found') failures.push(`${guide.styleId}/${item.rule}: violation gave ${hit}`);
        if (quiet !== 'absent') failures.push(`${guide.styleId}/${item.rule}: compliant page gave ${quiet}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('exempts small circles such as avatars from the corner-radius ban', () => {
    const avatar = '<main><section><h1>Team</h1><img src="/a.png" alt="" width="40" height="40" style="border-radius: 50%"></section></main>';
    expect(status(avatar, '', ban('corner-radius', { max: 0 }))).toBe('absent');
  });

  it('treats motion-safe Tailwind animation as guarded', () => {
    const body = '<main><section><h1>Motion</h1><div class="motion-safe:animate-spin"><p>spinner label</p></div></section></main>';
    expect(status(body, '', ban('unguarded-motion', { includeFinite: false }))).toBe('absent');
    expect(status(body.replace('motion-safe:animate-spin', 'animate-spin'), '', ban('unguarded-motion', { includeFinite: false }))).toBe('found');
  });

  it('reports the canvas as not verified when the page declares no styles at all', () => {
    expect(detectStyleBan(buildPage('<main><section><h1>Bare</h1></section></main>', [], ctx, 1000), ban('canvas', { forbid: 'pure-white' })).status).toBe('not-verified');
  });

  it('classifies font stacks by their first family', () => {
    expect(faceClass('"IBM Plex Mono", monospace')).toBe('monospace');
    expect(faceClass('"Noto Serif KR", serif')).toBe('serif');
    expect(faceClass('"Noto Sans KR", sans-serif')).toBe('sans');
    expect(faceClass('"Archivo Black", sans-serif')).toBe('sans');
    expect(faceClass('Georgia, "Times New Roman", serif')).toBe('serif');
  });
});
