import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { chat, extractJson, requireTaskRoute, type ChatMessage } from "@/features/ai/chat";
import { PROMPTS_DIR } from "@/features/ai/prompts";
import { getProfile, saveProfile, createProfile } from "@/features/profile/store";
import type { PersonProfile } from "@/features/profile/types";
import { getIntakeLog, appendMessages } from "./store";

// ─── 问答维度 ────────────────────────────────────────────
// 脚本定义必须覆盖的维度，靠 prompt 引导模型逐一覆盖

import { type IntakeDimension } from "./constants";

// ─── 系统提示词（AI 行为约束核心，集中到 prompts/，design §6.3） ────

const SYSTEM_PROMPT = readFileSync(path.join(PROMPTS_DIR, "intake-system.md"), "utf8");

// 对话历史截断：保留 system + 最近 N 轮（每轮 user+assistant，共 2 条），降低 token 消耗
const MAX_HISTORY_TURNS = 10;

// ─── 初始问候语 ──────────────────────────────────────────

export function buildOpeningMessage(): ChatMessage {
  return {
    role: "assistant",
    content:
      "你好！我是你的简历辅导顾问。先请把你能想起来的经历、项目、技能、教育背景等尽可能详细地写出来，一次写多少都可以，之后我会逐步帮你补充完善。",
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
            bullets: z.array(z.string()).default([]),
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

  // 截断：只发送最近 MAX_HISTORY_TURNS 轮（早期对话的关键信息已累积进 profile）
  const recentHistory = log.messages.slice(-MAX_HISTORY_TURNS * 2);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const { text } = await chat(route.conn, route.model, { messages, temperature: 0.7, json: true });

  // 模型按 json mode 输出单一 JSON 对象（reply + collected + coveredDimensions + phase）
  let result: z.infer<typeof LlmOutputSchema>;
  const parsed = LlmOutputSchema.safeParse(extractJson(text));
  if (parsed.success) {
    result = parsed.data;
  } else {
    result = { reply: "", collected: { name: null, title: null, email: null, phone: null, location: null, experiences: [], projects: [], skills: [], education: [] }, coveredDimensions: [], phase: "basics" };
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

/**
 * 把一段经历的成果点（bullets）去重 append 到目标 experience。
 * 去重键：同一 experience 内 `bullet.text.trim()` 精确相等即视为重复（不做模糊/语义去重）。
 * 空文本安全跳过。
 */
function appendBullets(
  target: PersonProfile["experiences"][number],
  bullets: string[],
): void {
  for (const text of bullets) {
    const norm = text.trim();
    if (!norm) continue;
    const dup = target.bullets.some((b) => b.text.trim() === norm);
    if (dup) continue;
    target.bullets.push({
      id: nanoid(8),
      text: norm,
      evidence: [{ id: nanoid(8), type: "text", content: norm, note: "" }],
      isConfirmed: true,
    });
  }
}

export function mergeCollected(
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
    let target = profile.experiences.find((e) => e.organization + e.role === label);
    if (!target) {
      target = {
        id: nanoid(8),
        organization: exp.organization || exp.title || "",
        role: exp.role || "",
        startDate: exp.startDate || "",
        endDate: exp.endDate || "",
        bullets: [],
      };
      profile.experiences.push(target);
    }
    // 成果点按结构嵌套天然归属该经历，去重 append（含新建经历自带 bullets）
    appendBullets(target, exp.bullets);
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
}