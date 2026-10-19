// Regression tests from the third independent review of #11, of the follow-up that fixes the second review's
// findings. Each "defect" block reproduces a defect that review found; the "verified" block pins behavior that held.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { auditPageStructure, type StructureAuditResult } from '../src/structure/audit.js';

const repo = CatalogRepository.load();
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'page-structure');

const audit = (html: string, css: string[] = [], styleId?: string, viewportWidth?: number) =>
  auditPageStructure({ html, css, styleId, viewportWidth }, repo);
const status = (result: StructureAuditResult, patternId: string) =>
  result.checks.find((check) => check.patternId === patternId)?.status;
const foundIds = (result: StructureAuditResult) =>
  result.checks.filter((check) => check.status === 'found').map((check) => check.patternId).sort();
const timed = (run: () => unknown) => {
  const started = performance.now();
  run();
  return performance.now() - started;
};

const productHero = '<section><h1>Payroll for restaurants</h1><p>Run payroll for hourly staff with tips handled.</p><a href="/x">Try it</a><img src="/shot.png" width="800" height="500" alt="Payroll run screen"></section>';
const closingSection = '<section><h2>Pricing</h2><p>One plan per location, billed monthly with no setup fee.</p></section>';
const page = (inner: string) => `<main>${productHero}${inner}${closingSection}</main>`;
const quote = (n: number) => `<figure><blockquote>“We closed payroll in ten minutes on the first try, no support ticket needed (${n}).”</blockquote><figcaption>Dana ${n}, Cafe Uno</figcaption></figure>`;
const quotes = `${quote(1)}${quote(2)}${quote(3)}`;

// Tailwind UI's centered hero copy: a centered h1, one subline, two calls to action.
const centeredCopy = '<div class="mx-auto max-w-2xl py-32"><div class="text-center"><h1 class="text-4xl font-bold">Data to enrich your online business</h1><p class="mt-6 text-lg">Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.</p><div class="mt-10 flex items-center justify-center gap-x-6"><a href="#" class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-white">Get started</a><a href="#">Learn more <span aria-hidden="true">→</span></a></div></div></div>';
const heroWith = (before: string, after = '') => `<main><div class="relative isolate px-6 pt-14 lg:px-8">${before}${centeredCopy}${after}</div><section><h2>Features</h2><p>Words about features for the second section here.</p></section></main>`;

// A centered all-text hero, a trusted-by logo band, a screenshot section, and a stock closing banner.
const templateSections = `<section class="relative py-24"><div class="mx-auto max-w-3xl text-center"><span class="text-xs">New: AI onboarding</span><h1 class="text-5xl">Four workflows, one employee record</h1><p class="mt-6">Hiring, onboarding, payroll, and reviews in one place, so your team can focus.</p><div class="flex justify-center gap-4"><a href="/signup">Start free trial</a><a href="/demo">Book a demo</a></div></div></section>
  <section class="py-12"><p class="text-center text-sm">Trusted by 2,000+ HR teams worldwide</p><div class="flex justify-between gap-8 opacity-60 grayscale">${['acme', 'globex', 'initech', 'umbrella', 'hooli'].map((name) => `<img src="/logos/${name}.svg" alt="${name}" class="h-8">`).join('')}</div></section>
  <section><h2>See a payroll run</h2><img src="/run.png" width="1200" height="700" alt="Payroll run"></section>
  <section class="py-24 text-center bg-indigo-700"><h2>Ready to get started?</h2><p>Join the teams that run HR in one place.</p><a href="/signup">Start free trial</a></section>`;
const TEMPLATE_FINDINGS = ['centered-stack-hero', 'closing-cta-banner', 'generic-saas-skeleton', 'logo-strip', 'trusted-by-band'];

