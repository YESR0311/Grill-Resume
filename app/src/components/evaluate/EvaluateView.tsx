"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, AlertCircle, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  runEvaluationSessionAction,
  evaluateOneItemAction,
  getEvalReportAction,
} from "@/app/evaluate/[id]/actions";
import type { EvaluationReport, EvaluationItem } from "@/features/evaluation/types";
import { reportToMarkdown } from "@/features/evaluation/report-markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ProfileSummary = {
  name: string;
  title: string;
  experienceCount: number;
  bulletCount: number;
};

type EvalState =
  | { status: "loading" }
  | { status: "idle" }
  | { status: "running"; done: number; total: number; items: EvaluationItem[] }
  | { status: "done"; report: EvaluationReport }
  | { status: "error"; error: string };

export function EvaluateView({
  profileId,
  summary,
}: {
  profileId: string;
  summary: ProfileSummary;
}) {
  const [state, setState] = useState<EvalState>({ status: "loading" });
  const [confirmPolish, setConfirmPolish] = useState(false);
  const router = useRouter();

  // 逐条评估：先开 session（1 次联网研究），再遍历 bulletIds 逐条评估，逐条 push（design §4.2 / §5.4）
  const run = useCallback(async () => {
    setState({ status: "running", done: 0, total: 0, items: [] });
    const session = await runEvaluationSessionAction(profileId);
    if (!session.ok) {
      setState({ status: "error", error: session.error });
      return;
    }
    const { bulletIds, searchContext } = session.data;
    const collected: EvaluationItem[] = [];

    for (let i = 0; i < bulletIds.length; i++) {
      const result = await evaluateOneItemAction(profileId, bulletIds[i], searchContext);
      if (!result.ok) {
        setState({ status: "error", error: result.error });
        return;
      }
      collected.push(result.data);
      setState({
        status: "running",
        done: i + 1,
        total: bulletIds.length,
        items: [...collected],
      });
    }

    // 全部完成：切「已评估」态 + 弹确认弹窗
    const now = new Date().toISOString();
    const report: EvaluationReport = {
      profileId,
      createdAt: now,
      updatedAt: now,
      items: collected,
      overallSummary: "",
    };
    setState({ status: "done", report });
    setConfirmPolish(true);
  }, [profileId]);

  // 加载已有报告：有则展示（已评估态），无则进入待评估
  useEffect(() => {
    let cancelled = false;
    getEvalReportAction(profileId).then((report) => {
      if (cancelled) return;
      setState(
        report && report.items.length > 0
          ? { status: "done", report }
          : { status: "idle" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* 面包屑：返回档案 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => router.push(`/profile/${profileId}`)}
          className="text-muted-foreground"
        >
          <ArrowLeft size={15} />
          返回档案
        </Button>
      </div>

      {state.status === "loading" && (
        <LoadingOverlay message="加载评估报告中…" showSkeleton={false} />
      )}

      {state.status === "idle" && (
        <IdleView summary={summary} onStart={run} />
      )}

      {state.status === "running" && (
        <RunningView done={state.done} total={state.total} items={state.items} />
      )}

      {state.status === "error" && (
        <ErrorView error={state.error} onRetry={run} />
      )}

      {state.status === "done" && (
        <DoneView
          report={state.report}
          onPolish={() => setConfirmPolish(true)}
        />
      )}

      {/* 评估完成确认弹窗 */}
      <Dialog open={confirmPolish} onOpenChange={setConfirmPolish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>评估完成，是否进入润色？</DialogTitle>
            <DialogDescription>
              进入润色后将综合档案与评估报告生成简历草稿。你也可以留在此页继续阅读报告。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setConfirmPolish(false)}>
              继续阅读
            </Button>
            <Button size="lg" onClick={() => router.push(`/polish/${profileId}`)}>
              是，进入润色
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 待评估态 ────────────────────────────────────────────
function IdleView({
  summary,
  onStart,
}: {
  summary: ProfileSummary;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 animate-in fade-in duration-300">
      <Search size={36} className="text-primary" />
      <div className="text-center">
        <h1 className="mb-1 text-xl font-semibold">逐条联网评估</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          对每条经历要点分别联网搜索佐证并由 AI 评分，帮你定位简历的薄弱点。
        </p>
      </div>

      {/* 档案摘要 */}
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <SummaryCard label="姓名" value={summary.name || "未填写"} />
        <SummaryCard label="目标岗位" value={summary.title || "未填写"} />
        <SummaryCard label="经历数" value={String(summary.experienceCount)} />
        <SummaryCard label="经历要点" value={String(summary.bulletCount)} />
      </div>

      <Button size="lg" onClick={onStart} className="px-8">
        开始联网评估
        <ArrowRight size={16} />
      </Button>

      <PrivacyNotice />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

// ─── 评估中态 ────────────────────────────────────────────
function RunningView({
  done,
  total,
  items,
}: {
  done: number;
  total: number;
  items: EvaluationItem[];
}) {
  return (
    <div className="animate-in fade-in duration-300">
      <LoadingOverlay
        message={
          total > 0 ? `正在联网逐条评估第 ${done}/${total} 条…` : "正在联网研究评估方法论…"
        }
        detail="评估仅在本地进行，数据不会上传"
        showSkeleton={items.length === 0}
      />

      {/* 逐条已完成的评估卡片 */}
      {items.length > 0 && (
        <div className="mt-2 space-y-4">
          {items.map((item) => (
            <EvalCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 错误态 ──────────────────────────────────────────────
function ErrorView({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 animate-in fade-in duration-300">
      <AlertCircle size={32} className="text-status-failed" />
      <p className="text-sm text-status-failed">{error}</p>
      <Button size="lg" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

// ─── 已评估态（MD 阅读器，只读） ─────────────────────────
function DoneView({
  report,
  onPolish,
}: {
  report: EvaluationReport;
  onPolish: () => void;
}) {
  const markdown = reportToMarkdown(report);
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-semibold">评估报告</h1>
        <Button size="lg" onClick={onPolish}>
          开始润色
          <ArrowRight size={16} />
        </Button>
      </div>

      <PrivacyNotice className="mb-4" />

      <ScrollArea className="max-h-[70vh] rounded-2xl bg-card p-6 ring-1 ring-border">
        <article className="max-w-none text-sm leading-6 text-foreground">
          <ReactMarkdown
            components={{
              h1: ({ ...p }) => <h1 className="mb-4 text-xl font-semibold" {...p} />,
              h2: ({ ...p }) => (
                <h2 className="mt-6 mb-3 border-b border-border pb-1 text-base font-medium" {...p} />
              ),
              h3: ({ ...p }) => <h3 className="mt-4 mb-2 text-sm font-medium" {...p} />,
              p: ({ ...p }) => <p className="mb-2 text-muted-foreground" {...p} />,
              ul: ({ ...p }) => <ul className="mb-3 ml-5 list-disc space-y-1" {...p} />,
              li: ({ ...p }) => <li className="text-muted-foreground" {...p} />,
              blockquote: ({ ...p }) => (
                <blockquote
                  className="mb-3 border-l-2 border-primary/40 bg-muted/50 px-3 py-2 text-foreground"
                  {...p}
                />
              ),
              a: ({ ...p }) => (
                <a
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...p}
                />
              ),
              strong: ({ ...p }) => <strong className="font-medium text-foreground" {...p} />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      </ScrollArea>
    </div>
  );
}

// ─── 隐私声明 ────────────────────────────────────────────
function PrivacyNotice({ className }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-muted-foreground ${className ?? ""}`}>
      评估仅在本地进行，数据不会上传
    </p>
  );
}

// ─── 评估卡片（逐条展示用，保留分数条样式） ───────────────
function scoreColor(score: number): string {
  if (score >= 7) return "bg-status-confirmed/10 text-status-confirmed";
  if (score >= 4) return "bg-status-pending/10 text-status-pending";
  return "bg-status-failed/10 text-status-failed";
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${scoreColor(score)}`}>
      {label} {score}
    </span>
  );
}

function EvalCard({ item }: { item: EvaluationItem }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border animate-in fade-in slide-in-from-bottom-2 duration-300">
      <p className="mb-2 text-sm text-foreground">{item.originalText}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <ScoreBadge label="综合" score={item.overallScore} />
        <ScoreBadge label="相关" score={item.relevance} />
        <ScoreBadge label="具体" score={item.specificity} />
        <ScoreBadge label="可信" score={item.credibility} />
        <ScoreBadge label="时效" score={item.recency} />
        <ScoreBadge label="表达" score={item.expression} />
        <ScoreBadge label="稀缺" score={item.scarcity} />
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
