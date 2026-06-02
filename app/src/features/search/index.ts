import "server-only";

import { getTavilyConfig } from "./settings";
import { TavilySearchProvider } from "./tavily";
import { SearchProviderError, type SearchProvider } from "./provider";

export async function getActiveSearchProvider(): Promise<SearchProvider> {
  const config = await getTavilyConfig();
  if (!config) throw new SearchProviderError("missing-config", "Tavily config missing");
  return new TavilySearchProvider(config);
}

export type { SearchProvider, SearchQueryParams, SearchResult } from "./provider";
export { SearchProviderError } from "./provider";
