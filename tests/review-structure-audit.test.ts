// Regression tests from the first independent review of #11. Each "defect" block reproduces a defect that review
// found in the change as submitted; the "verified" block pins behavior that was checked and held.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { planDesignAudit } from '../src/audit/planner.js';
import { auditPageStructure, type StructureAuditResult } from '../src/structure/audit.js';
import { STRUCTURE_GUIDES } from '../src/structure/guides/index.js';
import { duplicateGuidance } from '../src/structure/validate.js';
import type { StructureGuideDef } from '../src/structure/types.js';

const repo = CatalogRepository.load();
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'page-structure');
const fixture = (file: string) => readFileSync(join(fixtures, file), 'utf8');

const audit = (html: string, css: string[] = [], styleId?: string, viewportWidth?: number) =>
  auditPageStructure({ html, css, styleId, viewportWidth }, repo);
const status = (result: StructureAuditResult, patternId: string) =>
  result.checks.find((check) => check.patternId === patternId)?.status;
const timed = (run: () => unknown) => {
  const started = performance.now();
  run();
  return performance.now() - started;
};

const productHero = '<section><h1 class="text-4xl">Payroll for restaurants</h1><p>Run payroll for hourly staff with tips handled.</p><a href="/x">Try it</a><img src="/shot.png" width="800" height="500" alt="Payroll run screen"></section>';
const closingSection = '<section><h2>Pricing</h2><p>One plan per location, billed monthly with no setup fee.</p></section>';
const page = (inner: string) => `<main>${productHero}${inner}${closingSection}</main>`;
const quote = '<figure><blockquote>“We closed payroll in ten minutes on the first try, no support ticket needed.”</blockquote><figcaption>Dana, Cafe Uno</figcaption></figure>';
const checkIcon = '<svg class="h-5 w-5" viewBox="0 0 20 20" aria-hidden="true"><path d="M1 1"/></svg>';

describe('defect: hostile or unusual CSS', () => {
  const hero = '<main><section class="hero"><h1>Ship invoices faster</h1><p>Some words here for the paragraph.</p></section></main>';

  it('audits a page whose custom properties form a cycle instead of throwing', () => {
    expect(() => audit(hero, [':root{--a: var(--b); --b: var(--a)} .hero{background: var(--a)}'])).not.toThrow();
  });

  it('audits a page with a self-referencing custom property fallback instead of throwing', () => {
    expect(() => audit(hero, [':root{--x: var(--x, red)} .hero{background: var(--x)}'])).not.toThrow();
  });

  it('resolves fanned-out custom properties in bounded time (under 1 KB of CSS)', () => {
    let css = ':root{';
    for (let i = 0; i < 23; i++) css += `--v${i}: var(--v${i + 1}) var(--v${i + 1});`;
    css += '--v23: 1px;} .hero{background: var(--v0)}';
    expect(css.length).toBeLessThan(1024);
    expect(timed(() => audit(hero, [css]))).toBeLessThan(1000);
  }, 60_000);

  it('matches a five-compound descendant selector on a 140-deep page in bounded time', () => {
    const html = `<main><section><h1>Title here</h1>${'<div>'.repeat(140)}<p>text words here</p>${'</div>'.repeat(140)}</section></main>`;
    expect(timed(() => audit(html, ['article div div div div p{color:red}']))).toBeLessThan(1000);
  }, 60_000);

  it('checks text on effects for nested list items in bounded time', () => {
    const html = `<main><section><h1>T</h1><img src="/a.png" width="600"></section><section>${'<ul><li>one two three four five six seven'.repeat(3000)}${'</li></ul>'.repeat(3000)}</section></main>`;
    expect(timed(() => audit(html, [], 'aurora-gradient'))).toBeLessThan(1500);
  }, 60_000);
});

