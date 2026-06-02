import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getProjectsRoot, getResumeBulletDraftDir, getResumeBulletDraftPath } from "@/lib/workspace";

export type CoachBulletDraftCandidate = {
  text: string;
  rationale?: string;
};

export type CoachBulletDraftRecord = {
  id: string;
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
  experienceId: string;
  evidenceId: string;
  filePath: string;
  status: "pending" | "applied";
  createdAt: string;
};

export type CoachBulletDraft = {
  schemaVersion: "coach-bullet-draft-v1";
  id: string;
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
  experienceId: string;
  evidenceId: string;
  source: "research_finding" | "experience_evidence";
  sourceEvidenceIds: string[];
  candidates: CoachBulletDraftCandidate[];
  createdAt: string;
  mode: "provider";
  status: "pending" | "applied";
  appliedAt?: string;
  appliedCandidateIndex?: number;
  appliedBulletId?: string;
  appliedText?: string;
};

type DraftRow = {
  id: string;
  project_id: string;
  resume_id: string;
  report_id: string;
  finding_id: string;
  experience_id: string;
  evidence_id: string;
  file_path: string;
  status: string;
  created_at: string;
};

type ResumeOwnerRow = { id: string; project_id: string; file_path: string };

const candidateSchema = z.object({
  text: z.string().trim().min(1).max(800),
  rationale: z.string().trim().max(800).optional(),
});

const bulletDraftV1Schema = z
  .object({
    schemaVersion: z.literal("coach-bullet-draft-v1"),
    id: z.string().trim().min(1),
    projectId: z.string().trim().min(1),
    resumeId: z.string().trim().min(1),
    reportId: z.string().trim().min(1),
    findingId: z.string().trim().min(1),
    experienceId: z.string().trim().min(1),
    evidenceId: z.string().trim().min(1),
    source: z.enum(["research_finding", "experience_evidence"]).default("research_finding"),
    sourceEvidenceIds: z.array(z.string().trim().min(1)).default([]),
    candidates: z.array(candidateSchema).min(1).max(3),
    createdAt: z.string().trim().min(1),
    mode: z.literal("provider"),
    status: z.enum(["pending", "applied"]),
    appliedAt: z.string().trim().min(1).optional(),
    appliedCandidateIndex: z.number().int().min(0).optional(),
    appliedBulletId: z.string().trim().min(1).optional(),
    appliedText: z.string().trim().min(1).max(800).optional(),
  })
  .refine(
    (value) =>
      value.status === "applied"
        ? Boolean(
            value.appliedAt &&
              value.appliedBulletId &&
              typeof value.appliedCandidateIndex === "number" &&
              typeof value.appliedText === "string",
          )
        : !value.appliedAt && !value.appliedBulletId && value.appliedCandidateIndex === undefined && value.appliedText === undefined,
    { message: "草稿 applied 状态字段不一致" },
  );

export class CoachBulletDraftStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CoachBulletDraftStorageError";
  }
}

function ensureWorkspaceDraftPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const projectsRoot = path.resolve(getProjectsRoot());
  const relative = path.relative(projectsRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CoachBulletDraftStorageError("草稿路径不在 workspace/projects 内");
  }
  return resolved;
}

function resolveDraftPath(resumeFilePath: string, draftId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(draftId)) {
    throw new CoachBulletDraftStorageError("草稿 ID 无效");
  }
  const draftDir = path.resolve(getResumeBulletDraftDir(resumeFilePath));
  const draftPath = path.resolve(getResumeBulletDraftPath(resumeFilePath, draftId));
  const relative = path.relative(draftDir, draftPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CoachBulletDraftStorageError("草稿路径不在当前简历 bullet_drafts 内");
  }
  return ensureWorkspaceDraftPath(draftPath);
}

function resolveStoredDraftPath(input: {
  resumeFilePath: string;
  draftId: string;
  storedFilePath: string;
}): string {
  const expected = resolveDraftPath(input.resumeFilePath, input.draftId);
  const stored = ensureWorkspaceDraftPath(input.storedFilePath);
  if (stored !== expected) {
    throw new CoachBulletDraftStorageError("草稿路径不属于当前简历 bullet_drafts 目录");
  }
  return expected;
}

