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
// start_ui_design: the whole MCP tool result (text fallback and structuredContent), for every style, page role, locale
// and product type, plus every page role, locale and product type with the top-ranked style.
const { startUiDesign, renderStartUiDesign, START_UI_DESIGN_BUDGET_BYTES } = await import('../dist/start/start-ui-design.js');
const { ok } = await import('../dist/protocol/result.js');
const { PAGE_ROLES } = await import('../dist/recommendation/page-roles.js');
const { PRODUCT_TYPES } = await import('../dist/types.js');
let startMaximum = { bytes: 0, styleId: '', pageRole: '', locale: '', productType: '' };
let startCalls = 0;
const startBegan = performance.now();
for (const styleId of [undefined, ...repo.allStyles().map((style) => style.id)]) {
  for (const pageRole of [undefined, ...PAGE_ROLES]) for (const locale of ['en', 'ko', 'ja']) for (const productType of PRODUCT_TYPES) {
    const result = startUiDesign({ productDescription: 'A page', productType, locale, ...(pageRole ? { pageRole } : {}), ...(styleId ? { styleId } : {}) }, repo);
    const bytes = Buffer.byteLength(JSON.stringify(ok(result, renderStartUiDesign(result))));
    startCalls++;
    if (bytes > startMaximum.bytes) startMaximum = { bytes, styleId: result.style.styleId, pageRole: pageRole ?? '', locale, productType };
  }
}
const startUiDesignMs = (performance.now() - startBegan) / startCalls;
const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' }))[0];
const report = {
  schema: 'webstylebook.visual-benchmark.v1', runtime: process.version, platform: process.platform,
  catalogHash: repo.contentHash, visualHash: repo.visualContractMetadata.contentHash,
  startupMs, firstContractCallMs, warmContractCallMs, warmLegacyCallMs,
  measurement: 'composeDesignTokens return object, excluding the MCP text fallback and envelope; start_ui_design whole MCP tool result',
  maximumSelectedComposedJsonResult: maximum,
  maximumStartUiDesignToolResult: { ...startMaximum, calls: startCalls, warmCallMs: startUiDesignMs },
  visualArtifactBytes: statSync(new URL('../generated/visual-contracts.v1.json', import.meta.url)).size,
  catalogBytes: statSync(new URL('../generated/catalog.v1.json', import.meta.url)).size,
  packageBytes: packed.size, packageUnpackedBytes: packed.unpackedSize,
  budgets: { selectedComposedJsonResultBytes: 48 * 1024, startUiDesignToolResultBytes: START_UI_DESIGN_BUDGET_BYTES, visualArtifactBytes: 1024 * 1024, packageBytes: 1536 * 1024 },
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (maximum.bytes > report.budgets.selectedComposedJsonResultBytes || startMaximum.bytes > report.budgets.startUiDesignToolResultBytes || report.visualArtifactBytes > report.budgets.visualArtifactBytes || report.packageBytes > report.budgets.packageBytes) process.exitCode = 1;
