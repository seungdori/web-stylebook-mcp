# Results

Ten pairs, one build per arm per brief, from one agent and one model. The arms are `control` (built without the MCP) and `mcp` (built with it). This is a showcase to look at, not a measurement. **Look at [the blind comparison](./compare/index.html) first.** This note names the arms.

It draws on [`runs.json`](./runs.json), [`key.json`](./key.json), my own blind notes ([`blind-notes.md`](./blind-notes.md)), and two independent readers ([`blind-reads/`](./blind-reads/)). It computes no score.

## Builds

| Brief | Arm | Status | Wall time | Turns | Cost (est.) |
| --- | --- | --- | --- | --- | --- |
| SRE incident dashboard | control | built | 74m 32s | 179 | $12.01 |
| SRE incident dashboard | mcp | built, stopped at the 90 min cap | 90m 00s | - | $16.33 |
| Indie long-form essay blog | control | built | 43m 50s | 222 | $8.12 |
| Indie long-form essay blog | mcp | built | 76m 22s | 286 | $16.21 |
| Luxury skincare product page | control | built, stopped at the 90 min cap | 90m 00s | - | $14.62 |
| Luxury skincare product page | mcp | built, stopped at the 90 min cap | 90m 00s | - | $30.56 |
| Kids coding-education landing page | control | built, stopped at the 90 min cap | 90m 00s | - | $23.64 |
| Kids coding-education landing page | mcp | built, stopped at the 90 min cap | 90m 00s | - | $16.41 |
| Developer API docs homepage | control | built, stopped at the 90 min cap | 90m 00s | - | $18.90 |
| Developer API docs homepage | mcp | built, stopped at the 90 min cap | 90m 00s | - | $20.71 |
| Personal budgeting app overview screen | control | built | 85m 49s | 171 | $18.62 |
| Personal budgeting app overview screen | mcp | built, stopped at the 90 min cap | 90m 00s | - | $14.80 |
| Architecture studio portfolio | control | built, stopped at the 90 min cap | 90m 00s | - | $28.05 |
| Architecture studio portfolio | mcp | built, stopped at the 90 min cap | 90m 00s | - | $19.08 |
| Neighborhood bakery ordering site | control | built | 72m 12s | 208 | $11.96 |
| Neighborhood bakery ordering site | mcp | built, stopped at the 90 min cap | 90m 01s | - | $16.88 |
| B2B HR SaaS landing page | control | built | 40m 36s | 201 | $5.75 |
| B2B HR SaaS landing page | mcp | built, stopped at the 90 min cap | 90m 00s | - | $18.82 |
| Music festival event page | control | built, stopped at the 90 min cap | 90m 00s | - | $23.48 |
| Music festival event page | mcp | built, stopped at the 90 min cap | 90m 00s | - | $16.90 |
| **Total** | control | 10/10 | 767m 00s |  | $165.15 |
| **Total** | mcp | 10/10 | 886m 25s |  | $186.70 |

- **All 20 builds passed `npm run build`.** Every isolation audit passed, and no capture has a page error, a console error, a failed request, or horizontal overflow.
- Elapsed time was 7 h 48 min, from 12:13 to 20:01 UTC on 18 Oct 2026, with up to four builds at once and the pacing pauses described in the [README](./README.md). Session times add up to 27 h 33 min: control 12 h 47 min, MCP 14 h 46 min.
- Cost is Claude Code's list-price estimate, not a bill: $165.15 for control, $186.70 for MCP. Stopped sessions write no result event, so their turns are blank and their cost comes from Claude Code's session record.

## Failures and oddities

No build failed to build. These are the rough edges:

