# UI improvement result

**Implemented, compared and verified in the submitted evidence**

The host supplied these artifacts and observations. This offline MCP checks coverage and consistency; it does not open files, inspect pixels, run interactions or independently certify design quality. Missing or unsupported evidence is not a pass.

User task: An on-call engineer opens the production dashboard to learn whether anything is broken right now, what changed just before it, and what to do next.

## Before / after

| Target | Before | After | Outcome |
|---|---|---|---|
| dashboard-desktop · /dashboard · 1280×800, light, en-US, one degraded service (payments-api) and one open incident (INC-231) | [Before](<./evidence/before.png>) | [After](<./evidence/after.png>) | Improved: The first screen now answers the on-call question (payments-api is degraded, INC-231 is open, deploy \#4812 went out at 14:02) with links to act, using only facts already on the original page. |

## Changes

- **status-first** (implemented; dashboard-desktop)
  - Observed obstacle: The degraded payments-api row and open incident INC-231 render at y=1375 and y=1550, below a 1280x800 first screen filled by a greeting, a slogan and an AI insights call to action.
  - Change: Replaced the hero with a page heading and an alert that states the degraded service, its error rate and p95, its last deploy and the open incident, with links to the incident and the service.
  - Why: The on-call task is to see what is broken and act; urgency was visually subordinate to decoration. (priority-hierarchy, truthful-evidence)
  - Files: [./after.html](<./after.html>); [Diff](<./evidence/before-to-after.diff>)
- **unsupported-score** (implemented; dashboard-desktop)
  - Observed obstacle: "AI Health Score 94/100 — Looking great!" has no stated method, and the cheerful hints contradict a degraded service.
  - Change: Removed the score and the hints; kept services, incidents, deploys and uptime as a plain summary row, adding only counts already on the page (1 degraded, 1 open).
  - Why: A number should not appear more certain than its support, and no method is available to qualify it. (truthful-evidence)
  - Files: [./after.html](<./after.html>); [Diff](<./evidence/before-to-after.diff>)
- **scannable-services** (implemented; dashboard-desktop)
  - Observed obstacle: Healthy and Degraded used near-identical pill treatments; numbers were left-aligned light gray (\#9ca3af, 2.5:1) and the degraded row sat last.
  - Change: Sorted the degraded row first, gave status a text label plus a distinct shape and color, right-aligned tabular numbers and raised text contrast.
  - Why: The distinguishing attribute (state) must sit in a stable position and not rely on color alone. (scannable-content, rhythm-consistency)
  - Files: [./after.html](<./after.html>); [Diff](<./evidence/before-to-after.diff>)
- **drop-feature-cards** (implemented; dashboard-desktop)
  - Observed obstacle: Three marketing feature cards (Real-time analytics, Smart alerts, Enterprise security) and floating shadowed cards separated the user from the services table.
  - Change: Removed the feature cards; replaced repeated floating cards with two bordered panels (services, recent activity) side by side.
  - Why: The cards repeated product claims on a signed-in dashboard; one boundary per group is enough to show membership. (surface-hierarchy, visual-balance)
  - Files: [./after.html](<./after.html>); [Diff](<./evidence/before-to-after.diff>)

## Verification

| Target | Check | Result | Evidence |
|---|---|---|---|
| dashboard-desktop | visual | pass · Same fixture and conditions. After: degraded row at y=394, incident at y=160, recent activity at y=303, all on the first screen (before: 1375, 1550, 1465). Page height 1871px → 800px. | [Evidence 1](<./evidence/before.png>), [Evidence 2](<./evidence/after.png>), [Evidence 3](<./evidence/verify-before.json>), [Evidence 4](<./evidence/verify-after.json>) |
| dashboard-desktop | behavior | pass · All 18 link destinations from the original are present and identical; the alert links open INC-231, deploy \#4812 and payments-api. | [Evidence 1](<./evidence/verify-after.json>) |
| dashboard-desktop | preservation | pass · compare\_page\_revisions: 18/18 links, 2/2 test hooks, landmarks and the figure kept; five headings dropped or reworded with reasons (marketing cards, greeting heading). Validated under a separate revisionPreservation audit plan: 9 PASS, 1 not applicable (no script selectors). Its static first-screen estimate flagged recent activity; the measured render shows it at y=303, acknowledged with that reason. | [Evidence 1](<./evidence/compare.json>), [Evidence 2](<./evidence/audit-validate.json>) |
| dashboard-desktop | accessibility | pass · First-screen text runs below WCAG AA contrast: 14 of 23 measured before (plus 7 on gradients) → 0 of 85 after. Status is shown by text and shape, not color alone. Keyboard: 14/14 Tab stops show a visible focus outline, in visual order. | [Evidence 1](<./evidence/verify-after.json>), [Evidence 2](<./evidence/verify-before.json>) |

## Tradeoffs and limitations

- \[dashboard-desktop\] The brand gradient, emoji and greeting hero are gone; the indigo accent and wordmark remain. A team that values that tone may want some of it back.
- \[dashboard-desktop\] The AI insights call to action moved from the hero into the navigation, so it gets less attention.
- \[dashboard-desktop\] Uptime and deploy counts still have no stated period because the original data has none.
- Both pages are fixtures written for this demo with fixed fictional data; no real product, users or production deployment are involved.
- Checked in one browser (Chrome via playwright-core) at one desktop viewport; narrow layouts, dark theme and screen readers were not tested.
- Contrast and focus were checked by script, not by an accessibility audit tool or assistive-technology users. No user study was run.

## Remaining work

None reported
