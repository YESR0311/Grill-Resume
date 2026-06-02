import type { CoachQaAnswer } from "@/features/coach/storage";
import type { CoachQuestionKind, CoachQaTurn } from "@/features/coach/questions";
import { COACH_GRILL_DIMENSIONS } from "./dimensions";

export type CoachGrillDimensionScores = Record<CoachQuestionKind, number>;

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function answerForKind(answers: CoachQaAnswer[], kind: CoachQuestionKind): CoachQaAnswer[] {
  return answers.filter((answer) => answer.questionKind === kind && answer.status === "confirmed");
}

function metricScore(answers: CoachQaAnswer[], turns: CoachQaTurn[]): number {
  const confirmed = answerForKind(answers, "metric");
  const metricTurns = turns.filter((turn) => turn.questionKind === "metric");
  const promoted = metricTurns.filter((turn) => turn.status === "promoted").length;
  return clampScore((confirmed.length + promoted) / Math.max(1, metricTurns.length || 1));
}

export function scoreGrillDimensions(input: {
  turns: CoachQaTurn[];
  answers: CoachQaAnswer[];
}): CoachGrillDimensionScores {
  const scores = Object.fromEntries(COACH_GRILL_DIMENSIONS.map((dimension) => [dimension, 1])) as CoachGrillDimensionScores;

  for (const dimension of COACH_GRILL_DIMENSIONS) {
    const turns = input.turns.filter((turn) => turn.questionKind === dimension);
    if (turns.length === 0) {
      scores[dimension] = 1;
      continue;
    }
    const promoted = turns.filter((turn) => turn.status === "promoted").length;
    const ready = turns.filter((turn) => turn.status === "ready-to-promote" || turn.status === "answered").length;
    const blocked = turns.filter((turn) => turn.status === "blocked").length;
    const pending = turns.filter((turn) => turn.status === "pending" || turn.status === "needs-evidence").length;
    scores[dimension] = clampScore((promoted + ready * 0.65 + blocked * 0.2) / Math.max(1, promoted + ready + blocked + pending));
  }

  scores.metric = metricScore(input.answers, input.turns);
  return scores;
}