- **The 90-minute cap stopped 14 of 20 sessions: 9 of the 10 MCP builds and 5 of the 10 control builds.** I set the cap, and it hit the MCP arm harder, so MCP sessions had less time to wrap up. Every stopped folder still built and was captured as it stood. Most sessions were checking or documenting at the stop (`README.md`, `design.md`, evidence scripts), but at least six were still editing source or config in their last two minutes, so the cap did cut some work short: kids control (renaming a component), API docs control (an error boundary), luxury control (a drawer style), architecture MCP (hero styles), music control (the Vite config), and HR MCP (type fixes). I found these by reading the end of each transcript, so the count is a lower bound.
- **7 of the 259 MCP calls returned errors (2.7%)**, and the agent recovered each time. Five point at the tool contract: `compose_design_tokens` rejected spacing overrides that conflict with a density preset (3 times), a visual-library hash that is not bundled, and a dark mode the style does not have. The other two were the agent's own input: a malformed `density` value that `recommend_design_direction` rejected, and a JSON payload that Claude Code could not parse, so the server never saw it.
- **The MCP arm used `earth-atelier` for 4 of the 10 briefs** (luxury skincare, budgeting, architecture, bakery). It took the server's top candidate in 7 briefs (in 2 of them after running the recommender again with changed inputs) and the second candidate in 3.
- Two MCP sessions (budgeting, music) were stopped before they reached `validate_design_audit_result`. Seven of the ten MCP folders hold a `design.md` that records the chosen contract; no control folder does.
- Control sessions launched subagents in 6 builds (7 calls: SRE, kids coding, API docs, budgeting, architecture, music) and MCP sessions in 1 (luxury skincare). Counting subagent work, the control arm made more tool calls, 3,484 against 2,752. On the main thread alone the MCP arm made more, 2,588 against 2,216.
- The concurrent sessions shared one machine, and it showed. 11 of the 20 sessions hit "Port 4173 is already in use" (the default `vite preview` port), and 14 ran `pkill` or `killall`. At least three times a session's `pkill` was followed within 30 seconds by a connection refusal in another running session: essay control against essay MCP, budgeting MCP against API docs MCP, and bakery control against bakery MCP and architecture MCP. Each affected session restarted its server and ran the failed check again. I cannot show that a page changed, and I cannot show that none did. The control build started before or together with its MCP twin in all ten pairs, by 13 to 62 minutes in five of them.
- Captures stop at 4000 px. 15 of the 20 desktop pages and all 20 phone pages are taller, so some judgments below depend on what sits above that line.

## Where the control build looked better

In my own blind read I did not prefer the control build overall in any pair. The readers did, more for practical completeness than for look:

- **Luxury skincare:** both readers would rather ship the control page. Its first screen is a complete buy box: three sizes with a price per night, add to bag, delivery, guarantee, reviews. In the part of the MCP page the screenshot shows, there is one buy button and no size options. On phone a dark block covers part of the control page's "NIGHT SERUM" label. Reader A and I counted it as a glitch; Reader B thought it might be a fixed element and did not count it.
- **Kids coding:** both readers would rather ship the control page. The price is up front ("$0 first class, then from $79 a month"), the hero edits real code live, and a mock live class shows how lessons work.
- **Budgeting:** both readers would rather ship the control page. It has a clearer one-glance verdict ("Free to spend $699"), a status label on every row, and a phone layout with a bottom tab bar. The MCP page reads as a long document.
- **API docs:** Reader B found the control page both better to ship and less generic: a warmer brand, with quickstart steps numbered to match the code panel.
- **Essay blog:** Reader B would rather ship the control page, a warm illustrated page with larger body type. I also found it the more charming of the two.
- **HR SaaS:** Reader A would rather ship the control page because price, go-live time, and result figures sit in its hero. Both readers and I found it the more template-like page.
- **Bakery and music:** Reader B found the control bakery page less generic (a bespoke shopfront illustration), and Reader A found the control music page less generic (a sunset hero with a long-shadow wordmark).

## Where the MCP build looked better

- **Less generic** is where the MCP builds did best. In five pairs (SRE, luxury skincare, budgeting, architecture, HR), my read and both readers' "less generic" answers all point at the MCP build. In the other five the reads split.
- The strongest cases have a hero or main view that demonstrates the product's own mechanic: a "What changed" timeline that lines up deploys with degraded services (SRE); a sample hire fanning out into onboarding, time off, payroll, and reviews (HR); a noon-sun slider on a section drawing (architecture); an overnight skin test you can scrub through (luxury); a sentence-led verdict that checks bills against an invoice that has not arrived (budgeting).
- Several control pages are bespoke too: an illustrated essay blog, a bakery with a drawn storefront, a poster-style festival page. The control baseline is strong, so the margin is narrow in many pairs.

## The reads

Each cell names the arm the reader picked. "Ship" asks which build they would rather ship for the brief's real users. "Less generic" asks which one looks less like a template. Reader A is Claude Opus and Reader B is Claude Sonnet; both saw only the neutral files. Reader B's first run could not view six briefs, so I reran those six with an image budget (see [`blind-reads/reader-b.md`](./blind-reads/reader-b.md)). Reader B also saw only roughly the first 2,000 px of the budgeting phone captures.

