// Writes the large generated snapshots, byte for byte, brotli-compressed into dist/generated for the npm package, which
// ships them in place of generated/*.json (package.json files). src/catalog/generated.ts reads either form.
// Runs in `npm run build` and `prepack`; a copy that already decompresses to the snapshot is left alone.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';

export const PACKED_FILES = ['catalog.v1.json', 'visual-contracts.v1.json'];

export function packGenerated(root = new URL('..', import.meta.url)) {
  mkdirSync(new URL('dist/generated/', root), { recursive: true });
  const written = [];
  for (const name of PACKED_FILES) {
    const source = readFileSync(new URL(`generated/${name}`, root));
    const target = new URL(`dist/generated/${name}.br`, root);
    if (existsSync(target) && brotliDecompressSync(readFileSync(target)).equals(source)) continue;
    writeFileSync(target, brotliCompressSync(source, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: source.length },
    }));
    written.push(fileURLToPath(target));
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of packGenerated()) process.stderr.write(`packed ${file}\n`);
}
