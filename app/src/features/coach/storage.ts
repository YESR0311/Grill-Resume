import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getProjectsRoot, getResumeQaAnswersPath, getResumeQaDir, getResumeReportDir, getResumeReportPath } from "@/lib/workspace";
import { resumeDocumentSchema } from "@/features/resume/schema";
import { grillEnhancementSchema, type GrillEnhancement } from "./conversation/llm-enhance";
import { buildExperienceQuestionQueue, type CoachQaTurn, type CoachQuestionKind } from "./questions";
import { type CoachResearchFinding, type CoachResearchReport } from "./research";

export type CoachResearchReportRecord = {
  id: string;
  projectId: string;
  resumeId: string;
  filePath: string;
  queueItemIds: string[];
  createdAt: string;
};

export type CoachQaAnswerStatus = "draft" | "confirmed" | "rejected";

export type CoachQaAnswer = {
  id: string;
  projectId: string;
  resumeId: string;
  targetId: string;
  targetSource: "experience" | "project";
  questionId: string;
  questionKind: CoachQuestionKind;
  questionPrompt: string;
  answerText: string;
  status: CoachQaAnswerStatus;
  createdAt: string;
  updatedAt: string;
};

export type CoachGrillEnhancementRecord = {
  schemaVersion: "coach-grill-enhancement-record-v1";
  projectId: string;
  resumeId: string;
  targetId: string;
  targetSource: CoachQaAnswer["targetSource"];
  questionId: string;
  questionKind: CoachQuestionKind;
  questionPrompt: string;
  enhancement: GrillEnhancement;
  createdAt: string;
};

type CoachReportRow = {
  id: string;
  project_id: string;
  resume_id: string;
  file_path: string;
  queue_item_ids: string;
  created_at: string;
};

type ResumeOwnerRow = {
  id: string;
  project_id: string;
  file_path: string;
};

const reportCitationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url(),
  snippet: z.string().trim().min(1).max(800).optional(),
  retrievedAt: z.string().trim().min(1).optional(),
});

const reportFindingV1Schema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum(["research_fact", "research_inference", "writing_suggestion"]),
  text: z.string().trim().min(1),
  source: z.enum(["web", "ai", "resume", "jd"]),
  sourceLabel: z.string().trim().min(1),
  sourceUrl: z.string().trim().url().optional(),
  citations: z.array(reportCitationSchema).max(3).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  canEnterResume: z.literal(false),
  confirmationStatus: z.literal("unconfirmed"),
});

