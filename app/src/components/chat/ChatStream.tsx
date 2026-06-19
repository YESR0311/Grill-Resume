"use client";

import { useActionState } from "react";
import { startPipelineInWorkspace } from "@/app/w/[projectId]/[resumeId]/actions";
import { IDLE_WORKSPACE_STATE } from "@/lib/workspace-action-state";
import type { ChatMessage } from "@/lib/chat-projection";
import type { CoachGrillSession } from "@/features/coach/conversation/engine";
import { MessageBubble } from "./MessageBubble";
import { ActiveTurnCard } from "./ActiveTurnCard";
import { EnhancementCard } from "./EnhancementCard";
import { IntakeComposer } from "./IntakeComposer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { stageMessage } from "@/lib/stage-messages";

/**
 * grill 对话流编排器（design §5.2 ChatStream）。主区随 grill 子态切换：
 *  - 无 session：起始入口（粘贴材料 + 开始追问）
 *  - 有 activeTurn：历史气泡流 + 当前单题卡 + AI clarify
 *  - 无 activeTurn 且有进度：问答完成态（M3 StageGate 接确认进入评估）
 *
 * 全程 RSC 重查为真相；本组件只收 plain props + 调 server action（不持久化业务状态）。
 */

export function ChatStream({
  projectId,
  resumeId,
  hasSession,
  messages,
  session,
  hasExperiences,
  hasDefaultModel,
  grillComplete,
}: {
  projectId: string;
  resumeId: string;
  hasSession: boolean;
  messages: ChatMessage[];
  session: CoachGrillSession;
  hasExperiences: boolean;
  hasDefaultModel: boolean;
  grillComplete: boolean;
}) {
  const activeTurn = session.base.activeTurn;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {!hasSession && !hasExperiences ? <OnboardingGuide /> : null}

      {messages.length > 0 ? (
        <ScrollArea className="max-h-[44vh]">
          <div className="flex flex-col gap-3 pr-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </ScrollArea>
      ) : null}

      {/* 起始入口：仅当无 session 且尚无经历时引导启动 / 录入。grill 对话靠无状态重算，
          一旦有经历就直接进单题，不再展示 StartGate（避免与单题卡并存的视觉冗余）。 */}
      {!hasSession && !hasExperiences ? (
        <StartGate projectId={projectId} resumeId={resumeId} hasExperiences={hasExperiences} />
      ) : null}

      {!hasExperiences ? <IntakeComposer projectId={projectId} resumeId={resumeId} /> : null}

      {hasExperiences && activeTurn ? (
        <>
          <ActiveTurnCard
            projectId={projectId}
            resumeId={resumeId}
            turn={activeTurn}
            recommendedAnswers={session.recommendedAnswers}
            weakestDimension={session.weakestDimension}
            weakestReason={session.weakestReason}
            dimensionScore={session.dimensionScores[session.weakestDimension]}
          />
          <EnhancementCard
            projectId={projectId}
            resumeId={resumeId}
            enhancement={session.enhancement}
            hasActiveTurn={Boolean(activeTurn)}
            hasDefaultModel={hasDefaultModel}
          />
          <details className="rounded-2xl border border-border bg-card">
            <summary className="cursor-pointer px-5 py-3 text-sm font-medium">补充更多材料</summary>
            <div className="border-t border-border p-1">
              <IntakeComposer projectId={projectId} resumeId={resumeId} />
            </div>
          </details>
        </>
      ) : null}

      {hasExperiences && !activeTurn && grillComplete ? (
        <div className="rounded-2xl border border-status-confirmed/40 bg-status-confirmed/10 p-5 text-sm">
          <p className="font-medium text-foreground">问答完成</p>
          <p className="mt-1 leading-6 text-muted-foreground">
            所有追问轮次已推进或阻塞。下一步在阶段门确认后进入评估。
          </p>
        </div>
      ) : null}

      {hasExperiences && !activeTurn && !grillComplete ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          当前没有可追问的问题。补充经历或项目后会自动生成问答队列。
        </div>
      ) : null}
    </div>
  );
}

function StartGate({
  projectId,
  resumeId,
  hasExperiences,
}: {
  projectId: string;
  resumeId: string;
  hasExperiences: boolean;
}) {
  const [state, action, pending] = useActionState(
    startPipelineInWorkspace.bind(null, projectId, resumeId),
    IDLE_WORKSPACE_STATE,
  );

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold">开始追问流程</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {hasExperiences
            ? "已有经历材料，开始后逐题追问，把流水账逼近可证事实。"
            : "先在下方粘贴材料生成经历，或直接开始后再录入。"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "启动中…" : "开始追问"}
        </Button>
        {state.ts > 0 && !state.ok ? (
          <span className="text-xs text-destructive">{stageMessage(state.code) ?? "启动失败。"}</span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * 首次进项目空态引导（design §核心交互 R3 onboarding）。三步心智地图，
 * 取代「自己摸索如何用」。仅在无 session 且无经历时显示。
 */
function OnboardingGuide() {
  const steps = [
    { n: 1, t: "粘贴材料", d: "把流水账经历粘进下方，生成待确认候选" },
    { n: 2, t: "逐题问答", d: "回答 AI 追问，把经历补成可证事实" },
    { n: 3, t: "评估 · 润色 · 导出", d: "联网评估价值，润色要点，导出中文 DOCX" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">开始：三步生成中文简历</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          全程本地优先，未确认的内容不会进入最终简历。
        </p>
      </div>
      <ol className="grid gap-2.5 sm:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/30 p-3"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
              {s.n}
            </span>
            <span className="text-sm font-medium">{s.t}</span>
            <span className="text-xs leading-5 text-muted-foreground">{s.d}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
