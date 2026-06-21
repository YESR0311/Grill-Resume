import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Prompt 集中管理（design §6.3）。
 * 各 engine 通过本加载器读取 .md 提示词，避免硬编码字符串。
 * 路径基于 process.cwd()/src/features/ai/prompts，与项目其它读文件约定一致。
 */

export const PROMPTS_DIR = path.join(process.cwd(), "src", "features", "ai", "prompts");

const cache = new Map<string, string>();

export type PromptName =
  | "intake-system"
  | "intake-followup"
  | "evaluate-system"
  | "polish-revision"
  | "polish-system";

export function loadPrompt(name: PromptName): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  const text = readFileSync(path.join(PROMPTS_DIR, `${name}.md`), "utf8");
  cache.set(name, text);
  return text;
}
