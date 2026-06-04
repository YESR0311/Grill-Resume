import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { getProjectDir, getProjectsRoot } from "@/lib/workspace";
import {
  PIPELINE_STAGES,
  egressPlanSchema,
  pipelineCheckpointSchema,
  pipelineSessionSchema,
  type EgressPlan,
  type PipelineCheckpoint,
  type PipelineSession,
  type PipelineStage,
  type PipelineStageState,
} from "./types";

const PIPELINE_SESSION_DIR = "pipeline-sessions";
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class PipelineStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PipelineStorageError";
  }
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID_PATTERN.test(value)) {
    throw new PipelineStorageError(`${label} 无效`);
  }
}

function getPipelineSessionDir(projectId: string): string {
  assertSafeId(projectId, "项目 ID");
  return path.join(getProjectDir(projectId), PIPELINE_SESSION_DIR);
}

function getPipelineSessionPath(projectId: string, sessionId: string): string {
  assertSafeId(sessionId, "Pipeline session ID");
  const base = path.resolve(getPipelineSessionDir(projectId));
  const filePath = path.resolve(base, `${sessionId}.json`);
  const relative = path.relative(base, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PipelineStorageError("Pipeline session 路径不在项目目录内");
  }
  return filePath;
}

function buildInitialStageStates(): PipelineSession["stages"] {
  return {
    grill: { status: "not_started" },
    evaluate: { status: "not_started" },
    polish: { status: "not_started" },
    export: { status: "not_started" },
  };
}

