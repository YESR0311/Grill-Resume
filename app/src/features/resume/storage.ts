import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import {
  ensureProjectLayout,
  ensureWorkspaceLayout,
  getMasterResumePath,
  getProjectDir,
  getProjectsRoot,
  getResumeDraftDir,
  getResumeDraftPath,
  getResumeExportDir,
  getResumeExportPath,
  getResumeLayoutOverridesPath,
  getResumeVersionDir,
  getResumeVersionPath,
  getVariantResumeDir,
  getVariantResumePath,
} from "@/lib/workspace";
import { normalizeLayoutOverrides, type LayoutOverrides } from "@/features/layout/overrides";
import { resumeDocumentSchema } from "./schema";
import { readIssueTargetBullet, updateIssueTargetText } from "./issue-targets";
import type { IssueOptimizationDraft } from "@/features/ai/optimize-issue";
import type { ScoreIssue } from "@/features/score/resume-score";
import type {
  Award,
  Certificate,
  Education,
  Experience,
  ExportFormat,
  ExportRecord,
  Project,
  ProjectRecord,
  ResumeDocument,
  ResumeRecord,
  ResumeSection,
  SkillGroup,
  VersionRecord,
} from "./types";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  path: string;
};

type ResumeRow = {
  id: string;
  project_id: string;
  kind: "master" | "variant";
  name: string;
  target_role: string | null;
  target_jd: string | null;
  file_path: string;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  resume_id: string;
  label: string | null;
  file_path: string;
  created_at: string;
};

type ExportRow = {
  id: string;
  resume_id: string;
  format: ExportFormat;
  file_path: string;
  created_at: string;
};

type IssueOptimizationDraftJson = Omit<IssueOptimizationDraft, "issue"> & {
  issue: ScoreIssue;
};

function parseIssueOptimizationDraft(value: unknown): IssueOptimizationDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<IssueOptimizationDraftJson>;
  if (
    typeof draft.id !== "string" ||
    typeof draft.projectId !== "string" ||
    typeof draft.resumeId !== "string" ||
    typeof draft.createdAt !== "string" ||
    typeof draft.provider !== "string" ||
    typeof draft.model !== "string" ||
    typeof draft.targetPath !== "string" ||
    typeof draft.targetBulletId !== "string" ||
    typeof draft.originalText !== "string" ||
    typeof draft.proposedText !== "string" ||
    !draft.issue
  ) {
    return null;
  }
  return draft as IssueOptimizationDraft;
}

