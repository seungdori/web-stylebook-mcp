# Independent blind reads

After I read the pairs blind myself ([`../blind-notes.md`](../blind-notes.md)), I asked two fresh Claude subagents to read them too. I did it for two reasons. My criteria were close to the aims the MCP server states in its own instructions, and I knew from the logs which builds had been stopped at the 90-minute cap.

- [`reader-a.md`](./reader-a.md): Claude Opus.
- [`reader-b.md`](./reader-b.md): Claude Sonnet.

Each reader got one folder per brief with `brief.txt` and the four neutral screenshots (`left` and `right`, at 1440 px and 390 px) and nothing else. There were no arm names, no mention of the MCP, and no results. For each brief the reader answered three questions: which build it would rather ship for the brief's real users, which one looks less like a generic template, and what visible defects each side has. The two readers got the same instructions apart from their label and scratch directory. Reader B's second run, for the six briefs its first run could not view, also got an image budget (view each screenshot once, crop sparingly, stay under about 60 tool calls) and a rule to write NOT ASSESSED rather than guess. The instructions of the first runs were:

```text
You are an independent design reviewer (label: reader-a). The folder /tmp/blind-reader/ has 10 sub-folders, one per product brief. Each holds brief.txt (the product brief) and four screenshots of two candidate websites built for that brief: left-1440.webp and right-1440.webp (desktop, 1440 px wide) and left-390.webp and right-390.webp (phone, 390 px wide). "Left" and "Right" are only labels. The screenshots are full-page captures cut at 4000 px tall, so you see the top part of each page. Fixed-position elements (sticky bars, floating buttons) show up in the middle of a full-page capture because of how it is taken; do not count that as a defect.

For each of the 10 briefs:
1. Read brief.txt, then look at all four screenshots with the Read tool, which displays images. Very tall images are downscaled, so when you need detail, crop them with ImageMagick into a scratch directory of your own, for example `magick /tmp/blind-reader/<brief>/left-1440.webp -crop 1440x1000 +repage /tmp/reader-a/<brief>-left-%d.png`, and look at the crops.
2. Decide three things:
   (a) Which build would you rather ship for this brief's real users?
   (b) Which one looks less like a generic, template-made page and more like it was designed for this specific product?
   (c) What visible defects does each side have (clipped or overlapping text, broken layout, large empty regions, low contrast, anything that looks broken)? Check desktop and phone separately.
   Answer (a) and (b) with Left, Right, or Tie, plus a confidence of clear or slight. Give one to three sentences of concrete reasons that point at what you saw.

Rules: Only open files under /tmp/blind-reader/ and your own scratch directory /tmp/reader-a/. Do not look anywhere else on the filesystem, do not browse the web, and do not try to find out how the pages were made. Judge only what the screenshots show. Do not assume either side was made in any particular way. Give no numeric scores and do not total results across briefs.

Return exactly 10 sections, one per brief in alphabetical folder order, each in this format:

### <brief-id>
- Ship: Left|Right|Tie (clear|slight) — reason
- Less generic: Left|Right|Tie (clear|slight) — reason
- Left defects: desktop: ...; phone: ...   (write "none seen" if none)
- Right defects: desktop: ...; phone: ...
```

Limits of these reads:

- The readers are models, not designers or users, and each read is one sample. Rereading would give different answers.
- The `left` and `right` files in the reader folder were byte-for-byte copies of `screenshots/<brief>/`. The readers were told to open nothing else, but I cannot verify that they obeyed.
- The screenshots stop at 4000 px, so a reader cannot see content lower on the page. Several "ship" answers depend on that, for example whether a purchase area is visible.
- Neither reader was told what the study compares, which means "less generic" is their own reading of the phrase.
