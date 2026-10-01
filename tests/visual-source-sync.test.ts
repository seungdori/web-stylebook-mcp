import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { synchronizeVisualContract, VISUAL_SOURCE_FILES } from '../scripts/sync-visual-contract.mjs';

const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'webstylebook-source-sync-'));
  fixtures.push(root);
  const source = join(root, 'website');
  const target = join(root, 'mcp');
  mkdirSync(join(source, 'src/visual'), { recursive: true });
  mkdirSync(join(source, 'packages/mcp/generated'), { recursive: true });
  for (const file of VISUAL_SOURCE_FILES) writeFileSync(join(source, 'src/visual', file), '// SPDX-License-Identifier: MIT\n');
  writeFileSync(join(source, 'src/visual/resolve.ts'), "// SPDX-License-Identifier: MIT\nimport { HEAVY_CJK_FALLBACKS } from './fontSources.js';\n");
  writeFileSync(join(source, 'src/visual/LICENSE'), 'MIT License\n');
  writeFileSync(join(source, 'packages/mcp/generated/visual-contracts.v1.json'), '{}\n');
  return { root: target, source };
}

describe('portable visual source synchronization', () => {
  it('copies the heavy font metadata dependency and hashes it in provenance', () => {
    const paths = fixture();
    expect(synchronizeVisualContract(paths)).toBe(7);
    expect(readFileSync(join(paths.root, 'src/visual-canonical/fontSources.ts'))).toEqual(readFileSync(join(paths.source, 'src/visual/fontSources.ts')));
    const provenance = JSON.parse(readFileSync(join(paths.root, 'generated/visual-contract-source.v1.json'), 'utf8'));
    expect(provenance.files['src/visual/fontSources.ts']).toMatch(/^sha256:/);
    expect(synchronizeVisualContract({ ...paths, check: true })).toBe(7);
    writeFileSync(join(paths.root, 'src/visual-canonical/fontSources.ts'), 'stale metadata');
    expect(() => synchronizeVisualContract({ ...paths, check: true })).toThrow(/differs/);
  });

  it.each([
    "import './fontLoader.js';", "export * from '../site-only.js';", "import fs from 'node:fs';",
    "const helper = import('./fontLoader.js');", 'const helper = import(variable);', "const helper = require('node:fs');",
    "type Helper = import('./fontLoader.js').Helper;",
  ])('rejects an unapproved dependency before overwriting existing files: %s', (dependency) => {
    const paths = fixture();
    synchronizeVisualContract(paths);
    const target = join(paths.root, 'src/visual-canonical/types.ts');
    const before = readFileSync(target);
    writeFileSync(join(paths.source, 'src/visual/types.ts'), '// SPDX-License-Identifier: MIT\n// changed\n');
    writeFileSync(join(paths.source, 'src/visual/resolve.ts'), `// SPDX-License-Identifier: MIT\n${dependency}\n`);
    expect(() => synchronizeVisualContract(paths)).toThrow(/allowlist|nonliteral/);
    expect(readFileSync(target)).toEqual(before);
  });

  it('preflights the MIT declaration before any source is overwritten', () => {
    const paths = fixture();
    synchronizeVisualContract(paths);
    const target = join(paths.root, 'src/visual-canonical/types.ts');
    const before = readFileSync(target);
    writeFileSync(join(paths.source, 'src/visual/types.ts'), '// SPDX-License-Identifier: MIT\n// changed\n');
    writeFileSync(join(paths.source, 'src/visual/fontSources.ts'), '// missing license');
    expect(() => synchronizeVisualContract(paths)).toThrow(/MIT source declaration/);
    expect(readFileSync(target)).toEqual(before);
  });
});
