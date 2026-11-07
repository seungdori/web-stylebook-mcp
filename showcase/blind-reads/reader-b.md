# Reader B (Claude Sonnet, fresh subagent)

Output of an independent blind read, with the same instructions and the same neutral files as [Reader A](./reader-a.md); see [`README.md`](./README.md). `Left` and `Right` are the files in `screenshots/<brief>/`; [`key.json`](../key.json) says which arm each was.

**The first run saw only four of the ten briefs.** For the other six (essay-blog, hr-saas-landing, kids-coding-landing, luxury-skincare-product, music-festival, sre-incident-dashboard) the reader's image previews came back empty with a "request limit" notice, so it saw no pixels. Its `Tie (slight)` lines for those six are placeholders, not judgments, and the reader said so. I ran a second pass for those six; it is at the end of this file under "Second run". The text of each run is the reader's answer, unedited.

## First run

Four briefs are assessed from the screenshots. Six are not (essay-blog, hr-saas-landing, kids-coding-landing, luxury-skincare-product, music-festival, sre-incident-dashboard) because my image previews for them came back empty with a viewer "request limit" notice, so I saw no pixels. Their "Tie (slight)" lines are placeholders, not judgments, so please exclude them. For budgeting-app-overview I reviewed desktop fully but only the first ~2000px of the phone captures.

### api-docs-home
- Ship: Right (slight) — Its first screen covers the common entry points at once: search with a "/" hint, Popular chips, an "API version 2026-10-07 / What changed" link and an Operational pill. The quickstart pairs four numbered steps with a code panel whose INSTALL / REQUEST / RESPONSE blocks are numbered to match. Left is denser and its filterable 21-endpoint table is more useful for repeat lookups, but it has more rough edges.
- Less generic: Right (slight) — Faint ruled "ledger" lines sit behind the hero, the brand name is underlined, the steps map to the code, and there is a "Ledger" resource group. Left is the familiar white page with a dark code panel, though its headline "Your first test payment is one POST request" is more specific than Right's "Build on Ledgerline".
- Left defects: desktop: the hero's left column ends about 330px above the bottom of the code panel, leaving an empty block under "Jump to"; the guide columns are small grey text with mono endpoint strings, which is dense; phone: code lines clip at the panel's right edge (e.g. `-H "Authorization: Bearer $CAIRN_SECRET_KE`), and the language tab row is cut off at "PHP J" with no fade, so it looks accidental.
- Right defects: desktop: the hero is only headline plus search, and the code starts about 480px down; the Conventions card is much shorter than the resource grid, leaving a blank column beside the last rows (probably sticky); resource cards list 4 endpoints of 6 to 12 with no "view all" link visible; phone: code lines clip at the panel edge (e.g. `const ledgerline = new Ledgerline(process.en`), but the tabs wrap to two rows instead of clipping; nothing else seen.

### architecture-studio-portfolio
- Ship: Right (slight) — The hero is a working section drawing with a "Move the noon sun" slider and readouts. The six projects appear as a No. / Project / Location / Year / Type table by about y=2700 on desktop and within the first 4000px on phone. Left's illustrated project cards look great, but on phone the first 4000px never reach a project, and on desktop the cards' location, year and type are not visible in the capture.
- Less generic: Right (slight) — "We design every building for the shortest day" could not sit on another studio's site, and the hero demonstrates how the studio works. Left is also bespoke (sun-path diagram, annotated section-drawing cards), but its headline uses the familiar serif-with-one-italic-red-word cadence.
- Left defects: desktop: nothing broken; the mono microtype is tiny, and the A-01 / 1:100 sheet labels on the tinted frames measure only about 4.6:1; the staggered project cards leave an empty gap above the second card; phone: nothing broken; diagram labels shrink to unreadable size, and the process timeline is still on screen at 4000px.
- Right defects: desktop: none seen; phone: the header packs the logo plus four nav links onto one tight row, and the hero drawing's labels shrink to unreadable size; no clipping.