function readResumeOwner(projectId: string, resumeId: string): ResumeOwnerRow | null {
  const row = getDb()
    .prepare(`SELECT id, project_id, file_path FROM resumes WHERE id = ? AND project_id = ?`)
    .get(resumeId, projectId) as ResumeOwnerRow | undefined;
  return row ?? null;
}

function rowToRecord(row: DraftRow): CoachBulletDraftRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    resumeId: row.resume_id,
    reportId: row.report_id,
    findingId: row.finding_id,
    experienceId: row.experience_id,
    evidenceId: row.evidence_id,
    filePath: row.file_path,
    status: row.status === "applied" ? "applied" : "pending",
    createdAt: row.created_at,
  };
}

function parseDraft(value: unknown, expected: { projectId: string; resumeId: string; draftId: string }): CoachBulletDraft {
  const parsed = bulletDraftV1Schema.safeParse(value);
  if (!parsed.success) {
    throw new CoachBulletDraftStorageError("草稿文件结构不符合契约");
  }
  if (parsed.data.projectId !== expected.projectId || parsed.data.resumeId !== expected.resumeId) {
    throw new CoachBulletDraftStorageError("草稿不属于当前项目或简历");
  }
  if (parsed.data.id !== expected.draftId) {
    throw new CoachBulletDraftStorageError("草稿索引与文件内容不匹配");
  }
  return parsed.data;
}

async function readDraftFile(input: {
  resumeFilePath: string;
  storedFilePath: string;
  expected: { projectId: string; resumeId: string; draftId: string };
}): Promise<CoachBulletDraft> {
  const safePath = resolveStoredDraftPath({
    resumeFilePath: input.resumeFilePath,
    draftId: input.expected.draftId,
    storedFilePath: input.storedFilePath,
  });

  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(safePath, "utf-8"));
  } catch (error) {
    throw new CoachBulletDraftStorageError("草稿文件无法读取或不是有效 JSON", { cause: error });
  }
  return parseDraft(json, input.expected);
}

