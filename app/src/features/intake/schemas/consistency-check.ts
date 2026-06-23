import { z } from "zod";

/** consistency-check.md 的 LLM 输出 schema */
export const ConsistencyWarningSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  message: z.string(),
  fields: z.array(z.string()).default([]),
});

export const ConsistencyCheckResultSchema = z.object({
  warnings: z.array(ConsistencyWarningSchema).default([]),
});

export type ConsistencyWarning = z.infer<typeof ConsistencyWarningSchema>;
export type ConsistencyCheckResult = z.infer<typeof ConsistencyCheckResultSchema>;
