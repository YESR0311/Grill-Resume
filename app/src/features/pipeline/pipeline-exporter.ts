import "server-only";

import { fitToSinglePage, type FitDecision } from "@/features/layout/adapter";
import { project as projectLayout } from "@/features/layout/project";
import { readLayoutOverrides } from "@/features/resume/storage";
import type { LayoutOverrides } from "@/features/layout/overrides";
import type { ResumeDocument } from "@/features/resume/types";
import type { EvaluationSummary, PipelineExportSnapshot } from "./types";

export type PipelineExportOptions = {
  evaluationSummary?: EvaluationSummary;
  singlePage?: boolean;
};

export function pipelineToExport(
  document: ResumeDocument,
  overrides?: LayoutOverrides | null,
  options?: PipelineExportOptions,
): Omit<PipelineExportSnapshot, "createdAt"> {
  const projection = projectLayout(document, overrides ?? undefined);
  let layoutSchema = projection.schema;
  let fitDecisions: FitDecision[] | undefined;
  if (options?.singlePage) {
    const fit = fitToSinglePage(projection.schema, options.evaluationSummary?.experienceRatings);
    layoutSchema = fit.schema;
    fitDecisions = fit.decisions;
  }
  return {
    layoutSchema,
    gapReport: projection.gap,
    readyForExport: projection.gap.missingBasics.length === 0 && layoutSchema.blocks.length > 1,
    ...(fitDecisions ? { fitDecisions } : {}),
  };
}

export async function buildPipelineExportSnapshot(input: {
  projectId: string;
  resumeId: string;
  document: ResumeDocument;
  options?: PipelineExportOptions;
}): Promise<PipelineExportSnapshot> {
  const overrides = await readLayoutOverrides(input.projectId, input.resumeId);
  return {
    ...pipelineToExport(input.document, overrides, input.options),
    createdAt: new Date().toISOString(),
  };
}
