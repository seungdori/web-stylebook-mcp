import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundledDir = join(packageRoot, 'generated');
const requestedDir = process.argv[2]
  ?? process.env.WEB_STYLEBOOK_CANONICAL_CATALOG_DIR
  ?? join(packageRoot, '..', 'showcase', 'packages', 'mcp', 'generated');
const canonicalDir = isAbsolute(requestedDir) ? requestedDir : resolve(process.cwd(), requestedDir);
const files = ['catalog.v1.json', 'manifest.v1.json'];

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

let mismatch = false;
for (const file of files) {
  let canonical;
  let bundled;
  try {
    canonical = readFileSync(join(canonicalDir, file));
    bundled = readFileSync(join(bundledDir, file));
  } catch (error) {
    console.error(`[catalog-source] ${error.message}`);
    process.exit(2);
  }
  if (!canonical.equals(bundled)) {
    mismatch = true;
    console.error(
      `[catalog-source] ${file} differs`
      + `\n  canonical ${digest(canonical)}`
      + `\n  bundled   ${digest(bundled)}`,
    );
  }
}

if (mismatch) {
  console.error('\nRegenerate the canonical snapshot, then copy both generated files together.');
  process.exit(1);
}

console.error(`[catalog-source] bundled catalog matches ${canonicalDir}`);
