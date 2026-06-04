import {
  createSession,
  confirmEgressItems,
  getNextPipelineStage,
  getSession as readStoredSession,
  saveSession,
  toggleAutoAdvance,
} from "./storage";
import {
  PIPELINE_STAGES,
  egressPlanSchema,
  pipelineSessionSchema,
  type EgressPlan,
  type EgressItem,
  type PipelineSession,
  type PipelineStage,
  type PipelineStageState,
} from "./types";
import type { ResumeDocument } from "@/features/resume/types";

export type StageEvent =
  | "stage-complete"
  | "stage-failed"
  | "user-confirmed"
  | "user-rejected"
  | "retry";

export type CanAdvanceResult = {
  ready: boolean;
  blockers: string[];
};

export type RatifyAction = "confirm" | "reject" | "skip";

function nowIso(): string {
  return new Date().toISOString();
}

function cloneSession(session: PipelineSession): PipelineSession {
  return pipelineSessionSchema.parse(session);
}

function isEgressConfirmed(session: PipelineSession, stage: PipelineStage): boolean {
  if (session.egressPlan.userConfirmedAt || session.egressPlan.allConfirmedAt) return true;
  const stageItems = session.egressPlan.items.filter((item) => item.stage === stage);
  return stageItems.length === 0 || stageItems.every((item) => item.userConfirmedAt);
}

function hasEgressItems(session: PipelineSession, stage: PipelineStage): boolean {
  return session.egressPlan.items.some((item) => item.stage === stage);
}

function setStageState(
  session: PipelineSession,
  stage: PipelineStage,
  patch: Partial<PipelineStageState>,
): void {
  session.stages[stage] = {
    ...session.stages[stage],
    ...patch,
  };
}

function pushCheckpoint(
  session: PipelineSession,
  stageFrom: PipelineStage | undefined,
  stageTo: PipelineStage,
  summary: string,
  timestamp: string,
): void {
  session.checkpoints = [
    ...session.checkpoints,
    {
      stageFrom,
      stageTo,
      summary,
      timestamp,
    },
  ];
}

function markAwaitingEgress(session: PipelineSession, stage: PipelineStage, timestamp: string): PipelineSession {
  setStageState(session, stage, {
    status: "awaiting_user",
    enteredAt: session.stages[stage].enteredAt ?? timestamp,
    errorCode: "egress_pending",
  });
  session.currentStage = stage;
  return session;
}

function startStage(session: PipelineSession, stage: PipelineStage, timestamp: string): PipelineSession {
  if (hasEgressItems(session, stage) && !isEgressConfirmed(session, stage)) {
    return markAwaitingEgress(session, stage, timestamp);
  }
  setStageState(session, stage, {
    status: "in_progress",
    enteredAt: session.stages[stage].enteredAt ?? timestamp,
    errorCode: undefined,
  });
  session.currentStage = stage;
  return session;
}

function completeSessionIfTerminal(session: PipelineSession, stage: PipelineStage, timestamp: string): PipelineSession {
  if (stage === "export") {
    session.completedAt = session.completedAt ?? timestamp;
  }
  return session;
}

function moveToNextStage(session: PipelineSession, timestamp: string): PipelineSession {
  const fromStage = session.currentStage;
  const nextStage = getNextPipelineStage(fromStage);
  if (!nextStage) {
    session.completedAt = session.completedAt ?? timestamp;
    return session;
  }
  pushCheckpoint(session, fromStage, nextStage, `${fromStage} completed; ${nextStage} selected`, timestamp);
  return startStage(session, nextStage, timestamp);
}

