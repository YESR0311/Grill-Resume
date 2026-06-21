import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { chat, requireTaskRoute, extractJson, ProviderError } from "@/features/ai/chat";
import { PROMPTS_DIR } from "@/features/ai/prompts";
import { getProfile } from "@/features/profile/store";
import { getEvaluationReport } from "@/features/evaluation/store";
import { ResumeDraftSchema, type ResumeDraft } from "./types";
import { getTemplateStyle, DEFAULT_TEMPLATE_ID } from "./templates";

// ─── 系统提示词（集中到 prompts/，design §6.3、Sprint 2 readFileSync 加载） ──

const POLISH_REVISION_PROMPT = readFileSync(path.join(PROMPTS_DIR, "polish-revision.md"), "utf8");
const POLISH_SYSTEM_PROMPT = readFileSync(path.join(PROMPTS_DIR, "polish-system.md"), "utf8");

// ─── 三步润色流水线（design §4.3） ────────────────────────────
//   ① 生成修改清单 → ② 按清单逐字段修改产出简历 JSON → ③ 字段映射到 Word section + 注入模板样式

export async function runPolish(profileId: string): Promise<ResumeDraft> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");

  const evalReport = await getEvaluationReport(profileId);
  const route = requireTaskRoute("polish");

  // ── 步骤①：生成修改清单 ──────────────────────────────────
  const revisionList = await buildRevisionList(profile, evalReport, route);

  // ── 步骤②：按修改清单逐字段修改，产出结构化简历 JSON ──────
  const userPrompt = buildPolishPrompt(profile, evalReport, revisionList);

  const { text } = await chat(route.conn, route.model, {
    messages: [
      { role: "system", content: POLISH_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    json: true,
  });

  const raw = extractJson<Record<string, unknown>>(text);
  if (!raw || Object.keys(raw).length === 0) {
    throw new ProviderError("简历生成失败：模型未返回有效内容，请重试");
  }

  // ── 步骤③：字段映射到 Word section + 注入默认模板样式 ──────
  const now = new Date().toISOString();
  const parsed = ResumeDraftSchema.safeParse({
    ...raw,
    profileId,
    createdAt: now,
    updatedAt: now,
    templateId: DEFAULT_TEMPLATE_ID,
    style: getTemplateStyle(DEFAULT_TEMPLATE_ID),
  });
  if (!parsed.success) {
    throw new ProviderError("简历生成失败：模型返回格式异常，请重试");
  }

  return parsed.data;
}

// ─── 步骤①：修改清单 ─────────────────────────────────────────

type RevisionItem = {
  target: string;
  action: string;
  reason?: string;
  rewrite?: string;
};
type RevisionList = {
  summaryDirection?: string;
  items: RevisionItem[];
};

async function buildRevisionList(
  profile: NonNullable<ReturnType<typeof getProfile>>,
  evalReport: Awaited<ReturnType<typeof getEvaluationReport>>,
  route: ReturnType<typeof requireTaskRoute>,
): Promise<RevisionList> {
  const userPrompt = buildRevisionPrompt(profile, evalReport);
  try {
    const { text } = await chat(route.conn, route.model, {
      messages: [
        { role: "system", content: POLISH_REVISION_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      json: true,
    });
    const raw = extractJson<Partial<RevisionList>>(text);
    if (raw && Array.isArray(raw.items)) {
      return { summaryDirection: raw.summaryDirection, items: raw.items };
    }
  } catch (err) {
    // 修改清单是辅助步骤，失败时不阻断主流程，降级为空清单。
    console.error("buildRevisionList failed, fallback to empty list:", err);
  }
  return { items: [] };
}

function buildRevisionPrompt(
  profile: NonNullable<ReturnType<typeof getProfile>>,
  evalReport: Awaited<ReturnType<typeof getEvaluationReport>>,
): string {
  let prompt = `目标岗位：${profile.title || "未指定"}\n\n`;
  prompt += `## 个人档案\n姓名：${profile.name}\n简介：${profile.summary}\n\n`;
  prompt += `### 工作经历\n`;
  for (const exp of profile.experiences) {
    prompt += `- ${exp.role} @ ${exp.organization} (${exp.startDate} - ${exp.endDate})\n`;
    for (const b of exp.bullets) prompt += `  • ${b.text}\n`;
  }
  if (profile.projects.length) {
    prompt += `\n### 项目经历\n`;
    for (const proj of profile.projects) {
      prompt += `- ${proj.name}（${proj.role}）\n`;
      if (proj.description) prompt += `  ${proj.description}\n`;
    }
  }
  if (evalReport) {
    prompt += `\n## 评估报告\n`;
    for (const item of evalReport.items) {
      prompt += `- 原文：${item.originalText}\n`;
      prompt += `  评分: relevance ${item.relevance} / specificity ${item.specificity} / credibility ${item.credibility} / recency ${item.recency} / expression ${item.expression} / scarcity ${item.scarcity}\n`;
      if (item.suggestion) prompt += `  建议：${item.suggestion}\n`;
      if (item.suggestedRewrite) prompt += `  建议改写：${item.suggestedRewrite}\n`;
    }
  }
  prompt += `\n请输出修改清单 JSON。`;
  return prompt;
}

// ─── 步骤②：构建润色用户提示词（注入修改清单） ──────────────

function buildPolishPrompt(
  profile: NonNullable<ReturnType<typeof getProfile>>,
  evalReport: Awaited<ReturnType<typeof getEvaluationReport>>,
  revisionList: RevisionList,
): string {
  let prompt = `目标岗位：${profile.title || "未指定"}\n\n`;

  prompt += `## 个人档案\n`;
  prompt += `姓名：${profile.name}\n`;
  prompt += `简介：${profile.summary}\n\n`;

  prompt += `### 工作经历\n`;
  for (const exp of profile.experiences) {
    prompt += `- ${exp.role} @ ${exp.organization} (${exp.startDate} - ${exp.endDate})\n`;
    for (const b of exp.bullets) {
      prompt += `  • ${b.text}\n`;
    }
  }

  if (profile.projects.length) {
    prompt += `\n### 项目经历\n`;
    for (const proj of profile.projects) {
      prompt += `- ${proj.name}（${proj.role}）\n`;
      if (proj.description) prompt += `  ${proj.description}\n`;
    }
  }

  prompt += `\n### 技能组\n`;
  for (const sg of profile.skillGroups) {
    prompt += `- ${sg.category}: ${sg.skills.join(", ")}\n`;
  }

  prompt += `\n### 教育背景\n`;
  for (const edu of profile.education) {
    prompt += `- ${edu.degree} ${edu.field} @ ${edu.institution}\n`;
  }

  // 修改清单（步骤①产出）——按清单逐字段修改
  if (revisionList.items.length) {
    prompt += `\n## 修改清单（请严格按此清单逐字段修改）\n`;
    if (revisionList.summaryDirection) {
      prompt += `简介方向：${revisionList.summaryDirection}\n`;
    }
    for (const item of revisionList.items) {
      prompt += `- [${item.action}] ${item.target}`;
      if (item.reason) prompt += `（${item.reason}）`;
      prompt += `\n`;
      if (item.rewrite) prompt += `  → 改写为：${item.rewrite}\n`;
    }
  }

  // 评估报告（兜底参考）
  if (evalReport) {
    prompt += `\n## 评估报告（参考改写要点）\n`;
    for (const item of evalReport.items) {
      if (item.suggestedRewrite) {
        prompt += `- 原文：${item.originalText}\n`;
        prompt += `  建议改写：${item.suggestedRewrite}\n`;
        if (item.relevance < 7) {
          prompt += `  (注意：此条相关性评分 ${item.relevance}/10，酌情保留或强化)\n`;
        }
      }
    }
    if (evalReport.overallSummary) {
      prompt += `\n总体评价：${evalReport.overallSummary}\n`;
    }
  }

  prompt += `\n请生成一份经过润色的简历草稿 JSON。`;
  return prompt;
}
