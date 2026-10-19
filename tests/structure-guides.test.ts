import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { buildPage } from '../src/structure/dom/page.js';
import { detectStyleBan } from '../src/structure/rules.js';
import { styleStructure, structureRulesetHash } from '../src/structure/guidance.js';
import { STRUCTURE_GUIDES } from '../src/structure/guides/index.js';
import { GLOBAL_PATTERNS, STYLE_RULES } from '../src/structure/patterns.js';
import { phraseOverlap, vocabularyOverlap } from '../src/structure/similarity.js';
import type { StructureGuideDef } from '../src/structure/types.js';
import { DUPLICATE_LIMITS, duplicateGuidance, guideText, validateStructureGuides } from '../src/structure/validate.js';
import { LANGS } from '../src/types.js';

const repo = CatalogRepository.load();
const guide = (id: string) => STRUCTURE_GUIDES.find((item) => item.styleId === id)!;

describe('structure guides', () => {
  it('cover all 48 catalog styles exactly once and pass grounding validation', () => {
    expect(STRUCTURE_GUIDES.map((item) => item.styleId).sort()).toEqual(repo.allStyles().map((style) => style.id).sort());
    expect(STRUCTURE_GUIDES).toHaveLength(48);
    expect(validateStructureGuides(STRUCTURE_GUIDES, repo)).toEqual([]);
  });

  it('give every style a full archetype and 2-3 buildable signature moves', () => {
    for (const item of STRUCTURE_GUIDES) {
      const view = styleStructure(item.styleId, repo);
      expect(view.archetype.hero.length, item.styleId).toBeGreaterThan(40);
      expect(view.archetype.grid.length, item.styleId).toBeGreaterThan(40);
      expect(view.archetype.sectionOrder.length, item.styleId).toBeGreaterThanOrEqual(3);
      expect(view.archetype.density.note.length, item.styleId).toBeGreaterThan(40);
      expect(view.archetype.typeScale.note.length, item.styleId).toBeGreaterThan(40);
      expect(view.signatureMoves.length, item.styleId).toBeGreaterThanOrEqual(2);
      expect(view.signatureMoves.length, item.styleId).toBeLessThanOrEqual(3);
      for (const move of view.signatureMoves) {
        expect(move.build.length, move.id).toBeGreaterThan(60);
        expect(move.purpose.length, move.id).toBeGreaterThan(25);
        expect(move.jobs.length, move.id).toBeGreaterThan(0);
      }
      expect(view.bannedPatterns.style.length, item.styleId).toBeGreaterThan(0);
    }
  });

  it('takes density and type-scale numbers from the visual contract, not from authored text', () => {
    const brutal = styleStructure('brutalist-grid', repo);
    const contract = repo.getStyle('brutalist-grid')!.visualContract!;
    expect(brutal.archetype.density).toMatchObject({ spacing: contract.spacing.density, rowPx: contract.spacing.row, gutterPx: contract.spacing.gutter, sectionPx: contract.spacing.section });
    expect(brutal.archetype.typeScale.displayRem).toEqual({ min: contract.typography.roles.display.sizeMinRem, max: contract.typography.roles.display.sizeMaxRem });
    expect(brutal.archetype.typeScale.displayToBody).toBe(Math.round((10 / 0.88) * 100) / 100);
    const ratios = new Set(STRUCTURE_GUIDES.map((item) => styleStructure(item.styleId, repo).archetype.typeScale.displayToBody));
    expect(ratios.size).toBeGreaterThan(20);
  });

  it('flags two styles that share near-identical guidance, including a renamed copy', () => {
    const base = guide('brutalist-grid');
    const lightlyEdited: StructureGuideDef = {
      ...base,
      styleId: 'editorial-silence',
      hero: base.hero.replace('ruled', 'lined'),
      moves: base.moves.map((move) => ({ ...move, id: `${move.id}-copy`, name: `${move.name} copy` })),
    };
    expect(duplicateGuidance([base, lightlyEdited], repo).length).toBeGreaterThan(0);
    const renamed = JSON.parse(JSON.stringify(base).replaceAll('Brutalist Grid', 'Swiss Poster')) as StructureGuideDef;
    renamed.styleId = 'swiss-poster';
    renamed.moves = renamed.moves.map((move) => ({ ...move, id: `${move.id}-renamed` }));
    expect(duplicateGuidance([base, renamed], repo).some((message) => message.includes('brutalist-grid / swiss-poster'))).toBe(true);
    const oneMove = { ...guide('swiss-poster'), moves: [...guide('swiss-poster').moves.slice(0, 2), { ...base.moves[0]!, id: 'borrowed-move' }] };
    expect(duplicateGuidance([base, oneMove], repo).some((message) => message.includes('borrowed-move'))).toBe(true);
    const errors = validateStructureGuides([...STRUCTURE_GUIDES.filter((item) => item.styleId !== 'editorial-silence'), lightlyEdited], repo);
    expect(errors.some((message) => message.includes('brutalist-grid / editorial-silence'))).toBe(true);
  });

  it('flags a single field copied from another style with its words reordered', () => {
    const base = guide('brutalist-grid');
    const reordered = { ...guide('swiss-poster'), typeScale: base.typeScale.split(' ').reverse().join(' ') };
    expect(duplicateGuidance([base, reordered], repo).some((message) => message.includes('typeScale vocabulary'))).toBe(true);
  });

  it('keeps every real pair of styles under the duplicate limits', () => {
    let phrase = 0; let vocabulary = 0;
    for (let i = 0; i < STRUCTURE_GUIDES.length; i++) {
      for (let j = i + 1; j < STRUCTURE_GUIDES.length; j++) {
        phrase = Math.max(phrase, phraseOverlap(guideText(STRUCTURE_GUIDES[i]!), guideText(STRUCTURE_GUIDES[j]!)));
        vocabulary = Math.max(vocabulary, vocabularyOverlap(guideText(STRUCTURE_GUIDES[i]!), guideText(STRUCTURE_GUIDES[j]!)));
      }
    }
    expect(phrase).toBeLessThan(DUPLICATE_LIMITS.guidePhrase);
    expect(vocabulary).toBeLessThan(DUPLICATE_LIMITS.guideVocabulary);
  });

  it('writes fusions as their own composition, not as a parent restated', () => {
    for (const style of repo.allStyles().filter((item) => item.kind === 'fusion')) {
      for (const parentId of style.fusionOf ?? []) {
        const overlap = phraseOverlap(guideText(guide(style.id)), guideText(guide(parentId)));
        expect(overlap, `${style.id} vs ${parentId}`).toBeLessThan(DUPLICATE_LIMITS.guidePhrase);
        const parentMoves = new Set(guide(parentId).moves.map((move) => move.name.toLowerCase()));
        expect(guide(style.id).moves.some((move) => parentMoves.has(move.name.toLowerCase())), style.id).toBe(false);
      }
    }
  });

  it('derives most moves and bans from the specimen, blueprint, or catalog', () => {
    const moves = STRUCTURE_GUIDES.flatMap((item) => item.moves);
    expect(moves.filter((move) => move.basis === 'authored').length / moves.length).toBeLessThanOrEqual(0.2);
    const bans = STRUCTURE_GUIDES.flatMap((item) => item.bans);
    expect(bans.filter((ban) => ban.source.kind !== 'specimen').length / bans.length).toBeGreaterThanOrEqual(0.6);
  });

  it('never prescribes the one-accent-word headline that the catalog flags as the AI headline cadence', () => {
    const cadence = /\bone (?:word|phrase)\b|\b(?:accent|hot|lit|brass|amber|mint|rust) (?:word|phrase)\b/i;
    for (const item of STRUCTURE_GUIDES) expect(guideText(item), item.styleId).not.toMatch(cadence);
  });

  it('gives most styles a move the audit can offer in place of a logo strip, testimonial carousel, or icon card grid', () => {
    const covered = STRUCTURE_GUIDES.filter((item) => item.moves.some((move) => move.jobs.includes('proof'))
      && item.moves.some((move) => move.jobs.includes('capabilities')));
    expect(covered.length / STRUCTURE_GUIDES.length).toBeGreaterThanOrEqual(0.75);
    expect(STRUCTURE_GUIDES.every((item) => item.moves.some((move) => move.jobs.includes('opening')) || item.hero.length > 40)).toBe(true);
  });
});

