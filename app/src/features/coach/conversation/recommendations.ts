import type { ResumeDocument } from "@/features/resume/types";
import type { CoachQaAnswer } from "@/features/coach/storage";
import type { CoachQaTurn } from "@/features/coach/questions";

export type CoachRecommendedAnswer = {
  label: "保守" | "平衡" | "激进";
  text: string;
  sourceEvidenceIds: string[];
};

function evidenceForTurn(document: ResumeDocument | null, turn: CoachQaTurn | undefined) {
  if (!document || !turn || turn.targetSource !== "experience") return [];
  return document.experiences.find((item) => item.id === turn.targetId)?.evidence ?? [];
}

export function buildRecommendedAnswers(input: {
  document: ResumeDocument | null;
  activeTurn?: CoachQaTurn;
  answers: CoachQaAnswer[];
}): CoachRecommendedAnswer[] {
  const evidence = evidenceForTurn(input.document, input.activeTurn);
  const sourceEvidenceIds = evidence.map((item) => item.id);
  const latestAnswer = input.answers.find((answer) => answer.questionId === input.activeTurn?.questionId)?.answerText;
  const sample = evidence[0];

  if (!input.activeTurn) return [];

  const base = sample
    ? [sample.context, sample.task, ...sample.actions, ...sample.results.map((result) => result.metric ? `${result.text}（${result.metric}）` : result.text)].filter(Boolean).join("；")
    : latestAnswer || "先按事实补齐背景、动作、结果和证据，不补未发生的信息。";

  return [
    { label: "保守", text: `可先回答：${base}`, sourceEvidenceIds },
    { label: "平衡", text: `建议补充：背景是什么、你具体做了哪 1-2 个动作、结果如何验证。当前线索：${base}`, sourceEvidenceIds },
    { label: "激进", text: `若有证据支撑，再补量化边界、影响范围、复盘反思。禁止新增无来源数字。当前线索：${base}`, sourceEvidenceIds },
  ];
}
