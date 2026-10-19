// Regression tests from the second independent review of #11. Each "defect" block reproduces a defect that review
// found in the merged change; the "verified" block pins behavior that was checked and held.
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { auditPageStructure, type StructureAuditResult } from '../src/structure/audit.js';

const repo = CatalogRepository.load();

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

// A centered all-text hero, a trusted-by logo band, a screenshot section, and a stock closing banner.
const templateSections = `<section class="relative py-24"><div class="mx-auto max-w-3xl text-center"><span class="text-xs">New: AI onboarding</span><h1 class="text-5xl">Four workflows, one employee record</h1><p class="mt-6">Hiring, onboarding, payroll, and reviews in one place, so your team can focus.</p><div class="flex justify-center gap-4"><a href="/signup">Start free trial</a><a href="/demo">Book a demo</a></div></div></section>
  <section class="py-12"><p class="text-center text-sm">Trusted by 2,000+ HR teams worldwide</p><div class="flex justify-between gap-8 opacity-60 grayscale">${['acme', 'globex', 'initech', 'umbrella', 'hooli'].map((name) => `<img src="/logos/${name}.svg" alt="${name}" class="h-8">`).join('')}</div></section>
  <section><h2>See a payroll run</h2><img src="/run.png" width="1200" height="700" alt="Payroll run"></section>
  <section class="py-24 text-center bg-indigo-700"><h2>Ready to get started?</h2><p>Join the teams that run HR in one place.</p><a href="/signup">Start free trial</a></section>`;
const TEMPLATE_FINDINGS = ['centered-stack-hero', 'closing-cta-banner', 'generic-saas-skeleton', 'logo-strip', 'trusted-by-band'];

describe('defect: a sibling element next to the content wrapper hides the page sections (no <main>)', () => {
  it('control: a Vite-style app root without <main> shows the whole template', () => {
    const result = audit(`<body><div id="root"><div class="app">${templateSections}</div></div><script type="module" src="/main.js"></script></body>`);
    expect(foundIds(result)).toEqual(TEMPLATE_FINDINGS);
  });

  it('still finds the template when an empty portal container follows the app root', () => {
    const result = audit(`<body><div id="root"><div class="app">${templateSections}</div></div><div id="portal-root"></div><script type="module" src="/main.js"></script></body>`);
    expect(foundIds(result)).toEqual(TEMPLATE_FINDINGS);
  });

  it('still finds the template when an empty toast region (shadcn/sonner) sits beside the page wrapper', () => {
    const result = audit(`<body><div id="root"><div class="app">${templateSections}</div><section aria-label="Notifications alt+T" tabindex="-1"><ol class="toaster"></ol></section></div></body>`);
    expect(foundIds(result)).toEqual(TEMPLATE_FINDINGS);
  });

  it('still finds the template when an announcement bar precedes the page wrapper', () => {
    const bar = '<div class="bg-indigo-600 py-2 text-center text-sm text-white">We raised our Series A. <a href="/blog">Read the post</a></div>';
    const result = audit(`<body>${bar}<div class="page">${templateSections}</div></body>`);
    expect(foundIds(result)).toEqual(TEMPLATE_FINDINGS);
  });

  it('still finds the closing banner when a skip link inside <main> precedes the wrapper', () => {
    const result = audit(`<body><main><a class="sr-only" href="#content">Skip to content</a><div id="content" class="mx-auto max-w-7xl">${templateSections}</div></main></body>`);
    expect(status(result, 'closing-cta-banner')).toBe('found');
  });
});

