import { promises as fs } from "node:fs";
import path from "node:path";

const ENV_KEY = "RESUME_WORKSPACE";

export function getWorkspaceRoot(): string {
  const fromEnv = process.env[ENV_KEY];
  if (fromEnv && fromEnv.trim().length > 0) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), ".workspace");
}

export function getProjectsRoot(): string {
  return path.join(getWorkspaceRoot(), "projects");
}

export function getSettingsRoot(): string {
  return path.join(getWorkspaceRoot(), "settings");
}

export function getDatabasePath(): string {
  return path.join(getWorkspaceRoot(), "app.db");
}

export function getProjectDir(projectId: string): string {
  return path.join(getProjectsRoot(), projectId);
}

export function getMasterResumePath(projectId: string): string {
  return path.join(getProjectDir(projectId), "resumes", "master", "resume.json");
}

export function getVariantResumeDir(projectId: string, variantId: string): string {
  return path.join(getProjectDir(projectId), "resumes", "variants", variantId);
}

export function getVariantResumePath(projectId: string, variantId: string): string {
  return path.join(getVariantResumeDir(projectId, variantId), "resume.json");
}

export function getResumeVersionDir(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "versions");
}

export function getResumeVersionPath(resumeFilePath: string, versionId: string): string {
  return path.join(getResumeVersionDir(resumeFilePath), `${versionId}.json`);
}

export function getResumeDraftDir(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "drafts");
}

export function getResumeDraftPath(resumeFilePath: string, draftId: string): string {
  return path.join(getResumeDraftDir(resumeFilePath), `${draftId}.json`);
}

export function getResumeExportDir(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "exports");
}

export function getResumeExportPath(resumeFilePath: string, exportId: string, extension: string): string {
  return path.join(getResumeExportDir(resumeFilePath), `${exportId}.${extension}`);
}

export function getResumeLayoutOverridesPath(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "layout-overrides.json");
}

export function getResumeReportDir(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "reports");
}

export function getResumeReportPath(resumeFilePath: string, reportId: string): string {
  return path.join(getResumeReportDir(resumeFilePath), `${reportId}.json`);
}

export function getResumeBulletDraftDir(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "bullet_drafts");
}

export function getResumeBulletDraftPath(resumeFilePath: string, draftId: string): string {
  return path.join(getResumeBulletDraftDir(resumeFilePath), `${draftId}.json`);
}

export function getResumeQaDir(resumeFilePath: string): string {
  return path.join(path.dirname(resumeFilePath), "qa");
}

export function getResumeQaAnswersPath(resumeFilePath: string): string {
  return path.join(getResumeQaDir(resumeFilePath), "answers.json");
}

export async function ensureWorkspaceLayout(): Promise<void> {
  await fs.mkdir(getProjectsRoot(), { recursive: true });
  await fs.mkdir(getSettingsRoot(), { recursive: true });
}

export async function ensureProjectLayout(projectId: string): Promise<void> {
  const base = getProjectDir(projectId);
  await fs.mkdir(path.join(base, "resumes", "master", "drafts"), {
    recursive: true,
  });
  await fs.mkdir(path.join(base, "resumes", "master", "versions"), {
    recursive: true,
  });
  await fs.mkdir(path.join(base, "resumes", "master", "exports"), {
    recursive: true,
  });
  await fs.mkdir(path.join(base, "resumes", "master", "reports"), {
    recursive: true,
  });
  await fs.mkdir(path.join(base, "resumes", "master", "bullet_drafts"), {
    recursive: true,
  });
  await fs.mkdir(path.join(base, "resumes", "master", "qa"), {
    recursive: true,
  });
  await fs.mkdir(path.join(base, "resumes", "variants"), { recursive: true });
  await fs.mkdir(path.join(base, "sources"), { recursive: true });
  await fs.mkdir(path.join(base, "history"), { recursive: true });
}
