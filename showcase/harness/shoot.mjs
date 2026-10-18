import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { MAX_SHOT_HEIGHT, VIEWPORTS } from './lib.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function serve(distDir) {
  const root = resolve(distDir);
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(join(root, normalize(pathname)));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file).catch(() => null);
      }
      // A single page has no routes, so an extensionless miss falls back to the entry point.
      if (!info && !extname(pathname)) file = join(root, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

// Sections that reveal on scroll are only drawn once they enter the viewport, so scroll through the page once and return to the top.
async function revealAndSettle(page) {
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const to = (top) => window.scrollTo({ top, behavior: 'instant' });
    const step = window.innerHeight * 0.8;
    const limit = Math.min(document.documentElement.scrollHeight, 12000);
    for (let y = 0; y < limit; y += step) {
      to(y);
      await wait(120);
    }
    to(document.documentElement.scrollHeight);
    await wait(300);
    to(0);
  });
  await page.waitForTimeout(1000);
}

async function capture(browser, baseUrl, viewport, file) {
  const notes = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)));
    page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ''}`.slice(0, 300)));
    page.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`.slice(0, 300));
    });

    await page.goto(baseUrl, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => notes.push('network did not go idle within 15 s'));
    await page.evaluate(() => document.fonts.ready);
    await revealAndSettle(page);

    const metrics = await page.evaluate(() => ({
      title: document.title,
      pageHeight: document.documentElement.scrollHeight,
      pageWidth: document.documentElement.scrollWidth,
      textLength: document.body.innerText.trim().length,
      hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
    }));
    const height = Math.min(metrics.pageHeight, MAX_SHOT_HEIGHT);
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width: viewport.width, height } });

    return {
      ...metrics,
      viewportWidth: viewport.width,
      capturedHeight: height,
      truncated: metrics.pageHeight > MAX_SHOT_HEIGHT,
      horizontalOverflow: metrics.pageWidth > viewport.width,
      consoleErrors: consoleErrors.slice(0, 10),
      pageErrors: pageErrors.slice(0, 10),
      failedRequests: failedRequests.slice(0, 10),
      notes,
    };
  } finally {
    await context.close();
  }
}

export async function shoot(distDir, outDir) {
  mkdirSync(outDir, { recursive: true });
  const server = await serve(distDir);
  const browser = await chromium.launch();
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/`;
    const results = {};
    for (const viewport of VIEWPORTS) {
      const file = join(outDir, `${viewport.width}.png`);
      results[viewport.width] = { file, ...(await capture(browser, baseUrl, viewport, file)) };
    }
    return results;
  } finally {
    await browser.close();
    server.close();
  }
}