describe('defect: style bans that misread common markup', () => {
  const buttons = page('<section><h2>Plans</h2><p>Pick the plan that fits your locations.</p><button class="btn">Choose Team</button><button class="btn">Choose Pro</button></section>');

  it('platform-core: a transparent border reserved for hover states is not a faint visible border', () => {
    expect(status(audit(buttons, ['.btn{border:1px solid transparent;padding:8px 12px}'], 'platform-core'), 'platform-core/faint-borders')).not.toBe('found');
  });

  it('platform-core: a Bootstrap-style variable border that resolves to transparent is not a faint visible border', () => {
    const css = ':root{--bs-btn-border-color:transparent} .btn{--bs-btn-border-width:1px;border:var(--bs-btn-border-width) solid var(--bs-btn-border-color)}';
    expect(status(audit(buttons, [css], 'platform-core'), 'platform-core/faint-borders')).not.toBe('found');
  });

  const faq = (rowClass: string) => page(`<section><h2>Questions</h2>${['Can I cancel?', 'Do you store card data?', 'Is there a free plan?']
    .map((question) => `<div class="${rowClass}"><h3>${question}</h3><p>Yes. You can do this from the billing page at any time without calling us.</p></div>`).join('')}</section>`);

  it.each(['soft-pastel', 'claymorphism'])('%s: FAQ rows separated by a bottom rule are not sharp-cornered cards', (styleId) => {
    expect(status(audit(faq('qa'), ['.qa{border-bottom:1px solid #e5e7eb;padding:16px 0}'], styleId), `${styleId}/corner-radius`)).not.toBe('found');
    expect(status(audit(faq('border-b py-4'), [], styleId), `${styleId}/corner-radius`)).not.toBe('found');
  });

  it.each(['soft-pastel', 'claymorphism'])('%s: a visually hidden skip link is not a dark page section', (styleId) => {
    const html = `<body style="background:#fef7f0"><main><a class="skip" href="#c">Skip to content</a><section id="c"><h1>Plan a party</h1><p>Invite guests and split costs.</p><img src="/p.png" width="800" alt="Party board"></section>${closingSection}</main></body>`;
    const css = '.skip{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);background:#111;color:#fff}';
    expect(status(audit(html, [css], styleId), `${styleId}/canvas`)).not.toBe('found');
  });

  it('brutalist-grid: a pill from compiled Tailwind v4 CSS (radius calc(infinity * 1px)) is still a rounded pill', () => {
    const html = page('<section><h2>Plans</h2><a href="/buy" class="rounded-full px-4">Choose the team plan</a><p>Paid yearly, cancel any time.</p></section>');
    expect(status(audit(html, [], 'brutalist-grid'), 'brutalist-grid/corner-radius')).toBe('found');
    expect(status(audit(html, ['@layer utilities{.rounded-full{border-radius:calc(infinity * 1px)}}'], 'brutalist-grid'), 'brutalist-grid/corner-radius')).toBe('found');
  });
});

