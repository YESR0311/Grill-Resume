"use server";

import { revalidatePath } from "next/cache";
import { runEvaluationSession, evaluateOneItem } from "@/features/evaluation/engine";
import { getEvaluationReport } from "@/features/evaluation/store";
import { type EvaluationItem } from "@/features/evaluation/types";
import { actionError, actionSuccess, type ActionResult } from "@/lib/server-action";

/**
 * Phase 1：开始评估会话——1 次联网研究，返回 bulletIds + searchContext（design §4.2）。
 */
export async function runEvaluationSessionAction(
  profileId: string,
): Promise<ActionResult<{ bulletIds: string[]; searchContext: string }>> {
  if (!profileId) return { ok: false, error: "档案无效" };
  try {
    const { bulletIds, searchContext } = await runEvaluationSession(profileId);
    revalidatePath(`/evaluate/${profileId}`);
    return actionSuccess({ bulletIds, searchContext });
  } catch (err) {
    console.error("runEvaluationSessionAction failed:", err);
    return actionError(err);
  }
}

/**
 * Phase 2：逐条评估单个 bullet，复用 searchContext，写规范化表，返回单 item（design §4.2）。
 */
export async function evaluateOneItemAction(
  profileId: string,
  bulletId: string,
  searchContext: string,
): Promise<ActionResult<EvaluationItem>> {
  if (!profileId || !bulletId) return { ok: false, error: "参数无效" };
  try {
    const item = await evaluateOneItem(profileId, bulletId, searchContext);
    return actionSuccess(item);
  } catch (err) {
    console.error("evaluateOneItemAction failed:", err);
    return actionError(err);
  }
}

export async function getEvalReportAction(profileId: string) {
  return getEvaluationReport(profileId);
}
