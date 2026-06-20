import "server-only";

import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { createEmptyProfile, PersonProfileSchema, type PersonProfile } from "./types";

/**
 * 人物档案存储库（一等实体，SQLite）。
 * 存储路径：`profiles` 表（新建，复用现有 db 实例）。
 * 问答结果汇总后入库；档案编辑页直接读写。
 */

function ensureTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id        TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

export function getProfile(id: string): PersonProfile | null {
  ensureTable();
  const row = getDb().prepare("SELECT data FROM profiles WHERE id = ?").get(id) as
    | { data: string }
    | undefined;
  if (!row) return null;
  const parsed = PersonProfileSchema.safeParse(JSON.parse(row.data));
  return parsed.success ? parsed.data : null;
}

export function listProfiles(): PersonProfile[] {
  ensureTable();
  const rows = getDb().prepare("SELECT data FROM profiles ORDER BY updated_at DESC").all() as {
    data: string;
  }[];
  return rows
    .map((r) => PersonProfileSchema.safeParse(JSON.parse(r.data)))
    .filter((p) => p.success)
    .map((p) => p.data);
}

export function saveProfile(profile: PersonProfile): PersonProfile {
  ensureTable();
  const validated = PersonProfileSchema.parse(profile);
  const now = new Date().toISOString();
  const data = JSON.stringify({ ...validated, updatedAt: now });

  getDb()
    .prepare(
      `INSERT INTO profiles (id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(validated.id, data, validated.createdAt, now);

  return { ...validated, updatedAt: now };
}

export function deleteProfile(id: string): void {
  ensureTable();
  getDb().prepare("DELETE FROM profiles WHERE id = ?").run(id);
}

export function createProfile(overrides?: Partial<PersonProfile>): PersonProfile {
  const profile = createEmptyProfile({ id: nanoid(10), ...overrides });
  return saveProfile(profile);
}