import type { ResumeImportStage } from "../../lib/resume-import";

export const IMPORT_STAGE_SEQUENCE: ResumeImportStage[] = [
  "validating",
  "extracting",
  "rendering",
  "parsing",
  "saving",
];

export const IMPORT_STAGE_PROGRESS_RANGES: Record<
  ResumeImportStage,
  { start: number; end: number }
> = {
  validating: { start: 0, end: 12 },
  extracting: { start: 12, end: 44 },
  rendering: { start: 44, end: 72 },
  parsing: { start: 72, end: 90 },
  saving: { start: 90, end: 100 },
};

export function calculateImportProgressPercent(
  progress: { stage: ResumeImportStage; completed: number; total: number } | null
): number {
  if (!progress) {
    return 0;
  }

  const range = IMPORT_STAGE_PROGRESS_RANGES[progress.stage];
  const total = progress.total > 0 ? progress.total : 1;
  const ratio = Math.max(0, Math.min(progress.completed / total, 1));

  return Math.round(range.start + (range.end - range.start) * ratio);
}

export function getImportStageStatus(
  currentStage: ResumeImportStage,
  stage: ResumeImportStage,
): "completed" | "current" | "pending" {
  const currentIndex = IMPORT_STAGE_SEQUENCE.indexOf(currentStage);
  const stageIndex = IMPORT_STAGE_SEQUENCE.indexOf(stage);

  if (stageIndex < currentIndex) {
    return "completed";
  }

  if (stageIndex === currentIndex) {
    return "current";
  }

  return "pending";
}
