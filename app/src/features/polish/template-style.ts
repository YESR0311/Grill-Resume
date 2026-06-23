/**
 * 9 模板 → 主题 + 证件照位置映射（Sprint 9 - 多主题差异化）。
 *
 * 设计差异：
 *  - 时序类（T1/T2/T3/T4）：证件照在右顶部
 *  - 混合类（H1/H2/H3）：证件照在左顶部
 *  - 功能/ATS（F1/A1）：不放证件照（紧凑 + ATS 不需要）
 *
 * 与 templates.ts 内的 TEMPLATE_COMPONENTS 的 id 一一对应。
 */

import type { ThemeId } from "./themes";

export type PhotoPosition = "left" | "right" | "none";

export interface TemplateDesign {
  theme: ThemeId;
  photo: PhotoPosition;
}

export const TEMPLATE_DESIGN: Record<string, TemplateDesign> = {
  // 时序类
  "t1-classic":     { theme: "whiteBlue",    photo: "right" },
  "t2-modern":      { theme: "intelligent",   photo: "right" },
  "t3-warm":        { theme: "fashion",       photo: "right" },
  "t4-compact":     { theme: "blackBlue",     photo: "right" },
  // 混合类
  "h1-skills":      { theme: "intelligent",   photo: "left"  },
  "h2-achievement": { theme: "fashion",       photo: "left"  },
  "h3-project":     { theme: "whiteBlue",     photo: "left"  },
  // 功能 / ATS
  "f1-functional":  { theme: "paper",         photo: "none"  },
  "a1-ats":         { theme: "blackBlue",     photo: "none"  },
};

export function getTemplateDesign(templateId: string): TemplateDesign {
  return TEMPLATE_DESIGN[templateId] ?? { theme: "whiteBlue", photo: "right" };
}
