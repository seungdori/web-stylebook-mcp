import type { CatalogRepository } from '../catalog/repository.js';
import { LANGS, type CatalogStyle, type LocalizedText } from '../types.js';
import type { MustHaveDef, ProductMustHaveDef } from './must-haves.js';
import { contentWords, jaccard, shingles } from './similarity.js';
import {
  GLOBAL_PATTERN_IDS, GUIDE_BASES, STRUCTURE_JOBS, STYLE_RULE_IDS,
  type StyleBanDef, type StructureGuideDef,
} from './types.js';

/** Above these overlaps two styles' guidance counts as copy-paste. */
export const DUPLICATE_LIMITS = {
  guidePhrase: 0.12,
  guideVocabulary: 0.6,
  fieldPhrase: 0.3,
  // Type-scale prose shares its technical words (rem, tracking, uppercase, tabular), so only a near-copy passes this.
  fieldVocabulary: 0.8,
  movePhrase: 0.3,
} as const;

const MOVE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function guideText(guide: StructureGuideDef): string {
  return [
    guide.hero, guide.grid, ...guide.sectionOrder, guide.density, guide.typeScale,
    ...guide.moves.map((move) => `${move.name}. ${move.build} ${move.purpose}`),
  ].join(' ');
}

function nameTokens(style: CatalogStyle | undefined, id: string): string[] {
  return [...id.split('-'), ...(style?.name.en.toLowerCase().match(/[a-z0-9]+/g) ?? [])];
}

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function paramErrors(ban: StyleBanDef): string[] {
  const p = ban.params as unknown as Record<string, unknown>;
  const errors: string[] = [];
  const need = (ok: boolean, message: string) => { if (!ok) errors.push(message); };
  switch (ban.rule) {
    case 'corner-radius':
      need((p.max === undefined) !== (p.min === undefined), 'needs exactly one of max or min');
      need(p.max === undefined || inRange(p.max, 0, 64), 'max must be 0-64');
      need(p.min === undefined || inRange(p.min, 1, 64), 'min must be 1-64');
      need(p.allowCircles === undefined || (typeof p.allowCircles === 'boolean' && p.max !== undefined), 'allowCircles is a boolean that only applies with max');
      break;
    case 'shadow-blur': need(inRange(p.maxBlurPx, 0, 64), 'maxBlurPx must be 0-64'); break;
    case 'hard-shadow': need(inRange(p.minOffsetPx, 1, 32), 'minOffsetPx must be 1-32'); break;
    case 'shadow-layers': need(inRange(p.maxLayers, 1, 6), 'maxLayers must be 1-6'); break;
    case 'gradient-fill': need(['any', 'cards', 'text'].includes(String(p.scope)), 'scope must be any, cards or text'); break;
    case 'backdrop-blur': need(inRange(p.maxBlurPx, 0, 64), 'maxBlurPx must be 0-64'); break;
    case 'glow':
      need(inRange(p.maxElements, 0, 20), 'maxElements must be 0-20');
      need(p.target === 'any' || p.target === 'text', 'target must be any or text');
      break;
    case 'centered-copy': need(inRange(p.minWords, 4, 60), 'minWords must be 4-60'); break;
    case 'unguarded-motion': need(typeof p.includeFinite === 'boolean', 'includeFinite must be boolean'); break;
    case 'eased-motion': need(inRange(p.maxDurationMs, 0, 1000), 'maxDurationMs must be 0-1000'); break;
    case 'accent-hues':
      need((p.max === undefined) !== (p.min === undefined), 'needs exactly one of max or min');
      need(p.max === undefined || inRange(p.max, 0, 6), 'max must be 0-6');
      need(p.min === undefined || inRange(p.min, 1, 6), 'min must be 1-6');
      need(inRange(p.minSaturation, 0.2, 1), 'minSaturation must be 0.2-1');
      break;
    case 'canvas': need(['pure-white', 'light', 'dark', 'tinted'].includes(String(p.forbid)), 'forbid is not a known canvas tone'); break;
    case 'text-on-effect':
      need(p.surface === 'gradient' || p.surface === 'glass', 'surface must be gradient or glass');
      need(inRange(p.minWords, 4, 80), 'minWords must be 4-80');
      break;
    case 'nested-surfaces': need(p.kind === 'card' || p.kind === 'glass', 'kind must be card or glass'); break;
    case 'icon-tiles': need(inRange(p.maxTiles, 0, 12), 'maxTiles must be 0-12'); break;
    case 'faint-borders': need(inRange(p.minAlpha, 0.05, 1), 'minAlpha must be 0.05-1'); break;
    case 'typeface': {
      const forbid = (p.forbid as unknown[] | undefined) ?? [];
      const families = (p.forbidFamilies as unknown[] | undefined) ?? [];
      need(p.role === 'display' || p.role === 'body', 'role must be display or body');
      need(p.require !== undefined || forbid.length + families.length > 0, 'needs require, forbid or forbidFamilies');
      need(forbid.every((kind) => ['monospace', 'serif', 'sans'].includes(String(kind))), 'forbid has an unknown face class');
      need(p.require === undefined || ['monospace', 'serif', 'sans'].includes(String(p.require)), 'require has an unknown face class');
      break;
    }
    case 'imagery': {
      const forbid = (p.forbid as unknown[] | undefined) ?? [];
      need(forbid.length > 0 && forbid.every((kind) => ['illustration', 'photo', 'emoji'].includes(String(kind))), 'forbid must list illustration, photo or emoji');
      break;
    }
    case 'crowded-grid': need(inRange(p.maxColumns, 1, 12), 'maxColumns must be 1-12'); break;
  }
  return errors;
}

