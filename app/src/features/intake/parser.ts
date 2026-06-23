import "server-only";

import { chat, requireTaskRoute, extractJson, ProviderError } from "@/features/ai/chat";
import { loadIntakePrompt } from "./prompts-loader";
import {
  PARSE_SCHEMA_BY_DIMENSION,
  PARSE_PROMPT_BY_DIMENSION,
  type IntakeDimension,
  type ParseResultByDimension,
} from "./dimensions";
import { getIntakeLogByDimension } from "./store";
import type { ChatMessage } from "@/features/ai/chat";
import { z } from "zod";

/**
 * intake-v2 阶段解析引擎（子任务 3：API + parser engine）。
 *
 * 工作流：
 * 1. 拉取该 profile 当前阶段对话历史（按 dimension 过滤）。
 * 2. 拼装 system prompt（parse-<dimension>） + 对话历史作为 user/assistant 对。
 * 3. 调用 chat JSON 模式 → extractJson → schema 校验。
 * 4. 返回 ParseResultByDimension。
 *
 * 失败兜底：
 * - 解析失败（chat 异常 / JSON 校验失败）→ 返回 `empty` 完整结构。
 * - 调用方不感知失败，流程继续推进。
 */
export type ParseOptions = {
  profileId: string;
  dimension: IntakeDimension;
  /** 阶段对话历史（不传则内部按 dimension 拉取） */
  messages?: { role: "user" | "assistant"; content: string }[];
  /** 解析模型覆盖（默认走 settings AITask=intake 的路由） */
  routeTask?: "intake";
};

const EMPTY_RESULT: Record<IntakeDimension, ParseResultByDimension> = {
  basics: { completeness: "empty", data: { name: null, title: null, email: null, phone: null, location: null } },
  experience: { completeness: "empty", data: { experiences: [] } },
  project: { completeness: "empty", data: { projects: [] } },
  skill: { completeness: "empty", data: { skillGroups: [] } },
  education: { completeness: "empty", data: { education: [] } },
  evidence: { completeness: "empty", data: { evidence: [] } },
};

export async function parseDimension(
  opts: ParseOptions,
): Promise<ParseResultByDimension> {
  const { profileId, dimension } = opts;

  // 1. 拉取对话历史
  const messages = opts.messages
    ? opts.messages
    : (await getIntakeLogByDimension(profileId, dimension)).messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

  if (messages.length === 0) {
    return EMPTY_RESULT[dimension];
  }

  // 2. 拼装 prompt
  const systemPrompt = loadIntakePrompt(PARSE_PROMPT_BY_DIMENSION[dimension] as "parse-basics");
  const chatMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.map<ChatMessage>((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: "请基于以上对话历史，按 schema 输出 JSON。",
    },
  ];

  // 3. 调 AI
  let text: string;
  try {
    const route = requireTaskRoute(opts.routeTask ?? "intake");
    const res = await chat(route.conn, route.model, {
      messages: chatMessages,
      temperature: 0.2,
      json: true,
    });
    text = res.text;
  } catch (err) {
    console.error(`[intake-v2 parse] chat failed (${dimension}):`, err);
    return EMPTY_RESULT[dimension];
  }

  // 4. 提取 + 校验
  try {
    const raw = extractJson<unknown>(text);
    const schema = PARSE_SCHEMA_BY_DIMENSION[dimension];
    const parsed = schema.parse(raw) as ParseResultByDimension;
    return parsed;
  } catch (err) {
    console.error(`[intake-v2 parse] schema validation failed (${dimension}):`, err);
    if (err instanceof z.ZodError) {
      console.error(JSON.stringify(err.issues, null, 2));
    }
    return EMPTY_RESULT[dimension];
  }
}

/**
 * 一致性检查（贯穿所有 6 阶段结束后调用）。
 * 返回 warnings 列表，前端可在 polish 前展示。
 */
const ConsistencyCheckInputSchema = z.object({
  warnings: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high"]),
      message: z.string(),
      fields: z.array(z.string()).default([]),
    }),
  ),
});

export type ConsistencyWarning = {
  severity: "low" | "medium" | "high";
  message: string;
  fields: string[];
};

export async function runConsistencyCheck(
  profile: unknown,
  conversationDigest: string,
): Promise<ConsistencyWarning[]> {
  const systemPrompt = loadIntakePrompt("consistency-check");
  const chatMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `## 人物档案（已采集）\n${JSON.stringify(profile, null, 2)}\n\n## 对话摘要\n${conversationDigest}`,
    },
  ];

  try {
    const route = requireTaskRoute("intake");
    const res = await chat(route.conn, route.model, {
      messages: chatMessages,
      temperature: 0.3,
      json: true,
    });
    const raw = extractJson<unknown>(res.text);
    const parsed = ConsistencyCheckInputSchema.parse(raw);
    return parsed.warnings;
  } catch (err) {
    console.error("[intake-v2 consistency] failed:", err);
    return [];
  }
}

/**
 * 给前端用的：执行一次解析 + 写回 profile + 更新 intakeStatus。
 * 不抛异常——失败也走 empty 路径。
 */
export {
  ProviderError,
};
