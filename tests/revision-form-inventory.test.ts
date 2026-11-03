import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWebStylebookServer } from '../src/server.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { validateDesignAuditResult } from '../src/audit/evaluator.js';
import { planDesignAudit } from '../src/audit/planner.js';
import { comparePageRevisions, type ComparePageRevisionsInput, type RevisionAcknowledgement } from '../src/structure/revisions.js';

// Issue #21: the field inventory keyed on the page-wide `name`, so a redesign that dropped a form's submit button,
// some radio or select options, or a field that another form also had still passed.

const repo = CatalogRepository.load();
const compare = (input: ComparePageRevisionsInput) => comparePageRevisions(input, repo);
const page = (body: string) => `<!doctype html><main><h1>신청</h1>${body}</main>`;
const run = (before: string, after: string, extra: Omit<ComparePageRevisionsInput, 'before' | 'after'> = {}) =>
  compare({ before: { html: page(before) }, after: { html: page(after) }, ...extra });
const fields = (r: ReturnType<typeof compare>) => r.results.find((x) => x.checkId === 'redesign-kept-fields')!;
const ack = (kind: RevisionAcknowledgement['kind'], key: string, change: RevisionAcknowledgement['change'] = 'dropped'): RevisionAcknowledgement => ({
  kind, key, change, reason: 'Removed on purpose in the redesign brief',
});

/** The four counterexamples from the issue, verbatim. */
const ISSUE: Record<string, [string, string]> = {
  'submit-button-removed': [
    '<form action="/apply" method="post"><label>이메일<input name="email" type="email"></label><button type="submit">신청하기</button></form>',
    '<form action="/apply" method="post"><label>이메일<input name="email" type="email"></label></form>',
  ],
  'radio-options-removed': [
    '<form action="/subscribe" method="post"><label><input type="radio" name="plan" value="basic">기본</label><label><input type="radio" name="plan" value="pro">프로</label><label><input type="radio" name="plan" value="team">팀</label><button type="submit">선택</button></form>',
    '<form action="/subscribe" method="post"><label><input type="radio" name="plan" value="basic">기본</label><button type="submit">선택</button></form>',
  ],
  'same-name-different-form-loss': [
    '<form action="/login" method="post"><label>로그인 이메일<input name="email" type="email"></label><button>로그인</button></form><form action="/newsletter" method="post"><label>뉴스레터 이메일<input name="email" type="email"></label><button>구독</button></form>',
    '<form action="/login" method="post"><button>로그인</button></form><form action="/newsletter" method="post"><label>뉴스레터 이메일<input name="email" type="email"></label><button>구독</button></form>',
  ],
  'select-options-removed': [
    '<form action="/export"><label>출력 형식<select name="format"><option value="csv">CSV</option><option value="xlsx">Excel</option></select></label><button>내보내기</button></form>',
    '<form action="/export"><label>출력 형식<select name="format"><option value="csv">CSV</option></select></label><button>내보내기</button></form>',
  ],
};
const issue = (name: string, extra: Omit<ComparePageRevisionsInput, 'before' | 'after'> = {}) => run(...ISSUE[name]!, { locale: 'ko', ...extra });

function validates(r: ReturnType<typeof compare>): void {
  const plan = { revisionPreservation: true as const };
  const v = validateDesignAuditResult({
    plan, expectedPlanHash: planDesignAudit(plan, repo).identity.planHash,
    targets: [{ id: r.target.id, surface: 'global' }], evidence: r.evidence, results: r.results,
  }, repo);
  expect(v.issues).toEqual([]);
  expect(v.valid).toBe(true);
  expect(v.results.map((x) => x.verdict)).toEqual(r.results.map((x) => x.verdict));
}

