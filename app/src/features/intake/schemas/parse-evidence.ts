import { z } from "zod";

export const EvidenceTypeSchema = z.enum([
  "certificate",
  "open-source",
  "award",
  "blog",
  "portfolio",
  "patent",
  "talk",
  "other",
]);

export const ParsedEvidenceItemSchema = z.object({
  type: EvidenceTypeSchema.default("other"),
  content: z.string().min(1),
  note: z.string().default(""),
});

/** parse-evidence.md 的 LLM 输出 schema */
export const ParseEvidenceResultSchema = z.object({
  completeness: z.enum(["full", "partial", "empty"]),
  data: z.object({
    evidence: z.array(ParsedEvidenceItemSchema).default([]),
  }),
});

export type ParseEvidenceResult = z.infer<typeof ParseEvidenceResultSchema>;
export type ParsedEvidenceItem = z.infer<typeof ParsedEvidenceItemSchema>;