describe('defect: evidence for more than one target', () => {
  it('lets structure evidence from two targets validate in one audit result', () => {
    const desktop = auditPageStructure({ html: fixture('generic-saas-tailwind.html'), styleId: 'quiet-utility', targetId: 'home-desktop', viewportWidth: 1440 }, repo);
    const mobile = auditPageStructure({ html: fixture('generic-saas-tailwind.html'), styleId: 'quiet-utility', targetId: 'home-mobile', viewportWidth: 390 }, repo);
    const validated = validateDesignAuditResult({
      plan: { styleId: 'quiet-utility', includeGroups: ['structure'] },
      targets: [
        { id: 'home-desktop', surface: 'global', viewport: { width: 1440, height: 900 } },
        { id: 'home-mobile', surface: 'global', viewport: { width: 390, height: 844 } },
      ],
      evidence: [...desktop.evidence, ...mobile.evidence],
      results: [...desktop.results, ...mobile.results],
    }, repo);
    expect(validated.issues.map((issue) => issue.code)).not.toContain('DUPLICATE_EVIDENCE_ID');
    expect(validated.valid).toBe(true);
  });
});

describe('defect: global detector false positives on legitimate content', () => {
  it('does not read a pricing seat limit as a "trusted by" claim (English)', () => {
    const result = audit(page(`<section><h2>Pricing</h2><div class="grid grid-cols-3 gap-6">
      <div class="rounded-xl border p-6"><h3>Starter</h3><p>$29 per month</p><ul><li>${checkIcon}Can be used by 5 people</li><li>${checkIcon}Automatic payslips</li><li>${checkIcon}Email support</li></ul><a href="/buy">Choose plan</a></div>
      <div class="rounded-xl border p-6"><h3>Team</h3><p>$99 per month</p><ul><li>${checkIcon}Can be used by 50 people</li><li>${checkIcon}Time clock sync</li><li>${checkIcon}Phone support</li></ul><a href="/buy">Choose plan</a></div>
    </div></section>`));
    expect(status(result, 'trusted-by-band')).not.toBe('found');
  });

  it('does not read a pricing seat limit as a "trusted by" claim (Korean)', () => {
    const result = audit(page(`<section><h2>요금제</h2><div class="grid grid-cols-3 gap-6">
      <div class="rounded-xl border p-6"><h3>스타터</h3><p>월 29,000원</p><ul><li>${checkIcon}최대 5명 사용자 이용 가능</li><li>${checkIcon}급여 명세서 자동 발송</li><li>${checkIcon}이메일 지원</li></ul><a href="/buy">선택하기</a></div>
    </div></section>`));
    expect(status(result, 'trusted-by-band')).not.toBe('found');
  });

  it('does not read a descriptive Japanese sentence about trustworthy records as a "trusted by" claim', () => {
    const result = audit('<main><section><h1>飲食店のための給与計算</h1><p>時給スタッフの給与とチップを毎週まとめて計算します。</p><a href="/x">試す</a><img src="/shot.png" width="800" height="500" alt="画面"></section><section><h2>設計の考え方</h2><p>監査に耐える、信頼される記録を残します。</p></section><section><h2>料金</h2><p>店舗ごとの月額料金です。初期費用はありません。</p></section></main>');
    expect(status(result, 'trusted-by-band')).not.toBe('found');
  });

  it('does not treat "Preview" and "Next" action buttons beside static quotes as carousel controls', () => {
    const result = audit(page(`<section><h2>From the field</h2>${quote}${quote}<div class="flex gap-2"><button type="button">Preview payslip</button><button type="button">Next: tax forms</button></div></section>`));
    expect(status(result, 'testimonial-carousel')).not.toBe('found');
  });

  it('does not treat icon-font share buttons beside static quotes as slide dots', () => {
    const result = audit(page(`<section><h2>From the field</h2>${quote}${quote}<div class="flex gap-2"><button aria-label="Share on X"><i class="fa fa-x-twitter"></i></button><button aria-label="Share on LinkedIn"><i class="fa fa-linkedin"></i></button><button aria-label="Copy link"><i class="fa fa-link"></i></button></div></section>`));
    expect(status(result, 'testimonial-carousel')).not.toBe('found');
  });

  it('does not treat template preview cards as testimonial quotes', () => {
    const result = audit(page(`<section><h2>Start from a template</h2><div class="flex gap-4">
      <div class="template-preview"><h3>Weekly payroll</h3><p>Runs every Friday with tips split by hours worked.</p></div>
      <div class="template-preview"><h3>Biweekly payroll</h3><p>Runs every other Friday with overtime calculated automatically.</p></div>
      <div class="template-preview"><h3>Monthly salaried</h3><p>Runs on the last business day for salaried managers.</p></div>
      </div><button aria-label="Previous templates">‹</button><button aria-label="Next templates">›</button></section>`));
    expect(status(result, 'testimonial-carousel')).not.toBe('found');
  });

  it('ignores a mobile-only carousel that is display:none at the audited 1440px viewport', () => {
    const result = audit(page(`<section><h2>What owners say</h2>
      <div class="hidden md:grid md:grid-cols-3 gap-6">${quote}${quote}${quote}</div>
      <div class="md:hidden swiper"><div class="swiper-wrapper">${quote}${quote}${quote}</div></div></section>`), [], undefined, 1440);
    expect(status(result, 'testimonial-carousel')).not.toBe('found');
  });

  it('ignores a logo row inside a display:none ancestor', () => {
    const result = audit(page(`<section><h2>Who we work with</h2><p>Restaurants of every size run payroll here every week.</p>
      <div style="display:none"><div class="flex gap-8 opacity-50"><img src="/logo-a.svg" alt="Acme logo"><img src="/logo-b.svg" alt="Globex logo"><img src="/logo-c.svg" alt="Initech logo"><img src="/logo-d.svg" alt="Hooli logo"></div></div></section>`));
    expect(status(result, 'logo-strip')).not.toBe('found');
  });

  it('does not read a team grid with 64px avatar photos as icon feature cards', () => {
    const person = (name: string) => `<div><img src="/team/${name}.jpg" class="h-16 w-16 rounded-full" alt="${name}"><h3>${name} Lima</h3><p>Founder. Previously built payroll systems at a large company for six years.</p></div>`;
    const result = audit(page(`<section><h2>The team</h2><div class="grid grid-cols-3 gap-8">${person('Ana')}${person('Ben')}${person('Cy')}</div></section>`));
    expect(status(result, 'icon-feature-grid')).not.toBe('found');
  });

  it('does not read category tiles with product thumbnails as icon feature cards', () => {
    const tile = (name: string) => `<a href="/c/${name}" class="block rounded border p-4"><img src="/cat/${name}.webp" width="56" height="56" alt=""><h3>${name}</h3><p>Hand thrown pieces in stoneware and porcelain, fired twice.</p></a>`;
    const result = audit(page(`<section><h2>Shop by category</h2><div class="grid grid-cols-4 gap-4">${tile('Mugs')}${tile('Bowls')}${tile('Plates')}${tile('Vases')}</div></section>`));
    expect(status(result, 'icon-feature-grid')).not.toBe('found');
  });

  it('does not call a centered opening with a hand-built HTML product mock an all-text stack', () => {
    const row = (id: string, amount: string, state: string) => `<div class="flex justify-between py-2"><span>#${id}</span><span>${amount}</span><span class="rounded px-2">${state}</span></div>`;
    const mock = `<div class="mx-auto mt-12 max-w-4xl rounded-xl border bg-white p-4 text-left shadow-xl" aria-label="Invoice queue preview"><div class="flex justify-between border-b pb-2"><span>Invoice queue</span><span>3 waiting</span></div>${row('1042 Northwind', '$4,200', 'Needs approval')}${row('1041 Contoso', '$980', 'Paid')}${row('1040 Fabrikam', '$12,500', 'Scheduled Fri')}</div>`;
    const result = audit(`<main><section class="py-24 text-center"><p class="text-sm">Accounts payable</p><h1 class="text-5xl">Approve every invoice from one queue</h1><p class="mt-4">Invoices arrive by email, get coded automatically, and wait here for one click.</p><div class="flex justify-center gap-3"><a href="/start">Start free</a><a href="/demo">See a demo</a></div>${mock}</section><section><h2>How coding works</h2><p>Rules map vendors to accounts and learn from your edits.</p></section>${closingSection}</main>`);
    expect(status(result, 'centered-stack-hero')).not.toBe('found');
  });

  it('does not call an in-app onboarding panel a generic closing CTA banner', () => {
    const result = audit(`<body><div class="flex"><aside><nav><a href="/">Overview</a><a href="/runs">Runs</a></nav></aside><main class="flex-1 p-8">
      <header class="flex justify-between"><h1>Overview</h1><button>New run</button></header>
      <section class="grid grid-cols-4 gap-4"><div class="rounded-lg border p-4"><p>Runs today</p><p>128</p></div><div class="rounded-lg border p-4"><p>Failed</p><p>3</p></div></section>
      <section class="rounded-lg border p-4"><h2>Get started</h2><p>Connect a repository to start your first run.</p><a href="/connect">Connect repository</a></section>
    </main></div></body>`);
    expect(status(result, 'closing-cta-banner')).not.toBe('found');
  });
});