export async function createBulletDraftRecord(input: {
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
  experienceId: string;
  evidenceId: string;
  candidates: CoachBulletDraftCandidate[];
}): Promise<CoachBulletDraftRecord> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachBulletDraftStorageError("简历不存在或不属于当前项目");

  const draftId = nanoid();
  const now = new Date().toISOString();
  const draft: CoachBulletDraft = {
    schemaVersion: "coach-bullet-draft-v1",
    id: draftId,
    projectId: input.projectId,
    resumeId: input.resumeId,
    reportId: input.reportId,
    findingId: input.findingId,
    experienceId: input.experienceId,
    evidenceId: input.evidenceId,
    source: "research_finding",
    sourceEvidenceIds: [input.evidenceId],
    candidates: input.candidates,
    createdAt: now,
    mode: "provider",
    status: "pending",
  };
  const parsed = parseDraft(draft, { projectId: input.projectId, resumeId: input.resumeId, draftId });
  const draftPath = resolveDraftPath(resume.file_path, draftId);

  await fs.mkdir(path.dirname(draftPath), { recursive: true });
  await fs.writeFile(draftPath, JSON.stringify(parsed, null, 2), "utf-8");
  await readDraftFile({
    resumeFilePath: resume.file_path,
    storedFilePath: draftPath,
    expected: { projectId: input.projectId, resumeId: input.resumeId, draftId },
  });

  try {
    getDb()
      .prepare(
        `INSERT INTO coach_bullet_drafts
           (id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(draftId, input.projectId, input.resumeId, input.reportId, input.findingId, input.experienceId, input.evidenceId, draftPath, now);
  } catch (error) {
    await fs.rm(draftPath, { force: true });
    throw new CoachBulletDraftStorageError("草稿索引写入失败，已清理草稿文件", { cause: error });
  }

  return {
    id: draftId,
    projectId: input.projectId,
    resumeId: input.resumeId,
    reportId: input.reportId,
    findingId: input.findingId,
    experienceId: input.experienceId,
    evidenceId: input.evidenceId,
    filePath: draftPath,
    status: "pending",
    createdAt: now,
  };
}

export async function createEvidenceBulletDraftRecord(input: {
  projectId: string;
  resumeId: string;
  experienceId: string;
  evidenceId: string;
  candidates: CoachBulletDraftCandidate[];
}): Promise<CoachBulletDraftRecord> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachBulletDraftStorageError("简历不存在或不属于当前项目");

  const draftId = nanoid();
  const now = new Date().toISOString();
  const draft: CoachBulletDraft = {
    schemaVersion: "coach-bullet-draft-v1",
    id: draftId,
    projectId: input.projectId,
    resumeId: input.resumeId,
    reportId: "experience-evidence",
    findingId: `evidence:${input.evidenceId}`,
    experienceId: input.experienceId,
    evidenceId: input.evidenceId,
    source: "experience_evidence",
    sourceEvidenceIds: [input.evidenceId],
    candidates: input.candidates,
    createdAt: now,
    mode: "provider",
    status: "pending",
  };
  const parsed = parseDraft(draft, { projectId: input.projectId, resumeId: input.resumeId, draftId });
  const draftPath = resolveDraftPath(resume.file_path, draftId);

  await fs.mkdir(path.dirname(draftPath), { recursive: true });
  await fs.writeFile(draftPath, JSON.stringify(parsed, null, 2), "utf-8");
  await readDraftFile({
    resumeFilePath: resume.file_path,
    storedFilePath: draftPath,
    expected: { projectId: input.projectId, resumeId: input.resumeId, draftId },
  });

  try {
    getDb()
      .prepare(
        `INSERT INTO coach_bullet_drafts
           (id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(draftId, input.projectId, input.resumeId, "experience-evidence", `evidence:${input.evidenceId}`, input.experienceId, input.evidenceId, draftPath, now);
  } catch (error) {
    await fs.rm(draftPath, { force: true });
    throw new CoachBulletDraftStorageError("草稿索引写入失败，已清理草稿文件", { cause: error });
  }

  return {
    id: draftId,
    projectId: input.projectId,
    resumeId: input.resumeId,
    reportId: "experience-evidence",
    findingId: `evidence:${input.evidenceId}`,
    experienceId: input.experienceId,
    evidenceId: input.evidenceId,
    filePath: draftPath,
    status: "pending",
    createdAt: now,
  };
}

export async function readBulletDraft(projectId: string, resumeId: string, draftId: string): Promise<CoachBulletDraft | null> {
  const resume = readResumeOwner(projectId, resumeId);
  if (!resume) return null;
  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at
       FROM coach_bullet_drafts WHERE id = ? AND project_id = ? AND resume_id = ?`,
    )
    .get(draftId, projectId, resumeId) as DraftRow | undefined;
  if (!row) return null;
  return readDraftFile({
    resumeFilePath: resume.file_path,
    storedFilePath: row.file_path,
    expected: { projectId, resumeId, draftId: row.id },
  });
}

export async function getActivePendingDraft(projectId: string, resumeId: string, findingId: string): Promise<CoachBulletDraft | null> {
  const resume = readResumeOwner(projectId, resumeId);
  if (!resume) return null;
  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at
       FROM coach_bullet_drafts
       WHERE project_id = ? AND resume_id = ? AND finding_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(projectId, resumeId, findingId) as DraftRow | undefined;
  if (!row) return null;
  return readDraftFile({
    resumeFilePath: resume.file_path,
    storedFilePath: row.file_path,
    expected: { projectId, resumeId, draftId: row.id },
  });
}

export function hasPendingDraftForFinding(projectId: string, resumeId: string, findingId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM coach_bullet_drafts
       WHERE project_id = ? AND resume_id = ? AND finding_id = ? AND status = 'pending'
       LIMIT 1`,
    )
    .get(projectId, resumeId, findingId) as { 1: number } | undefined;
  return Boolean(row);
}

export async function getActivePendingDraftForEvidence(projectId: string, resumeId: string, evidenceId: string): Promise<CoachBulletDraft | null> {
  const resume = readResumeOwner(projectId, resumeId);
  if (!resume) return null;
  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at
       FROM coach_bullet_drafts
       WHERE project_id = ? AND resume_id = ? AND finding_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(projectId, resumeId, `evidence:${evidenceId}`) as DraftRow | undefined;
  if (!row) return null;
  return readDraftFile({
    resumeFilePath: resume.file_path,
    storedFilePath: row.file_path,
    expected: { projectId, resumeId, draftId: row.id },
  });
}

