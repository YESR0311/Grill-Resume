import { z } from "zod";

/**
 * 逐条评估报告。
 * 评估引擎对档案的每段经历逐条要点生成此报告。
 */

export const EvaluationItemSchema = z.object({
  id: z.string(),
  targetType: z.enum(["experience", "project", "skill", "basics"]),
  targetId: z.string(),                // 关联的 experience.id / project.id 等
  bulletId: z.string().optional(),     // 具体到某条要点时填充

  // 原文本
  originalText: z.string().default(""),

  // 评估结果（6 维数值评分，1-10，精确到 0.5；design §4.2）
  relevance: z.number().min(1).max(10).default(5),     // 相关性
  specificity: z.number().min(1).max(10).default(5),   // 具体性
  credibility: z.number().min(1).max(10).default(5),   // 可信度
  recency: z.number().min(1).max(10).default(5),       // 时效性
  expression: z.number().min(1).max(10).default(5),    // 表达质量
  scarcity: z.number().min(1).max(10).default(5),      // 稀缺性
  overallScore: z.number().min(1).max(10).default(5),  // 综合分数

  // 联网佐证
  searchEvidence: z.string().default(""),   // 联网查到的内容摘要
  searchSources: z.array(z.string()).default([]), // URL 列表

  // 改进建议（模型生成）
  suggestion: z.string().default(""),
  suggestedRewrite: z.string().default(""),

  // 状态
  status: z.enum(["pending", "searching", "done", "failed"]).default("pending"),
});

export const EvaluationReportSchema = z.object({
  profileId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(EvaluationItemSchema).default([]),
  overallSummary: z.string().default(""),
});
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
export type EvaluationItem = z.infer<typeof EvaluationItemSchema>;