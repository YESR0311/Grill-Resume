import { z } from "zod";

/** AI 连接（OpenAI 兼容协议） */
export const ConnectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.literal("openai-compatible").default("openai-compatible"),
  baseUrl: z.string(),
  apiKey: z.string(),
  model: z.string(),          // 默认模型，发请求时仍可覆盖
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Connection = z.infer<typeof ConnectionSchema>;
export type ConnectionSummary = Omit<Connection, "apiKey"> & { hasApiKey: boolean };

/** 搜索渠道 */
export const SEARCH_KINDS = ["tavily", "exa"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const SearchProviderConfigSchema = z.object({
  id: z.string(),
  kind: z.enum(SEARCH_KINDS),
  name: z.string(),
  baseUrl: z.string(),
  apiKey: z.string(),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SearchProviderConfig = z.infer<typeof SearchProviderConfigSchema>;
export type SearchProviderSummary = Omit<SearchProviderConfig, "apiKey"> & { hasApiKey: boolean };

/** 任务名 */
export type AITask = "intake" | "evaluate" | "polish";

/** 任务路由：指向一个 connection + 可选模型覆盖 */
export const TaskRouteSchema = z.object({
  connectionId: z.string(),
  model: z.string().optional(),     // 覆盖 connection.model
});
export type TaskRoute = z.infer<typeof TaskRouteSchema>;

/** 全部设置（持久化结构） */
export const AppSettingsSchema = z.object({
  connections: z.array(ConnectionSchema).default([]),
  searchProviders: z.array(SearchProviderConfigSchema).default([]),
  routing: z
    .object({
      intake: TaskRouteSchema.nullable().default(null),
      evaluate: TaskRouteSchema.nullable().default(null),
      polish: TaskRouteSchema.nullable().default(null),
    })
    .default({ intake: null, evaluate: null, polish: null }),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;