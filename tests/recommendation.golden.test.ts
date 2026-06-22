import { describe, it, expect } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import type { ProductContext } from '../src/recommendation/types.js';

const repo = CatalogRepository.load();
const rec = (input: ProductContext) => recommendDesignDirection(input, repo);

interface GoldenCase {
  id: string;
  input: ProductContext;
  expect: {
    candidatesNonEmpty?: boolean;
    topIncludes?: string[];        // at least one must be present among candidates
    rejectedIncludes?: string[];   // styleIds that must be rejected
    rejectedReason?: { styleId: string; code: string };
    notInCandidates?: string[];
    confidenceNot?: ('low' | 'medium' | 'high')[];
    confidence?: 'low' | 'medium' | 'high';
  };
}

const CASES: GoldenCase[] = [
  {
    id: 'sre-dashboard',
    input: { productType: 'operational-saas', productDescription: 'Daily monitoring dashboard for SREs; high density; calm.', tone: ['calm', 'technical'], density: 'high', usageFrequency: 'daily', avoid: ['cyberpunk decoration'] },
    expect: { topIncludes: ['runtime-signal'], rejectedIncludes: ['cyberpunk-glitch'], rejectedReason: { styleId: 'cyberpunk-glitch', code: 'EXPLICITLY_AVOIDED' }, notInCandidates: ['cyberpunk-glitch'], confidenceNot: ['low'] },
  },
  { id: 'finance-admin', input: { productType: 'finance-admin', productDescription: 'Internal billing and ledger admin; trust matters.', tone: ['trustworthy', 'technical'], density: 'high', usageFrequency: 'daily', trustSensitivity: 'high' }, expect: { candidatesNonEmpty: true, confidenceNot: ['low'] } },
  { id: 'healthcare-portal', input: { productType: 'healthcare-portal', productDescription: 'Patient portal for appointments and records.', tone: ['calm', 'trustworthy'], trustSensitivity: 'high' }, expect: { candidatesNonEmpty: true } },
  { id: 'developer-cli-docs', input: { productType: 'documentation', productDescription: 'API reference for a developer SDK.', tone: ['technical', 'editorial'], density: 'medium' }, expect: { candidatesNonEmpty: true } },
  { id: 'ecommerce-checkout', input: { productType: 'commerce', productDescription: 'Online store checkout and catalog.', tone: ['trustworthy', 'premium'], trustSensitivity: 'high', usageFrequency: 'occasional' }, expect: { candidatesNonEmpty: true } },
  { id: 'campaign-launch', input: { productType: 'campaign', productDescription: 'A bold one-off product launch landing page.', tone: ['bold', 'experimental'], usageFrequency: 'one-off' }, expect: { candidatesNonEmpty: true } },
  { id: 'portfolio', input: { productType: 'portfolio', productDescription: 'A design studio portfolio.', tone: ['editorial', 'premium'] }, expect: { candidatesNonEmpty: true } },
  { id: 'ai-chat', input: { productType: 'ai-chat', productDescription: 'A conversational AI assistant interface.', tone: ['calm', 'technical'], usageFrequency: 'daily' }, expect: { candidatesNonEmpty: true } },
  { id: 'security-console', input: { productType: 'security-console', productDescription: 'A SIEM threat investigation console used daily.', tone: ['technical'], density: 'high', usageFrequency: 'daily' }, expect: { candidatesNonEmpty: true } },
  { id: 'data-analytics', input: { productType: 'data-analytics', productDescription: 'A BI dashboard with charts and reports.', tone: ['calm', 'technical'], density: 'high' }, expect: { candidatesNonEmpty: true } },
  { id: 'content-editorial', input: { productType: 'content-editorial', productDescription: 'A long-form magazine publication.', tone: ['editorial'] }, expect: { candidatesNonEmpty: true } },
  { id: 'knowledge-base', input: { productType: 'knowledge-base', productDescription: 'A help center and FAQ.', tone: ['calm'], density: 'low' }, expect: { candidatesNonEmpty: true } },
  { id: 'consumer-app', input: { productType: 'consumer-app', productDescription: 'A friendly consumer lifestyle app.', tone: ['playful'], usageFrequency: 'daily' }, expect: { candidatesNonEmpty: true } },
  { id: 'developer-tool', input: { productType: 'developer-tool', productDescription: 'A CLI dashboard and local dev console.', tone: ['technical'], density: 'high', usageFrequency: 'daily' }, expect: { candidatesNonEmpty: true } },
  { id: 'description-only-sparse', input: { productDescription: 'Something for a team to use.' }, expect: { candidatesNonEmpty: true, confidenceNot: ['high'] } },
  { id: 'avoid-by-style-id', input: { productType: 'operational-saas', productDescription: 'ops dashboard', avoid: ['runtime-signal'] }, expect: { rejectedReason: { styleId: 'runtime-signal', code: 'EXPLICITLY_AVOIDED' }, notInCandidates: ['runtime-signal'] } },
];

describe('recommendation golden', () => {
  for (const c of CASES) {
    it(c.id, () => {
      const r = rec(c.input);
      if (c.expect.candidatesNonEmpty) expect(r.candidates.length).toBeGreaterThan(0);
      if (c.expect.topIncludes) {
        const ids = r.candidates.map((x) => x.styleId);
        expect(c.expect.topIncludes.some((s) => ids.includes(s))).toBe(true);
      }
      for (const s of c.expect.rejectedIncludes ?? []) {
        expect(r.rejected.map((x) => x.styleId)).toContain(s);
      }
      if (c.expect.rejectedReason) {
        const rej = r.rejected.find((x) => x.styleId === c.expect.rejectedReason!.styleId);
        expect(rej, `${c.expect.rejectedReason.styleId} should be rejected`).toBeDefined();
        expect(rej!.reasonCodes).toContain(c.expect.rejectedReason.code);
      }
      for (const s of c.expect.notInCandidates ?? []) {
        expect(r.candidates.map((x) => x.styleId)).not.toContain(s);
      }
      for (const conf of c.expect.confidenceNot ?? []) expect(r.confidence).not.toBe(conf);
      if (c.expect.confidence) expect(r.confidence).toBe(c.expect.confidence);
    });
  }

  it('is deterministic (byte-identical across runs)', () => {
    const input: ProductContext = CASES[0]!.input;
    expect(JSON.stringify(rec(input))).toEqual(JSON.stringify(rec(input)));
  });

  it('never includes an avoided style in candidates', () => {
    for (const c of CASES) {
      const r = rec(c.input);
      for (const a of c.input.avoid ?? []) {
        // if avoid matched a style id directly, it must not surface as a candidate
        const matchedId = repo.allStyles().find((s) => s.id === a)?.id;
        if (matchedId) expect(r.candidates.map((x) => x.styleId)).not.toContain(matchedId);
      }
    }
  });

  it('every recommendation carries reasons, assumptions, and guidance', () => {
    const r = rec(CASES[1]!.input);
    expect(r.guidance.length).toBeGreaterThan(0);
    expect(Array.isArray(r.resolvedContext.assumptions)).toBe(true);
    expect(r.candidates.every((c) => c.matched.length > 0)).toBe(true);
  });
});
