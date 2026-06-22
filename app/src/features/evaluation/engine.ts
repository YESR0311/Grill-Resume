import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { chat, requireTaskRoute, multiSearch, extractJson, type SearchHit } from "@/features/ai/chat";
import { PROMPTS_DIR } from "@/features/ai/prompts";
import { getProfile } from "@/features/profile/store";
import type { PersonProfile } from "@/features/profile/types";
import { getDb } from "@/lib/db";
import { EvaluationItemSchema, type EvaluationItem, type EvalUnit } from "./types";

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
  suggestion: z.string().default(""),
  suggestedRewrite: z.string().default(""),
});

// ─── 评估单元构建（全档案覆盖，design §B1） ──────────────────

/**
 * 把档案各条目拆为评估单元，每单元整体评分。
 * EvalUnit 的 targetType/targetId 对应被评条目 ID。
 */
export function buildEvalUnits(profile: PersonProfile): EvalUnit[] {
  const units: EvalUnit[] = [];

  // 经历段：拼接 org+role+起止+全部 bullets
  for (const exp of profile.experiences) {
    const parts: string[] = [];
    if (exp.organization) parts.push(`机构：${exp.organization}`);
    if (exp.role) parts.push(`角色：${exp.role}`);
    if (exp.startDate) parts.push(`时间：${exp.startDate}${exp.endDate ? ` — ${exp.endDate}` : ""}`);
    if (exp.bullets.length) {
      parts.push("成果点：");
      parts.push(...exp.bullets.map((b, i) => `  ${i + 1}. ${b.text}`));
    }
    units.push({
      targetType: "experience",
      targetId: exp.id,
      title: `${exp.organization || ""} ${exp.role || ""}`.trim() || "经历",
      content: parts.join("\n"),
    });
  }

  // 项目段
  for (const proj of profile.projects) {
    const parts: string[] = [];
    if (proj.name) parts.push(`项目：${proj.name}`);
    if (proj.role) parts.push(`角色：${proj.role}`);
    if (proj.description) parts.push(`描述：${proj.description}`);
    if (!parts.length) continue;
    units.push({
      targetType: "project",
      targetId: proj.id,
      title: proj.name || "项目",
      content: parts.join("\n"),
    });
  }

  // 技能组段
  for (const sg of profile.skillGroups) {
    const names = sg.skills.filter(Boolean);
    if (!names.length) continue;
    units.push({
      targetType: "skill",
      targetId: sg.id,
      title: sg.category || "技能组",
      content: `技能：${names.join("、")}`,
    });
  }

  // 教育段
  for (const edu of profile.education) {
    const parts: string[] = [];
    if (edu.institution) parts.push(`学校：${edu.institution}`);
    if (edu.degree) parts.push(`学位：${edu.degree}`);
    if (edu.field) parts.push(`专业：${edu.field}`);
    if (edu.startDate) parts.push(`时间：${edu.startDate}${edu.endDate ? ` — ${edu.endDate}` : ""}`);
    if (!parts.length) continue;
    units.push({
      targetType: "education",
      targetId: edu.id,
      title: edu.institution || "教育",
      content: parts.join("\n"),
    });
  }

  return units;
}

// ─── Phase 1：每 session 一次联网研究 ──────────────────────

/**
 * 评估会话：仅 1 次联网研究（研究岗位评估方法论，与具体条目解耦），
 * 创建/重建 evaluation_reports 行，返回 evaluUnits + 共享 searchContext。
 */
export async function runEvaluationSession(
  profileId: string,
): Promise<{ reportId: string; units: EvalUnit[]; searchContext: string }> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");

  const units = buildEvalUnits(profile);
  if (units.length === 0) throw new Error("无条目可评估");

  // Phase 1 联网研究：针对岗位/领域的方法论查询（不 per 条目、不打包档案）
  const searchContext = await researchEvaluationContext(profile.title, profile);

  // 创建/重建 evaluation_reports 行 + 清空旧 items
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

  return { reportId, units, searchContext };
}

/**
 * Phase 1 查询构造（design §B, S2 已修）：
 * - jobTitle 有值 → "<岗位> resume evaluation methodology"
 * - 无 jobTitle → 从 skillGroups/education 推断领域 → "<领域> resume evaluation methodology"
 * 每 query 各 1 次搜索、最多 3 结果；全部失败/超时 → 返回空上下文（不阻塞 Phase 2）。
 */
async function researchEvaluationContext(
  jobTitle: string,
  profile: PersonProfile,
): Promise<string> {
  const queries: string[] = [];
  if (jobTitle.trim()) {
    queries.push(`${jobTitle.trim()} resume evaluation methodology`);
  } else {
    // 从技能/教育推断领域，不用 bullet 关键词
    const domainParts: string[] = [];
    for (const sg of profile.skillGroups) {
      const names = sg.skills.filter(Boolean);
      if (names.length) domainParts.push(names.join(" "));
    }
    for (const edu of profile.education) {
      if (edu.field) domainParts.push(edu.field);
    }
    const domain = domainParts.join(" ").trim();
    if (domain) queries.push(`${domain} resume evaluation methodology`);
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

// ─── Phase 2：逐单元 LLM 评估 ──────────────────────────────

/**
 * 逐单元评估：对一个 EvalUnit（经历/项目/技能/教育）做 6 维 LLM 评估，
 * UPSERT 进 evaluation_items 规范化表。
 */
export async function evaluateOneUnit(
  profileId: string,
  unit: EvalUnit,
  searchContext: string,
): Promise<EvaluationItem> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");

  const db = getDb();
  const report = db
    .prepare("SELECT id FROM evaluation_reports WHERE profile_id = ?")
    .get(profileId) as { id: string } | undefined;
  if (!report) throw new Error("评估会话不存在，请重新开始评估");
  const reportId = report.id;

  const route = requireTaskRoute("evaluate");

  const targetInfo = `${unit.title}`;
  const userPrompt =
    `目标岗位：${profile.title || "未指定"}\n\n` +
    `## 待评估条目\n${unit.content}\n\n` +
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
      evalResult = SingleEvalSchema.parse({});
      status = "failed";
    }
  } catch {
    evalResult = SingleEvalSchema.parse({});
    status = "failed";
  }

  const item: EvaluationItem = EvaluationItemSchema.parse({
    id: nanoid(8),
    targetType: unit.targetType,
    targetId: unit.targetId,
    originalText: targetInfo + "\n" + unit.content,
    relevance: evalResult.relevance,
    specificity: evalResult.specificity,
    credibility: evalResult.credibility,
    recency: evalResult.recency,
    expression: evalResult.expression,
    scarcity: evalResult.scarcity,
    overallScore: evalResult.overallScore,
    searchEvidence: "",
    searchSources: [],
    suggestion: evalResult.suggestion,
    suggestedRewrite: evalResult.suggestedRewrite,
    status,
  });

  // UPSERT 依赖 (report_id, target_type, target_id) UNIQUE
  db.prepare(
    `INSERT INTO evaluation_items
       (id, report_id, target_type, target_id, original_text,
        relevance, specificity, credibility, recency, expression, scarcity, overall_score,
        search_evidence, suggestion, suggested_rewrite, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(report_id, target_type, target_id) DO UPDATE SET
       id = excluded.id,
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