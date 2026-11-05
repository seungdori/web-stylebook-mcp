import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// The README is short and points into docs/; keep every relative link and heading anchor alive.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = ['README.md', 'README.ko.md', 'docs/reference.md', 'docs/reference.ko.md', 'docs/demo/README.md', 'skills/web-stylebook-design/SKILL.md'];

const slug = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const anchors = (md: string) => new Set([...md.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1]!.replace(/`/g, ''))));
// Inline markdown links and images, skipping code fences.
const links = (md: string) => [...md.replace(/```[\s\S]*?```/g, '').matchAll(/\]\(<?([^)\s>]+)>?\)/g)].map((m) => m[1]!);

describe('documentation links', () => {
  for (const doc of DOCS) {
    it(`${doc}: relative links and anchors resolve`, () => {
      const text = readFileSync(join(root, doc), 'utf8');
      for (const href of links(text)) {
        if (/^(https?:|mailto:)/.test(href)) continue;
        const [path, anchor] = href.split('#');
        const target = path ? resolve(root, dirname(doc), path) : join(root, doc);
        expect(existsSync(target), `${doc} → ${href}`).toBe(true);
        if (anchor && target.endsWith('.md')) {
          expect(anchors(readFileSync(target, 'utf8')).has(decodeURIComponent(anchor)), `${doc} → ${href}`).toBe(true);
        }
      }
    });
  }

  it('the README leads with the before/after image and stays short', () => {
    for (const doc of ['README.md', 'README.ko.md']) {
      const text = readFileSync(join(root, doc), 'utf8');
      expect(text.indexOf('docs/demo/before-after.png'), doc).toBeGreaterThan(-1);
      expect(text.indexOf('docs/demo/before-after.png'), doc).toBeLessThan(text.indexOf('## '));
      expect(text.length, doc).toBeLessThan(8000);
      expect(text, doc).toContain('npx skills add seungdori/web-stylebook-mcp');
    }
  });
});
