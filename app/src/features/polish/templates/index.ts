/**
 * 模板组件索引
 *
 * 导出所有 9 个模板组件，供 TemplatePreview 和导出功能使用。
 */

import type { ResumeDraft, ResumeStyle } from "../types";
import { T1Classic } from "./T1-Classic";
import { T2Modern } from "./T2-Modern";
import { T3Warm } from "./T3-Warm";
import { T4Compact } from "./T4-Compact";
import { H1Skills } from "./H1-Skills";
import { H2Achievement, H3Project, F1Functional, A1ATS } from "./RemainingTemplates";
import { PhotoPlaceholder } from "./PhotoPlaceholder";
import { TopHeader } from "./TopHeader";

export {
  T1Classic,
  T2Modern,
  T3Warm,
  T4Compact,
  H1Skills,
  H3Project,
  H2Achievement,
  F1Functional,
  A1ATS,
  PhotoPlaceholder,
  TopHeader,
};

/**
 * 模板组件映射表
 *
 * key: 模板 ID
 * value: React 组件
 */
export const TEMPLATE_COMPONENTS: Record<
  string,
  React.ComponentType<{ draft: ResumeDraft; style: ResumeStyle }>
> = {
  "t1-classic": T1Classic,
  "t2-modern": T2Modern,
  "t3-warm": T3Warm,
  "t4-compact": T4Compact,
  "h1-skills": H1Skills,
  "h2-achievement": H2Achievement,
  "h3-project": H3Project,
  "f1-functional": F1Functional,
  "a1-ats": A1ATS,
};

/**
 * 获取模板组件
 *
 * @param templateId - 模板 ID
 * @returns 模板组件，未找到时返回 T1Classic
 */
export function getTemplateComponent(templateId: string) {
  return TEMPLATE_COMPONENTS[templateId] ?? T1Classic;
}
