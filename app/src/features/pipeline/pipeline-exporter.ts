import "server-only";

import { project as projectLayout } from "@/features/layout/project";
import { readLayoutOverrides } from "@/features/resume/storage";
import type { LayoutOverrides } from "@/features/layout/overrides";
import type { ResumeDocument } from "@/features/resume/types";
import type { PipelineExportSnapshot } from "./types";

export function pipelineToExport(
  document: ResumeDocument,
  overrides?: LayoutOverrides,
): Omit<PipelineExportSnapshot, "createdAt"> {
  const projection = projectLayout(document, overrides);
  return {
    layoutSchema: projection.schema,
    gapReport: projection.gap,
    readyForExport: projection.gap.missingBasics.length === 0 && projection.schema.blocks.length > 1,
  };
}

export async function buildPipelineExportSnapshot(input: {
  projectId: string;
  resumeId: string;
  document: ResumeDocument;
}): Promise<PipelineExportSnapshot> {
  const overrides = await readLayoutOverrides(input.projectId, input.resumeId);
  return {
    ...pipelineToExport(input.document, overrides ?? undefined),
    createdAt: new Date().toISOString(),
  };
}