function readResumeRow(resumeId: string): ResumeRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at
       FROM resumes WHERE id = ?`,
    )
    .get(resumeId) as ResumeRow | undefined;
  return row ? rowToResume(row) : null;
}

function updateResumeTimestamps(resume: ResumeRecord, updatedAt: string): void {
  const db = getDb();
  db.prepare(`UPDATE resumes SET updated_at = ? WHERE id = ?`).run(updatedAt, resume.id);
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(updatedAt, resume.projectId);
}

function isSafeDraftId(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function resolveResumeDraftPath(resumeFilePath: string, draftId: string): string {
  if (!isSafeDraftId(draftId)) {
    throw new ResumeStorageError("优化草稿 ID 无效");
  }
  const draftDir = path.resolve(getResumeDraftDir(resumeFilePath));
  const draftPath = path.resolve(getResumeDraftPath(resumeFilePath, draftId));
  const relative = path.relative(draftDir, draftPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ResumeStorageError("优化草稿路径不在当前简历 drafts 内");
  }
  return draftPath;
}

function rowToProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    path: row.path,
  };
}

function rowToResume(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    name: row.name,
    targetRole: row.target_role ?? undefined,
    targetJd: row.target_jd ?? undefined,
    filePath: row.file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToVersion(row: VersionRow): VersionRecord {
  return {
    id: row.id,
    resumeId: row.resume_id,
    label: row.label ?? undefined,
    filePath: row.file_path,
    createdAt: row.created_at,
  };
}

function rowToExport(row: ExportRow): ExportRecord {
  return {
    id: row.id,
    resumeId: row.resume_id,
    format: row.format,
    filePath: row.file_path,
    createdAt: row.created_at,
  };
}

function emptyMasterResume(name: string): ResumeDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: "resume-local-v1",
    id: nanoid(),
    kind: "master",
    title: name,
    basics: {
      name: "",
      links: [],
    },
    education: [],
    experiences: [],
    projects: [],
    skills: [],
    certificates: [],
    awards: [],
    template: { id: "ats" },
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  };
}

export class ResumeStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResumeStorageError";
  }
}

function ensureWorkspaceFilePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const projectsRoot = path.resolve(getProjectsRoot());
  const relative = path.relative(projectsRoot, resolved);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return resolved;
  }

  const marker = `${path.sep}projects${path.sep}`;
  const index = resolved.lastIndexOf(marker);
  if (index >= 0) {
    const relocated = path.resolve(projectsRoot, resolved.slice(index + marker.length));
    const relocatedRelative = path.relative(projectsRoot, relocated);
    if (!relocatedRelative.startsWith("..") && !path.isAbsolute(relocatedRelative)) {
      return relocated;
    }
  }

  throw new ResumeStorageError("简历文件路径不在 workspace/projects 内");
}

async function writeResume(filePath: string, document: ResumeDocument): Promise<ResumeDocument> {
  const safePath = ensureWorkspaceFilePath(filePath);
  const parsed = resumeDocumentSchema.parse(document);
  await fs.writeFile(safePath, JSON.stringify(parsed, null, 2), "utf-8");
  return parsed;
}

export async function createProject(input: {
  name: string;
}): Promise<{ project: ProjectRecord; resume: ResumeRecord }> {
  const trimmed = input.name.trim();
  if (trimmed.length === 0) {
    throw new Error("项目名称不能为空");
  }

  await ensureWorkspaceLayout();
  const projectId = nanoid();
  const projectDir = getProjectDir(projectId);

  try {
    await ensureProjectLayout(projectId);

    const now = new Date().toISOString();
    const resumePath = getMasterResumePath(projectId);
    const resumeId = nanoid();

    const projectJson = {
      id: projectId,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      masterResumeId: resumeId,
    };

    await fs.writeFile(
      path.join(projectDir, "project.json"),
      JSON.stringify(projectJson, null, 2),
      "utf-8",
    );

    const resumeDoc = emptyMasterResume(trimmed);
    resumeDoc.id = resumeId;
    await writeResume(resumePath, resumeDoc);

    const db = getDb();
    const insertProject = db.prepare(
      `INSERT INTO projects (id, name, created_at, updated_at, path)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const insertResume = db.prepare(
      `INSERT INTO resumes (id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at)
       VALUES (?, ?, 'master', ?, NULL, NULL, ?, ?, ?)`,
    );
    const tx = db.transaction(() => {
      insertProject.run(projectId, trimmed, now, now, projectDir);
      insertResume.run(resumeId, projectId, trimmed, resumePath, now, now);
    });
    tx();

    return {
      project: {
        id: projectId,
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        path: projectDir,
      },
      resume: {
        id: resumeId,
        projectId,
        kind: "master",
        name: trimmed,
        filePath: resumePath,
        createdAt: now,
        updatedAt: now,
      },
    };
  } catch (error) {
    await fs.rm(projectDir, { recursive: true, force: true });
    throw error;
  }
}

