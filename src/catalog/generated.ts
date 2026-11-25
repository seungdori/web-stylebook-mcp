import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url)); // dist/catalog in the package, src/catalog under tsx
/** generated/ at the package root: the synced snapshot in a checkout. The npm package ships only its small files there. */
export const GENERATED_DIR = join(here, '..', '..', 'generated');
/** The npm package ships the large snapshots brotli-compressed, byte for byte, in dist/generated (scripts/pack-generated.mjs). */
export const PACKED_DIR = join(here, '..', 'generated');

/**
 * The bytes of a generated file: the snapshot itself when it is there (a checkout), else its compressed copy (the npm
 * package). Both give the same bytes, so the content hashes checked on load do not depend on which one was read.
 */
export function readGenerated(name: string, dir = GENERATED_DIR, packedDir = PACKED_DIR): Buffer {
  const plain = join(dir, name);
  if (existsSync(plain)) return readFileSync(plain);
  const packed = join(packedDir, `${name}.br`);
  if (existsSync(packed)) return brotliDecompressSync(readFileSync(packed));
  return readFileSync(plain);
}
