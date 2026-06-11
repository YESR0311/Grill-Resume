import "server-only";

import { getDefaultModelConfig } from "@/features/ai/model-configs";
import { generatePolishCandidates } from "@/features/polish/generate";
import { createPolishRun, listPolishRuns, type PolishRun } from "@/features/polish/store";
import { getProjectResume } from "@/features/resume/storage";
import type { ResumeDocument } from "@/features/resume/types";
import type { EvaluationSummary } from "./types";

export type PipelinePolishProgress = {
  eligibleBulletCount: number;
  coveredBulletCount: number;
  generatedRunCount: number;
  readyCandidateCount: number;
  resolvedRunCount: number;
};

export type EligibleBullet = {
  experienceId: string;
  sourceBulletId: string;
  sourceBulletText: string;
  sourceEvidenceIds: string[];
  evidenceSnippets: string[];
};

function eligibleBullets(document: ResumeDocument): EligibleBullet[] {
  return document.experiences.flatMap((experience) =>
    experience.bullets
      .filter((bullet) => bullet.status === "confirmed")
      .map((bullet) => {
        const evidenceSnippets = bullet.sourceEvidenceIds
          .map((id) => experience.evidence.find((item) => item.id === id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) =>
            [
              item.context,
              item.task,
              ...item.actions,
              ...item.results.map((result) => result.metric ? `${result.text}（${result.metric}）` : result.text),
            ].filter(Boolean).join("；"),
          )
          .filter(Boolean);
        return {
          experienceId: experience.id,
          sourceBulletId: bullet.id,
          sourceBulletText: bullet.text,
          sourceEvidenceIds: bullet.sourceEvidenceIds,
          evidenceSnippets,
        };
      }),
  );
}

export async function getPipelinePolishProgress(projectId: string, resumeId: string): Promise<PipelinePolishProgress> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) {
    return {
      eligibleBulletCount: 0,
      coveredBulletCount: 0,
      generatedRunCount: 0,
      readyCandidateCount: 0,
      resolvedRunCount: 0,
    };
  }
  const bullets = eligibleBullets(current.document);
  const runs = await listPolishRuns(projectId, resumeId);
  return summarizePolishProgress(bullets, runs, 0);
}

function summarizePolishProgress(
  bullets: EligibleBullet[],
  runs: PolishRun[],
  generatedRunCount: number,
): PipelinePolishProgress {
  const runBulletIds = new Set(runs.map((run) => run.sourceBulletId));
  return {
    eligibleBulletCount: bullets.length,
    coveredBulletCount: bullets.filter((bullet) => runBulletIds.has(bullet.sourceBulletId)).length,
    generatedRunCount,
    readyCandidateCount: runs.reduce(
      (count, run) => count + run.candidates.filter((candidate) => candidate.status === "ready").length,
      0,
    ),
    resolvedRunCount: runs.filter((run) => run.candidates.every((candidate) => candidate.status !== "ready")).length,
  };
}

/**
 * 按价值评级排序 eligible bullets：tier rank high=0 / medium=1 / low=2；
 * 无 summary 或该 experienceId 无评级 → rank 1（medium 档）。
 * 稳定排序：同 rank 保持入参原顺序（document.experiences 顺序），
 * 保证 summary 为 undefined 时输出顺序与排序前完全一致。
 */
export function orderEligibleBulletsByValue(
  bullets: EligibleBullet[],
  summary?: EvaluationSummary,
): EligibleBullet[] {
  if (!summary) return [...bullets];
  const tierRank: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };
  const rankOf = (bullet: EligibleBullet): number => {
    const rating = summary.experienceRatings.find((item) => item.experienceId === bullet.experienceId);
    return rating ? tierRank[rating.tier] : 1;
  };
  return bullets
    .map((bullet, index) => ({ bullet, rank: rankOf(bullet), index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.bullet);
}

export async function generateMissingPipelinePolishRuns(
  projectId: string,
  resumeId: string,
  options?: {
    evaluationSummary?: EvaluationSummary;
    limit?: number;
  },
): Promise<PipelinePolishProgress> {
  const current = await getProjectResume(projectId, resumeId);
  if (!current) {
    throw new Error("missing-resume");
  }

  const config = await getDefaultModelConfig();
  if (!config?.apiKey) {
    throw new Error("missing-model-config");
  }

  const bullets = eligibleBullets(current.document);
  const existingRuns = await listPolishRuns(projectId, resumeId);
  const existingBulletIds = new Set(existingRuns.map((run) => run.sourceBulletId));
  const pendingBullets = orderEligibleBulletsByValue(bullets, options?.evaluationSummary).filter(
    (bullet) => !existingBulletIds.has(bullet.sourceBulletId),
  );
  // limit 缺省不限；limit <= 0 视为 0（不生成，仅返回 progress）。靠 existingBulletIds 去重幂等续跑。
  const limit = options?.limit === undefined ? pendingBullets.length : Math.max(0, options.limit);
  let generatedRunCount = 0;

  for (const bullet of pendingBullets.slice(0, limit)) {
    const candidates = await generatePolishCandidates({
      config,
      sourceBullet: bullet.sourceBulletText,
      evidenceSnippets: bullet.evidenceSnippets,
      jdContext: current.document.target?.jdText || current.resume.targetJd,
    });
    const rating = options?.evaluationSummary?.experienceRatings.find(
      (item) => item.experienceId === bullet.experienceId,
    );
    await createPolishRun({
      projectId,
      resumeId,
      experienceId: bullet.experienceId,
      sourceBulletId: bullet.sourceBulletId,
      sourceBulletText: bullet.sourceBulletText,
      sourceEvidenceIds: bullet.sourceEvidenceIds,
      candidates,
      ...(rating ? { valueTier: rating.tier } : {}),
    });
    generatedRunCount += 1;
  }

  const nextRuns = await listPolishRuns(projectId, resumeId);
  return summarizePolishProgress(bullets, nextRuns, generatedRunCount);
}

export function isPipelinePolishReadyForExport(progress: PipelinePolishProgress): boolean {
  if (progress.eligibleBulletCount === 0) return false;
  return progress.coveredBulletCount >= progress.eligibleBulletCount && progress.readyCandidateCount === 0;
}