const reportFindingV2Schema = z
  .object({
    id: z.string().trim().min(1),
    kind: z.enum(["research_fact", "research_inference", "writing_suggestion"]),
    text: z.string().trim().min(1),
    source: z.enum(["web", "ai", "resume", "jd"]),
    sourceLabel: z.string().trim().min(1),
    sourceUrl: z.string().trim().url().optional(),
    citations: z.array(reportCitationSchema).max(3).optional(),
    confidence: z.enum(["high", "medium", "low"]),
    canEnterResume: z.boolean(),
    confirmationStatus: z.enum(["unconfirmed", "confirmed"]),
    confirmedAt: z.string().trim().min(1).optional(),
    linkedExperienceId: z.string().trim().min(1).optional(),
    linkedEvidenceId: z.string().trim().min(1).optional(),
    linkedBulletId: z.string().trim().min(1).optional(),
    appliedAt: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => {
      const confirmFieldsConsistent =
        value.confirmationStatus === "confirmed"
          ? Boolean(value.confirmedAt && value.linkedExperienceId && value.linkedEvidenceId)
          : !value.confirmedAt && !value.linkedExperienceId && !value.linkedEvidenceId;
      const bulletLinkConsistent =
        (value.linkedBulletId && value.appliedAt) || (!value.linkedBulletId && !value.appliedAt);
      const bulletLinkRequiresConfirmed =
        !value.linkedBulletId || value.confirmationStatus === "confirmed";
      return confirmFieldsConsistent && bulletLinkConsistent && bulletLinkRequiresConfirmed;
    },
    { message: "finding 状态字段不一致" },
  );


const persistedReportV1Schema = z.object({
  id: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  resumeId: z.string().trim().min(1),
  queueItemIds: z.array(z.string().trim().min(1)).min(1),
  findings: z.array(reportFindingV1Schema).min(1),
  createdAt: z.string().trim().min(1),
  mode: z.literal("provider"),
});

const persistedReportV2Schema = z.object({
  schemaVersion: z.literal("coach-report-v2"),
  id: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  resumeId: z.string().trim().min(1),
  queueItemIds: z.array(z.string().trim().min(1)).min(1),
  findings: z.array(reportFindingV2Schema).min(1),
  createdAt: z.string().trim().min(1),
  mode: z.literal("provider"),
});

const persistedReportSchema = z.union([persistedReportV2Schema, persistedReportV1Schema]);

const qaAnswerSchema = z.object({
  id: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  resumeId: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  targetSource: z.enum(["experience", "project"]),
  questionId: z.string().trim().min(1),
  questionKind: z.enum(["context", "action", "result", "metric", "evidence", "jd-fit"]),
  questionPrompt: z.string().trim().min(1).max(1000),
  answerText: z.string().trim().min(1).max(4000),
  status: z.enum(["draft", "confirmed", "rejected"]),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

const qaAnswersFileSchema = z.object({
  schemaVersion: z.literal("coach-qa-answers-v1"),
  projectId: z.string().trim().min(1),
  resumeId: z.string().trim().min(1),
  answers: z.array(qaAnswerSchema),
});

const grillEnhancementRecordSchema = z.object({
  schemaVersion: z.literal("coach-grill-enhancement-record-v1"),
  projectId: z.string().trim().min(1),
  resumeId: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  targetSource: z.enum(["experience", "project"]),
  questionId: z.string().trim().min(1),
  questionKind: z.enum(["context", "action", "result", "metric", "evidence", "jd-fit"]),
  questionPrompt: z.string().trim().min(1).max(1000),
  enhancement: grillEnhancementSchema,
  createdAt: z.string().trim().min(1),
});

export class CoachReportStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CoachReportStorageError";
  }
}

function rowToRecord(row: CoachReportRow): CoachResearchReportRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    resumeId: row.resume_id,
    filePath: row.file_path,
    queueItemIds: JSON.parse(row.queue_item_ids) as string[],
    createdAt: row.created_at,
  };
}

function ensureWorkspaceReportPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const projectsRoot = path.resolve(getProjectsRoot());
  const relative = path.relative(projectsRoot, resolved);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return resolved;
  }

  const marker = `${path.sep}简历${path.sep}app${path.sep}.workspace${path.sep}projects${path.sep}`;
  const index = resolved.lastIndexOf(marker);
  if (index >= 0) {
    const remapped = path.resolve(projectsRoot, resolved.slice(index + marker.length));
    const remappedRelative = path.relative(projectsRoot, remapped);
    if (!remappedRelative.startsWith("..") && !path.isAbsolute(remappedRelative)) return remapped;
  }

  throw new CoachReportStorageError("调研报告路径不在 workspace/projects 内");
}

function resolveReportPath(resumeFilePath: string, reportId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(reportId)) {
    throw new CoachReportStorageError("调研报告 ID 无效");
  }
  const reportDir = path.resolve(getResumeReportDir(resumeFilePath));
  const reportPath = path.resolve(getResumeReportPath(resumeFilePath, reportId));
  const relative = path.relative(reportDir, reportPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CoachReportStorageError("调研报告路径不在当前简历 reports 内");
  }
  return ensureWorkspaceReportPath(reportPath);
}

function resolveStoredReportPath(input: {
  resumeFilePath: string;
  reportId: string;
  storedFilePath: string;
}): string {
  const expectedPath = resolveReportPath(input.resumeFilePath, input.reportId);
  const storedPath = ensureWorkspaceReportPath(input.storedFilePath);
  if (storedPath !== expectedPath) {
    throw new CoachReportStorageError("调研报告路径不属于当前简历 reports 目录");
  }
  return expectedPath;
}