/** Custom properties that fan out `levels` times above a 70-step chain, which crosses the 64-step depth limit. */
function fanOutAboveDeepChain(levels: number): string {
  let css = ':root{';
  for (let i = 0; i < levels; i++) css += `--a${i}:var(--a${i + 1}) var(--a${i + 1});`;
  css += `--a${levels}:var(--b0);`;
  for (let i = 0; i < 70; i++) css += `--b${i}:var(--b${i + 1});`;
  return `${css}--b70:#f0f;} .hero{background:var(--a0)}`;
}

describe('defect: hostile CSS within the documented limits', () => {
  const hero = '<main><section class="hero"><h1>Ship invoices faster</h1><p>Some words here for the paragraph.</p></section></main>';

  it('audits custom properties that fan out above a chain deeper than 64 steps in bounded time (under 2 KB of CSS)', () => {
    // When values cut off by the depth limit were not cached, every level above the cut was resolved again per
    // reference: 20 levels of fan-out took about 9 s and 30 about 2.5 h, against ~15 ms in 0.12.0.
    const css = fanOutAboveDeepChain(20);
    expect(css.length).toBeLessThan(2048);
    expect(timed(() => audit(hero, [css]))).toBeLessThan(1000);
  }, 120_000);

  it('audits `div{display:inherit}` on a 10,000-deep page instead of overflowing the stack', () => {
    const html = `<main>${productHero}<section><h2>x</h2>${'<div>'.repeat(10000)}<p>text words here</p>${'</div>'.repeat(10000)}</section></main>`;
    expect(() => audit(html, ['div{display:inherit}'])).not.toThrow();
  }, 60_000);
});

