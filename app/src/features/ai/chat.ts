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
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ProviderError";
  }
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
    throw new ProviderError(`AI 请求失败 (${res.status}): ${await safeBody(res)}`, res.status);
  }
  const json = chatRespSchema.parse(await res.json());
  return { text: json.choices[0]?.message.content ?? "" };
}

/** 从模型输出中提取 JSON（容忍 markdown 围栏） */
export function extractJson<T = unknown>(text: string): T {
  let s = text.trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) s = m[1].trim();
  return JSON.parse(s) as T;
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