import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * intake-v2 prompts 加载器。
 * 与 features/ai/prompts/index.ts 平行，专门管理 6 阶段对话 prompt + 6 阶段解析 prompt + 一致性检查 prompt。
 *
 * 路径基于 process.cwd()/src/features/intake/prompts。
 * standalone build 同样需要在 next.config.ts 的 outputFileTracingIncludes
 * 显式纳入 intake/prompts 下的 .md 文件（设计同 ai/prompts）。
 */
export const INTAKE_PROMPTS_DIR = path.join(process.cwd(), "src", "features", "intake", "prompts");

const cache = new Map<string, string>();

/** 6 个阶段对话 system prompt（与 INTAKE_DIMENSIONS 一一对应） */
export type ChatPromptName =
  | "chat-basics"
  | "chat-experience"
  | "chat-project"
  | "chat-skill"
  | "chat-education"
  | "chat-evidence";

/** 6 个阶段独立解析 prompt */
export type ParsePromptName =
  | "parse-basics"
  | "parse-experience"
  | "parse-project"
  | "parse-skill"
  | "parse-education"
  | "parse-evidence";

/** 6 阶段完成后的跨维度一致性检查 prompt */
export type ConsistencyPromptName = "consistency-check";

export type IntakePromptName = ChatPromptName | ParsePromptName | ConsistencyPromptName;

export function loadIntakePrompt(name: IntakePromptName): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const text = readFileSync(path.join(INTAKE_PROMPTS_DIR, `${name}.md`), "utf8");
  cache.set(name, text);
  return text;
}
