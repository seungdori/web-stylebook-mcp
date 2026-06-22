// Localized rendering of reason codes, matched facets, and cautions (05 §11).
// Numbers are never shown alone — every score is paired with human text.

import type { CatalogStyle, Lang } from '../types.js';
import type { ReasonCode, ResolvedContext } from './types.js';

type Tri = { en: string; ko: string; ja: string };
const pick = (t: Tri, locale: string): string => (locale === 'ko' ? t.ko : locale === 'ja' ? t.ja : t.en);

const REASON: Record<ReasonCode, Tri> = {
  EXPLICITLY_AVOIDED: {
    en: 'Matched a direction the user asked to avoid.',
    ko: '사용자가 피하라고 한 방향과 일치합니다.',
    ja: 'ユーザーが避けたいとした方向と一致します。',
  },
  PRODUCT_NOT_IDEAL: {
    en: 'This style is explicitly not ideal for this product type.',
    ko: '이 스타일은 해당 제품 유형에 적합하지 않다고 명시되어 있습니다.',
    ja: 'このスタイルはこの製品タイプには不向きと明記されています。',
  },
  HIGH_TRUST_MISMATCH: {
    en: 'The product needs high trust the style cannot carry.',
    ko: '제품이 요구하는 높은 신뢰감을 이 스타일이 받쳐주지 못합니다.',
    ja: '製品が求める高い信頼感をこのスタイルでは支えきれません。',
  },
  DAILY_USE_OVERSTIMULATION: {
    en: 'Continuous spectacle conflicts with repeated daily use.',
    ko: '쉼 없는 시각 효과가 매일 반복 사용과 충돌합니다.',
    ja: '絶え間ない演出が毎日の反復利用と衝突します。',
  },
  ACCESSIBILITY_CONFLICT: {
    en: 'Conflicts with a required accessibility constraint.',
    ko: '필수 접근성 제약과 충돌합니다.',
    ja: '必須のアクセシビリティ制約と衝突します。',
  },
  DENSITY_MISMATCH: {
    en: 'Density is far from what this product needs.',
    ko: '밀도가 이 제품에 필요한 수준과 크게 다릅니다.',
    ja: '密度が製品の必要水準と大きく異なります。',
  },
  MOTION_INTENSITY_CONFLICT: {
    en: 'High motion intensity for a frequently used surface.',
    ko: '자주 쓰는 화면에 모션 강도가 높습니다.',
    ja: '頻繁に使う画面にはモーションが強すぎます。',
  },
  TONE_CONFLICT: {
    en: 'Tone partly conflicts with the requested feel.',
    ko: '요청한 정서와 톤이 일부 충돌합니다.',
    ja: '希望する雰囲気とトーンが一部衝突します。',
  },
  MAINTENANCE_RISK: {
    en: 'Higher maintenance cost for a daily-use product.',
    ko: '매일 쓰는 제품에는 유지비용이 높습니다.',
    ja: '毎日使う製品には維持コストが高めです。',
  },
};

export function reasonText(codes: ReasonCode[], _styleId: string, locale: string): string {
  return codes.map((c) => pick(REASON[c], locale)).join(' ');
}

export function cautionText(codes: ReasonCode[], style: CatalogStyle, locale: string): string[] {
  const out = codes.map((c) => pick(REASON[c], locale));
  // surface the style's own top risk as a caution too
  const risk = style.recommendationFacets.risks[0];
  if (risk) {
    const r: Tri = {
      en: `Watch: ${risk}.`, ko: `주의: ${risk}.`, ja: `注意: ${risk}。`,
    };
    out.push(pick(r, locale));
  }
  return out;
}

export function matchedText(style: CatalogStyle, ctx: ResolvedContext, locale: string): string[] {
  const f = style.recommendationFacets;
  const out: Tri[] = [];
  if (f.productTypes.includes(ctx.productType.value)) {
    out.push({ en: `Fits ${ctx.productType.value}`, ko: `${ctx.productType.value}에 적합`, ja: `${ctx.productType.value}に適合` });
  }
  const toneHits = ctx.tones.value.filter((t) => f.tones.includes(t));
  if (toneHits.length) {
    out.push({ en: `Tone: ${toneHits.join(', ')}`, ko: `톤: ${toneHits.join(', ')}`, ja: `トーン: ${toneHits.join(', ')}` });
  }
  if (f.density.includes(ctx.density.value)) {
    out.push({ en: `${ctx.density.value} density`, ko: `${ctx.density.value} 밀도`, ja: `${ctx.density.value}密度` });
  }
  if (f.usageFrequency.includes(ctx.usageFrequency.value)) {
    out.push({ en: `${ctx.usageFrequency.value} use`, ko: `${ctx.usageFrequency.value} 사용`, ja: `${ctx.usageFrequency.value}利用` });
  }
  if (!out.length && f.strengths[0]) {
    out.push({ en: f.strengths[0], ko: f.strengths[0], ja: f.strengths[0] });
  }
  void (null as unknown as Lang);
  return out.map((t) => pick(t, locale));
}
