// The website authors the specification and resolver. This command copies an
// explicit MIT-only source allowlist; never scrape or resolve missing files online.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const source = resolve(process.argv.find((arg, i) => i > 1 && !arg.startsWith('--')) ?? process.env.WEB_STYLEBOOK_SOURCE_ROOT ?? join(root, '..', 'showcase'));
const files = ['types.ts', 'hash.ts', 'schema.ts', 'resolve.ts', 'contrast.ts', 'export.ts'];
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const sourceHashes = {};
const writeOrCheck = (destination, bytes) => {
  if (check) {
    if (!readFileSync(destination).equals(Buffer.from(bytes))) throw new Error(`${destination} differs; run npm run visual:sync -- ${source}`);
  } else {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }
};
try {
  for (const file of files) {
    const name = `src/visual/${file}`;
    const bytes = readFileSync(join(source, name));
    if (!bytes.toString('utf8').includes('SPDX-License-Identifier: MIT')) throw new Error(`${name} is missing the MIT source declaration`);
    sourceHashes[name] = sha256(bytes);
    writeOrCheck(join(root, 'src', 'visual-canonical', file), bytes);
  }
  const license = readFileSync(join(source, 'src/visual/LICENSE'));
  if (!license.toString('utf8').includes('MIT License')) throw new Error('Shared visual source license must be MIT');
  sourceHashes['src/visual/LICENSE'] = sha256(license);
  writeOrCheck(join(root, 'generated', 'visual-contract-LICENSE'), license);
  const artifact = readFileSync(join(source, 'packages/mcp/generated/visual-contracts.v1.json'));
  writeOrCheck(join(root, 'generated', 'visual-contracts.v1.json'), artifact);
  const provenance = {
    schema: 'webstylebook.visual-source.v1',
    source: 'https://github.com/seungdori/web-stylebook',
    license: 'MIT',
    policy: 'Generated source copy. Edit the website source, regenerate its artifact, then run visual:sync. No site UI, font files, images, or third-party reference content is included.',
    files: sourceHashes,
    artifactHash: sha256(artifact),
  };
  writeOrCheck(join(root, 'generated', 'visual-contract-source.v1.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  process.stderr.write(`[visual-contract] ${check ? 'verified' : 'synchronized'} ${files.length} portable MIT sources and pinned artifact\n`);
} catch (error) {
  process.stderr.write(`[visual-contract] ${error.message}\n`);
  process.exitCode = 1;
}
