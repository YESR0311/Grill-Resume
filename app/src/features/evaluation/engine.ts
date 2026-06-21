import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { chat, requireTaskRoute, multiSearch, extractJson, type SearchHit } from "@/features/ai/chat";
import { PROMPTS_DIR } from "@/features/ai/prompts";
import { getProfile } from "@/features/profile/store";
import { getDb } from "@/lib/db";
import { EvaluationItemSchema, type EvaluationItem } from "./types";

// ─── 系统提示词（集中到 prompts/，design §6.3） ──────────────

const EVALUATE_SYSTEM_PROMPT = readFileSync(path.join(PROMPTS_DIR, "evaluate-system.md"), "utf8");

// 单条 LLM 评估结果（6 维数值，design §4.2）
const SingleEvalSchema = z.object({
  relevance: z.number().min(1).max(10).default(5),
  specificity: z.number().min(1).max(10).default(5),
  credibility: z.number().min(1).max(10).default(5),
  recency: z.number().min(1).max(10).default(5),
  expression: z.number().min(1).max(10).default(5),
  scarcity: z.number().min(1).max(10).default(5),
  overallScore: z.number().min(1).max(10).default(5),
  searchEvidence: z.string().default(""),
  suggestion: z.string().default(""),
  suggestedRewrite: z.string().default(""),
});

// ─── Phase 1：每 session 一次联网研究（design §4.2） ───────────

/**
 * 评估会话：仅 1 次联网研究（研究岗位评估框架，非 per bullet），
 * 创建/重建 evaluation_reports 行，返回待逐条评估的 bulletIds + 共享 searchContext。
 */
