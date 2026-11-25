import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';

// Reader-facing documents ship in English, Korean and Japanese. A translation may reword anything,
// but it must not drop what the English edition gives the reader: links, numbers, code tokens and blocks.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const LANGS = ['ko', 'ja'] as const;
// Tracked and new (not ignored) Markdown files, so broken symlinks and build output are left out.
const MARKDOWN = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'], { cwd: root, encoding: 'utf8' })
  .split('\n').filter((p) => p && existsSync(join(root, p)));
const FAMILIES = ['README.md', 'docs/reference.md', 'docs/demo/README.md', 'showcase/README.md', 'showcase/RESULTS.md'];
const editionOf = (en: string, lang: string) => en.replace(/\.md$/, `.${lang}.md`);
const CASES = FAMILIES.flatMap((en) => LANGS.map((lang) => ({ en, lang, doc: editionOf(en, lang) })));

const withoutFences = (text: string) => text.replace(/```[\s\S]*?```/g, '');
const externalLinks = (text: string) => new Set(text.match(/https?:\/\/[^\s)>"`\]]+/g) ?? []);
const numbersIn = (text: string) =>
  new Set((text.replace(/https?:\/\/\S+/g, '').match(/(?<![A-Za-z0-9_.#-])\d+(?:[.,]\d+)*(?![0-9])/g) ?? []).map((n) => n.replaceAll(',', '')));
const hexColors = (text: string) => new Set((text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase()));
const codeSpans = (text: string) => new Set([...withoutFences(text).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!));
const missing = (expected: Set<string>, actual: Set<string>) => [...expected].filter((value) => !actual.has(value));

// Per second-level section: fenced code blocks, table rows, list items and block quotes.
function blockShape(text: string) {
  const sections: { heading: string; code: number; tableRows: number; listItems: number; quotes: number }[] = [];
  let current = { heading: '(top)', code: 0, tableRows: 0, listItems: 0, quotes: 0 };
  sections.push(current);
  let inFence = false;
  let inQuote = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      if (!inFence) current.code++;
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^##\s/.test(line)) {
      current = { heading: line, code: 0, tableRows: 0, listItems: 0, quotes: 0 };
      sections.push(current);
    } else if (line.startsWith('|')) current.tableRows++;
    else if (/^\s*(?:-|\d+\.)\s/.test(line)) current.listItems++;
    if (line.startsWith('>') && !inQuote) current.quotes++;
    inQuote = line.startsWith('>');
  }
  return sections;
}

describe('every translated edition exists and carries what the English edition gives the reader', () => {
  it.each(CASES)('$doc exists', ({ doc }) => {
    expect(existsSync(join(root, doc)), doc).toBe(true);
  });

  it.each(CASES)('$doc keeps every external link of $en', ({ en, doc }) => {
    expect(missing(externalLinks(read(en)), externalLinks(read(doc))), doc).toEqual([]);
  });

  it.each(CASES)('$doc keeps every number of $en', ({ en, doc }) => {
    expect(missing(numbersIn(read(en)), numbersIn(read(doc))), doc).toEqual([]);
  });

  it.each(CASES)('$doc keeps every hex color of $en', ({ en, doc }) => {
    expect(missing(hexColors(read(en)), hexColors(read(doc))), doc).toEqual([]);
  });

  it.each(CASES)('$doc mentions every inline code token of $en', ({ en, doc }) => {
    const text = read(doc);
    expect([...codeSpans(read(en))].filter((token) => !text.includes(token)), doc).toEqual([]);
  });

  it.each(CASES)('$doc has the same sections, code blocks, tables, lists and quotes as $en', ({ en, doc }) => {
    const shape = (text: string) => blockShape(text).map(({ code, tableRows, listItems, quotes }) => ({ code, tableRows, listItems, quotes }));
    const english = blockShape(read(en));
    const translated = shape(read(doc));
    expect(translated.length, `${doc} section count`).toBe(english.length);
    english.forEach((section, index) => {
      const { heading, ...counts } = section;
      expect(translated[index], `${doc}, section ${index} (${heading})`).toEqual(counts);
    });
  });
});

describe('language switchers', () => {
  it.each(FAMILIES.flatMap((en) => ['en', ...LANGS].map((lang) => ({ en, lang }))))('$en ($lang) links every other edition near the top', ({ en, lang }) => {
    const doc = lang === 'en' ? en : editionOf(en, lang);
    const head = read(doc).split('\n').slice(0, 20).join('\n');
    for (const other of ['en', ...LANGS].filter((l) => l !== lang)) {
      const target = basename(other === 'en' ? en : editionOf(en, other));
      expect(head, `${doc} → ${target}`).toContain(`(./${target})`);
    }
    expect(head, `${doc} does not link itself`).not.toContain(`(./${basename(doc)})`);
  });
});

describe('a translated edition sends the reader to the same language when that edition exists', () => {
  const docs = MARKDOWN.filter((p) => /\.(ko|ja)\.md$/.test(p) && !p.startsWith('tests/fixtures/'));

  it.each(docs)('%s', (doc) => {
    const lang = /\.(ko|ja)\.md$/.exec(doc)![1]!;
    const wrong: string[] = [];
    for (const [, text, href] of withoutFences(read(doc)).matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
      if (['English', '한국어', '日本語'].includes(text!) || /^(https?:|mailto:|#)/.test(href!)) continue;
      const path = href!.split('#')[0]!;
      let target = resolve(root, dirname(doc), path);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'README.md');
      if (!target.endsWith('.md') || /\.(ko|ja)\.md$/.test(target)) continue;
      if (existsSync(target.replace(/\.md$/, `.${lang}.md`))) wrong.push(href!);
    }
    expect(wrong, doc).toEqual([]);
  });
});

describe('project wording rule', () => {
  it('no Markdown document uses 장애 or 障害, which read as "disability"', () => {
    const offenders = MARKDOWN.filter((doc) => /장애|障害/.test(read(doc)));
    expect(offenders).toEqual([]);
  });
});
