import { z } from "zod";

/** parse-basics.md 的 LLM 输出 schema */
export const ParseBasicsResultSchema = z.object({
  completeness: z.enum(["full", "partial", "empty"]),
  data: z.object({
    name: z.string().nullable(),
    title: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
  }),
});

export type ParseBasicsResult = z.infer<typeof ParseBasicsResultSchema>;
