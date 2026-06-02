import type { ResumeDocument } from "@/features/resume/types";
import type { CoachQaAnswer } from "@/features/coach/storage";
import { buildAdaptiveQaSession, type CoachQaSession, type CoachQuestionKind, type ExperienceDeepDiveItem } from "@/features/coach/questions";
import { scoreGrillDimensions, type CoachGrillDimensionScores } from "./ambiguity";
import { COACH_GRILL_DIMENSION_LABELS } from "./dimensions";
import { buildRecommendedAnswers, type CoachRecommendedAnswer } from "./recommendations";

export type CoachGrillSession = {
  base: CoachQaSession;
  dimensionScores: CoachGrillDimensionScores;
  weakestDimension: CoachQuestionKind;
  weakestReason: string;
  recommendedAnswers: CoachRecommendedAnswer[];
};

function weakestDimension(scores: CoachGrillDimensionScores): CoachQuestionKind {
  const order: CoachQuestionKind[] = ["context", "action", "result", "metric", "evidence", "jd-fit"];
  return order.reduce((weakest, dimension) => (scores[dimension] < scores[weakest] ? dimension : weakest), order[0]);
}

export function buildGrillSession(input: {
  queue: ExperienceDeepDiveItem[];
  answers: CoachQaAnswer[];
  document: ResumeDocument | null;
}): CoachGrillSession {
  const base = buildAdaptiveQaSession(input.queue, input.answers, input.document);
  const dimensionScores = scoreGrillDimensions({ turns: base.turns, answers: input.answers });
  const weakest = weakestDimension(dimensionScores);
  const score = dimensionScores[weakest];

  return {
    base,
    dimensionScores,
    weakestDimension: weakest,
    weakestReason: `正在追问「${COACH_GRILL_DIMENSION_LABELS[weakest]}」，当前分数 ${score.toFixed(2)}；该维度是当前材料的主要瓶颈。`,
    recommendedAnswers: buildRecommendedAnswers({
      document: input.document,
      activeTurn: base.activeTurn,
      answers: input.answers,
    }),
  };
}
