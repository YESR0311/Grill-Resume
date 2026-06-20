"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, AlertCircle, Search } from "lucide-react";
import { runEvalAction, getEvalReportAction } from "@/app/evaluate/[id]/actions";
import type { EvaluationReport, EvaluationItem } from "@/features/evaluation/types";

type EvalState =
  | { status: "loading" }
  | { status: "idle" }
  | { status: "running"; progress: string }
  | { status: "done"; report: EvaluationReport }
  | { status: "error"; error: string };

export function EvaluateView({ profileId }: { profileId: string }) {
  const [state, setState] = useState<EvalState>({ status: "loading" });
  const router = useRouter();

  const run = useCallback(async () => {
    setState({ status: "running", progress: "正在联网评估中，请稍候…" });
    const result = await runEvalAction(profileId);
    if (!result.ok) {
      setState({ status: "error", error: result.error ?? "评估失败" });
      return;
    }
    const report = await getEvalReportAction(profileId);
    if (report) {
      setState({ status: "done", report });
    } else {
      setState({ status: "error", error: "评估报告未生成" });
    }
  }, [profileId]);

  // 加载已有报告：有则展示，无则进入 idle 等待用户主动触发（评估要联网外发，不自动开始）
  useEffect(() => {
    let cancelled = false;
    getEvalReportAction(profileId).then((report) => {
      if (cancelled) return;
      setState(report ? { status: "done", report } : { status: "idle" });
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (state.status === "idle") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 py-24">
        <Search size={32} className="text-primary" />
        <p className="text-sm text-muted-foreground">
          评估会联网搜索佐证你的经历（外发档案内容）。点击开始逐条评估。
        </p>
        <button
          onClick={run}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          开始联网评估
        </button>
      </div>
    );
  }

  if (state.status === "loading" || state.status === "running") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 py-24">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {state.status === "running" ? state.progress : "加载中…"}
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 py-24">
        <AlertCircle size={32} className="text-status-failed" />
        <p className="text-sm text-status-failed">{state.error}</p>
        <button
          onClick={run}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          重试
        </button>
      </div>
    );
  }

  const report = state.report;
  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* 工具条 */}
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-semibold">评估报告</h1>
        <button
          onClick={() => router.push(`/polish/${profileId}`)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          进入润色
          <ArrowRight size={15} />
        </button>
      </div>

      {/* 总体评价 */}
      {report.overallSummary && (
        <section className="mb-8 rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="mb-2 text-sm font-medium text-foreground">总体评价</h2>
          <p className="text-sm leading-6 text-muted-foreground">{report.overallSummary}</p>
        </section>
      )}

      {/* 逐条评估 */}
      <section>
        <h2 className="mb-4 text-base font-medium">逐条评估（{report.items.length} 条）</h2>
        <div className="space-y-4">
          {report.items.map((item) => (
            <EvalCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EvalCard({ item }: { item: EvaluationItem }) {
  const badges: Record<string, { label: string; color: string }> = {
    high: { label: "高相关", color: "bg-status-confirmed/10 text-status-confirmed" },
    medium: { label: "中相关", color: "bg-status-pending/10 text-status-pending" },
    low: { label: "低相关", color: "bg-status-failed/10 text-status-failed" },
    verified: { label: "可信", color: "bg-status-confirmed/10 text-status-confirmed" },
    plausible: { label: "可信", color: "bg-status-pending/10 text-status-pending" },
    unverifiable: { label: "不可信", color: "bg-status-failed/10 text-status-failed" },
    rare: { label: "稀缺", color: "bg-status-confirmed/10 text-status-confirmed" },
    common: { label: "常见", color: "bg-status-pending/10 text-status-pending" },
  };

  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="mb-2 text-sm text-foreground">{item.originalText}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badges[item.relevance]?.color}`}>
          {badges[item.relevance]?.label ?? item.relevance}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badges[item.credibility]?.color}`}>
          {badges[item.credibility]?.label ?? item.credibility}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badges[item.scarcity]?.color}`}>
          {badges[item.scarcity]?.label ?? item.scarcity}
        </span>
      </div>
      {item.suggestion && (
        <p className="mb-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">建议：</span>
          {item.suggestion}
        </p>
      )}
      {item.suggestedRewrite && (
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">建议改写</p>
          <p className="text-sm text-foreground">{item.suggestedRewrite}</p>
        </div>
      )}
    </div>
  );
}