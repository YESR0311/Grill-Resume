import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getProjectResume } from "@/features/resume/storage";
import type { PolishCandidate } from "./generate";

export type PolishRun = {
  schemaVersion: "polish-run-v1";
  id: string;
  projectId: string;
  resumeId: string;
  experienceId: string;
  sourceBulletId: string;
  sourceBulletText: string;
  sourceEvidenceIds: string[];
  candidates: (PolishCandidate & { id: string; status: "ready" | "applied" | "discarded" })[];
  valueTier?: "high" | "medium" | "low";
  createdAt: string;
  appliedAt?: string;
  appliedCandidateId?: string;
  appliedBulletId?: string;
};

const candidateSchema = z.object({
  id: z.string().trim().min(1),
  tone: z.enum(["conservative", "balanced", "aggressive"]),
  text: z.string().trim().min(1).max(800),
  rationale: z.string().trim().min(1).max(800),
  structure: z.record(z.string(), z.string()).default({}),
  lowConfidence: z.boolean().default(false),
  status: z.enum(["ready", "applied", "discarded"]),
});

const polishRunSchema = z.object({
  schemaVersion: z.literal("polish-run-v1"),
  id: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  resumeId: z.string().trim().min(1),
  experienceId: z.string().trim().min(1),
  sourceBulletId: z.string().trim().min(1),
  sourceBulletText: z.string().trim().min(1).max(800),
  sourceEvidenceIds: z.array(z.string().trim().min(1)),
  candidates: z.array(candidateSchema).length(3),
  valueTier: z.enum(["high", "medium", "low"]).optional(),
  createdAt: z.string().trim().min(1),
  appliedAt: z.string().trim().min(1).optional(),
  appliedCandidateId: z.string().trim().min(1).optional(),
  appliedBulletId: z.string().trim().min(1).optional(),
});

/** 原子写：临时文件 + rename，避免半截 JSON（与 pipeline/intake session 存储同惯例，私有实现）。 */
async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

function polishDir(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "polish");
}

function polishPath(resumeFilePath: string, runId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error("invalid-polish-run");
  return path.join(polishDir(resumeFilePath), `${runId}.json`);
}

async function resumeFilePath(projectId: string, resumeId: string): Promise<string> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) throw new Error("resume-not-found");
  return current.resume.filePath;
}

export async function createPolishRun(input: {
  projectId: string;
  resumeId: string;
  experienceId: string;
  sourceBulletId: string;
  sourceBulletText: string;
  sourceEvidenceIds: string[];
  candidates: PolishCandidate[];
  valueTier?: "high" | "medium" | "low";
}): Promise<PolishRun> {
  const filePath = await resumeFilePath(input.projectId, input.resumeId);
  const now = new Date().toISOString();
  const run: PolishRun = {
    schemaVersion: "polish-run-v1",
    id: nanoid(),
    projectId: input.projectId,
    resumeId: input.resumeId,
    experienceId: input.experienceId,
    sourceBulletId: input.sourceBulletId,
    sourceBulletText: input.sourceBulletText,
    sourceEvidenceIds: input.sourceEvidenceIds,
    candidates: input.candidates.map((candidate) => ({ ...candidate, id: nanoid(), status: "ready" })),
    ...(input.valueTier ? { valueTier: input.valueTier } : {}),
    createdAt: now,
  };
  const parsed = polishRunSchema.parse(run);
  await atomicWriteJson(polishPath(filePath, parsed.id), parsed);
  return parsed;
}

export async function listPolishRuns(projectId: string, resumeId: string): Promise<PolishRun[]> {
  const filePath = await resumeFilePath(projectId, resumeId);
  try {
    const entries = await fs.readdir(polishDir(filePath));
    const runs = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          // 坏文件 safeParse 失败直接跳过，不抛崩整张列表（与 intake session 存储同惯例）。
          try {
            const json = JSON.parse(await fs.readFile(path.join(polishDir(filePath), entry), "utf-8"));
            const parsed = polishRunSchema.safeParse(json);
            return parsed.success ? parsed.data : null;
          } catch {
            return null;
          }
        }),
    );
    return runs
      .filter((run): run is PolishRun => run !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function readPolishRun(projectId: string, resumeId: string, runId: string): Promise<PolishRun | null> {
  const filePath = await resumeFilePath(projectId, resumeId);
  try {
    const json = JSON.parse(await fs.readFile(polishPath(filePath, runId), "utf-8"));
    const parsed = polishRunSchema.parse(json);
    return parsed.projectId === projectId && parsed.resumeId === resumeId ? parsed : null;
  } catch {
    return null;
  }
}

export async function writePolishRun(run: PolishRun): Promise<void> {
  const filePath = await resumeFilePath(run.projectId, run.resumeId);
  const parsed = polishRunSchema.parse(run);
  await atomicWriteJson(polishPath(filePath, parsed.id), parsed);
}