describe('defect: global detectors on common markup', () => {
  const review = (n: number) => `<article class="review"><div>★★★★☆</div><h3>Solid kettle</h3><p>Boils fast and the handle stays cool, though the lid sticks a little after a month (${n}).</p><p>Verified buyer</p></article>`;

  it('does not call a paginated list of product reviews a testimonial carousel', () => {
    const pager = '<nav aria-label="Pagination" class="flex gap-2"><button aria-label="Go to page 1">1</button><button aria-label="Go to page 2">2</button><button aria-label="Go to page 3">3</button></nav>';
    expect(status(audit(page(`<section><h2>Customer reviews</h2><p>4.3 out of 5 from 1,204 reviews</p>${[1, 2, 3, 4, 5].map(review).join('')}${pager}</section>`)), 'testimonial-carousel')).not.toBe('found');
  });

  it('does not call reviews with Previous/Next page buttons a testimonial carousel', () => {
    expect(status(audit(page(`<section><h2>Customer reviews</h2>${[1, 2, 3, 4, 5].map(review).join('')}<div class="flex gap-2"><button>Previous</button><button>Next</button></div></section>`)), 'testimonial-carousel')).not.toBe('found');
  });

  const featureIcon = (cls: string) => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon"><path d="M12 16.5V9.75"/></svg>`;
  const features = ['Push to deploy', 'SSL certificates', 'Simple queues', 'Advanced security'];
  const blurb = 'Morbi viverra dui mi arcu sed. Tellus semper adipiscing suspendisse semper morbi. Odio urna massa nunc massa.';

  it('finds Tailwind UI icon feature lists whose icon sits inside the <dt> before the title text', () => {
    const centered2x2 = `<div class="bg-white py-24"><div class="mx-auto max-w-7xl px-6"><div class="mx-auto max-w-2xl lg:text-center"><h2 class="text-base/7 font-semibold text-indigo-600">Deploy faster</h2><p class="mt-2 text-4xl font-semibold">Everything you need to deploy your app</p></div><dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2">${features.map((title) => `<div class="relative pl-16"><dt class="text-base/7 font-semibold"><div class="absolute top-0 left-0 flex size-10 items-center justify-center rounded-lg bg-indigo-600">${featureIcon('size-6 text-white')}</div>${title}</dt><dd class="mt-2 text-base/7">${blurb}</dd></div>`).join('')}</dl></div></div>`;
    const threeColumn = `<div class="bg-white py-24"><h2 class="text-base/7 font-semibold text-indigo-600">Deploy faster</h2><dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">${features.slice(0, 3).map((title) => `<div class="flex flex-col"><dt class="flex items-center gap-x-3 text-base/7 font-semibold">${featureIcon('size-5 flex-none text-indigo-600')}${title}</dt><dd class="mt-4 flex flex-auto flex-col text-base/7"><p class="flex-auto">${blurb}</p><p class="mt-6"><a href="#" class="text-sm/6 font-semibold">Learn more <span aria-hidden="true">→</span></a></p></dd></div>`).join('')}</dl></div>`;
    expect(status(audit(page(centered2x2)), 'icon-feature-grid')).toBe('found');
    expect(status(audit(page(threeColumn)), 'icon-feature-grid')).toBe('found');
  });

  it('finds icon feature cards whose icon sits inside the <h3> before the title text', () => {
    const cards = `<section><h2>Features</h2><div class="grid grid-cols-3 gap-8">${features.slice(0, 3).map((title) => `<div><h3 class="flex items-center gap-2">${featureIcon('h-5 w-5')}${title}</h3><p>${blurb}</p></div>`).join('')}</div></section>`;
    expect(status(audit(page(cards)), 'icon-feature-grid')).toBe('found');
  });

  const centeredCopy = '<div class="mx-auto max-w-2xl py-32"><div class="text-center"><h1 class="text-4xl font-bold tracking-tight sm:text-6xl">Data to enrich your online business</h1><p class="mt-6 text-lg leading-8">Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.</p><div class="mt-10 flex items-center justify-center gap-x-6"><a href="#" class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white">Get started</a><a href="#" class="text-sm font-semibold leading-6">Learn more <span aria-hidden="true">→</span></a></div></div></div>';
  const svgBlob = '<div class="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[-20rem]" aria-hidden="true"><svg class="relative left-[calc(50%-11rem)] -z-10 h-[21.1875rem] max-w-none -translate-x-1/2 rotate-[30deg]" viewBox="0 0 1155 678"><path fill="url(#hero-grad)" fill-opacity=".3" d="M317.219 518.975L203.852 678 0 438.341l317.219 80.634 204.172-286.402z"/><defs><linearGradient id="hero-grad" x1="1155.49" x2="-78.208" y1=".177" y2="474.645" gradientUnits="userSpaceOnUse"><stop stop-color="#9089FC"/><stop offset="1" stop-color="#FF80B5"/></linearGradient></defs></svg></div>';
  const imgBlob = '<img src="/decor/blob.svg" alt="" aria-hidden="true" class="pointer-events-none absolute left-1/2 top-0 -z-10 w-[900px] -translate-x-1/2 blur-2xl">';
  const heroWith = (decoration: string) => `<main><div class="relative isolate px-6 pt-14 lg:px-8">${decoration}${centeredCopy}</div><section><h2>Features</h2><p>Words about features for the second section here.</p></section></main>`;

  it('finds the Tailwind UI centered hero whose blob is an inline SVG painted with a <linearGradient>', () => {
    expect(status(audit(heroWith(svgBlob)), 'gradient-blob-hero')).toBe('found');
  });

  it('does not let an aria-hidden decorative SVG or image count as the product visual of an all-text centered stack', () => {
    expect(status(audit(heroWith('')), 'centered-stack-hero')).toBe('found');
    expect(status(audit(heroWith(svgBlob)), 'centered-stack-hero')).toBe('found');
    expect(status(audit(heroWith(imgBlob)), 'centered-stack-hero')).toBe('found');
  });

  it('checks the real hero when the site header carries a visually hidden brand h1', () => {
    const hero = templateSections.replace('<h1 class="text-5xl">', '<h2 class="text-5xl">').replace('</h1>', '</h2>');
    const result = audit(`<body><header><h1 class="sr-only">Acme Payroll</h1><nav><a href="/pricing">Pricing</a></nav></header><main>${hero}</main></body>`);
    expect(status(result, 'centered-stack-hero')).toBe('found');
  });
});