| Brief | My read | Reader A: ship | Reader A: less generic | Reader B: ship | Reader B: less generic |
| --- | --- | --- | --- | --- | --- |
| SRE incident dashboard | MCP (lean) | MCP (slight) | MCP (slight) | MCP (slight) | MCP (slight) |
| Indie long-form essay blog | MCP (slight lean) | MCP (slight) | MCP (clear) | control (slight) | tie |
| Luxury skincare product page | MCP | control (slight) | MCP (clear) | control (slight) | MCP (clear) |
| Kids coding-education landing page | tie | control (slight) | MCP (slight) | control (slight) | tie |
| Developer API docs homepage | tie | MCP (slight) | MCP (slight) | control (slight) | control (slight) |
| Personal budgeting app overview screen | MCP (slight lean) | control (slight) | MCP (slight) | control (slight) | MCP (slight) |
| Architecture studio portfolio | MCP (slight lean) | MCP (slight) | MCP (slight) | MCP (slight) | MCP (slight) |
| Neighborhood bakery ordering site | tie | MCP (slight) | MCP (slight) | MCP (slight) | control (slight) |
| B2B HR SaaS landing page | MCP | control (slight) | MCP (clear) | MCP (slight) | MCP (clear) |
| Music festival event page | MCP (slight lean) | MCP (slight) | control (slight) | MCP (slight) | tie |

## What the MCP arm did

| Brief | MCP calls | First call | recommend | compare | principles | ux | states | tokens | search refs | get ref | audit plan | validate | resources |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SRE incident dashboard | 29 | recommend_design_direction | 1 | 1 | 1 | 1 | 2 | 6 | 9 | 1 | 1 | 2 | 4 |
| Indie long-form essay blog | 23 | recommend_design_direction | 2 | 1 | 1 | 1 | 1 | 2 | 5 | 3 | 1 | 3 | 3 |
| Luxury skincare product page | 26 | recommend_design_direction | 1 | 1 | 1 | 1 | 2 | 4 | 6 | 2 | 2 | 1 | 5 |
| Kids coding-education landing page | 26 | recommend_design_direction | 1 | 1 | 1 | 1 | 1 | 3 | 5 | 2 | 1 | 2 | 8 |
| Developer API docs homepage | 24 | recommend_design_direction | 1 | 1 | 1 | 1 | 1 | 3 | 4 | 1 | 1 | 3 | 7 |
| Personal budgeting app overview screen | 27 | recommend_design_direction | 1 | 1 | 2 | 1 | 1 | 3 | 5 | 2 | 2 | 0 | 9 |
| Architecture studio portfolio | 21 | recommend_design_direction | 1 | 1 | 1 | 1 | 2 | 2 | 1 | 1 | 1 | 4 | 6 |
| Neighborhood bakery ordering site | 26 | recommend_design_direction | 1 | 0 | 2 | 2 | 2 | 1 | 8 | 3 | 1 | 1 | 5 |
| B2B HR SaaS landing page | 31 | recommend_design_direction | 2 | 1 | 1 | 1 | 2 | 4 | 8 | 2 | 1 | 3 | 6 |
| Music festival event page | 26 | recommend_design_direction | 2 | 1 | 1 | 1 | 2 | 2 | 6 | 2 | 1 | 0 | 8 |

All ten MCP sessions called `recommend_design_direction` first, after loading its schema. Every session also used the principle, UX, state, token, and audit-plan tools. The raw calls are in [`mcp-outputs/`](./mcp-outputs).

## How I judged

I, the agent that ran the experiment, read all ten pairs from the neutral files before I opened `key.json`, and wrote my impressions down first ([`blind-notes.md`](./blind-notes.md)). I knew from the logs which builds had been stopped, but not which side was which. My criteria were identity and specificity, fit to the brief, hierarchy and legibility, visible defects, and the phone layout. Those are close to the aims the MCP server states in its own instructions, so my read favors the MCP arm by construction. I added two independent readers to check that, and they gave a more mixed picture, mostly on "ship". All readers are Claude models, like the agent that built the pages, and each read is one sample.

## What this does and does not show

It shows that the agent followed the server's workflow in all ten builds when told to. It also shows that several MCP builds are more specific to their product than the matching control builds, and that readers noticed this without knowing which was which.

It does not show that the MCP causes better UI. There is one build per cell and ten briefs. The readers are models, and my own criteria echo the tool's rubric. The 90-minute cap stopped 9 of 10 MCP builds against 5 of 10 control builds. The captures cut off the lower part of most pages. Interaction, motion, and accessibility were not tested. If you read a pair differently, trust your own eyes and use [the comparison page](./compare/index.html).