function buildDefaultEgressPlan(autoAdvance: boolean): EgressPlan {
  return egressPlanSchema.parse({
    autoAdvance,
    items: [
      {
        id: "egress-grill",
        stage: "grill",
        action: "llm-enhance",
        provider: "LLM",
        description: "AI 分析问答内容，提供经历优化建议",
        dataPreview: "当前简历内容与已确认的 Q&A 回答",
      },
      {
        id: "egress-evaluate-search",
        stage: "evaluate",
        action: "web-search-evaluation",
        provider: "Tavily",
        description: "网络搜索验证技能稀缺性与公司背景",
        dataPreview: "已确认的简历事实、目标岗位与 JD 关键词",
      },
      {
        id: "egress-evaluate-llm",
        stage: "evaluate",
        action: "ai-evaluation",
        provider: "LLM",
        description: "AI 综合评估履历价值与 JD 匹配度",
        dataPreview: "已确认的简历事实、搜索摘要与 JD 内容",
      },
      {
        id: "egress-polish",
        stage: "polish",
        action: "llm-polish",
        provider: "LLM",
        description: "AI 润色优化经历描述",
        dataPreview: "已确认的经历事实与用户选择的 bullet 草稿",
      },
    ],
  });
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function readSessionFile(filePath: string): Promise<PipelineSession | null> {
  try {
    const json = JSON.parse(await fs.readFile(filePath, "utf-8"));
    const parsed = pipelineSessionSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function findSession(sessionId: string): Promise<PipelineSession | null> {
  assertSafeId(sessionId, "Pipeline session ID");
  let projectEntries;
  try {
    projectEntries = await fs.readdir(getProjectsRoot(), { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of projectEntries) {
    if (!entry.isDirectory() || !SAFE_ID_PATTERN.test(entry.name)) continue;
    const session = await readSessionFile(getPipelineSessionPath(entry.name, sessionId));
    if (session?.id === sessionId) return session;
  }
  return null;
}

async function updateSession(
  sessionId: string,
  update: (session: PipelineSession, now: string) => PipelineSession,
): Promise<PipelineSession> {
  const current = await findSession(sessionId);
  if (!current) throw new PipelineStorageError("Pipeline session 不存在");
  const now = new Date().toISOString();
  const next = pipelineSessionSchema.parse({
    ...update(current, now),
    updatedAt: now,
  });
  await saveSession(next);
  return next;
}

export async function createSession(
  projectId: string,
  resumeId: string,
  autoAdvance = true,
): Promise<PipelineSession> {
  assertSafeId(projectId, "项目 ID");
  assertSafeId(resumeId, "简历 ID");

  const now = new Date().toISOString();
  const session = pipelineSessionSchema.parse({
    id: nanoid(),
    projectId,
    resumeId,
    currentStage: "grill",
    stages: buildInitialStageStates(),
    egressPlan: buildDefaultEgressPlan(autoAdvance),
    checkpoints: [],
    autoAdvance,
    createdAt: now,
    updatedAt: now,
  });
  await saveSession(session);
  return session;
}

export async function readSession(projectId: string, sessionId?: string): Promise<PipelineSession | null> {
  try {
    if (sessionId) {
      const session = await readSessionFile(getPipelineSessionPath(projectId, sessionId));
      return session?.projectId === projectId && session.id === sessionId ? session : null;
    }
    const sessions = await listSessions(projectId);
    return sessions[0] ?? null;
  } catch {
    return null;
  }
}

export async function getSession(projectId: string): Promise<PipelineSession | null> {
  return readSession(projectId);
}

export async function listSessions(projectId: string): Promise<PipelineSession[]> {
  let entries;
  try {
    entries = await fs.readdir(getPipelineSessionDir(projectId), { withFileTypes: true });
  } catch {
    return [];
  }

  const sessions = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readSessionFile(path.join(getPipelineSessionDir(projectId), entry.name))),
  );
  return sessions
    .filter((session): session is PipelineSession => Boolean(session && session.projectId === projectId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSession(session: PipelineSession): Promise<PipelineSession> {
  const parsed = pipelineSessionSchema.parse(session);
  await atomicWriteJson(getPipelineSessionPath(parsed.projectId, parsed.id), parsed);
  return parsed;
}

export async function updateSessionStage(
  sessionId: string,
  stage: PipelineStage,
  patch: Partial<PipelineStageState>,
): Promise<PipelineSession> {
  return updateSession(sessionId, (session) => ({
    ...session,
    stages: {
      ...session.stages,
      [stage]: {
        ...session.stages[stage],
        ...patch,
      },
    },
  }));
}

export async function updateStageState(
  sessionId: string,
  stage: PipelineStage,
  patch: Partial<PipelineStageState>,
): Promise<PipelineSession> {
  return updateSessionStage(sessionId, stage, patch);
}

export async function updateSessionEgressPlan(
  sessionId: string,
  nextPlan: EgressPlan | ((current: EgressPlan, now: string) => EgressPlan),
): Promise<PipelineSession> {
  return updateSession(sessionId, (session, now) => ({
    ...session,
    egressPlan: egressPlanSchema.parse(
      typeof nextPlan === "function" ? nextPlan(session.egressPlan, now) : nextPlan,
    ),
  }));
}

export async function appendCheckpoint(
  sessionId: string,
  checkpoint: Omit<PipelineCheckpoint, "timestamp"> & { timestamp?: string },
): Promise<PipelineSession> {
  return updateSession(sessionId, (session, now) => ({
    ...session,
    checkpoints: [
      ...session.checkpoints,
      pipelineCheckpointSchema.parse({
        ...checkpoint,
        timestamp: checkpoint.timestamp ?? now,
      }),
    ],
  }));
}

export async function confirmEgressItems(sessionId: string, itemIds: string[]): Promise<PipelineSession> {
  const requestedIds = new Set(itemIds);
  if (requestedIds.size === 0) {
    throw new PipelineStorageError("至少需要确认一个外发项");
  }

  return updateSessionEgressPlan(sessionId, (plan, now) => {
    const nextItems = plan.items.map((item) =>
      requestedIds.has(item.id)
        ? {
            ...item,
            userConfirmedAt: item.userConfirmedAt ?? now,
          }
        : item,
    );
    const allConfirmed = nextItems.every((item) => item.userConfirmedAt);
    return {
      ...plan,
      items: nextItems,
      userConfirmedAt: allConfirmed ? plan.userConfirmedAt ?? now : plan.userConfirmedAt,
      allConfirmedAt: allConfirmed ? plan.allConfirmedAt ?? now : plan.allConfirmedAt,
    };
  });
}

export async function toggleAutoAdvance(sessionId: string, enabled: boolean): Promise<PipelineSession> {
  return updateSession(sessionId, (session) => ({
    ...session,
    autoAdvance: enabled,
    egressPlan: {
      ...session.egressPlan,
      autoAdvance: enabled,
    },
  }));
}

export async function deleteSession(projectId: string, sessionId?: string): Promise<void> {
  try {
    if (sessionId) {
      await fs.rm(getPipelineSessionPath(projectId, sessionId), { force: true });
      return;
    }
    await fs.rm(getPipelineSessionDir(projectId), { recursive: true, force: true });
  } catch (error) {
    throw new PipelineStorageError("Pipeline session 删除失败", { cause: error });
  }
}

export function getNextPipelineStage(stage: PipelineStage): PipelineStage | null {
  const index = PIPELINE_STAGES.indexOf(stage);
  return index >= 0 ? PIPELINE_STAGES[index + 1] ?? null : null;
}