function resolveQaAnswersPath(resumeFilePath: string): string {
  const qaDir = path.resolve(getResumeQaDir(resumeFilePath));
  const qaPath = path.resolve(getResumeQaAnswersPath(resumeFilePath));
  const relative = path.relative(qaDir, qaPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CoachReportStorageError("Q&A 路径不在当前简历 qa 目录内");
  }
  return ensureWorkspaceReportPath(qaPath);
}

function resolveGrillEnhancementPath(resumeFilePath: string): string {
  const qaDir = path.resolve(getResumeQaDir(resumeFilePath));
  const enhancementPath = path.resolve(qaDir, "grill-enhancement.json");
  const relative = path.relative(qaDir, enhancementPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CoachReportStorageError("Grill enhancement 路径不在当前简历 qa 目录内");
  }
  return ensureWorkspaceReportPath(enhancementPath);
}

function readResumeOwner(projectId: string, resumeId: string): ResumeOwnerRow | null {
  const row = getDb()
    .prepare(`SELECT id, project_id, file_path FROM resumes WHERE id = ? AND project_id = ?`)
    .get(resumeId, projectId) as ResumeOwnerRow | undefined;
  return row ?? null;
}

function parsePersistedReport(value: unknown, expected: { projectId: string; resumeId: string; reportId: string }): CoachResearchReport {
  const parsed = persistedReportSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoachReportStorageError("调研报告文件结构不符合要求");
  }
  if (parsed.data.projectId !== expected.projectId || parsed.data.resumeId !== expected.resumeId) {
    throw new CoachReportStorageError("调研报告不属于当前项目或简历");
  }
  if (parsed.data.id !== expected.reportId) {
    throw new CoachReportStorageError("调研报告索引与文件内容不匹配");
  }
  if ("schemaVersion" in parsed.data) {
    return parsed.data;
  }
  return {
    schemaVersion: "coach-report-v2",
    id: parsed.data.id,
    projectId: parsed.data.projectId,
    resumeId: parsed.data.resumeId,
    queueItemIds: parsed.data.queueItemIds,
    createdAt: parsed.data.createdAt,
    mode: parsed.data.mode,
    findings: parsed.data.findings.map((f) => ({
      id: f.id,
      kind: f.kind,
      text: f.text,
      source: f.source,
      sourceLabel: f.sourceLabel,
      sourceUrl: f.sourceUrl,
      citations: f.citations,
      confidence: f.confidence,
      canEnterResume: false,
      confirmationStatus: "unconfirmed",
    })),
  };
}

async function readReportFile(
  input: {
    resumeFilePath: string;
    storedFilePath: string;
  },
  expected: { projectId: string; resumeId: string; reportId: string },
): Promise<CoachResearchReport> {
  const safePath = resolveStoredReportPath({
    resumeFilePath: input.resumeFilePath,
    reportId: expected.reportId,
    storedFilePath: input.storedFilePath,
  });

  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(safePath, "utf-8"));
  } catch (error) {
    throw new CoachReportStorageError("调研报告文件无法读取或不是有效 JSON", { cause: error });
  }
  return parsePersistedReport(json, expected);
}

async function readResumeDocumentForQa(resumeFilePath: string) {
  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(ensureWorkspaceReportPath(resumeFilePath), "utf-8"));
  } catch (error) {
    throw new CoachReportStorageError("简历文件无法读取或不是有效 JSON", { cause: error });
  }
  const parsed = resumeDocumentSchema.safeParse(json);
  if (!parsed.success) throw new CoachReportStorageError("简历文件结构不符合 resume-local-v1");
  return parsed.data;
}

async function readQaAnswersFile(projectId: string, resumeId: string, resumeFilePath: string): Promise<CoachQaAnswer[]> {
  const qaPath = resolveQaAnswersPath(resumeFilePath);
  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(qaPath, "utf-8"));
  } catch {
    return [];
  }
  const parsed = qaAnswersFileSchema.safeParse(json);
  if (!parsed.success) return [];
  if (parsed.data.projectId !== projectId || parsed.data.resumeId !== resumeId) return [];
  return parsed.data.answers;
}

