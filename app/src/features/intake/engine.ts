import "server-only";

import { nanoid } from "nanoid";
import { z } from "zod";
import { chat, extractJson, requireTaskRoute, type ChatMessage } from "@/features/ai/chat";
import { getProfile, saveProfile, createProfile } from "@/features/profile/store";
import type { PersonProfile } from "@/features/profile/types";
import { getIntakeLog, appendMessages } from "./store";

// ─── 问答维度 ────────────────────────────────────────────
// 脚本定义必须覆盖的维度，靠 prompt 引导模型逐一覆盖

import { type IntakeDimension } from "./constants";

// ─── 系统提示词（AI 行为约束核心） ──────────────────────

const SYSTEM_PROMPT = `你是一位专业的简历辅导顾问。你的任务是引导用户梳理自己的个人经历，逐步构建一份完整的人物档案。

## 你的工作方式
1. 每一轮对话，你向用户提问，用户回答。
2. 从简单的问题开始（姓名、目标岗位），逐步深入（经历细节、可量化成果、证据）。
3. 用户提供的信息可以是纯文字，不需要文件佐证。
4. 当用户提到一个经历时，追问具体细节：时间、角色、具体成果、可量化的指标。
5. 当用户陈述完成后，你按固定 JSON schema 输出本轮采集到的信息。

## 必须覆盖的维度
逐步引导用户覆盖以下所有维度：
- basics：姓名、目标岗位、联系方式、地点
- experience：工作经历（每段含组织、角色、时间、具体成果）
- project：项目经历
- skill：技能组
- education：教育背景
- evidence：补充证据（可量化的成果、可信来源信息）

## 对话风格
- 一次只问 1-2 个问题，不要一次性问太多
- 使用中文
- 友好、鼓励的语气
- 当用户提供的信息不够具体时，追问细节
- 所有维度覆盖完毕后，告知用户可以进入下一步

## 输出格式
每次回复的最后（在正常的对话内容之后），输出一个 JSON 块：
\`\`\`json
{
  "collected": {
    "name": "..."或 null,
    "title": "..."或 null,
    "experiences": [...],
    "projects": [...],
    "skills": [...],
    "education": [...],
    "evidence": [...]
  },
  "coveredDimensions": ["basics", ...],
  "phase": "basics" | "experience" | "project" | "skill" | "education" | "evidence" | "ready"
}
\`\`\`

其中 phase 表示当前正在采集哪个维度，ready 表示所有维度已覆盖。`;

// ─── 初始问候语 ──────────────────────────────────────────

export function buildOpeningMessage(): ChatMessage {
  return {
    role: "assistant",
    content:
      "你好！我是你的简历辅导顾问。让我们从最简单的开始——你叫什么名字？你希望应聘什么样的岗位？",
  };
}

// ─── 交互 ────────────────────────────────────────────────

/**
 * 处理一轮问答：发送对话历史 + 系统提示词 → 模型返回回复 → 提取结构化摘要
 * 返回 { reply, coveredDimensions, phase } 供前端渲染
 */

const LlmOutputSchema = z.object({
  collected: z
    .object({
      name: z.string().nullable().default(null),
      title: z.string().nullable().default(null),
      email: z.string().nullable().default(null),
      phone: z.string().nullable().default(null),
      experiences: z
        .array(
          z.object({
            organization: z.string().default(""),
            role: z.string().default(""),
            startDate: z.string().default(""),
            endDate: z.string().default(""),
            title: z.string().default(""),
          }),
        )
        .default([]),
      projects: z
        .array(
          z.object({ name: z.string().default(""), role: z.string().default(""), description: z.string().default("") }),
        )
        .default([]),
      skills: z.array(z.string()).default([]),
      education: z
        .array(
          z.object({
            institution: z.string().default(""),
            degree: z.string().default(""),
            field: z.string().default(""),
          }),
        )
        .default([]),
      evidence: z.array(z.string()).default([]),
    }),
  coveredDimensions: z.array(z.string()).default([]),
  phase: z.string().default("basics"),
});

