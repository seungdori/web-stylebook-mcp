import type { ImprovementResult, ImprovementResultInput } from './evaluator.js';
import { improvementSubmissionSchema } from './schema.js';

const labels = {
  en: {
    title: 'UI improvement result', task: 'User task', complete: 'Implemented, compared and verified in the submitted evidence', 'needs-work': 'Incomplete — continue with the remaining work', 'no-change': 'Verified unchanged — no improvement claimed',
    boundary: 'The host supplied these artifacts and observations. This offline MCP checks coverage and consistency; it does not open files, inspect pixels, run interactions or independently certify design quality. Missing or unsupported evidence is not a pass.',
    comparison: 'Before / after', target: 'Target', before: 'Before', after: 'After', outcome: 'Outcome', missing: 'Not captured',
    changes: 'Changes', observation: 'Observed obstacle', action: 'Change', reason: 'Why', files: 'Files', diff: 'Diff',
    verification: 'Verification', check: 'Check', result: 'Result', evidence: 'Evidence', tradeoffs: 'Tradeoffs and limitations', remaining: 'Remaining work', none: 'None reported',
    improved: 'Improved', unchanged: 'Unchanged', regressed: 'Regressed', 'not-verified': 'Not verified',
  },
  ko: {
    title: 'UI 개선 결과', task: '사용자 과업', complete: '제출된 증거에서 구현·전후 비교·검증 충족', 'needs-work': '미완료 — 남은 작업을 계속 진행', 'no-change': '변화 없음 확인 — 개선을 주장하지 않음',
    boundary: '호스트가 제출한 증거와 관찰에 대한 결과입니다. 이 오프라인 MCP는 범위와 일관성을 검사하며 파일·이미지를 열거나 상호작용을 실행하거나 디자인 품질을 독립 인증하지 않습니다. 증거가 없거나 뒷받침되지 않으면 통과가 아닙니다.',
    comparison: '수정 전 / 후', target: '대상', before: '수정 전', after: '수정 후', outcome: '결과', missing: '미확보',
    changes: '변경 내용', observation: '관찰한 문제', action: '수정', reason: '근거', files: '파일', diff: '변경 diff',
    verification: '검증', check: '검사', result: '결과', evidence: '증거', tradeoffs: '상충점과 한계', remaining: '남은 작업', none: '보고된 항목 없음',
    improved: '개선', unchanged: '변화 없음', regressed: '퇴행', 'not-verified': '미검증',
  },
  ja: {
    title: 'UI改善結果', task: '利用者タスク', complete: '提出証拠で実装・前後比較・検証を充足', 'needs-work': '未完了 — 残りの作業を続行', 'no-change': '変更なしを確認 — 改善は主張しない',
    boundary: 'ホストが提出した証拠と観察に基づく結果です。このオフラインMCPは範囲と整合性を確認しますが、ファイルや画像を開いたり、操作を実行したり、品質を独立認証したりしません。証拠不足や裏付けのない主張は合格ではありません。',
    comparison: '変更前 / 後', target: '対象', before: '変更前', after: '変更後', outcome: '結果', missing: '未記録',
    changes: '変更内容', observation: '観察した問題', action: '修正', reason: '根拠', files: 'ファイル', diff: '差分',
    verification: '検証', check: '検査', result: '結果', evidence: '証拠', tradeoffs: 'トレードオフと制約', remaining: '残りの作業', none: '報告なし',
    improved: '改善', unchanged: '変更なし', regressed: '退行', 'not-verified': '未検証',
  },
};

const escape = (value: string) => value.replace(/[\\`*_[\]<>|#]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const link = (label: string, reference: string) => `[${escape(label)}](<${reference.replace(/[<>]/g, (char) => encodeURIComponent(char))}>)`;

export function renderImprovementResult(input: ImprovementResultInput, result: ImprovementResult): string {
  const t = labels[input.plan.locale ?? 'en'];
  const submission = improvementSubmissionSchema.parse(input.submission);
  const captures = new Map(submission.captures.map((capture) => [capture.id, capture]));
  const rows = [`# ${t.title}`, '', `**${t[result.completion.status]}**`, '', t.boundary, '', `${t.task}: ${escape(input.plan.context?.userTask ?? t.missing)}`, '', `## ${t.comparison}`, '', `| ${t.target} | ${t.before} | ${t.after} | ${t.outcome} |`, '|---|---|---|---|'];
  for (const target of input.plan.context?.targets ?? []) {
    const outcome = result.outcomes.find((item) => item.targetId === target.id);
    const beforeCandidate = outcome?.beforeCaptureId ? captures.get(outcome.beforeCaptureId) : undefined;
    const afterCandidate = outcome?.afterCaptureId ? captures.get(outcome.afterCaptureId) : undefined;
    const before = beforeCandidate?.targetId === target.id && beforeCandidate.phase === 'before' ? beforeCandidate : undefined;
    const after = afterCandidate?.targetId === target.id && afterCandidate.phase === 'after' ? afterCandidate : undefined;
    const condition = `${target.conditions.viewport.width}×${target.conditions.viewport.height}, ${target.conditions.theme}, ${target.conditions.locale}, ${target.conditions.state}`;
    rows.push(`| ${escape(target.id)} · ${escape(target.route)} · ${escape(condition)} | ${before ? link(t.before, before.screenshotRef) : t.missing} | ${after ? link(t.after, after.screenshotRef) : t.missing} | ${t[outcome?.outcome ?? 'not-verified']}: ${escape(outcome?.summary ?? t.missing)} |`);
  }
  rows.push('', `## ${t.changes}`, '');
  if (!submission.changes.length) rows.push(t.none);
  for (const change of submission.changes) {
    rows.push(`- **${escape(change.id)}** (${change.status}; ${change.targetIds.map(escape).join(', ')})`, `  - ${t.observation}: ${escape(change.observation)}`, `  - ${t.action}: ${escape(change.action)}`, `  - ${t.reason}: ${escape(change.reason)} (${change.foundationIds.map(escape).join(', ')})`, `  - ${t.files}: ${change.files.map((file) => link(file, file)).join(', ') || t.missing}; ${change.diffRef ? link(t.diff, change.diffRef) : t.missing}`);
  }
  rows.push('', `## ${t.verification}`, '', `| ${t.target} | ${t.check} | ${t.result} | ${t.evidence} |`, '|---|---|---|---|');
  for (const check of result.checks) rows.push(`| ${escape(check.targetId)} | ${check.kind} | ${check.verdict} · ${escape(check.summary)} | ${check.evidenceRefs.map((ref, index) => link(`${t.evidence} ${index + 1}`, ref)).join(', ') || t.missing} |`);
  rows.push('', `## ${t.tradeoffs}`, '');
  const limitations = [...result.outcomes.flatMap((outcome) => outcome.tradeoffs.map((item) => `[${outcome.targetId}] ${item}`)), ...submission.limitations];
  rows.push(...(limitations.length ? limitations.map((item) => `- ${escape(item)}`) : [t.none]));
  rows.push('', `## ${t.remaining}`, '', ...(result.nextActions.length ? result.nextActions.map((action) => `- ${escape(action)}`) : [t.none]));
  return `${rows.join('\n')}\n`;
}
