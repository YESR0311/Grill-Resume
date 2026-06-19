"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/utils";
import {
  advanceStageInWorkspace,
  applyPolishInWorkspace,
  discardPolishInWorkspace,
} from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE } from "@/lib/workspace-action-state";
import { stageMessage } from "@/lib/stage-messages";
import { diffText } from "@/features/polish/diff";
import { toneLabel } from "@/features/polish/tone";
import type { PolishRun } from "@/features/polish/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * 润色候选对比视图（M3）。展示所有 PolishRun，每条含：
 *  - 原文 vs 三个候选的 diff 对比
 *  - 选择候选 → applyPolishInWorkspace
 *  - 全部处理完后显示"确认进入导出"门
 */
export function PolishCandidatesView({
  projectId,
  resumeId,
  runs,
  stageStatus,
}: {
  projectId: string;
  resumeId: string;
  runs: PolishRun[];
  /** 从 page.tsx 传入的阶段状态，区别 "生成中" 与 "等待用户"。 */
  stageStatus?: "not_started" | "in_progress" | "awaiting_user" | "completed" | "failed";
}) {
  const [advanceState, advanceAction, advancePending] = useActionState(
    advanceStageInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  const allResolved = runs.every((run) =>
    run.candidates.every((c) => c.status !== "ready"),
  );

  // 生成中：runs 为空且阶段仍在 in_progress，非 awaiting_user（无候选）。
  const isGenerating = runs.length === 0 && stageStatus === "in_progress";

  if (isGenerating) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="font-medium">AI 正在生成润色候选…</p>
        <p className="text-xs leading-5 text-muted-foreground">
          正在为每条 confirmed bullet 生成三种语气（保守/平衡/激进）的候选。生成完成后将显示。
        </p>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          暂无需要润色的 bullet。确认可跳过此阶段。
        </p>
        <form action={advanceAction}>
          <Button type="submit" disabled={advancePending}>
            {advancePending ? "推进中…" : "跳过润色，进入导出"}
          </Button>
          {advanceState.ts > 0 && !advanceState.ok ? (
            <span className="ml-3 text-xs text-destructive">{stageMessage(advanceState.code)}</span>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">润色候选</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          每条 bullet 有 3 个候选（保守/平衡/激进）。点击选择后确认应用。
        </p>
      </div>

      <ScrollArea className="max-h-[55vh]">
        <div className="flex flex-col gap-5 pr-3">
          {runs.map((run) => (
            <PolishRunCard
              key={run.id}
              run={run}
              projectId={projectId}
              resumeId={resumeId}
            />
          ))}
        </div>
      </ScrollArea>

      {allResolved ? (
        <form
          action={advanceAction}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">润色已完成</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                所有 bullet 候选已处理。确认后进入导出预览。
              </p>
            </div>
            <Badge variant="secondary">全部已确认</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={advancePending}>
              {advancePending ? "推进中…" : "确认润色结果，进入导出"}
            </Button>
            {advanceState.ts > 0 ? (
              <span
                className={cn(
                  "text-xs",
                  advanceState.ok ? "text-status-confirmed" : "text-destructive",
                )}
              >
                {advanceState.ok
                  ? "已进入导出阶段"
                  : stageMessage(advanceState.code) ?? "推进失败。"}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function PolishRunCard({
  run,
  projectId,
  resumeId,
}: {
  run: PolishRun;
  projectId: string;
  resumeId: string;
}) {
  const appliedCandidate = run.candidates.find((c) => c.status === "applied");
  const [selectedTone, setSelectedTone] = useState<string | null>(
    () => appliedCandidate?.tone ?? null,
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      {/* 头部：原文 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">原文</p>
          <p className="text-sm leading-6">{run.sourceBulletText}</p>
        </div>
        {run.valueTier ? (
          <Badge variant="outline" className="shrink-0">
            {tierLabel(run.valueTier)}
          </Badge>
        ) : null}
      </div>

      {/* 候选三版 */}
      <div className="grid gap-2">
        {run.candidates.map((candidate) => {
          const isSelected = selectedTone === candidate.tone;
          const isApplied = candidate.status === "applied";
          return (
            <div
              key={candidate.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3 text-sm transition-all",
                isApplied
                  ? "border-emerald-300 bg-emerald-50/40"
                  : isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-muted/20",
              )}
            >
              <div className="flex items-center gap-2">
                <Badge variant={isApplied ? "default" : isSelected ? "default" : "secondary"}>
                  {toneLabel(candidate.tone)}
                </Badge>
                {candidate.lowConfidence ? (
                  <span className="text-xs text-status-pending">低置信</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {isApplied
                    ? "已应用"
                    : candidate.status === "discarded"
                      ? "已跳过"
                      : "待定"}
                </span>
              </div>

              <DiffView before={run.sourceBulletText} after={candidate.text} />
              <p className="text-xs leading-5 text-muted-foreground">
                {candidate.rationale}
              </p>

              {/* 操作按钮 */}
              {candidate.status === "ready" ? (
                <div className="flex gap-2">
                  {isSelected ? (
                    <ApplyPolishForm
                      projectId={projectId}
                      resumeId={resumeId}
                      runId={run.id}
                      candidateId={candidate.id}
                      candidateText={candidate.text}
                    />
                  ) : null}
                  <form
                    action={async () => {
                      await discardPolishInWorkspace(projectId, resumeId, run.id, candidate.id);
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      跳过此版
                    </Button>
                  </form>
                  {!isSelected ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedTone(candidate.tone)}
                    >
                      选择此版
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplyPolishForm({
  projectId,
  resumeId,
  runId,
  candidateId,
  candidateText,
}: {
  projectId: string;
  resumeId: string;
  runId: string;
  candidateId: string;
  candidateText: string;
}) {
  const [state, action, pending] = useActionState(
    applyPolishInWorkspace.bind(null, projectId, resumeId, runId, candidateId),
    IDLE_WORKSPACE_STATE,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="finalText" value={candidateText} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "应用中…" : "确认应用此版本"}
      </Button>
      {state.ts > 0 ? (
        <span
          className={cn("text-xs", state.ok ? "text-status-confirmed" : "text-destructive")}
        >
          {state.ok ? "已应用" : stageMessage(state.code) ?? "应用失败。"}
        </span>
      ) : null}
    </form>
  );
}

function DiffView({ before, after }: { before: string; after: string }) {
  const parts = diffText(before, after);
  const hasDiff = parts.some((p) => p.type !== "same");
  if (!hasDiff) {
    return <p className="text-xs text-muted-foreground">（无变化）</p>;
  }
  return (
    <p className="text-xs leading-6">
      {parts.map((part, index) => (
        <span
          key={index}
          className={
            part.type === "added"
              ? "bg-emerald-100 text-emerald-800"
              : part.type === "removed"
                ? "bg-muted text-muted-foreground line-through"
                : ""
          }
        >
          {part.value}
        </span>
      ))}
    </p>
  );
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "high":
      return "高价值";
    case "medium":
      return "中等";
    case "low":
      return "待补强";
    default:
      return tier;
  }
}