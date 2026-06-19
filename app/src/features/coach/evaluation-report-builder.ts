/**
 * 评估报告视图模型构建器（M3）。
 * 纯函数、无 IO、无 UI 依赖，把 session.evaluationSummary 转成只读视图模型。
 *
 * 从 /app/projects/[projectId]/coach/components/evaluation-report-panel 析出
 * 以供新单页工作区使用，旧页面不再引用。
 */
import type { EvaluationSummary } from "@/features/pipeline/types";

export type EvaluationReportRatingView = {
  experienceId: string;
  title: string;
  resolved: boolean;
  score: number;
  tier: "high" | "medium" | "low";
  rationale: string;
  citations: string[];
};

export type EvaluationReportView = {
  empty: boolean;
  jdMatchScore?: number;
  ratings: EvaluationReportRatingView[];
  tierCounts: { high: number; medium: number; low: number };
  uncoveredKeywords: string[];
  reportId?: string;
  createdAt?: string;
};

function resolveTitle(
  experienceId: string,
  experiences: { id: string; label: string }[],
): { title: string; resolved: boolean } {
  const match = experiences.find((item) => item.id === experienceId);
  if (match) return { title: match.label, resolved: true };
  return { title: `未知经历(${experienceId.slice(0, 8)})`, resolved: false };
}

/**
 * 把 session.evaluationSummary（B5 写入，optional）转成只读视图模型。
 * 纯函数、无 IO，便于闭网验收。
 */
export function buildEvaluationReportView(input: {
  summary?: EvaluationSummary;
  experiences: { id: string; label: string }[];
}): EvaluationReportView {
  const { summary, experiences } = input;
  const ratings: EvaluationReportRatingView[] = (summary?.experienceRatings ?? []).map((rating) => {
    const { title, resolved } = resolveTitle(rating.experienceId, experiences);
    return {
      experienceId: rating.experienceId,
      title,
      resolved,
      score: rating.score,
      tier: rating.tier,
      rationale: rating.rationale,
      citations: rating.searchCitations,
    };
  });

  const tierCounts = { high: 0, medium: 0, low: 0 };
  for (const rating of ratings) tierCounts[rating.tier] += 1;

  return {
    empty: ratings.length === 0,
    jdMatchScore: summary?.jdMatchScore,
    ratings,
    tierCounts,
    uncoveredKeywords: summary?.uncoveredKeywords ?? [],
    reportId: summary?.reportId,
    createdAt: summary?.createdAt,
  };
}