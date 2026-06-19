"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import {
  advanceStageInWorkspace,
  exportDocxInWorkspace,
} from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE } from "@/lib/workspace-action-state";
import { stageMessage } from "@/lib/stage-messages";
import type { PipelineSession } from "@/features/pipeline";
import type { DocxGapReport } from "@/features/export/gap-report";
import type { FitExplanationView } from "@/features/coach/fit-explanation-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FitPredictionCard } from "@/components/stages/FitPredictionCard";

/**
 * 导出预览视图（M3）。展示：
 *  - 单页 fit 适配报告（F4）
 *  - 内容缺口报告（missingBasics / bullet 统计）
 *  - 导出按钮（导出 docx-zh-clean）
 *  - 确认进入下一项目态
 */
export function ExportPreviewView({
  projectId,
  resumeId,
  session,
  gapReport,
  fitExplanation,
  latestExportId,
}: {
  projectId: string;
  resumeId: string;
  session: PipelineSession;
  gapReport: DocxGapReport;
  fitExplanation: FitExplanationView | null;
  latestExportId: string | null;
}) {
  const [exportState, exportAction, exportPending] = useActionState(
    exportDocxInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );
  const [advanceState, advanceAction, advancePending] = useActionState(
    advanceStageInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  const isComplete = Boolean(session.completedAt);
  const hasMissingBasics = gapReport.missingBasics.length > 0;
  const totalConfirmedBullets =
    gapReport.confirmedExperienceBullets + gapReport.confirmedProjectBullets;
  const layoutSchema = session.exportSnapshot?.layoutSchema;
  const fitDecisions = session.exportSnapshot?.fitDecisions;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">导出预览</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          确认排版与内容后导出中文 DOCX。
        </p>
      </div>

      <ScrollArea className="max-h-[55vh]">
        <div className="flex flex-col gap-5 pr-3">
          {/* 内容缺口报告 */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">内容概况</p>
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">确定事实</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {totalConfirmedBullets}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">经历</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {gapReport.confirmedExperienceBullets}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">项目</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {gapReport.confirmedProjectBullets}
                </p>
              </div>
            </div>

            {hasMissingBasics ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-300 text-amber-700">
                    待补全
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    以下基础信息缺失，建议返回补充：
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-amber-800">
                  {gapReport.missingBasics.join("、")}
                </p>
              </div>
            ) : null}
          </div>

          {/* 实时单页 fit 预测 */}
          {layoutSchema ? (
            <FitPredictionCard
              layoutSchema={layoutSchema}
              serverOverflow={Boolean(fitDecisions && fitDecisions.length > 0)}
              serverDecisions={fitDecisions?.length}
            />
          ) : null}

          {/* 单页适配报告 */}
          {fitExplanation ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">单页适配</p>
                {fitExplanation.hasAdaptation ? (
                  <Badge variant="secondary">已适配</Badge>
                ) : (
                  <Badge variant="outline">未裁剪</Badge>
                )}
              </div>

              {fitExplanation.hasAdaptation ? (
                <div className="flex gap-3 text-xs">
                  <p className="text-muted-foreground">
                    隐藏了 {fitExplanation.hiddenBlockTotal} 个板块
                  </p>
                  <p className="text-muted-foreground">
                    裁剪了 {fitExplanation.trimmedBulletTotal} 条要点
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  当前内容原本可在一页内排布，未触发裁剪。
                </p>
              )}

              {fitExplanation.items.length > 0 ? (
                <div className="mt-1 flex flex-col gap-1.5">
                  {fitExplanation.items.map((item) => (
                    <div
                      key={item.blockId}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs"
                    >
                      <span className="text-muted-foreground">{item.blockLabel}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {fitActionLabel(item.action)}
                        {item.action === "trim-bullets" && item.removedCount > 0
                          ? ` (-${item.removedCount})`
                          : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* 导出操作 */}
      <form
        action={exportAction}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <label className="flex items-start gap-2 rounded-xl border border-status-pending/40 bg-status-pending/10 p-3 text-xs leading-5">
          <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-0.5" />
          <span>
            我已确认：导出内容使用默认中文模板（简洁中文版），仅含已确认内容，不包含未确认草稿。
          </span>
        </label>
        <input type="hidden" name="partialMode" value="1" />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={exportPending}>
            {exportPending ? "导出中…" : "导出中文 DOCX"}
          </Button>
          {exportState.ts > 0 ? (
            <span
              className={cn("text-xs", exportState.ok ? "text-status-confirmed" : "text-destructive")}
            >
              {exportState.ok
                ? "已导出！可重复导出继续覆盖。"
                : stageMessage(exportState.code) ?? "导出失败。"}
            </span>
          ) : null}
        </div>
        {latestExportId ? (
          <a
            href={`/projects/${projectId}/resumes/${resumeId}/export/${latestExportId}/download`}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            下载最近导出的 DOCX
          </a>
        ) : null}
      </form>

      {/* 完成门 */}
      {exportState.ok ? (
        <form action={advanceAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">导出完成{isComplete ? "" : "（可跳过）"}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                确认后标记项目完成。
              </p>
            </div>
            <Badge variant="secondary">导出可用</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline" disabled={advancePending}>
              {advancePending ? "确认中…" : isComplete ? "已完成" : "确认完成"}
            </Button>
            {advanceState.ts > 0 ? (
              <span className={cn("text-xs", advanceState.ok ? "text-status-confirmed" : "text-destructive")}>
                {advanceState.ok ? "已完成" : stageMessage(advanceState.code) ?? "确认失败。"}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function fitActionLabel(action: string): string {
  switch (action) {
    case "hide-block":
      return "隐藏";
    case "trim-bullets":
      return "裁剪";
    default:
      return action;
  }
}