describe('issue #21 counterexamples are reported', () => {
  it('a removed submit button leaves the form without one: FIX_NOW, located, without denying implicit submission', () => {
    const r = issue('submit-button-removed');
    expect(r.verdict).toBe('FIX_NOW');
    expect(r.inventory.fields).toMatchObject({ before: 1, kept: 1, lost: [] });
    expect(r.inventory.controls).toMatchObject({ before: 1, after: 0, kept: 0, lost: ['submit "신청하기"'] });
    expect(r.findings).toEqual([expect.objectContaining({
      checkId: 'redesign-kept-fields', kind: 'control', verdict: 'FIX_NOW', severity: 'major', change: 'dropped',
      keys: ['submit "신청하기"'], locations: ['main > form > button'],
    })]);
    expect(r.findings[0]!.fix).toContain('Enter');
    expect(fields(r)).toMatchObject({ verdict: 'FIX_NOW' });
    expect(fields(r).rationale).toContain('폼 버튼: 1개 중 0개 유지, 1개 손실');
  });

  it('removed radio options are lost choices of a kept group: RISK, with the group and each value', () => {
    const r = issue('radio-options-removed');
    expect(r.verdict).toBe('RISK');
    expect(r.inventory.fields).toMatchObject({ before: 1, kept: 1, lost: [] });
    expect(r.inventory.options).toMatchObject({ before: 3, after: 1, kept: 1, lost: ['name=plan value=pro "프로"', 'name=plan value=team "팀"'] });
    expect(r.findings).toEqual([expect.objectContaining({
      checkId: 'redesign-kept-fields', kind: 'option', verdict: 'RISK', change: 'dropped',
      locations: ['main > form > label:nth-of-type(2) > input', 'main > form > label:nth-of-type(3) > input'],
    })]);
  });

  it('a field lost from one form is reported although another form keeps a field with the same name', () => {
    const r = issue('same-name-different-form-loss');
    expect(r.verdict).toBe('FIX_NOW');
    expect(r.inventory.fields).toMatchObject({ before: 2, after: 1, kept: 1, lost: ['form POST /login > name=email'] });
    expect(r.findings).toEqual([expect.objectContaining({
      kind: 'field', verdict: 'FIX_NOW', keys: ['form POST /login > name=email'], locations: ['main > form:nth-of-type(1) > label > input'],
    })]);
    expect(r.inventory.controls).toMatchObject({ before: 2, kept: 2, lost: [] });
  });

  it('a removed select option is reported with its value and label', () => {
    const r = issue('select-options-removed');
    expect(r.verdict).toBe('RISK');
    expect(r.inventory.options).toMatchObject({ before: 2, after: 1, kept: 1, lost: ['name=format value=xlsx "Excel"'] });
    expect(r.findings[0]).toMatchObject({ kind: 'option', verdict: 'RISK', locations: ['main > form > label > select > option:nth-of-type(2)'] });
  });

  it.each(Object.keys(ISSUE))('%s: no longer PASS, and the evidence and results validate unchanged', (name) => {
    const r = issue(name);
    expect(r.verdict).not.toBe('PASS');
    expect(r.summary.findings).toBeGreaterThan(0);
    validates(r);
  });

  it.each(Object.keys(ISSUE))('%s: the original page compared with itself still passes', (name) => {
    const html = page(ISSUE[name]![0]);
    const r = compare({ before: { html }, after: { html } });
    expect(r.findings).toEqual([]);
    expect(r.verdict).toBe('PASS');
  });
});

describe('issue #21 intended removals can be acknowledged specifically', () => {
  it('acknowledges a removed submit button, removed options (with or without the label), and a field of one form', () => {
    expect(issue('submit-button-removed', { acknowledged: [ack('control', 'submit "신청하기"')] })).toMatchObject({ verdict: 'PASS', acknowledgements: { applied: 1, rejected: [] } });
    const radios = issue('radio-options-removed', { acknowledged: [ack('option', 'name=plan value=pro "프로"'), ack('option', 'name=plan value=team')] });
    expect(radios.verdict).toBe('PASS');
    expect(radios.inventory.options).toMatchObject({ acknowledged: 2, lost: [] });
    expect(issue('same-name-different-form-loss', { acknowledged: [ack('field', 'form POST /login > name=email')] }).verdict).toBe('PASS');
    // On a page with one form the key does not name the form, but the form-qualified key is accepted too.
    expect(issue('select-options-removed', { acknowledged: [ack('option', 'form GET /export > name=format value=xlsx')] }).verdict).toBe('PASS');
  });

  it('does not let a page-wide name acknowledge a field that more than one form had', () => {
    const r = issue('same-name-different-form-loss', { acknowledged: [ack('field', 'name=email')] });
    expect(r.verdict).toBe('FIX_NOW');
    expect(r.acknowledgements.rejected).toEqual([{ kind: 'field', key: 'name=email', reason: 'unmatched' }]);
  });

  it('keeps accepting an earlier unqualified field key when only one form had that field', () => {
    const before = '<form action="/login" method="post"><input name="email"><input name="password" type="password"><button>Log in</button></form><form action="/newsletter" method="post"><input name="email"><button>Join</button></form>';
    const after = before.replace('<input name="password" type="password">', '');
    expect(run(before, after).inventory.fields.lost).toEqual(['form POST /login > name=password']);
    expect(run(before, after, { acknowledged: [ack('field', 'name=password')] })).toMatchObject({ verdict: 'PASS', acknowledgements: { applied: 1 } });
  });

  it('needs the matching kind and a reason of 12 or more characters', () => {
    const wrongKind = issue('select-options-removed', { acknowledged: [ack('field', 'name=format value=xlsx')] });
    expect(wrongKind.verdict).toBe('RISK');
    expect(wrongKind.acknowledgements.rejected).toEqual([{ kind: 'field', key: 'name=format value=xlsx', reason: 'unmatched' }]);
    const short = issue('submit-button-removed', { acknowledged: [{ kind: 'control', key: 'submit "신청하기"', change: 'dropped', reason: 'gone' }] });
    expect(short.verdict).toBe('FIX_NOW');
    expect(short.findings.map((f) => `${f.kind}:${f.verdict}:${f.change}`)).toEqual(['control:FIX_NOW:dropped', 'control:RISK:acknowledgement']);
  });
});

