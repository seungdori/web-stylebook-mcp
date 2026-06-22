// compare_design_directions (01 §8.3). Compares 2-4 directions across axes and
// returns each direction's favorable conditions + likely failure mode — never a
// single winner.

import type { CatalogStyle, Intensity, Density, TrustLevel, UsageFrequency, ProductType, Tone, Lang } from '../types.js';
import type { CatalogRepository } from '../catalog/repository.js';
import type { ProductContext } from './types.js';
import { normalizeContext } from './normalize-context.js';

export interface CompareInput {
  directions: Array<{ primaryStyleId: string; secondaryStyleId?: string }>;
  product?: ProductContext;
  locale?: Lang;
}

export interface DirectionProfile {
  primaryStyleId: string;
  secondaryStyleId?: string;
  axes: {
    productFit: string;
    repeatedUseSuitability: string;
    informationDensity: string;
    trust: string;
    visualDistinctiveness: string;
    accessibilityRisk: string;
    motionIntensity: Intensity;
    maintenanceRisk: Intensity;
  };
  favoredWhen: string[];
  likelyFailureMode: string;
  cautions: string[];
}

export interface CompareResult {
  directions: DirectionProfile[];
  note: string;
}

export class CompareError extends Error {}

const RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };
const maxRank = (a: string, b: string): string => ((RANK[a] ?? 1) >= (RANK[b] ?? 1) ? a : b);

function maxLevel(levels: string[]): string {
  if (!levels.length) return 'medium';
  return levels.reduce((acc, l) => (RANK[l] ?? 1) > (RANK[acc] ?? 1) ? l : acc, levels[0] as string);
}

// A direction's combined facet signals: primary alone, or merged with the secondary
// (worst-case for risk axes, union for coverage) so secondaryStyleId actually matters.
interface Signals {
  family: string | undefined;
  motionIntensity: Intensity;
  continuousSpectacle: boolean;
  maintenanceComplexity: Intensity;
  density: Density[];
  trust: TrustLevel[];
  usageFrequency: UsageFrequency[];
  productTypes: ProductType[];
  risks: string[];
  tones: Tone[];
}

function combine(primary: CatalogStyle, secondary?: CatalogStyle): Signals {
  const p = primary.recommendationFacets;
  if (!secondary) {
    return {
      family: primary.styleFamilyId, motionIntensity: p.motionIntensity, continuousSpectacle: p.continuousSpectacle,
      maintenanceComplexity: p.maintenanceComplexity, density: p.density, trust: p.trust, usageFrequency: p.usageFrequency,
      productTypes: p.productTypes, risks: p.risks, tones: p.tones,
    };
  }
  const s = secondary.recommendationFacets;
  const uniq = <T>(a: T[], b: T[]) => [...new Set([...a, ...b])];
  // trust and usageFrequency are SAFETY/CEILING axes, not coverage — merge WORST-CASE so a
  // calm high-trust accent can never upgrade a bold primary's trust or daily-reuse rating
  // (round 6: best-of-union on these axes inflated the safety rating).
  const lowerTrust = (RANK[maxLevel(p.trust)] ?? 1) <= (RANK[maxLevel(s.trust)] ?? 1) ? p.trust : s.trust;
  const dailyFloor = p.usageFrequency.filter((u) => s.usageFrequency.includes(u)); // intersection: daily-suitable only if BOTH are
  return {
    family: primary.styleFamilyId === secondary.styleFamilyId ? primary.styleFamilyId : 'mixed',
    motionIntensity: maxRank(p.motionIntensity, s.motionIntensity) as Intensity,
    continuousSpectacle: p.continuousSpectacle || s.continuousSpectacle,
    maintenanceComplexity: maxRank(p.maintenanceComplexity, s.maintenanceComplexity) as Intensity,
    density: uniq(p.density, s.density), trust: lowerTrust, usageFrequency: dailyFloor,
    productTypes: uniq(p.productTypes, s.productTypes), risks: uniq(p.risks, s.risks), tones: uniq(p.tones, s.tones),
  };
}

