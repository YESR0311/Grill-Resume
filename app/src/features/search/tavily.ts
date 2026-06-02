import "server-only";

import { z } from "zod";
import { sanitizeOutboundPayload } from "@/features/privacy/sanitize";
import type { SearchProvider, SearchQueryParams, SearchResult } from "./provider";
import { SearchProviderError } from "./provider";
import type { TavilyConfig } from "./settings";

const tavilyResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().trim().min(1),
      url: z.string().trim().url(),
      content: z.string().trim().optional(),
      score: z.number().optional(),
    }),
  ).default([]),
});

function host(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function confidence(score: number | undefined): SearchResult["confidence"] {
  if (score === undefined) return undefined;
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export class TavilySearchProvider implements SearchProvider {
  name = "tavily";

  constructor(private config: TavilyConfig) {}

  async query(params: SearchQueryParams): Promise<SearchResult[]> {
    const endpoint = `${this.config.baseUrl.replace(/\/+$/, "")}/search`;
    const sanitized = sanitizeOutboundPayload(
      { query: params.query, maxResults: params.maxResults ?? 5 },
      { kind: "tavily-search", provider: "tavily", reason: "cited resume evaluation search", endpoint },
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        query: sanitized.payload.query,
        max_results: sanitized.payload.maxResults ?? 5,
        search_depth: "basic",
        include_answer: false,
      }),
    });

    if (!response.ok) throw new SearchProviderError("request-failed", `Tavily request failed: ${response.status}`);

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new SearchProviderError("invalid-response", "Tavily returned invalid JSON");
    }

    const parsed = tavilyResponseSchema.safeParse(json);
    if (!parsed.success) throw new SearchProviderError("invalid-response", "Tavily response shape changed");

    const retrievedAt = new Date().toISOString();
    return parsed.data.results
      .filter((item) => item.url.startsWith("https://"))
      .map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content,
        retrievedAt,
        host: host(item.url),
        confidence: confidence(item.score),
      }));
  }
}
