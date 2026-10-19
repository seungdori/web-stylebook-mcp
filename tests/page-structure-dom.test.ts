import { describe, expect, it } from 'vitest';
import { parseCss } from '../src/structure/dom/css.js';
import { decodeEntities, parseHtml, selectorPath, textContent, wordCount } from '../src/structure/dom/html.js';
import { buildPage, isCentered } from '../src/structure/dom/page.js';
import { matchesComplex, parseSelector } from '../src/structure/dom/selector.js';
import { tailwindDeclarations } from '../src/structure/dom/tailwind.js';
import { lengthPx, parseColor, parseShadows, toHsl } from '../src/structure/dom/values.js';

const ctx = { viewportWidth: 1440, viewportHeight: 900 };
const find = (html: ReturnType<typeof parseHtml>, predicate: (tag: string, cls: readonly string[]) => boolean) =>
  html.elements.find((element) => predicate(element.tag, element.classes))!;

describe('lenient HTML parser', () => {
  it('handles void elements, implied closes, raw text, and skipped script content', () => {
    const html = parseHtml('<main><p>One<p>Two<ul><li>a<li>b</ul><img src=x.png><br/><script>document.write("<h1>no</h1>")</script><style>.a{color:red}</style><textarea><b>raw</b></textarea></main>', 1000);
    const main = html.elements.find((element) => element.tag === 'main')!;
    expect(main.children.filter((child) => child.kind === 'element').map((child) => (child as { tag: string }).tag))
      .toEqual(['p', 'p', 'ul', 'img', 'br', 'style', 'textarea']);
    expect(html.elements.some((element) => element.tag === 'h1')).toBe(false);
    expect(html.styleSheets).toEqual(['.a{color:red}']);
    expect(textContent(main)).toContain('<b>raw</b>');
    expect(html.elements.filter((element) => element.tag === 'li')).toHaveLength(2);
  });

  it('decodes entities and attribute quoting, and caps elements explicitly', () => {
    expect(decodeEntities('Tom &amp; Jerry &#x2014; &rarr; &unknown;')).toBe('Tom & Jerry — → &unknown;');
    const html = parseHtml(`<div class='a b' data-x="1 > 0" hidden>${'<i></i>'.repeat(20)}</div>`, 10);
    expect(html.elements[0]!.classes).toEqual(['a', 'b']);
    expect(html.elements[0]!.attrs.get('data-x')).toBe('1 > 0');
    expect(html.elements).toHaveLength(10);
    expect(html.truncated).toBe(true);
  });

  it('counts words in spaced and unspaced scripts and builds stable selector paths', () => {
    expect(wordCount('Trusted by 2,000 teams')).toBe(4);
    expect(wordCount('導入企業は2000社以上です')).toBeGreaterThanOrEqual(5);
    const html = parseHtml('<body><main><section class="hero"></section><section class="x y"></section></main></body>', 100);
    expect(selectorPath(html.elements[3]!)).toBe('body > main > section.x:nth-of-type(2)');
  });
});

describe('CSS parser', () => {
  it('evaluates media queries against the viewport and separates reduced-motion rules', () => {
    const parsed = parseCss(`
      /* comment { } */
      .a { color: red }
      @media (min-width: 768px) { .b { color: blue } }
      @media (max-width: 600px) { .c { color: green } }
      @media (width >= 1200px) and (prefers-color-scheme: light) { .d { color: navy } }
      @media (prefers-reduced-motion: reduce) { .e { animation: none } }
      @media (prefers-reduced-motion: no-preference) { .f { animation: spin 1s infinite } }
      @supports (display: grid) { @layer base { .g { display: grid } } }
      @keyframes spin { to { transform: rotate(1turn) } }
      .h { color: x; & .i { color: y } &:hover { color: z } }
    `, ctx);
    const by = (selector: string) => parsed.rules.find((rule) => rule.selectorText === selector);
    expect(by('.a')?.motion).toBe('any');
    expect(by('.b')).toBeDefined();
    expect(by('.c')).toBeUndefined();
    expect(by('.d')).toBeDefined();
    expect(by('.e')?.motion).toBe('reduce');
    expect(by('.f')?.motion).toBe('no-preference');
    expect(by('.g')).toBeDefined();
    expect(by('.h .i')).toBeDefined();
    expect(by('.h:hover')).toBeDefined();
    expect([...parsed.keyframes]).toEqual(['spin']);
    expect(by('.a')!.declarations[0]).toEqual({ prop: 'color', value: 'red', important: false });
  });
});