function distinctiveness(sig: Signals): string {
  if (sig.continuousSpectacle || sig.motionIntensity === 'high' || sig.family === 'expressive' || sig.family === 'fluid') return 'high';
  if (sig.family === 'soft' || sig.family === 'editorial' || sig.family === 'mixed' || sig.motionIntensity === 'medium') return 'medium';
  return 'low';
}

function accessibilityRisk(sig: Signals): string {
  const riskStr = sig.risks.join(' ').toLowerCase();
  const flags = ['low contrast', 'subtle borders', 'continuous motion', 'ambient motion', 'heavy animation', 'dark-only'];
  let hits = flags.filter((f) => riskStr.includes(f)).length;
  if (sig.motionIntensity === 'high' || sig.continuousSpectacle) hits += 1; // motion intensity is itself an a11y risk
  return hits >= 2 ? 'high' : hits === 1 ? 'medium' : 'low';
}

function repeatedUse(sig: Signals): string {
  if (sig.continuousSpectacle || sig.motionIntensity === 'high') return 'low';
  if (sig.usageFrequency.includes('daily')) return 'high';
  return 'medium';
}

// symmetric productType adjacency over the catalog ontology map
function adjacentTypes(pt: ProductType, repo: CatalogRepository): Set<ProductType> {
  const adj = repo.ontology.productAdjacency;
  const out = new Set<ProductType>(adj[pt] ?? []);
  for (const [k, vs] of Object.entries(adj)) if (vs.includes(pt)) out.add(k as ProductType);
  return out;
}

export function compareDirections(input: CompareInput, repo: CatalogRepository): CompareResult {
  if (input.directions.length < 2 || input.directions.length > 4) {
    throw new CompareError('compare requires 2 to 4 directions');
  }
  const ctx = input.product ? normalizeContext(input.product, repo) : null;

  const profiles: DirectionProfile[] = input.directions.map((d) => {
    const s = repo.getStyle(d.primaryStyleId);
    if (!s) throw new CompareError(`unknown style '${d.primaryStyleId}'`);
    const secondary = d.secondaryStyleId ? repo.getStyle(d.secondaryStyleId) : undefined;
    if (d.secondaryStyleId && !secondary) throw new CompareError(`unknown secondary style '${d.secondaryStyleId}'`);
    const sig = combine(s, secondary);

    let productFit = 'n/a';
    if (ctx) {
      const pt = ctx.productType.value;
      if (pt === 'other') productFit = 'n/a';
      else if (sig.productTypes.includes(pt)) productFit = 'strong';
      else if ([...adjacentTypes(pt, repo)].some((a) => sig.productTypes.includes(a))) productFit = 'adjacent';
      else productFit = 'weak';
    }

    return {
      primaryStyleId: s.id,
      ...(d.secondaryStyleId ? { secondaryStyleId: d.secondaryStyleId } : {}),
      axes: {
        productFit,
        repeatedUseSuitability: repeatedUse(sig),
        informationDensity: maxLevel(sig.density),
        trust: maxLevel(sig.trust),
        visualDistinctiveness: distinctiveness(sig),
        accessibilityRisk: accessibilityRisk(sig),
        motionIntensity: sig.motionIntensity,
        maintenanceRisk: sig.maintenanceComplexity,
      },
      favoredWhen: sig.productTypes.slice(0, 3).map((p) => `${p}`).concat(sig.tones.slice(0, 2).map((t) => `${t} tone`)),
      likelyFailureMode: sig.risks[0] ? `Most likely failure: ${sig.risks[0]} left unchecked.` : 'Few intrinsic failure modes.',
      cautions: sig.risks.slice(0, 3),
    };
  });

  return {
    directions: profiles,
    note: 'No single winner. Choose by which favorable conditions match this product, and weigh each direction\'s failure mode and accessibility risk.',
  };
}
