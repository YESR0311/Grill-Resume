import type { ResumeStyle, ResumeSectionKey } from "./types";

/**
 * 模板定义类型
 */

export interface ResumeTemplate {
  id: string;
  name: string;
  type: "chronological" | "hybrid" | "functional" | "ats";
  description: string;
  photoPosition: "left" | "right" | "none";
  style: Omit<ResumeStyle, "templateId">;
}

export type ResumeTemplateType = "chronological" | "hybrid" | "functional" | "ats";

// 重新导出 template-registry 的内容（模板元数据）
export {
  RESUME_TEMPLATES,
  TEMPLATE_TYPE_LABELS,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  getTemplateStyle,
} from "./template-registry";

// 重新导出 templates/ 目录的内容（模板组件）
// 收敛到单一入口 `@/features/polish/templates`，
// 避免与 `templates/` 文件夹同名冲突。
export {
  TEMPLATE_COMPONENTS,
  getTemplateComponent,
  T1Classic,
  T2Modern,
  T3Warm,
  T4Compact,
  H1Skills,
  H2Achievement,
  H3Project,
  F1Functional,
  A1ATS,
  PhotoPlaceholder,
} from "./templates/index";

export type { ResumeStyle, ResumeSectionKey };
