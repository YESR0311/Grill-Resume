import "server-only";

import { chat, requireTaskRoute, extractJson, ProviderError } from "@/features/ai/chat";
import { getProfile } from "@/features/profile/store";
import { getEvaluationReport } from "@/features/evaluation/store";
import { ResumeDraftSchema, type ResumeDraft } from "./types";

// ─── 系统提示词 ──────────────────────────────────────────

const POLISH_SYSTEM_PROMPT = `你是一位专业的简历润色顾问。你的任务是基于用户档案和评估报告，生成一份经过润色优化的简历草稿。

## 输入
1. 用户档案（PersonProfile）：包含个人信息、经历详情、技能组等
2. 逐条评估报告（EvaluationReport）：包含每条经历点的相关性、可信度、改进建议和改写

## 你的工作
1. 综合两个输入来源
2. 按评估报告的建议改写要点，强化量化成果，贴合目标岗位
3. 保持事实准确，不凭空编造
4. 输出格式：结构化的简历 JSON

## 输出格式
{
  "name": "姓名",
  "title": "目标岗位",
  "email": "邮箱",
  "phone": "电话",
  "summary": "个人简介（2-3句，突出核心优势）",
  "workExperience": {
    "title": "工作经历",
    "items": [
      {
        "organization": "公司名",
        "role": "职位",
        "startDate": "开始时间",
        "endDate": "结束时间",
        "bullets": [
          { "text": "润色后的要点文本" }
        ]
      }
    ]
  },
  "projects": { "title": "项目经历", "items": [] },
  "education": { "title": "教育背景", "items": [] },
  "skills": ["技能1", "技能2"]
}`;

// ─── 引擎 ────────────────────────────────────────────────

export async function runPolish(profileId: string): Promise<ResumeDraft> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");

  const evalReport = await getEvaluationReport(profileId);
  const route = requireTaskRoute("polish");

  const userPrompt = buildPolishPrompt(profile, evalReport);

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
  const parsed = ResumeDraftSchema.safeParse({
    ...raw,
    profileId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (!parsed.success) {
    throw new ProviderError("简历生成失败：模型返回格式异常，请重试");
  }

  return parsed.data;
}

// ─── 构建用户提示词 ──────────────────────────────────────

function buildPolishPrompt(
  profile: NonNullable<ReturnType<typeof getProfile>>,
  evalReport: Awaited<ReturnType<typeof getEvaluationReport>>,
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

  // 评估报告
  if (evalReport) {
    prompt += `\n## 评估报告（按建议改写要点）\n`;
    for (const item of evalReport.items) {
      if (item.suggestedRewrite) {
        prompt += `- 原文：${item.originalText}\n`;
        prompt += `  建议改写：${item.suggestedRewrite}\n`;
        if (item.relevance === "low" || item.relevance === "medium") {
          prompt += `  (注意：此条${item.relevance}相关，酌情保留或强化)\n`;
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