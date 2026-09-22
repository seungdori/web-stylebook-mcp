// Run after npm run build. Timing is local observational evidence, not a CI wall-clock gate.
import { performance } from 'node:perf_hooks';
import { statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const began = performance.now();
const { CatalogRepository } = await import('../dist/catalog/repository.js');
const { composeDesignTokens } = await import('../dist/tokens/compile.js');
const repo = CatalogRepository.load();
const startupMs = performance.now() - began;
const input = { primaryStyleId: 'brutalist-grid', format: 'json', contract: { schema: 'webstylebook.visual.v1' } };
const firstBegan = performance.now();
composeDesignTokens(input, repo);
const firstContractCallMs = performance.now() - firstBegan;
const warmBegan = performance.now();
for (let i = 0; i < 250; i++) composeDesignTokens(input, repo);
const warmContractCallMs = (performance.now() - warmBegan) / 250;
const legacyBegan = performance.now();
for (let i = 0; i < 1000; i++) composeDesignTokens({ primaryStyleId: input.primaryStyleId, format: 'json' }, repo);
const warmLegacyCallMs = (performance.now() - legacyBegan) / 1000;
let maximum = { bytes: 0, styleId: '', locale: '' };
for (const style of repo.allStyles()) for (const locale of ['en', 'ko', 'ja']) {
  const result = composeDesignTokens({ ...input, primaryStyleId: style.id, locale }, repo);
  const bytes = Buffer.byteLength(JSON.stringify(result));
  if (bytes > maximum.bytes) maximum = { bytes, styleId: style.id, locale };
}
const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' }))[0];
const report = {
  schema: 'webstylebook.visual-benchmark.v1', runtime: process.version, platform: process.platform,
  catalogHash: repo.contentHash, visualHash: repo.visualContractMetadata.contentHash,
  startupMs, firstContractCallMs, warmContractCallMs, warmLegacyCallMs,
  measurement: 'composeDesignTokens return object; excludes MCP protocol text fallback/envelope',
  maximumSelectedComposedJsonResult: maximum,
  visualArtifactBytes: statSync(new URL('../generated/visual-contracts.v1.json', import.meta.url)).size,
  catalogBytes: statSync(new URL('../generated/catalog.v1.json', import.meta.url)).size,
  packageBytes: packed.size, packageUnpackedBytes: packed.unpackedSize,
  budgets: { selectedComposedJsonResultBytes: 48 * 1024, visualArtifactBytes: 1024 * 1024, packageBytes: 1536 * 1024 },
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (maximum.bytes > report.budgets.selectedComposedJsonResultBytes || report.visualArtifactBytes > report.budgets.visualArtifactBytes || report.packageBytes > report.budgets.packageBytes) process.exitCode = 1;