export async function markBulletDraftApplied(input: {
  projectId: string;
  resumeId: string;
  draftId: string;
  patch: {
    appliedAt: string;
    appliedCandidateIndex: number;
    appliedBulletId: string;
    appliedText: string;
  };
}): Promise<void> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachBulletDraftStorageError("简历不存在或不属于当前项目");

  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at
       FROM coach_bullet_drafts WHERE id = ? AND project_id = ? AND resume_id = ?`,
    )
    .get(input.draftId, input.projectId, input.resumeId) as DraftRow | undefined;
  if (!row) throw new CoachBulletDraftStorageError("草稿不存在或不属于当前简历");
  if (row.status !== "pending") throw new CoachBulletDraftStorageError("草稿已被采纳");

  const draftPath = resolveStoredDraftPath({
    resumeFilePath: resume.file_path,
    draftId: input.draftId,
    storedFilePath: row.file_path,
  });

  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(draftPath, "utf-8"));
  } catch (error) {
    throw new CoachBulletDraftStorageError("草稿文件无法读取或不是有效 JSON", { cause: error });
  }

  const parsed = bulletDraftV1Schema.safeParse(json);
  if (!parsed.success) throw new CoachBulletDraftStorageError("草稿文件结构不符合契约");
  if (parsed.data.status !== "pending") throw new CoachBulletDraftStorageError("草稿状态非 pending");

  const next: CoachBulletDraft = {
    ...parsed.data,
    status: "applied",
    appliedAt: input.patch.appliedAt,
    appliedCandidateIndex: input.patch.appliedCandidateIndex,
    appliedBulletId: input.patch.appliedBulletId,
    appliedText: input.patch.appliedText,
  };
  const reparsed = bulletDraftV1Schema.safeParse(next);
  if (!reparsed.success) throw new CoachBulletDraftStorageError("更新后的草稿不符合契约");
  await fs.writeFile(draftPath, JSON.stringify(reparsed.data, null, 2), "utf-8");
  getDb()
    .prepare(`UPDATE coach_bullet_drafts SET status = 'applied' WHERE id = ?`)
    .run(input.draftId);
}

export async function markBulletDraftPending(input: {
  projectId: string;
  resumeId: string;
  draftId: string;
}): Promise<void> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) return;

  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at
       FROM coach_bullet_drafts WHERE id = ? AND project_id = ? AND resume_id = ?`,
    )
    .get(input.draftId, input.projectId, input.resumeId) as DraftRow | undefined;
  if (!row) return;

  const draftPath = resolveStoredDraftPath({
    resumeFilePath: resume.file_path,
    draftId: input.draftId,
    storedFilePath: row.file_path,
  });

  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(draftPath, "utf-8"));
  } catch {
    return;
  }
  const parsed = bulletDraftV1Schema.safeParse(json);
  if (!parsed.success) return;

  const next: CoachBulletDraft = {
    schemaVersion: parsed.data.schemaVersion,
    id: parsed.data.id,
    projectId: parsed.data.projectId,
    resumeId: parsed.data.resumeId,
    reportId: parsed.data.reportId,
    findingId: parsed.data.findingId,
    experienceId: parsed.data.experienceId,
    evidenceId: parsed.data.evidenceId,
    source: parsed.data.source,
    sourceEvidenceIds: parsed.data.sourceEvidenceIds,
    candidates: parsed.data.candidates,
    createdAt: parsed.data.createdAt,
    mode: parsed.data.mode,
    status: "pending",
  };
  const reparsed = bulletDraftV1Schema.safeParse(next);
  if (!reparsed.success) return;
  await fs.writeFile(draftPath, JSON.stringify(reparsed.data, null, 2), "utf-8");
  getDb()
    .prepare(`UPDATE coach_bullet_drafts SET status = 'pending' WHERE id = ?`)
    .run(input.draftId);
}

export function listBulletDraftsByFinding(projectId: string, resumeId: string, findingId: string): CoachBulletDraftRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, report_id, finding_id, experience_id, evidence_id, file_path, status, created_at
       FROM coach_bullet_drafts
       WHERE project_id = ? AND resume_id = ? AND finding_id = ?
       ORDER BY created_at DESC`,
    )
    .all(projectId, resumeId, findingId) as DraftRow[];
  return rows.map(rowToRecord);
}
