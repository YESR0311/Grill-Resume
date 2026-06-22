import type { ResumeTemplate } from "./templates";
import type { ResumeSectionKey } from "./types";

/**
 * 简历模板库（9 个独立模板）
 *
 * 覆盖 5 种简历类型：
 * - Chronological (时序型) × 4: T1-Classic, T2-Modern, T3-Warm, T4-Compact
 * - Hybrid (混合式) × 3: H1-Skills, H2-Achievement, H3-Project
 * - Functional (功能式) × 1: F1-Functional
 * - ATS (ATS 优化) × 1: A1-ATS
 *
 * 每个模板在以下维度差异化：
 * 1. 视觉：布局/排版/色彩/图形/密度
 * 2. 内容结构：模块取舍/排序/权重
 * 3. 表达策略：成就量化/关键词/行业适配
 * 4. 技术适配：ATS 兼容性
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

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  // ────────────────────────────────────────────────────────────
  // Chronological (时序型) × 4
  // ────────────────────────────────────────────────────────────

  {
    id: "t1-classic",
    name: "时序·简约版",
    type: "chronological",
    description: "黑白极简，Helvetica 无衬线，ATS 友好，适合大多数岗位。",
    photoPosition: "right",
    style: {
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: {
        primary: "#1F2421", // 暖墨色（design_sense ink）
        accent: "#5C635D", // 暖灰（design_sense muted）
        text: "#1F2421",
      },
      lineSpacing: 1.5,
      margins: { top: 20, right: 22, bottom: 20, left: 22 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "t2-modern",
    name: "时序·现代版",
    type: "chronological",
    description: "单侧强调色条，Inter 字体，适合互联网/科技行业。",
    photoPosition: "left",
    style: {
      fontFamily: "Inter, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: {
        primary: "#C4612F", // terracotta 主色
        accent: "#A94E22", // terracotta hover
        text: "#1F2421",
      },
      lineSpacing: 1.5,
      margins: { top: 18, right: 20, bottom: 18, left: 20 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "t3-warm",
    name: "时序·暖色版",
    type: "chronological",
    description: "Playfair Display 衬线标题，暖色系，适合创意/设计/市场岗。",
    photoPosition: "right",
    style: {
      fontFamily: "Inter, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: {
        primary: "#C4612F", // terracotta
        accent: "#A94E22",
        text: "#1F2421",
      },
      lineSpacing: 1.6,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "t4-compact",
    name: "时序·紧凑版",
    type: "chronological",
    description: "窄边距 + 1.4 倍行距，信息密度高，适合经验丰富者。",
    photoPosition: "right",
    style: {
      fontFamily: "'Times New Roman', Georgia, 'Songti SC', serif",
      fontSize: 13,
      colorScheme: {
        primary: "#1F2421",
        accent: "#5C635D",
        text: "#1F2421",
      },
      lineSpacing: 1.4,
      margins: { top: 16, right: 18, bottom: 16, left: 18 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  // ────────────────────────────────────────────────────────────
  // Hybrid (混合式) × 3
  // ────────────────────────────────────────────────────────────

  {
    id: "h1-skills",
    name: "混合·技能优先",
    type: "hybrid",
    description: "技能模块前置，适合技术岗突出能力栈。",
    photoPosition: "left",
    style: {
      fontFamily: "Inter, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: {
        primary: "#475569", // 冷灰蓝
        accent: "#94a3b8",
        text: "#1F2421",
      },
      lineSpacing: 1.5,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ORDER_SKILLS_FIRST,
    },
  },

  {
    id: "h2-achievement",
    name: "混合·成就导向",
    type: "hybrid",
    description: "履历优先 + 量化成就强调，适合管理/销售/咨询岗。",
    photoPosition: "right",
    style: {
      fontFamily: "Georgia, 'Times New Roman', 'Songti SC', serif",
      fontSize: 14,
      colorScheme: {
        primary: "#C4612F",
        accent: "#A94E22",
        text: "#1F2421",
      },
      lineSpacing: 1.6,
      margins: { top: 22, right: 22, bottom: 22, left: 22 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  {
    id: "h3-project",
    name: "混合·项目导向",
    type: "hybrid",
    description: "项目经历突出，适合研发/工程师/产品经理。",
    photoPosition: "left",
    style: {
      fontFamily: "Inter, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: {
        primary: "#1F2421",
        accent: "#5C635D",
        text: "#1F2421",
      },
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
  // Functional (功能式) × 1
  // ────────────────────────────────────────────────────────────

  {
    id: "f1-functional",
    name: "功能·转行版",
    type: "functional",
    description: "弱化时间线、突出可迁移技能，适合转行/跨行业求职。",
    photoPosition: "right",
    style: {
      fontFamily: "Inter, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: {
        primary: "#52525b", // 中性灰
        accent: "#a1a1aa",
        text: "#18181b",
      },
      lineSpacing: 1.55,
      margins: { top: 22, right: 22, bottom: 22, left: 22 },
      sectionOrder: ORDER_SKILLS_FIRST,
    },
  },

  // ────────────────────────────────────────────────────────────
  // ATS (ATS 优化) × 1
  // ────────────────────────────────────────────────────────────

  {
    id: "a1-ats",
    name: "ATS 优化版",
    type: "ats",
    description:
      "纯文本布局，无图形装饰，Times New Roman 衬线，最大化 ATS 解析准确率。",
    photoPosition: "right",
    style: {
      fontFamily: "'Times New Roman', Georgia, 'Songti SC', serif",
      fontSize: 12,
      colorScheme: {
        primary: "#000000", // 纯黑
        accent: "#000000",
        text: "#000000",
      },
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
