import "server-only";

import { nanoid } from "nanoid";
import { z } from "zod";
import type { OpenAICompatibleConfig } from "@/features/ai/model-configs";
import { sanitizeOutboundPayload } from "@/features/privacy/sanitize";
import { parseRawTextIntake, type ResumeIntakeCandidate } from "./parse-raw-text";
import type { IntakeAnswer, IntakeCategory, IntakeInterviewSession } from "./types";

const PROVIDER_TIMEOUT_MS = 30_000;

/** 各类别回答 → parseRawTextIntake 可识别的行前缀（竞赛按项目归拢，名称加“竞赛：”前缀）。 */
const CATEGORY_LINE_LABEL: Record<IntakeCategory, string> = {
  education: "教育",
  internship: "经历",
  project: "项目",
  competition: "项目",
  skill: "技能",
};

function toAnnotatedLine(answer: IntakeAnswer): string {
  const text = answer.answerText.replace(/\s*\r?\n+\s*/g, "；").trim();
  const body = answer.category === "competition" ? `竞赛：${text}` : text;
  return `${CATEGORY_LINE_LABEL[answer.category]}: ${body}`;
}

function buildAnnotatedSourceText(session: IntakeInterviewSession): string {
  return session.answers.map(toAnnotatedLine).join("\n");
}

/**
 * 规则归拢（确定性、离线必可用）：把回答拼成标注行后复用 parseRawTextIntake。
 * 不合“｜”格式的回答由解析器既有兜底骨架逻辑处理；产物一律为骨架卡片
 * （evidence 空、bullets 为 draft），与“粘贴原文”路径行为一致。
 */
export function consolidateIntakeAnswersRuleBased(session: IntakeInterviewSession): ResumeIntakeCandidate {
  return parseRawTextIntake({ rawText: buildAnnotatedSourceText(session) });
}

// LLM 输出 schema：类型层强制骨架——evidence 只接受空数组，bullets 的 status 只接受
// 字面量 "draft"；违例（编造 evidence、产出 confirmed bullet）即 safeParse 失败走规则降级。
const boundedString = z.string().trim().min(1).max(400);

const skeletonBulletSchema = z.object({
  text: boundedString,
  status: z.literal("draft"),
});

const emptyEvidenceSchema = z.array(z.never()).max(0).default([]);

const llmSkeletonSchema = z.object({
  education: z
    .array(
      z.object({
        school: boundedString,
        degree: boundedString.optional(),
        major: boundedString.optional(),
      }),
    )
    .max(8)
    .default([]),
  experiences: z
    .array(
      z.object({
        organization: boundedString,
        role: boundedString.optional(),
        evidence: emptyEvidenceSchema,
        bullets: z.array(skeletonBulletSchema).max(3).default([]),
      }),
    )
    .max(12)
    .default([]),
  projects: z
    .array(
      z.object({
        name: boundedString,
        role: boundedString.optional(),
        techStack: z.array(boundedString).max(12).default([]),
        evidence: emptyEvidenceSchema,
        bullets: z.array(skeletonBulletSchema).max(3).default([]),
      }),
    )
    .max(12)
    .default([]),
  skills: z
    .array(
      z.object({
        name: boundedString,
        items: z.array(boundedString).max(20).default([]),
      }),
    )
    .max(8)
    .default([]),
});

const chatCompletionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string().nullable() }),
    }),
  ),
});

function toSkeletonCandidate(
  raw: z.infer<typeof llmSkeletonSchema>,
  session: IntakeInterviewSession,
  now: string,
): ResumeIntakeCandidate {
  return {
    id: nanoid(),
    createdAt: now,
    sourceText: buildAnnotatedSourceText(session),
    education: raw.education.map((item) => ({
      id: nanoid(),
      school: item.school,
      degree: item.degree ?? "待确认",
      major: item.major ?? "待确认",
    })),
    experiences: raw.experiences.map((item) => ({
      id: nanoid(),
      organization: item.organization,
      role: item.role ?? "待确认",
      evidence: [],
      bullets: item.bullets.map((bullet) => ({
        id: nanoid(),
        text: bullet.text,
        sourceEvidenceIds: [],
        qualityFlags: [],
        status: "draft" as const,
      })),
    })),
    projects: raw.projects.map((item) => ({
      id: nanoid(),
      name: item.name,
      role: item.role,
      techStack: item.techStack,
      links: [],
      evidence: [],
      bullets: item.bullets.map((bullet) => ({
        id: nanoid(),
        text: bullet.text,
        sourceEvidenceIds: [],
        qualityFlags: [],
        status: "draft" as const,
      })),
    })),
    skills: raw.skills.map((item) => ({
      id: nanoid(),
      category: "tools" as const,
      name: item.name,
      items: item.items,
    })),
  };
}

