// #20 representative cases not covered by the per-problem test files. docs/research/issue-20-evaluation.md maps every
// case in the issue's table to the test that checks it and to what a static check cannot decide.
import { describe, expect, it } from 'vitest';
import { planDesignAudit } from '../src/audit/planner.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { auditPageStructure } from '../src/structure/audit.js';

const repo = CatalogRepository.load();
const resultFor = (audit: ReturnType<typeof auditPageStructure>, checkId: string) => audit.results.find((entry) => entry.checkId === checkId)!;

describe('#20 cases: shapes that can be legitimate', () => {
  // Named customers with a link to each case study: proof the task can use, in the shape of a logo strip.
  const sourcedLogos = `<main><section><h1>Payroll for restaurants</h1><p>Run payroll for hourly staff with tips handled.</p><a href="/start">Start</a><img src="/run.png" width="900" height="560" alt="A payroll run"></section>
    <section><h2>Restaurants that run payroll here</h2><div class="flex justify-between gap-8">${['Harbor Grill', 'Noodle Bar', 'Corner Bakery', 'Taqueria Sol', 'Blue Plate']
    .map((name) => `<a href="/customers/${name.toLowerCase().replace(/ /g, '-')}"><img src="/logos/${name}.svg" alt="${name}" class="h-8"></a>`).join('')}</div></section></main>`;

  it('does not ask to remove a sourced logo row without a chosen style; the task judgment decides', () => {
    const audit = auditPageStructure({ html: sourcedLogos }, repo);
    const logo = audit.findings.find((finding) => finding.patternId === 'logo-strip');
    expect(logo?.claim).toBe('shape-observation');
    expect(resultFor(audit, 'structure-logo-strip').verdict).toBe('NOT_VERIFIED');
    expect(audit.results.some((entry) => entry.verdict === 'FIX_NOW')).toBe(false);
  });

  it('reports a centered opening the same way whether or not it serves the task: the shape cannot tell them apart', () => {
    const opening = (body: string) => `<main><section class="text-center"><h1>Book a table</h1><p>Pick a time tonight at any of our three restaurants.</p>${body}</section><section><h2>Menu</h2><p>Seasonal dishes.</p></section></main>`;
    const withTask = auditPageStructure({ html: opening('<form><label>Time <input type="time" name="t"></label><button>Find a table</button></form>') }, repo);
    const empty = auditPageStructure({ html: opening('<a href="/signup">Get started</a><a href="/demo">Learn more</a>') }, repo);
    for (const audit of [withTask, empty]) {
      for (const result of audit.results) expect(result.verdict, result.checkId).not.toBe('FIX_NOW');
    }
  });
});

describe('#20 cases: observable defects keep their severity', () => {
  it('keeps keyboard operation and kept input as browser checks that static or review evidence cannot pass', () => {
    const plan = planDesignAudit({ includeGroups: ['principles'], designPrincipleIds: ['multi-input-operability', 'recoverable-actions'], uxPrincipleIds: ['working-memory'] }, repo);
    for (const id of ['principle-design-multi-input-operability-verify-1', 'principle-design-recoverable-actions-verify-1', 'principle-ux-working-memory-verify-2']) {
      expect(plan.checks.find((check) => check.id === id), id).toMatchObject({ evidenceTypes: ['interaction'], evidenceMethods: ['browser'] });
    }
  });

  it('flags a commerce page that never shows a price as FIX_NOW whatever the style or conditions', () => {
    const html = '<main><section><h1>Linen shirt</h1><select name="size"><option>S</option></select><button>Add to cart</button><p>Free delivery and 30-day returns.</p></section></main>';
    for (const input of [{}, { styleId: 'quiet-utility' }, { mustHaveConditions: [{ id: 'single-variant' as const, reason: 'The shirt comes in one colour only.' }] }]) {
      expect(resultFor(auditPageStructure({ html, productType: 'commerce', ...input }, repo), 'structure-must-have-price').verdict).toBe('FIX_NOW');
    }
  });
});