### bakery-ordering
- Ship: Right (slight) — The menu, category tabs, per-item lead-time lines ("Same day · order 2 hours ahead", "Order by 5 pm the day before") and an always-visible "Your order" panel are all in the first screen. The hero ticket also lists the earliest pickup per category. Left explains lead times well, but its menu starts about 1700px down on desktop and about 2650px on phone, and its basket is only a header button.
- Less generic: Left (slight) — It has a custom Little Wren shopfront (sign, OPEN door, bird, 2017 seal), an awning scallop reused as a section divider, and a hand-drawn illustration on every item, so it is unmistakably this shop. Right is specific in structure (pickup-ticket card, drawn street map), but its quiet serif and outline styling reads closer to a boutique template. The headline on Left still uses the italic-accent cadence.
- Left defects: desktop: nothing broken; cards without size options leave a blank band above the full-width Add button, and the last grid row holds only two cards; phone: nothing broken; the 2017 seal hangs off the illustration and sits within about 5px of the screen edge, and the hero plus three explainer cards push the menu far down.
- Right defects: desktop: below the first screen the single-column menu leaves the right ~600px empty for about 1700px, because the order panel appears only at the top (likely sticky, so partly a capture effect); phone: none seen; the basket panel appears only after the whole menu, though a header Basket button exists.

### budgeting-app-overview
- Ship: Right (slight) — Partly assessed (desktop fully, phone first ~2000px). Right reads as a real app screen: a one-glance verdict, a large "Free to spend $699" with a spent / bills due / free bar, chips naming the two problem categories, icon-plus-pill status on every row, and a phone bottom tab bar. Left carries the same facts well in plain text, including expected-invoice logic, but reads as a long document.
- Less generic: Left (slight) — A sentence-led verdict ("about $54 a day left through Oct 31"), even-pace ticks, hatched "still due" bars, and a highlighted expected invoice ("covered only if the Fernhill Studio invoice arrives first") are built around irregular income, with almost no chrome. Right's dark-green hero card, rounded cards, icon tiles and italic mint accent word are the common fintech look, though it also uses ticks and hatching.
- Left defects: desktop: nothing broken; a long, flat page with no card separation, and a very wide gap between merchant and category in the transactions table; phone (first ~2000px only): none seen, though the top nav squeezes four text links beside the logo.
- Right defects: desktop: none seen apart from the "Next payment · Alder &amp; Finch Invoice $1,950" card sitting under "Upcoming bills" with an ambiguous label (it is money arriving, not a bill); phone (first ~2000px only): none seen (the fixed bottom tab bar appears mid-capture and was ignored per your note).

### essay-blog
- Ship: Tie (slight) — NOT ASSESSED: previews came back empty, so I saw no pixels and have no basis to prefer either side.
- Less generic: Tie (slight) — NOT ASSESSED, same reason.
- Left defects: desktop: not assessed; phone: not assessed.
- Right defects: desktop: not assessed; phone: not assessed.

### hr-saas-landing
- Ship: Tie (slight) — NOT ASSESSED: previews came back empty, so I saw no pixels and have no basis to prefer either side.
- Less generic: Tie (slight) — NOT ASSESSED, same reason.
- Left defects: desktop: not assessed; phone: not assessed.
- Right defects: desktop: not assessed; phone: not assessed.

### kids-coding-landing
- Ship: Tie (slight) — NOT ASSESSED: previews came back empty, so I saw no pixels and have no basis to prefer either side.
- Less generic: Tie (slight) — NOT ASSESSED, same reason.
- Left defects: desktop: not assessed; phone: not assessed.
- Right defects: desktop: not assessed; phone: not assessed.

### luxury-skincare-product
- Ship: Tie (slight) — NOT ASSESSED: previews came back empty, so I saw no pixels and have no basis to prefer either side.
- Less generic: Tie (slight) — NOT ASSESSED, same reason.
- Left defects: desktop: not assessed; phone: not assessed.
- Right defects: desktop: not assessed; phone: not assessed.

