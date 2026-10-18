import type {
  RankReasonCode, RankingExplanation, ResolvedContext, ScoredStyle, TermKey,
} from './types.js';

type Say = (en: string, ko: string, ja: string) => string;

const CODE_FOR: Record<TermKey, Exclude<RankReasonCode, 'TIED'>> = {
  product: 'PRODUCT_FOCUS',
  useCase: 'USE_CASE_FIT',
  task: 'TASK_FIT',
  tone: 'TONE_FIT',
  density: 'DENSITY_FIT',
  usage: 'USAGE_FIT',
  trust: 'TRUST_FIT',
  constraint: 'CONSTRAINT_FIT',
  cautions: 'FEWER_CAUTIONS',
  upkeep: 'LOWER_UPKEEP',
  avoidance: 'FARTHER_FROM_AVOIDED',
};
const TERMS = Object.keys(CODE_FOR) as TermKey[];

// Naming stops at MAX_REASONS, or once the named factors explain COVERAGE of the winner's lead.
// A factor under MIN_DELTA points is too small to be worth a sentence.
const MIN_DELTA = 0.002;
const COVERAGE = 0.7;
const MAX_REASONS = 3;

function round2(x: number): number { return Math.round(x * 100) / 100; }

function productClause(a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, say: Say): string {
  const [A, B, pt] = [a.style.id, b.style.id, ctx.productType.value];
  const fa = a.style.recommendationFacets.productTypes;
  const fb = b.style.recommendationFacets.productTypes;
  if (a.primaryPick && !b.primaryPick) {
    return say(
      `${A} is a catalog primary pick for ${pt}, ${B} is not`,
      `${pt}의 카탈로그 대표 스타일 여부: ${A} 해당, ${B} 비해당`,
      `${pt}のカタログ代表スタイルか: ${A}は該当、${B}は非該当`,
    );
  }
  if (fa.includes(pt) && fb.includes(pt)) {
    return say(
      `${A} lists ${pt} among ${fa.length} product types, ${B} among ${fb.length}`,
      `제품 유형 목록(${pt} 포함): ${A} ${fa.length}개, ${B} ${fb.length}개`,
      `製品タイプ一覧(${pt}を含む): ${A}は${fa.length}件、${B}は${fb.length}件`,
    );
  }
  if (fa.includes(pt)) {
    return say(
      `${A} lists ${pt} as a product type and ${B} does not`,
      `제품 유형에 ${pt} 포함 여부: ${A} 포함, ${B} 미포함`,
      `製品タイプに${pt}を含むか: ${A}は含む、${B}は含まない`,
    );
  }
  return say(
    `${A} lists a product type next to ${pt} and ${B} does not`,
    `${pt}에 인접한 제품 유형 보유 여부: ${A} 보유, ${B} 미보유`,
    `${pt}に隣接する製品タイプの有無: ${A}は有、${B}は無`,
  );
}

function useCaseClause(a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, say: Say): string {
  const [A, B, pt] = [a.style.id, b.style.id, ctx.productType.value];
  const [ea, eb] = [a.evidence, b.evidence];
  const lexicalGain = ea.lexical - eb.lexical;
  const shareGain = pt === 'other' ? 0 : ea.share - eb.share;
  if (ea.phrase && lexicalGain > 0 && lexicalGain >= shareGain) {
    if (ea.lexical < 1) {
      return say(
        `bestFor "${ea.phrase}" shares a word with the brief, ${B} has no match`,
        `요청과 단어가 겹치는 bestFor: "${ea.phrase}" (${B}: 일치 없음)`,
        `依頼と単語が重なるbestFor: 「${ea.phrase}」(${B}: 一致なし)`,
      );
    }
    return say(
      `bestFor "${ea.phrase}" matches the brief${eb.phrase ? ` more closely than ${B}'s "${eb.phrase}"` : `, ${B} has no match`}`,
      `요청과 일치하는 bestFor: "${ea.phrase}" (${B}: ${eb.phrase ? `"${eb.phrase}"` : '일치 없음'})`,
      `依頼と一致するbestFor: 「${ea.phrase}」(${B}: ${eb.phrase ? `「${eb.phrase}」` : '一致なし'})`,
    );
  }
  return say(
    `${ea.targeted} of ${ea.total} bestFor entries aim at ${pt} (${B}: ${eb.targeted} of ${eb.total})`,
    `bestFor ${ea.total}개 중 ${ea.targeted}개가 ${pt} 대상 (${B}: ${eb.total}개 중 ${eb.targeted}개)`,
    `bestFor ${ea.total}件中${ea.targeted}件が${pt}向け(${B}: ${eb.total}件中${eb.targeted}件)`,
  );
}