function pathValue(root: unknown, path: string): unknown {
  let node = root;
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function sourceError(ban: StyleBanDef, style: CatalogStyle): string | null {
  const source = ban.source;
  if (source.kind === 'constraint') {
    return style.constraints.includes(source.text) ? null : `cites constraint "${source.text}", which the catalog entry does not have`;
  }
  if (source.kind === 'visual-contract') {
    const actual = pathValue(style.visualContract, source.path);
    return actual === source.value ? null : `cites visualContract.${source.path} = ${JSON.stringify(source.value)}, but the catalog has ${JSON.stringify(actual)}`;
  }
  return source.note.trim().length >= 12 ? null : 'specimen source needs a note';
}

/** Problems in authored structure guidance; an empty list means every catalog style is covered and grounded. */
export function validateStructureGuides(guides: readonly StructureGuideDef[], repo: CatalogRepository, requireAll = true): string[] {
  const errors: string[] = [];
  const seenStyles = new Set<string>();
  const moveIds = new Map<string, string>();
  const moveNames = new Map<string, string>();
  for (const guide of guides) {
    const at = `structure ${guide.styleId}`;
    const style = repo.getStyle(guide.styleId);
    if (!style) errors.push(`${at}: unknown catalog style`);
    if (seenStyles.has(guide.styleId)) errors.push(`${at}: duplicate guide`);
    seenStyles.add(guide.styleId);
    for (const [field, value] of [['hero', guide.hero], ['grid', guide.grid], ['density', guide.density], ['typeScale', guide.typeScale]] as const) {
      if (value.trim().length < 40) errors.push(`${at}: ${field} is missing or too thin`);
    }
    if (guide.sectionOrder.length < 3 || guide.sectionOrder.length > 7) errors.push(`${at}: sectionOrder needs 3-7 steps`);
    if (guide.sectionOrder.some((step) => step.trim().length < 12)) errors.push(`${at}: a sectionOrder step is too thin`);
    if (!GUIDE_BASES.includes(guide.basis)) errors.push(`${at}: unknown basis ${guide.basis}`);
    if (guide.departure !== undefined && (guide.basis !== 'authored' || guide.departure.trim().length < 40)) {
      errors.push(`${at}: a departure note needs an authored basis and a reason`);
    }
    if (guide.moves.length < 2 || guide.moves.length > 3) errors.push(`${at}: needs 2-3 signature moves`);
    for (const move of guide.moves) {
      if (!MOVE_ID.test(move.id)) errors.push(`${at}: move id '${move.id}' is not kebab-case`);
      const owner = moveIds.get(move.id);
      if (owner) errors.push(`${at}: move id '${move.id}' is also used by ${owner}`);
      moveIds.set(move.id, guide.styleId);
      const name = move.name.trim().toLowerCase();
      const nameOwner = moveNames.get(name);
      if (nameOwner) errors.push(`${at}: move name '${move.name}' is also used by ${nameOwner}`);
      moveNames.set(name, guide.styleId);
      if (move.name.trim().length < 4 || move.build.trim().length < 60 || move.purpose.trim().length < 25) {
        errors.push(`${at}: move '${move.id}' needs a name, a buildable description and a purpose`);
      }
      if (!move.jobs.length || move.jobs.some((job) => !STRUCTURE_JOBS.includes(job))) errors.push(`${at}: move '${move.id}' has no valid jobs`);
      if (!GUIDE_BASES.includes(move.basis)) errors.push(`${at}: move '${move.id}' has unknown basis`);
    }
    if (!guide.bans.length || guide.bans.length > 4) errors.push(`${at}: needs 1-4 style bans`);
    const banRules = new Set<string>();
    for (const ban of guide.bans) {
      if (!STYLE_RULE_IDS.includes(ban.rule)) { errors.push(`${at}: unknown rule ${ban.rule}`); continue; }
      if (banRules.has(ban.rule)) errors.push(`${at}: rule ${ban.rule} is banned twice; each rule gets one audit check per style`);
      banRules.add(ban.rule);
      for (const message of paramErrors(ban)) errors.push(`${at}: ban ${ban.rule} ${message}`);
      if (ban.why.trim().length < 20) errors.push(`${at}: ban ${ban.rule} needs a why`);
      if (style) {
        const problem = sourceError(ban, style);
        if (problem) errors.push(`${at}: ban ${ban.rule} ${problem}`);
      }
    }
    for (const [pattern, reason] of Object.entries(guide.allow ?? {})) {
      if (!(GLOBAL_PATTERN_IDS as readonly string[]).includes(pattern)) errors.push(`${at}: allow names unknown pattern ${pattern}`);
      if (!reason || reason.trim().length < 20) errors.push(`${at}: allow ${pattern} needs a reason`);
    }
  }
  if (requireAll) {
    for (const style of repo.allStyles()) {
      if (!seenStyles.has(style.id)) errors.push(`structure ${style.id}: catalog style has no structure guide`);
    }
  }
  errors.push(...duplicateGuidance(guides, repo));
  return errors;
}

/** Content words of one text with its own style's name words removed, plus the trigram set and counts derived from them. */
interface Prepared {
  words: string[];
  wordSet: Set<string>;
  trigrams: Set<string>;
  counts: Map<string, number>;
}

interface GuideWords {
  names: string[];
  all: Prepared;
  fields: Record<'hero' | 'grid' | 'density' | 'typeScale' | 'sectionOrder', Prepared>;
  moves: Array<{ id: string; text: Prepared }>;
}

function prepare(text: string, names: ReadonlySet<string>): Prepared {
  const words = contentWords(text, names);
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return { words, wordSet: new Set(words), trigrams: shingles(words, 3), counts };
}

function wordsOf(guide: StructureGuideDef, repo: CatalogRepository): GuideWords {
  const names = nameTokens(repo.getStyle(guide.styleId), guide.styleId);
  const own = new Set(names);
  return {
    names,
    all: prepare(guideText(guide), own),
    fields: {
      hero: prepare(guide.hero, own),
      grid: prepare(guide.grid, own),
      density: prepare(guide.density, own),
      typeScale: prepare(guide.typeScale, own),
      sectionOrder: prepare(guide.sectionOrder.join(' '), own),
    },
    moves: guide.moves.map((move) => ({ id: move.id, text: prepare(`${move.name} ${move.build}`, own) })),
  };
}

/** Trigrams of a prepared text once the other style's name words are also removed. */
function trigramsWithout(text: Prepared, otherNames: readonly string[]): Set<string> {
  if (!otherNames.some((name) => text.wordSet.has(name))) return text.trigrams;
  const ignore = new Set(otherNames);
  return shingles(text.words.filter((word) => !ignore.has(word)), 3);
}

function cosineWithout(a: Prepared, b: Prepared, ignore: ReadonlySet<string>): number {
  let dot = 0; let na = 0; let nb = 0;
  for (const [word, n] of a.counts) {
    if (ignore.has(word)) continue;
    na += n * n;
    dot += n * (b.counts.get(word) ?? 0);
  }
  for (const [word, n] of b.counts) if (!ignore.has(word)) nb += n * n;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Pairs of styles whose guidance, or any single field or move, is near-identical. */
export function duplicateGuidance(guides: readonly StructureGuideDef[], repo: CatalogRepository): string[] {
  const errors: string[] = [];
  const words = guides.map((guide) => wordsOf(guide, repo));
  const overlap = (x: Prepared, y: Prepared, xNames: readonly string[], yNames: readonly string[]) =>
    jaccard(trigramsWithout(x, yNames), trigramsWithout(y, xNames));
  for (let i = 0; i < guides.length; i++) {
    for (let j = i + 1; j < guides.length; j++) {
      const a = words[i]!; const b = words[j]!;
      // Both styles' own name words are dropped, so a copy that only swaps the style name still matches.
      const pair = `${guides[i]!.styleId} / ${guides[j]!.styleId}`;
      const whole = overlap(a.all, b.all, a.names, b.names);
      const vocabulary = cosineWithout(a.all, b.all, new Set([...a.names, ...b.names]));
      if (whole > DUPLICATE_LIMITS.guidePhrase) errors.push(`structure ${pair}: guidance shares ${whole.toFixed(2)} of its phrasing`);
      if (vocabulary > DUPLICATE_LIMITS.guideVocabulary) errors.push(`structure ${pair}: guidance vocabulary overlaps ${vocabulary.toFixed(2)}`);
      const names = new Set([...a.names, ...b.names]);
      for (const field of ['hero', 'grid', 'density', 'typeScale', 'sectionOrder'] as const) {
        const shared = overlap(a.fields[field], b.fields[field], a.names, b.names);
        if (shared > DUPLICATE_LIMITS.fieldPhrase) errors.push(`structure ${pair}: ${field} shares ${shared.toFixed(2)} of its phrasing`);
        const reused = cosineWithout(a.fields[field], b.fields[field], names);
        if (reused > DUPLICATE_LIMITS.fieldVocabulary) errors.push(`structure ${pair}: ${field} vocabulary overlaps ${reused.toFixed(2)}`);
      }
      for (const moveA of a.moves) {
        for (const moveB of b.moves) {
          const shared = overlap(moveA.text, moveB.text, a.names, b.names);
          if (shared > DUPLICATE_LIMITS.movePhrase) errors.push(`structure ${pair}: moves ${moveA.id} and ${moveB.id} share ${shared.toFixed(2)} of their phrasing`);
        }
      }
    }
  }
  return errors;
}

/**
 * Every catalog product archetype has a must-have list, every list names known must-haves once each, and every
 * must-have is used and fully localized.
 */
export function validateMustHaves(
  defs: readonly MustHaveDef[], products: readonly ProductMustHaveDef[], repo: CatalogRepository,
): string[] {
  const errors: string[] = [];
  const complete = (value: LocalizedText) => LANGS.every((lang) => value[lang]?.trim());
  const ids = new Set<string>();
  for (const def of defs) {
    if (ids.has(def.id)) errors.push(`duplicate must-have ${def.id}`);
    ids.add(def.id);
    if (!complete(def.name) || !complete(def.build)) errors.push(`must-have ${def.id} is not locale-complete`);
    if (!def.criteria.length) errors.push(`must-have ${def.id} has no detection criteria`);
  }
  const used = new Set<string>();
  const seen = new Set<string>();
  for (const entry of products) {
    if (seen.has(entry.productType)) errors.push(`duplicate must-have list for ${entry.productType}`);
    seen.add(entry.productType);
    if (!repo.getProduct(entry.productType)) errors.push(`must-have list for unknown product ${entry.productType}`);
    if (!complete(entry.page)) errors.push(`must-have list for ${entry.productType} page is not locale-complete`);
    if (!entry.items.length) errors.push(`must-have list for ${entry.productType} is empty`);
    const local = new Set<string>();
    for (const item of entry.items) {
      if (!ids.has(item.id)) errors.push(`${entry.productType} -> unknown must-have ${item.id}`);
      if (local.has(item.id)) errors.push(`${entry.productType} lists must-have ${item.id} twice`);
      local.add(item.id);
      used.add(item.id);
      if (!complete(item.why)) errors.push(`${entry.productType}/${item.id} why is not locale-complete`);
    }
  }
  for (const product of repo.data.productArchetypes) {
    if (!seen.has(product.id)) errors.push(`product ${product.id} has no must-have list`);
  }
  for (const id of ids) if (!used.has(id)) errors.push(`must-have ${id} is not used by any product type`);
  return errors;
}
