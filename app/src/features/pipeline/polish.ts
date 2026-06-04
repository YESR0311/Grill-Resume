import "server-only";

import { getDefaultModelConfig } from "@/features/ai/model-configs";
import { generatePolishCandidates } from "@/features/polish/generate";
import { createPolishRun, listPolishRuns, type PolishRun } from "@/features/polish/store";
import { getProjectResume } from "@/features/resume/storage";
import type { ResumeDocument } from "@/features/resume/types";

export type PipelinePolishProgress = {
  eligibleBulletCount: number;
  coveredBulletCount: number;
  generatedRunCount: number;
  readyCandidateCount: number;
  resolvedRunCount: number;
};

type EligibleBullet = {
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

export async function generateMissingPipelinePolishRuns(
  projectId: string,
  resumeId: string,
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
  let generatedRunCount = 0;

  for (const bullet of bullets) {
    if (existingBulletIds.has(bullet.sourceBulletId)) continue;
    const candidates = await generatePolishCandidates({
      config,
      sourceBullet: bullet.sourceBulletText,
      evidenceSnippets: bullet.evidenceSnippets,
      jdContext: current.document.target?.jdText || current.resume.targetJd,
    });
    await createPolishRun({
      projectId,
      resumeId,
      experienceId: bullet.experienceId,
      sourceBulletId: bullet.sourceBulletId,
      sourceBulletText: bullet.sourceBulletText,
      sourceEvidenceIds: bullet.sourceEvidenceIds,
      candidates,
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
