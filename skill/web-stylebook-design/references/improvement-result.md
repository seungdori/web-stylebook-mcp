# Improvement execution and result contract

Use this when assembling the input to `validate_design_improvement_result`. The full tool schema
is authoritative. [example-result.json](example-result.json) is an **illustrative fixture** for a
mobile form and a desktop data table. Its paths and observations are not real evidence. Replace them
with actual captures, source changes and observed checks; never submit the fixture as completed work.

## Plan and execute

Call `get_design_improvement_plan` with relevant knowledge selectors and `context`:

- `userTask`: the concrete thing the person is trying to accomplish.
- `constraints`: optional product/behavior boundaries.
- `targets`: 1–12 explicit targets, each with a unique `id`, supported `surface`, `route`, and
  `conditions`. Different viewport/state/theme combinations are separate targets.
- `conditions`: `viewport: {width, height}`, resolved `theme`, `locale`, `state`, `dataKey`,
  `scrollAnchor`, `zoom`, `deviceScaleFactor`. The data key identifies fixed inputs and clock;
  the scroll anchor identifies the same semantic location even if its pixel position moves.

The returned `workflow` contains capture, decision, implementation, verification and reporting
instructions. Save its `planHash` and the returned normalized `query`; the latter is the exact
`plan` to submit later. A knowledge-only query without context cannot complete an improvement.
The host uses its own filesystem/editor/browser/build tools to execute the work. The MCP remains
stateless and read-only. No screenshots, files or repositories are fetched by these tools.

## Submit observed results

```js
const planned = await callTool("get_design_improvement_plan", actualPlanInput);
// Execute the host workflow and save real, immutable evidence before continuing.
const result = await callTool("validate_design_improvement_result", {
  plan: planned.query,
  expectedPlanHash: planned.workflow.planHash,
  submission: actualObservedSubmission
});
```

`submission` has five arrays:

| Array | Required substance |
|---|---|
| `captures` | Unique `id`, `targetId`, `phase: before/after`, immutable `screenshotRef`, `sourceRef`, `conditions`, `fontsReady`. Add `structureRef` (rendered HTML/native hierarchy) and `stylesRef` when available. Before and after must be distinct artifacts. For an improvement claim, source identities must distinguish original and edited snapshots; use a diff/content hash for uncommitted changes. |
| `changes` | `id`, affected `targetIds`, known `foundationIds`, observed problem, chosen action, reason, `status: implemented/proposed/reverted`, changed `files`, and a `diffRef` for implementation. A proposed change cannot complete. Record reverted attempts so the outcome remains understandable. |
| `checks` | `id`, `targetId`, `kind`, `verdict`, actual-result `summary`, related `captureIds`, durable `evidenceRefs`; `steps` for observed behavior/accessibility checks. Every target needs `visual`, `behavior`, `preservation`, `accessibility`. Add `build` when applicable. Visual checks reference both captures; other checks reference the after capture. |
| `outcomes` | One per planned target: `targetId`, `outcome: improved/unchanged/regressed/not-verified`, `beforeCaptureId`, `afterCaptureId`, every affecting `changeId`, concrete `summary` and `tradeoffs`. An improvement requires an implemented change affecting that target. |
| `limitations` | Actual limits, including unavailable environments, local/fixed-data evidence, untested browsers, absent user studies and deployment status where relevant. |

References may be absolute file paths, explicit relative paths (`./` or `../`), HTTP(S) URLs or
artifact URLs. They must refer to saved artifacts the host has actually inspected. Native UI
semantic-inventory comparisons can provide preservation evidence when HTML/CSS is inapplicable.
For a DOM UI, save `compare_page_revisions` output and its separate audit-contract validation as
preservation evidence. Do not treat those static checks as visual or interaction results.

Checks use `pass`, `fail`, `not-verified`, `not-applicable`. Only behavior and build can be marked
not applicable, with a concrete summary and evidence (for example a truly static, noninteractive
surface). Visual comparison, preservation and affected accessibility still apply to static UI.
Failures remain blocking even when another check of the same kind passes. Missing artifacts,
unrelated captures or absent observed steps normalize unsupported pass claims to not-verified.

## Continue, then report

- `completion.status: needs-work`: follow `nextActions`; fill missing evidence, implement pending
  fixes, repair/revert regressions and refresh the affected captures/checks. If genuinely blocked,
  report the partial result and the exact missing access or fact. Do not claim completion.
- `complete`: the submitted evidence covers the planned targets and actual implemented improvements.
  The MCP has not opened artifacts or independently judged usability or design quality.
- `no-change`: fully checked unchanged targets with no implemented/proposed changes. This is an
  honest result when no justified improvement remains, never a reason to claim that a review fixed UI.
- `valid` concerns contract consistency; it can be true while the work is incomplete.

Save or adapt `reportMarkdown`, which includes paired before/after links, changes and reasons,
observed verification, target outcomes, tradeoffs, limitations and remaining work. Present actual
images together or in a toggle viewer when useful. Do not silently replace unverified/regressed
outcomes, omit targets, invent quality scores or equate local verification with production deployment.

Record the baseline's working qualities in `plan.context.constraints`, then report both gains and
losses in the outcome summary and tradeoffs. Useful group boundaries, visible title distinctions,
conversation continuity and reading-surface tone can regress while every technical check passes.
If later feedback rejects the result, supersede the prior report and mark the affected outcomes
regressed or not-verified; repair/revert them and collect fresh evidence. A previous complete result
is not permanent proof of quality, and retaining the original can be the correct decision.