describe('defect: global detector false negatives on common markup', () => {
  it('finds the Tailwind UI centered hero blob (blur on the aria-hidden wrapper, gradient on its child)', () => {
    const result = audit(`<main><div class="relative isolate px-6 pt-14 lg:px-8">
      <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30" style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 74.1% 44.1%)"></div>
      </div>
      <div class="mx-auto max-w-2xl py-32"><div class="text-center">
        <h1 class="text-5xl font-semibold tracking-tight">Data to enrich your online business</h1>
        <p class="mt-8 text-lg">Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.</p>
        <div class="mt-10 flex items-center justify-center gap-x-6"><a href="#" class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-white">Get started</a><a href="#">Learn more →</a></div>
      </div></div>
    </div><section><h2>Features</h2><p>Words about features for the second section here.</p></section></main>`);
    expect(status(result, 'gradient-blob-hero')).toBe('found');
  });

  it('finds an Unsplash hero served through the Next.js image optimizer (next/image)', () => {
    const src = '/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1521737604893-d14cc237f11d%3Fw%3D2830&amp;w=3840&amp;q=75';
    const result = audit(`<main><section class="relative isolate overflow-hidden">
      <img alt="" sizes="100vw" srcset="${src} 3840w" src="${src}" decoding="async" data-nimg="fill" class="absolute inset-0 -z-10 h-full w-full object-cover" style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;color:transparent">
      <div class="mx-auto max-w-2xl py-32"><h1>Hire the people who build your company</h1><p>Recruiting software for teams that hire every week.</p><a href="/signup">Start hiring</a></div>
      </section><section><h2>How it works</h2><p>Post a role, review candidates, send offers.</p></section></main>`);
    expect(status(result, 'stock-photo-hero')).toBe('found');
  });

  it('reads "Trusted by the world’s most innovative teams" with a typographic apostrophe as a trusted-by claim', () => {
    const cloud = (heading: string) => page(`<section class="py-24"><h2 class="text-center">${heading}</h2><div class="mx-auto grid grid-cols-5 gap-8">${['transistor', 'reform', 'tuple', 'savvycal', 'statamic'].map((name) => `<img class="max-h-12 w-full object-contain" src="/logos/${name}-logo-gray-900.svg" alt="${name}" width="158" height="48">`).join('')}</div></section>`);
    expect(status(audit(cloud("Trusted by the world's most innovative teams")), 'trusted-by-band')).toBe('found');
    expect(status(audit(cloud('Trusted by the world&rsquo;s most innovative teams')), 'trusted-by-band')).toBe('found');
  });

  it('applies lg: after md: regardless of class order, so a 6-column logo grid is a row at 1440px', () => {
    const logos = (cls: string) => page(`<section class="py-16"><h2 class="sr-only">Customers</h2><div class="${cls}">${['acme', 'globex', 'initech', 'umbrella', 'hooli', 'stark'].map((name) => `<img class="h-10 w-auto grayscale" src="/${name}.svg" alt="${name}">`).join('')}</div></section>`);
    expect(status(audit(logos('mx-auto grid grid-cols-2 gap-8 lg:grid-cols-6 md:grid-cols-3')), 'logo-strip')).toBe('found');
    expect(status(audit(logos('mx-auto grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6')), 'logo-strip')).toBe('found');
  });

  it('sees the same sections when the page wraps them in one container inside <main>', () => {
    const sections = `
      <section class="relative py-24"><div class="mx-auto max-w-3xl text-center"><span class="text-xs">New: AI onboarding</span><h1 class="text-5xl">Four workflows, one employee record</h1><p class="mt-6">Hiring, onboarding, payroll, and reviews in one place, so your team can focus.</p><div class="flex justify-center gap-4"><a href="/signup">Start free trial</a><a href="/demo">Book a demo</a></div></div></section>
      <section class="py-12"><p class="text-center text-sm">Trusted by 2,000+ HR teams worldwide</p><div class="flex justify-between gap-8 opacity-60 grayscale">${['acme', 'globex', 'initech', 'umbrella', 'hooli'].map((name) => `<img src="/logos/${name}.svg" alt="${name}" class="h-8">`).join('')}</div></section>
      <section><h2>See a payroll run</h2><img src="/run.png" width="1200" height="700" alt="Payroll run"></section>
      <section class="py-24 text-center"><h2>Ready to get started?</h2><p>Join the teams that run HR in one place.</p><a href="/signup">Start free trial</a></section>`;
    const found = (result: StructureAuditResult) => result.checks.filter((check) => check.status === 'found').map((check) => check.patternId).sort();
    const direct = audit(`<body><main>${sections}</main><footer><p>© 2026</p></footer></body>`);
    const wrapped = audit(`<body><main><div class="mx-auto max-w-7xl">${sections}</div></main><footer><p>© 2026</p></footer></body>`);
    expect(found(direct)).toEqual(expect.arrayContaining(['centered-stack-hero', 'closing-cta-banner', 'generic-saas-skeleton']));
    expect(found(wrapped)).toEqual(found(direct));
  });
});