function taskClause(a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, say: Say): string {
  const [A, B] = [a.style.id, b.style.id];
  const tasks = ctx.primaryTaskTags.value;
  const strengths = (s: ScoredStyle) => s.style.recommendationFacets.strengths.map((x) => x.toLowerCase());
  const covered = (s: ScoredStyle) => tasks.filter((t) => strengths(s).includes(t));
  const [ca, cb] = [covered(a), covered(b)];
  const stated = ctx.primaryTaskTags.source === 'explicit';
  if (ca.length > cb.length) {
    return say(
      `${ca.join('/')} is a listed strength of ${A}; ${B} ${cb.length ? `lists only ${cb.join('/')}` : `lists none of the ${stated ? 'requested' : 'inferred'} tasks`}`,
      `${stated ? '요청한' : '추론한'} 작업이 강점에 포함: ${A} ${ca.join('/')}, ${B} ${cb.length ? cb.join('/') : '없음'}`,
      `強みに含まれる${stated ? '要求' : '推定'}タスク: ${A}は${ca.join('/')}、${B}は${cb.length ? cb.join('/') : 'なし'}`,
    );
  }
  const [ka, kb] = [a.taskStrengths, b.taskStrengths];
  return say(
    `${ca.join('/')} is one of ${ka} task strengths for ${A} against ${kb} for ${B}`,
    `작업 강점 수: ${A} ${ka}개, ${B} ${kb}개 (${ca.join('/')}에 더 집중)`,
    `タスク強みの数: ${A}は${ka}件、${B}は${kb}件(${ca.join('/')}により集中)`,
  );
}

function toneClause(a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, say: Say): string {
  const [A, B] = [a.style.id, b.style.id];
  const slot = (s: ScoredStyle, tone: (typeof ctx.tones.value)[number]) => {
    const f = s.style.recommendationFacets;
    const i = f.tones.indexOf(tone);
    return i >= 0 ? i : f.antiTones.includes(tone) ? 4 : 3;
  };
  let best = ctx.tones.value[0];
  let bestGain = -Infinity;
  for (const tone of new Set(ctx.tones.value)) {
    const gain = slot(b, tone) - slot(a, tone);
    if (gain > bestGain) { best = tone; bestGain = gain; }
  }
  if (!best) return '';
  const pa = a.style.recommendationFacets.tones.indexOf(best);
  const pb = b.style.recommendationFacets.tones.indexOf(best);
  if (pb >= 0) {
    return say(
      `${best} is #${pa + 1} in ${A}'s tones but #${pb + 1} in ${B}'s`,
      `톤 ${best}의 순위: ${A} ${pa + 1}번째, ${B} ${pb + 1}번째`,
      `トーン${best}の順位: ${A}は${pa + 1}番目、${B}は${pb + 1}番目`,
    );
  }
  if (b.style.recommendationFacets.antiTones.includes(best)) {
    return say(
      `${B} lists ${best} as an anti-tone`,
      `반대 톤 충돌: ${B} (${best})`,
      `反対トーンの衝突: ${B}(${best})`,
    );
  }
  return say(
    `${best} is #${pa + 1} in ${A}'s tones and missing from ${B}'s`,
    `톤 ${best}: ${A} ${pa + 1}번째, ${B} 목록에 없음`,
    `トーン${best}: ${A}は${pa + 1}番目、${B}は未掲載`,
  );
}

