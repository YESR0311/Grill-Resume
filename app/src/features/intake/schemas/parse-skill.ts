import { z } from "zod";

export const ParsedSkillGroupSchema = z.object({
  category: z.string().default("通用"),
  skills: z.array(z.string()).default([]),
});

/** parse-skill.md 的 LLM 输出 schema */
export const ParseSkillResultSchema = z.object({
  completeness: z.enum(["full", "partial", "empty"]),
  data: z.object({
    skillGroups: z.array(ParsedSkillGroupSchema).default([]),
  }),
});

export type ParseSkillResult = z.infer<typeof ParseSkillResultSchema>;