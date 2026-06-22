#!/usr/bin/env node
// CLI entry. Default action is stdio. stdout carries JSON-RPC only; everything
// human-readable goes to stderr (or stdout for explicit --version/info commands).

import { runStdio } from './server.js';
import { CatalogRepository } from './catalog/repository.js';
import { validateLoaded } from './catalog/validate.js';
import { SERVER_NAME, SERVER_VERSION, TOOL_NAMES } from './server-info.js';

const HELP = `${SERVER_NAME}-mcp v${SERVER_VERSION}
Usage: web-stylebook-mcp [options]

  (no args)            start the MCP server over stdio
  --stdio              same as no args
  --version            print version and exit
  --catalog-info       print catalog version, hash and counts
  --validate-catalog   validate the packaged catalog and exit (non-zero on failure)
  --help               this help
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const has = (f: string) => args.includes(f);

  if (has('--help') || has('-h')) { process.stdout.write(HELP); return; }
  if (has('--version')) { process.stdout.write(`${SERVER_VERSION}\n`); return; }

  if (has('--catalog-info')) {
    const r = CatalogRepository.load();
    process.stdout.write(`${JSON.stringify({
      server: SERVER_VERSION, catalogVersion: r.catalogVersion, contentHash: r.contentHash,
      tools: TOOL_NAMES, counts: validateLoaded(r).summary,
    }, null, 2)}\n`);
    return;
  }

  if (has('--validate-catalog')) {
    const report = validateLoaded(CatalogRepository.load());
    if (report.ok) {
      process.stderr.write(`[${SERVER_NAME}-mcp] catalog OK ${JSON.stringify(report.summary)}\n`);
    } else {
      process.stderr.write(`[${SERVER_NAME}-mcp] catalog INVALID:\n${report.errors.map((e) => `  - ${e}`).join('\n')}\n`);
      process.exit(1);
    }
    return;
  }

  const unknown = args.filter((a) => a.startsWith('-') && a !== '--stdio');
  if (unknown.length) {
    process.stderr.write(`unknown option(s): ${unknown.join(' ')}\n${HELP}`);
    process.exit(2);
  }

  await runStdio();
}

main().catch((err: unknown) => {
  process.stderr.write(`[${SERVER_NAME}-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