function assertQuestionMatchesCurrentDocument(input: {
  document: Awaited<ReturnType<typeof readResumeDocumentForQa>>;
  targetId: string;
  targetSource: CoachQaAnswer["targetSource"];
  questionId: string;
  questionKind: CoachQuestionKind;
  questionPrompt: string;
}): void {
  const target = buildExperienceQuestionQueue(input.document).find((item) => item.id === input.targetId && item.source === input.targetSource);
  const question = target?.questions.find((item) => item.id === input.questionId);
  if (!question || question.kind !== input.questionKind || question.prompt !== input.questionPrompt) {
    throw new CoachReportStorageError("Q&A 问题不属于当前简历状态");
  }
}

export async function listCoachQaAnswers(projectId: string, resumeId: string): Promise<CoachQaAnswer[]> {
  const resume = readResumeOwner(projectId, resumeId);
  if (!resume) return [];
  return readQaAnswersFile(projectId, resumeId, resume.file_path);
}

export async function getCoachQaAnswerForEvidence(input: {
  projectId: string;
  resumeId: string;
  answerId: string;
}): Promise<CoachQaAnswer> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachReportStorageError("简历不存在或不属于当前项目");
  const document = await readResumeDocumentForQa(resume.file_path);
  const answers = await readQaAnswersFile(input.projectId, input.resumeId, resume.file_path);
  const answer = answers.find((item) => item.id === input.answerId);
  if (!answer) throw new CoachReportStorageError("Q&A 笔记不存在");
  if (answer.status !== "confirmed") throw new CoachReportStorageError("Q&A 笔记尚未确认为事实笔记");
  if (answer.targetSource !== "experience") throw new CoachReportStorageError("Q&A 笔记目标不是经历");
  if (!document.experiences.some((item) => item.id === answer.targetId)) {
    throw new CoachReportStorageError("Q&A 笔记对应经历不存在");
  }
  assertQuestionMatchesCurrentDocument({
    document,
    targetId: answer.targetId,
    targetSource: answer.targetSource,
    questionId: answer.questionId,
    questionKind: answer.questionKind,
    questionPrompt: answer.questionPrompt,
  });
  return answer;
}

export async function upsertCoachQaAnswer(input: {
  projectId: string;
  resumeId: string;
  targetId: string;
  targetSource: CoachQaAnswer["targetSource"];
  questionId: string;
  questionKind: CoachQuestionKind;
  questionPrompt: string;
  answerText: string;
  status: CoachQaAnswerStatus;
}): Promise<CoachQaAnswer> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachReportStorageError("简历不存在或不属于当前项目");
  const document = await readResumeDocumentForQa(resume.file_path);
  assertQuestionMatchesCurrentDocument({
    document,
    targetId: input.targetId,
    targetSource: input.targetSource,
    questionId: input.questionId,
    questionKind: input.questionKind,
    questionPrompt: input.questionPrompt,
  });

  const now = new Date().toISOString();
  const current = await readQaAnswersFile(input.projectId, input.resumeId, resume.file_path);
  const existing = current.find((item) => item.targetId === input.targetId && item.questionId === input.questionId);
  const nextAnswer: CoachQaAnswer = {
    id: existing?.id ?? nanoid(),
    projectId: input.projectId,
    resumeId: input.resumeId,
    targetId: input.targetId,
    targetSource: input.targetSource,
    questionId: input.questionId,
    questionKind: input.questionKind,
    questionPrompt: input.questionPrompt,
    answerText: input.answerText,
    status: input.status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const answers = existing
    ? current.map((item) => item.id === existing.id ? nextAnswer : item)
    : [...current, nextAnswer];
  const parsed = qaAnswersFileSchema.parse({
    schemaVersion: "coach-qa-answers-v1",
    projectId: input.projectId,
    resumeId: input.resumeId,
    answers,
  });
  const qaPath = resolveQaAnswersPath(resume.file_path);
  await fs.mkdir(path.dirname(qaPath), { recursive: true });
  await fs.writeFile(qaPath, JSON.stringify(parsed, null, 2), "utf-8");
  await readQaAnswersFile(input.projectId, input.resumeId, resume.file_path);
  return nextAnswer;
}

