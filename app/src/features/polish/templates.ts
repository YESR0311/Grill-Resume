import type { ResumeStyle, ResumeSectionKey } from "./types";

/**
 * 模板定义类型
 */

export interface ResumeTemplate {
  id: string;
  name: string;
  type: "chronological" | "hybrid" | "functional" | "ats";
  description: string;
  photoPosition: "left" | "right";
  style: Omit<ResumeStyle, "templateId">;
}

export type ResumeTemplateType = "chronological" | "hybrid" | "functional" | "ats";

// 重新导出 template-registry 的内容
export {
  RESUME_TEMPLATES,
  TEMPLATE_TYPE_LABELS,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  getTemplateStyle,
} from "./template-registry";

export type { ResumeStyle, ResumeSectionKey };
