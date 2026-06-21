import { z } from "zod";
import { nanoid } from "nanoid";

/**
 * 简历草稿——润色产出，DOCX 导出的源。
 * 综合 PersonProfile + EvaluationReport 两个来源生成。
 */

export const ResumeBulletSchema = z.object({
  text: z.string(),
  sourceExpId: z.string().optional(),   // 关联的经历 ID
  sourceBulletId: z.string().optional(), // 关联的原要点 ID
  isConfirmed: z.boolean().default(false),
});

export const ResumeSectionSchema = z.object({
  title: z.string().default(""),
  items: z.array(
    z.object({
      id: z.string().default(() => nanoid(8)),
      organization: z.string().default(""),
      role: z.string().default(""),
      startDate: z.string().default(""),
      endDate: z.string().default(""),
      bullets: z.array(ResumeBulletSchema).default([]),
    }),
  ).default([]),
});

// ─── 模板与样式参数（Sprint 4.4） ──────────────────────────

/** 简历模块标识，用于 sectionOrder 排序。 */
export const ResumeSectionKey = z.enum([
  "summary",
  "workExperience",
  "projects",
  "education",
  "skills",
]);
export type ResumeSectionKey = z.infer<typeof ResumeSectionKey>;

/** 页边距（单位：mm）。 */
export const MarginsSchema = z.object({
  top: z.number().default(20),
  right: z.number().default(20),
  bottom: z.number().default(20),
  left: z.number().default(20),
});
export type Margins = z.infer<typeof MarginsSchema>;

/**
 * 样式参数——模板预设的可调样式集合。
 * 模板切换只替换这组参数，简历正文内容不变（design §4.3）。
 */
export const ResumeStyleSchema = z.object({
  templateId: z.string().default("chrono-minimal"),
  fontFamily: z.string().default("'Helvetica Neue', Arial, 'PingFang SC', sans-serif"),
  fontSize: z.number().default(14), // 正文字号 px
  colorScheme: z.object({
    primary: z.string().default("#2563eb"),   // 主色（标题/强调）
    accent: z.string().default("#64748b"),    // 辅色（次要文字）
    text: z.string().default("#0f172a"),      // 正文色
  }).default({ primary: "#2563eb", accent: "#64748b", text: "#0f172a" }),
  lineSpacing: z.number().default(1.5),        // 行距倍数
  margins: MarginsSchema.default({ top: 20, right: 20, bottom: 20, left: 20 }),
  sectionOrder: z.array(ResumeSectionKey).default([
    "summary",
    "workExperience",
    "projects",
    "education",
    "skills",
  ]),
});
export type ResumeStyle = z.infer<typeof ResumeStyleSchema>;

export const ResumeDraftSchema = z.object({
  profileId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // 简历正文
  name: z.string().default(""),
  title: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  summary: z.string().default(""),

  workExperience: ResumeSectionSchema.default({ title: "工作经历", items: [] }),
  projects: ResumeSectionSchema.default({ title:  "项目经历", items: [] }),
  education: ResumeSectionSchema.default({ title: "教育背景", items: [] }),
  skills: z.array(z.string()).default([]),

  // 模板与样式（Sprint 4.4）。templateId 同时冗余在顶层便于快速读取。
  templateId: z.string().default("chrono-minimal"),
  style: ResumeStyleSchema.default(ResumeStyleSchema.parse({})),

  // 状态
  status: z.enum(["draft", "confirmed"]).default("draft"),
});
export type ResumeDraft = z.infer<typeof ResumeDraftSchema>;
export type ResumeBullet = z.infer<typeof ResumeBulletSchema>;
