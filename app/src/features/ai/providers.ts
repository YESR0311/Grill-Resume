import { z } from "zod";
import type { OpenAICompatibleConfig } from "./model-configs";
import { sanitizeOutboundPayload } from "@/features/privacy/sanitize";

const openAIChatResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable(),
      }),
    }),
  ),
});

const PROVIDER_TIMEOUT_MS = 30_000;

export async function callOpenAICompatible(config: OpenAICompatibleConfig, prompt: string): Promise<string> {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const sanitized = sanitizeOutboundPayload(
    { model: config.model, prompt },
    { kind: "ai-research", provider: config.provider, reason: "openai-compatible chat completion", endpoint },
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
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
              "你是中文简历助手。只根据用户提供的信息生成简历草稿；未知事实必须标记 needs_confirmation。输出严格 JSON。",
          },
          {
            role: "user",
            content: String(sanitized.payload.prompt ?? prompt),
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("模型请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`模型请求失败：${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = openAIChatResponseSchema.parse(json);
  const content = parsed.choices[0]?.message.content;
  if (!content) {
    throw new Error("模型响应为空");
  }
  return content;
}