export async function runEvaluationSession(
  profileId: string,
): Promise<{ reportId: string; bulletIds: string[]; searchContext: string }> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");
  if (profile.experiences.length === 0) throw new Error("无经历可评估");

  // 收集所有 bulletId
  const bulletIds: string[] = [];
  for (const exp of profile.experiences) {
    for (const bullet of exp.bullets) {
      bulletIds.push(bullet.id);
    }
  }
  if (bulletIds.length === 0) throw new Error("无经历要点可评估");

  // Phase 1 联网研究：研究该岗位的评估方法论/成熟案例（每 session 1 次）
  const searchContext = await researchEvaluationContext(profile.title, bulletIds, profile);

  // 创建/重建 evaluation_reports 行 + 清空旧 items（同步 better-sqlite3）
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT id FROM evaluation_reports WHERE profile_id = ?")
    .get(profileId) as { id: string } | undefined;

  let reportId: string;
  if (existing) {
    reportId = existing.id;
    db.prepare("DELETE FROM evaluation_items WHERE report_id = ?").run(reportId);
    db.prepare("UPDATE evaluation_reports SET updated_at = ? WHERE id = ?").run(now, reportId);
  } else {
    reportId = nanoid(10);
    db.prepare(
      `INSERT INTO evaluation_reports (id, profile_id, overall_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(reportId, profileId, "", now, now);
  }

  return { reportId, bulletIds, searchContext };
}

/**
 * Phase 1 查询构造（design §4.2）：
 * - job_title 有值 → "{job_title} resume bullet evaluation criteria {industry}"
 * - 为空 → 用 bullet 关键词 "{bullet_keyword} resume evaluation"
 * 每 query 各 1 次搜索、最多 3 结果；两 query 均失败/超时 → 返回空上下文（不阻塞 Phase 2）。
 */
async function researchEvaluationContext(
  jobTitle: string,
  bulletIds: string[],
  profile: NonNullable<ReturnType<typeof getProfile>>,
): Promise<string> {
  const queries: string[] = [];
  if (jobTitle.trim()) {
    queries.push(`${jobTitle} resume bullet evaluation criteria`);
  } else {
    // 取首条 bullet 的前几个词作为关键词
    const firstBullet = profile.experiences.flatMap((e) => e.bullets)[0];
    const keyword = (firstBullet?.text ?? "").split(/\s+/).slice(0, 4).join(" ").trim();
    if (keyword) queries.push(`${keyword} resume evaluation`);
  }
  if (queries.length === 0) return "";

  const results = await Promise.allSettled(queries.map((q) => multiSearch(q, 3)));
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const h of r.value.slice(0, 3)) {
        if (!seen.has(h.url)) {
          seen.add(h.url);
          hits.push(h);
        }
      }
    }
  }
  if (hits.length === 0) return "";
  return hits.map((h) => `[${h.title}](${h.url}): ${h.snippet}`).join("\n");
}

// ─── Phase 2：逐条 LLM 评估，直接写规范化表（design §4.2） ─────

/**
 * 单条评估：复用 Phase 1 的 searchContext，对一条 bullet 做 6 维 LLM 评估，
 * UPSERT 进 evaluation_items 规范化表，返回单条 item。
 */
export async function evaluateOneItem(
  profileId: string,
  bulletId: string,
  searchContext: string,
): Promise<EvaluationItem> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");

  // 定位 bullet 及其所属经历
  let originalText = "";
  let targetId = "";
  for (const exp of profile.experiences) {
    const b = exp.bullets.find((x) => x.id === bulletId);
    if (b) {
      originalText = b.text;
      targetId = exp.id;
      break;
    }
  }
  if (!targetId) throw new Error("要点不存在");

  const db = getDb();
  const report = db
    .prepare("SELECT id FROM evaluation_reports WHERE profile_id = ?")
    .get(profileId) as { id: string } | undefined;
  if (!report) throw new Error("评估会话不存在，请重新开始评估");
  const reportId = report.id;

  const route = requireTaskRoute("evaluate");

  const userPrompt =
    `目标岗位：${profile.title || "未指定"}\n\n` +
    `## 待评估 bullet 原文\n${originalText}\n\n` +
    `## 联网参考（该岗位评估方法论/成熟案例，可能为空）\n${searchContext || "无"}\n`;

  let evalResult: z.infer<typeof SingleEvalSchema>;
  let status: EvaluationItem["status"] = "done";
  try {
    const { text } = await chat(route.conn, route.model, {
      messages: [
        { role: "system", content: EVALUATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      json: true,
    });
    const parsed = SingleEvalSchema.safeParse(extractJson(text));
    if (parsed.success) {
      evalResult = parsed.data;
    } else {
      // JSON 格式漂移：回退默认分值 5（design §七风险）
      evalResult = SingleEvalSchema.parse({});
      status = "failed";
    }
  } catch {
    evalResult = SingleEvalSchema.parse({});
    status = "failed";
  }

  const item: EvaluationItem = EvaluationItemSchema.parse({
    id: nanoid(8),
    targetType: "experience",
    targetId,
    bulletId,
    originalText,
    relevance: evalResult.relevance,
    specificity: evalResult.specificity,
    credibility: evalResult.credibility,
    recency: evalResult.recency,
    expression: evalResult.expression,
    scarcity: evalResult.scarcity,
    overallScore: evalResult.overallScore,
    searchEvidence: evalResult.searchEvidence || searchContext,
    searchSources: [],
    suggestion: evalResult.suggestion,
    suggestedRewrite: evalResult.suggestedRewrite,
    status,
  });

  // UPSERT 进规范化表：依赖 (report_id, bullet_id) 唯一索引，ON CONFLICT 原子更新，
  // 消除原先 DELETE+INSERT 之间的竞态（Sprint 6 额外修复）。
  db.prepare(
    `INSERT INTO evaluation_items
       (id, report_id, target_type, target_id, bullet_id, original_text,
        relevance, specificity, credibility, recency, expression, scarcity, overall_score,
        search_evidence, suggestion, suggested_rewrite, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(report_id, bullet_id) DO UPDATE SET
       id = excluded.id,
       target_type = excluded.target_type,
       target_id = excluded.target_id,
       original_text = excluded.original_text,
       relevance = excluded.relevance,
       specificity = excluded.specificity,
       credibility = excluded.credibility,
       recency = excluded.recency,
       expression = excluded.expression,
       scarcity = excluded.scarcity,
       overall_score = excluded.overall_score,
       search_evidence = excluded.search_evidence,
       suggestion = excluded.suggestion,
       suggested_rewrite = excluded.suggested_rewrite,
       status = excluded.status`,
  ).run(
    item.id,
    reportId,
    item.targetType,
    item.targetId,
    item.bulletId ?? null,
    item.originalText,
    item.relevance,
    item.specificity,
    item.credibility,
    item.recency,
    item.expression,
    item.scarcity,
    item.overallScore,
    item.searchEvidence,
    item.suggestion,
    item.suggestedRewrite,
    item.status,
  );

  return item;
}
