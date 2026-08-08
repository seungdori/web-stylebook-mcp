import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import {
  planUxPrinciples, PrinciplePlanError,
} from '../src/principles/planner.js';

const repo = CatalogRepository.load();

describe('UX principle planner', () => {
  it('uses outcome, surface, and phase weights without treating confidence as relevance', () => {
    const plan = planUxPrinciples({
      outcomes: ['decision'],
      surface: 'form',
      phase: 'interaction',
      limit: 2,
    }, repo);

    expect(plan.principles.map((principle) => ({
      id: principle.id,
      score: principle.score,
      confidence: principle.evidence.confidence,
    }))).toEqual([
      { id: 'choice-overload', score: 9, confidence: 'contested' },
      { id: 'hicks-law', score: 9, confidence: 'contextual' },
    ]);
  });

  it('normalizes duplicate outcomes and is independent of catalog array order', () => {
    const input = {
      outcomes: ['feedback', 'trust', 'feedback'] as const,
      surface: 'chat' as const,
      phase: 'interaction' as const,
    };
    const normal = planUxPrinciples(input, repo);
    const reversedEnvelope = structuredClone(repo.envelope);
    reversedEnvelope.data.uxPrinciples.reverse();
    const reversed = planUxPrinciples(input, new CatalogRepository(reversedEnvelope));

    expect(normal.query.outcomes).toEqual(['feedback', 'trust']);
    expect(reversed).toEqual(normal);
  });

  it('strict matching intersects outcomes, surface, and phase for audit selection', () => {
    const union = planUxPrinciples({
      outcomes: ['decision'], surface: 'settings', phase: 'validation', limit: 12,
    }, repo);
    const strict = planUxPrinciples({
      outcomes: ['decision'], surface: 'settings', phase: 'validation',
      matchMode: 'all-selectors', limit: 12,
    }, repo);

    expect(strict.coverage.matching).toBeLessThan(union.coverage.matching);
    expect(strict.principles.every((principle) => principle.score >= 7)).toBe(true);
    expect(strict.query.matchMode).toBe('all-selectors');
  });

  it('returns every explicitly requested id by default, preserves order, and keeps real relevance scores', () => {
    const principleIds = [
      'postels-law',
      'choice-overload',
      'aesthetic-usability-effect',
      'fitts-law',
      'working-memory',
      'peak-end-rule',
      'zeigarnik-effect',
    ];
    const plan = planUxPrinciples({ principleIds, outcomes: ['feedback'] }, repo);

    expect(plan.query.limit).toBe(7);
    expect(plan.principles.map((principle) => principle.id)).toEqual(principleIds);
    expect(plan.principles.find((principle) => principle.id === 'postels-law')?.score).toBe(4);
    expect(plan.principles.find((principle) => principle.id === 'aesthetic-usability-effect')?.score).toBe(0);
    expect(plan.principles.every((principle) => principle.whyRelevant[0] === 'requested directly')).toBe(true);
  });

  it('localizes authored guidance while keeping stable ids, URLs, evidence, and license boundaries', () => {
    const plan = planUxPrinciples({
      principleIds: ['working-memory'],
      locale: 'ko',
    }, repo);
    const item = plan.principles[0]!;

    expect(item.id).toBe('working-memory');
    expect(item.name).toBe('작업 기억');
    expect(item.designQuestion).toMatch(/[가-힣]/);
    expect(item.apply.every((entry) => /[가-힣]/.test(entry))).toBe(true);
    expect(item.resourceUri).toBe('webstylebook://principles/working-memory');
    expect(item.evidence.references[0]?.title).toBeTruthy();
    expect(plan.attribution.notice).toMatch(/[가-힣]/);
    expect(plan.attribution.sourceLicense.name).toBe('CC BY-NC-ND 4.0');
    expect(plan.attribution.authoredContentLicense.name).toBe('MIT');
  });

  it('keeps cautions and evidence limitations attached to contested or security-sensitive principles', () => {
    const choice = repo.getPrinciple('choice-overload')!;
    const postel = repo.getPrinciple('postels-law')!;
    const zeigarnik = repo.getPrinciple('zeigarnik-effect')!;

    expect(choice.evidence.confidence).toBe('contested');
    expect(zeigarnik.evidence.confidence).toBe('contested');
    expect(postel.caution.en).toMatch(/security|validation|protocol/i);
    expect(postel.evidence.references.some((reference) => reference.url.includes('rfc9413'))).toBe(true);
  });

  it('rejects no selectors, invalid direct limits, and unknown ids', () => {
    expect(() => planUxPrinciples({}, repo)).toThrow(PrinciplePlanError);
    expect(() => planUxPrinciples({ outcomes: ['action'], limit: 0 }, repo)).toThrow(/limit/);
    expect(() => planUxPrinciples({ outcomes: ['action'], limit: 13 }, repo)).toThrow(/limit/);
    expect(() => planUxPrinciples({ principleIds: ['fittss-law'] }, repo))
      .toThrow(/unknown UX principle/);
    expect(repo.getPrinciple('fitts-law')?.referenceUrl)
      .toBe('https://lawsofux.com/fittss-law/');
  });
});