export function listProjects(): ProjectRecord[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT id, name, created_at, updated_at, path FROM projects ORDER BY updated_at DESC`)
    .all() as ProjectRow[];
  return rows.map(rowToProject);
}

export function getProject(projectId: string): ProjectRecord | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT id, name, created_at, updated_at, path FROM projects WHERE id = ?`)
    .get(projectId) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function listResumes(projectId: string): ResumeRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at
       FROM resumes WHERE project_id = ? ORDER BY created_at ASC`,
    )
    .all(projectId) as ResumeRow[];
  return rows.map(rowToResume);
}

export async function readResume(filePath: string): Promise<ResumeDocument> {
  const safePath = ensureWorkspaceFilePath(filePath);
  let json: unknown;
  try {
    const raw = await fs.readFile(safePath, "utf-8");
    json = JSON.parse(raw);
  } catch (error) {
    throw new ResumeStorageError("简历文件无法读取或不是有效 JSON", {
      cause: error,
    });
  }

  const parsed = resumeDocumentSchema.safeParse(json);
  if (!parsed.success) {
    throw new ResumeStorageError("简历文件结构不符合 resume-local-v1");
  }
  return parsed.data;
}

export async function getMasterResume(projectId: string): Promise<{
  resume: ResumeRecord;
  document: ResumeDocument;
} | null> {
  const master = listResumes(projectId).find((resume) => resume.kind === "master");
  if (!master) return null;
  return {
    resume: master,
    document: await readResume(master.filePath),
  };
}

export async function getProjectResume(projectId: string, resumeId: string): Promise<{
  resume: ResumeRecord;
  document: ResumeDocument;
} | null> {
  const resume = listResumes(projectId).find((item) => item.id === resumeId);
  if (!resume) return null;
  return {
    resume,
    document: await readResume(resume.filePath),
  };
}

export async function readLayoutOverrides(projectId: string, resumeId: string): Promise<LayoutOverrides | null> {
  const resume = readResumeRow(resumeId);
  if (!resume || resume.projectId !== projectId) return null;
  const safeResumePath = ensureWorkspaceFilePath(resume.filePath);
  const overridesPath = getResumeLayoutOverridesPath(safeResumePath);
  try {
    const json = JSON.parse(await fs.readFile(overridesPath, "utf-8"));
    return normalizeLayoutOverrides(json, resume.id);
  } catch {
    return normalizeLayoutOverrides(null, resume.id);
  }
}

export async function writeLayoutOverrides(input: {
  projectId: string;
  resumeId: string;
  overrides: LayoutOverrides;
}): Promise<LayoutOverrides> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) throw new ResumeStorageError("简历不存在");

  const safeResumePath = ensureWorkspaceFilePath(resume.filePath);
  const overridesPath = getResumeLayoutOverridesPath(safeResumePath);
  const now = new Date().toISOString();
  const overrides = {
    ...normalizeLayoutOverrides(input.overrides, resume.id),
    updatedAt: now,
  };
  await fs.mkdir(path.dirname(overridesPath), { recursive: true });
  await fs.writeFile(overridesPath, JSON.stringify(overrides, null, 2), "utf-8");
  updateResumeTimestamps(resume, now);
  return overrides;
}

export function listVersions(resumeId: string): VersionRecord[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT id, resume_id, label, file_path, created_at FROM versions WHERE resume_id = ? ORDER BY created_at DESC`)
    .all(resumeId) as VersionRow[];
  return rows.map(rowToVersion);
}

export function listExports(resumeId: string): ExportRecord[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT id, resume_id, format, file_path, created_at FROM exports WHERE resume_id = ? ORDER BY created_at DESC`)
    .all(resumeId) as ExportRow[];
  return rows.map(rowToExport);
}

export function listProjectExports(projectId: string): ExportRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT exports.id, exports.resume_id, exports.format, exports.file_path, exports.created_at
       FROM exports INNER JOIN resumes ON exports.resume_id = resumes.id
       WHERE resumes.project_id = ? ORDER BY exports.created_at DESC LIMIT 10`,
    )
    .all(projectId) as ExportRow[];
  return rows.map(rowToExport);
}