export type IntakeRoundResult = {
  reply: string;
  coveredDimensions: string[];
  phase: string;
};

export async function runIntakeRound(
  profileId: string,
  userMessage: string,
): Promise<IntakeRoundResult> {
  const profile = getProfile(profileId) ?? (await createProfile({ id: profileId }));
  const log = await getIntakeLog(profileId);

  const route = requireTaskRoute("intake");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...log.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const { text } = await chat(route.conn, route.model, { messages, temperature: 0.7 });

  // 提取 JSON 块
  let result: z.infer<typeof LlmOutputSchema>;
  const parsed = LlmOutputSchema.safeParse(extractJson(text));
  if (parsed.success) {
    result = parsed.data;
  } else {
    result = { collected: { name: null, title: null, email: null, phone: null, experiences: [], projects: [], skills: [], education: [], evidence: [] }, coveredDimensions: [], phase: "basics" };
  }

  // 把对话写入 intake log
  await appendMessages(profileId, [
    { role: "user", content: userMessage },
    { role: "assistant", content: text },
  ]);

  // 把结构化信息 merge 进档案
  if (result.collected) {
    mergeCollected(profile, result.collected);
    profile.intakeStatus.coveredDimensions = result.coveredDimensions as IntakeDimension[];
    profile.intakeStatus.totalRounds = log.messages.length / 2 + 1;
    if (result.phase === "ready") {
      profile.intakeStatus.phase = "ready";
    }
    saveProfile(profile);
  }

  // 返回对话回复（去掉 JSON 块）
  const cleanReply = text.replace(/```json[\s\S]*?```/, "").trim() || text;
  return {
    reply: cleanReply,
    coveredDimensions: profile.intakeStatus.coveredDimensions,
    phase: profile.intakeStatus.phase,
  };
}

// ─── Merge ────────────────────────────────────────────────

function mergeCollected(
  profile: PersonProfile,
  collected: z.infer<typeof LlmOutputSchema>["collected"],
): void {
  if (collected.name) profile.name = collected.name;
  if (collected.title) profile.title = collected.title;
  if (collected.email) profile.email = collected.email;
  if (collected.phone) profile.phone = collected.phone;

  for (const exp of collected.experiences) {
    const label = exp.organization + exp.role;
    const exists = profile.experiences.some((e) => e.organization + e.role === label);
    if (!exists) {
      profile.experiences.push({
        id: nanoid(8),
        organization: exp.organization || exp.title || "",
        role: exp.role || "",
        startDate: exp.startDate || "",
        endDate: exp.endDate || "",
        bullets: [],
      });
    }
  }

  for (const proj of collected.projects) {
    const exists = profile.projects.some((p) => p.name === proj.name);
    if (!exists) {
      profile.projects.push({
        id: nanoid(8),
        name: proj.name,
        role: proj.role,
        url: "",
        description: proj.description,
        evidence: [],
      });
    }
  }

  if (collected.skills.length) {
    profile.skillGroups = [{ id: nanoid(8), category: "通用", skills: [...collected.skills] }];
  }

  for (const edu of collected.education) {
    const exists = profile.education.some((e) => e.institution === edu.institution);
    if (!exists) {
      profile.education.push({
        id: nanoid(8),
        institution: edu.institution,
        degree: edu.degree,
        field: edu.field,
        startDate: "",
        endDate: "",
      });
    }
  }

  for (const ev of collected.evidence) {
    const lastExp = profile.experiences[profile.experiences.length - 1];
    if (lastExp) {
      lastExp.bullets.push({
        id: nanoid(8),
        text: ev,
        evidence: [{ id: nanoid(8), type: "text", content: ev, note: "" }],
        isConfirmed: true,
      });
    }
  }
}