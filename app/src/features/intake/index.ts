// intake feature 统一出口。与 pipeline/index.ts 同惯例：含 server-only 存储模块一并导出，
// 仅供 server 侧（server action / 验收脚本）消费；Client Component 不应 import 本文件。

export { applyIntakeCandidates, writeIntakeCandidate } from "./apply-candidates";
export type { IntakeApplySelection } from "./apply-candidates";

export { consolidateIntakeAnswers, consolidateIntakeAnswersRuleBased } from "./consolidate";

export {
  beginConsolidation,
  buildIntakeQuestionQueue,
  createIntakeInterviewSession,
  markApplied,
  markReview,
  nextIntakeQuestion,
  reopenCollecting,
  skipIntakeCategory,
  submitIntakeAnswer,
} from "./interview-engine";

export { shouldRunIntake } from "./interview-rules";

export { parseRawTextIntake } from "./parse-raw-text";
export type { ResumeIntakeCandidate } from "./parse-raw-text";

export { listIntakeSessions, loadIntakeSession, saveIntakeSession } from "./session-store";

export {
  INTAKE_CATEGORIES,
  INTAKE_SESSION_STATUSES,
  intakeAnswerSchema,
  intakeCategorySchema,
  intakeInterviewSessionSchema,
  intakeQuestionSchema,
  intakeSessionStatusSchema,
} from "./types";
export type {
  IntakeAnswer,
  IntakeCategory,
  IntakeInterviewSession,
  IntakeQuestion,
  IntakeSessionStatus,
} from "./types";
