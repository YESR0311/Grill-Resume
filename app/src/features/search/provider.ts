export type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
  retrievedAt?: string;
  host?: string;
  confidence?: "high" | "medium" | "low";
};

export type SearchQueryParams = {
  query: string;
  maxResults?: number;
};

export type SearchProvider = {
  name: string;
  query(params: SearchQueryParams): Promise<SearchResult[]>;
};

export class SearchProviderError extends Error {
  constructor(public code: "missing-config" | "request-failed" | "invalid-response", message: string) {
    super(message);
    this.name = "SearchProviderError";
  }
}