describe('defect: an opening without an h1 is reported as not applicable', () => {
  it('does not mark the opening checks NOT_APPLICABLE (a verified slot) when the hero headline is an h2', () => {
    const html = fixture('gradient-blob-hero.html').replace(/<h1/g, '<h2').replace(/<\/h1>/g, '</h2>');
    const result = auditPageStructure({ html, targetId: 'home' }, repo);
    const verdict = result.results.find((item) => item.checkId === 'structure-gradient-blob-hero')?.verdict;
    expect(['FIX_NOW', 'NOT_VERIFIED']).toContain(verdict);
  });
});

describe('defect: style-specific bans that misread the page', () => {
  const body = (inner: string) => `<main><section><h1>Job queue for small labs</h1><p>Submit a run, watch it move through the queue, collect the output files.</p><a href="/x">Open the queue</a><img src="/q.png" width="900" height="500" alt="Queue"></section>${inner}<section><h2>Pricing</h2><p>Per seat, billed monthly, cancel any time without a call.</p></section></main>`;

  it('y2k-retro: Tailwind transition-none disables transitions instead of adding a 150ms one', () => {
    const result = audit(body('<section><h2>Runs</h2><button class="transition-none border-2 px-3">Run now</button><p>Each run keeps a full log you can download later.</p></section>'), [], 'y2k-retro');
    expect(status(result, 'y2k-retro/eased-motion')).not.toBe('found');
  });

  it('editorial-silence: error and success messages in the contract\'s own status colors are not banned accent hues', () => {
    const style = repo.getStyle('editorial-silence')!;
    const colors = style.visualContract!.modes[style.visualContract!.defaultMode]!.colors as Record<string, string>;
    const css = `body{background:${colors.canvas};color:${colors.text}} .err{color:${colors.critical}} .ok{color:${colors.positive}}`;
    const result = audit('<main><section><h1>Notes on slow software</h1><p>Essays about tools that respect attention, one a month.</p><form><input type="email" aria-label="Email"><button>Subscribe</button><p class="err">That address bounced last time.</p><p class="ok">Subscribed. The next essay arrives on the first.</p></form></section><section><h2>Archive</h2><p>Twelve essays so far, each under ten minutes.</p></section></main>', [css], 'editorial-silence');
    expect(status(result, 'editorial-silence/accent-hues')).not.toBe('found');
  });

  it('midnight-noir: its own gold-hairline-ledger move (28px bordered thumbnails) does not trip its icon-tiles ban', () => {
    const row = (name: string) => `<li class="row"><img src="/pieces/${name}.jpg" class="thumb" width="28" height="28" alt=""><span>${name}</span><span>One sentence about the piece.</span><span>€420</span></li>`;
    const css = '.ledger{border-top:1px solid rgba(255,255,255,.12)} .row{display:grid;grid-template-columns:56px minmax(120px,200px) 1fr auto;border-bottom:1px solid rgba(255,255,255,.12)} .thumb{border:1px solid rgba(255,255,255,.2)}';
    const result = audit(`<main><section><h1>Atelier Noir</h1><p>Private commissions, four a season.</p><img src="/hero.jpg" width="900" alt="Studio"></section><section><h2>The pieces</h2><ul class="ledger">${row('Onyx')}${row('Umber')}${row('Ash')}</ul></section><section><h2>Request</h2><p>Write to the studio to reserve a place this season.</p></section></main>`, [css], 'midnight-noir');
    expect(status(result, 'midnight-noir/icon-tiles')).not.toBe('found');
  });

  it('retro-pixel: a stepped transition (the fix the rule itself recommends) is not a smooth eased transition', () => {
    const result = audit(body('<section><h2>HP</h2><div class="bar"><div class="fill"><p>Health points fill in steps</p></div></div></section>'), ['.fill{width:60%;transition:width 1s steps(10)}'], 'retro-pixel');
    expect(status(result, 'retro-pixel/eased-motion')).not.toBe('found');
  });

  it('runtime-signal: a dark canvas on the app wrapper is not reported as a light (assumed white) canvas', () => {
    const result = audit(`<body><div class="min-h-screen bg-zinc-950 text-zinc-100">${body('')}</div></body>`, [], 'runtime-signal');
    expect(status(result, 'runtime-signal/canvas')).not.toBe('found');
  });

  it('brutalist-grid: an author-defined .shadow class keeps its own hard shadow instead of the Tailwind default', () => {
    const result = audit(body('<section><h2>Runs</h2><div class="card shadow"><h3>Run 42</h3><p>Finished in 3 minutes with 12 output files.</p></div></section>'), ['.shadow{box-shadow:6px 6px 0 #111}'], 'brutalist-grid');
    expect(status(result, 'brutalist-grid/shadow-blur')).not.toBe('found');
  });

  it('zen-minimalism: a 12-column layout grid holding two spans is not a crowded grid', () => {
    const result = audit(body('<section><h2>Method</h2><div class="grid grid-cols-12 gap-8"><div class="col-span-7"><p>Long reading text of the method in one column.</p></div><div class="col-span-5"><p>A margin note that sits beside the reading column.</p></div><div class="col-span-12"><p>A full-width closing paragraph under both.</p></div></div></section>'), [], 'zen-minimalism');
    expect(status(result, 'zen-minimalism/crowded-grid')).not.toBe('found');
  });

  it('zen-minimalism: a serif display stack ("Vollkorn", Georgia, serif) satisfies the serif requirement', () => {
    const result = audit(body(''), ['h1,h2{font-family:"Vollkorn", Georgia, serif} body{font-family:"Inter", sans-serif}'], 'zen-minimalism');
    expect(status(result, 'zen-minimalism/typeface')).not.toBe('found');
  });

  it('soft-pastel: a full-bleed tinted section band is not a sharp-cornered card', () => {
    const result = audit(`<body style="background:#fffaf5">${body('<section style="background:#fdf2f8;padding:64px 0"><h2>How it works</h2><p>Pick a template, invite your team, and share the board.</p></section>')}</body>`, [], 'soft-pastel');
    expect(status(result, 'soft-pastel/corner-radius')).not.toBe('found');
  });
});