function rangeClause(kind: 'density' | 'usage' | 'trust', a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, say: Say): string {
  const [A, B] = [a.style.id, b.style.id];
  const [fa, fb] = [a.style.recommendationFacets, b.style.recommendationFacets];
  const [ra, rb, facet, label] = kind === 'density'
    ? [fa.density, fb.density, ctx.density, say('density', '밀도', '密度')]
    : kind === 'usage'
      ? [fa.usageFrequency, fb.usageFrequency, ctx.usageFrequency, say('usage', '사용 빈도', '利用頻度')]
      : [fa.trust, fb.trust, ctx.trustSensitivity, say('trust', '신뢰 요구', '信頼要件')];
  const stated = facet.source === 'explicit';
  return say(
    `${stated ? 'requested' : 'assumed'} ${label} ${facet.value}: ${A} spans ${ra.join('/')}, ${B} spans ${rb.join('/')}`,
    `${stated ? '요청한' : '가정한'} ${label} ${facet.value}: ${A} ${ra.join('/')}, ${B} ${rb.join('/')}`,
    `${stated ? '要求された' : '想定された'}${label} ${facet.value}: ${A}は${ra.join('/')}、${B}は${rb.join('/')}`,
  );
}

function constraintClause(b: ScoredStyle, say: Say): string {
  const B = b.style.id;
  const list = b.violated.join(', ');
  return say(
    `${B} conflicts with ${list}`,
    `충돌하는 제약: ${B} (${list})`,
    `衝突する制約: ${B}(${list})`,
  );
}

function cautionsClause(a: ScoredStyle, b: ScoredStyle, say: Say): string {
  const B = b.style.id;
  const parts: string[] = b.softCodes.filter((c) => !a.softCodes.includes(c));
  if (b.evidence.notIdealPhrase && b.evidence.notIdeal > a.evidence.notIdeal) parts.push(`notIdealFor "${b.evidence.notIdealPhrase}"`);
  if (!parts.length) return '';
  return say(
    `${B} carries ${parts.join(' and ')}`,
    `${B}에 붙는 주의: ${parts.join(', ')}`,
    `${B}に付く注意: ${parts.join('、')}`,
  );
}

function upkeepClause(a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, say: Say): string {
  const [A, B, usage] = [a.style.id, b.style.id, ctx.usageFrequency.value];
  const [fa, fb] = [a.style.recommendationFacets, b.style.recommendationFacets];
  return say(
    `lighter upkeep for ${usage} use (${A}: motion ${fa.motionIntensity}, maintenance ${fa.maintenanceComplexity}; ${B}: motion ${fb.motionIntensity}, maintenance ${fb.maintenanceComplexity})`,
    `${usage} 사용 기준 유지 부담이 낮음 (${A}: 모션 ${fa.motionIntensity}, 유지보수 ${fa.maintenanceComplexity}; ${B}: 모션 ${fb.motionIntensity}, 유지보수 ${fb.maintenanceComplexity})`,
    `${usage}利用で維持負担が小さい(${A}: モーション${fa.motionIntensity}、保守${fa.maintenanceComplexity}; ${B}: モーション${fb.motionIntensity}、保守${fb.maintenanceComplexity})`,
  );
}

function avoidanceClause(b: ScoredStyle, say: Say): string {
  const near = b.nearestAvoided;
  if (!near) return '';
  const B = b.style.id;
  const shared = near.shared.slice(0, 2).join(', ');
  return say(
    `farther from the avoided ${near.styleId}${shared ? ` (${B} shares ${shared})` : ''}`,
    `회피 대상(${near.styleId})에서 더 멂${shared ? ` (${B} 공통 특성: ${shared})` : ''}`,
    `回避対象(${near.styleId})から遠い${shared ? `(${B}の共通特性: ${shared})` : ''}`,
  );
}

function clauseFor(term: TermKey, a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, say: Say): string {
  switch (term) {
    case 'product': return productClause(a, b, ctx, say);
    case 'useCase': return useCaseClause(a, b, ctx, say);
    case 'task': return taskClause(a, b, ctx, say);
    case 'tone': return toneClause(a, b, ctx, say);
    case 'density': return rangeClause('density', a, b, ctx, say);
    case 'usage': return rangeClause('usage', a, b, ctx, say);
    case 'trust': return rangeClause('trust', a, b, ctx, say);
    case 'constraint': return constraintClause(b, say);
    case 'cautions': return cautionsClause(a, b, say);
    case 'upkeep': return upkeepClause(a, b, ctx, say);
    case 'avoidance': return avoidanceClause(b, say);
  }
}

