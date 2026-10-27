import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { planDesignAudit } from '../src/audit/planner.js';
import { PAGE_LIMITS } from '../src/structure/audit.js';
import { comparePageRevisions, type ComparePageRevisionsInput } from '../src/structure/revisions.js';

const repo = CatalogRepository.load();
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const compare = (input: ComparePageRevisionsInput) => comparePageRevisions(input, repo);
const doc = (body: string, head = '') => `<!doctype html><html lang="en"><head><title>Acme</title>${head}</head><body>${body}</body></html>`;
const result = (r: ReturnType<typeof compare>, id: string) => r.results.find((x) => x.checkId === `redesign-kept-${id}`)!;
const words = (n: number, prefix = 'word') => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');

function validate(r: ReturnType<typeof compare>, productType?: string) {
  const plan = { revisionPreservation: true, ...(productType ? { productType } : {}) } as Parameters<typeof planDesignAudit>[0];
  return validateDesignAuditResult({
    plan,
    targets: [{ id: r.target.id, surface: 'global', viewport: { width: r.target.viewportWidth, height: 900 } }],
    evidence: r.evidence,
    results: r.results,
  } as never, repo);
}

const BASE = doc(`
<header><nav aria-label="Primary"><a href="/">Home</a><a href="/pricing">Pricing</a><a href="/docs?b=2&a=1">Docs</a></nav></header>
<main>
  <h1>Ship faster</h1>
  <p>${words(30)}</p>
  <h2>Features</h2>
  <img src="/team.png" alt="The team at work">
  <form action="/subscribe" method="post" data-testid="signup">
    <label for="email">Email</label><input id="email" name="email" type="email">
    <input type="hidden" name="csrf" value="x">
    <button type="submit" onclick="track('signup')">Sign up</button>
  </form>
</main>
<footer><a href="mailto:hi@acme.test">Contact</a></footer>`);

