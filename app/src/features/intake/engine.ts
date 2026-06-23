import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { chat, extractJson, requireTaskRoute, type ChatMessage } from "@/features/ai/chat";
import { PROMPTS_DIR } from "@/features/ai/prompts";
import { getProfile, saveProfile, createProfile } from "@/features/profile/store";
import type { PersonProfile } from "@/features/profile/types";
import { getIntakeLog, getIntakeLogByDimension, appendMessages } from "./store";
import { loadIntakePrompt } from "./prompts-loader";
import {
  CHAT_PROMPT_BY_DIMENSION,
  DIMENSION_LABEL,
  type IntakeDimension as IntakeDimensionV2,
} from "./dimensions";

// ─── 问答维度 ────────────────────────────────────────────
// 脚本定义必须覆盖的维度，靠 prompt 引导模型逐一覆盖

import { type IntakeDimension, INTAKE_DIMENSIONS, INTAKE_DIMENSION_LABELS } from "./constants";

// ─── 系统提示词（AI 行为约束核心，集中到 prompts/，design §6.3） ────

const SYSTEM_PROMPT = readFileSync(path.join(PROMPTS_DIR, "intake-system.md"), "utf8");

// 对话历史截断：保留 system + 最近 N 轮（每轮 user+assistant，共 2 条），降低 token 消耗
const MAX_HISTORY_TURNS = 10;

// ─── intake-v2：自由对话（不解析结构化），AI 决定阶段完成 ──────────────

/** AI 判定阶段完成的隐藏标记，前端检测后去掉再展示并触发解析。 */
export const PHASE_COMPLETE_MARKER = "<<PHASE_COMPLETE>>";

export type ChatTurnResult = {
  /** 对用户展示的回复（已去掉 PHASE_COMPLETE 标记） */
  reply: string;
  /** AI 是否判定本阶段已聊够 */
  phaseComplete: boolean;
};

/**
 * intake-v2 处理一轮自由对话。
 * - 用对应阶段的 chat-<dimension> system prompt 约束 AI 行为。
 * - 只取本阶段（dimension）对话历史作上下文。
 * - 不解析结构化数据（解析交给 /api/intake/parse）。
 * - 检测 PHASE_COMPLETE_MARKER，去标记后返回 phaseComplete。
 * - 把对话写入 intake_messages（带 dimension 标记）。
 */
