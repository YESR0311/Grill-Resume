import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { getProjectResume, updateResumeSection } from "@/features/resume/storage";
import type { ResumeDocument } from "@/features/resume/types";
import type { ResumeIntakeCandidate } from "./parse-raw-text";

export type IntakeApplySelection = {
  educationIds?: string[];
  experienceIds?: string[];
  projectIds?: string[];
  skillIds?: string[];
};

function selected<T extends { id: string }>(items: T[], ids: string[] | undefined): T[] {
  if (!ids) return [];
  const set = new Set(ids);
  return items.filter((item) => set.has(item.id));
}

export async function writeIntakeCandidate(input: {
  projectId: string;
  resumeId: string;
  candidate: ResumeIntakeCandidate;
}): Promise<string> {
  const current = await getProjectResume(input.projectId, input.resumeId);
  if (!current) throw new Error("resume-not-found");
  const dir = path.join(path.dirname(current.resume.filePath), "intake");
  const filePath = path.join(dir, `${input.candidate.id}.json`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(input.candidate, null, 2), "utf-8");
  return filePath;
}

export async function applyIntakeCandidates(input: {
  projectId: string;
  resumeId: string;
  candidate: ResumeIntakeCandidate;
  selection: IntakeApplySelection;
}): Promise<ResumeDocument> {
  const current = await getProjectResume(input.projectId, input.resumeId);
  if (!current) throw new Error("resume-not-found");

  const education = [...current.document.education, ...selected(input.candidate.education, input.selection.educationIds)];
  const experiences = [...current.document.experiences, ...selected(input.candidate.experiences, input.selection.experienceIds)];
  const projects = [...current.document.projects, ...selected(input.candidate.projects, input.selection.projectIds)];
  const skills = [...current.document.skills, ...selected(input.candidate.skills, input.selection.skillIds)];

  await updateResumeSection(input.resumeId, "education", education);
  await updateResumeSection(input.resumeId, "experiences", experiences);
  await updateResumeSection(input.resumeId, "projects", projects);
  return updateResumeSection(input.resumeId, "skills", skills);
}
