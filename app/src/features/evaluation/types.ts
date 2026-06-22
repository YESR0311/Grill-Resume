import { z } from "zod";

/**
 * 逐条评估报告。
 * 评估引擎对档案的每个条目（经历/项目/技能/教育）整体评分。
 */

/** 评估单元（全档案条目统一结构） */
export type EvalUnit = {
  targetType: "experience" | "project" | "skill" | "education";
  targetId: string;
  title: string;
  content: string;
};

export const EvaluationItemSchema = z.object({
  id: z.string(),
  targetType: z.enum(["experience", "project", "skill", "education"]),
  targetId: z.string(),                // 关联的 experience.id / project.id 等

  // 条目标题+原文（字段随粒度已改：不再只是 bullet 原文）
  originalText: z.string().default(""),

  // 评估结果（6 维数值评分，1-10，精确到 0.5；design §4.2）
  relevance: z.number().min(1).max(10).default(5),     // 相关性
  specificity: z.number().min(1).max(10).default(5),   // 具体性
  credibility: z.number().min(1).max(10).default(5),   // 可信度
  recency: z.number().min(1).max(10).default(5),       // 时效性
  expression: z.number().min(1).max(10).default(5),    // 表达质量
  scarcity: z.number().min(1).max(10).default(5),      // 稀缺性
  overallScore: z.number().min(1).max(10).default(5),  // 综合分数

  // 联网佐证（本轮已删展示层，保留字段兼容 DB）
  searchEvidence: z.string().default(""),
  searchSources: z.array(z.string()).default([]),

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