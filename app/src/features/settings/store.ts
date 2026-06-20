import "server-only";

import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { ensureWorkspaceLayout, getSettingsRoot } from "@/lib/workspace";
import {
  ConnectionSchema,
  SearchProviderConfigSchema,
  TaskRouteSchema,
  type Connection,
  type ConnectionSummary,
  type SearchProviderConfig,
  type SearchProviderSummary,
  type SearchKind,
  type AITask,
  type TaskRoute,
  type AppSettings,
} from "./types";

// ─── 辅助 ────────────────────────────────────────────────

function connectionPath(id: string): string {
  return path.join(getSettingsRoot(), `conn-${id}.enc.json`);
}
function searchPath(id: string): string {
  return path.join(getSettingsRoot(), `search-${id}.enc.json`);
}

function rowToConnectionSummary(conn: Connection, row: { model: string; is_default: number }): ConnectionSummary {
  return {
    id: conn.id,
    name: conn.name,
    provider: "openai-compatible",
    baseUrl: conn.baseUrl,
    model: row.model,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
    hasApiKey: conn.apiKey.length > 0,
  };
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  const url = new URL(trimmed);
  if (url.protocol === "https:") return trimmed;
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (isLocalhost && process.env.NODE_ENV === "development") return trimmed;
  throw new Error("baseUrl 必须使用 https；开发环境仅允许 http localhost");
}

// ─── JSON 路由表（新增轻量配置表） ──────────────────────

function ensureTables(): void {
  const db = getDb();
  // 复用现有 model_configs 表存连接；新增 search_providers
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_configs (
      id               TEXT PRIMARY KEY,
      provider         TEXT NOT NULL,
      model            TEXT NOT NULL,
      encrypted_config_path TEXT NOT NULL,
      is_default       INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS search_providers (
      id               TEXT PRIMARY KEY,
      kind             TEXT NOT NULL,
      encrypted_config_path TEXT NOT NULL,
      enabled          INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS app_routing (
      task      TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      model     TEXT
    );
  `);
}

// ─── 连接（connection = OpenAI 兼容端点） ───────────────

function dbRows() {
  ensureTables();
  const db = getDb();
  return db.prepare(
    `SELECT id, provider, model, encrypted_config_path, is_default FROM model_configs ORDER BY is_default DESC, rowid DESC`,
  ).all() as { id: string; provider: string; model: string; encrypted_config_path: string; is_default: number }[];
}

function readDecrypted<T>(filePath: string): T {
  const settingsRoot = path.resolve(getSettingsRoot());
  const resolved = path.resolve(filePath);
  const relative = path.relative(settingsRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("配置文件路径不在 workspace/settings 内");
  }
  return decryptJson<T>(fsSync.readFileSync(resolved, "utf-8"));
}

function writeEncrypted(filePath: string, data: unknown): void {
  fsSync.writeFileSync(filePath, encryptJson(data), "utf-8");
}

export async function saveConnection(input: {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault?: boolean;
}): Promise<ConnectionSummary> {
  await ensureWorkspaceLayout();
  ensureTables();

  const baseUrl = normalizeBaseUrl(input.baseUrl);
  if (!input.apiKey.trim()) throw new Error("API Key 不能为空");
  if (!input.model.trim()) throw new Error("模型名称不能为空");

  const now = new Date().toISOString();
  const id = input.id ?? nanoid();
  const conn: Connection = ConnectionSchema.parse({
    id,
    name: input.name.trim() || "默认连接",
    provider: "openai-compatible",
    baseUrl,
    apiKey: input.apiKey.trim(),
    model: input.model.trim(),
    createdAt: now,
    updatedAt: now,
  });

  writeEncrypted(connectionPath(id), conn);

  const db = getDb();
  const tx = db.transaction(() => {
    if (input.isDefault) {
      db.prepare(`UPDATE model_configs SET is_default = 0`).run();
    }
    db.prepare(
      `INSERT INTO model_configs (id, provider, model, encrypted_config_path, is_default)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET model = excluded.model, is_default = excluded.is_default, encrypted_config_path = excluded.encrypted_config_path`,
    ).run(id, conn.provider, conn.model, connectionPath(id), input.isDefault ? 1 : 0);
  });
  tx();

  return rowToConnectionSummary(
    conn,
    { model: conn.model, is_default: input.isDefault ? 1 : 0 },
  );
}

export function listConnections(): ConnectionSummary[] {
  ensureTables();
  return dbRows().map((row) => {
    const conn = readDecrypted<Connection>(row.encrypted_config_path);
    return rowToConnectionSummary(conn, row);
  });
}

export function getDefaultConnection(): Connection | null {
  ensureTables();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, provider, model, encrypted_config_path, is_default
       FROM model_configs ORDER BY is_default DESC, rowid DESC LIMIT 1`,
    )
    .get() as { id: string; provider: string; model: string; encrypted_config_path: string; is_default: number } | undefined;
  if (!row) return null;
  return readDecrypted<Connection>(row.encrypted_config_path);
}

export function getConnection(id: string): Connection | null {
  ensureTables();
  const db = getDb();
  const row = db.prepare(`SELECT encrypted_config_path FROM model_configs WHERE id = ?`).get(id) as
    | { encrypted_config_path: string }
    | undefined;
  if (!row) return null;
  return readDecrypted<Connection>(row.encrypted_config_path);
}

export function deleteConnection(id: string): void {
  ensureTables();
  const db = getDb();
  const row = db.prepare(`SELECT encrypted_config_path FROM model_configs WHERE id = ?`).get(id) as
    | { encrypted_config_path: string }
    | undefined;
  if (row) {
    db.prepare(`DELETE FROM model_configs WHERE id = ?`).run(id);
    fs.unlink(row.encrypted_config_path).catch(() => {});
  }
}

// ─── 搜索渠道 ────────────────────────────────────────────

export function saveSearchProvider(input: {
  id?: string;
  kind: SearchKind;
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled?: boolean;
}): SearchProviderSummary {
  ensureTables();
  const now = new Date().toISOString();
  const id = input.id ?? nanoid();
  const config: SearchProviderConfig = SearchProviderConfigSchema.parse({
    id,
    kind: input.kind,
    name: input.name.trim(),
    baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
    apiKey: input.apiKey.trim(),
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  });

  writeEncrypted(searchPath(id), config);

  const db = getDb();
  db.prepare(
    `INSERT INTO search_providers (id, kind, encrypted_config_path, enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, enabled = excluded.enabled`,
  ).run(id, config.kind, searchPath(id), config.enabled ? 1 : 0);

  return toSearchSummary(config);
}

function toSearchSummary(config: SearchProviderConfig): SearchProviderSummary {
  const { apiKey, ...rest } = config;
  return { ...rest, hasApiKey: apiKey.length > 0 };
}

export function listSearchProviders(): SearchProviderSummary[] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(`SELECT id, kind, encrypted_config_path, enabled FROM search_providers`).all() as {
    id: string;
    kind: string;
    encrypted_config_path: string;
    enabled: number;
  }[];
  return rows.map((row) => {
    const config = readDecrypted<SearchProviderConfig>(row.encrypted_config_path);
    return toSearchSummary(config);
  });
}

