import { z } from "zod";

export const ParsedExperienceSchema = z.object({
  organization: z.string().min(1),
  role: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

/** parse-experience.md 的 LLM 输出 schema */
export const ParseExperienceResultSchema = z.object({
  completeness: z.enum(["full", "partial", "empty"]),
  data: z.object({
    experiences: z.array(ParsedExperienceSchema).default([]),
  }),
});

export type ParseExperienceResult = z.infer<typeof ParseExperienceResultSchema>;