import { z } from "zod";

export const ParsedEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().default(""),
  field: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
});

/** parse-education.md 的 LLM 输出 schema */
export const ParseEducationResultSchema = z.object({
  completeness: z.enum(["full", "partial", "empty"]),
  data: z.object({
    education: z.array(ParsedEducationSchema).default([]),
  }),
});

export type ParseEducationResult = z.infer<typeof ParseEducationResultSchema>;