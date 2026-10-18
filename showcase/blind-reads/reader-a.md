# Reader A (Claude Opus, fresh subagent)

Output of an independent blind read. The reader saw only the neutral `left` and `right` screenshots and `brief.txt` for each brief, with no knowledge of the arms or of the MCP server. See [`README.md`](./README.md) for the exact instructions. `Left` and `Right` are the files in `screenshots/<brief>/`; [`key.json`](../key.json) says which arm each was. The text below is the reader's answer, unedited.

### api-docs-home
- Ship: Left (slight) — Left's first screen is a working cURL quickstart (set key, then POST /v1/payments, then the 201 response) with Copy buttons and eight language tabs, beside a search box and "Jump to" links. Further down, its guides name the exact endpoints and events, the endpoint table has a filter, and each library row has an install command, a Copy button and a version, so a developer mid-task gets answers fast. Right is close, but it opens on a brand headline ("Build on Ledgerline"), and on phone the code panel only comes after all four quickstart steps.
- Less generic: Left (slight) — Left's headline is the product's first API call ("Your first test payment is one POST request.") and the page is built around that request and its response. Right has a warmer brand (cream, red, ruled lines) but relies on familiar moves: an API-version pill badge, an underlined product name, and icon tiles numbered 01–04.
- Left defects: desktop: nothing broken; minor empty space under the Jump-to list beside the taller code panel, and the right column is blank beside the endpoint table after Conventions ends; phone: language tabs and long code lines run off the right edge of the code panel (e.g. "Bearer $CAIRN_SECRET_KE").
- Right defects: desktop: nothing broken; minor empty space under the Conventions card beside the resource-card grid; phone: code lines run off the right edge of the code panel ("process.en…", "payments.cr…"). Faint blocky patches behind text on the cream background look like image compression, so I did not count them.

### architecture-studio-portfolio
- Ship: Right (slight) — Right's hero is an interactive section drawing of one of its own houses: you move the noon sun, and readouts give latitude, sun height and how far the light reaches into the room. It then lists all six projects in a table with location, year and type, and opens Seil House with a scaled plan, which is what clients and journalists look for. Left is just as polished and tells clients more (process stages with durations, build budgets, "Enquiries open for Spring 2027"), but only two project drawings appear within the capture.
- Less generic: Right (slight) — Right's headline ("We design every building for the shortest day") ties directly to the sun demo and to the 21 Dec sun tint on the plan. Left's sun-path figure and drawing-led project cards are also bespoke, but its red-italic accent headline ("Quiet buildings for *particular* places"), stats row and numbered principles are more familiar patterns.
- Left defects: desktop: none seen; phone: none seen.
- Right defects: desktop: none seen; phone: none seen.

### bakery-ordering
- Ship: Right (slight) — Right shows the order-ahead lead time on every menu line and keeps a "Your order" basket beside the menu on desktop. Within the capture it also reaches an hours table (today marked, holiday hours) and a street map with Get directions and Copy address. Left's illustrated cards are charming but tall and padded, and on desktop neither the basket nor the hours and address appear within 4000 px.
- Less generic: Right (slight) — Right's opening is built on the order-ahead mechanic itself: "We open at 7. Your order's already bagged." plus an earliest-pickup ticket for each category. Left has bespoke bread and storefront illustrations, but frames them in a familiar template: an italic-accent headline ("Up before the birds, *baking for the block*") and three icon cards on a dark band.
- Left defects: desktop: menu cards are stretched to equal height, leaving large blank areas above the buttons in shorter cards (Cheddar &amp; Chive, Kalamata, Honey Challah); phone: none seen.
- Right defects: desktop: minor, the right column is blank under the basket panel beside the long menu list; phone: none seen.

### budgeting-app-overview
- Ship: Right (slight) — Right answers "am I on track?" fastest: a dark hero card shows $699 free to spend with a pace chart. Categories, bills and goals then carry clear status labels (On track, Ahead of plan, Behind plan) and Mark paid buttons. Left is just as thorough but denser and more text-heavy for a check people make several times a week.
- Less generic: Left (slight) — Left states the status as a plain sentence ("about $54 a day left through Oct 31") and uses hatched bars for fixed costs still due. It also checks whether bills are covered against an invoice that hasn't arrived yet ("$750.49 short without it"), which fits irregular income. Right is the familiar rounded-card finance dashboard, with an italic accent word in its headline ("You're *on track* this month").
- Left defects: desktop: none seen; phone: none seen.
- Right defects: desktop: none seen; phone: none seen (the bottom tab bar is a fixed element; a few amounts wrap to a second line).

### essay-blog
- Ship: Right (slight) — Right opens straight into the newest essay: the first 335 words are inline, beside a table of contents with minutes per section and "about 15 more minutes". After that come an archive with topic filters and reading-time bars, an About section, and a proper email form, which suits readers who read every essay in full. Left is attractive, but it spends its first screen on a hero before the essay starts.
- Less generic: Right (clear) — Right's metadata rail, its reading-time key (one block = 2 minutes) and its "Fig. 1" desire-line diagram, which explains the blog's name, feel made for this writer. Left's big headline + paragraph + two buttons + illustration, followed by pill filters, is a standard blog template, though its sodium-vs-LED streetlamp illustration is a nice bespoke touch.
- Left defects: desktop: minor, about 550 px of empty left column under the newest-essay illustration beside the excerpt; phone: the hero building illustration is cut off at the third floor by the section rule, so it looks cropped.
- Right defects: desktop: minor, the left rail sits empty for about 1,000 px under the essay contents list; phone: none seen.