export function explainRanking(a: ScoredStyle, b: ScoredStyle, ctx: ResolvedContext, locale: string): RankingExplanation {
  const say: Say = (en, ko, ja) => (locale === 'ko' ? ko : locale === 'ja' ? ja : en);
  const [A, B] = [a.style.id, b.style.id];
  const [shownA, shownB] = [round2(a.total), round2(b.total)];

  const leadOf = (x: ScoredStyle, y: ScoredStyle) => TERMS
    .map((term) => ({ term, delta: x.terms[term] - y.terms[term] }))
    .filter((t) => t.delta >= MIN_DELTA)
    .sort((m, n) => n.delta - m.delta);

  if (shownA === shownB) {
    const leading = (x: ScoredStyle, y: ScoredStyle) => {
      const top = leadOf(x, y)[0];
      const clause = top ? clauseFor(top.term, x, y, ctx, say) : '';
      return clause ? [{ id: x.style.id, clause }] : [];
    };
    const offsets = [...leading(a, b), ...leading(b, a)]
      .map(({ id, clause }) => say(`${id} leads: ${clause}`, `${id} 우세: ${clause}`, `${id}が優勢: ${clause}`));
    const shown = shownA.toFixed(2);
    return {
      winner: A, runnerUp: B, gap: 0, tied: true, reasonCodes: ['TIED'],
      explanation: offsets.length
        ? say(
          `${A} and ${B} tie at ${shown}: ${offsets.join('; ')}. The net difference is below the displayed precision, so their order is not a preference; they are listed by unrounded score, then style id.`,
          `${A}, ${B} — ${shown}점 동점: ${offsets.join('; ')}. 순 차이가 표시 정밀도 아래라서 순서는 선호를 뜻하지 않으며, 반올림 전 점수 순, 같으면 스타일 id 순으로 나열합니다.`,
          `${A}、${B} — ${shown}点で同点: ${offsets.join('; ')}。差し引きの差が表示精度未満のため、順序は優劣を意味せず、丸め前のスコア順、同じならスタイルid順で並べています。`,
        )
        : say(
          `${A} and ${B} tie at ${shown}: they score alike on every factor, so their order is not a preference; they are listed by unrounded score, then style id.`,
          `${A}, ${B} — ${shown}점 동점: 모든 점수 요소가 같아서 순서는 선호를 뜻하지 않으며, 반올림 전 점수 순, 같으면 스타일 id 순으로 나열합니다.`,
          `${A}、${B} — ${shown}点で同点: 全ての採点要素が同じため、順序は優劣を意味せず、丸め前のスコア順、同じならスタイルid順で並べています。`,
        ),
    };
  }

  const gap = Math.round((shownA - shownB) * 100) / 100;
  const leads = leadOf(a, b);
  const lead = leads.reduce((sum, x) => sum + x.delta, 0);
  const named: { code: RankingExplanation['reasonCodes'][number]; clause: string }[] = [];
  let explained = 0;
  for (const { term, delta } of leads) {
    if (named.length >= MAX_REASONS || explained >= COVERAGE * lead) break;
    const clause = clauseFor(term, a, b, ctx, say);
    if (!clause) continue;
    named.push({ code: CODE_FOR[term], clause });
    explained += delta;
  }

  const reasons = named.map((r) => r.clause).join('; ');
  return {
    winner: A, runnerUp: B, gap, tied: false, reasonCodes: named.map((r) => r.code),
    explanation: named.length
      ? say(
        `${A} outranks ${B} by ${gap.toFixed(2)}: ${reasons}.`,
        `${A} — ${B}보다 ${gap.toFixed(2)}점 높음: ${reasons}.`,
        `${A}が${B}を${gap.toFixed(2)}上回る: ${reasons}。`,
      )
      : say(
        `${A} edges out ${B} by ${gap.toFixed(2)}: the scored factors are nearly identical.`,
        `${A} — ${B}보다 ${gap.toFixed(2)}점 높음: 점수 요소가 거의 같습니다.`,
        `${A}が${B}を${gap.toFixed(2)}上回る: 採点要素はほぼ同じです。`,
      ),
  };
}