### music-festival
- Ship: Tie (slight) — NOT ASSESSED: previews came back empty, so I saw no pixels and have no basis to prefer either side.
- Less generic: Tie (slight) — NOT ASSESSED, same reason.
- Left defects: desktop: not assessed (the only evidence is pixel samples: small text on the deep-purple background measures about 8.5:1, so no contrast problem in those samples); phone: not assessed.
- Right defects: desktop: not assessed (pixel samples only: small lineup meta text on the cobalt-blue background measures about 5.7:1 and body text about 7.2:1, both above 4.5:1); phone: not assessed.

### sre-incident-dashboard
- Ship: Tie (slight) — NOT ASSESSED: previews came back empty, so I saw no pixels and have no basis to prefer either side.
- Less generic: Tie (slight) — NOT ASSESSED, same reason.
- Left defects: desktop: not assessed (the only fact is that the full page is 3284px tall at 1440 wide, against 3841px for Right); phone: not assessed.
- Right defects: desktop: not assessed (pixel samples only: a light-grey theme with small muted text at about 5.4 to 5.7:1, which passes 4.5:1); phone: not assessed.

## Second run

A fresh Sonnet subagent got the same instructions for only the six briefs the first run could not view, plus an image budget (view each screenshot once, crop sparingly, stay under about 60 tool calls) and a rule to write NOT ASSESSED rather than guess. It assessed all six. I treat the two runs as one reader, Reader B, because the instructions and the neutral files were the same. The text below is the reader's answer, unedited.

### essay-blog
- Ship: Left (slight) — Warm cream page. The hero names the writer and her bus-route past. The featured essay has a custom sodium-vs-LED streetlight illustration, an italic dek, topic dots and larger, easier body type. Archive rows show date, number, dek, topics and a reading-time meter. Right is close (TOC with per-section minutes, "first 335 of ~3,800 words", visible About and email form) but is a plainer gray page with small type. Left's subscribe form falls below the 4000 px cut, so I only saw its nav button and "Get it by email".
- Less generic: Tie (slight) — Left's one-lit-window building and essay-specific art give it identity, but the layout (hero, image-beside-text feature, chip-filtered list) is a familiar blog pattern. Right's rails, dotted-path TOC, minute blocks and desire-line diagram are specific ideas, but the monochrome gray look reads like a default minimal theme.
- Left defects: desktop: none seen (capture ends mid-archive); phone: the hero building is sliced at its base by the section rule (three floors, no door), so it reads as cropped.
- Right defects: desktop: none seen (empty quarter beside the excerpt is a reading measure; gray palette and small mono metadata are low-key); phone: none seen.

### hr-saas-landing
- Ship: Left (slight) — The hero shows one new-hire record (Maya Okafor) fanning out into onboarding, time off, payroll sync and reviews. Each module then gets a realistic panel labelled "Sample data", which explains the product concretely to people comparing vendors. Right is easier to skim and shows "From $8 per employee", "live in about three weeks" and result stats (77%, 3 hrs, 91%) earlier, so it is close.
- Less generic: Left (clear) — "Enter a hire once…" with a sample-hire timeline demonstrates this product's mechanic. The vertical spine and "reads from the record" chips carry that idea down the page. Right follows the stock SaaS formula: interchangeable headline, dashboard card, logo row, alternating pastel panels with big stat numbers.
- Left defects: desktop: none seen (type in the mock panels is very small and the page is dense); phone: none seen.
- Right defects: desktop: none seen; phone: none seen (hero mock card truncates the role as "Customer Success Ma…" with an ellipsis).