export async function runChatTurn(
  profileId: string,
  dimension: IntakeDimensionV2,
  userMessage: string,
): Promise<ChatTurnResult> {
  await (getProfile(profileId) ?? createProfile({ id: profileId }));

  const route = requireTaskRoute("intake");
  const systemPrompt = loadIntakePrompt(CHAT_PROMPT_BY_DIMENSION[dimension] as "chat-basics");

  // 只取本阶段对话历史（避免跨阶段串扰）
  const log = await getIntakeLogByDimension(profileId, dimension);
  const recentHistory = log.messages.slice(-MAX_HISTORY_TURNS * 2);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map<ChatMessage>((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  // 自由对话：不要 JSON 模式
  const { text } = await chat(route.conn, route.model, { messages, temperature: 0.7 });

  const raw = (text ?? "").trim();
  const phaseComplete = raw.includes(PHASE_COMPLETE_MARKER);
  // 去掉标记（含其前后空白行）后展示
  let reply = raw.replace(new RegExp(`\\n*\\s*${escapeRegExp(PHASE_COMPLETE_MARKER)}\\s*`, "g"), "").trim();
  if (!reply) {
    // 极端情况：AI 只回了标记，给一个收尾兜底文案
    reply = `好的，「${DIMENSION_LABEL[dimension]}」这部分我们先聊到这里。`;
  }

  // 写入对话（带 dimension 标记）
  await appendMessages(profileId, [
    { role: "user", content: userMessage, dimension },
    { role: "assistant", content: reply, dimension },
  ]);

  return { reply, phaseComplete };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── 初始问候语（v1 legacy） ──────────────────────────────────────────

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
            // 已有经历的稳定 id：LLM 补充某段既有经历时回传该 id，merge 按 id 精确匹配；
            // 全新经历留空，merge 退化为归一化 label 匹配（向后兼容，LLM 不回传 id 不崩）
            id: z.string().optional().default(""),
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

  // 注入「已采集经历摘要」context：让 LLM 补充某段既有经历时回传其 id，merge 按 id 精确匹配，
  // 避免同一经历因 organization 跨轮时有时无（label 波动）被重复创建、bullets 分散。
  // 每轮重新生成（反映最新档案）；不写入 intake log、不受 MAX_HISTORY_TURNS 截断。
  const experienceMsg: ChatMessage = { role: "system", content: buildExperienceDigest(profile) };

  // 注入「已覆盖/未覆盖维度」context：引导 LLM 优先追问欠缺维度
  const dimensionMsg: ChatMessage = { role: "system", content: buildDimensionDigest(profile) };

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    experienceMsg,
    dimensionMsg,
    ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const { text } = await chat(route.conn, route.model, { messages, temperature: 0.7, json: true });

  // 解析容错三级（design §A1）：
  //   ① LLM schema 成功 → 用之。
  //   ② 失败但 text 非空 → 把整段 text 当 reply（保证对话不断），collected 空、维度/phase 沿用。
  //   ③ text 也空 → 基于未覆盖维度的上下文感知 fallback。
  let result: z.infer<typeof LlmOutputSchema>;
  const parsed = LlmOutputSchema.safeParse(extractJson(text));
  if (parsed.success) {
    result = parsed.data;
  } else {
    const raw = text.trim();
    if (raw) {
      // ② 模型输出了自由文本而非 JSON，或 extractJson 失败：至少把回复展示给用户
      result = {
        reply: raw,
        collected: { name: null, title: null, email: null, phone: null, location: null, experiences: [], projects: [], skills: [], education: [] },
        coveredDimensions: profile.intakeStatus.coveredDimensions,
        phase: profile.intakeStatus.phase,
      };
    } else {
      // ③ 真正异常：基于未覆盖维度生成上下文感知的 fallback
      const uncovered = [...INTAKE_DIMENSIONS].filter(d => !profile.intakeStatus.coveredDimensions.includes(d));
      const fallbackReplies: Record<IntakeDimension, string> = {
        basics: "请问你的姓名和目标岗位是什么？",
        experience: "能说说你的工作经历吗？从最近的一份开始就好。",
        project: "你参与过哪些项目？可以简单介绍一下。",
        skill: "你有哪些技能？比如编程语言、工具、框架等。",
        education: "你的教育背景是怎样的？",
        evidence: "在这些经历中，有没有一些具体的成果或数据可以分享？",
      };
      // 优先用未覆盖维度的追问
      const primaryDimension = uncovered[0] as IntakeDimension | undefined;
      const fallbackReply = primaryDimension ? fallbackReplies[primaryDimension] : "你还有什么想补充的吗？";
      result = { reply: fallbackReply, collected: { name: null, title: null, email: null, phone: null, location: null, experiences: [], projects: [], skills: [], education: [] }, coveredDimensions: profile.intakeStatus.coveredDimensions, phase: profile.intakeStatus.phase };
    }
  }

  // 把对话写入 intake log（assistant 存对用户可见的 reply，不存原始 JSON）
  await appendMessages(profileId, [
    { role: "user", content: userMessage },
    { role: "assistant", content: result.reply },
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
    reply: result.reply,
    coveredDimensions: profile.intakeStatus.coveredDimensions,
    phase: profile.intakeStatus.phase,
  };
}

// ─── 经历摘要注入 ──────────────────────────────────────────

/**
 * 生成「已采集经历」摘要，供 LLM 回传稳定经历 id（方案 b）。
 * 列出每段经历的 id|organization|role|startDate；无经历时给占位文案。
 */
function buildExperienceDigest(profile: PersonProfile): string {
  if (!profile.experiences.length) {
    return "【当前尚无已采集经历】";
  }
  const lines = profile.experiences
    .map((e) => {
      const org = e.organization || "(未填机构)";
      const role = e.role || "(未填角色)";
      const date = e.startDate ? ` | ${e.startDate}` : "";
      return `- id=${e.id} | ${org} | ${role}${date}`;
    })
    .join("\n");
  return `【已采集经历，补充其成果/信息时请在该经历对象里带上对应 id】\n${lines}`;
}

/**
 * 生成「已覆盖/未覆盖维度」上下文（design §A2）。
 * 引导 LLM 优先追问未覆盖维度，最大化档案填充。
 */
function buildDimensionDigest(profile: PersonProfile): string {
  const covered = new Set(profile.intakeStatus.coveredDimensions);
  const all = [...INTAKE_DIMENSIONS];
  const uncovered = all.filter((d) => !covered.has(d));
  const coveredStr = all
    .filter((d) => covered.has(d))
    .map((d) => INTAKE_DIMENSION_LABELS[d] ?? d)
    .join("、");
  const uncoveredStr = uncovered
    .map((d) => INTAKE_DIMENSION_LABELS[d] ?? d)
    .join("、");
  let msg = "【当前档案各维度采集状态】\n";
  if (coveredStr) msg += `已覆盖：${coveredStr}\n`;
  if (uncoveredStr) msg += `尚未覆盖：${uncoveredStr}\n`;
  if (uncoveredStr) {
    msg += "请优先追问未覆盖维度，每次 1-2 个具体问题，引导用户补充这些信息。\n";
  } else {
    msg += "所有维度均已覆盖，可以深挖已有信息的量化细节或确认用户是否还有要补充的内容。\n";
  }
  return msg;
}

// ─── Merge ────────────────────────────────────────────────

/**
 * 经历匹配键归一化：trim + 转小写 + 连续空白折叠为单空格。
 * 用于「无 id」回退路径，吸收大小写/空白差异导致的 label 波动。
 */
function normalizeLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

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
    // 三级匹配优先级（design §2.5）：
    //   ① exp.id 非空且 profile 已有该 id → 命中（精确，方案 b 主路径）
    //   ② 归一化 label：normalize(org||title)+normalize(role) → 命中（无 id 回退，吸收大小写/空白波动）
    //   ③ 都未命中 → 新建
    let target: PersonProfile["experiences"][number] | undefined;
    if (exp.id) {
      target = profile.experiences.find((e) => e.id === exp.id);
    }
    if (!target) {
      const label = normalizeLabel(exp.organization || exp.title) + "|" + normalizeLabel(exp.role);
      target = profile.experiences.find(
        (e) => normalizeLabel(e.organization) + "|" + normalizeLabel(e.role) === label,
      );
    }
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
    } else {
      // 命中已有经历：补全此前为空的字段，不覆盖已有非空值（避免后续轮把已填信息抹掉）
      if (!target.organization && (exp.organization || exp.title)) {
        target.organization = exp.organization || exp.title;
      }
      if (!target.role && exp.role) target.role = exp.role;
      if (!target.startDate && exp.startDate) target.startDate = exp.startDate;
      if (!target.endDate && exp.endDate) target.endDate = exp.endDate;
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