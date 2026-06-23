import type { ResumeTemplate } from "./templates";
import type { ResumeSectionKey } from "./types";
import { getTheme } from "./themes";
import { getTemplateDesign } from "./template-style";

/**
 * 简历模板库（9 个独立模板 × 5 主题 = 45 组合）
 *
 * 覆盖 5 种简历类型：
 * - Chronological (时序型) × 4: T1-Classic, T2-Modern, T3-Warm, T4-Compact
 * - Hybrid (混合式) × 3: H1-Skills, H2-Achievement, H3-Project
 * - Functional (功能式) × 1: F1-Functional
 * - ATS (ATS 优化) × 1: A1-ATS
 *
 * 9 模板的差异主要由"证件照位置 + 主题"驱动（见 template-style.ts）：
 *  - 时序类：证件照在右
 *  - 混合类：证件照在左
 *  - 功能/ATS：无证件照
 *
 * 样式参数（font/color/sectionOrder/fontSize/margins/lineSpacing）保留各模板独立调校。
 */

const ORDER_DEFAULT: ResumeSectionKey[] = [
  "summary",
  "workExperience",
  "projects",
  "education",
  "skills",
];

const ORDER_SKILLS_FIRST: ResumeSectionKey[] = [
  "summary",
  "skills",
  "workExperience",
  "projects",
  "education",
];

const ORDER_EDUCATION_FIRST: ResumeSectionKey[] = [
  "summary",
  "education",
  "skills",
  "projects",
  "workExperience",
];

/** 用 themeId 推导 colorScheme（colorScheme 由 theme 单一来源驱动，避免双写）。 */
function colorScheme(themeId: string) {
  const t = getTheme(themeId);
  return { primary: t.primary, accent: t.accent, text: t.text };
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  // ────────────────────────────────────────────────────────────
  // Chronological (时序型) × 4 — 证件照在右
  // ────────────────────────────────────────────────────────────

  {
    id: "t1-classic",
    name: "时序·简约版",
    type: "chronological",
    description: "白蓝·经典，Inter 无衬线，ATS 友好，适合大多数岗位。",
    photoPosition: "right",
    style: {
      themeId: "whiteBlue",
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: colorScheme("whiteBlue"),
      lineSpacing: 1.5,
      margins: { top: 20, right: 22, bottom: 20, left: 22 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "t2-modern",
    name: "时序·现代版",
    type: "chronological",
    description: "智能·科技（紫罗兰主色 + 顶/底色条），适合互联网/科技。",
    photoPosition: "right",
    style: {
      themeId: "intelligent",
      fontFamily: "Inter, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: colorScheme("intelligent"),
      lineSpacing: 1.5,
      margins: { top: 18, right: 20, bottom: 18, left: 20 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "t3-warm",
    name: "时序·暖色版",
    type: "chronological",
    description: "时尚·创意（terracotta + Playfair Display），适合创意/设计/市场岗。",
    photoPosition: "right",
    style: {
      themeId: "fashion",
      fontFamily: "'Playfair Display', 'PingFang SC', Georgia, serif",
      fontSize: 14,
      colorScheme: colorScheme("fashion"),
      lineSpacing: 1.6,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "t4-compact",
    name: "时序·紧凑版",
    type: "chronological",
    description: "黑蓝·ATS 紧凑版，1.4 倍行距，信息密度高。",
    photoPosition: "right",
    style: {
      themeId: "blackBlue",
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 13,
      colorScheme: colorScheme("blackBlue"),
      lineSpacing: 1.4,
      margins: { top: 16, right: 18, bottom: 16, left: 18 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  // ────────────────────────────────────────────────────────────
  // Hybrid (混合式) × 3 — 证件照在左
  // ────────────────────────────────────────────────────────────

  {
    id: "h1-skills",
    name: "混合·技能优先",
    type: "hybrid",
    description: "智能·科技 + 技能前置，适合技术岗突出能力栈。",
    photoPosition: "left",
    style: {
      themeId: "intelligent",
      fontFamily: "'Inter', 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: colorScheme("intelligent"),
      lineSpacing: 1.5,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ORDER_SKILLS_FIRST,
    },
  },

  {
    id: "h2-achievement",
    name: "混合·成就导向",
    type: "hybrid",
    description: "时尚·创意 + Playfair Display，适合管理/销售/咨询岗。",
    photoPosition: "left",
    style: {
      themeId: "fashion",
      fontFamily: "'Playfair Display', 'PingFang SC', Georgia, serif",
      fontSize: 14,
      colorScheme: colorScheme("fashion"),
      lineSpacing: 1.6,
      margins: { top: 22, right: 22, bottom: 22, left: 22 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "h3-project",
    name: "混合·项目导向",
    type: "hybrid",
    description: "白蓝·经典 + 项目前置 + 左侧色条，适合研发/产品经理。",
    photoPosition: "left",
    style: {
      themeId: "whiteBlue",
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: colorScheme("whiteBlue"),
      lineSpacing: 1.5,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: [
        "summary",
        "projects", // 项目前置
        "workExperience",
        "skills",
        "education",
      ],
    },
  },

  // ────────────────────────────────────────────────────────────
  // Functional (功能式) × 1 — 无证件照
  // ────────────────────────────────────────────────────────────

  {
    id: "f1-functional",
    name: "功能·转行版",
    type: "functional",
    description: "论文·传统（暖米底 + 衬线），弱化时间线突出可迁移技能。",
    photoPosition: "none",
    style: {
      themeId: "paper",
      fontFamily: "'Times New Roman', 'Songti SC', 'PingFang SC', serif",
      fontSize: 14,
      colorScheme: colorScheme("paper"),
      lineSpacing: 1.55,
      margins: { top: 22, right: 22, bottom: 22, left: 22 },
      sectionOrder: ORDER_SKILLS_FIRST,
    },
  },

  // ────────────────────────────────────────────────────────────
  // ATS (ATS 优化) × 1 — 无证件照
  // ────────────────────────────────────────────────────────────

  {
    id: "a1-ats",
    name: "ATS 优化版",
    type: "ats",
    description: "黑蓝·ATS（纯文本布局，无图形），最大化 ATS 解析准确率。",
    photoPosition: "none",
    style: {
      themeId: "blackBlue",
      fontFamily: "'Times New Roman', Georgia, 'Songti SC', serif",
      fontSize: 12,
      colorScheme: colorScheme("blackBlue"),
      lineSpacing: 1.15, // 紧凑行距
      margins: { top: 25, right: 25, bottom: 25, left: 25 }, // 标准 1 英寸边距
      sectionOrder: ORDER_EDUCATION_FIRST, // 教育背景前置（ATS 常规）
    },
  },
];

export type ResumeTemplateType = "chronological" | "hybrid" | "functional" | "ats";

export const TEMPLATE_TYPE_LABELS: Record<ResumeTemplateType, string> = {
  chronological: "时间倒序式",
  hybrid: "复合式",
  functional: "功能式",
  ats: "ATS 优化",
};

export const DEFAULT_TEMPLATE_ID = "t1-classic";

export function getTemplate(id: string): ResumeTemplate | undefined {
  return RESUME_TEMPLATES.find((t) => t.id === id);
}

/** 取模板的完整样式参数（含 templateId）；未知 id 回落默认模板。 */
export function getTemplateStyle(id: string) {
  const tpl = getTemplate(id) ?? getTemplate(DEFAULT_TEMPLATE_ID)!;
  return { templateId: tpl.id, ...tpl.style };
}

/** 取模板的"设计参数"（主题 + 证件照位置）；优先用 template-style.ts 的注册，缺省回落 t1。 */
export { getTemplateDesign };
