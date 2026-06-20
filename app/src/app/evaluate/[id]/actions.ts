"use server";

import { runEvaluation } from "@/features/evaluation/engine";
import { saveEvaluationReport, getEvaluationReport } from "@/features/evaluation/store";
import { toUserMessage } from "@/features/ai/chat";

export async function runEvalAction(profileId: string): Promise<{ ok: boolean; error?: string }> {
  if (!profileId) return { ok: false, error: "档案无效" };
  try {
    const report = await runEvaluation(profileId);
    await saveEvaluationReport(report);
    return { ok: true };
  } catch (err) {
    console.error("runEvalAction failed:", err);
    return { ok: false, error: toUserMessage(err) };
  }
}

export async function getEvalReportAction(profileId: string) {
  return getEvaluationReport(profileId);
}