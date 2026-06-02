import "server-only";

import { nanoid } from "nanoid";
import { z } from "zod";
import type { OpenAICompatibleConfig } from "@/features/ai/model-configs";
import { sanitizeOutboundPayload } from "@/features/privacy/sanitize";

export type BulletDraftEvidence = {
  context?: string;
  task?: string;
  actions: string[];
  results: { text: string; metric?: string; confidence: "confirmed" | "needs_confirmation" }[];
  skills: string[];
  scope?: string;
};

export type BulletDraftRequest = {
  targetRole: string;
  jdSummary?: string;
  evidence: BulletDraftEvidence;
};

export type BulletDraftCandidate = {
  text: string;
  rationale?: string;
};

const providerCandidateSchema = z.object({
  text: z.string().trim().min(1).max(800),
  rationale: z.string().trim().max(800).optional(),
});

const providerBulletResponseSchema = z.object({
  candidates: z.array(providerCandidateSchema).min(1).max(3),
});

const chatCompletionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable(),
      }),
    }),
  ),
});

type CoachBulletProviderErrorCode = "timeout" | "provider-failed" | "bullet-invalid-response";

export class CoachBulletProviderError extends Error {
  code: CoachBulletProviderErrorCode;

  constructor(code: CoachBulletProviderErrorCode, message: string) {
    super(message);
    this.name = "CoachBulletProviderError";
    this.code = code;
  }
}

const PROVIDER_TIMEOUT_MS = 30_000;

function compactText(value: string | undefined, maxLength: number): string | undefined {
  const compacted = value?.replace(/\s+/g, " ").trim();
  if (!compacted) return undefined;
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength)}…` : compacted;
}

export function buildBulletDraftRequest(input: {
  targetRole: string;
  jdSummary?: string;
  evidence: BulletDraftEvidence;
}): BulletDraftRequest {
  return {
    targetRole: compactText(input.targetRole, 120) ?? "目标岗位",
    jdSummary: compactText(input.jdSummary, 1200),
    evidence: {
      context: compactText(input.evidence.context, 800),
      task: compactText(input.evidence.task, 800),
      actions: input.evidence.actions.map((item) => compactText(item, 500)).filter((item): item is string => Boolean(item)),
      results: input.evidence.results.map((result) => ({
        text: compactText(result.text, 600) ?? "",
        metric: compactText(result.metric, 200),
        confidence: result.confidence,
      })).filter((item) => item.text.length > 0),
      skills: input.evidence.skills.map((item) => compactText(item, 120)).filter((item): item is string => Boolean(item)),
      scope: compactText(input.evidence.scope, 300),
    },
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function runBulletDraftWithProvider(
  config: OpenAICompatibleConfig,
  request: BulletDraftRequest,
): Promise<BulletDraftCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const endpoint = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`;
  const sanitized = sanitizeOutboundPayload(
    { model: config.model, request },
    { kind: "ai-bullet-draft", provider: config.provider, reason: "bullet candidate generation", endpoint },
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: String(sanitized.payload.model ?? config.model),
        messages: [
          {
            role: "system",
            content:
              "你是中文简历 bullet 润色助手。基于用户已确认的 STAR 证据生成 1-3 条候选 bullet。每条 ≤ 300 字，动词开头，量化结果若 STAR 中标 needs_confirmation 必须用'约/据估算/未核实'等词；不得编造 STAR 中未提供的数字、客户名、内部系统名；不得输出本机路径、文件路径、密钥、模型名。只输出 JSON object：{\"candidates\":[{\"text\":string,\"rationale\":string}]}",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "为单条 STAR 证据生成 ATS 友好的中文 bullet 候选，不得偏离证据本身。",
              requiredShape: {
                candidates: [{ text: "string", rationale: "string" }],
              },
              context: sanitized.payload.request,
            }),
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new CoachBulletProviderError("provider-failed", `模型请求失败：${response.status}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new CoachBulletProviderError("bullet-invalid-response", "模型响应不是有效 JSON");
    }

    const parsed = chatCompletionSchema.safeParse(json);
    if (!parsed.success) {
      throw new CoachBulletProviderError("bullet-invalid-response", "模型响应缺少 chat completion 内容");
    }

    const content = parsed.data.choices[0]?.message.content;
    if (!content) {
      throw new CoachBulletProviderError("bullet-invalid-response", "模型响应为空");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(content);
    } catch {
      throw new CoachBulletProviderError("bullet-invalid-response", "模型 bullet 候选不是有效 JSON");
    }

    const result = providerBulletResponseSchema.safeParse(payload);
    if (!result.success) {
      throw new CoachBulletProviderError("bullet-invalid-response", "模型返回的候选不符合契约");
    }

    return result.data.candidates.map((candidate) => ({
      text: candidate.text,
      rationale: candidate.rationale,
    }));
  } catch (error) {
    if (error instanceof CoachBulletProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new CoachBulletProviderError("timeout", "模型请求超时");
    }
    throw new CoachBulletProviderError("provider-failed", "模型请求失败，请检查网络和模型配置");
  } finally {
    clearTimeout(timeout);
  }
}

export const __internal = { providerBulletResponseSchema, nanoid };