export async function createExportRecord(input: {
  resumeId: string;
  format: ExportFormat;
  content: string | Buffer;
}): Promise<ExportRecord> {
  const resume = readResumeRow(input.resumeId);
  if (!resume) throw new ResumeStorageError("简历不存在");

  const exportId = nanoid();
  const now = new Date().toISOString();
  const extension =
    input.format === "json-resume"
      ? "json"
      : input.format === "docx-ats" || input.format === "docx-visual" || input.format === "docx-zh-clean"
      ? "docx"
      : input.format;
  const safeResumePath = ensureWorkspaceFilePath(resume.filePath);
  const exportDir = getResumeExportDir(safeResumePath);
  const exportPath = getResumeExportPath(safeResumePath, exportId, extension);

  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(exportPath, input.content);
  const db = getDb();
  db.prepare(`INSERT INTO exports (id, resume_id, format, file_path, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    exportId,
    input.resumeId,
    input.format,
    exportPath,
    now,
  );

  return {
    id: exportId,
    resumeId: input.resumeId,
    format: input.format,
    filePath: exportPath,
    createdAt: now,
  };
}

export async function readIssueOptimizationDraft(input: {
  projectId: string;
  resumeId: string;
  draftId: string;
}): Promise<IssueOptimizationDraft | null> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) return null;

  let safePath: string;
  try {
    safePath = resolveResumeDraftPath(resume.filePath, input.draftId);
  } catch {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(await fs.readFile(safePath, "utf-8"));
  } catch {
    return null;
  }

  const draft = parseIssueOptimizationDraft(json);
  if (!draft || draft.projectId !== input.projectId || draft.resumeId !== input.resumeId || draft.id !== input.draftId) {
    return null;
  }
  return draft;
}

export async function acceptIssueOptimizationDraft(input: {
  projectId: string;
  resumeId: string;
  draftId: string;
}): Promise<ResumeDocument> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) throw new ResumeStorageError("简历不存在");

  const draft = await readIssueOptimizationDraft(input);
  if (!draft) throw new ResumeStorageError("优化草稿不存在或不属于当前简历");

  const document = await readResume(resume.filePath);
  const currentBullet = readIssueTargetBullet(document, draft.targetPath);
  if (!currentBullet) throw new ResumeStorageError("优化目标已不存在");
  if (currentBullet.id !== draft.targetBulletId || currentBullet.text !== draft.originalText) {
    throw new ResumeStorageError("优化目标已变化，请重新生成建议");
  }

  const updated = updateIssueTargetText(document, draft.targetPath, draft.proposedText);
  if (!updated) throw new ResumeStorageError("优化目标不支持自动接受");

  const now = new Date().toISOString();
  const next = {
    ...updated,
    metadata: {
      ...updated.metadata,
      updatedAt: now,
    },
  };

  const parsed = await writeResume(resume.filePath, next);
  updateResumeTimestamps(resume, now);
  return parsed;
}

function mergeFirstItem<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing.slice(1);
  const [first, ...rest] = existing;
  if (!first) return incoming;
  return [
    {
      ...first,
      ...incoming[0],
    },
    ...rest,
  ];
}

function mergeExperiences(existing: Experience[], incoming: Experience[]): Experience[] {
  const merged = mergeFirstItem(existing, incoming);
  const first = merged[0];
  if (!first || !existing[0] || !incoming[0]) return merged;
  return [
    {
      ...first,
      evidence: incoming[0].evidence.length > 0 ? incoming[0].evidence : existing[0].evidence,
    },
    ...merged.slice(1),
  ];
}

function mergeProjects(existing: Project[], incoming: Project[]): Project[] {
  const merged = mergeFirstItem(existing, incoming);
  const first = merged[0];
  if (!first || !existing[0] || !incoming[0]) return merged;
  return [
    {
      ...first,
      evidence: incoming[0].evidence.length > 0 ? incoming[0].evidence : existing[0].evidence,
      links: incoming[0].links.length > 0 ? incoming[0].links : existing[0].links,
    },
    ...merged.slice(1),
  ];
}

type EditableResumeSection = Exclude<ResumeSection, "basics">;

function mergeEditorSections(
  document: ResumeDocument,
  sections: Partial<Pick<ResumeDocument, ResumeSection>>,
): Partial<Pick<ResumeDocument, ResumeSection>> {
  const merged: Partial<Pick<ResumeDocument, ResumeSection>> = {};
  if (sections.basics) merged.basics = sections.basics;
  if (sections.education) merged.education = mergeFirstItem(document.education, sections.education);
  if (sections.experiences) merged.experiences = mergeExperiences(document.experiences, sections.experiences);
  if (sections.projects) merged.projects = mergeProjects(document.projects, sections.projects);
  if (sections.skills) merged.skills = mergeFirstItem(document.skills, sections.skills);
  if (sections.certificates) merged.certificates = mergeFirstItem(document.certificates, sections.certificates);
  if (sections.awards) merged.awards = mergeFirstItem(document.awards, sections.awards);
  return merged;
}

export async function updateResumeSections(
  resumeId: string,
  sections: Partial<Pick<ResumeDocument, ResumeSection>>,
): Promise<ResumeDocument> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at
       FROM resumes WHERE id = ?`,
    )
    .get(resumeId) as ResumeRow | undefined;

  if (!row) {
    throw new ResumeStorageError("简历不存在");
  }

  const resume = rowToResume(row);
  const document = await readResume(resume.filePath);
  const now = new Date().toISOString();
  const mergedSections = mergeEditorSections(document, sections);
  const next = {
    ...document,
    ...mergedSections,
    metadata: {
      ...document.metadata,
      updatedAt: now,
    },
  };

  const parsed = await writeResume(resume.filePath, next);
  db.prepare(`UPDATE resumes SET updated_at = ? WHERE id = ?`).run(now, resumeId);
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now, resume.projectId);
  return parsed;
}

