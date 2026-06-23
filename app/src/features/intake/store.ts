import "server-only";

import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/lib/db";

/**
 * 问答对话持久化（Sprint 6.3/6.4 Phase 2/3：SQLite 唯一存储）。
 * 主存储：intake_messages 规范化表。旧 data/intake/<profileId>.json 读写路径已退役。
 * 对话与 PersonProfile 分离：对话过程记录，档案是结构化产出。
 *
 * v2（intake-v2）：messages 加 dimension 字段（6 阶段打标），
 * 新增 getIntakeLogByDimension(profileId, dimension) 供解析 API 按阶段读取。
 */

export const IntakeMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  dimension: z.string().default(""),
  createdAt: z.string(),
});
export type IntakeMessage = z.infer<typeof IntakeMessageSchema>;

export type IntakeLog = { profileId: string; messages: IntakeMessage[] };

function readMessagesFromDb(profileId: string): IntakeMessage[] {
  const rows = getDb()
    .prepare(
      "SELECT id, role, content, dimension, created_at FROM intake_messages WHERE profile_id = ? ORDER BY created_at, rowid",
    )
    .all(profileId) as { id: string; role: string; content: string; dimension: string; created_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    content: r.content,
    dimension: r.dimension ?? "",
    createdAt: r.created_at,
  }));
}

export async function getIntakeLog(profileId: string): Promise<IntakeLog> {
  return { profileId, messages: readMessagesFromDb(profileId) };
}

/**
 * 按 dimension 过滤读取消息（v2 6 阶段需要：解析 API 只传当前阶段对话历史）。
 * 解析时只取本阶段对话，避免跨阶段混淆。
 */
export async function getIntakeLogByDimension(
  profileId: string,
  dimension: string,
): Promise<IntakeLog> {
  const rows = getDb()
    .prepare(
      "SELECT id, role, content, dimension, created_at FROM intake_messages WHERE profile_id = ? AND dimension = ? ORDER BY created_at, rowid",
    )
    .all(profileId, dimension) as { id: string; role: string; content: string; dimension: string; created_at: string }[];
  return {
    profileId,
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      content: r.content,
      dimension: r.dimension ?? "",
      createdAt: r.created_at,
    })),
  };
}

export async function appendMessages(
  profileId: string,
  msgs: { role: "user" | "assistant"; content: string; dimension?: string }[],
): Promise<IntakeLog> {
  const ts = new Date().toISOString();
  const appended: IntakeMessage[] = msgs.map((m) => ({
    id: nanoid(8),
    role: m.role,
    content: m.content,
    dimension: m.dimension ?? "",
    createdAt: ts,
  }));

  // better-sqlite3 同步 API，不需 await。
  const insert = getDb().prepare(
    "INSERT INTO intake_messages (id, profile_id, role, content, dimension, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertMany = getDb().transaction((items: IntakeMessage[]) => {
    for (const msg of items) {
      insert.run(msg.id, profileId, msg.role, msg.content, msg.dimension, msg.createdAt);
    }
  });
  insertMany(appended);

  return getIntakeLog(profileId);
}
