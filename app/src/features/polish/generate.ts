import "server-only";

import { z } from "zod";
import type { OpenAICompatibleConfig } from "@/features/ai/model-configs";
import { callOpenAICompatible } from "@/features/ai/providers";
import { buildPolishPrompt } from "./prompts";
import { polishTones, type PolishTone } from "./tone";

export type PolishCandidate = {
  tone: PolishTone;
  text: string;
  rationale: string;
  structure: { s?: string; t?: string; a?: string; r?: string; w1?: string; w2?: string; w3?: string };
  lowConfidence: boolean;
};

const candidateSchema = z.object({
  tone: z.enum(["conservative", "balanced", "aggressive"]),
  text: z.string().trim().min(1).max(800),
  rationale: z.string().trim().min(1).max(800),
  structure: z.object({
    s: z.string().trim().max(400).optional(),
    t: z.string().trim().max(400).optional(),
    a: z.string().trim().max(400).optional(),
    r: z.string().trim().max(400).optional(),
    w1: z.string().trim().max(400).optional(),
    w2: z.string().trim().max(400).optional(),
    w3: z.string().trim().max(400).optional(),
  }),
  lowConfidence: z.boolean().default(false),
});

const responseSchema = z.object({
  candidates: z.array(candidateSchema).length(3),
});

function fallbackCandidate(sourceBullet: string, tone: PolishTone): PolishCandidate {
  const label = polishTones.find((item) => item.tone === tone)?.label ?? tone;
  return {
    tone,
    text: sourceBullet,
    rationale: `${label}候选暂用原文；模型响应不可解析，未新增事实。`,
    structure: { s: "原文", t: "原文", a: "原文", r: "原文" },
    lowConfidence: true,
  };
}

export async function generatePolishCandidates(input: {
  config: OpenAICompatibleConfig;
  sourceBullet: string;
  evidenceSnippets: string[];
  jdContext?: string;
}): Promise<PolishCandidate[]> {
  const prompt = buildPolishPrompt(input);
  const content = await callOpenAICompatible(input.config, prompt);
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return polishTones.map((item) => fallbackCandidate(input.sourceBullet, item.tone));
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return polishTones.map((item) => fallbackCandidate(input.sourceBullet, item.tone));

  const byTone = new Map(parsed.data.candidates.map((candidate) => [candidate.tone, candidate]));
  return polishTones.map((item) => byTone.get(item.tone) ?? fallbackCandidate(input.sourceBullet, item.tone));
}
