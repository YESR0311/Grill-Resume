import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { ensureWorkspaceLayout, getSettingsRoot } from "@/lib/workspace";

export type OpenAICompatibleConfig = {
  id: string;
  provider: "openai-compatible";
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type ModelConfigSummary = Omit<OpenAICompatibleConfig, "apiKey"> & {
  isDefault: boolean;
  hasApiKey: boolean;
};

type ModelConfigRow = {
  id: string;
  provider: "openai-compatible";
  model: string;
  encrypted_config_path: string;
  is_default: number;
};

function modelConfigPath(id: string): string {
  return path.join(getSettingsRoot(), `${id}.enc.json`);
}

function rowToSummary(row: ModelConfigRow, config: OpenAICompatibleConfig): ModelConfigSummary {
  return {
    id: config.id,
    provider: config.provider,
    name: config.name,
    baseUrl: config.baseUrl,
    model: row.model,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    isDefault: row.is_default === 1,
    hasApiKey: config.apiKey.length > 0,
  };
}

async function readEncryptedConfig(filePath: string): Promise<OpenAICompatibleConfig> {
  const settingsRoot = path.resolve(getSettingsRoot());
  const resolved = path.resolve(filePath);
  const relative = path.relative(settingsRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("模型配置文件路径不在 workspace/settings 内");
  }
  const payload = await fs.readFile(resolved, "utf-8");
  return decryptJson<OpenAICompatibleConfig>(payload);
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("baseUrl 必须是有效 URL");
  }
  if (url.protocol === "https:") return trimmed;
  const isLocalhost = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (isLocalhost && process.env.NODE_ENV === "development") return trimmed;
  throw new Error("baseUrl 必须使用 https；开发环境仅允许 http localhost");
}

export async function saveOpenAICompatibleConfig(input: {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
}): Promise<ModelConfigSummary> {
  const name = input.name.trim() || "OpenAI-compatible";
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  if (!baseUrl || !apiKey || !model) {
    throw new Error("baseUrl、API Key 和模型名称不能为空");
  }

  await ensureWorkspaceLayout();
  const now = new Date().toISOString();
  const id = nanoid();
  const config: OpenAICompatibleConfig = {
    id,
    provider: "openai-compatible",
    name,
    baseUrl,
    apiKey,
    model,
    createdAt: now,
    updatedAt: now,
  };
  const encryptedConfigPath = modelConfigPath(id);
  await fs.writeFile(encryptedConfigPath, encryptJson(config), "utf-8");

  const db = getDb();
  const tx = db.transaction(() => {
    if (input.isDefault) {
      db.prepare(`UPDATE model_configs SET is_default = 0`).run();
    }
    db.prepare(
      `INSERT INTO model_configs (id, provider, model, encrypted_config_path, is_default)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, config.provider, model, encryptedConfigPath, input.isDefault ? 1 : 0);
  });
  tx();

  return rowToSummary(
    {
      id,
      provider: "openai-compatible",
      model,
      encrypted_config_path: encryptedConfigPath,
      is_default: input.isDefault ? 1 : 0,
    },
    config,
  );
}

export async function listModelConfigs(): Promise<ModelConfigSummary[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, provider, model, encrypted_config_path, is_default
       FROM model_configs ORDER BY is_default DESC, rowid DESC`,
    )
    .all() as ModelConfigRow[];
  const configs = await Promise.all(
    rows.map(async (row) => rowToSummary(row, await readEncryptedConfig(row.encrypted_config_path))),
  );
  return configs;
}

export async function getDefaultModelConfig(): Promise<OpenAICompatibleConfig | null> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, provider, model, encrypted_config_path, is_default
       FROM model_configs ORDER BY is_default DESC, rowid DESC LIMIT 1`,
    )
    .get() as ModelConfigRow | undefined;
  if (!row) return null;
  return readEncryptedConfig(row.encrypted_config_path);
}