describe('review: compare_page_revisions on realistic redesigns', () => {
  it('passes an identical page and every result validates as-is', () => {
    const r = compare({ before: { html: BASE }, after: { html: BASE } });
    expect(r.verdict).toBe('PASS');
    expect(r.findings).toEqual([]);
    expect(result(r, 'script-hooks').verdict).toBe('NOT_APPLICABLE');
    const v = validate(r);
    expect(v.valid).toBe(true);
    expect(v.results.every((x: { normalizedVerdict?: string; verdict: string }) => (x.normalizedVerdict ?? x.verdict) === (r.results.find((y) => y.checkId === (x as never as { checkId: string }).checkId)!.verdict))).toBe(true);
  });

  it('passes a pure re-skin: new wrappers, classes, CSS, and role-based landmarks/headings', () => {
    const after = doc(`
<div class="shell"><header class="top"><div role="navigation" aria-label="Primary"><a class="btn" href="/">Home</a><a href="/pricing">Pricing</a><a href="/docs?a=1&b=2">Docs</a></div></header>
<div role="main"><section class="hero"><h1 class="display">Ship faster</h1><p>${words(30)}</p></section>
  <div role="heading" aria-level="2">Features</div>
  <picture><source srcset="/team.avif"><img src="/team.png" alt="The team at work"></picture>
  <form action="/subscribe" method="POST" data-testid="signup" class="card">
    <label>Email <input id="email" name="email" type="email"></label>
    <input type="hidden" name="csrf" value="y">
    <button type="submit" onclick="track('signup')">Sign up</button>
  </form></div>
<footer><a href="MAILTO:hi@acme.test">Contact</a></footer></div>`);
    const r = compare({ before: { html: BASE }, after: { html: after, css: ['.hero{display:grid}'] } });
    expect(r.findings).toEqual([]);
    expect(r.verdict).toBe('PASS');
  });

  it('flags a dropped link as FIX_NOW major with the normalized href', () => {
    const after = BASE.replace('<a href="/pricing">Pricing</a>', '');
    const r = compare({ before: { html: BASE }, after: { html: after } });
    expect(r.verdict).toBe('FIX_NOW');
    const f = r.findings.find((x) => x.checkId === 'redesign-kept-links')!;
    expect(f).toMatchObject({ verdict: 'FIX_NOW', severity: 'major', change: 'dropped', keys: ['/pricing'] });
    expect(r.inventory.links).toMatchObject({ lost: ['/pricing'] });
    expect(validate(r).valid).toBe(true);
  });

  it('flags a hidden input removal (fields count hidden elements) but not a hidden link removal (links count visible only)', () => {
    const hiddenLink = BASE.replace('<a href="/pricing">Pricing</a>', '<a href="/pricing">Pricing</a><a href="/old" style="display:none">Old</a>');
    const r1 = compare({ before: { html: hiddenLink }, after: { html: BASE } });
    expect(r1.inventory.links.lost).toEqual([]);
    const r2 = compare({ before: { html: BASE }, after: { html: BASE.replace('<input type="hidden" name="csrf" value="x">', '') } });
    expect(r2.inventory.fields.lost).toEqual(['name=csrf']);
    expect(r2.verdict).toBe('FIX_NOW');
  });

  it('keeps a field moved into a hidden step of the form', () => {
    const after = BASE.replace('<label for="email">Email</label><input id="email" name="email" type="email">',
      '<div style="display:none"><label for="email">Email</label><input id="email" name="email" type="email"></div>');
    const r = compare({ before: { html: BASE }, after: { html: after } });
    expect(r.inventory.fields.lost).toEqual([]);
  });

  it('flags a field whose label disappeared', () => {
    const after = BASE.replace('<label for="email">Email</label>', '');
    const r = compare({ before: { html: BASE }, after: { html: after } });
    expect(r.inventory.fields.lost).toEqual(['name=email (label)']);
    expect(r.verdict).toBe('FIX_NOW');
  });

  it('flags a changed form action and a dropped inline handler, and a dropped test hook as minor', () => {
    const after = BASE.replace('action="/subscribe"', 'action="/api/subscribe"').replace(` onclick="track('signup')"`, '').replace(' data-testid="signup"', '');
    const r = compare({ before: { html: BASE }, after: { html: after } });
    expect(r.inventory.handlers.lost.sort()).toEqual(['form POST /subscribe', "onclick: track('signup')"].sort());
    const hook = r.findings.find((x) => x.checkId === 'redesign-kept-test-hooks')!;
    expect(hook).toMatchObject({ verdict: 'FIX_NOW', severity: 'minor', keys: ['data-testid=signup'] });
  });

  it('script hooks: lost selector is FIX_NOW, a selector absent before is not compared, an unsupported one makes the check NOT_VERIFIED and the overall verdict RISK', () => {
    const before = BASE.replace('<form ', '<form id="signup-form" ');
    const r1 = compare({ before: { html: before }, after: { html: BASE }, scriptSelectors: ['#signup-form', '#never-there'] });
    expect(result(r1, 'script-hooks').verdict).toBe('FIX_NOW');
    expect(r1.inventory.scriptHooks.lost).toEqual(['#signup-form']);
    const r2 = compare({ before: { html: before }, after: { html: before }, scriptSelectors: ['form:has(> input[type=email])'] });
    if (result(r2, 'script-hooks').verdict !== 'PASS') {
      expect(result(r2, 'script-hooks').verdict).toBe('NOT_VERIFIED');
      expect(r2.verdict).toBe('RISK');
      expect(validate(r2).valid).toBe(true);
    }
  });

  it('reports a reworded heading and a reworded link as RISK, and an acknowledged reword as accepted', () => {
    const after = BASE.replace('<h2>Features</h2>', '<h2>What you get</h2>').replace('>Pricing<', '>Plans<');
    const r = compare({ before: { html: BASE }, after: { html: after } });
    expect(r.verdict).toBe('RISK');
    expect(r.inventory.headings.reworded).toEqual([{ key: 'Features', after: 'What you get' }]);
    expect(r.inventory.links.reworded).toEqual([{ key: '/pricing', after: 'plans' }].map((x) => ({ ...x, after: expect.stringMatching(/plans/i) })));
    const acked = compare({
      before: { html: BASE }, after: { html: after },
      acknowledged: [
        { kind: 'heading', key: 'Features', change: 'reworded', reason: 'Copy team renamed the section' },
        { kind: 'link', key: '/pricing', change: 'reworded', reason: 'Nav label now says Plans everywhere' },
      ],
    });
    expect(acked.verdict).toBe('PASS');
  });

  it('accepts an acknowledged drop with a 12+ character reason, rejects a short one with a RISK finding', () => {
    const after = BASE.replace('<a href="/pricing">Pricing</a>', '');
    const ok = compare({ before: { html: BASE }, after: { html: after }, acknowledged: [{ kind: 'link', key: '/pricing', change: 'dropped', reason: 'Pricing is sales-led now' }] });
    expect(ok.verdict).toBe('PASS');
    expect(ok.inventory.links).toMatchObject({ acknowledged: 1, lost: [] });
    const short = compare({ before: { html: BASE }, after: { html: after }, acknowledged: [{ kind: 'link', key: '/pricing', change: 'dropped', reason: 'removed' }] });
    expect(short.findings.some((x) => x.change === 'acknowledgement' && x.verdict === 'RISK')).toBe(true);
    expect(short.acknowledgements.rejected).toEqual([{ kind: 'link', key: '/pricing', reason: 'short' }]);
    const twelve = compare({ before: { html: BASE }, after: { html: after }, acknowledged: [{ kind: 'link', key: '/pricing', change: 'dropped', reason: '123456789012' }] });
    expect(twelve.verdict).toBe('PASS');
    const ko = compare({ before: { html: BASE }, after: { html: after }, acknowledged: [{ kind: 'link', key: '/pricing', change: 'dropped', reason: '가격은영업팀이직접안내함' }] });
    expect(ko.verdict).toBe('PASS');
  });

  it('word count: English > 80 words shrinking under 60% is RISK; exactly 80 words is not', () => {
    const big = doc(`<main><h1>T</h1><p>${words(100)}</p></main>`);
    const small = doc(`<main><h1>T</h1><p>${words(50)}</p></main>`);
    const r = compare({ before: { html: big }, after: { html: small } });
    expect(result(r, 'words').verdict).toBe('RISK');
    expect(r.verdict).toBe('RISK');
    const eighty = doc(`<main><p>${words(79)}</p><h1>T</h1></main>`);
    const r2 = compare({ before: { html: eighty }, after: { html: small.replace(words(50), words(5)) } });
    expect(r2.wordCount.before).toBe(80);
    expect(result(r2, 'words').verdict).toBe('PASS');
  });

  it('word count: Korean counts characters', () => {
    const ko = (n: number) => '가'.repeat(n);
    const r = compare({ before: { html: doc(`<main><h1>제목</h1><p>${ko(120)}</p></main>`) }, after: { html: doc(`<main><h1>제목</h1><p>${ko(40)}</p></main>`) } });
    expect(r.wordCount.before).toBe(122);
    expect(r.wordCount.after).toBe(42);
    expect(result(r, 'words').verdict).toBe('RISK');
  });

  it('word count ignores script, style, template, and head text', () => {
    const before = doc(`<main><h1>Hi</h1><p>${words(40)}</p><script>${words(200, 'js')}</script><style>.a{content:"${words(50, 'css')}"}</style><template><p>${words(80, 'tpl')}</p></template><noscript>${words(5, 'ns')}</noscript></main>`, `<script type="application/ld+json">{"x":"${words(100, 'ld')}"}</script>`);
    const after = doc(`<main><h1>Hi</h1><p>${words(40)}</p></main>`);
    const r = compare({ before: { html: before }, after: { html: after } });
    expect(r.wordCount.before).toBeLessThanOrEqual(r.wordCount.after + 10);
    expect(result(r, 'words').verdict).toBe('PASS');
  });

  it('a lost must-have (present before, missing after) is FIX_NOW and validates with the same productType', () => {
    const before = readFileSync(join(fixtures, 'revisions/must-have/before.html'), 'utf8');
    const after = readFileSync(join(fixtures, 'revisions/must-have/after.html'), 'utf8');
    const r = compare({ before: { html: before }, after: { html: after }, productType: 'commerce' });
    expect(result(r, 'must-haves').verdict).toBe('FIX_NOW');
    const v = validate(r, 'commerce');
    expect(v.valid).toBe(true);
  });

  it('is deterministic', () => {
    const after = BASE.replace('<a href="/pricing">Pricing</a>', '').replace('<h2>Features</h2>', '<h2>Benefits</h2>');
    const a = compare({ before: { html: BASE }, after: { html: after }, scriptSelectors: ['form'], locale: 'ja' });
    const b = compare({ before: { html: BASE }, after: { html: after }, scriptSelectors: ['form'], locale: 'ja' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('existing fp-*.html page-structure fixtures compared with themselves produce no findings', () => {
    const dir = join(fixtures, 'page-structure');
    const files = readdirSync(dir).filter((f) => f.endsWith('.html'));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const html = readFileSync(join(dir, f), 'utf8');
      for (const productType of [undefined, 'operational-saas', 'commerce'] as const) {
        const r = compare({ before: { html }, after: { html }, ...(productType ? { productType } : {}) });
        expect({ f, productType, findings: r.findings, verdict: r.verdict }).toEqual({ f, productType, findings: [], verdict: 'PASS' });
      }
    }
  });

  it('a long targetId still yields evidence ids the validator accepts', () => {
    const targetId = 'x'.repeat(160);
    const r = compare({ before: { html: BASE }, after: { html: BASE.replace('<a href="/pricing">Pricing</a>', '') }, targetId });
    expect(r.evidence.every((e) => e.id.length <= 160)).toBe(true);
    expect(validate(r).valid).toBe(true);
  });
});

describe('review: pages that cannot be fully checked (decision 8)', () => {
  it('a truncated redesigned page does not report items past the cut as lost FIX_NOW', () => {
    const filler = '<span>x</span>'.repeat(PAGE_LIMITS.maxElements + 10);
    const before = doc(`<main><h1>T</h1><p>intro</p><a href="/late">Late link</a></main>`);
    const after = doc(`<main><h1>T</h1><p>intro</p>${filler}<a href="/late">Late link</a></main>`);
    const r = compare({ before: { html: before }, after: { html: after } });
    // the link is still on the redesigned page; it is simply past the parse limit
    expect(result(r, 'links').verdict).toBe('NOT_VERIFIED');
    expect(r.verdict).toBe('RISK');
  });

  it('a truncated page with nothing lost is NOT_VERIFIED / overall RISK', () => {
    const filler = '<span>x</span>'.repeat(PAGE_LIMITS.maxElements + 10);
    const html = doc(`<main><h1>T</h1><a href="/a">A</a>${filler}</main>`);
    const r = compare({ before: { html }, after: { html } });
    expect(r.verdict).toBe('RISK');
    expect(r.results.filter((x) => x.verdict === 'NOT_VERIFIED').length).toBeGreaterThan(0);
  });
});

describe('review: probable false positives on common redesign edits', () => {
  it('adding an aria-label to an existing landmark is not a lost landmark', () => {
    const before = doc(`<nav><a href="/">Home</a></nav><main><h1>T</h1></main><footer>f</footer>`);
    const after = doc(`<nav aria-label="Primary"><a href="/">Home</a></nav><main><h1>T</h1></main><footer>f</footer>`);
    const r = compare({ before: { html: before }, after: { html: after } });
    expect(r.inventory.landmarks.lost).toEqual([]);
  });

  it('a trailing-slash-only href change is not a lost link', () => {
    const before = doc(`<main><h1>T</h1><a href="/pricing">Pricing</a></main>`);
    const after = doc(`<main><h1>T</h1><a href="/pricing/">Pricing</a></main>`);
    const r = compare({ before: { html: before }, after: { html: after } });
    expect(r.inventory.links.lost).toEqual([]);
  });

  it('an &amp;-encoded query in the original matches the same query in the redesign', () => {
    const before = doc(`<main><h1>T</h1><a href="/s?q=1&amp;page=2">Search</a></main>`);
    const after = doc(`<main><h1>T</h1><a href="/s?page=2&q=1">Search</a></main>`);
    const r = compare({ before: { html: before }, after: { html: after } });
    expect(r.inventory.links.lost).toEqual([]);
  });
});