describe('issue #21 form buttons: role, ownership, and severity', () => {
  const form = (buttons: string, attrs = 'action="/apply" method="post"') => `<form id="apply" ${attrs}><input name="email">${buttons}</form>`;

  it('a form that keeps another submit button loses one as RISK, not FIX_NOW', () => {
    const r = run(form('<button name="intent" value="draft">Save draft</button><button>Publish</button>'), form('<button>Publish</button>'));
    expect(r.inventory.controls.lost).toEqual(['submit "Save draft"']);
    expect(r.findings).toEqual([expect.objectContaining({ kind: 'control', verdict: 'RISK', change: 'dropped' })]);
  });

  it('a submit button turned into type="button" or moved out of its form leaves the form without one', () => {
    const before = form('<button>Send</button>');
    for (const after of [form('<button type="button">Send</button>'), `${form('')}<button>Send</button>`]) {
      const r = run(before, after);
      expect(r.findings.map((f) => `${f.kind}:${f.verdict}:${f.keys.join(',')}`)).toEqual(['control:FIX_NOW:submit "Send"']);
    }
  });

  it('a submit button moved out of the form but linked with form="…" is kept', () => {
    expect(run(form('<button>Send</button>'), `${form('')}<footer><button form="apply">Send</button></footer>`).findings).toEqual([]);
  });

  it('recognizes input type=submit and type=image as submit buttons, and reports a lost reset or plain button as RISK', () => {
    expect(run(form('<input type="submit" value="Send">'), form('')).inventory.controls.lost).toEqual(['submit "Send"']);
    expect(run(form('<input type="image" src="/go.png" alt="Go">'), form('')).findings[0]).toMatchObject({ verdict: 'FIX_NOW', keys: ['submit "Go"'] });
    const r = run(form('<button>Send</button><button type="reset">Clear</button><button type="button">Show password</button>'), form('<button>Send</button>'));
    expect(r.inventory.controls.lost).toEqual(['reset "Clear"', 'button "Show password"']);
    expect(r.findings.every((f) => f.verdict === 'RISK')).toBe(true);
  });

  it('a relabelled submit button is reworded (RISK) and a "reworded" acknowledgement accepts it', () => {
    const before = form('<button>신청하기</button>');
    const after = form('<button>지금 신청</button>');
    const r = run(before, after);
    expect(r.inventory.controls.reworded).toEqual([{ key: 'submit "신청하기"', after: 'submit "지금 신청"' }]);
    expect(r.findings).toEqual([expect.objectContaining({ kind: 'control', verdict: 'RISK', change: 'reworded' })]);
    expect(run(before, after, { acknowledged: [ack('control', 'submit "신청하기"', 'reworded')] }).verdict).toBe('PASS');
  });

  it('a whole form removed reports its fields, action, and submit button once each', () => {
    const r = run(`<form action="/export"><select name="format"><option>CSV</option><option>XLSX</option></select><button>Export</button></form>`, '<p>Export moved</p>');
    expect(r.inventory.fields.lost).toEqual(['name=format']);
    expect(r.inventory.options.lost).toEqual([]);
    expect(r.inventory.handlers.lost).toEqual(['form GET /export']);
    expect(r.inventory.controls.lost).toEqual(['submit "Export"']);
  });
});

