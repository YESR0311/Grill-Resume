"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import {
  advanceStageInWorkspace,
  confirmEgressInWorkspace,
  retryStageInWorkspace,
} from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE } from "@/lib/workspace-action-state";
import { stageMessage, advanceLabel } from "@/lib/stage-messages";
import type { PipelineSession, PipelineStage } from "@/features/pipeline";
import { Button } from "@/components/ui/button";

/**
 * 阶段门（M3）。处理两个子态：
 *  - egress：渲染 EgressPlan items 勾选框 + 隐私确认 + 推进
 *  - confirm：纯确认推进（如 grill→evaluate 的"问答完成"门）
 *
 * 设计 §2.1 stage gate：用户确认后才从 awaiting_user 进入下一阶段。
 * 中途不改 pipeline session 的其他状态（不进后台编排）。
 */
export function StageGate({
  projectId,
  resumeId,
  session,
}: {
  projectId: string;
  resumeId: string;
  session: PipelineSession;
}) {
  const stage = session.currentStage;
  const state = session.stages[stage];

  const [egressState, egressAction, egressPending] = useActionState(
    confirmEgressInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );
  const [advanceState, advanceAction, advancePending] = useActionState(
    advanceStageInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );
  const [retryState, retryAction, retryPending] = useActionState(
    retryStageInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  const hasEgressItems = session.egressPlan.items.some((item) => item.stage === stage);
  const isEgressPending =
    state.errorCode === "egress_pending" ||
    (hasEgressItems && !session.egressPlan.userConfirmedAt);

  if (state.status === "failed") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
        <p className="font-medium text-destructive">阶段执行失败</p>
        {state.errorCode ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {stageMessage(state.errorCode)}
          </p>
        ) : null}
        <form action={retryAction} className="mt-3">
          <Button type="submit" variant="outline" disabled={retryPending}>
            {retryPending ? "重试中…" : "重试"}
          </Button>
          {retryState.ts > 0 && !retryState.ok ? (
            <span className="ml-3 text-xs text-destructive">{stageMessage(retryState.code)}</span>
          ) : null}
        </form>
      </div>
    );
  }

  // egress 确认态：展示外发项勾选
  if (isEgressPending) {
    const stageItems = session.egressPlan.items.filter((item) => item.stage === stage);
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h3 className="text-base font-semibold">隐私与外发数据确认</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            以下数据将发送给外部服务（AI 模型或搜索服务）。请逐项确认。
          </p>
        </div>

        <form action={egressAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {stageItems.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm"
              >
                <input
                  name="egressItemId"
                  value={item.id}
                  type="checkbox"
                  className="mt-0.5"
                  defaultChecked={Boolean(item.userConfirmedAt)}
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.description}</span>
                    {item.action ? (
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {item.action}
                      </span>
                    ) : null}
                  </div>
                  {item.dataPreview ? (
                    <p className="text-xs text-muted-foreground">
                      包含：{item.dataPreview}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    使用 {item.provider} 处理
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={egressPending}>
              {egressPending ? "确认中…" : advanceLabel(stage)}
            </Button>
            {egressState.ts > 0 ? (
              <span
                className={cn(
                  "text-xs",
                  egressState.ok ? "text-status-confirmed" : "text-destructive",
                )}
              >
                {egressState.ok
                  ? "已确认，正在进入下一阶段…"
                  : stageMessage(egressState.code) ?? "确认失败。"}
              </span>
            ) : null}
          </div>
        </form>
      </div>
    );
  }

  // 纯确认推进门（无 egress items，如 grill→evaluate 或 evaluate→polish 的中间门）
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold">阶段完成，确认继续</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {advanceDescription(stage)}
        </p>
      </div>
      <form action={advanceAction}>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={advancePending}>
            {advancePending ? "推进中…" : advanceLabel(stage)}
          </Button>
          {advanceState.ts > 0 ? (
            <span
              className={cn(
                "text-xs",
                advanceState.ok ? "text-status-confirmed" : "text-destructive",
              )}
            >
              {advanceState.ok
                ? "已推进到下一阶段"
                : stageMessage(advanceState.code) ?? "推进失败。"}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function advanceDescription(stage: PipelineStage): string {
  switch (stage) {
    case "grill":
      return "问答已完成，确认后进入 AI 联网评估阶段。";
    case "evaluate":
      return "评估已完成，确认后进入 bullet 润色阶段。";
    case "polish":
      return "润色已完成，确认后进入导出预览阶段。";
    case "export":
      return "导出已完成，确认后可下载简历。";
  }
}