describe('defect: hostile input within the documented limits', () => {
  const hero = '<section><h1>Payroll for restaurants</h1><p>Run payroll for hourly staff with tips handled.</p><a href="/x">Try it</a><img src="/shot.png" width="800" height="500" alt="Payroll"></section>';
  const chain = (n: number, inner = '<p>text words here</p>') => `${'<div>'.repeat(n)}${inner}${'</div>'.repeat(n)}`;

  it('audits a stylesheet whose custom properties form a 3,000-step chain (60 KB) instead of overflowing the stack', () => {
    let css = ':root{--v0:#ff00ff;';
    for (let i = 1; i <= 3000; i++) css += `--v${i}:var(--v${i - 1});`;
    css += '} .hero{background:var(--v3000)}';
    expect(() => audit('<main><section class="hero"><h1>Ship invoices faster</h1><p>Some words here for the paragraph.</p></section></main>', [css])).not.toThrow();
  });

  it('matches a descendant selector on a 20,000-deep page in bounded time', () => {
    const html = `<main>${hero}<section><h2>x</h2>${chain(20000)}</section></main>`;
    expect(timed(() => audit(html, ['article div{color:red}']))).toBeLessThan(1500);
  }, 60_000);

  it('matches :has() on a 16,000-deep page in bounded time', () => {
    const html = `<main>${hero}<section><h2>x</h2>${chain(16000)}</section></main>`;
    expect(timed(() => audit(html, ['div:has(span){color:red}']))).toBeLessThan(1500);
  }, 60_000);

  it('matches a general sibling combinator across 20,000 siblings in bounded time', () => {
    const html = `<main>${hero}<section><h2>x</h2>${'<div>a</div>'.repeat(20000)}</section></main>`;
    expect(timed(() => audit(html, ['p ~ div{color:red}']))).toBeLessThan(1500);
  }, 60_000);

  it('parses stray end tags against a deep open stack in bounded time', () => {
    const html = `<main>${hero}<section><h2>x</h2>${'<div>'.repeat(20000)}${'</b>'.repeat(100000)}</section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 60_000);

  it('scans 12,000 short claim paragraphs in one block in bounded time', () => {
    const html = `<main>${hero}<section><h2>x</h2><div>${'<p>Trusted by 500 teams</p>'.repeat(12000)}</div></section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 60_000);

  it('scans an opening with 10,000 decorative SVGs before its heading in bounded time', () => {
    const html = `<main><section class="text-center"><div>${'<svg><g></g></svg>'.repeat(10000)}</div><h1>Title words</h1><p>Some words for the paragraph line here.</p><a href="/a">Start free</a><a href="/b">Demo</a></section><section><h2>x</h2><p>y</p></section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 60_000);

  it('looks for an animated quote track in a 20,000-deep animated chain in bounded time', () => {
    const html = `<main>${hero}<section><h2>Quotes</h2>${chain(20000, '<blockquote>one two three four five</blockquote>')}</section><section><h2>end</h2><p>closing words here now</p></section></main>`;
    expect(timed(() => audit(html, ['div{animation:spin 1s infinite}']))).toBeLessThan(1500);
  }, 60_000);

  it('collects 20,000 calls to action in the opening in bounded time', () => {
    const html = `<main><section class="text-center"><h1>Links</h1><p>Words for the subline go right here now.</p>${'<a href="/a">Go</a>'.repeat(20000)}</section><section><h2>x</h2><p>y</p></section></main>`;
    expect(timed(() => audit(html))).toBeLessThan(1500);
  }, 60_000);
});

describe('verified: evidence ids, determinism, and round-one fixes that hold', () => {
  it('validates evidence from three targets, one with a 154-character targetId, in a single audit result', () => {
    const html = templateSections;
    const longId = `checkout-flow/${'x'.repeat(140)}`;
    const runs = [['home-desktop', 1440], ['home-mobile', 390], [longId, 1024]] as const;
    const audits = runs.map(([targetId, viewportWidth]) => auditPageStructure({ html: `<main>${html}</main>`, styleId: 'quiet-utility', targetId, viewportWidth }, repo));
    for (const result of audits) for (const entry of result.evidence) expect(entry.id.length).toBeLessThanOrEqual(160);
    expect(audits[2]!.evidence[0]!.id).toMatch(/^structure:[0-9a-f]{16}:/);
    const validated = validateDesignAuditResult({
      plan: { styleId: 'quiet-utility', includeGroups: ['structure'] },
      targets: runs.map(([id, width]) => ({ id, surface: 'global' as const, viewport: { width, height: 900 } })),
      evidence: audits.flatMap((result) => result.evidence),
      results: audits.flatMap((result) => result.results),
    }, repo);
    expect(validated.issues).toEqual([]);
    expect(validated.valid).toBe(true);
  });

  it('returns identical output for the same input across repeated calls', () => {
    const html = `<main>${templateSections}</main>`;
    const first = JSON.stringify(audit(html, [], 'neon-drift'));
    audit('<main><section><h1>Other page</h1><p>Different words.</p></section></main>', ['.x{color:red}'], 'brutalist-grid');
    expect(JSON.stringify(audit(html, [], 'neon-drift'))).toBe(first);
  });

  it('audits a stylesheet whose custom properties form a cycle, and a short 1,000-step chain, without throwing', () => {
    let css = ':root{--a:var(--b);--b:var(--a);--v0:#ff00ff;';
    for (let i = 1; i <= 1000; i++) css += `--v${i}:var(--v${i - 1});`;
    css += '} .hero{background:var(--v1000);color:var(--a, red)}';
    expect(() => audit('<main><section class="hero"><h1>Ship invoices faster</h1><p>Some words here for the paragraph.</p></section></main>', [css])).not.toThrow();
  });
});
