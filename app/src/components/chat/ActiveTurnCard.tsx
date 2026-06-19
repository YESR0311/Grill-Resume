"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { questionKindLabel } from "@/lib/chat-projection";
import {
  promoteToEvidenceInWorkspace,
  saveQaAnswerInWorkspace,
} from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE } from "@/lib/workspace-action-state";
import type { CoachGrillSession } from "@/features/coach/conversation/engine";
import type { CoachQaTurn } from "@/features/coach/questions";
import type { CoachRecommendedAnswer } from "@/features/coach/conversation/recommendations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { stageMessage } from "@/lib/stage-messages";

/**
 * 当前单题卡（design §5.2）。grill 引擎 activeTurn 指针的单题渲染：
 * 提示 + 推荐脚手架 + 回答输入（draft / 事实笔记 / 不用），确认后经历类 Q&A
 * 可手填 STAR 入 evidence graph。全部走 useActionState（同页，不跳旧路由）。
 *
 * 确认阶梯不变量：回答标记"事实笔记"(confirmed) 只是 Q&A 状态；写入 evidence
 * 仍需手填 STAR 并二次确认。未确认内容不入最终简历。
 */

export function ActiveTurnCard({
  projectId,
  resumeId,
  turn,
  recommendedAnswers,
  weakestDimension,
  weakestReason,
  dimensionScore,
}: {
  projectId: string;
  resumeId: string;
  turn: CoachQaTurn;
  recommendedAnswers: CoachRecommendedAnswer[];
  weakestDimension: CoachGrillSession["weakestDimension"];
  weakestReason: string;
  dimensionScore: number;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    saveQaAnswerInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  const answer = turn.answer;
  const canPromote = Boolean(answer && answer.status === "confirmed" && answer.targetSource === "experience");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">当前深挖 · {turn.targetLabel}</p>
          <h3 className="mt-1 text-base font-semibold leading-6">{turn.questionPrompt}</h3>
        </div>
        <Badge variant="secondary">{questionKindLabel(turn.questionKind)}</Badge>
      </div>

      <div className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">
          目标维度：{questionKindLabel(weakestDimension)} · {dimensionScore.toFixed(2)}
        </span>
        <span className="ml-1">{weakestReason}</span>
      </div>

      {recommendedAnswers.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-3">
          {recommendedAnswers.map((rec) => (
            <div key={rec.label} className="rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5">
              <p className="font-medium text-foreground">脚手架 · {rec.label}</p>
              <p className="mt-1.5 whitespace-pre-line text-muted-foreground">{rec.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      <form action={saveAction} className="flex flex-col gap-3">
        <input type="hidden" name="targetId" value={turn.targetId} />
        <input type="hidden" name="targetSource" value={turn.targetSource} />
        <input type="hidden" name="questionId" value={turn.questionId} />
        <input type="hidden" name="questionKind" value={turn.questionKind} />
        <input type="hidden" name="questionPrompt" value={turn.questionPrompt} />
        <Textarea
          name="answerText"
          required
          maxLength={4000}
          defaultValue={answer?.answerText ?? ""}
          placeholder="只用本地 workspace 保存；不会进入 confirmed bullet 或导出。"
          className="min-h-28"
        />
        <p className="text-xs text-muted-foreground">
          标记&ldquo;事实笔记&rdquo;仅改 Q&A 状态；写入 confirmed bullet 仍需走证据图与文案确认。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="status" value="draft" variant="outline" size="sm" disabled={savePending}>
            保存草稿
          </Button>
          <Button type="submit" name="status" value="confirmed" size="sm" disabled={savePending}>
            标记事实笔记
          </Button>
          <Button type="submit" name="status" value="rejected" variant="destructive" size="sm" disabled={savePending}>
            标记不用
          </Button>
        </div>
        {saveState.ts > 0 ? (
          <p className={cn("text-xs", saveState.ok ? "text-status-confirmed" : "text-destructive")}>
            {saveState.ok ? "已保存到本地。" : stageMessage(saveState.code) ?? "保存失败。"}
          </p>
        ) : null}
      </form>

      {answer ? (
        <PromoteForm
          projectId={projectId}
          resumeId={resumeId}
          answerId={answer.id}
          canPromote={canPromote}
          sourceText={answer.answerText}
          isProject={answer.targetSource === "project"}
          isConfirmed={answer.status === "confirmed"}
        />
      ) : null}
    </div>
  );
}

function PromoteForm({
  projectId,
  resumeId,
  answerId,
  canPromote,
  sourceText,
  isProject,
  isConfirmed,
}: {
  projectId: string;
  resumeId: string;
  answerId: string;
  canPromote: boolean;
  sourceText: string;
  isProject: boolean;
  isConfirmed: boolean;
}) {
  const [state, action, pending] = useActionState(
    promoteToEvidenceInWorkspace.bind(null, projectId, resumeId, answerId),
    IDLE_WORKSPACE_STATE,
  );

  if (!canPromote) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        {isProject
          ? "项目 Q&A 暂不入 evidence graph；本轮只支持经历 Q&A。"
          : !isConfirmed
            ? "先标记为事实笔记，才可手填 STAR 入 evidence graph。"
            : "当前回答暂不可入图。"}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
      <p className="font-medium">入 evidence graph（需手填 STAR；不会生成 confirmed bullet 或导出内容）</p>
      <input type="hidden" name="starResultConfidence" value="confirmed" />
      <LabeledArea name="starContext" label="背景" maxLength={2000} />
      <LabeledArea name="starTask" label="任务" maxLength={2000} />
      <LabeledArea name="starAction" label="动作（至少 1 条）" maxLength={2000} required />
      <div className="grid gap-2 md:grid-cols-[1fr_0.45fr]">
        <LabeledArea name="starResultText" label="结果（至少 1 条）" maxLength={2000} required />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">指标</span>
          <input
            name="starResultMetric"
            maxLength={500}
            className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">技能</span>
        <input
          name="starSkill"
          maxLength={200}
          className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">来源文本</span>
        <Textarea name="starSourceText" maxLength={4000} defaultValue={sourceText} className="min-h-16" />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          确认写入 evidence graph
        </Button>
        {state.ts > 0 ? (
          <span className={cn("text-xs", state.ok ? "text-status-confirmed" : "text-destructive")}>
            {state.ok ? "已入图。" : stageMessage(state.code) ?? "写入失败。"}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function LabeledArea({
  name,
  label,
  maxLength,
  required,
}: {
  name: string;
  label: string;
  maxLength: number;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <Textarea name={name} maxLength={maxLength} required={required} className="min-h-16" />
    </label>
  );
}