describe('defect: replacement guidance', () => {
  it('names a style-specific replacement for a generic closing banner (a move or the archetype closing step)', () => {
    const result = auditPageStructure({ html: fixture('generic-saas-tailwind.html'), styleId: 'brutalist-grid' }, repo);
    const finding = result.findings.find((item) => item.patternId === 'closing-cta-banner')!;
    expect(finding).toBeDefined();
    expect(finding.replaceWith.moves.length > 0 || (finding.replaceWith.archetype?.sectionOrder?.length ?? 0) > 0).toBe(true);
  });
});

describe('verified: backward compatibility and guards that hold', () => {
  it('keeps the pre-change plan hash for plans requested without the structure group', () => {
    // Hashes computed from the HEAD (5a783c9) build before this change.
    const baseline: Array<[Parameters<typeof planDesignAudit>[0], string]> = [
      [{}, 'sha256:ec2b2ce55031fa182a2b06d9c40c19c5302f5de97eebf93b58742b2745980a78'],
      [{ styleId: 'quiet-utility' }, 'sha256:bfa253bcc026f90c287ca6ff1812e1655600235bbf37df4b3842d8ea9c593e70'],
      [{ locale: 'ko' }, 'sha256:e20e1736697824e910b7a40f0f7baad32d1dc8bd5c55bc09a789b5d9aefa8ab5'],
      [{ locale: 'ja', styleId: 'editorial-silence' }, 'sha256:6349211bfdf9ef2016bd67b47f31605440f4001081f9f83874cac3838ed1d796'],
      [{ surfaces: ['landing-page'] }, 'sha256:a53e3dc8037e6d78797fe718fcc6a0c165ae322e618e88e3cc1a32e5061d2963'],
      [{ surfaces: ['form', 'data-table'], styleId: 'runtime-signal' }, 'sha256:dde53ab2d32a2cb185c28749fbbe12d1aeba798d94ab4b48d75127d8fe1f3370'],
      [{ includeGroups: ['layout', 'fidelity', 'anti-patterns'] }, 'sha256:d8bfe180a4342cfe38ce87455692bb077f29d99cec3c8de1f4247aaaaa5ae61a'],
      [{ includeDocumentation: false, surfaces: ['checkout'], locale: 'ja' }, 'sha256:13c9d741ef5c6fed1d1ef047b35ed22ba491acc5cb6aa90a4e0b2a9fa8ed8a16'],
    ];
    for (const [query, hash] of baseline) expect(planDesignAudit(query, repo).identity.planHash, JSON.stringify(query)).toBe(hash);
  });

  it('flags a copied guide even when every third word is replaced or the word order is reversed', () => {
    const base = STRUCTURE_GUIDES.find((item) => item.styleId === 'brutalist-grid')!;
    const rewrite = (transform: (text: string) => string): StructureGuideDef => ({
      ...base,
      styleId: 'swiss-poster',
      hero: transform(base.hero),
      grid: transform(base.grid),
      density: transform(base.density),
      typeScale: transform(base.typeScale),
      sectionOrder: base.sectionOrder.map(transform),
      moves: base.moves.map((move, index) => ({ ...move, id: `rewritten-${index}`, name: `${transform(move.name)} variant`, build: transform(move.build), purpose: transform(move.purpose) })),
    });
    let replaced = 0;
    const everyThird = (text: string) => text.split(' ').map((word, index) => ((index + 1) % 3 === 0 ? `zq${replaced++}` : word)).join(' ');
    const reversed = (text: string) => text.split(' ').reverse().join(' ');
    expect(duplicateGuidance([base, rewrite(everyThird)], repo).length).toBeGreaterThan(0);
    expect(duplicateGuidance([base, rewrite(reversed)], repo).length).toBeGreaterThan(0);
  });

  it('detects the whole template on a CSS-modules page when its stylesheet is submitted', () => {
    const html = `<main>
      <section class="Hero_hero__q9"><div class="Hero_glow__r5" aria-hidden="true"></div><div class="Hero_inner__u7"><p class="Hero_eyebrow__p1">Bookkeeping, automated</p><h1>Your books, closed before Monday</h1><p>Ledgerly reconciles every transaction overnight so your month-end takes minutes.</p><a href="/signup">Start free trial</a><a href="/demo">Watch demo</a></div></section>
      <section><p class="Logos_caption__w3">Trusted by 4,000+ finance teams</p><ul class="Logos_row__t5">${['a', 'b', 'c', 'd', 'e'].map((name) => `<li><img src="/brands/${name}.svg" alt="${name}"></li>`).join('')}</ul></section>
      <section><h2>Everything finance needs</h2><div class="Features_grid__f1">${['Bank sync', 'Auto categorize', 'Close checklist'].map((title) => `<article class="Features_card__j3"><span class="Features_icon__z5"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg></span><h3>${title}</h3><p>Connect every account and card and see balances update in real time.</p></article>`).join('')}</div></section>
      <section><h2>Loved by accountants</h2><div class="Quotes_track__m9">${quote}${quote}${quote}</div></section>
      <section class="Cta_section__s7"><h2>Ready to close faster?</h2><p>Join thousands of finance teams on Ledgerly.</p><a href="/signup">Get started free</a></section>
    </main>`;
    const css = `.Hero_hero__q9{position:relative;overflow:hidden}
      .Hero_glow__r5{position:absolute;width:720px;height:720px;border-radius:50%;background:radial-gradient(circle,#7c3aed,#ec4899 60%,transparent 70%);filter:blur(80px);z-index:-1}
      .Hero_inner__u7{display:flex;flex-direction:column;align-items:center;text-align:center}
      .Logos_row__t5{display:flex;justify-content:space-between;filter:grayscale(1);opacity:.6}
      .Features_grid__f1{display:grid;grid-template-columns:repeat(3,1fr)}
      .Features_icon__z5{display:inline-flex;width:48px;height:48px}
      .Quotes_track__m9{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}
      .Cta_section__s7{text-align:center}`;
    const result = audit(html, [css]);
    for (const id of ['gradient-blob-hero', 'logo-strip', 'trusted-by-band', 'icon-feature-grid', 'closing-cta-banner', 'generic-saas-skeleton']) {
      expect(status(result, id), id).toBe('found');
    }
  });
});