describe('issue #21 options', () => {
  const select = (options: string) => `<form action="/export"><label>Format <select name="format">${options}</select></label><button>Export</button></form>`;

  it('ignores option order and a select that became radios with the same values', () => {
    const before = select('<option value="csv">CSV</option><optgroup label="Sheets"><option value="xlsx">Excel</option></optgroup>');
    expect(run(before, select('<option value="xlsx">Excel</option><option value="csv">CSV</option>')).findings).toEqual([]);
    const radios = '<form action="/export"><fieldset><legend>Format</legend><label><input type="radio" name="format" value="csv">CSV</label><label><input type="radio" name="format" value="xlsx">Excel</label></fieldset><button>Export</button></form>';
    expect(run(before, radios).findings).toEqual([]);
  });

  it('reports a changed option label as reworded and a changed option value as dropped', () => {
    const before = select('<option value="csv">CSV</option><option value="xlsx">Excel</option>');
    const relabelled = run(before, select('<option value="csv">CSV</option><option value="xlsx">Spreadsheet</option>'));
    expect(relabelled.inventory.options.reworded).toEqual([{ key: 'name=format value=xlsx "Excel"', after: 'Spreadsheet' }]);
    expect(relabelled.findings).toEqual([expect.objectContaining({ kind: 'option', verdict: 'RISK', change: 'reworded' })]);
    const revalued = run(before, select('<option value="csv">CSV</option><option value="excel">Excel</option>'));
    expect(revalued.inventory.options.lost).toEqual(['name=format value=xlsx "Excel"']);
  });

  it('compares checkbox values and an option without a value attribute by its text', () => {
    const boxes = (values: string[]) => `<form action="/prefs" method="post">${values.map((v) => `<label><input type="checkbox" name="topics" value="${v}">${v}</label>`).join('')}<button>Save</button></form>`;
    expect(run(boxes(['news', 'events']), boxes(['news'])).inventory.options.lost).toEqual(['name=topics value=events']);
    expect(run(select('<option>Comma separated</option><option>Excel</option>'), select('<option>Excel</option>')).inventory.options.lost)
      .toEqual(['name=format value="Comma separated"']);
  });
});

describe('issue #21 legitimate redesigns still pass', () => {
  const BEFORE = `
<header><form action="/search" role="search"><input name="q" aria-label="Search"><button>Search</button></form></header>
<form action="/login" method="post"><label for="e">Email</label><input id="e" name="email"><label for="p">Password</label><input id="p" name="password" type="password"><input type="hidden" name="csrf" value="1"><button>Log in</button></form>
<form action="/newsletter" method="post"><label>Email <input name="email"></label><label><input type="radio" name="freq" value="weekly">Weekly</label><label><input type="radio" name="freq" value="monthly">Monthly</label><button>Join</button></form>`;

  it('passes a re-skin with new wrappers, classes, CSS, reordered forms, and reordered fields', () => {
    const after = `
<div class="shell"><form action="/newsletter" method="POST" class="card"><div class="row"><label><input type="radio" name="freq" value="monthly">Monthly</label><label><input type="radio" name="freq" value="weekly">Weekly</label></div><label class="f">Email <input name="email" class="input"></label><button class="btn">Join</button></form>
<section class="auth"><form method="post" action="/login/"><input type="hidden" name="csrf" value="2"><div><label for="p">Password</label><input id="p" name="password" type="password"></div><div><label for="e">Email</label><input id="e" name="email"></div><div class="actions"><button type="submit" class="btn">Log in</button></div></form></section></div>
<header class="top"><form action="/search" role="search"><input name="q" aria-label="Search"><button class="icon">Search</button></form></header>`;
    const r = run(BEFORE, after);
    expect(r.findings).toEqual([]);
    expect(r.verdict).toBe('PASS');
    expect(r.inventory.fields).toMatchObject({ before: 6, kept: 6 });
  });

  it('passes a multi-step form that hides its later steps and adds step buttons', () => {
    const before = '<form action="/apply" method="post"><label>Name <input name="name"></label><label>Email <input name="email"></label><label>Plan <select name="plan"><option>basic</option><option>pro</option></select></label><button>Apply</button></form>';
    const after = '<form action="/apply" method="post"><fieldset><label>Name <input name="name"></label><button type="button">Next</button></fieldset><fieldset hidden><label>Email <input name="email"></label><label>Plan <select name="plan"><option>basic</option><option>pro</option></select></label><button>Apply</button></fieldset></form>';
    expect(run(before, after).findings).toEqual([]);
  });

  it('passes two forms that share a method and action when they are only reordered, and reports which one lost a field', () => {
    const search = (extra = '') => `<form action="/search"><input name="q" aria-label="Query">${extra}<button>Go</button></form>`;
    const before = `<header>${search()}</header><section>${search('<select name="sort"><option>new</option><option>top</option></select>')}</section>`;
    const reordered = `<section>${search('<select name="sort"><option>top</option><option>new</option></select>')}</section><header>${search()}</header>`;
    expect(run(before, reordered).findings).toEqual([]);
    const lost = run(before, `<header>${search()}</header><section>${search()}</section>`);
    expect(lost.inventory.fields.lost).toEqual(['form GET /search [2] > name=sort']);
    expect(fields(lost).rationale).toContain('More than one form has the same method and action (form GET /search)');
  });

  it('keeps fields and buttons when only the form action changes, so only the handler is reported', () => {
    const before = '<form action="/subscribe" method="post"><label>Email <input name="email"></label><button>Join</button></form>';
    const r = run(before, before.replace('/subscribe', '/api/subscribe'));
    expect(r.findings.map((f) => `${f.checkId}:${f.keys.join(',')}`)).toEqual(['redesign-kept-handlers:form POST /subscribe']);
  });

  it('collapses a duplicated submit button (top and bottom of a long form) into one', () => {
    const before = '<form action="/save" method="post"><button>Save</button><textarea name="body" aria-label="Body"></textarea><button>Save</button></form>';
    expect(run(before, before.replace('<button>Save</button><textarea', '<textarea')).findings).toEqual([]);
  });

  it('says which fields it could not tell apart instead of merging them silently', () => {
    const before = '<form action="/s"><input type="text"><input name="q"><button>Go</button></form>';
    expect(fields(run(before, before)).rationale).toContain('1 field has no name, id, or label and was not compared.');
    const guests = '<form action="/rsvp" method="post"><input name="guest[]" aria-label="Guest 1"><input name="guest[]" aria-label="Guest 2"><input type="hidden" name="agree" value="0"><label><input type="checkbox" name="agree" value="1">Agree</label><button>Send</button></form>';
    const rationale = fields(run(guests, guests)).rationale;
    expect(rationale).toContain('1 field name is shared by several inputs of one form; each was compared as one field.');
    expect(run(guests, guests).findings).toEqual([]);
  });

  it('is deterministic', () => {
    const after = BEFORE.replace('<label><input type="radio" name="freq" value="monthly">Monthly</label>', '').replace('<button>Log in</button>', '');
    const input = { before: { html: page(BEFORE) }, after: { html: page(after) }, locale: 'ja' as const };
    expect(JSON.stringify(compare(input))).toBe(JSON.stringify(compare(structuredClone(input))));
  });
});

