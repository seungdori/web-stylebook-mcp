import { z } from 'zod';
import { UX_SURFACES } from '../types.js';

const id = z.string().trim().min(1).max(160);
const explanation = z.string().trim().min(1).max(2000);
// References are supplied by the host. This validates their shape, never their existence.
export const artifactReference = z.string().trim().min(1).max(2048).refine(
  (value) => !/[\x00-\x1f\x7f]/.test(value) && (/^(?:https?:\/\/|artifact:\/\/|\/|\.\.?\/)/.test(value) || /^[A-Za-z]:[\\/]/.test(value)),
  'use a file path or an http(s)/artifact URL, not executable content',
);

export const captureConditionsSchema = z.object({
  viewport: z.object({ width: z.number().int().min(1).max(10000), height: z.number().int().min(1).max(10000) }).strict(),
  theme: z.string().trim().min(1).max(100),
  locale: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(300),
  dataKey: z.string().trim().min(1).max(300).describe('Same input dataset/fixture and clock, not a claim about current production data'),
  scrollAnchor: z.string().trim().min(1).max(300).describe('Semantic location, e.g. first project or final response; pixel offsets may differ after layout changes'),
  zoom: z.number().min(0.1).max(10),
  deviceScaleFactor: z.number().min(0.5).max(8),
}).strict();

export const improvementContextSchema = z.object({
  userTask: explanation,
  constraints: z.array(explanation).max(20).optional(),
  targets: z.array(z.object({
    id, surface: z.enum(UX_SURFACES), route: z.string().trim().min(1).max(500),
    conditions: captureConditionsSchema,
  }).strict()).min(1).max(12),
}).strict();

export const IMPROVEMENT_CHECKS = ['visual', 'behavior', 'preservation', 'accessibility'] as const;
export const improvementSubmissionSchema = z.object({
  captures: z.array(z.object({
    id, targetId: id, phase: z.enum(['before', 'after']),
    screenshotRef: artifactReference,
    structureRef: artifactReference.optional().describe('Rendered HTML or native semantic/UI hierarchy inventory'),
    stylesRef: artifactReference.optional(),
    sourceRef: explanation.describe('Source/build identity; distinguish the immutable baseline from the edited source'),
    conditions: captureConditionsSchema,
    fontsReady: z.boolean(),
  }).strict()).max(48),
  changes: z.array(z.object({
    id, targetIds: z.array(id).min(1).max(12),
    foundationIds: z.array(id).min(1).max(12),
    observation: explanation, action: explanation, reason: explanation,
    status: z.enum(['implemented', 'proposed', 'reverted']),
    files: z.array(artifactReference).max(40),
    diffRef: artifactReference.optional(),
  }).strict()).max(40),
  checks: z.array(z.object({
    id, targetId: id, kind: z.enum([...IMPROVEMENT_CHECKS, 'build']),
    verdict: z.enum(['pass', 'fail', 'not-verified', 'not-applicable']),
    summary: explanation,
    captureIds: z.array(id).max(48),
    evidenceRefs: z.array(artifactReference).max(20),
    steps: z.array(explanation).max(20).optional().describe('Observed interaction/accessibility procedure, not a proposed test'),
  }).strict()).max(120),
  outcomes: z.array(z.object({
    targetId: id, outcome: z.enum(['improved', 'unchanged', 'regressed', 'not-verified']),
    beforeCaptureId: id.optional(), afterCaptureId: id.optional(),
    changeIds: z.array(id).max(40),
    summary: explanation, tradeoffs: z.array(explanation).max(12),
  }).strict()).max(12),
  limitations: z.array(explanation).max(20),
}).strict();

export type ImprovementContext = z.infer<typeof improvementContextSchema>;
export type ImprovementSubmission = z.infer<typeof improvementSubmissionSchema>;
export type ImprovementCheck = ImprovementSubmission['checks'][number];
