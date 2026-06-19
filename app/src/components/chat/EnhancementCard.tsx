"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { runGrillEnhancementInWorkspace } from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE } from "@/lib/workspace-action-state";
import type { GrillEnhancement } from "@/features/coach/conversation/llm-enhance";
import { Button } from "@/components/ui/button";
import { stageMessage } from "@/lib/stage-messages";

/**
 * AI clarify 卡（design §5.2 EnhancementCard）。显式触发 runGrillEnhancement：
 * 向默认 provider 发送当前追问 + 最近 Q&A + confirmed evidence 摘要 + untrusted JD，
 * 返回澄清/冲突/追问建议 + 待确认 STAR 草稿。结果只作追问辅助，不写 confirmed bullet。
 *
 * 隐私不变量：必须勾选 privacyConfirmed 才发送（grill 段 withPipelinePrivacy 也会校验）。
 */

export function EnhancementCard({
  projectId,
  resumeId,
  enhancement,
  hasActiveTurn,
  hasDefaultModel,
}: {
  projectId: string;
  resumeId: string;
  enhancement?: GrillEnhancement;
  hasActiveTurn: boolean;
  hasDefaultModel: boolean;
}) {
  const [state, action, pending] = useActionState(
    runGrillEnhancementInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">AI 澄清</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            显式触发；结果只作追问辅助和待确认 STAR 草稿，不写入确定事实。
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
          {enhancement ? "已生成" : hasDefaultModel ? "可生成" : "需配置模型"}
        </span>
      </div>

      <form action={action} className="flex flex-col gap-2.5">
        <label className="flex items-start gap-2 rounded-xl border border-status-pending/40 bg-status-pending/10 p-3 text-xs leading-5">
          <input type="checkbox" name="privacyConfirmed" value="1" required className="mt-0.5" />
          <span>
            我已确认：将向默认模型服务商发送当前追问、最近问答、已确认证据摘要和已标记
            不可信的岗位描述片段，用于澄清 / 冲突 / 追问建议。
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" size="sm" disabled={!hasActiveTurn || !hasDefaultModel || pending}>
            {pending ? "生成中…" : "生成 AI 澄清"}
          </Button>
          {state.ts > 0 && !state.ok ? (
            <span className="text-xs text-destructive">{stageMessage(state.code) ?? "生成失败。"}</span>
          ) : null}
        </div>
        {!hasDefaultModel ? (
          <p className="text-xs text-muted-foreground">未配置默认模型时保持固定规则追问，不调用服务商。</p>
        ) : null}
      </form>

      {enhancement ? <EnhancementResult enhancement={enhancement} /> : null}
    </div>
  );
}

function EnhancementResult({ enhancement }: { enhancement: GrillEnhancement }) {
  const draft = enhancement.distilledEvidenceDraft;
  return (
    <div className="flex flex-col gap-3">
      {enhancement.restate ? (
        <ResultBlock title="一句话复述">
          <p className="text-muted-foreground">{enhancement.restate.text}</p>
          {enhancement.restate.lowConfidence ? <LowConfidence /> : null}
        </ResultBlock>
      ) : null}

      {enhancement.fuzzyTerms.length > 0 ? (
        <ResultBlock title="模糊词澄清">
          <ul className="flex flex-col gap-1.5 text-muted-foreground">
            {enhancement.fuzzyTerms.map((item) => (
              <li key={`${item.term}:${item.question}`}>
                <span className="font-medium text-foreground">{item.term}</span>：{item.question}
                {item.lowConfidence ? "（低置信）" : ""}
              </li>
            ))}
          </ul>
        </ResultBlock>
      ) : null}

      {enhancement.conflicts.length > 0 ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="font-medium text-destructive">冲突待裁决</p>
          <ul className="mt-2 flex flex-col gap-2 text-muted-foreground">
            {enhancement.conflicts.map((item) => (
              <li key={`${item.claim}:${item.citation}`} className="rounded-lg border border-destructive/20 bg-background p-2.5">
                <p>主张：{item.claim}</p>
                <p className="mt-1">证据：{item.evidence}</p>
                <p className="mt-1 text-xs">{item.reason} · 引用：{item.citation}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {enhancement.probe ? (
        <ResultBlock title="动态追问">
          <p className="text-muted-foreground">{enhancement.probe.question}</p>
          <p className="mt-1 text-xs text-muted-foreground">{enhancement.probe.kind} · {enhancement.probe.reason}</p>
        </ResultBlock>
      ) : null}

      {draft ? (
        <ResultBlock title="待确认 STAR 草稿">
          {draft.lowConfidence ? <LowConfidence /> : null}
          <div className="mt-1 grid gap-1.5 text-xs text-muted-foreground md:grid-cols-2">
            <p>背景：{draft.context ?? "待补"}</p>
            <p>任务：{draft.task ?? "待补"}</p>
            <p>动作：{draft.actions.join("；") || "待补"}</p>
            <p>结果：{draft.results.map((r) => (r.metric ? `${r.text}（${r.metric}）` : r.text)).join("；") || "待补"}</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            草稿仅供参考；如需入图，请在上方&ldquo;事实笔记&rdquo;确认后手填 STAR。
          </p>
        </ResultBlock>
      ) : null}
    </div>
  );
}

function ResultBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="font-medium">{title}</p>
      <div className="mt-1.5 leading-6">{children}</div>
    </div>
  );
}

function LowConfidence() {
  return <p className={cn("text-xs text-status-pending")}>低置信度：请用户确认后再入图。</p>;
}
