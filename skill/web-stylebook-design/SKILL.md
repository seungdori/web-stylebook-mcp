---
name: web-stylebook-design
description: Improve existing frontend UIs using researched design judgment, actual edits, verification, and before/after reporting. Also supports explicitly requested reviews and new visual directions.
---

# Improve the UI, compare the result, then report

Use the **Web Stylebook MCP** before changing an existing UI. The default for an improvement or
fix request is **inspect → decide → implement → verify → compare/report**. The host agent edits
and runs the product with its available tools. The MCP supplies knowledge and validates submitted
evidence; it cannot access the repository, edit files, inspect pixels, or run interactions itself.

## Follow the human's intent

- “Improve”, “fix”, “make this less awkward” and redesign requests authorize in-scope local fixes.
  Continue through implementation and verification. Do not finish with a critique, proposal, mock
  image, or a promise to implement later.
- Infer bounded coverage from the task and inspect available source before asking questions. State
  material assumptions; ask only when missing information prevents useful execution. Do not impose
  an audit-scope questionnaire or another approval round for already authorized fixes.
- Explicit **review only**, **explain only**, **no edits**, or a narrower scope wins. Use
  `get_design_audit_plan` and `validate_design_audit_result` for those reviews. Do not claim that a
  review improved the UI.
- Preserve unrelated work, factual content, working interactions and product identity. Commit,
  push, release, deployment and external messages need their own authorization.
- A screenshot alone does not prove that the host can edit or run the product. Locate available
  source/runtime first. If execution is genuinely unavailable, report the concrete blocker and
  completed work; do not invent implementation or before/after evidence.

## Default existing-UI workflow

1. **Capture before editing.** Identify the primary user task and its observed obstacle. Save an
   immutable screenshot, rendered HTML/CSS (or native semantic structure), source/build identity,
   and content/interaction inventory. Record route, viewport, resolved theme, locale, state,
   input data and clock, semantic scroll anchor, zoom, device scale and font readiness. Include
   relevant narrow/error states based on the affected task, not an unrelated exhaustive audit.
   If editing has already begun, recover the baseline in isolation from version control. Never
   repaint the after image to pretend it was the before state.
   Record working qualities in `context.constraints`: visible title distinctions, useful group
   boundaries, conversation continuity, reading-surface tone and comfortable text measure.
2. **Get an executable improvement plan.** Call `get_design_improvement_plan` with relevant
   `surface`/`concerns` or `foundationIds`/`category`, `locale`, and `context` containing the user task,
   constraints and target matrix. A call without context is useful for knowledge discovery but
   cannot finish the workflow. Save the returned `query` and `workflow.planHash`.
   The default is 6 foundations, maximum 12; inspect `coverage.omittedIds` or browse
   `webstylebook://foundations` for additional relevant knowledge. The workflow resource is
   `webstylebook://workflows/improve-ui`.
3. **Decide and implement.** Connect each observed obstacle to an applicable conditional remedy,
   its counterexample, preservation constraint and observable success check. Fix task flow,
   information structure and legibility before decorative changes. Edit real source and record
   changed files plus a diff. A new style, direction preview or wholesale redesign is optional,
   not a prerequisite. Cards, centered layouts, gradients, dense rows and system fonts are
   contextual choices, not proof of AI authorship or automatic defects.
   Compare each proposed gain against losses to those working qualities. Keep the original as a
   valid alternative. Change only the relationship whose benefit is supported: do not bundle
   narrower navigation, wider prose, brighter surfaces and removed boundaries into a status fix.
4. **Verify and compare.** Render the edited UI, wait for fonts and capture fresh after artifacts
   under the recorded conditions. Compare actual screenshots and exercise affected behavior,
   keyboard/focus, accessibility, responsive layout and recovery. Run appropriate build/tests.
   For DOM UIs, use `compare_page_revisions` on saved before/after HTML/CSS, the selectors scripts
   actually query, and the product type where known. Restore unintended losses, or acknowledge an
   intended removal with its reason; validate the returned evidence/results under a separate
   `get_design_audit_plan({revisionPreservation: true})` query with `validate_design_audit_result`.
   Other UI runtimes compare the saved semantic/interaction inventory. Static preservation is
   not visual or behavioral verification. Repair or revert regressions and refresh affected evidence.
   Existing content in the DOM is insufficient if more of its distinguishing text is truncated.
   Additional visible labels are insufficient if context already identifies the object or speaker.
   Compare grouping and reading comfort as well as technical contrast and overflow.
