# Blind read by the author

These are the notes I wrote on each pair **before** I opened `key.json`, from the neutral `left` and `right` screenshots only. They are unchanged apart from trimmed section headers and this heading. `Left` and `Right` mean the files in `screenshots/<brief>/`; `key.json` says which arm each was.

My criteria were: identity and specificity (not a template), fit to the brief, hierarchy and legibility, visible defects, and the phone layout. Those criteria are close to the ones the MCP server itself states in its instructions, which I had read earlier in the session. That favors the MCP arm by construction, so weigh these notes with that in mind.

## essay-blog
Left: warm cream, serif display, bespoke SVG illustrations (building with one lit window; sodium vs LED lamps), polished; structure is hero text+illustration, featured essay card, archive list (standard blog-landing structure, executed very well). Mobile: good, hero building illustration clipped at bottom edge.
Right: grayscale, serif + monospace metadata, page opens on the essay itself with sticky "inside this essay" rail, archive with topic filter rail and reading-time squares, "desire line" figure in About; very specific to reading; restrained. Mobile: clean single column.
Verdict: tie, slight lean RIGHT (fit to "read slowly"; less template structure). Left has more charm/illustration. Close call.

## sre-incident-dashboard
Left: light UI with a large red-tinted "major outage" banner (SEV-1), suspected-change callout, summary tiles, incident table, recent-deploys rail, then a 3-column grid of 16 service cards each with three mini charts; "how to read this page" footer. Very polished, status-first, but close to the standard ops-dashboard pattern (banner + cards grid). Mobile: strong, stacked.
Right: neutral blue-gray, amber for degraded, tabbed top bar + time range; hero "partial degradation" panel with impact numbers, plus a bespoke "What changed" swimlane timeline correlating deploys/rollbacks with degraded bands (hatched, so not color-only); services as a dense table with sparklines + SLO multiples, needs-attention grouped first; deploys list; theme toggle. Mobile: adapted well (compact tabs, timeline).
Verdict: lean RIGHT (moderate): bespoke "what changed" visualization answers the brief's core question; low-chroma suits all-day use. Left is more immediately alarming (good for "is anything broken") and cleaner as a card grid. Both strong; no visible defects either side.

## luxury-skincare-product
Left: cream + copper, light serif, no product photo; hero is a bespoke dark "overnight test" panel with a time slider (22:00 to 06:00) and a brick/droplet skin-hydration visual (+23% vs -3%), headline "We woke 24 people at 2 a.m. to measure Small Hours."; exploded bottle diagram with numbered callouts + spec table; formula/origins table with amounts and harvest calendars. Very specific to the product; the visible top 4000 px show only a small "buy" button, no size options (purchase area may be lower, not visible).
Right: dark aubergine + gold, italic serif accent words ("Skin does its quietest work after dark.", "Six places, one bottle."); classic product page: bottle in an arch with stars, rating, price, 15/30/50 ml selector, add to bag, shipping notes, stats row, "at a glance" table, fit/not-fit lists. Polished and shopper-complete, but it is the stock "AI luxury" look (dark + gold + italic accent word). Mobile: small glitch, "NIGHT SERUM" label has a dark block over the I.
Verdict: LEFT (moderate to clear) for less generic and a hero that demonstrates the product claim; RIGHT is better on at-a-glance commerce completeness.

## kids-coding-landing
Left: cream + yellow band, multicolor pixel-art mascot, heavy rounded sans; hero with a live code-preview card (sliders change the game), stats band, three colorful age cards with mini illustrations, dark "fifty minutes, five parts" section with a mock live-class UI. Mobile: good; a sticky CTA bar shows up mid-page in the full-page capture (fixed-position element at the viewport line, a capture artifact, not scored as a defect).
Right: peach/black/yellow neo-brutalist with pixel font; hero has an interactive block-puzzle game, stats band, "how old is your child?" age picker, ticket-style course cards, dark section with a 50-minute class timeline and parent info (what you need, who is in the room, safety). Mobile: clean.
Verdict: TIE. Both are strongly branded and surprisingly alike in structure (game demo hero, yellow stats band, three course cards, dark class section). Left is friendlier/more colorful; Right is crisper and slightly more parent-informative.

## api-docs-home
Left: monochrome, dark code panel beside a "your first test payment is one POST request" hero with a "jump to" list; guides in four columns; endpoint table grouped by resource with method badges plus a conventions column; client-library table with install commands and versions. Very doc-like, dense, utilitarian (close to the stock docs look).
Right: warm off-white with an orange-red accent, "Build on Ledgerline" with search and popular chips, numbered 4-step quickstart beside a tabbed code panel, guides with icons and time estimates, resource cards listing endpoints, conventions card. Friendlier and a bit more branded; a bit more vertical space before the quickstart.
Mobile: both fine (code blocks scroll sideways, tabs overflow in both).
Verdict: TIE. Left is more austere/efficient; Right has slightly more identity. Neither is clearly less generic.

