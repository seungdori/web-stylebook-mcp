#!/usr/bin/env node
// The mapping goes to key.json only and is never printed, so the author can look at the results without learning it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assignSides } from './assign.mjs';
import { SHOWCASE_DIR, VIEWPORTS, loadBriefs, logDir } from './lib.mjs';
import { SEED } from './seed.mjs';

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = flag('out', SHOWCASE_DIR);
const quality = flag('quality', '78');

const esc = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const briefs = loadBriefs();
const assignments = assignSides(briefs.map((b) => b.id));

function convert(png, webp) {
  mkdirSync(join(webp, '..'), { recursive: true });
  const result = spawnSync('cwebp', ['-quiet', '-q', quality, '-m', '6', png, '-o', webp], { encoding: 'utf8' });
  if (result.error) throw new Error(`cwebp (from libwebp) is required to write the WebP screenshots: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`cwebp failed for ${png}: ${result.stderr}`);
  return statSync(webp).size;
}

let totalBytes = 0;
const shown = {};
for (const brief of briefs) {
  shown[brief.id] = {};
  for (const side of ['left', 'right']) {
    const arm = assignments[brief.id][side];
    const metaPath = join(logDir(brief.id, arm), 'meta.json');
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null;
    for (const { width } of VIEWPORTS) {
      const png = join(logDir(brief.id, arm), 'shots', `${width}.png`);
      const shot = meta?.screenshots?.[width];
      if (!existsSync(png) || !shot) continue;
      totalBytes += convert(png, join(out, 'screenshots', brief.id, `${side}-${width}.webp`));
      shown[brief.id][`${side}-${width}`] = { height: shot.capturedHeight, truncated: shot.truncated, pageHeight: shot.pageHeight };
    }
  }
}

writeFileSync(
  join(out, 'key.json'),
  `${JSON.stringify(
    {
      seed: SEED,
      algorithm:
        'FNV-1a (32-bit) of the seed feeds mulberry32. For each brief in briefs.json order, one draw: below 0.5 puts the control build on the left, otherwise the MCP build.',
      assignments,
    },
    null,
    2,
  )}\n`,
);

function figure(briefId, briefTitle, side, width) {
  const label = side === 'left' ? 'Left' : 'Right';
  const image = shown[briefId][`${side}-${width}`];
  if (!image) {
    return `<figure class="missing"><figcaption>${label}</figcaption><p>No screenshot: this build did not produce a page.</p></figure>`;
  }
  const src = `../screenshots/${briefId}/${side}-${width}.webp`;
  const alt = `${label} build of ${briefTitle}, ${width} px wide`;
  const note = image.truncated ? `<p class="note">The page is ${image.pageHeight} px tall; the capture stops at ${image.height} px.</p>` : '';
  const img = `<a href="${src}"><img src="${src}" width="${width}" height="${image.height}" alt="${esc(alt)}" loading="lazy"></a>`;
  return `<figure><figcaption>${label}</figcaption>${width === 390 ? `<div class="frame">${img}</div>` : img}${note}</figure>`;
}

const nav = briefs.map((b, i) => `<li><a href="#${b.id}">${i + 1}. ${esc(b.title)}</a></li>`).join('\n      ');
const sections = briefs
  .map(
    (b, i) => `
  <section id="${b.id}">
    <h2>${i + 1}. ${esc(b.title)}</h2>
    <p class="brief">${esc(b.brief)}</p>
    <h3>Desktop, 1440 px wide</h3>
    <div class="pair">${figure(b.id, b.title, 'left', 1440)}${figure(b.id, b.title, 'right', 1440)}</div>
    <h3>Mobile, 390 px wide</h3>
    <div class="pair">${figure(b.id, b.title, 'left', 390)}${figure(b.id, b.title, 'right', 390)}</div>
  </section>`,
  )
  .join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blind comparison: builds with and without web-stylebook-mcp</title>
<style>
  :root { color-scheme: light; --ink: #1d1d1f; --muted: #5c5c63; --line: #d6d6db; --bg: #f6f6f7; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.55 system-ui, sans-serif; color: var(--ink); background: var(--bg); }
  main { max-width: 1500px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 1.6rem; margin: 0 0 8px; }
  h2 { font-size: 1.25rem; margin: 0 0 6px; }
  h3 { font-size: 0.95rem; margin: 24px 0 8px; color: var(--muted); font-weight: 600; }
  a { color: #0b57d0; }
  .lede { max-width: 70ch; color: var(--muted); margin: 0 0 16px; }
  nav ol { columns: 2; padding-left: 1.2rem; margin: 0 0 8px; }
  section { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); }
  .brief { max-width: 80ch; margin: 0; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
  figure { margin: 0; min-width: 0; }
  figcaption { font-weight: 600; margin-bottom: 6px; }
  img { display: block; width: 100%; height: auto; border: 1px solid var(--line); background: #fff; }
  .frame { max-height: 900px; overflow: auto; border: 1px solid var(--line); background: #fff; }
  .frame img { width: 390px; max-width: 100%; border: 0; margin: 0 auto; }
  .note { margin: 6px 0 0; font-size: 0.85rem; color: var(--muted); }
  .missing p { margin: 0; padding: 48px 16px; text-align: center; color: var(--muted); border: 1px dashed var(--line); background: #fff; }
  @media (max-width: 800px) { .pair { grid-template-columns: 1fr; } nav ol { columns: 1; } }
</style>
</head>
<body>
<main>
  <h1>Blind comparison: builds with and without web-stylebook-mcp</h1>
  <p class="lede">Ten briefs, two builds each. One build had the MCP server attached, the other did not. Which side is which was drawn per brief from a fixed seed and is not shown here. Look at every pair first; the mapping is in <code>../key.json</code> and the protocol is in <a href="../README.md">the README</a>. There are no scores. Judge each pair yourself.</p>
  <p class="lede">Screenshots are full-page and cut at 4000 px. Click one to open it at full size.</p>
  <nav aria-label="Briefs">
    <ol>
      ${nav}
    </ol>
  </nav>
${sections}
</main>
</body>
</html>
`;
mkdirSync(join(out, 'compare'), { recursive: true });
writeFileSync(join(out, 'compare', 'index.html'), page);

const images = Object.values(shown).reduce((n, entry) => n + Object.keys(entry).length, 0);
console.log(`wrote ${images} images (${(totalBytes / 1e6).toFixed(2)} MB), key.json, compare/index.html to ${out}`);
