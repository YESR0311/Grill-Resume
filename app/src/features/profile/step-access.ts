import "server-only";

import { getProfile } from "./store";
import { getEvaluationReport } from "@/features/evaluation/store";
import type { StepKey } from "@/components/profile/StepNav";

/**
 * 步骤可达性（design §6.1）。
 * 在 Server Component 内计算，将 reachableSteps 作 props 传给 StepNav 客户端组件，
 * 不在 StepNav 内做 async 查询。
 *
 * - intake: 永远可达
 * - profile: 需有姓名或至少一段经历
 * - evaluate: 档案已建立（name 或 experiences 非空）即可达——
 *   评估可对 experience 整体打标（不一定要先有 bullet），所以不应把
 *   "至少一条 bullet" 当作 evaluate 入口的硬条件。
 *   这同时保证"已能进 polish ⇒ evaluate 一定也可达"，否则会出现
 *   polish 页侧边栏显示"简历评估-未开放"的不一致现象。
 * - polish: 需评估报告非空且每条 item 都已处理完毕（无 pending/searching），
 *   done 或 failed 均可解锁——单条 LLM failed 不应锁死整个润色入口（P2-a）。
 *   失败条目在评估页仍以 EvalCard 可见，用户可知情后继续润色。
 */
export async function getReachableSteps(profileId: string): Promise<StepKey[]> {
  const reachable: StepKey[] = ["intake"];

  const profile = getProfile(profileId);
  if (!profile) return reachable;

  const hasProfile = profile.name.trim() !== "" || profile.experiences.length > 0;
  if (hasProfile) {
    reachable.push("profile");
    reachable.push("evaluate");
  }

  const report = await getEvaluationReport(profileId);
  const isPolishReady =
    report !== null &&
    report.items.length > 0 &&
    report.items.every((i) => i.status === "done" || i.status === "failed");
  if (isPolishReady) reachable.push("polish");

  return reachable;
}