describe('a correct build of each style passes its own bans', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

  it.each(STRUCTURE_GUIDES.map((item) => [item.styleId, item] as const))('%s', (styleId, item) => {
    const style = repo.getStyle(styleId)!;
    const contract = style.visualContract!;
    const mode = contract.modes[contract.defaultMode]!;
    const colors = mode.colors;
    const roles = contract.typography.roles;
    const shadow = (mode.shadows ?? contract.shadows).md;
    const css = `body { background-color: ${colors.canvas}; color: ${colors.text}; font-family: ${roles.body.fontFamily}; }
      h1, h2 { font-family: ${roles.display.fontFamily}; }
      .panel { background-color: ${colors.surface}; border: ${contract.borders.width}px ${contract.borders.style} ${colors.border}; border-radius: ${contract.radii.lg}px; box-shadow: ${shadow}; }
      .action { background-color: ${colors.actionPrimary}; color: ${colors.actionPrimaryText}; border-radius: ${contract.radii.md}px; }
      a { color: ${colors.link}; }`;
    // A minimum-hue ban is about the whole palette, which one panel cannot show; lay the catalog palette out as swatches.
    const swatches = item.bans.some((ban) => ban.rule === 'accent-hues' && ban.params.min !== undefined)
      ? style.palette.map((color) => `<div style="background-color: ${color}"><p>${words(3)}</p></div>`).join('') : '';
    const html = `<html><body><main><section><h1>Product name</h1><div class="panel"><h2>Panel</h2><p>${words(30)}</p><a class="action" href="/go">Continue</a></div>${swatches}</section></main></body></html>`;
    const page = buildPage(html, [css], { viewportWidth: 1440, viewportHeight: 900 }, 1000);
    for (const ban of item.bans) expect(detectStyleBan(page, ban).status, `${styleId}/${ban.rule}`).not.toBe('found');
  });
});

