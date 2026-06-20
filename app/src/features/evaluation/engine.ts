import "server-only";

import { nanoid } from "nanoid";
import { chat, requireTaskRoute, multiSearch, extractJson } from "@/features/ai/chat";
import { getProfile, saveProfile } from "@/features/profile/store";
import { EvaluationReportSchema, type EvaluationReport, type EvaluationItem } from "./types";

// ─── 系统提示词 ──────────────────────────────────────────

const EVALUATE_SYSTEM_PROMPT = `你是一位专业的简历评估顾问。你的任务是对档案中的每段经历要点进行逐条评估。

对于每一条要点，你需要评估：
1. **相关性 (relevance)**：这条经历与目标岗位的相关性（high / medium / low）
2. **可信度 (credibility)**：是否有可验证的具体信息（verified / plausible / unverifiable）
3. **稀缺性 (scarcity)**：这项技能在市场上的稀缺程度（rare / common / unknown）
4. **改进建议 (suggestion)**：如何改写这条要点使其更有说服力
5. **建议改写 (suggestedRewrite)**：直接给出改写后的版本

你还会收到联网搜索的结果作为佐证。引用这些结果时注明来源。

输出严格 JSON 格式：
{
  "items": [
    {
      "targetType": "experience",
      "targetId": "...",
      "originalText": "...",
      "relevance": "medium",
      "credibility": "plausible",
      "scarcity": "unknown",
      "searchEvidence": "...",
      "suggestion": "...",
      "suggestedRewrite": "..."
    }
  ],
  "overallSummary": "总体评价..."
}`;

// ─── 引擎 ────────────────────────────────────────────────

export async function runEvaluation(profileId: string): Promise<EvaluationReport> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");
  if (profile.experiences.length === 0) throw new Error("无经历可评估");

  const route = requireTaskRoute("evaluate");

  const items: EvaluationItem[] = [];

  // 逐条经历评估
  for (const exp of profile.experiences) {
    for (const bullet of exp.bullets) {
      const searchHits = await multiSearch(
        `${bullet.text} ${exp.organization} ${exp.role}`,
        3,
      );

      items.push({
        id: nanoid(8),
        targetType: "experience",
        targetId: exp.id,
        bulletId: bullet.id,
        originalText: bullet.text,
        relevance: "medium",
        credibility: "plausible",
        scarcity: "unknown",
        searchEvidence: searchHits.map((h) => `[${h.title}](${h.url}): ${h.snippet}`).join("\n"),
        searchSources: searchHits.map((h) => h.url),
        suggestion: "",
        suggestedRewrite: "",
        status: "searching",
      });
    }
  }

  // 批量 LLM 评估（每次 3-5 条一起送，减少调用）
  const BATCH_SIZE = 5;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const userPrompt = `请评估以下经历要点（目标岗位：${profile.title || "未指定"}）：\n\n` +
      batch
        .map(
          (item, idx) =>
            `【${i + idx + 1}】\n原文：${item.originalText}\n联网佐证：${item.searchEvidence || "无"}\n`,
        )
        .join("\n");

    const { text } = await chat(route.conn, route.model, {
      messages: [
        { role: "system", content: EVALUATE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      json: true,
    });

    // 解析批量评估结果
    try {
      const resultSchema = EvaluationReportSchema;
      const batchResult = resultSchema.parse(extractJson(text));
      for (let j = 0; j < batchResult.items.length && j < batch.length; j++) {
        const idx = i + j;
        items[idx] = {
          ...items[idx],
          relevance: batchResult.items[j].relevance,
          credibility: batchResult.items[j].credibility,
          scarcity: batchResult.items[j].scarcity,
          suggestion: batchResult.items[j].suggestion,
          suggestedRewrite: batchResult.items[j].suggestedRewrite,
          status: "done",
        };
      }
    } catch {
      // 解析失败，标记 failed
      for (let j = 0; j < batch.length; j++) {
        items[i + j].status = "failed";
      }
    }
  }

  // 总体评价
  let overallSummary = "";
  try {
    const { text: summaryText } = await chat(route.conn, route.model, {
      messages: [
        { role: "system", content: "你是简历评估专家。用一段话总结以下经历的总体质量，优缺点和改进方向。" },
        {
          role: "user",
          content: `目标岗位：${profile.title || "未指定"}\n经历要点：${items
            .map((i) => `- ${i.originalText}（${i.relevance} / ${i.credibility}）`)
            .join("\n")}`,
        },
      ],
      temperature: 0.3,
    });
    overallSummary = summaryText;
  } catch {
    overallSummary = "总体评估生成失败。";
  }

  const report: EvaluationReport = EvaluationReportSchema.parse({
    profileId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
    overallSummary,
  });

  profile.intakeStatus.phase = "ready";
  saveProfile(profile);

  return report;
}