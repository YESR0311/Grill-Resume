import "server-only";

import { nanoid } from "nanoid";
import { z } from "zod";
import { getDb } from "@/lib/db";

/**
 * 问答对话持久化（Sprint 6.3/6.4 Phase 2/3：SQLite 唯一存储）。
 * 主存储：intake_messages 规范化表。旧 data/intake/<profileId>.json 读写路径已退役。
 * 对话与 PersonProfile 分离：对话过程记录，档案是结构化产出。
 */

export const IntakeMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
});
export type IntakeMessage = z.infer<typeof IntakeMessageSchema>;

export type IntakeLog = { profileId: string; messages: IntakeMessage[] };

function readMessagesFromDb(profileId: string): IntakeMessage[] {
  const rows = getDb()
    .prepare(
      "SELECT id, role, content, created_at FROM intake_messages WHERE profile_id = ? ORDER BY created_at, rowid",
    )
    .all(profileId) as { id: string; role: string; content: string; created_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function getIntakeLog(profileId: string): Promise<IntakeLog> {
  return { profileId, messages: readMessagesFromDb(profileId) };
}

export async function appendMessages(
  profileId: string,
  msgs: { role: "user" | "assistant"; content: string }[],
): Promise<IntakeLog> {
  const ts = new Date().toISOString();
  const appended: IntakeMessage[] = msgs.map((m) => ({
    id: nanoid(8),
    role: m.role,
    content: m.content,
    createdAt: ts,
  }));

  // better-sqlite3 同步 API，不需 await。
  const insert = getDb().prepare(
    "INSERT INTO intake_messages (id, profile_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertMany = getDb().transaction((items: IntakeMessage[]) => {
    for (const msg of items) {
      insert.run(msg.id, profileId, msg.role, msg.content, msg.createdAt);
    }
  });
  insertMany(appended);

  return getIntakeLog(profileId);
}
