// Plan PR 4 (2026-11-25 design-quality plan, 6 and 8): the copy on the 2026-11-25 landing pages was the same with and
// without the server, because the server gave no copy guidance. The lexicon names the template lines and unsourced
// claims those pages shared, and each product type gets a voice. Korean cases are sentences copied from the run
// outputs (tests/fixtures/copy); the English and Japanese cases are authored, because every run prompt was Korean.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CatalogRepository } from '../src/catalog/repository.js';
import { createWebStylebookServer } from '../src/server.js';
import { LANGS, type Lang } from '../src/types.js';
import { COPY_PATTERNS, findCopyPatterns } from '../src/copy/lexicon.js';
import { VOICE_PROFILES } from '../src/copy/voice.js';
import { COPY_GUIDE_URI, COPY_PATTERNS_URI, COPY_RULES } from '../src/copy/guide.js';

interface Fixture {
  detect: Array<{ run: string; text: string; patterns: string[] }>;
  clean: Array<{ run: string; text: string }>;
  pages: Array<{ run: string; units: string[]; patterns: string[] }>;
}
const fixture = JSON.parse(readFileSync(new URL('./fixtures/copy/runs-2026-11-25.ko.json', import.meta.url), 'utf8')) as Fixture;
const repo = CatalogRepository.load();
const ids = (units: string[], locale: Lang) => [...new Set(findCopyPatterns(units, locale).map((hit) => hit.patternId))].sort();
const sentences = (text: string) => text.split(/(?<=[.!?。！？])\s*/u).filter(Boolean);
const KO_HAPNIDA = /니다[.!]?$/u;
const KO_HAEYO = /(?:(?<![세필중주나까]|아니)요|죠)[.!]?$/u;
const JA_PLAIN = /(?:だ|である|だった)[。！？!?]?$/u;