describe('selector matcher', () => {
  const html = parseHtml('<main><section id="s" class="hero"><div class="grid"><a class="btn primary" href="/x" data-kind="cta">Go</a><span>1</span><span>2</span></div></section></main>', 100);
  const link = find(html, (tag) => tag === 'a');
  const spans = html.elements.filter((element) => element.tag === 'span');
  const matches = (selector: string, element = link) => matchesComplex(element, parseSelector(selector)!);

  it('matches compound, descendant, child, sibling and attribute selectors', () => {
    expect(matches('main .hero a.btn.primary')).toBe(true);
    expect(matches('#s > .grid > a')).toBe(true);
    expect(matches('section > a')).toBe(false);
    expect(matches('a[data-kind="cta"][href^="/"]')).toBe(true);
    expect(matches('a + span', spans[0])).toBe(true);
    expect(matches('a ~ span', spans[1])).toBe(true);
    expect(matches('a:not(.secondary)')).toBe(true);
    expect(matches(':is(.btn, .link)')).toBe(true);
    expect(matches('span:nth-child(3)', spans[1])).toBe(true);
    expect(matches('section:has(> .grid)', find(html, (tag) => tag === 'section'))).toBe(true);
  });

  it('never matches interaction states and unescapes Tailwind class selectors', () => {
    expect(matches('a:hover')).toBe(false);
    expect(parseSelector('.md\\:grid-cols-3')!.compounds[0]!.classes).toEqual(['md:grid-cols-3']);
    expect(parseSelector('.w-1\\/2')!.compounds[0]!.classes).toEqual(['w-1/2']);
    expect(parseSelector('.hero::before')!.pseudoElement).toBe('before');
    expect(parseSelector('input::placeholder')).toBeNull();
  });
});

describe('values', () => {
  it('parses hex, rgb, hsl, oklch and named colors', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('rgba(0, 0, 0, 0.5)')!.a).toBe(0.5);
    expect(parseColor('rgb(0 0 0 / 25%)')!.a).toBe(0.25);
    expect(Math.round(toHsl(parseColor('hsl(210 80% 50%)')!).h)).toBe(210);
    const red = parseColor('oklch(0.637 0.237 25.331)')!;
    expect([red.r, red.g, red.b].map(Math.round)).toEqual([251, 44, 54]);
    const blue = parseColor('oklch(0.623 0.214 259.815)')!;
    expect([blue.r, blue.g, blue.b].map(Math.round)).toEqual([43, 127, 255]);
    expect(parseColor('rebeccapurple-ish')).toBeNull();
  });

  it('evaluates lengths and shadows', () => {
    expect(lengthPx('1.5rem', ctx)).toBe(24);
    expect(lengthPx('clamp(2rem, 5vw, 4.5rem)', ctx)).toBe(72);
    expect(lengthPx('calc(100vw - 40px)', ctx)).toBe(1400);
    expect(lengthPx('50%', ctx)).toBeNull();
    expect(parseShadows('0 20px 80px rgba(0,0,0,.4), inset 0 1px 0 #fff', ctx)).toEqual([
      { inset: false, x: 0, y: 20, blur: 80, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.4 } },
      { inset: true, x: 0, y: 1, blur: 0, spread: 0, color: { r: 255, g: 255, b: 255, a: 1 } },
    ]);
  });
});

describe('cascade', () => {
  it('orders inline, !important, specificity and source order, and resolves custom properties', () => {
    const page = buildPage(
      '<html><body><main><section class="hero" id="top" style="color: green"><h1 class="title">Hi</h1></section></main></body></html>',
      [':root { --brand: #7c3aed; } .hero { color: red; text-align: center; } #top { color: blue; } .title { color: var(--brand, black); } section { color: orange !important; }'],
      ctx, 1000,
    );
    const hero = page.html.elements.find((element) => element.id === 'top')!;
    const title = page.html.elements.find((element) => element.tag === 'h1')!;
    expect(page.styles.get(hero, 'color')).toBe('orange');
    expect(page.styles.get(title, 'color')).toBe('#7c3aed');
    expect(page.styles.get(title, 'text-align')).toBe('center');
    expect(isCentered(page, title)).toBe(true);
  });

  it('applies Tailwind utilities with responsive variants, arbitrary values and gradient stops', () => {
    const page = buildPage(
      '<main><div class="text-center md:text-left absolute -z-10 h-[500px] rounded-full blur-3xl bg-gradient-to-r from-purple-500 to-pink-500/50"></div></main>',
      [], ctx, 100,
    );
    const div = page.html.elements.find((element) => element.tag === 'div')!;
    expect(page.styles.get(div, 'text-align')).toBe('left');
    expect(page.styles.get(div, 'z-index')).toBe('-10');
    expect(page.styles.get(div, 'height')).toBe('500px');
    expect(page.styles.get(div, 'filter')).toBe('blur(64px)');
    expect(page.styles.pick(div, ['background-image'])!.value).toBe('linear-gradient(to right, hsl(271 91% 55%), transparent, hsl(330 81% 55% / 0.5))');
    const narrow = buildPage('<main><div class="text-center md:text-left"></div></main>', [], { viewportWidth: 390, viewportHeight: 844 }, 100);
    expect(narrow.styles.get(narrow.html.elements[1]!, 'text-align')).toBe('center');
    expect(tailwindDeclarations('hover:bg-red-500', ctx)).toBeNull();
    expect(tailwindDeclarations('before:blur-xl', ctx)!.target).toBe('before');
  });

  it('finds the opening and the content sections', () => {
    const page = buildPage('<body><header><nav><a href="/">Acme</a></nav></header><div id="root"><div class="app"><section><h1>Main</h1></section><section><h2>Next</h2></section></div></div><footer>f</footer></body>', [], ctx, 100);
    expect(page.sections.map((section) => section.tag)).toEqual(['section', 'section']);
    expect(page.opening?.tag).toBe('section');
    expect(page.footer?.tag).toBe('footer');
  });
});