function enhancementMatchesTurn(record: CoachGrillEnhancementRecord, turn: CoachQaTurn | undefined): boolean {
  if (!turn) return true;
  return (
    record.targetId === turn.targetId &&
    record.targetSource === turn.targetSource &&
    record.questionId === turn.questionId &&
    record.questionKind === turn.questionKind &&
    record.questionPrompt === turn.questionPrompt
  );
}

export async function readCoachGrillEnhancement(input: {
  projectId: string;
  resumeId: string;
  activeTurn?: CoachQaTurn;
}): Promise<CoachGrillEnhancementRecord | null> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) return null;
  const enhancementPath = resolveGrillEnhancementPath(resume.file_path);
  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(enhancementPath, "utf-8"));
  } catch {
    return null;
  }
  const parsed = grillEnhancementRecordSchema.safeParse(json);
  if (!parsed.success) return null;
  if (parsed.data.projectId !== input.projectId || parsed.data.resumeId !== input.resumeId) return null;
  return enhancementMatchesTurn(parsed.data, input.activeTurn) ? parsed.data : null;
}

export async function writeCoachGrillEnhancement(input: {
  projectId: string;
  resumeId: string;
  activeTurn: CoachQaTurn;
  enhancement: GrillEnhancement;
}): Promise<CoachGrillEnhancementRecord> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachReportStorageError("简历不存在或不属于当前项目");
  const document = await readResumeDocumentForQa(resume.file_path);
  assertQuestionMatchesCurrentDocument({
    document,
    targetId: input.activeTurn.targetId,
    targetSource: input.activeTurn.targetSource,
    questionId: input.activeTurn.questionId,
    questionKind: input.activeTurn.questionKind,
    questionPrompt: input.activeTurn.questionPrompt,
  });

  const now = new Date().toISOString();
  const record = grillEnhancementRecordSchema.parse({
    schemaVersion: "coach-grill-enhancement-record-v1",
    projectId: input.projectId,
    resumeId: input.resumeId,
    targetId: input.activeTurn.targetId,
    targetSource: input.activeTurn.targetSource,
    questionId: input.activeTurn.questionId,
    questionKind: input.activeTurn.questionKind,
    questionPrompt: input.activeTurn.questionPrompt,
    enhancement: input.enhancement,
    createdAt: now,
  });
  const enhancementPath = resolveGrillEnhancementPath(resume.file_path);
  await fs.mkdir(path.dirname(enhancementPath), { recursive: true });
  await fs.writeFile(enhancementPath, JSON.stringify(record, null, 2), "utf-8");
  return record;
}

export async function createCoachResearchReport(input: {
  projectId: string;
  resumeId: string;
  queueItemIds: string[];
  findings: CoachResearchFinding[];
}): Promise<CoachResearchReportRecord> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachReportStorageError("简历不存在或不属于当前项目");

  const reportId = nanoid();
  const now = new Date().toISOString();
  const report: CoachResearchReport = {
    schemaVersion: "coach-report-v2",
    id: reportId,
    projectId: input.projectId,
    resumeId: input.resumeId,
    queueItemIds: input.queueItemIds,
    findings: input.findings,
    createdAt: now,
    mode: "provider",
  };
  const parsed = parsePersistedReport(report, {
    projectId: input.projectId,
    resumeId: input.resumeId,
    reportId,
  });
  const reportPath = resolveReportPath(resume.file_path, reportId);
  const reportDir = path.dirname(reportPath);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(parsed, null, 2), "utf-8");
  await readReportFile(
    {
      resumeFilePath: resume.file_path,
      storedFilePath: reportPath,
    },
    { projectId: input.projectId, resumeId: input.resumeId, reportId },
  );

  try {
    getDb()
      .prepare(
        `INSERT INTO coach_reports (id, project_id, resume_id, file_path, queue_item_ids, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(reportId, input.projectId, input.resumeId, reportPath, JSON.stringify(input.queueItemIds), now);
  } catch (error) {
    await fs.rm(reportPath, { force: true });
    throw new CoachReportStorageError("调研报告索引写入失败，已清理本次报告文件", { cause: error });
  }

  return {
    id: reportId,
    projectId: input.projectId,
    resumeId: input.resumeId,
    filePath: reportPath,
    queueItemIds: input.queueItemIds,
    createdAt: now,
  };
}

export function listCoachResearchReports(projectId: string, resumeId: string): CoachResearchReportRecord[] {
  if (!readResumeOwner(projectId, resumeId)) return [];
  const rows = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, file_path, queue_item_ids, created_at
       FROM coach_reports WHERE project_id = ? AND resume_id = ? ORDER BY created_at DESC`,
    )
    .all(projectId, resumeId) as CoachReportRow[];
  return rows.map(rowToRecord);
}

