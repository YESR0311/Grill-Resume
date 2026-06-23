import { z } from "zod";

export const ParsedProjectSchema = z.object({
  name: z.string().min(1),
  role: z.string().default(""),
  description: z.string().default(""),
  evidence: z.array(z.string()).default([]),
});

/** parse-project.md 的 LLM 输出 schema */
export const ParseProjectResultSchema = z.object({
  completeness: z.enum(["full", "partial", "empty"]),
  data: z.object({
    projects: z.array(ParsedProjectSchema).default([]),
  }),
});

export type ParseProjectResult = z.infer<typeof ParseProjectResultSchema>;