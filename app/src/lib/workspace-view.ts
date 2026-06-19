/**
 * stage → 主区视图投影（design §2.1）。
 *
 * 唯一真相 = session.currentStage + 该 stage 的 status。前端不另设状态机，
 * 只做确定性投影。session 为 null 时是"未开始"入口态。
 */
import type { PipelineSession, PipelineStage, PipelineStageStatus } from "@/features/pipeline";

/** 主区要渲染的视图种类。 */
export type WorkspaceView =
  | "start" // 无 session，显示开始入口
  | "grill-chat" // grill in_progress：对话流 + 单题
  | "grill-gate" // grill awaiting_user：确认进入评估
  | "evaluate-running" // evaluate in_progress：执行中
  | "evaluate-report" // evaluate awaiting_user：评估报告 + gate
  | "polish" // polish in_progress/awaiting_user：候选对比
  | "export" // export 任意：预览 + 导出
  | "completed"; // session.completedAt：完成态

export type WorkspaceProjection = {
  view: WorkspaceView;
  stage: PipelineStage | null;
  status: PipelineStageStatus | null;
  /** 该 stage 的错误 code（若有），供文案展示。 */
  errorCode?: string;
};

/** 把 session 投影为主区视图。 */
export function projectWorkspaceView(session: PipelineSession | null): WorkspaceProjection {
  if (!session) {
    return { view: "start", stage: null, status: null };
  }

  if (session.completedAt) {
    return { view: "completed", stage: session.currentStage, status: "completed" };
  }

  const stage = session.currentStage;
  const state = session.stages[stage];
  const status = state.status;
  const errorCode = state.errorCode;

  switch (stage) {
    case "grill":
      return {
        view: status === "awaiting_user" ? "grill-gate" : "grill-chat",
        stage,
        status,
        errorCode,
      };
    case "evaluate":
      return {
        view: status === "awaiting_user" ? "evaluate-report" : "evaluate-running",
        stage,
        status,
        errorCode,
      };
    case "polish":
      return { view: "polish", stage, status, errorCode };
    case "export":
      return { view: "export", stage, status, errorCode };
  }
}
