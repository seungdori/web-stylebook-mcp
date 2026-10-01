// The website authors the specification and resolver. This command copies an
// explicit MIT-only source allowlist; never scrape or resolve missing files online.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const VISUAL_SOURCE_FILES = ['types.ts', 'hash.ts', 'schema.ts', 'resolve.ts', 'contrast.ts', 'export.ts', 'fontSources.ts'];
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function validateDependencies(file, bytes) {
  const source = ts.createSourceFile(file, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  function validate(specifier) {
    const dependency = /^\.\/([\w-]+)\.js$/.exec(specifier)?.[1];
    if (specifier !== 'zod' && (!dependency || !VISUAL_SOURCE_FILES.includes(`${dependency}.ts`))) {
      throw new Error(`src/visual/${file} imports '${specifier}' outside the portable source/dependency allowlist`);
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      validate(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      validate(node.moduleReference.expression.text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      validate(node.argument.literal.text);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
      const argument = node.arguments[0];
      if (!argument || !ts.isStringLiteral(argument)) throw new Error(`src/visual/${file} has a nonliteral module dependency`);
      validate(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

export function synchronizeVisualContract({ root, source, check = false }) {
  const sourceHashes = {};
  const outputs = [];
  // Preflight the entire dependency closure and license boundary before writing
  // anything, so a newly added browser helper cannot leave a broken partial copy.
  for (const file of VISUAL_SOURCE_FILES) {
    const name = `src/visual/${file}`;
    const bytes = readFileSync(join(source, name));
    if (!bytes.toString('utf8').includes('SPDX-License-Identifier: MIT')) throw new Error(`${name} is missing the MIT source declaration`);
    validateDependencies(file, bytes);
    sourceHashes[name] = sha256(bytes);
    outputs.push([join(root, 'src', 'visual-canonical', file), bytes]);
  }
  const license = readFileSync(join(source, 'src/visual/LICENSE'));
  if (!license.toString('utf8').includes('MIT License')) throw new Error('Shared visual source license must be MIT');
  sourceHashes['src/visual/LICENSE'] = sha256(license);
  outputs.push([join(root, 'generated', 'visual-contract-LICENSE'), license]);
  const artifact = readFileSync(join(source, 'packages/mcp/generated/visual-contracts.v1.json'));
  outputs.push([join(root, 'generated', 'visual-contracts.v1.json'), artifact]);
  const provenance = {
    schema: 'webstylebook.visual-source.v1',
    source: 'https://github.com/seungdori/web-stylebook',
    license: 'MIT',
    policy: 'Generated source copy. Edit the website source, regenerate its artifact, then run visual:sync. No site UI, font files, images, or third-party reference content is included.',
    files: sourceHashes,
    artifactHash: sha256(artifact),
  };
  outputs.push([join(root, 'generated', 'visual-contract-source.v1.json'), Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`)]);
  for (const [destination, bytes] of outputs) {
    if (check) {
      if (!readFileSync(destination).equals(bytes)) throw new Error(`${destination} differs; run npm run visual:sync -- ${source}`);
    } else {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, bytes);
    }
  }
  return VISUAL_SOURCE_FILES.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const check = process.argv.includes('--check');
  const source = resolve(process.argv.find((arg, i) => i > 1 && !arg.startsWith('--')) ?? process.env.WEB_STYLEBOOK_SOURCE_ROOT ?? join(root, '..', 'showcase'));
  try {
    const count = synchronizeVisualContract({ root, source, check });
    process.stderr.write(`[visual-contract] ${check ? 'verified' : 'synchronized'} ${count} portable MIT sources and pinned artifact\n`);
  } catch (error) {
    process.stderr.write(`[visual-contract] ${error.message}\n`);
    process.exitCode = 1;
  }
}