## budgeting-app-overview
Left: warm cream, serif headline with the number that matters ("on track: about $54 a day left"), annotated spending-vs-pace chart, category bars with pace ticks, hatched "still due" fixed costs, upcoming bills that call out coverage risk ("needs the Fernhill invoice"), savings goals, transactions table with an inline categorize row. Editorial and text-first, no cards or shadows; reads like a statement; a lot of explanatory copy. Mobile: clean single column.
Right: deep-green hero panel ("You're on track this month", free-to-spend $699, chart), then white cards with soft shadows, tinted icon tiles, status pills, savings rings, bill list; the standard polished fintech-app look (italic accent word in the headline). Mobile: fixed bottom tab bar (shows mid-page in the capture, an artifact), app-like.
Verdict: lean LEFT (slight): more distinctive and information-first; RIGHT is more approachable and app-like, safer pattern.

## architecture-studio-portfolio
Left: warm cream, serif with an italic accent word ("Quiet buildings for particular places."), hero is a sun-path polar diagram, stats row, numbered approach list, "how a project runs" timeline, commissions box, projects introduced by colored section drawings with type filter chips. Very crafted, drawings-first, rich.
Right: off-white, serif, hero is a section drawing of a house with a working "move the noon sun" slider (date, latitude, sun height, sun reaches); approach in four blocks cross-linked to projects; projects as an index table (no./project/location/year/type) followed by a detailed project panel with a floor plan. Restrained, publication-like, shows the three attributes the brief asked for in a clean table.
Mobile: both fine (Left has a MENU button, Right keeps four nav links in one tight row).
Verdict: TIE, slight lean RIGHT (hero demonstrates a mechanism; clean project index). Left is visually richer but leans on the italic-accent headline pattern.

## bakery-ordering
Left: warm cream + bottle green + brick red; friendly serif headline with an italic red accent ("Up before the birds, baking for the block."), a charming bespoke storefront illustration with awning and sun arch, awning-scallop divider, dark green "how far ahead should you order?" section with three cards (same day / a day ahead / 2-3 days) and earliest-pickup dates, menu tabs with illustrated product cards and size/slicing options. Delightful, branded; the ordering path is a few screens down.
Right: beige, light serif, "We open at 7. Your order's already bagged." with a ticket-style earliest-pickup panel by product type; menu as a compact list with thumbnails, per-item notice labels ("order by 5 pm the day before"), a sticky "your order" basket panel, hours table with holiday hours, illustrated map with directions. Functional and calm; plainer.
Mobile: Left shows illustration and schedule before the menu; Right reaches the menu sooner.
Verdict: TIE. Left has more brand charm (and the italic-accent headline), Right is more directly usable for ordering. Neither clearly less generic.

## hr-saas-landing
Left: white/gray with deep teal, plain headline "Enter a hire once. Onboarding, time off, payroll and reviews follow." with a bespoke hero demo: a new-hire record with a sample-hire switcher and a timeline showing how that one record fans out to onboarding / time off / payroll sync / reviews; logo strip; "four jobs, one employee record" with a vertical spine and a sample-data product panel per module, each captioned as sample data. Sober, specific, credible; no stock illustration.
Right: warm off-white, serif headline with underlined accent ("People operations, finally in one place."), hero "people overview" mock dashboard card, logo strip, four alternating feature rows with pastel tinted panels holding UI mockups, big stat callouts (77%, 3 hrs, 91%). Polished but it is the standard B2B SaaS landing template.
Mobile: both fine.
Verdict: LEFT (moderate): the hero demonstrates the product's core idea; RIGHT is the familiar template.

## music-festival
Left: deep navy/purple night palette, huge layered "LONGSHADOW" wordmark over a sun-and-hills illustration, orange ticker band, stats row (when/where/who/tickets), lineup as a three-column poster (FRI/SAT/SUN outlined headings, big headliners, stage markers, serif italic blurbs), stage filter chips. Immersive and bold. Tickets are not in the visible top 4000 px.
Right: cream with black type and red offset shadow ("LONG LIGHT"), hero with a festival-ticket card listing the three days, black stats band (40 artists, 3 stages, 8,500 a day, 7:30 pm sunset), pennant divider, bright blue lineup section with day tabs and stage chips, ticket price phases and four ticket tiers as ticket cards (visible early). Bold neo-brutalist poster with a ticket motif; price is in the hero.
Mobile: both fine; the wordmark/cards sit at the right edge on Right.
Verdict: TIE, slight lean RIGHT (purchase path is visible early, ticket motif is specific). Left's immersive poster hero is striking.

## Summary of blind verdicts (Left/Right as in the neutral files)
essay-blog: tie, slight lean Right | sre-incident-dashboard: lean Right | luxury-skincare-product: Left | kids-coding-landing: tie | api-docs-home: tie | budgeting-app-overview: slight lean Left | architecture-studio-portfolio: tie, slight lean Right | bakery-ordering: tie | hr-saas-landing: Left | music-festival: tie, slight lean Right