export function canAdvance(session: PipelineSession): CanAdvanceResult {
  const blockers: string[] = [];
  const stage = session.currentStage;
  const state = session.stages[stage];

  if (session.completedAt) {
    blockers.push("Pipeline session 已完成");
  }
  if (state.status === "failed") {
    blockers.push("当前阶段失败，需要先 retry");
  }
  if (state.status === "in_progress") {
    blockers.push("当前阶段仍在执行中");
  }
  if (hasEgressItems(session, stage) && !isEgressConfirmed(session, stage)) {
    blockers.push("隐私与外发数据使用尚未确认");
  }
  if (stage === "evaluate" && !session.egressPlan.userConfirmedAt && !session.egressPlan.allConfirmedAt) {
    blockers.push("evaluate 阶段完成前必须确认 EgressPlan");
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function advanceStage(session: PipelineSession, event: StageEvent): PipelineSession {
  const next = cloneSession(session);
  const timestamp = nowIso();
  const stage = next.currentStage;
  const state = next.stages[stage];

  next.updatedAt = timestamp;

  if (next.completedAt) return next;

  if (event === "stage-complete") {
    if (state.status !== "in_progress") return next;
    setStageState(next, stage, {
      status: "awaiting_user",
      completedAt: timestamp,
      errorCode: undefined,
    });
    return completeSessionIfTerminal(next, stage, timestamp);
  }

  if (event === "stage-failed") {
    if (state.status !== "in_progress") return next;
    setStageState(next, stage, {
      status: "failed",
      failedAt: timestamp,
      errorCode: state.errorCode ?? "stage_failed",
    });
    return next;
  }

  if (event === "retry") {
    if (state.status !== "failed" && state.status !== "not_started") return next;
    return startStage(next, stage, timestamp);
  }

  if (event === "user-rejected") {
    if (state.status !== "awaiting_user") return next;
    setStageState(next, stage, {
      status: "not_started",
      enteredAt: undefined,
      completedAt: undefined,
      failedAt: undefined,
      errorCode: undefined,
      resultRef: undefined,
    });
    return next;
  }

  if (event === "user-confirmed") {
    if (state.status === "not_started") return startStage(next, stage, timestamp);
    if (state.status !== "awaiting_user") return next;
    if (state.errorCode === "egress_pending") return startStage(next, stage, timestamp);
    setStageState(next, stage, {
      status: "completed",
      completedAt: state.completedAt ?? timestamp,
      errorCode: undefined,
    });
    return moveToNextStage(next, timestamp);
  }

  return next;
}

function summarizeDocument(document: ResumeDocument): string {
  const confirmedEvidenceCount = document.experiences.reduce(
    (count, experience) =>
      count + experience.evidence.filter((item) => item.results.some((result) => result.confidence === "confirmed")).length,
    0,
  );
  const confirmedBulletCount = document.experiences.reduce(
    (count, experience) => count + experience.bullets.filter((item) => item.status === "confirmed").length,
    0,
  );
  const jdState = document.target?.jdText ? "包含 JD" : "未提供 JD";
  return `${document.experiences.length} 段经历，${confirmedEvidenceCount} 条确认事实，${confirmedBulletCount} 条确认 bullet，${jdState}`;
}

export function buildEgressPlan(document: ResumeDocument): EgressPlan {
  const preview = summarizeDocument(document);
  const items: EgressItem[] = [];
  const hasResumeMaterial = document.experiences.length > 0 || document.projects.length > 0;
  const hasConfirmedBullets = document.experiences.some((experience) =>
    experience.bullets.some((bullet) => bullet.status === "confirmed"),
  );
  const hasEvaluationMaterial =
    document.skills.some((group) => group.items.length > 0) ||
    document.experiences.length > 0 ||
    document.projects.length > 0 ||
    Boolean(document.target?.jdText || document.target?.keywords?.length);

  if (hasResumeMaterial) {
    items.push({
      id: "egress-grill",
      stage: "grill",
      action: "llm-enhance",
      provider: "LLM",
      description: "AI 分析问答内容，提供经历优化建议",
      dataPreview: preview,
    });
  }

  if (hasEvaluationMaterial) {
    items.push(
      {
        id: "egress-evaluate-search",
        stage: "evaluate",
        action: "web-search-evaluation",
        provider: "Tavily",
        description: "网络搜索验证技能稀缺性、公司背景与 JD 关键词信号",
        dataPreview: preview,
      },
      {
        id: "egress-evaluate-llm",
        stage: "evaluate",
        action: "ai-evaluation",
        provider: "LLM",
        description: "AI 综合评估履历价值与 JD 匹配度",
        dataPreview: preview,
      },
    );
  }

  if (hasConfirmedBullets) {
    items.push({
      id: "egress-polish",
      stage: "polish",
      action: "llm-polish",
      provider: "LLM",
      description: "AI 润色优化已确认经历 bullet",
      dataPreview: preview,
    });
  }

  return egressPlanSchema.parse({
    items,
    autoAdvance: true,
  });
}

export async function getOrCreateSession(projectId: string, resumeId: string): Promise<PipelineSession> {
  const existing = await readStoredSession(projectId);
  return existing ?? createSession(projectId, resumeId);
}

export async function getSession(projectId: string): Promise<PipelineSession | null> {
  return readStoredSession(projectId);
}

export async function advance(session: PipelineSession): Promise<PipelineSession> {
  const next = advanceStage(session, "user-confirmed");
  return saveSession(next);
}

export async function confirmEgress(sessionId: string, confirmedItemIds: string[]): Promise<PipelineSession> {
  return confirmEgressItems(sessionId, confirmedItemIds);
}

export async function setAutoAdvance(sessionId: string, enabled: boolean): Promise<PipelineSession> {
  return toggleAutoAdvance(sessionId, enabled);
}

export async function ratifyStage(
  sessionId: string,
  session: PipelineSession,
  action: RatifyAction,
): Promise<PipelineSession> {
  if (session.id !== sessionId) return session;
  const event: StageEvent = action === "confirm" || action === "skip" ? "user-confirmed" : "user-rejected";
  return saveSession(advanceStage(session, event));
}

export { PIPELINE_STAGES };
