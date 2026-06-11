import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { getProjectResume } from "@/features/resume/storage";
import { intakeInterviewSessionSchema, type IntakeInterviewSession } from "./types";

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID_PATTERN.test(value)) {
    throw new Error(`${label} 无效`);
  }
}

/** 会话目录：<resume 目录>/intake/sessions/，与既有 intake/ candidate 文件同级新增子目录。 */
async function getIntakeSessionsDir(projectId: string, resumeId: string): Promise<string> {
  assertSafeId(projectId, "Project ID");
  assertSafeId(resumeId, "Resume ID");
  const current = await getProjectResume(projectId, resumeId);
  if (!current) throw new Error("resume-not-found");
  return path.join(path.dirname(current.resume.filePath), "intake", "sessions");
}

/** 原子写：临时文件 + rename，避免半截 JSON（与 pipeline session 存储同惯例，私有实现）。 */
async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function readSessionFile(filePath: string): Promise<IntakeInterviewSession | null> {
  try {
    const json = JSON.parse(await fs.readFile(filePath, "utf-8"));
    const parsed = intakeInterviewSessionSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveIntakeSession(session: IntakeInterviewSession): Promise<string> {
  const parsed = intakeInterviewSessionSchema.parse(session);
  assertSafeId(parsed.id, "Intake session ID");
  const dir = await getIntakeSessionsDir(parsed.projectId, parsed.resumeId);
  const filePath = path.join(dir, `${parsed.id}.json`);
  await atomicWriteJson(filePath, parsed);
  return filePath;
}

export async function loadIntakeSession(
  projectId: string,
  resumeId: string,
  sessionId: string,
): Promise<IntakeInterviewSession | null> {
  assertSafeId(sessionId, "Intake session ID");
  try {
    const dir = await getIntakeSessionsDir(projectId, resumeId);
    const session = await readSessionFile(path.join(dir, `${sessionId}.json`));
    return session?.id === sessionId && session.projectId === projectId && session.resumeId === resumeId
      ? session
      : null;
  } catch {
    return null;
  }
}

/** 列出会话（updatedAt 倒序）；坏文件 safeParse 失败直接跳过，不抛崩列表。 */
export async function listIntakeSessions(
  projectId: string,
  resumeId: string,
): Promise<IntakeInterviewSession[]> {
  let dir: string;
  let entries;
  try {
    dir = await getIntakeSessionsDir(projectId, resumeId);
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const sessions = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readSessionFile(path.join(dir, entry.name))),
  );
  return sessions
    .filter(
      (session): session is IntakeInterviewSession =>
        Boolean(session && session.projectId === projectId && session.resumeId === resumeId),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
