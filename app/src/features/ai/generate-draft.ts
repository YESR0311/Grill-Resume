import { promises as fs } from "node:fs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDefaultModelConfig } from "./model-configs";
import { buildDraftPrompt } from "./prompts";
import { callOpenAICompatible } from "./providers";
import { getProjectResume } from "@/features/resume/storage";
import { getResumeDraftDir, getResumeDraftPath } from "@/lib/workspace";
import type { Experience, Project, ResumeDocument } from "@/features/resume/types";

const draftSchema = z.object({
  experiences: z.array(z.unknown()).default([]),
  projects: z.array(z.unknown()).default([]),
  suggestions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export type DraftGenerationResult = {
  draftId: string;
  filePath: string;
  suggestions: string[];
  risks: string[];
};

function draftPath(resumeFilePath: string, draftId: string): string {
  return getResumeDraftPath(resumeFilePath, draftId);
}

export async function generateDraft(input: {
  projectId: string;
  resumeId: string;
  document: ResumeDocument;
  freeText: string;
}): Promise<DraftGenerationResult> {
  const current = await getProjectResume(input.projectId, input.resumeId);
  if (!current) {
    throw new Error("简历不存在");
  }

  const config = await getDefaultModelConfig();
  if (!config) {
    throw new Error("请先在模型设置中配置 OpenAI-compatible 模型");
  }

  const content = await callOpenAICompatible(config, buildDraftPrompt(input.document, input.freeText));
  const parsed = draftSchema.parse(JSON.parse(content));
  const draftId = nanoid();
  const filePath = draftPath(current.resume.filePath, draftId);
  const payload = {
    id: draftId,
    createdAt: new Date().toISOString(),
    provider: config.provider,
    model: config.model,
    experiences: parsed.experiences as Experience[],
    projects: parsed.projects as Project[],
    suggestions: parsed.suggestions,
    risks: parsed.risks,
  };
  await fs.mkdir(getResumeDraftDir(current.resume.filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return {
    draftId,
    filePath,
    suggestions: parsed.suggestions,
    risks: parsed.risks,
  };
}
