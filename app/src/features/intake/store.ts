import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";

/**
 * 问答对话持久化。
 * 每个档案一份 data/intake/<profileId>.json，存完整对话历史。
 * 对话与 PersonProfile 分离：对话过程记录，档案是结构化产出。
 */

export const IntakeMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
});
export type IntakeMessage = z.infer<typeof IntakeMessageSchema>;

const IntakeLogSchema = z.object({
  profileId: z.string(),
  messages: z.array(IntakeMessageSchema).default([]),
});
export type IntakeLog = z.infer<typeof IntakeLogSchema>;

const DIR = path.join(process.cwd(), "data", "intake");

function fileFor(id: string): string {
  return path.join(DIR, `${id}.json`);
}

async function atomicWrite(file: string, data: string): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = `${file}.${nanoid(6)}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, file);
}

export async function getIntakeLog(profileId: string): Promise<IntakeLog> {
  try {
    const raw = await fs.readFile(fileFor(profileId), "utf8");
    const parsed = IntakeLogSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return { profileId, messages: [] };
}

export async function appendMessages(
  profileId: string,
  msgs: { role: "user" | "assistant"; content: string }[],
): Promise<IntakeLog> {
  const log = await getIntakeLog(profileId);
  const ts = new Date().toISOString();
  for (const m of msgs) {
    log.messages.push({ id: nanoid(8), role: m.role, content: m.content, createdAt: ts });
  }
  await atomicWrite(fileFor(profileId), JSON.stringify(log, null, 2));
  return log;
}
