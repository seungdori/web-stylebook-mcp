import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planDesignImprovement } from '../src/foundations/planner.js';
import { improvementSubmissionSchema } from '../src/improvement/schema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function codeBlockAfter(text: string, marker: string): string {
  const start = text.indexOf(marker);
  expect(start, `should contain ${marker}`).toBeGreaterThan(-1);
  return text.slice(text.indexOf('{', start), text.indexOf('\n```', start));
}

describe.each(['README.md', 'README.ko.md'])('%s improvement workflow example', (file) => {
  const text = readFileSync(join(root, file), 'utf8');

  it('plan input is accepted by get_design_improvement_plan', () => {
    const input = JSON.parse(codeBlockAfter(text, '// → get_design_improvement_plan'));
    const plan = planDesignImprovement(input);
    expect(plan.foundations.length).toBeGreaterThan(0);
  });

  it('validator call names the real top-level and submission fields', () => {
    const block = codeBlockAfter(text, '// → validate_design_improvement_result');
    const topLevel = [...block.matchAll(/^ {2}"(\w+)":/gm)].map((match) => match[1]);
    expect(topLevel).toEqual(['plan', 'expectedPlanHash', 'submission']);
    const submissionLine = block.split('\n').find((line) => line.includes('"submission"'))!;
    const shown = [...submissionLine.matchAll(/"(\w+)": \[/g)].map((match) => match[1]);
    expect(shown.sort()).toEqual(Object.keys(improvementSubmissionSchema.shape).sort());
  });
});
