import type { CoachQuestionKind } from "@/features/coach/questions";

export const COACH_GRILL_DIMENSIONS: CoachQuestionKind[] = ["context", "action", "result", "metric", "evidence", "jd-fit"];

export const COACH_GRILL_DIMENSION_LABELS: Record<CoachQuestionKind, string> = {
  context: "背景清晰度",
  action: "行动细节",
  result: "结果表达",
  metric: "量化可信度",
  evidence: "证据强度",
  "jd-fit": "岗位匹配",
};
