import "server-only";

import type { SearchProviderConfig } from "@/features/settings/types";

/**
 * 搜索渠道策略注册表（design §6.2，Sprint 6.2）。
 *
 * 新增 provider 只需在本文件 `registerProvider({ kind, search })`，
 * 不再改 chat.ts 的 if/else。D1 决策：本期只注册 tavily + exa 两渠道，
 * 注册机制保留扩展点供后续追加。
 */

export type SearchHit = { title: string; url: string; snippet: string };

export type SearchProvider = {
  kind: string;
  /** 执行搜索；网络/解析失败应吞错返回 []，不向上抛上游响应体（spec error-handling）。 */
  search: (config: SearchProviderConfig, query: string, maxResults?: number) => Promise<SearchHit[]>;
};

const registry = new Map<string, SearchProvider>();

export function registerProvider(provider: SearchProvider): void {
  registry.set(provider.kind, provider);
}

export function getProvider(kind: string): SearchProvider | undefined {
  return registry.get(kind);
}

/**
 * 用注册的 provider 执行搜索；未注册的 kind 返回 []（不抛错，不阻塞评估流）。
 */
export async function runSearch(
  config: SearchProviderConfig,
  query: string,
  maxResults?: number,
): Promise<SearchHit[]> {
  const provider = registry.get(config.kind);
  if (!provider) return [];
  return provider.search(config, query, maxResults);
}

// ─── 内置 provider：tavily ────────────────────────────────

async function tavilySearch(
  config: SearchProviderConfig,
  query: string,
  maxResults = 5,
): Promise<SearchHit[]> {
  const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: config.apiKey, query, max_results: maxResults }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
}

// ─── 内置 provider：exa ───────────────────────────────────

async function exaSearch(
  config: SearchProviderConfig,
  query: string,
  maxResults = 5,
): Promise<SearchHit[]> {
  const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/search`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": config.apiKey },
    body: JSON.stringify({ query, numResults: maxResults }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: { title: string; url: string; snippet?: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.snippet ?? "" }));
}

// 模块加载时注册内置渠道（D1：tavily + exa）。
registerProvider({ kind: "tavily", search: tavilySearch });
registerProvider({ kind: "exa", search: exaSearch });