5. **Validate completion.** Call `validate_design_improvement_result` with the exact plan query,
   `expectedPlanHash: workflow.planHash`, and actual captures, changes, checks, outcomes and
   limitations. Read [the result contract and example](references/improvement-result.md) when
   assembling the submission. Each target needs visual, behavior, preservation and affected
   accessibility checks. Record observed steps for behavior/accessibility. Follow `nextActions`
   for `needs-work`; do not silently drop targets, mark a proposal implemented, or convert missing
   evidence into a pass. A justified fully verified no-change result is honest; do not manufacture
   edits merely to produce a difference.
6. **Deliver the result.** Use the returned `reportMarkdown` as a starting point and provide
   paired before/after images or direct artifact links, implemented changes and their reasons,
   observed differences, checks performed, tradeoffs and remaining unverified work. A side-by-side
   or toggle report is useful when several screens are involved. Distinguish improved, unchanged,
   regressed and not-verified outcomes. Label fixed data and local verification; never imply
   production deployment or a user-study result that did not happen. `complete` is submitted
   evidence coverage, not independent design-quality certification.
   When the user reports a regression, reopen the previous improvement claim and correct the
   report. Keep justified gains, restore rejected changes and label superseded evidence. Do not
   treat passing checks as a reason to disregard feedback or require approval after every edit.

## Use the knowledge without turning it into a template

Use `get_design_principle_plan` for placement, apply, verify and caution guidance rather than a
fixed recipe. Read `webstylebook://design-principles/{id}` only when selected details are needed.
Record the selected visual-design principles and selected UX principles with the placement
decisions and observed checks they produced. Use `get_ux_principle_plan` for contextual decision prompts, not universal laws.
Accessibility, safety, informed consent, and truthful feedback take priority. `get_ui_state_plan`
helps with affected loading, empty, error and recovery states. Sources support bounded concepts;
remedies are authored contextual guidance and examples are illustrative, not observed results.

Inspect the actual UI, not only a summary. Do not claim numerical usability gains, timing savings,
quality scores or user-research findings without corresponding measurements. A familiar pattern
can be appropriate; evaluate its contribution to this task. Reuse the existing design system where
it works. Keep the live MCP as the source of design knowledge rather than caching its catalog here.

## User-facing copy — meaning before machinery

Apply this section when the confirmed scope includes user-facing copy or the full experience:

The absence of internal jargon is not a pass. Inspect what the actual visible content means here.

- **Use the audience's language.** Translate, define, or demote internal taxonomies, workflow labels,
  implementation terms, unexplained abbreviations, and method names unless understanding them is the
  user's actual task. Expert terminology is fine for an expert audience when it helps them act.
- **Lead with meaning.** Prominent headings and summaries state the conclusion, consequence, or next
  action first. Methodology, provenance, and internal reasoning follow as supporting evidence or
  optional detail; they do not become the headline merely because the system worked hard to produce
  them.
- **Reject pseudo-precision.** Counts, scores, agreement labels, confidence badges, and status
  language need a clear method, denominator, uncertainty, and decision value. Otherwise remove the
  number or rewrite it as a qualified statement; never use it to perform certainty or authority.
- **Make every block earn attention.** Review prominent cards, statistics, navigation links,
  sections, and disclosures against the primary user task. Keep them when useful. Remove, merge, or
  demote them only when the observed context shows they are irrelevant — no content type is banned by
  default.
- **Match claims to support.** For every material claim, conclusion, or recommendation, identify what
  in the available content, evidence, or context supports it. Calibrate wording and certainty to that
  support, and make decision-relevant sources or limits visible. Qualify or remove anything that
  cannot be supported; never invent evidence, facts, or next steps to make copy sound useful.
- **Reject abstract consultancy filler.** A string can fail even when it contains no internal jargon.
  Ask what concrete information it adds here and whether the unchanged sentence would remain equally
  plausible on an unrelated product or page. Rewrite it around the information this audience needs
  to understand, decide, or act. If it cannot become specific without inventing facts, remove it.
- **Match emphasis to substance.** Match typographic and structural emphasis to information value,
  task relevance, and support. Do not turn vague, generic, redundant, or weakly supported content into
  an oversized headline, isolated card, badge, or statistic. Replace it with content that earns the
  attention, or demote it and reduce its scale.
- **Rewrite without inventing.** Preserve factual meaning, material caveats, and domain nuance. For
  findings/proposal scope, show the smallest useful before → after rewrite and why. For implementation
  scope, edit the real strings, re-check wrapping and hierarchy at target locales/viewports, and
  collect fresh evidence.

## New builds and explicitly requested new directions

Only for that mode, read [the new-direction workflow](references/new-direction.md): choose a
product-fit direction, resolve material open decisions, build, and verify it. Honor an already
chosen direction and existing authorization. Do not import that mode's composition or candidate
approval steps into routine improvements of an existing UI.