### hr-saas-landing
- Ship: Right (slight) — Right puts what a vendor comparison needs up front: "From $8 per employee", "Live in about three weeks" and "Data migration included" in the hero, a "1,100+ companies" logo strip, and result figures in the feature sections (77%, 3 hrs, 91%). It also names payroll providers (ADP, Paychex, Paylocity, Paycor, Gusto) and has Security in the nav. Left explains the product more convincingly, but no pricing or result figures appear within 4000 px.
- Less generic: Left (clear) — Left's hero is a sample-hire switcher (Maya Salaried, Luis Hourly, Priya Remote) showing one record flowing into onboarding, time off, payroll and reviews. Every section repeats the idea with "Reads from the record" chips and sample-data panels, such as a missing direct-deposit form holding up payroll and a below-minimum coverage warning. Right is the standard SaaS layout: eyebrow label, underlined accent phrase, two CTAs with three checkmarks, a KPI dashboard card, a logo strip, and alternating feature rows with icon badges.
- Left defects: desktop: none seen; phone: none seen.
- Right defects: desktop: none seen; phone: minor, names are cut off with ellipses inside the mock UI ("Customer Success M…", "Meet your buddy, Sa…").

### kids-coding-landing
- Ship: Left (slight) — Left states the price up front ("$0 first class, then from $79 a month"), and its hero lets a child change real code and watch the game change. Its mock live-class call (a teacher, pixel classmates with hands up, "Bug of the Day") makes "how a live class works" concrete for parent and child alike. Right is close; its age picker, minute-by-minute class timeline and safety notes are excellent for parents.
- Less generic: Right (slight) — Right's hero is a playable block puzzle (get Pip past the rock to her nest) with a single CTA. Its tape-labelled course cards, ticket-stub "First three projects" lists and pixel class timer feel built for this school. Left's hero follows the usual SaaS formula (pill badge, three-part headline, two buttons, three trust checkmarks), even though its code preview is bespoke.
- Left defects: desktop: course cards stretched to equal height leave blank bands of about 80 px above the requirement chips in the 9–10 and 11–12 cards; phone: none seen (the overlapping "Book a free trial class" bar is a fixed element).
- Right defects: desktop: course cards stretched to equal height leave about 120 px of blank space above the dashed "First three projects" divider in the 7–8 and 9–10 cards; phone: the "New puzzle" button wraps onto its own row under Run/Clear.

### luxury-skincare-product
- Ship: Right (slight) — Right puts the full purchase area in the first screen: 4.8 stars from 312 reviews, three sizes with a per-night price, Add to bag, delivery dates, a guarantee and a sample, which is what shoppers comparing premium serums need. Left's overnight-test story and sourcing detail are compelling, but within 4000 px it offers only one "Buy 30 ml · $240" button, with no size options, delivery information or reviews.
- Less generic: Left (clear) — Left is built around this serum: "We woke 24 people at 2 a.m." with a 22:00–06:00 split-face comparison you can scrub through, and a dimensioned technical drawing of the bottle. Its ingredient rows carry coordinates, harvest-month bars and cited research. Right is the familiar dark-violet-and-gold luxury product page, with an arched gallery, a stats row and italic accent words in its headlines.
- Left defects: desktop: the left half sits empty for about 500 px beside the spec table; phone: none seen.
- Right defects: desktop: none seen; phone: a small dark rectangle covers the "I" in "NIGHT SERUM" and the first rating star under the product title.

### music-festival
- Ship: Right (slight) — Right is built to sell: the hero carries a price ("Weekend GA $329, price rises Jan 1"). Within the capture it also shows a release price ladder ($249 sold out, $329 now, then $379 and $429) and ticket-tier cards with status badges. Left has a superb full three-day lineup with stage filters, but no ticket section appears within 4000 px on either device.
- Less generic: Left (slight) — Left's sunset hero, where the giant wordmark casts a long shadow, together with the grain texture and a "312 days to go" sticker, builds a mood specific to this festival. Right's cream, black and yellow ticket-stub styling is well made but closer to a standard event template.
- Left defects: desktop: none seen; phone: the hero wordmark's blurred shadow looks smeared and the lower word sinks into the hills, which hurts legibility.
- Right defects: desktop: in the last lineup row, "Little Thaw" sits jammed directly under "Nana Akosua" with no spacing; phone: none seen.

### sre-incident-dashboard
- Ship: Right (slight) — Right's "What changed" timeline lines up deploys against degraded periods and incident start times, and its deploy log tags entries with "Mitigates" or "Preceded INC by 5m". Services are split into "Needs attention" and "Operating normally", so both "is anything broken?" and "what changed?" read in seconds. Left's red SEV-1 banner, with a "Suspected change" box tying the outage to deploy v3.41.0, is also strong, but its service health is a grid of 16 equal cards and its desktop leaves a long empty column.
- Less generic: Right (slight) — Right measures impact in mini-charts as multiples of the SLO, and its change timeline is built for incident triage. Left's KPI tiles above a grid of sparkline cards are the more common monitoring-dashboard pattern.
- Left defects: desktop: the right column is empty for roughly 2,000 px below the recent-deploys rail, and the last service-grid row holds a single card; phone: the filter placeholder is cut off ("Filter by service or te").
- Right defects: desktop: the footer shows a "Demo controls" label with nothing under it; phone: a gridline and an incident marker line run through the "Show 4 more services" label, and incident titles wrap into a narrow four-line column.