export async function readCoachResearchReport(projectId: string, resumeId: string, reportId: string): Promise<CoachResearchReport | null> {
  const resume = readResumeOwner(projectId, resumeId);
  if (!resume) return null;
  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, file_path, queue_item_ids, created_at
       FROM coach_reports WHERE id = ? AND project_id = ? AND resume_id = ?`,
    )
    .get(reportId, projectId, resumeId) as CoachReportRow | undefined;
  if (!row) return null;
  return readReportFile(
    {
      resumeFilePath: resume.file_path,
      storedFilePath: row.file_path,
    },
    { projectId, resumeId, reportId: row.id },
  );
}

export async function getLatestCoachResearchReport(projectId: string, resumeId: string): Promise<CoachResearchReport | null> {
  const resume = readResumeOwner(projectId, resumeId);
  if (!resume) return null;
  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, file_path, queue_item_ids, created_at
       FROM coach_reports WHERE project_id = ? AND resume_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(projectId, resumeId) as CoachReportRow | undefined;
  if (!row) return null;
  return readReportFile(
    {
      resumeFilePath: resume.file_path,
      storedFilePath: row.file_path,
    },
    { projectId, resumeId, reportId: row.id },
  );
}

export async function updateCoachFindingConfirmation(input: {
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
  patch: {
    confirmationStatus: "confirmed";
    confirmedAt: string;
    linkedExperienceId: string;
    linkedEvidenceId: string;
  };
}): Promise<void> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachReportStorageError("简历不存在或不属于当前项目");

  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, file_path, queue_item_ids, created_at
       FROM coach_reports WHERE id = ? AND project_id = ? AND resume_id = ?`,
    )
    .get(input.reportId, input.projectId, input.resumeId) as CoachReportRow | undefined;
  if (!row) throw new CoachReportStorageError("调研报告不存在或不属于当前简历");

  const reportPath = resolveStoredReportPath({
    resumeFilePath: resume.file_path,
    reportId: input.reportId,
    storedFilePath: row.file_path,
  });

  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(reportPath, "utf-8"));
  } catch (error) {
    throw new CoachReportStorageError("调研报告文件无法读取或不是有效 JSON", { cause: error });
  }

  const parsed = persistedReportSchema.safeParse(json);
  if (!parsed.success) throw new CoachReportStorageError("调研报告文件结构不符合要求");
  if (!("schemaVersion" in parsed.data)) {
    throw new CoachReportStorageError("当前报告为旧版本，请重跑后再做证据确认");
  }

  const finding = parsed.data.findings.find((item) => item.id === input.findingId);
  if (!finding) throw new CoachReportStorageError("调研项不存在");
  if (finding.confirmationStatus === "confirmed") {
    throw new CoachReportStorageError("该调研项已被确认进入证据图");
  }

  const next = {
    ...parsed.data,
    findings: parsed.data.findings.map((item) =>
      item.id === input.findingId
        ? {
            ...item,
            confirmationStatus: input.patch.confirmationStatus,
            confirmedAt: input.patch.confirmedAt,
            linkedExperienceId: input.patch.linkedExperienceId,
            linkedEvidenceId: input.patch.linkedEvidenceId,
          }
        : item,
    ),
  };

  const reparsed = persistedReportSchema.safeParse(next);
  if (!reparsed.success) throw new CoachReportStorageError("更新后的报告不符合契约");
  await fs.writeFile(reportPath, JSON.stringify(reparsed.data, null, 2), "utf-8");
}