export async function updateResumeSection<K extends EditableResumeSection>(
  resumeId: string,
  section: K,
  value: ResumeDocument[K],
): Promise<ResumeDocument> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at
       FROM resumes WHERE id = ?`,
    )
    .get(resumeId) as ResumeRow | undefined;

  if (!row) {
    throw new ResumeStorageError("简历不存在");
  }

  const resume = rowToResume(row);
  const document = await readResume(resume.filePath);
  const now = new Date().toISOString();
  const next = {
    ...document,
    [section]: value,
    metadata: {
      ...document.metadata,
      updatedAt: now,
    },
  };

  const parsed = await writeResume(resume.filePath, next);
  db.prepare(`UPDATE resumes SET updated_at = ? WHERE id = ?`).run(now, resumeId);
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now, resume.projectId);
  return parsed;
}

export async function saveResumeVersion(resumeId: string, label: string): Promise<VersionRecord> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at
       FROM resumes WHERE id = ?`,
    )
    .get(resumeId) as ResumeRow | undefined;
  if (!row) throw new ResumeStorageError("简历不存在");

  const resume = rowToResume(row);
  const document = await readResume(resume.filePath);
  const versionId = nanoid();
  const now = new Date().toISOString();
  const versionDir = getResumeVersionDir(resume.filePath);
  const versionPath = getResumeVersionPath(resume.filePath, versionId);
  const versionLabel = label.trim() || `版本 ${now.slice(0, 16).replace("T", " ")}`;

  await fs.mkdir(versionDir, { recursive: true });
  await fs.writeFile(versionPath, JSON.stringify(document, null, 2), "utf-8");
  db.prepare(`INSERT INTO versions (id, resume_id, label, file_path, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    versionId,
    resumeId,
    versionLabel,
    versionPath,
    now,
  );

  return {
    id: versionId,
    resumeId,
    label: versionLabel,
    filePath: versionPath,
    createdAt: now,
  };
}

export async function restoreResumeVersion(resumeId: string, versionId: string): Promise<ResumeDocument> {
  const db = getDb();
  const resumeRow = db
    .prepare(
      `SELECT id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at
       FROM resumes WHERE id = ?`,
    )
    .get(resumeId) as ResumeRow | undefined;
  if (!resumeRow) throw new ResumeStorageError("简历不存在");

  const versionRow = db
    .prepare(`SELECT id, resume_id, label, file_path, created_at FROM versions WHERE id = ? AND resume_id = ?`)
    .get(versionId, resumeId) as VersionRow | undefined;
  if (!versionRow) throw new ResumeStorageError("版本不存在或不属于当前简历");

  const resume = rowToResume(resumeRow);
  const current = await readResume(resume.filePath);
  const snapshot = await readResume(versionRow.file_path);
  const now = new Date().toISOString();
  const next = {
    ...snapshot,
    id: current.id,
    kind: current.kind,
    metadata: {
      ...snapshot.metadata,
      createdAt: current.metadata.createdAt,
      updatedAt: now,
    },
  };

  const parsed = await writeResume(resume.filePath, next);
  db.prepare(`UPDATE resumes SET updated_at = ? WHERE id = ?`).run(now, resumeId);
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now, resume.projectId);
  return parsed;
}

export async function createVariantFromMaster(input: {
  projectId: string;
  title: string;
  targetRole?: string;
  targetJd?: string;
}): Promise<ResumeRecord> {
  const master = await getMasterResume(input.projectId);
  if (!master) throw new ResumeStorageError("主简历不存在");

  const now = new Date().toISOString();
  const variantId = nanoid();
  const targetRole = input.targetRole?.trim() || undefined;
  const targetJd = input.targetJd?.trim() || undefined;
  const title = input.title.trim() || targetRole || `${master.document.title} 岗位版`;
  const variantDir = getVariantResumeDir(input.projectId, variantId);
  const variantPath = getVariantResumePath(input.projectId, variantId);
  const document: ResumeDocument = {
    ...master.document,
    id: variantId,
    kind: "variant",
    title,
    target: targetRole || targetJd ? { role: targetRole, jdText: targetJd } : master.document.target,
    basics: {
      ...master.document.basics,
      targetRole: targetRole ?? master.document.basics.targetRole,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  };

  await fs.mkdir(path.join(variantDir, "drafts"), { recursive: true });
  await fs.mkdir(path.join(variantDir, "versions"), { recursive: true });
  await fs.mkdir(path.join(variantDir, "exports"), { recursive: true });
  await fs.mkdir(path.join(variantDir, "reports"), { recursive: true });
  await fs.mkdir(path.join(variantDir, "bullet_drafts"), { recursive: true });
  await fs.mkdir(path.join(variantDir, "qa"), { recursive: true });
  await writeResume(variantPath, document);

  const db = getDb();
  db.prepare(
    `INSERT INTO resumes (id, project_id, kind, name, target_role, target_jd, file_path, created_at, updated_at)
     VALUES (?, ?, 'variant', ?, ?, ?, ?, ?, ?)`,
  ).run(variantId, input.projectId, title, targetRole ?? null, targetJd ?? null, variantPath, now, now);
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now, input.projectId);

  return {
    id: variantId,
    projectId: input.projectId,
    kind: "variant",
    name: title,
    targetRole,
    targetJd,
    filePath: variantPath,
    createdAt: now,
    updatedAt: now,
  };
}

export async function appendExperienceEvidence(input: {
  projectId: string;
  resumeId: string;
  experienceId: string;
  star: {
    context?: string;
    task?: string;
    actions: string[];
    results: { text: string; metric?: string; confidence: "confirmed" | "needs_confirmation" }[];
    skills: string[];
    scope?: string;
    reflection?: string;
    sourceText?: string;
  };
}): Promise<{ evidenceId: string }> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) {
    throw new ResumeStorageError("简历不存在或不属于当前项目");
  }

  const document = await readResume(resume.filePath);
  const target = document.experiences.find((item) => item.id === input.experienceId);
  if (!target) {
    throw new ResumeStorageError("经历不存在或不属于当前简历");
  }

  const evidenceId = nanoid();
  const next: ResumeDocument = {
    ...document,
    experiences: document.experiences.map((item) =>
      item.id === input.experienceId
        ? {
            ...item,
            evidence: [
              ...item.evidence,
              {
                id: evidenceId,
                context: input.star.context,
                task: input.star.task,
                actions: input.star.actions,
                results: input.star.results,
                skills: input.star.skills,
                scope: input.star.scope,
                reflection: input.star.reflection,
                sourceText: input.star.sourceText,
              },
            ],
          }
        : item,
    ),
    metadata: {
      ...document.metadata,
      updatedAt: new Date().toISOString(),
    },
  };

  await writeResume(resume.filePath, next);
  updateResumeTimestamps(resume, next.metadata.updatedAt);
  return { evidenceId };
}

export async function removeExperienceEvidence(input: {
  projectId: string;
  resumeId: string;
  experienceId: string;
  evidenceId: string;
}): Promise<void> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) return;

  const document = await readResume(resume.filePath);
  const target = document.experiences.find((item) => item.id === input.experienceId);
  if (!target) return;
  if (!target.evidence.some((entry) => entry.id === input.evidenceId)) return;

  const now = new Date().toISOString();
  const next: ResumeDocument = {
    ...document,
    experiences: document.experiences.map((item) =>
      item.id === input.experienceId
        ? {
            ...item,
            evidence: item.evidence.filter((entry) => entry.id !== input.evidenceId),
          }
        : item,
    ),
    metadata: {
      ...document.metadata,
      updatedAt: now,
    },
  };

  await writeResume(resume.filePath, next);
  updateResumeTimestamps(resume, now);
}

export async function appendExperienceBullet(input: {
  projectId: string;
  resumeId: string;
  experienceId: string;
  bullet: { id: string; text: string; sourceEvidenceIds: string[]; polishCandidateId?: string; polishAppliedAt?: string };
}): Promise<{ bulletId: string }> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) {
    throw new ResumeStorageError("简历不存在或不属于当前项目");
  }

  const document = await readResume(resume.filePath);
  const target = document.experiences.find((item) => item.id === input.experienceId);
  if (!target) {
    throw new ResumeStorageError("经历不存在或不属于当前简历");
  }
  const trimmed = input.bullet.text.trim();
  if (!trimmed) {
    throw new ResumeStorageError("Bullet 文本不能为空");
  }

  const now = new Date().toISOString();
  const next: ResumeDocument = {
    ...document,
    experiences: document.experiences.map((item) =>
      item.id === input.experienceId
        ? {
            ...item,
            bullets: [
              ...item.bullets,
              {
                id: input.bullet.id,
                text: trimmed,
                sourceEvidenceIds: input.bullet.sourceEvidenceIds,
                qualityFlags: [],
                status: "confirmed",
                polishCandidateId: input.bullet.polishCandidateId,
                polishAppliedAt: input.bullet.polishAppliedAt,
              },
            ],
          }
        : item,
    ),
    metadata: {
      ...document.metadata,
      updatedAt: now,
    },
  };

  await writeResume(resume.filePath, next);
  updateResumeTimestamps(resume, now);
  return { bulletId: input.bullet.id };
}

export async function archiveExperienceBullet(input: {
  projectId: string;
  resumeId: string;
  experienceId: string;
  bulletId: string;
}): Promise<void> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) return;

  const document = await readResume(resume.filePath);
  const target = document.experiences.find((item) => item.id === input.experienceId);
  if (!target) return;
  if (!target.bullets.some((b) => b.id === input.bulletId && b.status === "confirmed")) return;

  const now = new Date().toISOString();
  const next: ResumeDocument = {
    ...document,
    experiences: document.experiences.map((item) =>
      item.id === input.experienceId
        ? {
            ...item,
            bullets: item.bullets.map((bullet) =>
              bullet.id === input.bulletId ? { ...bullet, status: "archived" } : bullet,
            ),
          }
        : item,
    ),
    metadata: {
      ...document.metadata,
      updatedAt: now,
    },
  };

  await writeResume(resume.filePath, next);
  updateResumeTimestamps(resume, now);
}

export async function removeExperienceBullet(input: {
  projectId: string;
  resumeId: string;
  experienceId: string;
  bulletId: string;
}): Promise<void> {
  const resume = readResumeRow(input.resumeId);
  if (!resume || resume.projectId !== input.projectId) return;

  const document = await readResume(resume.filePath);
  const target = document.experiences.find((item) => item.id === input.experienceId);
  if (!target) return;
  if (!target.bullets.some((b) => b.id === input.bulletId)) return;

  const now = new Date().toISOString();
  const next: ResumeDocument = {
    ...document,
    experiences: document.experiences.map((item) =>
      item.id === input.experienceId
        ? {
            ...item,
            bullets: item.bullets.filter((b) => b.id !== input.bulletId),
          }
        : item,
    ),
    metadata: {
      ...document.metadata,
      updatedAt: now,
    },
  };

  await writeResume(resume.filePath, next);
  updateResumeTimestamps(resume, now);
}

export function parseEducation(formData: FormData): Education[] {
  const school = String(formData.get("educationSchool") ?? "").trim();
  const degree = String(formData.get("educationDegree") ?? "").trim();
  const major = String(formData.get("educationMajor") ?? "").trim();
  if (!school && !degree && !major) return [];
  if (!school || !degree || !major) {
    throw new ResumeStorageError("教育经历需填写学校、学历和专业");
  }
  return [
    {
      id: String(formData.get("educationId") || nanoid()),
      school,
      degree,
      major,
      startDate: String(formData.get("educationStartDate") ?? "").trim() || undefined,
      endDate: String(formData.get("educationEndDate") ?? "").trim() || undefined,
      gpa: String(formData.get("educationGpa") ?? "").trim() || undefined,
      honors: String(formData.get("educationHonors") ?? "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    },
  ];
}

export function parseExperiences(formData: FormData): Experience[] {
  const organization = String(formData.get("experienceOrganization") ?? "").trim();
  const role = String(formData.get("experienceRole") ?? "").trim();
  const bulletText = String(formData.get("experienceBullet") ?? "").trim();
  if (!organization && !role && !bulletText) return [];
  if (!organization || !role) {
    throw new ResumeStorageError("经历需填写组织和角色");
  }
  return [
    {
      id: String(formData.get("experienceId") || nanoid()),
      organization,
      role,
      startDate: String(formData.get("experienceStartDate") ?? "").trim() || undefined,
      endDate: String(formData.get("experienceEndDate") ?? "").trim() || undefined,
      evidence: [],
      bullets: bulletText
        ? [
            {
              id: String(formData.get("experienceBulletId") || nanoid()),
              text: bulletText,
              sourceEvidenceIds: [],
              qualityFlags: [],
              status: "confirmed",
            },
          ]
        : [],
    },
  ];
}

export function parseProjects(formData: FormData): Project[] {
  const name = String(formData.get("projectName") ?? "").trim();
  const role = String(formData.get("projectRole") ?? "").trim();
  const bulletText = String(formData.get("projectBullet") ?? "").trim();
  if (!name && !role && !bulletText) return [];
  if (!name) {
    throw new ResumeStorageError("项目需填写名称");
  }
  return [
    {
      id: String(formData.get("projectId") || nanoid()),
      name,
      role: role || undefined,
      techStack: String(formData.get("projectTechStack") ?? "")
        .split(/[，,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
      links: [],
      evidence: [],
      bullets: bulletText
        ? [
            {
              id: String(formData.get("projectBulletId") || nanoid()),
              text: bulletText,
              sourceEvidenceIds: [],
              qualityFlags: [],
              status: "confirmed",
            },
          ]
        : [],
    },
  ];
}

export function parseSkills(formData: FormData): SkillGroup[] {
  const items = String(formData.get("skillItems") ?? "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return [];
  return [
    {
      id: String(formData.get("skillId") || nanoid()),
      category: "tools",
      name: String(formData.get("skillName") ?? "技能").trim() || "技能",
      items,
    },
  ];
}

export function parseCertificates(formData: FormData): Certificate[] {
  const name = String(formData.get("certificateName") ?? "").trim();
  if (!name) return [];
  return [
    {
      id: String(formData.get("certificateId") || nanoid()),
      name,
      issuer: String(formData.get("certificateIssuer") ?? "").trim() || undefined,
      date: String(formData.get("certificateDate") ?? "").trim() || undefined,
    },
  ];
}

export function parseAwards(formData: FormData): Award[] {
  const name = String(formData.get("awardName") ?? "").trim();
  if (!name) return [];
  return [
    {
      id: String(formData.get("awardId") || nanoid()),
      name,
      issuer: String(formData.get("awardIssuer") ?? "").trim() || undefined,
      date: String(formData.get("awardDate") ?? "").trim() || undefined,
    },
  ];
}
