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

const SYSTEM_PROMPT = `你是一位专业的简历辅导顾问，通过多轮对话引导用户梳理个人经历、构建人物档案。

## 工作方式
1. 每轮：阅读对话历史 + 用户最新回答，提出 1-2 个引导性问题，逐步深入。
2. 从基础（姓名、目标岗位、联系方式、城市）到经历细节（组织、角色、时间、可量化成果）、项目、技能、教育。
3. 用户信息可纯文字，无需文件佐证；信息不够具体时追问可量化的细节。
4. 覆盖全部维度后，将 phase 置为 "ready" 并在 reply 中告知用户可进入下一步。

## 必须覆盖维度
basics（姓名/岗位/联系方式/城市）、experience（工作经历）、project（项目）、skill（技能）、education（教育）、evidence（可量化成果/证据）

## 输出要求（严格遵守）
你必须**只输出一个 JSON 对象**，不要输出任何其他文字，不要用 markdown 围栏。结构：
{
  "reply": "给用户看的对话回复（你的引导提问，自然口语，中文）",
  "collected": {
    "name": 字符串或null, "title": 字符串或null, "email": 字符串或null, "phone": 字符串或null, "location": 字符串或null,
    "experiences": [{"organization":"","role":"","startDate":"","endDate":"","title":""}],
    "projects": [{"name":"","role":"","description":""}],
    "skills": ["技能名"],
    "education": [{"institution":"","degree":"","field":""}],
    "evidence": ["从用户本轮陈述中提炼的可量化成果点，每条一句话"]
  },
  "coveredDimensions": ["已采集到信息的维度名"],
  "phase": "basics|experience|project|skill|education|evidence|ready"
}

collected 只填本轮新获得或确认的信息，没有的字段填 null 或空数组；reply 字段里不要包含 JSON。`;

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
  reply: z.string().default(""),
  collected: z
    .object({
      name: z.string().nullable().default(null),
      title: z.string().nullable().default(null),
      email: z.string().nullable().default(null),
      phone: z.string().nullable().default(null),
      location: z.string().nullable().default(null),
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

  const { text } = await chat(route.conn, route.model, { messages, temperature: 0.7, json: true });

  // 模型按 json mode 输出单一 JSON 对象（reply + collected + coveredDimensions + phase）
  let result: z.infer<typeof LlmOutputSchema>;
  const parsed = LlmOutputSchema.safeParse(extractJson(text));
  if (parsed.success) {
    result = parsed.data;
  } else {
    result = { reply: "", collected: { name: null, title: null, email: null, phone: null, location: null, experiences: [], projects: [], skills: [], education: [], evidence: [] }, coveredDimensions: [], phase: "basics" };
  }

  const replyText = result.reply.trim() || "抱歉，我没太理解，能再补充一下吗？";

  // 把对话写入 intake log（assistant 存对用户可见的 reply，不存原始 JSON）
  await appendMessages(profileId, [
    { role: "user", content: userMessage },
    { role: "assistant", content: replyText },
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

  return {
    reply: replyText,
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
  if (collected.location) profile.location = collected.location;

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