describe('defect: a quote-named wrapper hides its quotes', () => {
  const card = (n: number) => `<figure class="card"><blockquote>“Payroll used to take me a whole Sunday, now it is ten minutes.”</blockquote><figcaption>Owner ${n}</figcaption></figure>`;
  const carousel = (sectionAttrs: string, trackClass: string) => page(`<section${sectionAttrs}><h2>Loved by owners</h2><div class="${trackClass}">${card(1)}${card(2)}${card(3)}</div><button aria-label="Previous">‹</button><button aria-label="Next">›</button></section>`);
  const snapCss = (trackClass: string) => [`.${trackClass}{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}`];

  it('control: a scroll-snap track with arrows and three quotes is a testimonial carousel', () => {
    expect(status(audit(carousel('', 'track'), snapCss('track')), 'testimonial-carousel')).toBe('found');
  });

  it('still finds the carousel when its section carries the usual id="testimonials" anchor', () => {
    expect(status(audit(carousel(' id="testimonials"', 'track'), snapCss('track')), 'testimonial-carousel')).toBe('found');
  });

  it('still finds the carousel when a CSS-modules track class is derived from a Quotes component', () => {
    expect(status(audit(carousel('', 'Quotes_track__m9'), snapCss('Quotes_track__m9')), 'testimonial-carousel')).toBe('found');
  });
});
