import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { synchronizeVisualContract, VISUAL_SOURCE_FILES } from '../scripts/sync-visual-contract.mjs';

// The website's src/utils/zod.ts at seungdori/web-stylebook a8515dd, byte for byte.
const WEBSITE_ZOD_WRAPPER = "import { z } from 'zod';\n\n// Public pages validate saved drafts under a CSP without unsafe-eval. Disable\n// Zod's JIT before creating schemas, including its dynamic-code capability probe.\nz.config({ jitless: true });\n\nexport { z };\n";

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

  it('copies a source that imports the website\'s jitless zod wrapper with the plain zod specifier, and records it', () => {
    const paths = fixture();
    mkdirSync(join(paths.source, 'src/utils'), { recursive: true });
    writeFileSync(join(paths.source, 'src/utils/zod.ts'), WEBSITE_ZOD_WRAPPER);
    const schema = "// SPDX-License-Identifier: MIT\nimport { z } from '../utils/zod';\nimport { COLOR_ROLES } from './types.js';\nexport const s = z.string();\n";
    writeFileSync(join(paths.source, 'src/visual/schema.ts'), schema);
    expect(synchronizeVisualContract(paths)).toBe(7);
    expect(readFileSync(join(paths.root, 'src/visual-canonical/schema.ts'), 'utf8')).toBe(schema.replace("'../utils/zod'", "'zod'"));
    const provenance = JSON.parse(readFileSync(join(paths.root, 'generated/visual-contract-source.v1.json'), 'utf8'));
    expect(provenance.files['src/visual/schema.ts']).toMatch(/^sha256:/);
    expect(provenance.files['src/utils/zod.ts']).toMatch(/^sha256:/);
    expect(provenance.rewrites.files).toEqual({ 'src/visual/schema.ts': "'../utils/zod' -> 'zod'" });
    expect(synchronizeVisualContract({ ...paths, check: true })).toBe(7);
  });

  it.each([
    ['a wrapper that does more than set jitless', WEBSITE_ZOD_WRAPPER.replace('export { z };', 'export { z };\nexport const extra = 1;')],
    ['a wrapper with another config', WEBSITE_ZOD_WRAPPER.replace('jitless: true', 'jitless: false')],
    ['no wrapper at all', null],
  ])('still rejects the wrapper import for %s', (_label, wrapper) => {
    const paths = fixture();
    if (wrapper !== null) {
      mkdirSync(join(paths.source, 'src/utils'), { recursive: true });
      writeFileSync(join(paths.source, 'src/utils/zod.ts'), wrapper);
    }
    writeFileSync(join(paths.source, 'src/visual/schema.ts'), "// SPDX-License-Identifier: MIT\nimport { z } from '../utils/zod';\n");
    expect(() => synchronizeVisualContract(paths)).toThrow(/allowlist/);
  });

  it('leaves provenance without rewrites when no source imports the wrapper', () => {
    const paths = fixture();
    mkdirSync(join(paths.source, 'src/utils'), { recursive: true });
    writeFileSync(join(paths.source, 'src/utils/zod.ts'), WEBSITE_ZOD_WRAPPER);
    synchronizeVisualContract(paths);
    const provenance = JSON.parse(readFileSync(join(paths.root, 'generated/visual-contract-source.v1.json'), 'utf8'));
    expect(provenance).not.toHaveProperty('rewrites');
    expect(provenance.files).not.toHaveProperty('src/utils/zod.ts');
  });
});
