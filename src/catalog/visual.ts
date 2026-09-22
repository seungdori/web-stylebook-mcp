// Load and verify the pinned, website-authored visual artifact once; no network fallback.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualContractSchema } from '../visual-canonical/schema.js';
import { stableVisualJson, visualContentHash } from '../visual-canonical/hash.js';
import { resolveContract } from '../visual-canonical/resolve.js';
import type { ResolvedVisualContract, VisualContract, VisualResolutionOptions } from '../visual-canonical/types.js';

export const VISUAL_SCHEMA = 'webstylebook.visual.v1';
export const VISUAL_LIBRARY_SCHEMA = 'webstylebook.visual-library.v1';
export interface VisualLibrary {
  schema: typeof VISUAL_LIBRARY_SCHEMA;
  catalogVersion: string;
  contentHash: string;
  contracts: Record<string, VisualContract>;
}
export interface VisualContractSelection extends VisualResolutionOptions { revision?: string }
export interface VisualSourceProvenance {
  schema: 'webstylebook.visual-source.v1';
  source: string;
  license: 'MIT';
  files: Record<string, string>;
  artifactHash: string;
}
const sha256 = (bytes: string | Buffer) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const generated = () => join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'generated');

export class VisualContractRepository {
  constructor(readonly library: VisualLibrary, readonly provenance?: VisualSourceProvenance) {
    if (library.schema !== VISUAL_LIBRARY_SCHEMA) throw new Error(`Unsupported visual library schema '${library.schema}'; expected '${VISUAL_LIBRARY_SCHEMA}'`);
    if (Object.keys(library).some((key) => !['schema', 'catalogVersion', 'contentHash', 'contracts'].includes(key))) throw new Error('Unsupported visual library envelope fields; install a compatible package');
    if (typeof library.catalogVersion !== 'string' || !library.catalogVersion || !library.contracts || typeof library.contracts !== 'object' || Array.isArray(library.contracts)) throw new Error('Malformed pinned visual library');
    const { contentHash, ...base } = library;
    if (contentHash !== sha256(stableVisualJson(base))) throw new Error('Pinned visual library contentHash mismatch; regenerate and synchronize the website artifact');
    for (const [styleId, contract] of Object.entries(library.contracts)) {
      const parsed = visualContractSchema.safeParse(contract);
      if (!parsed.success) throw new Error(`Invalid pinned visual contract '${styleId}': ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
      const { revision, ...authoredValues } = parsed.data;
      if (revision !== visualContentHash(authoredValues)) throw new Error(`Visual contract '${styleId}' has a stale revision`);
      if (parsed.data.styleId !== styleId) throw new Error(`Visual contract key '${styleId}' disagrees with styleId '${parsed.data.styleId}'`);
    }
  }

  static load(directory = generated()): VisualContractRepository {
    try {
      const raw = readFileSync(join(directory, 'visual-contracts.v1.json'));
      const provenance = JSON.parse(readFileSync(join(directory, 'visual-contract-source.v1.json'), 'utf8')) as VisualSourceProvenance;
      if (provenance.schema !== 'webstylebook.visual-source.v1' || provenance.license !== 'MIT' || provenance.artifactHash !== sha256(raw)) throw new Error('Visual artifact provenance or byte hash mismatch');
      return new VisualContractRepository(JSON.parse(raw.toString('utf8')) as VisualLibrary, provenance);
    } catch (error) {
      throw new Error(`Pinned visual contracts unavailable: ${error instanceof Error ? error.message : String(error)}. Install an intact package or run visual:sync from the approved website source. Runtime network fallback is disabled.`, { cause: error });
    }
  }

  get metadata() {
    return {
      schema: VISUAL_LIBRARY_SCHEMA,
      contractSchema: VISUAL_SCHEMA,
      catalogVersion: this.library.catalogVersion,
      contentHash: this.library.contentHash,
      styleCount: Object.keys(this.library.contracts).length,
      provenance: { source: this.provenance?.source ?? 'https://github.com/seungdori/web-stylebook', license: 'MIT' as const },
    };
  }

  authored(styleId: string): VisualContract {
    const contract = this.library.contracts[styleId];
    if (!contract) throw new Error(`No pinned visual contract for style '${styleId}'; update the package after the website artifact is published`);
    return contract;
  }

  resolve(styleId: string, options: VisualContractSelection = {}): ResolvedVisualContract {
    const contract = this.authored(styleId);
    if (options.revision !== undefined && options.revision !== contract.revision) throw new Error(`Visual revision '${options.revision}' is not bundled for '${styleId}'; available revision is '${contract.revision}'`);
    const { revision: _revision, ...resolution } = options;
    return resolveContract(contract, resolution);
  }
}
