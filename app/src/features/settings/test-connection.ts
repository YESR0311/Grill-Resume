import "server-only";

import { chat } from "@/features/ai/chat";
import { getConnection } from "./store";
import type { Connection } from "./types";

/**
 * 发一次最小测试请求验证连接连通性。
 * 复用 chat()，不依赖任务路由。
 */
export async function testConnection(
  connectionOrId: string | Connection,
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  const conn = typeof connectionOrId === "string" ? getConnection(connectionOrId) : connectionOrId;
  if (!conn) return { ok: false, error: "连接不存在" };

  try {
    const { text } = await chat(conn, conn.model, {
      messages: [{ role: "user", content: "ping，请回复 ok。" }],
      temperature: 0,
    });
    return { ok: true, reply: text.slice(0, 100) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}