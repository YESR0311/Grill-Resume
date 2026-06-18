import { z } from "zod";
import type { DocxGapReport } from "@/features/export/gap-report";
import type { FitDecision } from "@/features/layout/adapter";
import type { LayoutSchema } from "@/features/layout/schema";

export const PIPELINE_STAGES = ["grill", "evaluate", "polish", "export"] as const;

export const pipelineStageSchema = z.enum(PIPELINE_STAGES);

export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const PIPELINE_STAGE_STATUSES = [
  "not_started",
  "in_progress",
  "awaiting_user",
  "completed",
  "failed",
] as const;

export const pipelineStageStatusSchema = z.enum(PIPELINE_STAGE_STATUSES);

export type PipelineStageStatus = z.infer<typeof pipelineStageStatusSchema>;

export type StageStatus = PipelineStageStatus;

export const GRILL_SUB_STAGES = ["intake", "deep-dive"] as const;

export type GrillSubStage = (typeof GRILL_SUB_STAGES)[number];

export const pipelineStageStateSchema = z.object({
  status: pipelineStageStatusSchema,
  enteredAt: z.string().optional(),
  completedAt: z.string().optional(),
  failedAt: z.string().optional(),
  errorCode: z.string().optional(),
  resultRef: z.string().optional(),
  subStage: z.string().optional(),
});

export type PipelineStageState = z.infer<typeof pipelineStageStateSchema>;

export const egressItemSchema = z.object({
  id: z.string(),
  stage: pipelineStageSchema,
  action: z.string().optional(),
  provider: z.string(),
  description: z.string(),
  dataPreview: z.string().optional(),
  userConfirmedAt: z.string().optional(),
});

export type EgressItem = z.infer<typeof egressItemSchema>;

export type EgressPlanItem = EgressItem;

export const egressPlanSchema = z.object({
  items: z.array(egressItemSchema),
  userConfirmedAt: z.string().optional(),
  allConfirmedAt: z.string().optional(),
  autoAdvance: z.boolean(),
});

export type EgressPlan = z.infer<typeof egressPlanSchema>;

export const pipelineCheckpointSchema = z.object({
  stageFrom: pipelineStageSchema.optional(),
  stageTo: pipelineStageSchema,
  timestamp: z.string(),
  summary: z.string(),
});

export type PipelineCheckpoint = z.infer<typeof pipelineCheckpointSchema>;

export const pipelineExportSnapshotSchema = z.object({
  createdAt: z.string(),
  layoutSchema: z.custom<LayoutSchema>((value) => Boolean(value && typeof value === "object")),
  gapReport: z.custom<DocxGapReport>((value) => Boolean(value && typeof value === "object")),
  readyForExport: z.boolean(),
  fitDecisions: z.custom<FitDecision[]>((value) => Array.isArray(value)).optional(),
});

export type PipelineExportSnapshot = z.infer<typeof pipelineExportSnapshotSchema>;

export const autoAdvanceConfigSchema = z.object({
  enabled: z.boolean(),
  throttleMs: z.number().int().nonnegative().optional(),
});

export type AutoAdvanceConfig = z.infer<typeof autoAdvanceConfigSchema>;

export const experienceValueRatingSchema = z.object({
  experienceId: z.string(),
  score: z.number().int().min(0).max(100),
  tier: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
  searchCitations: z.array(z.string()),
});

export type ExperienceValueRating = z.infer<typeof experienceValueRatingSchema>;

export const evaluationSummarySchema = z.object({
  schemaVersion: z.literal("eval-summary-v1"),
  reportId: z.string(),
  createdAt: z.string(),
  experienceRatings: z.array(experienceValueRatingSchema),
  jdMatchScore: z.number().int().min(0).max(100).optional(),
  uncoveredKeywords: z.array(z.string()),
});

export type EvaluationSummary = z.infer<typeof evaluationSummarySchema>;

export const pipelineSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  resumeId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  autoAdvance: z.boolean(),
  egressPlan: egressPlanSchema,
  stages: z.record(pipelineStageSchema, pipelineStageStateSchema),
  currentStage: pipelineStageSchema,
  checkpoints: z.array(pipelineCheckpointSchema),
  exportSnapshot: pipelineExportSnapshotSchema.optional(),
  evaluationSummary: evaluationSummarySchema.optional(),
  completedAt: z.string().optional(),
});

export type PipelineSession = z.infer<typeof pipelineSessionSchema>;