describe('defect: hostile markup within the documented limits', () => {
  it('scans 13,000 claims that each sit in their own wrapper in bounded time', () => {
    const html = `<main>${productHero}<section><h2>x</h2><div>${'<div><p>Trusted by 500 teams</p></div>'.repeat(13000)}</div></section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 120_000);

  it('parses implied end tags that stop at a table boundary on a deep stack in bounded time', () => {
    const html = `<main>${productHero}<section><h2>x</h2><dl><dd><table>${'<div>'.repeat(19900)}${'<dt/>'.repeat(19900)}</table></dd></dl></section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 120_000);

  it('looks for icon cards in a 13,000-level comb of three-child blocks in bounded time', () => {
    const html = `<main>${productHero}<section><h2>x</h2>${'<div><p>one</p><p>two</p>'.repeat(13300)}${'</div>'.repeat(13300)}</section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 120_000);

  it('labels 6,600 image rows in one section in bounded time', () => {
    const row = '<div class="flex"><img src="/a.png"><img src="/b.png"><img src="/c.png"><img src="/d.png"><img src="/e.png"></div>';
    const html = `<main>${productHero}<section><h2>Partners</h2>${row.repeat(6600)}</section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 120_000);

  it('matches 200 rules of 500 chained classes against 200 elements carrying those classes in bounded time', () => {
    // Comparing class lists pairwise made each compound check cost up to 500 x 500 while counting as one check.
    const classes = Array.from({ length: 500 }, (_, i) => `c${i}`);
    const html = `<main>${productHero}<section><h2>x</h2>${`<div class="${classes.join(' ')}">x</div>`.repeat(200)}</section></main>`;
    const css = Array.from({ length: 200 }, (_, r) => `.${classes.slice(0, 499).join('.')}.z${r}{color:red}`).join('\n');
    expect(timed(() => audit(html, [css]))).toBeLessThan(1500);
  }, 120_000);
});

describe('defect: regressions in the follow-up', () => {
  it('still finds a testimonial carousel whose section is a Start Bootstrap `page-section`', () => {
    const html = page(`<section class="page-section"><h2>What owners say</h2><div class="track">${quotes}</div><div><button aria-label="Previous">‹</button><button aria-label="Next">›</button></div></section>`);
    expect(status(audit(html), 'testimonial-carousel')).toBe('found');
  });

  it('still finds a testimonial carousel with slide dots inside a `div.page` wrapper', () => {
    const html = `<div class="page">${page(`<section><h2>What owners say</h2><div class="track">${quotes}</div><div>${[1, 2, 3].map((n) => `<button aria-label="Go to slide ${n}"></button>`).join('')}</div></section>`)}</div>`;
    expect(status(audit(html), 'testimonial-carousel')).toBe('found');
  });

  it('platform-core: a compiled Tailwind v4 `border-white/10` (color-mix with transparent) is still a faint border', () => {
    const v4 = '@layer utilities{.border{border-style:var(--tw-border-style);border-width:1px}.border-white\\/10{border-color:color-mix(in srgb,#fff 10%,transparent)}}@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}';
    const html = page('<section><h2>Runs</h2><div class="border border-white/10 px-4"><h3>Run 42</h3><p>Finished in 3 minutes with 12 output files.</p></div></section>');
    expect(status(audit(html, [], 'platform-core'), 'platform-core/faint-borders')).toBe('found');
    expect(status(audit(html, [v4], 'platform-core'), 'platform-core/faint-borders')).toBe('found');
  });

  it('does not call a centered hero an all-text stack when its hand-built product mock is marked aria-hidden', () => {
    const row = (id: string, amount: string, state: string) => `<div class="flex justify-between py-2"><span>#${id}</span><span>${amount}</span><span class="rounded px-2">${state}</span></div>`;
    const mock = `<div class="mx-auto mt-12 max-w-4xl rounded-xl border bg-white p-4 shadow-xl" aria-hidden="true"><div class="flex justify-between border-b pb-2"><span>Invoice queue</span><span>3 waiting</span></div>${row('1042 Northwind', '$4,200', 'Needs approval')}${row('1041 Contoso', '$980', 'Paid')}${row('1040 Fabrikam', '$12,500', 'Scheduled Fri')}</div>`;
    expect(status(audit(heroWith('', mock)), 'centered-stack-hero')).not.toBe('found');
  });

  it('does not call a centered hero an all-text stack when its product chart is an aria-hidden inline SVG', () => {
    const chart = `<svg aria-hidden="true" class="mx-auto mt-12" width="960" height="420" viewBox="0 0 960 420">${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 80 + 10}" y="${400 - i * 30}" width="60" height="${i * 30}" fill="#4f46e5"/>`).join('')}<text x="10" y="20">MRR by month</text></svg>`;
    expect(status(audit(heroWith('', chart)), 'centered-stack-hero')).not.toBe('found');
  });

  it.each([
    ['/img/aurora-dashboard.png', 'Aurora dashboard listing open incidents'],
    ['/diagrams/service-mesh-topology.png', 'Traffic between services in the mesh'],
    ['/products/glow-serum-bottle.png', 'Glow serum, 30 ml bottle'],
  ])('does not read a positioned product image with real alt text (%s) as a gradient blob', (src, alt) => {
    const image = `<img src="${src}" alt="${alt}" width="720" height="480" class="absolute right-0 top-24">`;
    expect(status(audit(heroWith(image)), 'gradient-blob-hero')).not.toBe('found');
  });

  it('does not read a row of SDK language logos under "Client libraries" as a customer logo strip', () => {
    const sdks = ['python', 'node', 'go', 'ruby', 'java'].map((name) => `<a href="/docs/sdk/${name}"><img src="/sdk/${name}.svg" alt="${name}" width="40" height="40"><span>${name}</span></a>`).join('');
    expect(status(audit(page(`<section><h2>Client libraries</h2><div class="flex gap-6">${sdks}</div></section>`)), 'logo-strip')).not.toBe('found');
  });

  it('says that found checks are also not verified when the selector budget runs out', () => {
    const html = `<main><section><h1>Title</h1><p>Words here for the lede of the page.</p></section><section>${'<div><p>x</p></div>'.repeat(4000)}</section></main>`;
    const css = Array.from({ length: 1500 }, (_, i) => `section div:nth-child(${i}) { color: red }`).join('\n');
    const result = audit(html, [css], 'quiet-utility', 1440, );
    expect(result.limits.some((line) => line.includes('selector matching'))).toBe(true);
    // The limit text once said that only "checks that found nothing" were not verified.
    expect(result.limits.join(' ')).not.toMatch(/checks that found nothing are reported as not verified/);
  });
});

describe('defect: second-review findings that remain open', () => {
  // Finding 9 named the specimens' own skip links; they are hidden by an off-screen offset, not the sr-only clip.
  const skipPage = '<body style="background:#fef7f0"><main><a class="skip" href="#c">Skip to content</a><section id="c"><h1>Plan a party</h1><p>Invite guests and split costs.</p><img src="/p.png" width="800" alt="Party board"></section><section><h2>Pricing</h2><p>One plan per location, billed monthly with no setup fee.</p></section></main></body>';
  it.each([
    ['soft-pastel', '.skip{position:absolute;top:-40px;left:0;background:#111;color:#fff;padding:8px}.skip:focus{top:0}'],
    ['soft-pastel', '.skip{position:fixed;top:-100%;left:16px;background:#09090b;color:#fff;padding:12px 24px}.skip:focus{top:16px}'],
    ['claymorphism', '.skip{position:absolute;left:-9999px;background:#111;color:#fff}'],
  ])('%s: a skip link moved off-screen (%s) is not a dark page section', (styleId, css) => {
    expect(status(audit(skipPage, [css], styleId), `${styleId}/canvas`)).not.toBe('found');
  });

  it('still finds the template when a fixed cookie banner with its own heading sits beside the app root', () => {
    const banner = '<div class="cookie" style="position:fixed;bottom:0;left:0;right:0"><h2>We value your privacy</h2><p>We use cookies to improve your experience.</p><button>Accept</button><button>Decline</button></div>';
    expect(foundIds(audit(`<body><div id="root"><div class="app">${templateSections}</div></div>${banner}</body>`))).toEqual(TEMPLATE_FINDINGS);
  });

  it('still finds the template when a fixed chat widget iframe sits beside the app root', () => {
    const widget = '<div id="chat-widget" style="position:fixed;right:16px;bottom:16px"><iframe title="Chat" src="https://widget.example/chat" width="64" height="64"></iframe></div>';
    expect(foundIds(audit(`<body><div id="root"><div class="app">${templateSections}</div></div>${widget}</body>`))).toEqual(TEMPLATE_FINDINGS);
  });
});

describe('verified: follow-up fixes that hold', () => {
  const hero = '<main><section class="hero"><h1>Ship invoices faster</h1><p>Some words here for the paragraph.</p></section></main>';
  const blurWrap = (inner: string) => `<div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">${inner}</div>`;
  const svgPath = (fill: string) => `<svg class="relative h-[21rem] max-w-none" viewBox="0 0 1155 678"><path ${fill} fill-opacity=".3" d="M317 518L203 678 0 438l317 80 204-286z"/></svg>`;

  it.each([
    ['a radialGradient referenced from a style attribute', blurWrap('<svg viewBox="0 0 800 800"><defs><radialGradient id="rg"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></radialGradient></defs><ellipse cx="400" cy="400" rx="400" ry="300" style="fill:url(#rg)"/></svg>')],
    ['a gradient defined in a shared sprite elsewhere', `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="shared-g"><stop stop-color="#9089FC"/><stop offset="1" stop-color="#FF80B5"/></linearGradient></defs></svg>${blurWrap(svgPath('fill="url(#shared-g)"'))}`],
    ['a saturated solid fill', blurWrap(svgPath('fill="#ff80b5"'))],
    ['a named glow image behind the copy', '<img src="/img/hero-glow.png" alt="" class="absolute left-1/2 top-0 -z-10 w-[1200px] -translate-x-1/2">'],
  ])('finds a gradient-blob hero painted with %s', (_label, decoration) => {
    const result = audit(heroWith(decoration));
    expect(status(result, 'gradient-blob-hero')).toBe('found');
    expect(status(result, 'centered-stack-hero')).toBe('found');
  });

  const blurb = 'Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse semper morbi. Odio urna massa nunc massa.';
  const icon = '<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path d="M12 16.5V9.75"/></svg>';
  const titles = ['Push to deploy', 'SSL certificates', 'Simple queues'];

  it('finds icon cards whose icon is wrapped in a span inside the h3, or is an icon image inside the dt', () => {
    expect(status(audit(page(`<section><h2>Features</h2><div class="grid grid-cols-3 gap-8">${titles.map((title) => `<div><h3><span class="inline-flex">${icon}</span>${title}</h3><p>${blurb}</p></div>`).join('')}</div></section>`)), 'icon-feature-grid')).toBe('found');
    expect(status(audit(page(`<section><h2>Features</h2><dl class="grid grid-cols-3 gap-8">${titles.map((title) => `<div><dt><img src="/icons/${title.length}.svg" alt="" width="24" height="24">${title}</dt><dd>${blurb}</dd></div>`).join('')}</dl></section>`)), 'icon-feature-grid')).toBe('found');
  });

  it('does not take a trailing link icon inside an h3 for a leading feature icon', () => {
    expect(status(audit(page(`<section><h2>Guides</h2><div class="grid grid-cols-3 gap-8">${titles.map((title) => `<div><h3><a href="/g">${title}</a>${icon}</h3><p>${blurb}</p></div>`).join('')}</div></section>`)), 'icon-feature-grid')).not.toBe('found');
  });

  const buttons = page('<section><h2>Plans</h2><p>Pick the plan that fits your locations.</p><button class="btn">Choose Team</button><button class="btn">Choose Pro</button></section>');
  it.each([
    ['.btn{border:1px solid #0000}', 'absent'],
    ['.btn{border-width:1px;border-style:solid;border-color:transparent}', 'absent'],
    ['.btn{border:1px solid rgba(0,0,0,.05)}', 'found'],
    ['.btn{border:1px solid;border-color:rgba(0,0,0,.05)}', 'found'],
  ])('platform-core faint borders: %s is %s', (css, expected) => {
    expect(status(audit(buttons, [css], 'platform-core'), 'platform-core/faint-borders')).toBe(expected);
  });

  const faq = (rowClass: string) => page(`<section><h2>Questions</h2>${['Can I cancel?', 'Do you store card data?', 'Is there a free plan?']
    .map((question) => `<div class="${rowClass}"><h3>${question}</h3><p>Yes. You can do this from the billing page at any time without calling us.</p></div>`).join('')}</section>`);
  it.each([
    ['border-y py-4', [], 'absent'],
    ['qa', ['.qa{border-style:solid;border-color:#e5e7eb;border-width:0 0 1px}'], 'absent'],
    ['border p-4', [], 'found'],
    ['qa', ['.qa{border:1px solid #e5e7eb;padding:16px}'], 'found'],
  ] as const)('soft-pastel cards: rows with class "%s" and css %j are %s', (rowClass, css, expected) => {
    expect(status(audit(faq(rowClass), [...css], 'soft-pastel'), 'soft-pastel/corner-radius')).toBe(expected);
  });

  it('reports a pattern it found as not verified, with no finding, once the selector budget runs out', () => {
    const carousel = `<section><h2>What owners say</h2><div class="swiper">${quotes}</div></section>`;
    const html = `<main><section><h1>Title</h1><p>Words here for the lede of the page.</p><img src="/a.png" width="900" alt="Screen"></section>${carousel}<section>${'<div><p>x</p></div>'.repeat(4000)}</section></main>`;
    expect(status(audit(html), 'testimonial-carousel')).toBe('found');
    const css = Array.from({ length: 1500 }, (_, i) => `section div:nth-child(${i}) { color: red }`).join('\n');
    const result = audit(html, [css]);
    expect(status(result, 'testimonial-carousel')).toBe('not-verified');
    expect(result.findings.map((finding) => finding.patternId)).not.toContain('testimonial-carousel');
    expect(result.results.find((item) => item.checkId === 'structure-testimonial-carousel')?.verdict).toBe('NOT_VERIFIED');
    expect(result.summary.clean).toBe(false);
  });

  it('resolves a 60-step custom-property chain and treats a 70-step one as invalid', () => {
    const chain = (steps: number) => {
      let css = ':root{--v0:rgba(0,0,0,.05);';
      for (let i = 1; i <= steps; i++) css += `--v${i}:var(--v${i - 1});`;
      return `${css}} .btn{border:1px solid var(--v${steps})}`;
    };
    expect(status(audit(buttons, [chain(60)], 'platform-core'), 'platform-core/faint-borders')).toBe('found');
    expect(status(audit(buttons, [chain(70)], 'platform-core'), 'platform-core/faint-borders')).toBe('absent');
  });

  it('audits fan-out above a chain that stays inside the depth limit in bounded time', () => {
    let css = ':root{';
    for (let i = 0; i < 40; i++) css += `--v${i}:var(--v${i + 1}) var(--v${i + 1});`;
    css += '--v40:#ff00ff;} .hero{background:var(--v0)}';
    expect(timed(() => audit(hero, [css]))).toBeLessThan(1000);
  });

  describe('the second review\'s hostile shapes at the 40,000-element limit', () => {
    const chain = (n: number, inner = '<p>text words here</p>') => `${'<div>'.repeat(n)}${inner}${'</div>'.repeat(n)}`;
    const N = 39_990;
    it.each([
      ['a descendant selector on a deep chain', () => audit(`<main>${productHero}<section><h2>x</h2>${chain(N)}</section></main>`, ['article div{color:red}'])],
      [':has() on a deep chain', () => audit(`<main>${productHero}<section><h2>x</h2>${chain(N)}</section></main>`, ['div:has(span){color:red}'])],
      ['a general sibling combinator across siblings', () => audit(`<main>${productHero}<section><h2>x</h2>${'<div>a</div>'.repeat(N)}</section></main>`, ['p ~ div{color:red}'])],
      ['180,000 stray end tags against a deep open stack', () => audit(`<main>${productHero}<section><h2>x</h2>${'<div>'.repeat(N)}${'</b>'.repeat(180000)}</section></main>`)],
      ['claims in one block', () => audit(`<main>${productHero}<section><h2>x</h2><div>${'<p>Trusted by 500 teams</p>'.repeat(N)}</div></section></main>`)],
      ['an animated chain with one quote', () => audit(`<main>${productHero}<section><h2>Quotes</h2>${chain(N, '<blockquote>one two three four five</blockquote>')}</section><section><h2>end</h2><p>closing words here now</p></section></main>`, ['div{animation:spin 1s infinite}'])],
      ['SVGs before the opening heading', () => audit(`<main><section class="text-center"><div>${'<svg><g></g></svg>'.repeat(N / 2)}</div><h1>Title words</h1><p>Some words for the paragraph line here.</p><a href="/a">Start free</a><a href="/b">Demo</a></section><section><h2>x</h2><p>y</p></section></main>`)],
      ['calls to action in the opening', () => audit(`<main><section class="text-center"><h1>Links</h1><p>Words for the subline go right here now.</p>${'<a href="/a">Go</a>'.repeat(N)}</section><section><h2>x</h2><p>y</p></section></main>`)],
    ])('%s', (_label, run) => {
      expect(timed(run)).toBeLessThan(1500);
    }, 60_000);
  });

  it('returns the same output for every fixture whatever order and styles are audited before it', () => {
    const files = readdirSync(fixtures).filter((file) => file.endsWith('.html')).sort();
    const styles = ['quiet-utility', 'soft-pastel', 'platform-core', 'brutalist-grid'];
    const runAll = (order: string[]) => Object.fromEntries(order.flatMap((file) => styles.map((styleId) => [`${file}:${styleId}`,
      JSON.stringify(audit(readFileSync(join(fixtures, file), 'utf8'), [], styleId))])));
    const forward = runAll(files);
    const reverse = runAll([...files].reverse());
    expect(reverse).toEqual(forward);
  }, 60_000);
});
