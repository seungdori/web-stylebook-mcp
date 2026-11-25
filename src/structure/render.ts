import type { Lang } from '../types.js';
import type { StructureAuditResult } from './audit.js';

const structureLabels: Record<Lang, {
  title: string; clean: string; findings: string; replace: string; moves: string; checks: string; limits: string;
  mustHaves: string; missing: string; misplaced: string; none: string; hero: string; sectionOrder: string; assets: string;
}> = {
  en: { title: 'Page structure audit', clean: 'No banned pattern was found.', findings: 'Findings', replace: 'Replace with', moves: 'Moves', checks: 'Checks', limits: 'Limits', mustHaves: 'Must-haves', missing: 'Missing', misplaced: 'Not on the first screen', none: 'none', hero: 'Hero', sectionOrder: 'Section order', assets: 'Assets' },
  ko: { title: '페이지 구조 감사', clean: '금지 패턴을 찾지 못했습니다.', findings: '발견 항목', replace: '대체 방법', moves: '무브', checks: '검사', limits: '한계', mustHaves: '필수 요소', missing: '없음', misplaced: '첫 화면 밖', none: '없음', hero: '히어로', sectionOrder: '섹션 순서', assets: '에셋' },
  ja: { title: 'ページ構造の監査', clean: '禁止パターンは見つかりませんでした。', findings: '検出項目', replace: '置き換え', moves: 'ムーブ', checks: '検査', limits: '限界', mustHaves: '必須要素', missing: 'なし', misplaced: 'ファーストビューの外', none: 'なし', hero: 'ヒーロー', sectionOrder: 'セクションの順序', assets: 'アセット' },
};

/** The text fallback: findings with the moves they name, then each move's build steps and the archetype text once. */
export function renderStructureAudit(r: StructureAuditResult, locale: Lang): string {
  const labels = structureLabels[locale];
  const lines = [
    `# ${labels.title}${r.styleId ? ` — ${r.styleId}` : ''}`,
    `${labels.checks}: ${r.summary.checked} · ${labels.findings}: ${r.summary.findings} (major ${r.summary.major}, minor ${r.summary.minor}) · inputHash ${r.identity.inputHash}`,
  ];
  if (r.mustHaves && r.mustHaves.items.length) {
    const names = (ids: readonly string[]) => (ids.length
      ? ids.map((id) => r.mustHaves!.items.find((item) => item.id === id)!.name).join(', ') : labels.none);
    lines.push('', `${labels.mustHaves} (${r.mustHaves.productType}, ${r.mustHaves.page}): ${labels.missing}: ${names(r.mustHaves.missing)} · ${labels.misplaced}: ${names(r.mustHaves.misplaced)}`);
  }
  if (!r.findings.length) lines.push('', labels.clean);
  for (const finding of r.findings) {
    const archetype = finding.replaceWith.archetype ? labels[finding.replaceWith.archetype] : '';
    lines.push('', `- [${finding.severity}] ${finding.patternId} — ${finding.name} @ ${finding.locations[0] ?? ''}${finding.count > 1 ? ` (+${finding.count - 1})` : ''}`,
      `  ${labels.replace}: ${finding.replaceWith.instruction}`);
    const refs = [...finding.replaceWith.moves.map((move) => move.name), ...(archetype ? [archetype] : [])];
    if (refs.length) lines.push(`  ${labels.moves}: ${refs.join(' | ')}`);
  }
  // The build steps, hero and section order are in structuredContent.replacements and the style resource.
  if (r.styleId && (Object.keys(r.replacements.moves).length || r.replacements.hero || r.replacements.sectionOrder)) {
    lines.push('', `${labels.moves}: structuredContent.replacements · webstylebook://styles/${r.styleId}`);
  }
  const assets = r.assets.checks.filter((check) => check.verdict !== 'PASS' && check.verdict !== 'NOT_APPLICABLE');
  if (assets.length) lines.push('', `${labels.assets}: ${assets.map((check) => `[${check.verdict}] ${check.checkId}${check.count ? ` (${check.count}): ${check.items.slice(0, 2).join(', ')}${check.count > 2 ? ', …' : ''}` : ''}`).join(' · ')}`);
  // The limits are in structuredContent.limits; the text keeps what to do next.
  lines.push('', ...r.guidance);
  return lines.join('\n');
}