let client: Client;
beforeAll(async () => {
  const server = createWebStylebookServer(repo);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'copy-lexicon-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});
const read = async (uri: string) => JSON.parse((await client.readResource({ uri })).contents[0]!.text as string);

describe('copy pattern data', () => {
  it('has unique ids, valid regular expressions and catalog anti-patterns', () => {
    const catalogIds = new Set(repo.policies.antiPatterns.map((entry) => entry.id));
    expect(new Set(COPY_PATTERNS.map((entry) => entry.id)).size).toBe(COPY_PATTERNS.length);
    for (const entry of COPY_PATTERNS) {
      expect(entry.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(entry.locales.length, entry.id).toBeGreaterThan(0);
      const sources = entry.match.kind === 'mix' ? [entry.match.first, entry.match.second, entry.match.skip] : [entry.match.pattern, entry.match.kind === 'unit' ? entry.match.exempt : undefined];
      for (const source of sources.filter(Boolean)) expect(() => new RegExp(source!, 'u'), `${entry.id}: ${source}`).not.toThrow();
      for (const id of entry.antiPatternIds) expect(catalogIds, `${entry.id} -> ${id}`).toContain(id);
      for (const field of [entry.why, entry.instead, entry.example.flagged, entry.example.better]) expect(field.trim(), entry.id).not.toBe('');
    }
  });

  it('flags its own example and passes its own rewrite', () => {
    for (const entry of COPY_PATTERNS) {
      for (const locale of entry.locales) {
        if (entry.match.kind === 'unit') expect(ids([entry.example.flagged], locale), `${entry.id} ${locale}`).toContain(entry.id);
        expect(ids([entry.example.better], locale), `${entry.id} ${locale} rewrite`).toEqual([]);
      }
    }
  });

  it('makes only unsourced claims fix-now, and every fix-now claim can cite a source', () => {
    for (const entry of COPY_PATTERNS) {
      const claim = /social-proof|percent-outcome/.test(entry.id);
      expect(entry.verdict, entry.id).toBe(claim ? 'fix-now' : 'observation');
      if (entry.verdict === 'fix-now') expect(entry.match.kind === 'unit' && entry.match.exempt, entry.id).toBeTruthy();
    }
  });
});

describe('Korean patterns on sentences from the 2026-11-25 runs', () => {
  it.each(fixture.detect.map((entry) => [entry.run, entry.text, entry.patterns] as const))('%s: %s', (_run, text, expected) => {
    expect(ids([text], 'ko')).toEqual([...expected].sort());
  });

  it('pass the near misses', () => {
    for (const entry of fixture.clean) expect(ids([entry.text], 'ko'), `${entry.run}: ${entry.text}`).toEqual([]);
  });

  it('judge page-level density and register on whole sets of units', () => {
    for (const page of fixture.pages) expect(ids(page.units, 'ko'), page.run).toEqual([...page.patterns].sort());
  });

  it('accept a claim that states its source and date', () => {
    expect(ids(['3,200+ 사용 중인 팀 (2026년 10월 기준, 내부 집계)'], 'ko')).toEqual([]);
    expect(ids(['−87% 회의록 정리 시간*'], 'ko')).toEqual([]);
  });
});

describe('English and Japanese patterns on authored cases', () => {
  it('flag the English template lines and unsourced claims', () => {
    expect(ids(['Supercharge your meetings with seamless AI notes.'], 'en')).toEqual(['en-buzzwords']);
    expect(ids(['Built for teams, by teams'], 'en')).toEqual(['en-buzzwords']);
    expect(ids(['Get started →'], 'en')).toEqual(['en-generic-cta']);
    expect(ids(['Set up in 5 minutes.'], 'en')).toEqual(['en-setup-minutes']);
    expect(ids(['Manage everything in one place.'], 'en')).toEqual(['en-one-place']);
    expect(ids(['Trusted by 10,000+ teams'], 'en')).toEqual(['en-social-proof-count']);
    expect(ids(['Cut meeting time by 40%'], 'en')).toEqual(['en-percent-outcome']);
    expect(ids(['Trusted by 10,000+ teams (source: internal count, as of October 2026)'], 'en')).toEqual([]);
  });

  it('pass English near misses', () => {
    for (const text of ['Supports Node 18+ and Deno.', 'Get started with the CLI', 'A seamstress app for 12 tailors', 'Completion rate 86% this week', '100 requests per minute', 'Unlocking a door with the app takes 2 seconds']) {
      expect(ids([text], 'en'), text).toEqual([]);
    }
  });

  it('flag the Japanese template lines and unsourced claims, and pass near misses', () => {
    expect(ids(['会議をもっとスマートに。'], 'ja')).toEqual(['ja-smarter']);
    expect(ids(['プロフィールも通知も、すべてを一つに。'], 'ja')).toEqual(['ja-all-in-one']);
    expect(ids(['無料で始める'], 'ja')).toEqual(['ja-generic-cta']);
    expect(ids(['5分で設定完了'], 'ja')).toEqual(['ja-setup-minutes']);
    expect(ids(['3,000社以上が導入'], 'ja')).toEqual(['ja-social-proof-count']);
    expect(ids(['議事録作成時間を87%削減'], 'ja')).toEqual(['ja-percent-outcome']);
    expect(ids(['議事録作成時間を87%削減(2026年9月、12チームの社内調査)'], 'ja')).toEqual([]);
    for (const text of ['Node 18 以上に対応しています。', 'USB-C で 2 時間で充電できます。', 'カートに入れる', '今週の完了率 86%']) expect(ids([text], 'ja'), text).toEqual([]);
  });

  it('flag a Japanese screen that mixes です・ます and だ・である', () => {
    const polite = ['要約を Slack に送ります。', '担当者と期限を付けます。', '会議の 2 分後に届きます。'];
    const plain = ['議事録を書く人はもういらないのだ。', '会議に集中するだけである。', '設定は自動だ。'];
    expect(ids([...polite, ...plain], 'ja')).toEqual(['ja-mixed-register']);
    expect(ids([...polite, '「これで十分だ」と話しています。'], 'ja')).toEqual([]);
  });
});

describe('product voices', () => {
  const productTypes = repo.listProducts().map((product) => product.id).sort();

  it('cover every catalog product type', () => {
    expect(productTypes).toHaveLength(14);
    expect(VOICE_PROFILES.map((voice) => voice.productType).sort()).toEqual(productTypes);
  });

  it('write every Korean text in the profile register and every Japanese text in です・ます', () => {
    for (const voice of VOICE_PROFILES) {
      const texts = [voice.tone, voice.cta, voice.avoid, voice.sample.hero, voice.sample.empty, voice.sample.error];
      for (const text of texts) {
        for (const lang of LANGS) expect(text[lang].trim(), `${voice.productType} ${lang}`).not.toBe('');
        const other = voice.koRegister === '합니다체' ? KO_HAEYO : KO_HAPNIDA;
        for (const sentence of sentences(text.ko)) expect(other.test(sentence), `${voice.productType}: ${sentence}`).toBe(false);
        for (const sentence of sentences(text.ja)) expect(JA_PLAIN.test(sentence), `${voice.productType}: ${sentence}`).toBe(false);
      }
    }
  });

  it('keep samples within the profile sentence length and free of the patterns they warn about', () => {
    for (const voice of VOICE_PROFILES) {
      for (const text of [voice.sample.hero, voice.sample.empty, voice.sample.error]) {
        for (const sentence of sentences(text.en)) expect(sentence.split(/\s+/).length, `${voice.productType}: ${sentence}`).toBeLessThanOrEqual(voice.maxWords);
        for (const sentence of sentences(text.ko)) expect(sentence.split(/\s+/).length, `${voice.productType}: ${sentence}`).toBeLessThanOrEqual(voice.maxWords);
      }
      for (const lang of LANGS) {
        const texts = [voice.cta, voice.sample.hero, voice.sample.empty, voice.sample.error].map((text) => text[lang]);
        expect(ids(texts, lang), `${voice.productType} ${lang}`).toEqual([]);
      }
    }
  });

  it('have a rule for every copy concern in every language', () => {
    expect(Object.keys(COPY_RULES).sort()).toEqual(['button', 'confirm', 'empty', 'error', 'loading', 'numbers', 'register', 'states']);
    for (const [id, text] of Object.entries(COPY_RULES)) for (const lang of LANGS) expect(text[lang].trim(), `${id} ${lang}`).not.toBe('');
  });
});

describe('copy resources', () => {
  it('list the guide and pattern templates', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    const templates = resourceTemplates.map((template) => template.uriTemplate);
    expect(templates).toContain(`${COPY_GUIDE_URI}/{locale}`);
    expect(templates).toContain(`${COPY_PATTERNS_URI}/{locale}`);
    const manifest = await read('webstylebook://manifest');
    expect(manifest.resourceUriTemplates).toEqual(expect.arrayContaining([`${COPY_GUIDE_URI}/{locale}`, `${COPY_PATTERNS_URI}/{locale}`]));
  });

  it('serve the rules and voices in one language', async () => {
    const ko = await read(`${COPY_GUIDE_URI}/ko`);
    expect(ko).toMatchObject({ schema: 'webstylebook.copy-guide.v1', locale: 'ko', patternsUri: `${COPY_PATTERNS_URI}/ko` });
    expect(ko.rules.button).toBe(COPY_RULES.button.ko);
    expect(ko.voices).toHaveLength(14);
    expect(ko.voices.find((voice: { productType: string }) => voice.productType === 'commerce')).toMatchObject({ register: '해요체', cta: '장바구니에 담기' });
    const en = await read(`${COPY_GUIDE_URI}/en`);
    expect(en.voices[0].register).toBeUndefined();
  });

  it('serve only the patterns for the requested language', async () => {
    const ja = await read(`${COPY_PATTERNS_URI}/ja`);
    expect(ja.schema).toBe('webstylebook.copy-patterns.v1');
    const served = ja.patterns.map((entry: { id: string }) => entry.id);
    expect(served).toEqual(COPY_PATTERNS.filter((entry) => entry.locales.includes('ja')).map((entry) => entry.id));
    expect(served).toContain('em-dash-density');
    expect(served.some((id: string) => id.startsWith('ko-'))).toBe(false);
  });

  it('return an explicit error for an unknown locale or a query', async () => {
    expect((await read(`${COPY_GUIDE_URI}/fr`)).error.code).toBe('INVALID_INPUT');
    expect((await read(`${COPY_PATTERNS_URI}/ko?x=1`)).error.code).toBe('INVALID_INPUT');
  });
});