### kids-coding-landing
- Ship: Left (slight) — The hero is a live code editor with game preview and sliders. The stat band says "$0 first class, then from $79 a month". Each age card has a mascot with a block/Python/JS snippet and "What grown-ups get" bullets for parents, and a mock live class shows six kids and a teacher. Right is tidy and has a useful age picker and safety copy, but its text-only course cards have large dead gaps, and I saw no monthly price in the capture.
- Less generic: Tie (slight) — Both heroes demonstrate the product (editing code vs a block puzzle) and both avoid stock kids-edtech furniture. Left has more illustrated assets (robot per track, class mock). Right has more product-specific copy and interaction (the "6" boxed in the headline, age picker, 15:00 class clock).
- Left defects: desktop: none broken; small pale-gray tags on cream pills in the course cards are low-contrast, and cards 2 and 3 have a dead gap above them; phone: none seen (sticky CTA overlapping the hero card ignored per your note).
- Right defects: desktop: course cards 1 and 2 have large empty areas above the dashed divider, and the staggered cards end at ragged bottoms; phone: none seen.

### luxury-skincare-product
- Ship: Right (slight) — The first screen is a complete buy box: product gallery, 4.8 rating, $240 with 15/30/50 ml options, add to bag, delivery dates, guarantee and sample vial. Below it are an "At a glance" table and a "right for you?" list that suit comparison shoppers. Left leads with a persuasive study (+23% vs -3%) and strong spec and ingredient tables, but the product shows only as a small bottle inside a panel, and sizes, delivery and reviews are not visible in the capture.
- Less generic: Left (clear) — The overnight-test graphic (brick-and-droplet cheeks with a time scrubber), the annotated bottle drawing and the ingredient rows with amounts, harvest calendars and origins belong only to this product. Right is the familiar luxury template: aubergine and gold, starry arch frame, italic gold accent words ("after dark.", "one bottle.").
- Left defects: desktop: no product photography, with large empty cream areas around the hero text; phone: the bottle inside the hero panel shrinks to a tiny sliver.
- Right defects: desktop: none seen (tiny gold and gray micro-labels on near-black are low-contrast); phone: a small dark box overlaps the "NIGHT SERUM" label and first rating star, probably a fixed element, so not counted; otherwise none seen.

### music-festival
- Ship: Right (slight) — Tickets are reached within the capture: price and "Get tickets" in the hero, then release phases (Early Bird struck through, Phase 2 now $329) and four tiers with "Selling fast" and "Almost gone" tags plus a Friday-pass shortcut. Day tabs keep the 40-act lineup compact on phone. Left has the more dramatic hero, shows all three days side by side and has a "Release 2 is 79% claimed" bar. But its tickets sit below the desktop cut and far down the phone page, after a single-column list of about 40 acts.
- Less generic: Tie (slight) — Both have bespoke illustrated identities. Left has the wordmark with a real long shadow over a sunset and outlined FRI/SAT/SUN. Right has a screenprint poster stub, bunting dividers and perforated ticket cards. Neither reads as a template.
- Left defects: desktop: none seen (the shadow smears slightly but the wordmark stays legible); phone: wordmark wraps to two lines with its shadow merging into the hills; the very long lineup column is heavy but not broken.
- Right defects: desktop: lineup shows only Friday by default, and the last row stacks "Little Thaw" under "Nana Akosua", leaving a ragged grid; phone: none seen.

### sre-incident-dashboard
- Ship: Right (slight) — A "What changed" timeline lines up deploys and config changes against degraded services. The services table is grouped "Needs attention 5 / Operating normally 13" with a Last-change column and "Mitigates INC-…" tags, so "is anything broken" and "what changed" read fast in a compact layout. Left's red SEV-1 banner with a "Suspected change" callout is equally clear at the top, but 16 bulky service cards and an empty column make the rest slower to scan.
- Less generic: Right (slight) — The change-versus-health timeline and hatched (not color-only) degraded states are specific to this job. Left's banner, KPI tiles and card grid are polished but follow the standard monitoring-dashboard pattern.
- Left defects: desktop: the services grid fills only about 70% of the width, leaving an empty right column roughly 390 px wide and 1,800 px tall under the Recent deploys panel, and the last row holds a single orphan card; phone: the filter input's placeholder is clipped ("Filter by service or te").
- Right defects: desktop: none seen (dense table, about 10 px text); phone: none seen.
