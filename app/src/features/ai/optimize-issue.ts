import { promises as fs } from "node:fs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getDefaultModelConfig } from "./model-configs";
import { buildIssueOptimizationPrompt } from "./prompts";
import { callOpenAICompatible } from "./providers";
import { getResumeDraftDir, getResumeDraftPath } from "@/lib/workspace";
import type { ResumeDocument } from "@/features/resume/types";
import type { ScoreIssue } from "@/features/score/resume-score";

const optimizationSchema = z.object({
  proposedText: z.string().trim().min(1),
  rationale: z.string().trim().optional(),
});

export type IssueOptimizationDraft = {
  id: string;
  projectId: string;
  resumeId: string;
  createdAt: string;
  provider: string;
  model: string;
  issue: ScoreIssue;
  targetPath: string;
  targetBulletId: string;
  originalText: string;
  proposedText: string;
  rationale?: string;
};

export async function generateIssueOptimization(input: {
  projectId: string;
  resumeId: string;
  resumeFilePath: string;
  document: ResumeDocument;
  issue: ScoreIssue;
  targetPath: string;
  targetBulletId: string;
  originalText: string;
}): Promise<IssueOptimizationDraft> {
  const config = await getDefaultModelConfig();
  if (!config) {
    throw new Error("请先在模型设置中配置 OpenAI-compatible 模型");
  }

  const content = await callOpenAICompatible(
    config,
    buildIssueOptimizationPrompt({
      document: input.document,
      issue: input.issue,
      targetPath: input.targetPath,
      originalText: input.originalText,
    }),
  );
  const parsed = optimizationSchema.parse(JSON.parse(content));
  const draftId = nanoid();
  const draft: IssueOptimizationDraft = {
    id: draftId,
    projectId: input.projectId,
    resumeId: input.resumeId,
    createdAt: new Date().toISOString(),
    provider: config.provider,
    model: config.model,
    issue: input.issue,
    targetPath: input.targetPath,
    targetBulletId: input.targetBulletId,
    originalText: input.originalText,
    proposedText: parsed.proposedText,
    rationale: parsed.rationale,
  };

  await fs.mkdir(getResumeDraftDir(input.resumeFilePath), { recursive: true });
  await fs.writeFile(getResumeDraftPath(input.resumeFilePath, draftId), JSON.stringify(draft, null, 2), "utf-8");
  return draft;
}
