"use server";

import { runEvaluation } from "@/features/evaluation/engine";
import { saveEvaluationReport, getEvaluationReport } from "@/features/evaluation/store";

export async function runEvalAction(profileId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const report = await runEvaluation(profileId);
    await saveEvaluationReport(report);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getEvalReportAction(profileId: string) {
  return getEvaluationReport(profileId);
}