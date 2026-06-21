/**
 * Sprint 6.4 迁移脚本：把遗留 data/{intake,evaluate,polish}/*.json 导入 SQLite。
 *
 * 运行（在 app/ 目录）：
 *   corepack pnpm@10 exec tsx scripts/migrate-json-to-sqlite.ts
 *
 * 幂等：重复运行以 UPSERT/重建方式覆盖，不会重复插入。
 * 本脚本只「读 JSON + 写 SQLite」，**不删除任何 data/ 目录或文件**——
 * 删除是不可逆操作，确认迁移无误并备份后由人工执行（见报告中的清单与备份命令）。
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { getDb } from "../src/lib/db";
import { saveProfile } from "../src/features/profile/store";
import { appendMessages } from "../src/features/intake/store";
import { saveEvaluationReport } from "../src/features/evaluation/store";
import { saveResumeDraft } from "../src/features/polish/draft-store";
import { PersonProfileSchema } from "../src/features/profile/types";
import { IntakeMessageSchema } from "../src/features/intake/store";
import { EvaluationReportSchema } from "../src/features/evaluation/types";
import { ResumeDraftSchema } from "../src/features/polish/types";
import { z } from "zod";

const DATA = path.join(process.cwd(), "data");

async function readJsonDir(sub: string): Promise<{ id: string; raw: unknown }[]> {
  const dir = path.join(DATA, sub);
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const out: { id: string; raw: unknown }[] = [];
  for (const name of names) {
    const raw = await fs.readFile(path.join(dir, name), "utf8");
    out.push({ id: name.replace(/\.json$/, ""), raw: JSON.parse(raw) });
  }
  return out;
}

async function migrateProfiles(): Promise<number> {
  // profiles 已是 SQLite（blob），Phase 2 saveProfile 会顺带写规范化子表。
  const db = getDb();
  const rows = db.prepare("SELECT data FROM profiles").all() as { data: string }[];
  let n = 0;
  for (const row of rows) {
    const parsed = PersonProfileSchema.safeParse(JSON.parse(row.data));
    if (parsed.success) {
      saveProfile(parsed.data); // 重新写入 → 触发规范化子表回填
      n += 1;
    }
  }
  return n;
}

async function migrateIntake(): Promise<number> {
  const IntakeLog = z.object({ profileId: z.string(), messages: z.array(IntakeMessageSchema).default([]) });
  let n = 0;
  for (const { id, raw } of await readJsonDir("intake")) {
    const parsed = IntakeLog.safeParse(raw);
    if (!parsed.success) continue;
    // 仅当 SQLite 尚无该 profile 的消息时导入，避免重复。
    const existing = getDb()
      .prepare("SELECT COUNT(*) AS c FROM intake_messages WHERE profile_id = ?")
      .get(id) as { c: number };
    if (existing.c > 0) continue;
    await appendMessages(
      id,
      parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
    );
    n += 1;
  }
  return n;
}

async function migrateEvaluation(): Promise<number> {
  let n = 0;
  for (const { raw } of await readJsonDir("evaluate")) {
    const parsed = EvaluationReportSchema.safeParse(raw);
    if (!parsed.success) continue;
    await saveEvaluationReport(parsed.data);
    n += 1;
  }
  return n;
}

async function migratePolish(): Promise<number> {
  let n = 0;
  for (const { raw } of await readJsonDir("polish")) {
    const parsed = ResumeDraftSchema.safeParse(raw);
    if (!parsed.success) continue;
    await saveResumeDraft(parsed.data);
    n += 1;
  }
  return n;
}

async function main() {
  const profiles = await migrateProfiles();
  const intake = await migrateIntake();
  const evaluation = await migrateEvaluation();
  const polish = await migratePolish();
  console.log("迁移完成：");
  console.log(`  profiles 规范化回填: ${profiles}`);
  console.log(`  intake 日志导入: ${intake}`);
  console.log(`  evaluation 报告导入: ${evaluation}`);
  console.log(`  polish 草稿导入: ${polish}`);
  console.log("");
  console.log("data/ 目录未删除。确认无误并备份后再人工删除（见任务报告）。");
}

main().catch((err) => {
  console.error("迁移失败:", err);
  process.exit(1);
});