describe('issue #21 localized text stays within what was compared', () => {
  let client: Client;
  beforeAll(async () => {
    const server = createWebStylebookServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'form-inventory-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });
  const text = async (args: Record<string, unknown>) => {
    const res = await client.callTool({ name: 'compare_page_revisions', arguments: args });
    expect(res.isError).toBeFalsy();
    return (res.content as Array<{ type: string; text?: string }>).find((item) => item.type === 'text')!.text!;
  };

  it.each([
    ['en', 'No loss was found in the inventories compared above', 'Nothing the original page had was lost.'],
    ['ko', '위에서 비교한 인벤토리에서는 손실을 찾지 못했습니다', '원래 페이지에 있던 것 중 사라진 항목이 없습니다.'],
    ['ja', '上で比較したインベントリでは損失は見つかりませんでした', '元のページにあったもので失われた項目はありません。'],
  ])('%s: a clean result claims no more than the compared inventories', async (locale, now, earlier) => {
    const html = page(ISSUE['radio-options-removed']![0]);
    const out = await text({ before: { html }, after: { html }, locale });
    expect(out).toContain(now);
    expect(out).not.toContain(earlier);
  });

  it('names option and button findings in the text summary', async () => {
    const [before, after] = ISSUE['submit-button-removed']!;
    const out = await text({ before: { html: page(before) }, after: { html: page(after) }, locale: 'ko' });
    expect(out).toContain('[FIX_NOW] redesign-kept-fields (dropped control): submit "신청하기"');
    const [b2, a2] = ISSUE['select-options-removed']!;
    expect(await text({ before: { html: page(b2) }, after: { html: page(a2) }, locale: 'ja' })).toContain('(dropped option): name=format value=xlsx "Excel"');
  });

  it('localizes the new inventory names and limits', () => {
    const [before, after] = ISSUE['radio-options-removed']!;
    expect(fields(run(before, after, { locale: 'ja' })).rationale).toContain('選択肢: 3件中1件を維持');
    expect(run(before, after, { locale: 'ko' }).limits.some((limit) => limit.includes('폼 밖의 버튼'))).toBe(true);
    expect(run(before, after).limits.some((limit) => limit.includes('Buttons outside a form'))).toBe(true);
  });
});
