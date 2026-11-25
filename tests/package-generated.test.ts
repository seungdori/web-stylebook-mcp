// The npm package ships generated/catalog.v1.json and visual-contracts.v1.json brotli-compressed in dist/generated
// (scripts/pack-generated.mjs); the loaders read the snapshot in a checkout and the compressed copy in the package.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { readGenerated } from '../src/catalog/generated.js';
import { PACKED_FILES } from '../scripts/pack-generated.mjs';

const root = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { files: string[]; scripts: Record<string, string> };

describe('generated data in the npm package', () => {
  it('ships every generated file, either as it is or compressed', () => {
    for (const name of readdirSync(new URL('generated/', root))) {
      const plain = pkg.files.includes(`generated/${name}`);
      expect(plain !== PACKED_FILES.includes(name), `${name} must ship exactly one way`).toBe(true);
    }
    expect(pkg.files).not.toContain('generated');
    expect(pkg.scripts.build).toContain('scripts/pack-generated.mjs');
    expect(pkg.scripts.prepack).toContain('scripts/pack-generated.mjs');
  });

  it('reads the compressed copy byte for byte when the snapshot is not there, and prefers the snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'generated-'));
    const packed = mkdtempSync(join(tmpdir(), 'packed-'));
    try {
      const bytes = readFileSync(new URL('generated/visual-contracts.v1.json', root));
      writeFileSync(join(packed, 'visual-contracts.v1.json.br'), brotliCompressSync(bytes));
      expect(readGenerated('visual-contracts.v1.json', dir, packed).equals(bytes)).toBe(true);
      writeFileSync(join(dir, 'visual-contracts.v1.json'), '{"snapshot":true}');
      expect(readGenerated('visual-contracts.v1.json', dir, packed).toString()).toBe('{"snapshot":true}');
      expect(() => readGenerated('catalog.v1.json', dir, packed)).toThrow(/ENOENT/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(packed, { recursive: true, force: true });
    }
  });
});
