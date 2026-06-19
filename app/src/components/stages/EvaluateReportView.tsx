"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import {
  confirmEgressInWorkspace,
} from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE } from "@/lib/workspace-action-state";
import { stageMessage, advanceLabel } from "@/lib/stage-messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * AI 联网评估报告（M3）。从 session.evaluationSummary 渲染：
 *  - JD 匹配分（若有）
 *  - 经历价值评级（high/medium/low）
 *  - 未覆盖关键词
 *  - 确认门（评估完成后 awaiting_user）
 *
 * 纯客户端：RSC 把 summary + document 传给 buildEvaluationReportView，
 * 客户端只收 view model 作展示。确认进 polish 门在此合一。
 */
export function EvaluateReportView({
  projectId,
  resumeId,
  viewModel,
  autoAdvancing = false,
}: {
  projectId: string;
  resumeId: string;
  viewModel: EvaluationReportView;
  /** autoAdvance 开启时隐藏手动确认门，由 AutoAdvanceRunner 倒计时自动推进。 */
  autoAdvancing?: boolean;
}) {
  const [egressState, egressAction, egressPending] = useActionState(
    confirmEgressInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* 标题 */}
      <div>
        <h2 className="text-lg font-semibold">联网价值评估</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {viewModel.createdAt
            ? `评估完成于 ${new Date(viewModel.createdAt).toLocaleString("zh-CN")}`
            : ""}
          &nbsp;仅作参考，最终取舍由用户决定。
        </p>
      </div>

      <ScrollArea className="max-h-[55vh]">
        <div className="flex flex-col gap-5 pr-3">
          {/* JD 匹配分 */}
          {viewModel.jdMatchScore !== undefined ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">岗位匹配度</span>
                <Badge variant="secondary">{jdfitScoreLabel(viewModel.jdMatchScore)}</Badge>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    viewModel.jdMatchScore >= 75
                      ? "bg-emerald-500"
                      : viewModel.jdMatchScore >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500",
                  )}
                  style={{ width: `${viewModel.jdMatchScore}%` }}
                />
              </div>
              <p className="text-2xl font-semibold tracking-tight">{viewModel.jdMatchScore}/100</p>
            </div>
          ) : null}

          {/* 经历价值评级 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold">经历价值评级</h3>
              <div className="flex gap-1.5 text-xs text-muted-foreground">
                <span className="text-emerald-600">高 {viewModel.tierCounts.high}</span>
                <span>/</span>
                <span className="text-sky-600">中 {viewModel.tierCounts.medium}</span>
                <span>/</span>
                <span className="text-amber-600">低 {viewModel.tierCounts.low}</span>
              </div>
            </div>

            {viewModel.ratings.map((rating) => (
              <RatingCard key={rating.experienceId} rating={rating} />
            ))}

            {viewModel.empty ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                暂无经历评级数据。
              </p>
            ) : null}
          </div>

          {/* 未覆盖关键词 */}
          {viewModel.uncoveredKeywords.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <p className="mb-1 text-sm font-semibold">岗位未覆盖关键词</p>
              <div className="flex flex-wrap gap-1.5">
                {viewModel.uncoveredKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* 确认门（autoAdvancing 时由 AutoAdvanceRunner 自动推进，隐藏手动门）*/}
      {autoAdvancing ? null : (
      <form action={egressAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h3 className="font-semibold">确认评估结果，进入润色</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            确认后将进入 AI 润色阶段，为每个确定事实生成三种候选（保守/平衡/激进）。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={egressPending}>
            {egressPending ? "确认中…" : advanceLabel("evaluate")}
          </Button>
          {egressState.ts > 0 ? (
            <span className={cn("text-xs", egressState.ok ? "text-status-confirmed" : "text-destructive")}>
              {egressState.ok ? "已确认，进入润色…" : stageMessage(egressState.code) ?? "确认失败。"}
            </span>
          ) : null}
        </div>
      </form>
      )}
    </div>
  );
}

function RatingCard({
  rating,
}: {
  rating: EvaluationReportView["ratings"][number];
}) {
  const tierLabel = { high: "高", medium: "中", low: "待补强" } as const;
  const tierDot = {
    high: "bg-emerald-500",
    medium: "bg-sky-500",
    low: "bg-amber-500",
  } as const;

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-4", rating.tier === "high" ? "border-l-emerald-500" : rating.tier === "medium" ? "border-l-sky-500" : "border-l-amber-500")}>
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tierDot[rating.tier])} />
        <p className="text-sm font-medium">
          {rating.title}
          {!rating.resolved ? (
            <span className="ml-2 text-xs text-muted-foreground">（ID 未匹配经历标题）</span>
          ) : null}
        </p>
        <Badge variant="outline" className="ml-auto">
          {tierLabel[rating.tier]} · {rating.score}
        </Badge>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{rating.rationale}</p>
      {rating.citations.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          引用来源：{rating.citations.join("、")}
        </p>
      ) : null}
    </div>
  );
}

function jdfitScoreLabel(score: number): string {
  if (score >= 75) return "良好";
  if (score >= 50) return "一般";
  return "待补强";
}

// ─── View Model Types ──────────────────────────────────

export type EvaluationReportView = {
  empty: boolean;
  jdMatchScore?: number;
  ratings: {
    experienceId: string;
    title: string;
    resolved: boolean;
    score: number;
    tier: "high" | "medium" | "low";
    rationale: string;
    citations: string[];
  }[];
  tierCounts: { high: number; medium: number; low: number };
  uncoveredKeywords: string[];
  reportId?: string;
  createdAt?: string;
};