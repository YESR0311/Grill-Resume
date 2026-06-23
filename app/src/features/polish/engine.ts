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

export async function runPolish(profileId: string, templateId?: string): Promise<ResumeDraft> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error("档案不存在");

  const evalReport = await getEvaluationReport(profileId);
  const route = requireTaskRoute("polish");
  const finalTemplateId = templateId ?? DEFAULT_TEMPLATE_ID;

  // ── 步骤①：生成修改清单 ──────────────────────────────────
  const revisionList = await buildRevisionList(profile, evalReport, route);

  // ── 步骤②：按修改清单逐字段修改，产出结构化简历 JSON ──────
  const userPrompt = buildPolishPrompt(profile, evalReport, revisionList, finalTemplateId);

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
    templateId: finalTemplateId,
    style: getTemplateStyle(finalTemplateId),
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

// ─── 模板类型差异化润色策略（Batch 3 验收 #5） ──────────────
// 每种类型有专属的表达策略指令，会被 buildPolishPrompt 追加到 LLM 提示词

const TEMPLATE_POLISH_STRATEGY: Record<string, string> = {
  "t1-classic": `
【模板类型：时序·简约版】
- 表达策略：保持中性、专业的时序简历风格
- 量化要求：每条要点至少包含 1 个可量化数字（%、数字、倍数）
- 关键词：使用岗位领域的标准术语，避免花哨修辞
- 篇幅控制：每条要点 1 行（15-25 字），不超 2 行
- 适用场景：大多数岗位投递的通用版本
`,
  "t2-modern": `
【模板类型：时序·现代版】
- 表达策略：现代、简洁的科技/互联网风格
- 量化要求：技术成果用"性能提升 X%""响应时间 -Xms"等数字呈现
- 关键词：技术栈名称、框架、工具、协议等需明确写出
- 篇幅控制：每条要点 1-2 行，突出技术影响
- 适用场景：互联网/科技公司投递
`,
  "t3-warm": `
【模板类型：时序·暖色版】
- 表达策略：温和、叙事化、突出个人品牌
- 量化要求：成就可量化时给数字，但更强调"过程 + 影响"
- 关键词：可在要点开头使用动词/短语（"主导""推动""构建"等）形成节奏
- 篇幅控制：每条要点 1-2 行，叙事感强
- 适用场景：创意/设计/市场/品牌类岗位
`,
  "t4-compact": `
【模板类型：时序·紧凑版】
- 表达策略：高密度、紧凑、信息量大
- 量化要求：每条要点必须包含数字（% / 金额 / 规模 / 倍数）
- 关键词：高度凝练的技术和业务术语
- 篇幅控制：每条要点 1 行（10-20 字），信息密度优先
- 适用场景：经验丰富者（>10 年），多段经历需密集展示
`,
  "h1-skills": `
【模板类型：混合·技能优先】
- 表达策略：技能/能力栈前置，经历证明能力
- 量化要求：每条要点强调"用什么技术/能力 → 达成什么结果"
- 关键词：技能分类清晰（如"编程语言""框架""工具"），经历中明确复用这些词
- 篇幅控制：技能标签简短（1-3 字），经历要点简短
- 适用场景：技术岗，突出能力栈
`,
  "h2-achievement": `
【模板类型：混合·成就导向】
- 表达策略：履历优先 + 量化成就突出
- 量化要求：每条要点必须有数字（业绩、规模、增长、节省）
- 关键词：商业结果、价值创造、客户/业务影响
- 篇幅控制：每条要点 1-2 行，必须包含数字
- 适用场景：管理/销售/咨询/运营岗
`,
  "h3-project": `
【模板类型：混合·项目导向】
- 表达策略：项目经历前置，技术深度优先
- 量化要求：项目用"规模 X 万用户 / 性能 X ms / 成本 -X%"等数字
- 关键词：技术栈、架构、规模、复杂度、解决的问题
- 篇幅控制：项目要点 2-3 行（技术细节 + 量化结果）
- 适用场景：研发/工程师/产品经理岗
`,
  "f1-functional": `
【模板类型：功能·转行版】
- 表达策略：弱化时间线，强调可迁移技能
- 量化要求：技能相关成果用数字证明（任何行业的"规模""增长""优化"）
- 关键词：可迁移能力（沟通、协调、项目管理、数据分析等）
- 篇幅控制：技能描述 2-3 行，经历简化（机构+角色+核心成果）
- 适用场景：转行/跨行业求职者
`,
  "a1-ats": `
【模板类型：ATS 优化版】
- 表达策略：纯文本、关键词命中、避免格式导致解析错误
- 量化要求：每条要点必须有数字
- 关键词：必须包含岗位描述中的核心关键词（请根据目标岗位推断）
- 篇幅控制：每条要点 1 行（15-25 字），不堆砌修饰
- 特殊要求：避免使用 • ● 等符号（用纯文本）；不使用 HTML 标签
- 适用场景：投递 ATS 自动筛选系统（外企、大公司）
`,
};

/**
 * 根据模板 ID 获取差异化润色策略文本（用于 buildPolishPrompt）
 */
function getTemplateStrategy(templateId: string): string {
  return (
    TEMPLATE_POLISH_STRATEGY[templateId] ??
    TEMPLATE_POLISH_STRATEGY[DEFAULT_TEMPLATE_ID] ??
    ""
  );
}

// ─── 步骤②：构建润色用户提示词（注入修改清单） ──────────────

function buildPolishPrompt(
  profile: NonNullable<ReturnType<typeof getProfile>>,
  evalReport: Awaited<ReturnType<typeof getEvaluationReport>>,
  revisionList: RevisionList,
  templateId: string,
): string {
  let prompt = `目标岗位：${profile.title || "未指定"}\n\n`;

  // 注入模板差异化策略（必须在档案之前，让 LLM 先理解写作风格）
  const strategy = getTemplateStrategy(templateId);
  if (strategy) {
    prompt += strategy + "\n";
  }

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