function systemPrompt(): string {
  return "你是 Grill-Resume 的经历盘点归拢助手。只使用 priorAnswers 中用户的原话信息归拢简历卡片骨架，禁止编造组织、岗位、项目、技术栈、成绩、时间或数字。竞赛经历归入 projects，name 以“竞赛：”开头。所有 evidence 字段必须是空数组，所有 bullets 的 status 必须是 draft。只输出 JSON object。";
}

type ConsolidationRequest = {
  task: string;
  requiredShape: Record<string, unknown>;
  priorAnswers: { prompt: string; text: string; kind: IntakeCategory }[];
};

function buildConsolidationRequest(session: IntakeInterviewSession): ConsolidationRequest {
  return {
    task: "把求职者按类别（教育/实习/项目/比赛/技能）给出的引导问答回答，归拢为简历经历卡片骨架。",
    requiredShape: {
      education: [{ school: "string", degree: "string", major: "string" }],
      experiences: [
        { organization: "string", role: "string", evidence: [], bullets: [{ text: "string", status: "draft" }] },
      ],
      projects: [
        {
          name: "string",
          role: "string",
          techStack: ["string"],
          evidence: [],
          bullets: [{ text: "string", status: "draft" }],
        },
      ],
      skills: [{ name: "string", items: ["string"] }],
    },
    priorAnswers: session.answers.map((answer) => ({
      prompt: `请归拢这条 ${answer.category} 类回答`,
      text: answer.answerText.replace(/\s+/g, " ").trim().slice(0, 1200),
      kind: answer.category,
    })),
  };
}

async function consolidateWithLlm(
  session: IntakeInterviewSession,
  config: OpenAICompatibleConfig,
): Promise<ResumeIntakeCandidate | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const sanitized = sanitizeOutboundPayload(
      { model: config.model, request: buildConsolidationRequest(session) },
      { kind: "ai-extract", provider: config.provider, reason: "intake 引导问答归拢为简历经历卡片骨架", endpoint },
    );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: String(sanitized.payload.model ?? config.model),
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: JSON.stringify(sanitized.payload.request ?? {}) },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) return null;
    const parsedCompletion = chatCompletionSchema.safeParse(await response.json());
    if (!parsedCompletion.success) return null;
    const content = parsedCompletion.data.choices[0]?.message.content;
    if (!content) return null;
    // JSON.parse 抛出（content 非合法 JSON）时由外层 catch 捕获并降级，非遗漏
    const parsedPayload = llmSkeletonSchema.safeParse(JSON.parse(content) as unknown);
    if (!parsedPayload.success) return null;
    return toSkeletonCandidate(parsedPayload.data, session, new Date().toISOString());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 归拢入口：config 存在时优先 LLM 增强；config 为 null、网络失败、非 2xx、
 * 响应 safeParse 失败（含违反骨架约束）一律降级规则路径，离线必可用。
 */
export async function consolidateIntakeAnswers(input: {
  session: IntakeInterviewSession;
  config: OpenAICompatibleConfig | null;
}): Promise<{ candidate: ResumeIntakeCandidate; source: "llm" | "rule-based" }> {
  if (input.config && input.session.answers.length > 0) {
    const candidate = await consolidateWithLlm(input.session, input.config);
    if (candidate) {
      return { candidate, source: "llm" };
    }
  }
  return { candidate: consolidateIntakeAnswersRuleBased(input.session), source: "rule-based" };
}
