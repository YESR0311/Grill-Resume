import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { ensureWorkspaceLayout, getSettingsRoot } from "@/lib/workspace";

export type TavilyConfig = {
  id: string;
  provider: "tavily";
  name: string;
  baseUrl: string;
  apiKey: string;
  freeTier: boolean;
  monthlyQuota?: number;
  createdAt: string;
  updatedAt: string;
};

export type TavilyConfigSummary = Omit<TavilyConfig, "apiKey"> & { hasApiKey: boolean };

const tavilyConfigSchema = z.object({
  id: z.string().trim().min(1),
  provider: z.literal("tavily"),
  name: z.string().trim().min(1),
  baseUrl: z.string().trim().url(),
  apiKey: z.string().trim().min(1),
  freeTier: z.boolean(),
  monthlyQuota: z.number().int().positive().optional(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

function configPath(): string {
  return path.join(getSettingsRoot(), "tavily.enc.json");
}

function summary(config: TavilyConfig): TavilyConfigSummary {
  return {
    id: config.id,
    provider: config.provider,
    name: config.name,
    baseUrl: config.baseUrl,
    freeTier: config.freeTier,
    monthlyQuota: config.monthlyQuota,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    hasApiKey: config.apiKey.length > 0,
  };
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || "https://api.tavily.com";
}

export async function saveTavilyConfig(input: {
  name?: string;
  baseUrl?: string;
  apiKey: string;
  freeTier?: boolean;
  monthlyQuota?: number;
}): Promise<TavilyConfigSummary> {
  await ensureWorkspaceLayout();
  const now = new Date().toISOString();
  const config: TavilyConfig = tavilyConfigSchema.parse({
    id: nanoid(),
    provider: "tavily",
    name: input.name?.trim() || "Tavily",
    baseUrl: normalizeBaseUrl(input.baseUrl || "https://api.tavily.com"),
    apiKey: input.apiKey.trim(),
    freeTier: input.freeTier ?? true,
    monthlyQuota: input.monthlyQuota,
    createdAt: now,
    updatedAt: now,
  });
  await fs.writeFile(configPath(), encryptJson(config), "utf-8");
  return summary(config);
}

export async function getTavilyConfig(): Promise<TavilyConfig | null> {
  try {
    const config = decryptJson<TavilyConfig>(await fs.readFile(configPath(), "utf-8"));
    return tavilyConfigSchema.parse(config);
  } catch {
    return null;
  }
}

export async function getTavilyConfigSummary(): Promise<TavilyConfigSummary | null> {
  const config = await getTavilyConfig();
  return config ? summary(config) : null;
}