describe('banned pattern definitions', () => {
  it('localize every global pattern and point at real catalog anti-patterns and audit checks', () => {
    for (const pattern of GLOBAL_PATTERNS) {
      for (const field of [pattern.name, pattern.description, pattern.replace]) {
        for (const lang of LANGS) expect(field[lang]?.trim(), `${pattern.id}.${lang}`).toBeTruthy();
      }
      expect(pattern.criteria.length).toBeGreaterThan(0);
      for (const id of pattern.antiPatternIds) expect(repo.policies.antiPatterns.some((item) => item.id === id), id).toBe(true);
      for (const id of pattern.auditCheckIds) expect(repo.policies.auditChecks.some((item) => item.id === id), id).toBe(true);
    }
  });

  it('localize the wording of every authored style ban', () => {
    for (const item of STRUCTURE_GUIDES) {
      for (const ban of item.bans) {
        const rule = STYLE_RULES[ban.rule] as { name: (p: unknown) => Record<string, string>; fix: (p: unknown) => Record<string, string>; criteria: (p: unknown) => unknown[] };
        for (const lang of LANGS) {
          expect(rule.name(ban.params)[lang]?.trim(), `${item.styleId}/${ban.rule}.${lang}`).toBeTruthy();
          expect(rule.fix(ban.params)[lang]?.trim(), `${item.styleId}/${ban.rule}.${lang}`).toBeTruthy();
        }
        expect(rule.criteria(ban.params).length).toBeGreaterThan(0);
      }
    }
  });

  it('expose a stable ruleset hash', () => {
    expect(structureRulesetHash()).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(structureRulesetHash()).toBe(structureRulesetHash());
  });
});
