import "server-only";

import { z } from "zod";
import { resolveTaskConnection, getSearchProvider, listSearchProviders } from "@/features/settings/store";
import type { Connection, AITask } from "@/features/settings/types";

// ─── 类型 ────────────────────────────────────────────────

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  messages: ChatMessage[];
  temperature?: number;
  json?: boolean;
};
export type ChatResult = { text: string };

export type SearchRequest = { query: string; maxResults?: number };
export type SearchHit = { title: string; url: string; snippet: string };

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number, readonly detail?: string) {
    super(message);
    this.name = "ProviderError";
  }
}

/** 按 HTTP 状态码生成消毒后的中文错误文案（不含上游响应体） */
function providerErrorMessage(status: number): string {
  if (status === 401 || status === 403) return "AI 认证失败：请检查 API Key 是否正确";
  if (status === 404) return "AI 接口地址不存在：请检查 Base URL";
  if (status === 429) return "请求过于频繁，请稍后再试";
  if (status >= 500) return "AI 服务暂时不可用，请稍后重试";
  return `AI 请求失败（状态码 ${status}）`;
}

/**
 * 把任意错误转成可安全展示给用户的中文文案。
 * ProviderError.message 已消毒可直接用；其余仅放行「短中文业务错误」，
 * 避免把上游响应体 / 英文堆栈 / 含 key 片段的原始错误透传到客户端。
 */
export function toUserMessage(err: unknown): string {
  if (err instanceof ProviderError) return err.message;
  if (err instanceof Error && err.message && /[一-龥]/.test(err.message) && err.message.length <= 60) {
    return err.message;
  }
  return "操作失败，请稍后重试";
}

// ─── AI 聊天 ─────────────────────────────────────────────

const chatRespSchema = z.object({
  choices: z.array(
    z.object({ message: z.object({ content: z.string().nullable() }) }),
  ),
});

export async function chat(
  conn: Connection,
  model: string,
  req: ChatRequest,
): Promise<ChatResult> {
  if (!conn.apiKey) throw new ProviderError("连接缺少 API Key");

  const url = `${conn.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
  };
  if (req.json) body.response_format = { type: "json_object" };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${conn.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await safeBody(res);
    console.error(`[chat] provider ${res.status}:`, detail);
    throw new ProviderError(providerErrorMessage(res.status), res.status, detail);
  }
  const json = chatRespSchema.parse(await res.json());
  return { text: json.choices[0]?.message.content ?? "" };
}

/** 从模型输出中提取 JSON（容忍 markdown 围栏） */
export function extractJson<T = unknown>(text: string): T {
  let s = text.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) s = m[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    // 模型未按要求输出 JSON 时返回空对象，由调用方的 schema 校验兜底
    return {} as T;
  }
}

// ─── 联网搜索（多渠道并发） ───────────────────────────────

export async function multiSearch(
  query: string,
  maxResults?: number,
): Promise<SearchHit[]> {
  const providers = listSearchProviders().filter((p) => p.enabled);

  const results = await Promise.allSettled(
    providers.map((p) => searchWithProvider(p.id, query, maxResults)),
  );

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const h of r.value) {
        if (!seen.has(h.url)) {
          seen.add(h.url);
          hits.push(h);
        }
      }
    }
  }
  return hits;
}

async function searchWithProvider(
  providerId: string,
  query: string,
  maxResults?: number,
): Promise<SearchHit[]> {
  const config = getSearchProvider(providerId);
  if (!config || !config.apiKey) return [];

  if (config.kind === "tavily") {
    return tavilySearch(config.baseUrl, config.apiKey, query, maxResults);
  }
  if (config.kind === "exa") {
    return exaSearch(config.baseUrl, config.apiKey, query, maxResults);
  }
  return [];
}

async function tavilySearch(
  baseUrl: string,
  apiKey: string,
  query: string,
  maxResults = 5,
): Promise<SearchHit[]> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults }),
  });
  if (!res.ok) return [];
  const json = await res.json() as { results?: { title: string; url: string; content: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
}

async function exaSearch(
  baseUrl: string,
  apiKey: string,
  query: string,
  maxResults = 5,
): Promise<SearchHit[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/search`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, numResults: maxResults }),
  });
  if (!res.ok) return [];
  const json = await res.json() as { results?: { title: string; url: string; snippet?: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.snippet ?? "" }));
}

// ─── 工具 ────────────────────────────────────────────────

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return res.statusText;
  }
}

/** 按任务获取已配置的连接+模型，未配置则抛错 */
export function requireTaskRoute(task: AITask): { conn: Connection; model: string } {
  const route = resolveTaskConnection(task);
  if (!route) {
    throw new ProviderError(
      `「${task}」任务未配置。请先在 /settings 中设置 AI 连接和路由。`,
    );
  }
  return route;
}