export function getSearchProvider(id: string): SearchProviderConfig | null {
  ensureTables();
  const db = getDb();
  const row = db.prepare(`SELECT encrypted_config_path FROM search_providers WHERE id = ?`).get(id) as
    | { encrypted_config_path: string }
    | undefined;
  if (!row) return null;
  return readDecrypted<SearchProviderConfig>(row.encrypted_config_path);
}

export function deleteSearchProvider(id: string): void {
  ensureTables();
  const db = getDb();
  const row = db.prepare(`SELECT encrypted_config_path FROM search_providers WHERE id = ?`).get(id) as
    | { encrypted_config_path: string }
    | undefined;
  if (row) {
    db.prepare(`DELETE FROM search_providers WHERE id = ?`).run(id);
    fs.unlink(row.encrypted_config_path).catch(() => {});
  }
}

// ─── 任务路由 ────────────────────────────────────────────
// intake / evaluate / polish → 连接 + model

export function getRouting(): AppSettings["routing"] {
  ensureTables();
  const db = getDb();
  const rows = db.prepare(`SELECT task, connection_id, model FROM app_routing`).all() as {
    task: string;
    connection_id: string;
    model: string | null;
  }[];
  const routing: AppSettings["routing"] = { intake: null, evaluate: null, polish: null };
  for (const r of rows) {
    if (r.task in routing) {
      (routing as Record<string, TaskRoute | null>)[r.task] = TaskRouteSchema.parse({
        connectionId: r.connection_id,
        model: r.model ?? undefined,
      });
    }
  }
  return routing;
}

export function setTaskRoute(task: AITask, route: TaskRoute | null): void {
  ensureTables();
  const db = getDb();
  if (route) {
    db.prepare(
      `INSERT INTO app_routing (task, connection_id, model)
       VALUES (?, ?, ?)
       ON CONFLICT(task) DO UPDATE SET connection_id = excluded.connection_id, model = excluded.model`,
    ).run(task, route.connectionId, route.model ?? null);
  } else {
    db.prepare(`DELETE FROM app_routing WHERE task = ?`).run(task);
  }
}

/** 解析某任务具体的「连接 + 模型」。未配置返回 null。 */
export function resolveTaskConnection(task: AITask): { conn: Connection; model: string } | null {
  ensureTables();
  const db = getDb();
  // 先查路由表
  const route = db
    .prepare(`SELECT connection_id, model FROM app_routing WHERE task = ?`)
    .get(task) as { connection_id: string; model: string | null } | undefined;
  if (route) {
    const conn = getConnection(route.connection_id);
    if (conn) return { conn, model: route.model ?? conn.model };
  }
  // fallback 到默认连接
  const def = getDefaultConnection();
  return def ? { conn: def, model: def.model } : null;
}