export async function updateCoachFindingBulletLink(input: {
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
  linkedBulletId: string;
  appliedAt: string;
}): Promise<void> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) throw new CoachReportStorageError("简历不存在或不属于当前项目");

  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, file_path, queue_item_ids, created_at
       FROM coach_reports WHERE id = ? AND project_id = ? AND resume_id = ?`,
    )
    .get(input.reportId, input.projectId, input.resumeId) as CoachReportRow | undefined;
  if (!row) throw new CoachReportStorageError("调研报告不存在或不属于当前简历");

  const reportPath = resolveStoredReportPath({
    resumeFilePath: resume.file_path,
    reportId: input.reportId,
    storedFilePath: row.file_path,
  });

  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(reportPath, "utf-8"));
  } catch (error) {
    throw new CoachReportStorageError("调研报告文件无法读取或不是有效 JSON", { cause: error });
  }

  const parsed = persistedReportSchema.safeParse(json);
  if (!parsed.success) throw new CoachReportStorageError("调研报告文件结构不符合要求");
  if (!("schemaVersion" in parsed.data)) {
    throw new CoachReportStorageError("当前报告为旧版本，请重跑后再做正文确认");
  }

  const finding = parsed.data.findings.find((item) => item.id === input.findingId);
  if (!finding) throw new CoachReportStorageError("调研项不存在");
  if (finding.confirmationStatus !== "confirmed") {
    throw new CoachReportStorageError("调研项尚未确认进入证据图");
  }
  if (finding.linkedBulletId) {
    throw new CoachReportStorageError("调研项已链接到正文 bullet");
  }

  const next = {
    ...parsed.data,
    findings: parsed.data.findings.map((item) =>
      item.id === input.findingId
        ? {
            ...item,
            linkedBulletId: input.linkedBulletId,
            appliedAt: input.appliedAt,
          }
        : item,
    ),
  };

  const reparsed = persistedReportSchema.safeParse(next);
  if (!reparsed.success) throw new CoachReportStorageError("更新后的报告不符合契约");
  await fs.writeFile(reportPath, JSON.stringify(reparsed.data, null, 2), "utf-8");
}

export async function clearCoachFindingBulletLink(input: {
  projectId: string;
  resumeId: string;
  reportId: string;
  findingId: string;
}): Promise<void> {
  const resume = readResumeOwner(input.projectId, input.resumeId);
  if (!resume) return;

  const row = getDb()
    .prepare(
      `SELECT id, project_id, resume_id, file_path, queue_item_ids, created_at
       FROM coach_reports WHERE id = ? AND project_id = ? AND resume_id = ?`,
    )
    .get(input.reportId, input.projectId, input.resumeId) as CoachReportRow | undefined;
  if (!row) return;

  const reportPath = resolveStoredReportPath({
    resumeFilePath: resume.file_path,
    reportId: input.reportId,
    storedFilePath: row.file_path,
  });

  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(reportPath, "utf-8"));
  } catch {
    return;
  }

  const parsed = persistedReportSchema.safeParse(json);
  if (!parsed.success || !("schemaVersion" in parsed.data)) return;

  const next = {
    ...parsed.data,
    findings: parsed.data.findings.map((item) =>
      item.id === input.findingId
        ? {
            ...item,
            linkedBulletId: undefined,
            appliedAt: undefined,
          }
        : item,
    ),
  };

  const reparsed = persistedReportSchema.safeParse(next);
  if (!reparsed.success) return;
  await fs.writeFile(reportPath, JSON.stringify(reparsed.data, null, 2), "utf-8");
}
