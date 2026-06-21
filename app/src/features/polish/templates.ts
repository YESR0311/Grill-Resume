import type { ResumeStyle, ResumeSectionKey } from "./types";

/**
 * 简历模板库（design §4.3，方案3：预设模板 + 自由调整）。
 *
 * 9 个模板覆盖 5 种简历类型：
 *   Chronological × 3（简约 / 商务 / 彩色）
 *   Hybrid       × 2（偏技能 / 偏履历）
 *   Functional   × 2（转行 / 应届）
 *   CV 学术      × 1（含论文成果区）
 *   Creative     × 1（偏设计美感）
 *
 * 每个模板预设：字体族 / 字号 / 颜色 / 间距 / 模块顺序。
 * 切换模板只替换样式参数（ResumeStyle），简历正文内容不变。
 */

export type ResumeTemplateType =
  | "chronological"
  | "hybrid"
  | "functional"
  | "cv"
  | "creative";

export type ResumeTemplate = {
  id: string;
  name: string;
  type: ResumeTemplateType;
  description: string;
  /** 该模板预设的完整样式参数（不含 templateId，应用时由 id 注入）。 */
  style: Omit<ResumeStyle, "templateId">;
};

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

const ORDER_CV: ResumeSectionKey[] = [
  "summary",
  "education",
  "workExperience",
  "projects",
  "skills",
];

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  // ── Chronological（时间倒序式）× 3 ──────────────────────────
  {
    id: "chrono-minimal",
    name: "时间倒序 · 简约版",
    type: "chronological",
    description: "黑白冷灰极简，适合大多数岗位，ATS 友好。",
    style: {
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: { primary: "#1e3a8a", accent: "#64748b", text: "#0f172a" },
      lineSpacing: 1.5,
      margins: { top: 20, right: 22, bottom: 20, left: 22 },
      sectionOrder: ORDER_DEFAULT,
    },
  },
  {
    id: "chrono-business",
    name: "时间倒序 · 商务正式版",
    type: "chronological",
    description: "深灰衬线标题，正式稳重，适合管理/金融/法务。",
    style: {
      fontFamily: "Georgia, 'Times New Roman', 'Songti SC', serif",
      fontSize: 14,
      colorScheme: { primary: "#374151", accent: "#6b7280", text: "#1f2937" },
      lineSpacing: 1.6,
      margins: { top: 24, right: 24, bottom: 24, left: 24 },
      sectionOrder: ORDER_DEFAULT,
    },
  },
  {
    id: "chrono-color",
    name: "时间倒序 · 彩色版",
    type: "chronological",
    description: "绿色强调线，明快活力，适合互联网/市场。",
    style: {
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: { primary: "#059669", accent: "#10b981", text: "#0f172a" },
      lineSpacing: 1.5,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  // ── Hybrid（复合式）× 2 ─────────────────────────────────────
  {
    id: "hybrid-skill",
    name: "复合式 · 偏技能展示",
    type: "hybrid",
    description: "技能模块前置，蓝灰配色，适合技术岗突出能力栈。",
    style: {
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: { primary: "#475569", accent: "#94a3b8", text: "#0f172a" },
      lineSpacing: 1.5,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ORDER_SKILLS_FIRST,
    },
  },
  {
    id: "hybrid-history",
    name: "复合式 · 偏履历展示",
    type: "hybrid",
    description: "履历优先兼顾技能，橙色强调，适合经验丰富者。",
    style: {
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: { primary: "#ea580c", accent: "#fb923c", text: "#0f172a" },
      lineSpacing: 1.5,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ORDER_DEFAULT,
    },
  },

  // ── Functional（功能式/技能式）× 2 ─────────────────────────
  {
    id: "functional-switch",
    name: "功能式 · 转行版",
    type: "functional",
    description: "弱化时间线、突出可迁移技能，灰色稳重，适合转行。",
    style: {
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: { primary: "#52525b", accent: "#a1a1aa", text: "#18181b" },
      lineSpacing: 1.55,
      margins: { top: 22, right: 22, bottom: 22, left: 22 },
      sectionOrder: ORDER_SKILLS_FIRST,
    },
  },
  {
    id: "functional-grad",
    name: "功能式 · 应届版",
    type: "functional",
    description: "教育与项目前置，蓝色清爽，适合应届/实习。",
    style: {
      fontFamily: "'Helvetica Neue', Arial, 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: { primary: "#2563eb", accent: "#60a5fa", text: "#0f172a" },
      lineSpacing: 1.5,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionOrder: ["summary", "education", "skills", "projects", "workExperience"],
    },
  },

  // ── CV 学术 × 1 ────────────────────────────────────────────
  {
    id: "cv-academic",
    name: "学术简历（CV）",
    type: "cv",
    description: "教育/研究前置，学术蓝衬线，含论文成果展示区域。",
    style: {
      fontFamily: "'Times New Roman', Georgia, 'Songti SC', serif",
      fontSize: 13,
      colorScheme: { primary: "#1e40af", accent: "#3b82f6", text: "#1e293b" },
      lineSpacing: 1.7,
      margins: { top: 24, right: 26, bottom: 24, left: 26 },
      sectionOrder: ORDER_CV,
    },
  },

  // ── Creative（创意）× 1 ────────────────────────────────────
  {
    id: "creative-design",
    name: "创意简历",
    type: "creative",
    description: "多彩强调、富设计感排版，适合设计/创意岗。",
    style: {
      fontFamily: "'Avenir Next', 'Helvetica Neue', 'PingFang SC', sans-serif",
      fontSize: 14,
      colorScheme: { primary: "#9333ea", accent: "#ec4899", text: "#1e1b4b" },
      lineSpacing: 1.55,
      margins: { top: 18, right: 18, bottom: 18, left: 18 },
      sectionOrder: ORDER_DEFAULT,
    },
  },
];

export const TEMPLATE_TYPE_LABELS: Record<ResumeTemplateType, string> = {
  chronological: "时间倒序式",
  hybrid: "复合式",
  functional: "功能式",
  cv: "学术简历",
  creative: "创意简历",
};

export const DEFAULT_TEMPLATE_ID = "chrono-minimal";

export function getTemplate(id: string): ResumeTemplate | undefined {
  return RESUME_TEMPLATES.find((t) => t.id === id);
}

/** 取模板的完整样式参数（含 templateId）；未知 id 回落默认模板。 */
export function getTemplateStyle(id: string): ResumeStyle {
  const tpl = getTemplate(id) ?? getTemplate(DEFAULT_TEMPLATE_ID)!;
  return { templateId: tpl.id, ...tpl.style };
}
