// evaluation feature 统一出口。与 intake/index.ts 同惯例：含 server-only 模块一并导出，
// 仅供 server 侧（server action / 验收脚本）消费；Client Component 不应 import 本文件。

export {
  rateExperienceRuleBased,
  reconcileLlmRatings,
  synthesizeEvaluationSummary,
} from "./synthesize";
export type { EvaluationEngineInput, EvaluationEngineResult, LlmRating } from "./synthesize";
