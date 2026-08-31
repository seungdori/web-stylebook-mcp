import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import {
  getDesignReferenceDetail,
  searchDesignReferences,
} from '../src/references/search.js';

const repo = CatalogRepository.load();

describe('real-world design reference repository', () => {
  it('builds typed id, category, and case-insensitive tag indexes', () => {
    expect(repo.allReferences()).toHaveLength(520);
    expect(repo.getReference('linear')?.title).toBe('Linear');
    expect(repo.referencesForCategory('technology').length).toBeGreaterThan(200);
    expect(repo.referencesForTag('dark mode').map((reference) => reference.id)).toContain('linear');
    expect(repo.referencesForTag(' DARK MODE ').map((reference) => reference.id)).toContain('linear');
    expect(repo.listReferenceTags()).toContain('Dark Mode');
  });

  it('applies category and all requested tag filters before ranking', () => {
    const result = searchDesignReferences({
      category: 'technology',
      tags: ['Dark Mode', 'SaaS'],
      limit: 20,
    }, repo);
    expect(result.results.length).toBeGreaterThan(0);
    for (const reference of result.results) {
      expect(reference.category).toBe('technology');
      expect(reference.tags).toEqual(expect.arrayContaining(['Dark Mode', 'SaaS']));
    }
  });

  it('ranks exact ids first and returns only the selected locale', () => {
    const result = searchDesignReferences({ query: 'linear', locale: 'ko' }, repo);
    expect(result.results[0]?.id).toBe('linear');
    expect(result.results[0]?.summary).toMatch(/[가-힣]/);
    expect(typeof result.results[0]?.summary).toBe('string');
    expect(result.results[0]).not.toHaveProperty('tokens');
  });

  it('keeps result payloads bounded even for direct engine calls', () => {
    expect(searchDesignReferences({ limit: 200 }, repo).returned).toBe(20);
    expect(searchDesignReferences({}, repo).returned).toBe(8);
  });

  it('localizes one full detail while retaining tokens, provenance, and rights', () => {
    const reference = repo.getReference('linear')!;
    const detail = getDesignReferenceDetail(reference, 'ja', repo);
    expect(detail.reference.tokens.colors).toBeDefined();
    expect(detail.reference.analysis.notes).toMatch(/[ぁ-んァ-ヶ一-龠]/);
    expect(typeof detail.reference.analysis.notes).toBe('string');
    expect(detail.attribution.sourceLicense.name).toBe('CC BY 4.0');
    expect(detail.attribution.rightsNotice).toMatch(/[ぁ-んァ-ヶ一-龠]/);
    expect(detail.library.sourceRevision).toMatch(/^[0-9a-f]{40}$/);
    expect(detail.library.sourceFiles).toEqual(repo.referenceLibrary.sourceFiles);
  });
});
