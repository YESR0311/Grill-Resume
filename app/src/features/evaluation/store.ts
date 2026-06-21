import "server-only";

import { getDb } from "@/lib/db";
import { EvaluationReportSchema, EvaluationItemSchema, type EvaluationReport, type EvaluationItem } from "./types";

/**
 * 评估报告存储（Sprint 6.3 Phase 2：读路径切换到规范化表）。
 *
 * 主存储：evaluation_reports + evaluation_items 规范化表（engine 逐条写入）。
 * 读路径统一走 SQLite，使刷新后逐条结果可读、StepNav polish 可达性正确。
 * 旧 data/evaluate/<profileId>.json 读路径已删除；如需回滚到双写期，git revert 即可。
 */

type ReportRow = {
  id: string;
  profile_id: string;
  overall_summary: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  target_type: string | null;
  target_id: string | null;
  bullet_id: string | null;
  original_text: string | null;
  relevance: number;
  specificity: number;
  credibility: number;
  recency: number;
  expression: number;
  scarcity: number;
  overall_score: number;
  search_evidence: string | null;
  suggestion: string | null;
  suggested_rewrite: string | null;
  status: string | null;
};

// 用 Schema 校验单条，容错（无法校验的行回退默认值）。
function rowToItem(row: ItemRow): EvaluationItem {
  const value = {
    id: row.id,
    targetType: row.target_type ?? "experience",
    targetId: row.target_id ?? "",
    bulletId: row.bullet_id ?? undefined,
    originalText: row.original_text ?? "",
    relevance: row.relevance,
    specificity: row.specificity,
    credibility: row.credibility,
    recency: row.recency,
    expression: row.expression,
    scarcity: row.scarcity,
    overallScore: row.overall_score,
    searchEvidence: row.search_evidence ?? "",
    searchSources: [],
    suggestion: row.suggestion ?? "",
    suggestedRewrite: row.suggested_rewrite ?? "",
    status: row.status ?? "done",
  };
  const parsed = EvaluationItemSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return EvaluationItemSchema.parse({ id: row.id, targetType: "experience", targetId: "" });
}

export async function getEvaluationReport(profileId: string): Promise<EvaluationReport | null> {
  const db = getDb();
  const reportRow = db
    .prepare(
      "SELECT id, profile_id, overall_summary, created_at, updated_at FROM evaluation_reports WHERE profile_id = ?",
    )
    .get(profileId) as ReportRow | undefined;
  if (!reportRow) return null;

  const itemRows = db
    .prepare(
      `SELECT id, target_type, target_id, bullet_id, original_text,
              relevance, specificity, credibility, recency, expression, scarcity, overall_score,
              search_evidence, suggestion, suggested_rewrite, status
       FROM evaluation_items WHERE report_id = ? ORDER BY rowid`,
    )
    .all(reportRow.id) as ItemRow[];

  const report: EvaluationReport = {
    profileId,
    createdAt: reportRow.created_at,
    updatedAt: reportRow.updated_at,
    overallSummary: reportRow.overall_summary ?? "",
    items: itemRows.map(rowToItem),
  };

  const parsed = EvaluationReportSchema.safeParse(report);
  return parsed.success ? parsed.data : report;
}

/**
 * 写入整份报告（保留供需要批量重建的调用方使用；当前主写路径是 engine 逐条 UPSERT）。
 * 写规范化表：先 UPSERT report 行，再清空旧 items 后批量插入。
 */
export async function saveEvaluationReport(report: EvaluationReport): Promise<EvaluationReport> {
  const validated = EvaluationReportSchema.parse(report);
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT id FROM evaluation_reports WHERE profile_id = ?")
    .get(validated.profileId) as { id: string } | undefined;

  const tx = db.transaction(() => {
    let reportId: string;
    if (existing) {
      reportId = existing.id;
      db.prepare("UPDATE evaluation_reports SET overall_summary = ?, updated_at = ? WHERE id = ?").run(
        validated.overallSummary,
        now,
        reportId,
      );
      db.prepare("DELETE FROM evaluation_items WHERE report_id = ?").run(reportId);
    } else {
      reportId = `${validated.profileId}-report`;
      db.prepare(
        `INSERT INTO evaluation_reports (id, profile_id, overall_summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(reportId, validated.profileId, validated.overallSummary, validated.createdAt || now, now);
    }

    const insert = db.prepare(
      `INSERT INTO evaluation_items
         (id, report_id, target_type, target_id, bullet_id, original_text,
          relevance, specificity, credibility, recency, expression, scarcity, overall_score,
          search_evidence, suggestion, suggested_rewrite, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of validated.items) {
      insert.run(
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
    }
  });
  tx();

  return { ...validated, updatedAt: now };
}
