"use server";

import { revalidatePath } from "next/cache";
import { runEvaluationSession, evaluateOneUnit } from "@/features/evaluation/engine";
import { getEvaluationReport } from "@/features/evaluation/store";
import { type EvaluationItem, type EvalUnit } from "@/features/evaluation/types";
import { actionError, actionSuccess, type ActionResult } from "@/lib/server-action";

/**
 * Phase 1：开始评估会话——1 次联网研究，返回 units + searchContext（每个档案条目为整体）。
 */
export async function runEvaluationSessionAction(
  profileId: string,
): Promise<ActionResult<{ units: EvalUnit[]; searchContext: string }>> {
  if (!profileId) return { ok: false, error: "档案无效" };
  try {
    const { units, searchContext } = await runEvaluationSession(profileId);
    revalidatePath(`/evaluate/${profileId}`);
    return actionSuccess({ units, searchContext });
  } catch (err) {
    console.error("runEvaluationSessionAction failed:", err);
    return actionError(err);
  }
}

/**
 * Phase 2：逐单元评估单个条目（经历/项目/技能/教育），复用 searchContext。
 */
export async function evaluateOneUnitAction(
  profileId: string,
  unit: EvalUnit,
  searchContext: string,
): Promise<ActionResult<EvaluationItem>> {
  if (!profileId || !unit) return { ok: false, error: "参数无效" };
  try {
    const item = await evaluateOneUnit(profileId, unit, searchContext);
    return actionSuccess(item);
  } catch (err) {
    console.error("evaluateOneUnitAction failed:", err);
    return actionError(err);
  }
}

export async function getEvalReportAction(profileId: string) {
  return getEvaluationReport(profileId);
}
